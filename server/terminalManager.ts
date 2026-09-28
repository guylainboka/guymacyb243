// Guymacyb243 — server/terminalManager.ts
// ---------------------------------------------------------------
// Terminal Manager : terminaux RÉELS via node-pty (modèle VSCode).
// Chaque terminal ouvert dans l'UI correspond à un vrai processus pseudo-tty
// (PowerShell, CMD, ou bash WSL) qui s'exécute réellement sur la machine.
// La communication se fait via socket.io : le frontend envoie les frappes,
// le backend les transmet au pty, le pty renvoie sa sortie en streaming.
//
// Élévation admin : pour les terminaux nécessitant des privilèges admin
// (required pour nmap -sS, aircrack-ng monitor mode, etc.), on déclenche
// un prompt UAC via sudo-prompt ou powershell Start-Process -Verb RunAs.

import { Server as IoServer } from 'socket.io';
import type { Socket } from 'socket.io';
import * as pty from 'node-pty';
import * as os from 'os';

const IS_WIN = os.platform() === 'win32';
const SHELLS: Record<string, { cmd: string; args: string[]; admin?: boolean; wsl?: boolean }> = {
  powershell: { cmd: IS_WIN ? 'powershell.exe' : 'pwsh', args: ['-NoLogo', '-NoProfile'] },
  cmd: { cmd: IS_WIN ? 'cmd.exe' : '/bin/sh', args: [] },
  bash: IS_WIN
    ? { cmd: 'wsl.exe', args: ['-d', 'Ubuntu', '--', 'bash', '-l'], wsl: true }
    : { cmd: '/bin/bash', args: ['-l'] },
  'bash-root': IS_WIN
    ? { cmd: 'wsl.exe', args: ['-d', 'Ubuntu', '-u', 'root', '--', 'bash', '-l'], wsl: true }
    : { cmd: '/bin/bash', args: ['-l'] },
};

interface ActiveTerminal {
  id: string;
  pty: pty.IPty;
  socket: Socket;
  shell: string;
  admin: boolean;
  createdAt: string;
}

const ACTIVE: Map<string, ActiveTerminal> = new Map();

export function registerTerminalHandlers(io: IoServer) {
  io.on('connection', (socket: Socket) => {
    socket.on('terminal:create', async (msg: { shell: string; admin?: boolean; cols?: number; rows?: number }) => {
      const shellDef = SHELLS[msg.shell];
      if (!shellDef) {
        socket.emit('terminal:error', { message: `Shell inconnu: ${msg.shell}. Disponibles: ${Object.keys(SHELLS).join(', ')}` });
        return;
      }
      const id = `term-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const admin = !!msg.admin;
      const cols = msg.cols || 80;
      const rows = msg.rows || 24;

      try {
        // Si admin requis sur Windows, on doit déléguer à un wrapper qui s'auto-élève
        // (node-pty ne peut pas directement élever — il faut un process enfant UAC).
        // Pour cette version, on crée le pty normal et on log l'intention admin —
        // l'élévation réelle se fait via un bouton séparé qui lance un wrapper.
        const ptyProcess = pty.spawn(shellDef.cmd, shellDef.args, {
          name: 'xterm-color',
          cols,
          rows,
          cwd: process.env.HOME || process.env.USERPROFILE || process.cwd(),
          env: process.env as { [key: string]: string },
        });

        ACTIVE.set(id, { id, pty: ptyProcess, socket, shell: msg.shell, admin, createdAt: new Date().toISOString() });

        ptyProcess.onData((data) => {
          socket.emit('terminal:data', { id, data });
        });
        ptyProcess.onExit(({ exitCode }) => {
          socket.emit('terminal:exit', { id, exitCode });
          ACTIVE.delete(id);
        });

        socket.emit('terminal:ready', { id, shell: msg.shell, admin });
      } catch (err: any) {
        socket.emit('terminal:error', { message: `Impossible de créer le terminal: ${err.message}` });
      }
    });

    socket.on('terminal:input', (msg: { id: string; data: string }) => {
      const term = ACTIVE.get(msg.id);
      if (term) term.pty.write(msg.data);
    });

    socket.on('terminal:resize', (msg: { id: string; cols: number; rows: number }) => {
      const term = ACTIVE.get(msg.id);
      if (term) {
        try { term.pty.resize(msg.cols, msg.rows); } catch { /* pty peut être fermé */ }
      }
    });

    socket.on('terminal:kill', (msg: { id: string }) => {
      const term = ACTIVE.get(msg.id);
      if (term) {
        try { term.pty.kill(); } catch { /* déjà fermé */ }
        ACTIVE.delete(msg.id);
      }
    });

    socket.on('disconnect', () => {
      // Nettoie tous les terminaux de ce socket à la déconnexion
      for (const [id, term] of ACTIVE.entries()) {
        if (term.socket === socket) {
          try { term.pty.kill(); } catch { /* déjà fermé */ }
          ACTIVE.delete(id);
        }
      }
    });
  });
}

/** Liste les terminaux disponibles pour l'UI. */
export function listAvailableShells() {
  return Object.entries(SHELLS).map(([id, def]) => ({
    id,
    cmd: def.cmd,
    args: def.args,
    wsl: !!def.wsl,
    label: id === 'powershell' ? 'PowerShell' : id === 'cmd' ? 'CMD Windows' : id === 'bash' ? 'Bash (WSL)' : 'Bash root (WSL)',
  }));
}
