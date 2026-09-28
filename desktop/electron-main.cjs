// Guymacyb243 — Electron Main Process
// ---------------------------------------------------------------
// Shell desktop qui :
// 1. Au premier lancement : affiche un wizard qui OBLIGE l'utilisateur à
//    installer WSL 2 + Docker + les outils Kali nécessaires. Aucune config
//    incomplète — le wizard vérifie RÉELLEMENT chaque installation.
// 2. En production : spawn le backend Express (dist-server/server.cjs) et
//    ouvre la fenêtre principale sur http://127.0.0.1:3001.
//
// Élévation UAC via sudo-prompt pour les installations nécessitant admin.

const { app, BrowserWindow, shell, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const APP_NAME = 'Guymacyb243';
const APP_VERSION = '1.0.0';
const SERVER_PORT = 3001;
const SERVER_HOST = '127.0.0.1';
const HEALTH_URL = `http://${SERVER_HOST}:${SERVER_PORT}/api/health`;

const IS_DEV = process.env.GCYB243_DEV === '1' || process.env.NODE_ENV === 'development';

const PROJECT_ROOT = IS_DEV
  ? path.resolve(__dirname, '..')
  : path.dirname(app.getPath('exe'));
const RESOURCES_DIR = IS_DEV ? PROJECT_ROOT : process.resourcesPath;
const SERVER_BUNDLE = path.join(RESOURCES_DIR, 'dist-server', 'server.cjs');
const SETUP_DONE_FILE = path.join(app.getPath('userData'), '.guymacyb243-setup-done');

let mainWindow = null;
let serverProcess = null;
let wizardWindow = null;
let isQuitting = false;

// Single instance lock
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

// --- Backend lifecycle ---

function buildServerEnv() {
  const env = { ...process.env };
  env.ELECTRON_RUN_AS_NODE = '1';
  env.NODE_ENV = 'production';
  env.PORT = String(SERVER_PORT);
  env.HOST = SERVER_HOST;
  env.GCYB243_DESKTOP = '1';
  env.GCYB243_VERSION = APP_VERSION;
  try {
    env.GCYB243_DB_PATH = path.join(app.getPath('userData'), 'guymacyb243.db');
  } catch (e) {
    console.warn('[Guymacyb243] userData path unavailable:', e);
  }
  return env;
}

function startBackendServer() {
  if (IS_DEV) {
    console.log('[Guymacyb243] DEV mode — le backend doit tourner séparément (npm:dev:vite + npm:dev:electron lancent Vite sur 5173 et le backend sur 3001).');
    return null;
  }
  if (!fs.existsSync(SERVER_BUNDLE)) {
    dialog.showErrorBox(`${APP_NAME} — installation corrompue`,
      `Le bundle serveur est introuvable :\n\n${SERVER_BUNDLE}\n\nRéinstallez ${APP_NAME}.`);
    app.quit();
    return null;
  }
  const env = buildServerEnv();
  console.log(`[Guymacyb243] spawning backend: ${process.execPath} ${SERVER_BUNDLE}`);
  const child = spawn(process.execPath, [SERVER_BUNDLE], {
    cwd: RESOURCES_DIR,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  let output = '';
  child.stdout.on('data', (d) => { const s = d.toString(); output += s; process.stdout.write(`[server] ${s}`); });
  child.stderr.on('data', (d) => { const s = d.toString(); output += s; process.stderr.write(`[server] ${s}`); });
  child.on('exit', (code, signal) => {
    console.log(`[Guymacyb243] backend exited (code=${code} signal=${signal})`);
    if (!isQuitting && code !== 0) {
      dialog.showErrorBox(`${APP_NAME} — backend crash`,
        `Le moteur s'est arrêté (code ${code}).\n\nDétails:\n${output.slice(-2000).trim()}`);
      app.quit();
    }
  });
  child.on('error', (err) => {
    dialog.showErrorBox(`${APP_NAME} — erreur de démarrage`, `Impossible de démarrer le backend: ${err.message}`);
    app.quit();
  });
  return child;
}

function stopBackendServer() {
  if (!serverProcess) return;
  isQuitting = true;
  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(serverProcess.pid), '/f', '/t'], { stdio: 'ignore', windowsHide: true });
    } else {
      serverProcess.kill('SIGTERM');
      setTimeout(() => { try { serverProcess.kill('SIGKILL'); } catch {} }, 3000);
    }
  } catch (err) {
    console.warn('[Guymacyb243] error stopping backend:', err);
  }
}

function waitForServer() {
  return new Promise((resolve) => {
    const http = require('http');
    const start = Date.now();
    const check = () => {
      const req = http.get({ hostname: SERVER_HOST, port: SERVER_PORT, path: '/api/health', timeout: 2000 }, (res) => {
        res.resume();
        if (res.statusCode === 200) resolve(true);
        else scheduleNext();
      });
      req.on('error', () => scheduleNext());
      req.on('timeout', () => { req.destroy(); scheduleNext(); });
    };
    const scheduleNext = () => {
      if (Date.now() - start >= 30000) resolve(false);
      else setTimeout(check, 300);
    };
    check();
  });
}

// --- Wizard (premier lancement) ---

function shouldShowWizard() {
  if (IS_DEV) return false;
  if (process.env.GCYB243_SHOW_SETUP === '1') return true;
  return !fs.existsSync(SETUP_DONE_FILE);
}

function createWizardWindow() {
  wizardWindow = new BrowserWindow({
    width: 900,
    height: 700,
    minWidth: 760,
    minHeight: 600,
    title: `${APP_NAME} — Assistant d'installation`,
    backgroundColor: '#0a0e18',
    frame: true,
    autoHideMenuBar: true,
    show: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      preload: path.join(__dirname, 'setup-preload.cjs'),
    },
  });
  wizardWindow.loadFile(path.join(__dirname, 'wizard.html'));
  wizardWindow.on('closed', () => { wizardWindow = null; });
}

// --- Main window ---

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: `${APP_NAME} v${APP_VERSION}`,
    backgroundColor: '#0a0e18',
    frame: true,
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('closed', () => { mainWindow = null; });
}

async function loadApp() {
  const url = IS_DEV ? 'http://127.0.0.1:5173' : `http://${SERVER_HOST}:${SERVER_PORT}`;
  const ok = IS_DEV ? true : await waitForServer();
  if (!ok) {
    dialog.showErrorBox(`${APP_NAME} — démarrage impossible`,
      `Le backend n'a pas répondu sur ${url}. Vérifiez votre antivirus ou pare-feu.`);
    app.quit();
    return;
  }
  if (!mainWindow) return;
  mainWindow.loadURL(url).catch((err) => console.error('[Guymacyb243] loadURL failed:', err));
}

// --- IPC handlers (wizard + window controls) ---

ipcMain.handle('setup:detect', async () => {
  // Délègue au backend (déjà démarré en mode dev, ou on le lance pour le diagnostic)
  try {
    const res = await fetch(`http://${SERVER_HOST}:${SERVER_PORT}/api/system/diagnostic`);
    return await res.json();
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('setup:install-wsl', async (event) => {
  // Élévation UAC réelle via sudo-prompt
  const progress = (line) => event.sender.send('setup:progress', line);
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      return resolve({ ok: true, message: 'Linux natif — WSL non requis' });
    }
    progress('$ wsl --install (élévation UAC)');
    try {
      const sudo = require('sudo-prompt');
      sudo.exec('wsl --install -d Ubuntu', { name: APP_NAME }, (err, stdout, stderr) => {
        if (err) {
          progress(`✗ ${err.message}`);
          resolve({ ok: false, message: err.message });
        } else {
          progress('✓ WSL installé');
          resolve({ ok: true, message: 'WSL installé — redémarrage peut être requis' });
        }
      });
    } catch (err) {
      resolve({ ok: false, message: `sudo-prompt indisponible: ${err.message}` });
    }
  });
});

ipcMain.handle('setup:install-tools', async (event) => {
  const progress = (line) => event.sender.send('setup:progress', line);
  progress('$ apt-get install nmap nikto sqlmap aircrack-ng ... (via WSL root)');
  try {
    const packages = ['nmap', 'nikto', 'sqlmap', 'whatweb', 'gobuster', 'aircrack-ng', 'iw', 'wireless-tools', 'reaver', 'hashcat', 'exploitdb'];
    const res = await fetch(`http://${SERVER_HOST}:${SERVER_PORT}/api/wsl/exec`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        command: `apt-get update -qq && apt-get install -y ${packages.join(' ')} 2>&1 | tail -30`,
        timeoutMs: 600000,
      }),
    });
    const data = await res.json();
    if (data.stdout) progress(data.stdout.slice(-500));
    resolve_progress: progress(data.exitCode === 0 ? '✓ Outils installés' : `⚠ code ${data.exitCode}`);
    return { ok: data.exitCode === 0, message: data.stdout?.slice(-300) || data.stderr?.slice(-300) };
  } catch (err) {
    return { ok: false, message: err.message };
  }
});

ipcMain.handle('setup:complete', async (event) => {
  try {
    fs.writeFileSync(SETUP_DONE_FILE, JSON.stringify({ completedAt: new Date().toISOString() }));
  } catch (e) { /* ignore */ }
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.close();
  if (!IS_DEV) {
    serverProcess = startBackendServer();
  }
  createWindow();
  await loadApp();
  return { ok: true };
});

ipcMain.handle('window:minimize', () => mainWindow?.minimize());
ipcMain.handle('window:maximize', () => {
  if (!mainWindow) return false;
  if (mainWindow.isMaximized()) { mainWindow.unmaximize(); return false; }
  mainWindow.maximize(); return true;
});
ipcMain.handle('window:close', () => mainWindow?.close());

// --- App lifecycle ---

app.whenReady().then(async () => {
  if (shouldShowWizard()) {
    console.log('[Guymacyb243] Premier lancement — affichage du wizard.');
    // En dev, le backend tourne déjà (npm run dev:vite + electron). En prod, on le lance.
    if (!IS_DEV) {
      serverProcess = startBackendServer();
    }
    createWizardWindow();
    return;
  }
  if (!IS_DEV) {
    serverProcess = startBackendServer();
  }
  createWindow();
  await loadApp();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) { createWindow(); loadApp(); }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => stopBackendServer());
process.on('SIGINT', () => { stopBackendServer(); process.exit(0); });
process.on('SIGTERM', () => { stopBackendServer(); process.exit(0); });
