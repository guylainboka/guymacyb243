// Guymacyb243 — server/wslBridge.ts
// ---------------------------------------------------------------
// Pont réel vers WSL 2 (Windows Subsystem for Linux).
// Exécute de vraies commandes Linux via wsl.exe et retourne le résultat réel.
// Aucune simulation : si WSL n'est pas installé, on retourne { ready: false }.

import { spawn } from 'child_process';

const IS_WIN = process.platform === 'win32';

export interface WslStatus {
  ready: boolean;
  distros: { name: string; state: string; version: string }[];
  defaultDistro: string | null;
  reason?: string;
}

export interface WslExecResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  distro?: string;
}

/** Vérifie la disponibilité réelle de WSL 2 + liste les distros installés. */
export async function checkWslAvailability(): Promise<WslStatus> {
  if (!IS_WIN) {
    return {
      ready: true,
      distros: [{ name: 'native-linux', state: 'Running', version: 'native' }],
      defaultDistro: 'native-linux',
      reason: 'Linux natif — exécution directe (pas de WSL requis)',
    };
  }
  try {
    const listRes = await runCmd('wsl.exe', ['-l', '-v'], 8000);
    if (listRes.exitCode !== 0) {
      return { ready: false, distros: [], defaultDistro: null, reason: 'wsl.exe retourne une erreur' };
    }
    const out = (listRes.stdout + listRes.stderr).replace(/\x00/g, '').replace(/\x1b\[[0-9;]*m/g, '');
    const lines = out.split('\n').map((l) => l.trim()).filter(Boolean);
    const distros: { name: string; state: string; version: string }[] = [];
    for (const line of lines.slice(1)) {
      const parts = line.split(/\s+/);
      if (parts.length >= 3 && parts[0] !== 'NAME') {
        distros.push({ name: parts[0], state: parts[1], version: parts[2] });
      }
    }
    if (distros.length === 0) {
      return {
        ready: false,
        distros: [],
        defaultDistro: null,
        reason: "WSL installé mais aucun distro — lancez « wsl --install -d Ubuntu »",
      };
    }
    const defaultDistro = distros[0].name;
    const testRes = await runCmd('wsl.exe', ['-d', defaultDistro, '--', 'echo', 'ok'], 10000);
    if (testRes.exitCode !== 0 || !testRes.stdout.includes('ok')) {
      return {
        ready: false,
        distros,
        defaultDistro,
        reason: `Le distro ${defaultDistro} ne démarre pas (code ${testRes.exitCode})`,
      };
    }
    return { ready: true, distros, defaultDistro };
  } catch (err: any) {
    return {
      ready: false,
      distros: [],
      defaultDistro: null,
      reason: `wsl.exe introuvable — WSL 2 non installé (${err.message})`,
    };
  }
}

/** Exécute une commande dans WSL (ou directement si Linux natif). Retour réel. */
export async function execInWsl(command: string, timeoutMs = 60000): Promise<WslExecResult> {
  const start = Date.now();
  if (!IS_WIN) {
    const res = await runCmd('bash', ['-c', command], timeoutMs);
    return { ...res, durationMs: Date.now() - start };
  }
  const status = await checkWslAvailability();
  if (!status.ready || !status.defaultDistro) {
    return {
      exitCode: -1,
      stdout: '',
      stderr: status.reason || 'WSL non disponible',
      durationMs: Date.now() - start,
      distro: undefined,
    };
  }
  const res = await runCmd('wsl.exe', ['-d', status.defaultDistro, '--', 'bash', '-c', command], timeoutMs);
  return { ...res, durationMs: Date.now() - start, distro: status.defaultDistro };
}

/** Wrapper child_process qui capture stdout/stderr réels. */
function runCmd(cmd: string, args: string[], timeoutMs: number): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      timeout: timeoutMs,
      env: { ...process.env, LANG: 'C.UTF-8' },
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('error', (e) => resolve({ exitCode: -1, stdout, stderr: stderr + e.message }));
    child.on('close', (code) => resolve({ exitCode: code ?? -1, stdout, stderr }));
  });
}

/** Liste des outils Linux installés dans WSL (vraie détection via which). */
export async function detectInstalledTools(tools: string[]): Promise<Record<string, boolean>> {
  const result: Record<string, boolean> = {};
  if (tools.length === 0) return result;
  const whichCmd = `which ${tools.join(' ')} 2>/dev/null; echo "---EXIT:$?"`;
  const res = await execInWsl(whichCmd, 15000);
  const lines = res.stdout.split('\n').filter((l) => l && !l.startsWith('---'));
  for (const t of tools) {
    result[t] = lines.some((l) => l.includes('/' + t) || l.endsWith(t));
  }
  return result;
}

/** Installe des paquets apt dans WSL (via root pour éviter le prompt sudo). */
export async function installAptPackages(packages: string[]): Promise<WslExecResult> {
  const cmd = `apt-get update -qq 2>&1 && apt-get install -y ${packages.join(' ')} 2>&1`;
  if (!IS_WIN) {
    return execInWsl(`sudo bash -c '${cmd}'`, 300000);
  }
  const status = await checkWslAvailability();
  if (!status.ready || !status.defaultDistro) {
    return {
      exitCode: -1,
      stdout: '',
      stderr: status.reason || 'WSL non disponible',
      durationMs: 0,
    };
  }
  const start = Date.now();
  return new Promise((resolve) => {
    const child = spawn('wsl.exe', ['-d', status.defaultDistro!, '-u', 'root', '--', 'bash', '-c', cmd], {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('error', (e) => resolve({ exitCode: -1, stdout, stderr: stderr + e.message, durationMs: Date.now() - start }));
    child.on('close', (code) => resolve({ exitCode: code ?? -1, stdout, stderr, durationMs: Date.now() - start }));
  });
}
