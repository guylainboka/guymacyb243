import React, { useState, useEffect } from 'react';
import { ModuleView, SystemDiagnostic } from './types';
import { Sidebar } from './components/common/Sidebar';
import { Header } from './components/common/Header';
import { WifiView } from './views/WifiView';
import { WebAppsView } from './views/WebAppsView';
import { LaboratoryView } from './views/LaboratoryView';
import { CoreManagerView } from './views/CoreManagerView';

export function App() {
  const [currentView, setCurrentView] = useState<ModuleView>('core-manager');
  const [diagnostic, setDiagnostic] = useState<SystemDiagnostic | null>(null);
  const [backendUp, setBackendUp] = useState<boolean | null>(null);

  useEffect(() => {
    // Vérifie l'état du backend au démarrage
    fetch('/api/health')
      .then((r) => { if (r.ok) setBackendUp(true); else setBackendUp(false); })
      .catch(() => setBackendUp(false));
    // Charge le diagnostic système
    fetch('/api/system/diagnostic')
      .then((r) => r.json())
      .then((d) => setDiagnostic(d))
      .catch(() => setDiagnostic(null));
  }, []);

  return (
    <div className="h-screen flex flex-col">
      <Header backendUp={backendUp} diagnostic={diagnostic} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar currentView={currentView} onChange={setCurrentView} />
        <main className="flex-1 overflow-y-auto bg-[#0a0e18]">
          {currentView === 'wifi' && <WifiView />}
          {currentView === 'web-apps' && <WebAppsView />}
          {currentView === 'laboratory' && <LaboratoryView />}
          {currentView === 'core-manager' && <CoreManagerView diagnostic={diagnostic} onRefresh={() => {
            fetch('/api/system/diagnostic')
              .then((r) => r.json())
              .then((d) => setDiagnostic(d))
              .catch(() => {});
          }} />}
        </main>
      </div>
    </div>
  );
}
