import React from 'react';
import { ModuleView } from '../../types';

interface SidebarProps {
  currentView: ModuleView;
  onChange: (v: ModuleView) => void;
}

interface NavItem {
  id: ModuleView;
  label: string;
  icon: string;
  description: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'wifi', label: 'Wi-Fi', icon: 'wifi', description: 'Scan WiFi, monitor mode, handshakes, WPA audit (aircrack-ng via WSL)' },
  { id: 'web-apps', label: 'Sites & Apps', icon: 'language', description: 'Analyse web, scan réseau, vulnérabilités (nmap, nikto, sqlmap via WSL)' },
  { id: 'laboratory', label: 'Laboratoire', icon: 'science', description: 'Environnements de test isolés (Docker — DVWA, Juice Shop, Metasploitable)' },
  { id: 'core-manager', label: 'Core Manager', icon: 'settings', description: 'Diagnostic système, gestion des outils, terminaux intégrés, paramètres' },
];

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onChange }) => {
  return (
    <aside className="w-64 border-r border-[#1f2533] bg-[#11141f] flex flex-col">
      <nav className="flex-1 py-3">
        {NAV_ITEMS.map((item) => {
          const active = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onChange(item.id)}
              className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors border-l-2 ${
                active
                  ? 'bg-[#4d8eff]/10 border-[#4d8eff] text-[#dfe2f1]'
                  : 'border-transparent text-[#8c909f] hover:bg-[#171b26] hover:text-[#dfe2f1]'
              }`}
            >
              <span className="material-symbols-outlined text-[20px] mt-0.5">{item.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{item.label}</div>
                <div className="text-[10px] text-[#8c909f] mt-0.5 leading-tight">{item.description}</div>
              </div>
            </button>
          );
        })}
      </nav>
      <div className="p-3 border-t border-[#1f2533] text-[10px] text-[#8c909f] mono leading-relaxed">
        <div>Usage autorisé uniquement</div>
        <div className="mt-1 opacity-70">Tests sur systèmes dont vous êtes propriétaire ou avec autorisation explicite.</div>
      </div>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0" />
    </aside>
  );
};
