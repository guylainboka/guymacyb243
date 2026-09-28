import React, { useState, useEffect } from 'react';
import { SystemDiagnostic, ToolStatus } from '../types';
import { TerminalPanel } from '../components/common/TerminalPanel';

interface CoreManagerViewProps {
  diagnostic: SystemDiagnostic | null;
  onRefresh: () => void;
}

export const CoreManagerView: React.FC<CoreManagerViewProps> = ({ diagnostic, onRefresh }) => {
  const [tab, setTab] = useState<'environment' | 'terminals' | 'settings'>('environment');
  const [installing, setInstalling] = useState(false);
  const [installLog, setInstallLog] = useState<string[]>([]);

  const tabs = [
    { id: 'environment', label: 'Environnement', icon: 'shield' },
    { id: 'terminals', label: 'Terminaux', icon: 'terminal' },
    { id: 'settings', label: 'Paramètres', icon: 'settings' },
  ] as const;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <span className="material-symbols-outlined text-[#4d8eff]">tune</span>
          Core Manager
        </h1>
        <p className="text-sm text-[#8c909f] mt-1">
          Diagnostic système réel, gestion des outils, terminaux natifs et paramètres de l'application.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-[#1f2533]">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              tab === t.id ? 'border-[#4d8eff] text-[#dfe2f1]' : 'border-transparent text-[#8c909f] hover:text-[#dfe2f1]'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'environment' && (
        <EnvironmentTab diagnostic={diagnostic} onRefresh={onRefresh} installing={installing} setInstalling={setInstalling} installLog={installLog} setInstallLog={setInstallLog} />
      )}
      {tab === 'terminals' && <TerminalPanel />}
      {tab === 'settings' && <SettingsTab />}
    </div>
  );
};

const EnvironmentTab: React.FC<{
  diagnostic: SystemDiagnostic | null;
  onRefresh: () => void;
  installing: boolean;
  setInstalling: (b: boolean) => void;
  installLog: string[];
  setInstallLog: React.Dispatch<React.SetStateAction<string[]>>;
}> = ({ diagnostic, onRefresh, installing, setInstalling, installLog, setInstallLog }) => {
  if (!diagnostic) {
    return <div className="text-[#8c909f] text-sm">Chargement du diagnostic système…</div>;
  }

  const levels = ['core', 'wifi', 'web', 'laboratory', 'optional'] as const;
  const levelLabels: Record<string, string> = {
    core: 'Core (indispensable)',
    wifi: 'Wi-Fi',
    web: 'Sites & Apps',
    laboratory: 'Laboratoire',
    optional: 'Optionnel',
  };

  const installMissing = async () => {
    setInstalling(true);
    setInstallLog([]);
    const missing = diagnostic.tools.filter((t) => t.state === 'missing' && t.def.aptPackages);
    for (const t of missing) {
      setInstallLog((l) => [...l, `→ Installation ${t.def.name} (apt: ${t.def.aptPackages!.join(' ')})…`]);
      try {
        const res = await fetch('/api/wsl/exec', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ command: `apt-get update -qq && apt-get install -y ${t.def.aptPackages!.join(' ')}`, timeoutMs: 300000 }),
        });
        const data = await res.json();
        if (data.exitCode === 0) {
          setInstallLog((l) => [...l, `  ✓ ${t.def.name} installé`]);
        } else {
          setInstallLog((l) => [...l, `  ✗ Échec ${t.def.name} (code ${data.exitCode}): ${data.stderr?.slice(0, 200)}`]);
        }
      } catch (err: any) {
        setInstallLog((l) => [...l, `  ✗ Erreur: ${err.message}`]);
      }
    }
    setInstallLog((l) => [...l, '— Vérification post-installation… —']);
    onRefresh();
    setInstalling(false);
  };

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="bg-[#11141f] border border-[#1f2533] rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#4cd7f6]">memory</span>
            <h2 className="text-sm font-semibold">Diagnostic système réel</h2>
          </div>
          <button
            onClick={onRefresh}
            className="px-3 py-1.5 text-xs rounded bg-[#171b26] border border-[#1f2533] hover:border-[#4d8eff]/50 text-[#c2c6d6] flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[14px]">refresh</span>
            Revérifier
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs mono">
          <div><span className="text-[#8c909f]">OS:</span> <span className="text-[#dfe2f1]">{diagnostic.platform} {diagnostic.arch}</span></div>
          <div><span className="text-[#8c909f]">Hôte:</span> <span className="text-[#dfe2f1]">{diagnostic.hostname}</span></div>
          <div><span className="text-[#8c909f]">CPU:</span> <span className="text-[#dfe2f1]">{diagnostic.cpuCores} cœurs</span></div>
          <div><span className="text-[#8c909f]">RAM:</span> <span className="text-[#dfe2f1]">{diagnostic.totalMemoryGb} Go</span></div>
          <div>
            <span className="text-[#8c909f]">WSL 2:</span>{' '}
            <span className={diagnostic.wsl.ready ? 'text-[#10b981]' : 'text-[#ef4444]'}>
              {diagnostic.wsl.ready ? `✓ ${diagnostic.wsl.defaultDistro}` : '✗ manquant'}
            </span>
          </div>
          <div>
            <span className="text-[#8c909f]">Docker:</span>{' '}
            <span className={diagnostic.docker.ready ? 'text-[#10b981]' : 'text-[#ef4444]'}>
              {diagnostic.docker.ready ? `✓ ${diagnostic.docker.version || ''}` : '✗ manquant'}
            </span>
          </div>
          <div className="col-span-2">
            <span className="text-[#8c909f]">Prêt:</span>{' '}
            <span className={diagnostic.readyForUse ? 'text-[#10b981] font-bold' : 'text-[#fbbf24] font-bold'}>
              {diagnostic.readyForUse ? '✓ Application pleinement opérationnelle' : `⚠ ${diagnostic.missingCritical.length} composant(s) critique(s) manquant(s)`}
            </span>
          </div>
        </div>
      </div>

      {/* Outils par niveau */}
      {levels.map((level) => {
        const tools = diagnostic.tools.filter((t) => t.def.level === level);
        if (tools.length === 0) return null;
        const installed = tools.filter((t) => t.state === 'installed').length;
        const missing = tools.filter((t) => t.state === 'missing').length;
        return (
          <div key={level} className="bg-[#11141f] border border-[#1f2533] rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">{levelLabels[level]}</h3>
              <div className="text-xs mono text-[#8c909f]">
                <span className="text-[#10b981]">{installed}</span> / {tools.length} installés
                {missing > 0 && <span className="text-[#fbbf24] ml-2">({missing} manquants)</span>}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {tools.map((t) => <ToolRow key={t.def.id} tool={t} />)}
            </div>
          </div>
        );
      })}

      {/* Bouton installation */}
      {diagnostic.missingCritical.length > 0 || diagnostic.tools.some((t) => t.state === 'missing' && t.def.aptPackages) ? (
        <div className="bg-[#11141f] border border-[#1f2533] rounded-lg p-4">
          <h3 className="text-sm font-semibold mb-2">Installation des composants manquants</h3>
          <p className="text-xs text-[#8c909f] mb-3">
            L'installation utilise <code className="text-[#4cd7f6]">apt-get install</code> dans WSL 2 (Ubuntu).
            Pour WSL et Docker (niveau Core), une élévation administrateur Windows (UAC) est nécessaire —
            déclenchée via le wizard au premier lancement ou depuis le bouton Assistant.
          </p>
          <button
            onClick={installMissing}
            disabled={installing}
            className="px-4 py-2 bg-[#4d8eff]/15 border border-[#4d8eff]/40 text-[#4d8eff] rounded text-sm font-medium hover:bg-[#4d8eff]/25 disabled:opacity-50 flex items-center gap-2"
          >
            {installing ? (
              <><span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span> Installation…</>
            ) : (
              <><span className="material-symbols-outlined text-[16px]">download</span> Installer les outils Linux manquants</>
            )}
          </button>
          {installLog.length > 0 && (
            <pre className="mt-3 p-3 bg-[#060912] border border-[#1f2533] rounded text-[11px] mono text-[#8c909f] max-h-48 overflow-y-auto">{installLog.join('\n')}</pre>
          )}
        </div>
      ) : null}
    </div>
  );
};

const ToolRow: React.FC<{ tool: ToolStatus }> = ({ tool }) => {
  const stateConfig: Record<string, { color: string; label: string; icon: string }> = {
    installed: { color: 'text-[#10b981]', label: 'Installé', icon: 'check_circle' },
    missing: { color: 'text-[#ef4444]', label: 'Manquant', icon: 'cancel' },
    'version-incorrect': { color: 'text-[#fbbf24]', label: 'Version incorrecte', icon: 'warning' },
    incompatible: { color: 'text-[#fbbf24]', label: 'Incompatible', icon: 'warning' },
    'admin-required': { color: 'text-[#fbbf24]', label: 'Admin requis', icon: 'lock' },
  };
  const cfg = stateConfig[tool.state] || stateConfig.missing;
  return (
    <div className="flex items-start gap-3 p-2 rounded border border-[#1f2533] bg-[#0a0e18]">
      <span className={`material-symbols-outlined text-[18px] ${cfg.color} mt-0.5`}>{cfg.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium">{tool.def.name}</span>
          {tool.version && <span className="text-[10px] mono text-[#8c909f]">v{tool.version}</span>}
        </div>
        <div className="text-[11px] text-[#8c909f] mt-0.5 leading-tight">{tool.def.description}</div>
        <div className={`text-[10px] mono mt-1 ${cfg.color}`}>{cfg.label}{tool.detail ? ` — ${tool.detail}` : ''}</div>
      </div>
    </div>
  );
};

const SettingsTab: React.FC = () => (
  <div className="bg-[#11141f] border border-[#1f2533] rounded-lg p-6">
    <h2 className="text-sm font-semibold mb-4">Paramètres de l'application</h2>
    <div className="text-xs text-[#8c909f] space-y-3">
      <div>Version: <span className="text-[#dfe2f1] mono">1.0.0</span></div>
      <div>Backend: <span className="text-[#dfe2f1] mono">http://127.0.0.1:3001</span></div>
      <div>Base de données: <span className="text-[#dfe2f1] mono">SQLite (sql.js)</span></div>
      <div className="pt-3 border-t border-[#1f2533]">
        <p>Les paramètres avancés (thème, langue, clés API, scope d'autorisation) seront ajoutés dans une version ultérieure.</p>
      </div>
    </div>
  </div>
);
