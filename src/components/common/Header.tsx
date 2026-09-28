import React, { useState, useEffect } from 'react';
import { SystemDiagnostic } from '../../types';

interface HeaderProps {
  backendUp: boolean | null;
  diagnostic: SystemDiagnostic | null;
}

export const Header: React.FC<HeaderProps> = ({ backendUp, diagnostic }) => {
  const [memoryMb, setMemoryMb] = useState<number | null>(null);
  const [cpuCores, setCpuCores] = useState<number | null>(null);

  // Télémétrie RÉELLE du backend (polling 5s)
  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      try {
        const res = await fetch('/api/health');
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json();
          setMemoryMb(data.memoryMb);
        }
      } catch { /* backend injoignable — valeurs null affichées « — » */ }
    }
    refresh();
    const timer = setInterval(refresh, 5000);
    return () => { cancelled = true; clearInterval(timer); };
  }, []);

  useEffect(() => {
    if (diagnostic) setCpuCores(diagnostic.cpuCores);
  }, [diagnostic]);

  return (
    <header className="h-14 flex items-center justify-between px-4 border-b border-[#1f2533] bg-[#11141f]">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-[#4d8eff]/15 border border-[#4d8eff]/40 flex items-center justify-center">
          <span className="text-[#4d8eff] font-bold text-sm">G</span>
        </div>
        <div>
          <div className="font-semibold text-sm leading-tight">Guymacyb243</div>
          <div className="text-[10px] text-[#8c909f] mono">v1.0.0 — Cybersécurité Windows réelle</div>
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs mono">
        {/* État backend réel */}
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${backendUp ? 'bg-[#10b981]' : 'bg-[#ef4444]'}`} />
          <span className="text-[#8c909f]">Backend</span>
          <span className={backendUp ? 'text-[#10b981]' : 'text-[#ef4444]'}>{backendUp === null ? '…' : backendUp ? 'OK' : 'H.S.'}</span>
        </div>
        {/* Mémoire réelle */}
        <div className="flex items-center gap-1.5">
          <span className="text-[#8c909f]">RAM</span>
          <span className="text-[#dfe2f1]">{memoryMb !== null ? `${memoryMb}MB` : '—'}</span>
        </div>
        {/* Cœurs CPU réels */}
        <div className="flex items-center gap-1.5">
          <span className="text-[#8c909f]">CPU</span>
          <span className="text-[#dfe2f1]">{cpuCores !== null ? `${cpuCores}c` : '—'}</span>
        </div>
        {/* État système réel */}
        {diagnostic && (
          <div className="flex items-center gap-1.5">
            <span className="text-[#8c909f]">Système</span>
            <span className={diagnostic.readyForUse ? 'text-[#10b981]' : 'text-[#fbbf24]'}>
              {diagnostic.readyForUse ? 'Prêt' : `${diagnostic.missingCritical.length} manquant(s)`}
            </span>
          </div>
        )}
      </div>
    </header>
  );
};
