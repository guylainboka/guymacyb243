import React, { useState, useEffect } from 'react';
import { LabEnvironment } from '../types';

export const LaboratoryView: React.FC = () => {
  const [envs, setEnvs] = useState<LabEnvironment[]>([]);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<{ id: string; type: 'start' | 'stop' } | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const refresh = async () => {
    try {
      const res = await fetch('/api/lab/environments');
      const data = await res.json();
      setEnvs(data);
    } catch (err: any) {
      setMessage({ type: 'error', text: `Impossible de charger les environnements: ${err.message}` });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const startLab = async (id: string) => {
    setAction({ id, type: 'start' });
    setMessage(null);
    try {
      const res = await fetch(`/api/lab/${id}/start`, { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        setMessage({ type: 'success', text: data.message + (data.url ? ` — accessible sur ${data.url}` : '') });
      } else {
        setMessage({ type: 'error', text: data.message });
      }
      refresh();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setAction(null);
      setConfirmId(null);
      setConfirmText('');
    }
  };

  const stopLab = async (id: string, requireConfirm: boolean) => {
    if (requireConfirm) {
      setConfirmId(id);
      return;
    }
    if (confirmText !== 'JE CONFIRME L\'ARRÊT') {
      setMessage({ type: 'error', text: 'Confirmation requise : tapez « JE CONFIRME L\'ARRÊT »' });
      return;
    }
    setAction({ id, type: 'stop' });
    setMessage(null);
    try {
      const res = await fetch(`/api/lab/${id}/stop`, { method: 'POST' });
      const data = await res.json();
      setMessage({ type: data.ok ? 'success' : 'error', text: data.message });
      refresh();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setAction(null);
      setConfirmId(null);
      setConfirmText('');
    }
  };

  if (loading) return <div className="p-6 text-[#8c909f]">Chargement du laboratoire…</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <span className="material-symbols-outlined text-[#4cd7f6]">science</span>
          Laboratoire
        </h1>
        <p className="text-sm text-[#8c909f] mt-1">
          Environnements de test réels et isolés (Docker). Chaque lab tourne sur son propre réseau Docker
          (<code className="text-[#4cd7f6]">internal: true</code>) — pas d'accès à internet depuis le conteneur.
          Accès uniquement via les ports mappés sur 127.0.0.1.
        </p>
      </div>

      {message && (
        <div className={`mb-4 rounded-lg p-3 text-xs mono ${
          message.type === 'success' ? 'bg-[#10b981]/10 border border-[#10b981]/30 text-[#10b981]' :
          message.type === 'error' ? 'bg-[#ef4444]/10 border border-[#ef4444]/30 text-[#ef4444]' :
          'bg-[#4cd7f6]/10 border border-[#4cd7f6]/30 text-[#4cd7f6]'
        }`}>
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {envs.map((env) => (
          <div key={env.id} className="bg-[#11141f] border border-[#1f2533] rounded-lg p-4">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h3 className="text-sm font-semibold">{env.name}</h3>
                <div className="text-[10px] text-[#8c909f] mono mt-0.5">{env.image}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 text-[10px] rounded border ${
                  env.running ? 'bg-[#10b981]/10 border-[#10b981]/30 text-[#10b981]' : 'bg-[#171b26] border-[#1f2533] text-[#8c909f]'
                }`}>
                  {env.running ? 'ACTIF' : 'INACTIF'}
                </span>
                <span className={`px-2 py-0.5 text-[10px] rounded border ${
                  env.difficulty === 'Avancé' ? 'bg-[#ef4444]/10 border-[#ef4444]/30 text-[#ef4444]' :
                  env.difficulty === 'Intermédiaire' ? 'bg-[#fbbf24]/10 border-[#fbbf24]/30 text-[#fbbf24]' :
                  'bg-[#10b981]/10 border-[#10b981]/30 text-[#10b981]'
                }`}>{env.difficulty}</span>
              </div>
            </div>

            <p className="text-xs text-[#8c909f] mb-3 leading-relaxed">{env.description}</p>

            <div className="text-[11px] mono text-[#8c909f] mb-3 space-y-1">
              <div>Ports: {env.ports.map((p) => `${p.host}→${p.container}/${p.protocol}`).join(', ')}</div>
              {env.credentials && (
                <div>Credentials: {env.credentials.map((c) => `${c.user}/${c.password}`).join(', ')}</div>
              )}
              <div>Réseau: {env.isolatedNetwork ? 'Isolé (Docker internal)' : 'Standard'}</div>
            </div>

            {confirmId === env.id && (
              <div className="mb-3 bg-[#ef4444]/10 border border-[#ef4444]/30 rounded p-3">
                <div className="text-xs text-[#ef4444] font-bold mb-2 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[14px]">warning</span>
                  ACTION DESTRUCTIVE
                </div>
                <div className="text-[11px] text-[#8c909f] mb-2">
                  L'arrêt du lab supprimera le conteneur ET toutes les données modifiées depuis le démarrage
                  (snapshots non restaurés). Cette action est irréversible.
                </div>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="Tapez JE CONFIRME L'ARRÊT"
                  className="w-full px-2 py-1.5 bg-[#0a0e18] border border-[#1f2533] rounded text-xs mono text-[#dfe2f1] focus:border-[#ef4444]/50 focus:outline-none"
                />
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => stopLab(env.id, false)}
                    disabled={action?.id === env.id}
                    className="px-3 py-1.5 bg-[#ef4444]/15 border border-[#ef4444]/40 text-[#ef4444] rounded text-xs font-medium hover:bg-[#ef4444]/25 disabled:opacity-50"
                  >
                    Confirmer l'arrêt
                  </button>
                  <button
                    onClick={() => { setConfirmId(null); setConfirmText(''); }}
                    className="px-3 py-1.5 bg-[#171b26] border border-[#1f2533] text-[#8c909f] rounded text-xs"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              {!env.running ? (
                <button
                  onClick={() => startLab(env.id)}
                  disabled={action?.id === env.id}
                  className="px-3 py-1.5 bg-[#10b981]/15 border border-[#10b981]/40 text-[#10b981] rounded text-xs font-medium hover:bg-[#10b981]/25 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {action?.id === env.id && action?.type === 'start' ? (
                    <><span className="material-symbols-outlined animate-spin text-[14px]">progress_activity</span> Démarrage…</>
                  ) : (
                    <><span className="material-symbols-outlined text-[14px]">play_arrow</span> Démarrer</>
                  )}
                </button>
              ) : (
                <button
                  onClick={() => stopLab(env.id, true)}
                  disabled={action?.id === env.id}
                  className="px-3 py-1.5 bg-[#ef4444]/15 border border-[#ef4444]/40 text-[#ef4444] rounded text-xs font-medium hover:bg-[#ef4444]/25 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {action?.id === env.id && action?.type === 'stop' ? (
                    <><span className="material-symbols-outlined animate-spin text-[14px]">progress_activity</span> Arrêt…</>
                  ) : (
                    <><span className="material-symbols-outlined text-[14px]">stop</span> Arrêter</>
                  )}
                </button>
              )}
              {env.running && env.ports[0] && (
                <a
                  href={`http://127.0.0.1:${env.ports[0].host}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-[#4d8eff]/15 border border-[#4d8eff]/40 text-[#4d8eff] rounded text-xs font-medium hover:bg-[#4d8eff]/25 flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                  Ouvrir
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
