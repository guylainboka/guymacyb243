import React, { useState, useEffect } from 'react';

interface WifiScanResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
}

export const WifiView: React.FC = () => {
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<WifiScanResult | null>(null);
  const [interfaceName, setInterfaceName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const runScan = async () => {
    setScanning(true);
    setError(null);
    try {
      const cmd = interfaceName
        ? `iw dev ${interfaceName} scan ap-force 2>&1 | head -100`
        : `iwlist scan 2>&1 | head -100 || echo "--- Aucune interface WiFi détectée ---"`;
      const res = await fetch('/api/wsl/exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmd, timeoutMs: 30000 }),
      });
      const data = await res.json();
      setResult(data);
      if (data.exitCode !== 0 && data.stderr) {
        setError(data.stderr);
      }
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
          <span className="material-symbols-outlined text-[#4cd7f6]">wifi</span>
          Wi-Fi
        </h1>
        <p className="text-sm text-[#8c909f] mt-1">
          Scan WiFi réel via <code className="text-[#4cd7f6]">iw</code> et <code className="text-[#4cd7f6]">iwlist</code> dans WSL 2.
          Pour le mode monitor et la capture de handshakes WPA, une carte WiFi USB compatible (AR9271/88XXAU) doit être attachée à WSL via usbipd-win.
        </p>
      </div>

      <div className="bg-[#11141f] border border-[#1f2533] rounded-lg p-4 mb-4">
        <h2 className="text-sm font-semibold mb-3">Scan de réseaux WiFi</h2>
        <div className="flex items-center gap-3 mb-3">
          <input
            type="text"
            value={interfaceName}
            onChange={(e) => setInterfaceName(e.target.value)}
            placeholder="Interface (ex: wlan0) — laisser vide pour auto"
            className="flex-1 px-3 py-2 bg-[#0a0e18] border border-[#1f2533] rounded text-sm mono text-[#dfe2f1] focus:border-[#4d8eff]/50 focus:outline-none"
          />
          <button
            onClick={runScan}
            disabled={scanning}
            className="px-4 py-2 bg-[#4d8eff]/15 border border-[#4d8eff]/40 text-[#4d8eff] rounded text-sm font-medium hover:bg-[#4d8eff]/25 disabled:opacity-50 flex items-center gap-2"
          >
            {scanning ? (
              <><span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span> Scan…</>
            ) : (
              <><span className="material-symbols-outlined text-[16px]">wifi_find</span> Scanner</>
            )}
          </button>
        </div>
        {error && (
          <div className="bg-[#ef4444]/10 border border-[#ef4444]/30 text-[#ef4444] rounded p-3 text-xs mono mb-3">
            {error}
          </div>
        )}
        {result && (
          <pre className="bg-[#060912] border border-[#1f2533] rounded p-3 text-[11px] mono text-[#8c909f] max-h-96 overflow-y-auto whitespace-pre-wrap">
            {result.stdout || '(aucune sortie)'}
            {result.stderr && <span className="text-[#ef4444]">{'\n--- stderr ---\n'}{result.stderr}</span>}
          </pre>
        )}
      </div>

      <div className="bg-[#11141f] border border-[#1f2533] rounded-lg p-4">
        <h2 className="text-sm font-semibold mb-2">Outils WiFi disponibles</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs mono">
          {['iw', 'iwlist', 'aircrack-ng', 'airodump-ng', 'aireplay-ng', 'reaver', 'macchanger'].map((tool) => (
            <div key={tool} className="px-2 py-1.5 rounded border border-[#1f2533] bg-[#0a0e18] flex items-center gap-2">
              <span className="material-symbols-outlined text-[14px] text-[#8c909f]">build</span>
              <span>{tool}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 text-[10px] text-[#8c909f]">
          Exécutez ces outils directement depuis l'onglet « Terminaux » du Core Manager (bash WSL).
          Pour le mode monitor, attachez une clé USB WiFi via <code className="text-[#4cd7f6]">usbipd-win</code>.
        </div>
      </div>
    </div>
  );
};
