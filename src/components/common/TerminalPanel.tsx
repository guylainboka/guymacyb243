import React, { useState, useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { io, Socket } from 'socket.io-client';

export const TerminalPanel: React.FC = () => {
  const [shell, setShell] = useState<'powershell' | 'cmd' | 'bash' | 'bash-root'>('powershell');
  const [admin, setAdmin] = useState(false);
  const [activeTerm, setActiveTerm] = useState<{ id: string; shell: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const fitRef = useRef<FitAddon | null>(null);

  const shells = [
    { id: 'powershell', label: 'PowerShell', icon: 'terminal' },
    { id: 'cmd', label: 'CMD Windows', icon: 'terminal' },
    { id: 'bash', label: 'Bash (WSL)', icon: 'terminal' },
    { id: 'bash-root', label: 'Bash root (WSL)', icon: 'admin_panel_settings' },
  ] as const;

  // Initialise le socket une seule fois
  useEffect(() => {
    const sock = io({ transports: ['websocket'] });
    socketRef.current = sock;
    sock.on('terminal:error', (msg: { message: string }) => {
      setError(msg.message);
    });
    sock.on('terminal:ready', (msg: { id: string; shell: string; admin: boolean }) => {
      setActiveTerm({ id: msg.id, shell: msg.shell });
      setError(null);
    });
    sock.on('terminal:exit', (msg: { id: string; exitCode: number }) => {
      if (termRef.current) {
        termRef.current.writeln(`\r\n[Process terminé — code ${msg.exitCode}]`);
      }
    });
    return () => { sock.disconnect(); };
  }, []);

  const createTerminal = (selectedShell: typeof shell, useAdmin: boolean) => {
    if (!socketRef.current) return;
    if (termRef.current) {
      termRef.current.dispose();
      termRef.current = null;
    }
    setError(null);

    // Crée le terminal xterm
    const term = new Terminal({
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: 13,
      theme: {
        background: '#060912',
        foreground: '#dfe2f1',
        cursor: '#4d8eff',
        selectionBackground: '#1f2533',
      },
      cursorBlink: true,
      convertEol: true,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    termRef.current = term;
    fitRef.current = fit;

    if (containerRef.current) {
      term.open(containerRef.current);
      fit.fit();
      term.focus();
      term.writeln(`Guymacyb243 — Terminal ${selectedShell}${useAdmin ? ' (admin)' : ''}`);
      term.writeln('Terminal RÉEL — exécute réellement les commandes sur votre machine.');
      term.writeln('');
    }

    // Envoie les frappes au backend
    term.onData((data) => {
      socketRef.current?.emit('terminal:input', { id: activeTerm?.id, data });
    });
    term.onResize(({ cols, rows }) => {
      socketRef.current?.emit('terminal:resize', { id: activeTerm?.id, cols, rows });
    });

    // Reçoit la sortie réelle du pty
    socketRef.current?.on('terminal:data', (msg: { id: string; data: string }) => {
      if (termRef.current) termRef.current.write(msg.data);
    });

    // Demande la création du pty côté backend
    socketRef.current.emit('terminal:create', {
      shell: selectedShell,
      admin: useAdmin,
      cols: term.cols,
      rows: term.rows,
    });
  };

  // Resize observer
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(() => {
      if (fitRef.current && termRef.current) {
        try { fitRef.current.fit(); } catch { /* ignore */ }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-[#11141f] border border-[#1f2533] rounded-lg p-4">
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <span className="material-symbols-outlined text-[#4cd7f6]">terminal</span>
          Terminaux intégrés — exécution réelle
        </h2>
        <p className="text-xs text-[#8c909f] mb-3">
          Ces terminaux sont de VRAIS processus (via node-pty). Les commandes s'exécutent réellement sur votre
          machine Windows. Bash/Bash-root utilisent WSL 2. Le mode admin déclenche un prompt UAC pour les
          opérations nécessitant des privilèges élevés.
        </p>

        <div className="flex flex-wrap items-center gap-2">
          {shells.map((s) => (
            <button
              key={s.id}
              onClick={() => { setShell(s.id); createTerminal(s.id, admin); }}
              className={`px-3 py-1.5 text-xs rounded border flex items-center gap-1.5 transition-colors ${
                shell === s.id
                  ? 'bg-[#4d8eff]/15 border-[#4d8eff]/40 text-[#4d8eff]'
                  : 'bg-[#171b26] border-[#1f2533] text-[#c2c6d6] hover:border-[#4d8eff]/50'
              }`}
            >
              <span className="material-symbols-outlined text-[14px]">{s.icon}</span>
              {s.label}
            </button>
          ))}
          <label className={`px-3 py-1.5 text-xs rounded border flex items-center gap-1.5 cursor-pointer ${
            admin ? 'bg-[#fbbf24]/15 border-[#fbbf24]/40 text-[#fbbf24]' : 'bg-[#171b26] border-[#1f2533] text-[#8c909f]'
          }`}>
            <input type="checkbox" checked={admin} onChange={(e) => setAdmin(e.target.checked)} className="sr-only" />
            <span className="material-symbols-outlined text-[14px]">admin_panel_settings</span>
            Mode administrateur (UAC)
          </label>
        </div>
      </div>

      {error && (
        <div className="bg-[#ef4444]/10 border border-[#ef4444]/30 text-[#ef4444] rounded-lg p-3 text-xs mono">
          {error}
        </div>
      )}

      <div className="bg-[#11141f] border border-[#1f2533] rounded-lg overflow-hidden">
        <div ref={containerRef} className="h-[500px] bg-[#060912]" />
      </div>

      <div className="text-[10px] text-[#8c909f] mono">
        Astuce : utilisez <span className="text-[#4cd7f6]">bash</span> pour exécuter les outils Kali (nmap, nikto, sqlmap…) — ils ne sont pas disponibles sous PowerShell/CMD.
      </div>
    </div>
  );
};
