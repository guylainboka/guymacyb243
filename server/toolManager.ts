// Guymacyb243 — server/toolManager.ts
// ---------------------------------------------------------------
// Tool Manager : diagnostic RÉEL de l'environnement + gestion par niveaux.
// Détecte : runtimes (Node/Python/Rust/Go), WSL 2, Docker, outils réseau
// (nmap/dig/traceroute), outils sécurité (nikto/sqlmap/hashcat/aircrack-ng).
// Aucune simulation : chaque détection exécute une vraie commande.

import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';
import { checkWslAvailability, detectInstalledTools, execInWsl } from './wslBridge';
import si from 'systeminformation';

const IS_WIN = process.platform === 'win32';

export type ToolLevel = 'core' | 'wifi' | 'web' | 'laboratory' | 'optional';
export type ToolState = 'installed' | 'missing' | 'version-incorrect' | 'incompatible' | 'admin-required';

export interface ToolDef {
  id: string;
  name: string;
  level: ToolLevel;
  category: string;
  detectCmd?: string;        // commande pour détecter (ex: 'nmap --version')
  detectViaWsl?: boolean;   // true = exécuter dans WSL, false = sur l'hôte
  requiredVersion?: string;
  description: string;      // pourquoi ce composant est nécessaire
  whatItModifies?: string;  // ce que l'install va modifier sur la machine
  aptPackages?: string[];   // paquets apt correspondants
  requiresAdmin?: boolean;
}

export interface ToolStatus {
  def: ToolDef;
  state: ToolState;
  version?: string;
  detail?: string;
}

export interface SystemDiagnostic {
  platform: string;
  isWindows: boolean;
  arch: string;
  hostname: string;
  cpuCores: number;
  totalMemoryGb: number;
  wsl: Awaited<ReturnType<typeof checkWslAvailability>>;
  docker: { ready: boolean; version?: string; reason?: string };
  tools: ToolStatus[];
  adminRequired: boolean;
  readyForUse: boolean;
  missingCritical: string[];
}

// Registre des outils par niveau (5 niveaux selon spec utilisateur)
export const TOOL_REGISTRY: ToolDef[] = [
  // --- CORE : indispensables au fonctionnement général ---
  {
    id: 'node', name: 'Node.js', level: 'core', category: 'runtime',
    detectCmd: 'node --version',
    description: "Runtime JavaScript du backend Guymacyb243",
    requiredVersion: '18.0.0',
  },
  {
    id: 'wsl2', name: 'WSL 2', level: 'core', category: 'subsystem',
    description: "Sous-système Linux requis pour exécuter les outils Kali (nmap, nikto, aircrack-ng…)",
    whatItModifies: "Active la fonctionnalité Windows « VirtualMachinePlatform » et installe un noyau Linux léger",
    requiresAdmin: true,
  },
  {
    id: 'docker', name: 'Docker Desktop', level: 'core', category: 'container',
    detectCmd: 'docker --version',
    description: "Moteur de conteneurs requis pour le Laboratoire (DVWA, Juice Shop, Metasploitable)",
    whatItModifies: "Installe Docker Desktop (nécessite WSL 2 + redémarrage)",
    requiresAdmin: true,
  },

  // --- WEB : analyse sites et applications ---
  {
    id: 'nmap', name: 'Nmap', level: 'web', category: 'scanner',
    detectViaWsl: true, detectCmd: 'nmap --version',
    description: "Scanner réseau et ports (détection de services, OS, vulnérabilités NSE)",
    aptPackages: ['nmap'],
  },
  {
    id: 'nikto', name: 'Nikto', level: 'web', category: 'web-scanner',
    detectViaWsl: true, detectCmd: 'nikto -Version',
    description: "Scanner de vulnérabilités web (en-têtes, CGI, configurations)",
    aptPackages: ['nikto'],
  },
  {
    id: 'sqlmap', name: 'SQLmap', level: 'web', category: 'injection',
    detectViaWsl: true, detectCmd: 'sqlmap --version',
    description: "Détection et exploitation automatique d'injections SQL",
    aptPackages: ['sqlmap'],
  },
  {
    id: 'whatweb', name: 'WhatWeb', level: 'web', category: 'fingerprint',
    detectViaWsl: true, detectCmd: 'whatweb --version',
    description: "Empreinte technologique des sites web (CMS, frameworks, JS libs)",
    aptPackages: ['whatweb'],
  },
  {
    id: 'gobuster', name: 'Gobuster', level: 'web', category: 'discovery',
    detectViaWsl: true, detectCmd: 'gobuster --version',
    description: "Découverte de chemins et sous-domaines par force brute",
    aptPackages: ['gobuster'],
  },

  // --- WIFI : fonctionnalités réseau sans fil ---
  {
    id: 'aircrack-ng', name: 'Aircrack-ng', level: 'wifi', category: 'wifi',
    detectViaWsl: true, detectCmd: 'aircrack-ng --version',
    description: "Suite complète d'outils WiFi (scan, capture handshake, crack WPA/WEP)",
    aptPackages: ['aircrack-ng'],
  },
  {
    id: 'iw', name: 'iw', level: 'wifi', category: 'wifi',
    detectViaWsl: true, detectCmd: 'iw --version',
    description: "Configuration des interfaces sans fil (nl80211)",
    aptPackages: ['iw', 'wireless-tools'],
  },
  {
    id: 'reaver', name: 'Reaver', level: 'wifi', category: 'wifi',
    detectViaWsl: true, detectCmd: 'reaver --version',
    description: "Attaque WPS (PIN brute force)",
    aptPackages: ['reaver'],
  },

  // --- LABORATORY : environnements de test isolés ---
  {
    id: 'dvwa', name: 'DVWA (image)', level: 'laboratory', category: 'lab-image',
    description: "Damn Vulnerable Web Application — cible PHP/MySQL pour tests web",
  },
  {
    id: 'juice-shop', name: 'OWASP Juice Shop (image)', level: 'laboratory', category: 'lab-image',
    description: "Application moderne vulnérable (Node.js/Angular) — OWASP Top 10",
  },

  // --- OPTIONAL ---
  {
    id: 'hashcat', name: 'Hashcat', level: 'optional', category: 'cracker',
    detectViaWsl: true, detectCmd: 'hashcat --version',
    description: "Crack de hashes par GPU/CPU (supporte 300+ types de hashes)",
    aptPackages: ['hashcat'],
  },
  {
    id: 'metasploit', name: 'Metasploit Framework', level: 'optional', category: 'exploitation',
    detectViaWsl: true, detectCmd: 'msfconsole --version',
    description: "Framework d'exploitation (payloads, exploits, post-exploitation)",
    aptPackages: ['metasploit-framework'],
  },
  {
    id: 'searchsploit', name: 'Searchsploit', level: 'optional', category: 'db',
    detectViaWsl: true, detectCmd: 'searchsploit --version',
    description: "Base de données ExploitDB (recherche d'exploits publics)",
    aptPackages: ['exploitdb'],
  },
];

/** Détecte si une commande existe sur l'hôte (Windows/Linux). */
function detectHostCmd(cmd: string): { ok: boolean; version?: string; err?: string } {
  try {
    const parts = cmd.split(' ');
    const bin = parts[0];
    const args = parts.slice(1);
    const out = execFileSync(bin, args, { encoding: 'utf8', timeout: 5000, stdio: ['ignore', 'pipe', 'ignore'] });
    // Extraire une version approximative (x.y.z)
    const m = out.match(/(\d+\.\d+(?:\.\d+)?)/);
    return { ok: true, version: m?.[1] };
  } catch (err: any) {
    return { ok: false, err: err.message };
  }
}

/** Diagnostic complet du système (réel — exécute des vraies commandes). */
export async function getSystemDiagnostic(): Promise<SystemDiagnostic> {
  const cpu = await si.cpu();
  const mem = await si.mem();
  const osInfo = await si.osInfo();

  const wsl = await checkWslAvailability();

  // Docker
  let docker: { ready: boolean; version?: string; reason?: string } = { ready: false };
  try {
    const d = detectHostCmd('docker --version');
    if (d.ok) {
      docker = { ready: true, version: d.version };
    } else {
      docker = { ready: false, reason: 'Docker non installé — requis pour le Laboratoire' };
    }
  } catch (err: any) {
    docker = { ready: false, reason: err.message };
  }

  // Détection des outils du registre
  const toolStatuses: ToolStatus[] = [];
  for (const def of TOOL_REGISTRY) {
    if (def.id === 'wsl2') {
      toolStatuses.push({
        def,
        state: wsl.ready ? 'installed' : 'missing',
        detail: wsl.ready ? `Distro: ${wsl.defaultDistro}` : wsl.reason,
      });
      continue;
    }
    if (def.id === 'dvwa' || def.id === 'juice-shop') {
      // Les images Docker sont vérifiées au démarrage du lab (pull automatique)
      toolStatuses.push({
        def,
        state: docker.ready ? 'installed' : 'missing',
        detail: docker.ready ? 'Téléchargée au premier lancement du lab' : 'Docker requis',
      });
      continue;
    }
    if (!def.detectCmd) {
      toolStatuses.push({ def, state: 'missing', detail: 'Pas de commande de détection' });
      continue;
    }
    try {
      if (def.detectViaWsl) {
        if (!wsl.ready) {
          toolStatuses.push({ def, state: 'missing', detail: 'WSL non disponible — outil Linux inaccessible' });
          continue;
        }
        const res = await execInWsl(`${def.detectCmd} 2>&1`, 10000);
        const ok = res.exitCode === 0;
        const m = res.stdout.match(/(\d+\.\d+(?:\.\d+)?)/);
        toolStatuses.push({
          def,
          state: ok ? 'installed' : 'missing',
          version: m?.[1],
          detail: ok ? undefined : 'Non installé dans WSL',
        });
      } else {
        const r = detectHostCmd(def.detectCmd);
        toolStatuses.push({
          def,
          state: r.ok ? 'installed' : 'missing',
          version: r.version,
          detail: r.ok ? undefined : 'Non trouvé sur le système hôte',
        });
      }
    } catch (err: any) {
      toolStatuses.push({ def, state: 'incompatible', detail: err.message });
    }
  }

  const missingCritical = toolStatuses
    .filter((t) => t.def.level === 'core' && t.state !== 'installed')
    .map((t) => t.def.name);

  const readyForUse = missingCritical.length === 0;

  return {
    platform: osInfo.platform,
    isWindows: IS_WIN,
    arch: osInfo.arch,
    hostname: osInfo.hostname,
    cpuCores: cpu.cores,
    totalMemoryGb: Math.round(mem.total / 1024 / 1024 / 1024 * 10) / 10,
    wsl,
    docker,
    tools: toolStatuses,
    adminRequired: toolStatuses.some((t) => t.def.requiresAdmin && t.state !== 'installed'),
    readyForUse,
    missingCritical,
  };
}
