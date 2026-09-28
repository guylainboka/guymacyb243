import React, { useState } from 'react';

interface ScanResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
}

export const WebAppsView: React.FC = () => {
  const [target, setTarget] = useState('https://example.com');
  const [tool, setTool] = useState<'nmap' | 'nikto' | 'whatweb' | 'sqlmap'>('nmap');
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const tools = [
    { id: 'nmap', label: 'Nmap (scan ports/services)', cmd: (t: string) => `nmap -sV -sC -p- ${new URL(t).hostname} 2>&1 | head -200` },
    { id: 'nikto', label: 'Nikto (vulnérabilités web)', cmd: (t: string) => `nikto -h ${t} 2>&1 | head -200` },
    { id: 'whatweb', label: 'WhatWeb (empreinte techno)', cmd: (t: string) => `whatweb ${t} 2>&1 | head -100` },
    { id: 'sqlmap', label: 'SQLmap (injections SQL)', cmd: (t: string) => `sqlmap -u ${t} --batch --level=1 2>&1 | head -200` },
  ] as const;

  const runScan = async () => {
    if (!target) { setError('Cible requise'); return; }
    try { new URL(target); } catch { setError('URL invalide (ex: https://example.com)'); return; }
    setScanning(true);
    setError(null);
    setResult(null);
    try {
      const toolDef = tools.find((t) => t.id === tool)!;
      const res = await fetch('/api/wsl/exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: toolDef.cmd(target), timeoutMs: 120000 }),
      });
      const data = await res.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <span className="material-symbols-outlined text-[#4cd7f6]">language</span>
          Sites Internet & Applications
        </h1>
        <p className="text-sm text-[#8c909f] mt-1">
          Analyse réelle de sites web et d'applications via nmap, nikto, whatweb, sqlmap (exécutés dans WSL 2).
          N'utilisez ces outils que sur des systèmes dont vous êtes propriétaire ou avec autorisation explicite.
        </p>
      </div>

      <div className="bg-[#11141f] border border-[#1f2533] rounded-lg p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
          <div className="md:col-span-2">
            <label className="text-xs text-[#8c909f] block mb-1">Cible (URL)</label>
            <input
              type="text"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="https://example.com"
              className="w-full px-3 py-2 bg-[#0a0e18] border border-[#1f2533] rounded text-sm mono text-[#dfe2f1] focus:border-[#4d8eff]/50 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs text-[#8c909f] block mb-1">Outil</label>
            <select
              value={tool}
              onChange={(e) => setTool(e.target.value as any)}
              className="w-full px-3 py-2 bg-[#0a0e18] border border-[#1f2533] rounded text-sm mono text-[#dfe2f1] focus:border-[#4d8eff]/50 focus:outline-none"
            >
              {tools.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </div>
        </div>

        <div className="bg-[#fbbf24]/10 border border-[#fbbf24]/30 rounded p-3 mb-3 text-xs text-[#fbbf24]">
          <strong>Autorisation requise.</strong> En lançant ce scan, vous confirmez que vous êtes propriétaire de la cible
          ou que vous disposez d'une autorisation explicite de test. Les scans non autorisés sont illégaux.
        </div>

        <button
          onClick={runScan}
          disabled={scanning || !target}
          className="px-4 py-2 bg-[#4d8eff]/15 border border-[#4d8eff]/40 text-[#4d8eff] rounded text-sm font-medium hover:bg-[#4d8eff]/25 disabled:opacity-50 flex items-center gap-2"
        >
          {scanning ? (
            <><span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span> Scan en cours…</>
          ) : (
            <><span className="material-symbols-outlined text-[16px]">play_arrow</span> Lancer le scan</>
          )}
        </button>
      </div>

      {error && (
        <div className="bg-[#ef4444]/10 border border-[#ef4444]/30 text-[#ef4444] rounded p-3 text-xs mono mb-4">
          {error}
        </div>
      )}

      {result && (
        <div className="bg-[#11141f] border border-[#1f2533] rounded-lg overflow-hidden">
          <div className="px-4 py-2 bg-[#0a0e18] border-b border-[#1f2533] flex items-center justify-between text-xs mono">
            <span className="text-[#8c909f]">Résultat — code {result.exitCode} — {result.durationMs}ms</span>
            <button
              onClick={() => navigator.clipboard.writeText(result.stdout)}
              className="text-[#8c909f] hover:text-[#dfe2f1] flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[14px]">content_copy</span> Copier
            </button>
          </div>
          <pre className="p-3 text-[11px] mono text-[#8c909f] max-h-[500px] overflow-y-auto whitespace-pre-wrap">
            {result.stdout || '(aucune sortie)'}
            {result.stderr && <span className="text-[#ef4444]">{'\n--- stderr ---\n'}{result.stderr}</span>}
          </pre>
        </div>
      )}
    </div>
  );
};
