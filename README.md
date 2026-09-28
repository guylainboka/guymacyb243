# Guymacyb243

Application Windows desktop de cybersécurité réelle — Wi-Fi, Sites & Apps, Laboratoire Docker, terminaux natifs.

## Architecture

```
Desktop UI (React + TypeScript + Tailwind)
    ↓
Application Backend (Express — server.ts bundlé en server.cjs)
    ↓
WSL 2 Bridge (exécute de vrais outils Linux : nmap, nikto, sqlmap, aircrack-ng)
    ↓
Tool Manager (diagnostic réel + installation guidée par niveaux)
    ↓
Laboratory Manager (Docker — DVWA, Juice Shop, Metasploitable sur réseaux isolés)
    ↓
Terminal Manager (node-pty — vrais terminaux PowerShell/CMD/bash WSL)
    ↓
System (WSL 2 + Docker + Windows APIs via child_process)
```

## 4 parties

1. **Wi-Fi** — scan WiFi réel (iw/iwlist/aircrack-ng via WSL), monitor mode, handshakes WPA
2. **Sites & Apps** — analyse web réelle (nmap/nikto/whatweb/sqlmap via WSL)
3. **Laboratoire** — environnements Docker isolés (DVWA, Juice Shop, Metasploitable)
4. **Core Manager** — diagnostic système, gestion outils, terminaux natifs, paramètres

## Développement

```bash
bun install
bun run dev    # lance Vite (5173) + Electron + backend Express (3001)
```

## Build production

```bash
bun run build:desktop    # vite build + bundle backend + electron-builder NSIS
# Produit dist_electron/Guymacyb243-Setup-v1.0.0.exe
```

## Principes

- **Zéro simulation** : aucune donnée inventée. Si une fonctionnalité n'est pas disponible, l'app affiche un état honnête.
- **Vrais outils** : nmap, nikto, sqlmap, aircrack-ng exécutés réellement via WSL 2.
- **Vrais terminaux** : node-pty (modèle VSCode) — les commandes s'exécutent réellement.
- **Laboratoire isolé** : chaque lab Docker tourne sur son propre réseau `internal: true`.
- **Autorisation explicite** : les actions sensibles nécessitent confirmation, parfois renforcée (taper "JE CONFIRME...").

## Licence

UNLICENSED — usage interne.
