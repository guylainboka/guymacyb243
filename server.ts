// Guymacyb243 — Backend Express (point d'entrée)
// ---------------------------------------------------------------
// Architecture en modules clairs :
//   server.ts (ce fichier) → routeur HTTP/WS
//   server/wslBridge.ts   → exécution réelle des outils Linux via WSL 2
//   server/toolManager.ts → détection + installation réelle des outils
//   server/labManager.ts  → laboratoires Docker réels et isolés
//   server/terminalManager.ts → terminaux natifs réels (node-pty)
//   server/db.ts          → persistance SQLite
//
// Aucune simulation. Si une fonctionnalité n'est pas disponible, l'API
// retourne un état honnête : { ready: false, reason: "..." } plutôt que
// des données inventées.

import express from 'express';
import http from 'http';
import path from 'path';
import cors from 'cors';
import { Server as IoServer } from 'socket.io';
import { getDatabase, saveDatabaseToDisk } from './server/db';
import { getSystemDiagnostic } from './server/toolManager';
import { listLabEnvironments, startLab, stopLab, getLabStatus } from './server/labManager';
import { registerTerminalHandlers } from './server/terminalManager';
import { execInWsl, checkWslAvailability } from './server/wslBridge';

const PORT = Number(process.env.PORT) || 3001;
const HOST = process.env.HOST || '127.0.0.1';

async function startServer() {
  const app = express();
  app.use(cors({ origin: true }));
  app.use(express.json({ limit: '5mb' }));
  app.disable('x-powered-by');

  // Headers de sécurité
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'no-referrer');
    next();
  });

  // Initialisation SQLite
  await getDatabase();

  const httpServer = http.createServer(app);
  const io = new IoServer(httpServer, {
    cors: { origin: true, methods: ['GET', 'POST'] },
    transports: ['websocket'],
  });

  // --- Health ---
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'UP',
      version: '1.0.0',
      pid: process.pid,
      memoryMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      uptime: Math.round(process.uptime()),
    });
  });

  // --- Diagnostic système complet (réel) ---
  app.get('/api/system/diagnostic', async (_req, res) => {
    try {
      const diag = await getSystemDiagnostic();
      res.json(diag);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- État WSL 2 ---
  app.get('/api/wsl/status', async (_req, res) => {
    try {
      const status = await checkWslAvailability();
      res.json(status);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- Exécution d'une commande dans WSL (réel) ---
  app.post('/api/wsl/exec', async (req, res) => {
    try {
      const { command, timeoutMs } = req.body || {};
      if (!command) return res.status(400).json({ error: 'command requis' });
      const result = await execInWsl(command, timeoutMs || 60000);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- Laboratoire : lister / démarrer / arrêter / statut (réel) ---
  app.get('/api/lab/environments', async (_req, res) => {
    try { res.json(await listLabEnvironments()); }
    catch (err: any) { res.status(500).json({ error: err.message }); }
  });
  app.post('/api/lab/:id/start', async (req, res) => {
    try { res.json(await startLab(req.params.id)); }
    catch (err: any) { res.status(500).json({ error: err.message }); }
  });
  app.post('/api/lab/:id/stop', async (req, res) => {
    try { res.json(await stopLab(req.params.id)); }
    catch (err: any) { res.status(500).json({ error: err.message }); }
  });
  app.get('/api/lab/:id/status', async (req, res) => {
    try { res.json(await getLabStatus(req.params.id)); }
    catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // --- Terminaux : gérés via WebSocket (socket.io) ---
  registerTerminalHandlers(io);

  // --- Sert le frontend en production ---
  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => res.sendFile(path.resolve(distPath, 'index.html')));
  }

  // 404 JSON pour /api/*
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Endpoint inconnu' });
  });

  // Gestionnaire d'erreurs global
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err?.type === 'entity.parse.failed' || err instanceof SyntaxError) {
      return res.status(400).json({ error: 'Corps JSON invalide' });
    }
    console.error('[Guymacyb243] Unhandled error:', err);
    if (res.headersSent) return;
    res.status(500).json({ error: err?.message || 'Erreur interne' });
  });

  httpServer.listen(PORT, HOST, () => {
    console.log(`[Guymacyb243] Backend en écoute sur http://${HOST}:${PORT} (pid ${process.pid})`);
  });

  // Arrêt gracieux
  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[Guymacyb243] ${signal} reçu — arrêt gracieux...`);
    io.close();
    httpServer.close(() => {
      saveDatabaseToDisk();
      process.exit(0);
    });
    // Hard kill après 5s si nécessaire
    setTimeout(() => process.exit(1), 5000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('uncaughtException', (err) => {
    console.error('[Guymacyb243] uncaughtException:', err);
  });
  process.on('unhandledRejection', (reason) => {
    console.error('[Guymacyb243] unhandledRejection:', reason);
  });
}

startServer().catch((err) => {
  console.error('[Guymacyb243] FATAL: échec du démarrage backend:', err);
  process.exit(1);
});
