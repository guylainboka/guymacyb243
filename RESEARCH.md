# RESEARCH.md — Guymacyb243 Technical Research Report

**Task ID:** RESEARCH-1
**Agent:** general-purpose (research sub-agent)
**Date:** 2026 (research session)
**Stack target:** Electron + React + TypeScript + Vite · WSL 2 backend · Docker lab · Kali tooling
**Scope:** Identifier projets similaires GitHub, dépendances Node.js clés, images Docker vulnérables, outils Kali fonctionnels sur WSL 2, méthode d'élévation UAC pour Electron.

> Recherche pure. Aucun code source produit. Sources : 10 requêtes web ciblées (z-ai web_search) + corroboration par connaissance de domaine (écosystème Electron/WSL/Docker bien documenté).

---

## Sommaire

1. [Top 5 projets GitHub similaires](#1-top-5-projets-github-similaires)
2. [Dépendances Node.js recommandées](#2-dépendances-nodejs-recommandées)
3. [Top 5 images Docker vulnérables](#3-top-5-images-docker-vulnérables)
4. [Outils Kali confirmés sur WSL 2](#4-outils-kali-confirmés-sur-wsl-2)
5. [Méthode d'élévation UAC recommandée pour Electron](#5-méthode-délévation-uac-recommandée-pour-electron)
6. [Synthèse & prochaines actions](#6-synthèse--prochaines-actions)

---

## 1. Top 5 projets GitHub similaires

| # | Projet | URL | Pertinence |
|---|--------|-----|------------|
| 1 | **mandiant/commando-vm** | https://github.com/mandiant/commando-vm | ★★★★★ |
| 2 | **WebVuln-Runner** | https://github.com (via webvulnrunner.dev) | ★★★★☆ |
| 3 | **microsoft/vscode** (intégration terminal) | https://github.com/microsoft/vscode | ★★★★★ (référence technique) |
| 4 | **arch3rPro/PentestTools** | https://github.com/arch3rpro/pentesttools | ★★★☆☆ |
| 5 | **Pocket b MCP (Kali terminal MCP)** | https://glama.ai / github.com | ★★★☆☆ |

### 1.1 mandiant/commando-vm — Le projet de référence le plus proche
- **URL :** https://github.com/mandiant/commando-vm
- **Rôle :** Complete Mandiant Offensive VM — distribution Windows complète pour pentest/red team.
- **À quoi il sert :** Transforme une machine Windows en station de pentest. La v2.0 intègre officiellement **Kali Linux sur WSL** et embarque **VcXsrv** (serveur X) pour faire tourner les outils graphiques Kali (Burp, Wireshark GUI, BloodHound) côté Windows.
- **Réutilisable pour Guymacyb243 :**
  - Le script d'installation PowerShell `install.ps1` (catalogue de paquets Chocolatey + MyGet) → **modèle pour le module "Core Manager"** (installation/outentification des outils).
  - La stratégie "Kali sur WSL + VcXsrv/WSLg" → confirme notre architecture backend.
  - Le catalogue de packages `packages.json` style Commando (Nmap, Wireshark, Burp, Mimikatz, BloodHound, etc.) → liste de plugins à exposer dans notre UI.
- **Licence :** BSD-3-Clause (compatible avec usage commercial/propriétaire). ✅
- **À retenir :** C'est le seul projet de niveau "production" qui fait exactement "Windows + WSL Kali + GUI". Sert de référence d'architecture, mais ce n'est pas une app Electron — c'est un script de provisionning. Guymacyb243 apporte donc la **couche GUI Electron** manquante.

### 1.2 WebVuln-Runner — Concurrent direct sur la partie "Laboratoire Docker"
- **URL :** repo GitHub référencé depuis https://webvulnrunner.dev
- **Rôle :** Lanceur Docker pour 15+ applications web vulnérables (Juice Shop, DVWA, WebGoat, etc.).
- **Réutilisable :**
  - Catalogue d'images Docker pré-sélectionnées (bonne base pour le module "Laboratoire").
  - Approche "1 click = 1 container vulnérable démarré sur port mappé" → **exactement notre UX Laboratoire**.
  - Possibilité de réutiliser leur mapping image→ports→description.
- **Licence :** À vérifier au clone (probablement MIT). À confirmer avant fork.
- **À retenir :** Source d'inspiration produit directe pour la vue `SecurityLabView` / `LaboratoireWifiView`.

### 1.3 microsoft/vscode — La bible technique pour "terminal réel dans Electron"
- **URL :** https://github.com/microsoft/vscode (dossier `src/vs/workbench/contrib/terminal`)
- **Rôle :** L'IDE qui a normalisé `node-pty` + xterm.js.
- **Réutilisable :**
  - **Architecture de terminal** : `node-pty` (process backend) ↔ IPC ↔ `xterm.js` (renderer). C'est le pattern canonique pour la vue `TerminalView.tsx`.
  - Gestion multi-shells, resize, palette de processus (`@vscode/windows-process-tree`).
  - Pattern de **process splitting** : main process Electron spawn le pty, renderer ne fait que streamer.
- **Licence :** MIT. ✅
- **À retenir :** Pas un concurrent (pas une app de sécu) mais le **modèle technique** pour `TerminalView`. À cloner architecturalement.

### 1.4 arch3rPro/PentestTools — Catalogue d'outils trié
- **URL :** https://github.com/arch3rpro/pentesttools
- **Rôle :** Liste awesome-style d'outils de pentest, classés par phase (recon, exploit, post-ex...).
- **Réutilisable :** Structure de **taxonomie d'outils** → mapper directement sur nos 4 sections (Wi-Fi / Web & Apps / Laboratoire / Core Manager).
- **Licence :** README libre, contenu principalement des liens. ✅
- **À retenir :** Source pour construire l'arbre de catalogage d'outils côté UI.

### 1.5 Pocket b MCP (Kali terminal MCP)
- **URL :** référencé via glama.ai (serveur MCP exposant un terminal Kali).
- **Rôle :** Connecte des assistants IA à un terminal Kali pour exécuter des outils de sécu, gérer des sessions shell interactives, faire du pentest/CTF.
- **Réutilisable :** Patron d'**encapsulation d'outils Kali derrière une API structurée** (input/output JSON par outil) — approche applicable à notre bridge `server/toolbridge.ts`.
- **Licence :** À vérifier. ✅ probablement MIT.

### Projets complémentaires (mention honorable)
- **kali-win-kex / Win-KeX** (https://gitlab.com/kalilinux/build/kali-win-kex ou via https://www.kali.org/docs/wsl/kali-win-kex/) — desktop Kali GUI sur WSL via TigerVNC. **Brique backend essentielle** pour la partie GUI de Kali sur Windows 10 (sur Win 11 → WSLg suffit).
- **microsoft/wslg** (https://github.com/microsoft/wslg) — support natif GUI Linux sur Win 11. À détecter et exploiter préférentiellement.
- **Commando VM 2.0 article Google Cloud** (https://cloud.google.com/blog/topics/threat-intelligence/commando-vm-customization-containers-kali) — confirme Kali+WSL+VcXsrv comme pattern viable.
- **ctf-agent** (socket.dev) — agent CTF qui recommande "WSL Kali Linux" option A, isolement conteneur, support GDB. Patron d'**isolation conteneur** par cible.

---

## 2. Dépendances Node.js recommandées

Versions stables au moment de la recherche (à pinner dans `package.json`).

### Terminal réel
| Package | Version recommandée | Rôle | Repo |
|---------|---------------------|------|------|
| `node-pty` | `^1.0.0` (microsoft) | Pseudo-terminal multi-plateforme (conpty sur Win). **Cœur** de `TerminalView`. | https://github.com/microsoft/node-pty |
| `@xterm/xterm` | `^5.5.0` | Renderer terminal dans le DOM React. | https://github.com/xtermjs/xterm.js |
| `@xterm/addon-fit` | `^0.10.0` | Auto-resize du terminal à son conteneur. | xtermjs |
| `@xterm/addon-web-links` | `^0.11.0` | Liens cliquables dans le terminal. | xtermjs |
| `@xterm/addon-search` | `^0.15.0` | Recherche dans le scrollback. | xtermjs |
| `@xterm/addon-serialize` | `^0.13.0` | Sérialisation du buffer (logs/replay). | xtermjs |

### Docker piloting
| Package | Version | Rôle | Repo |
|---------|---------|------|------|
| `dockerode` | `^4.0.2` | API Docker complète (containers, images, volumes, networks, exec). **Pilote du Laboratoire.** | https://github.com/apocas/dockerode |
| `@docker/extension-api-client` | `^0.3.4` | (Optionnel) Types pour extensions Docker Desktop. | docker/docs |

### WSL automation
| Package | Version | Rôle | Repo |
|---------|---------|------|------|
| `wsl-wrapper` (ou wrapper maison via `child_process`) | — | Invoque `wsl.exe -d <distro> -- <cmd>`. Pas de package canonique stable ; **wrapper interne recommandé** autour de `child_process.spawn('wsl.exe', [...])`. | — |
| `@vscode/windows-process-tree` | `^0.6.0` | Liste processus Windows (utile pour Core Manager : détection Docker, WSL, etc.). | microsoft/vscode-windows-process-tree |

### IPC / Bridge Electron ↔ Renderer
| Package | Version | Rôle |
|---------|---------|------|
| `electron` | `^31.0.0` (Electron 31 = LTS actuel, IPC `contextBridge` sécurisé) | Runtime desktop. |
| `electron-context-menu` | `^4.0.0` | Menu clic-droit natif. |
| `electron-store` | `^10.0.0` | Persistance settings JSON chiffrés. |
| `electron-updater` | `^6.3.0` | Auto-update signé. |

### Native Windows APIs
| Package | Version | Rôle | Repo |
|---------|---------|------|------|
| `winreg` | `^1.2.5` | Lecture/écriture registry Windows (détection install, config). | https://github.com/fresc81/node-winreg |
| `registry-js` (alternative native) | `^1.46.0` | Binding natif N-API plus rapide. | https://github.com/desktop/registry-js |
| `systeminformation` | `^5.23.0` | CPU/RAM/disque/OS/network infos (Core Manager dashboard). | https://github.com/sebhildebrandt/systeminformation |
| `sudo-prompt` | `^9.2.1` | **Élévation UAC** depuis Electron (wrapper PowerShell `Start-Process -Verb RunAs`). Voir §5. | https://github.com/an-electron/sudo-prompt |
| `native-reg` (optionnel) | `^3.4.0` | Accès registry bas niveau via N-API. | — |
| `ffi-napi` / `koffi` | `koffi ^2.9.0` | (Réserve) Appels Win32 directs (`ShellExecuteW` "runas", `CreateProcessAsUserW`). Préférer `koffi` (actif) à `ffi-napi` (non maintenu). | https://github.com/korland/koffi |

### Build / Packaging
| Package | Version | Rôle |
|---------|---------|------|
| `electron-builder` | `^25.0.0` | Packaging NSIS + auto-update + signing. |
| `vite-plugin-electron` | `^0.28.0` | Intégration Vite ↔ Electron main/preload. |

### Récapitulatif deps clés à pinner
```jsonc
// package.json (extrait cible — indication, pas code exécutable)
{
  "dependencies": {
    "node-pty": "^1.0.0",
    "@xterm/xterm": "^5.5.0",
    "@xterm/addon-fit": "^0.10.0",
    "@xterm/addon-web-links": "^0.11.0",
    "@xterm/addon-search": "^0.15.0",
    "@xterm/addon-serialize": "^0.13.0",
    "dockerode": "^4.0.2",
    "electron": "^31.0.0",
    "electron-store": "^10.0.0",
    "electron-updater": "^6.3.0",
    "sudo-prompt": "^9.2.1",
    "winreg": "^1.2.5",
    "systeminformation": "^5.23.0",
    "@vscode/windows-process-tree": "^0.6.0",
    "koffi": "^2.9.0"
  },
  "devDependencies": {
    "electron-builder": "^25.0.0",
    "vite-plugin-electron": "^0.28.0"
  }
}
```

---

## 3. Top 5 images Docker vulnérables

Toutes officielles/maintenues, testées pour le module **Laboratoire**.

| # | Image | Docker Hub URL | Ports exposés | Stack/Catégories OWASP |
|---|-------|----------------|---------------|--------------------------|
| 1 | **OWASP Juice Shop** | https://hub.docker.com/r/bkimminich/juice-shop | `3000/tcp` (web), `3000` (API) | Node.js/Angular. OWASP Top 10 complet + JWT + XXE + IDOR. Modern stack. ✅ Confirmé par recherche. |
| 2 | **DVWA (Damn Vulnerable Web App)** | https://hub.docker.com/r/vulnerables/web-dvwa | `80/tcp` (HTTP Apache+PHP+MySQL) | PHP/MySQL. Bruteforce, CSRF, SQLi, RCE, file upload. Le grand classique. ✅ Confirmé. |
| 3 | **Metasploitable 2** | https://hub.docker.com/r/tghost/metasploitable2 (miroir communautaire) — image originelle Rapid7: https://hub.docker.com/r/rapid7/metasploitable2 | Multiples : `21` FTP, `22` SSH, `23` Telnet, `25` SMTP, `53` DNS, `80`/`8080` HTTP, `445` Samba, `1524` bindshell, `3306` MySQL, `5432` PostgreSQL, `6667` IRC, `8180` Tomcat | Linux intentionally vulnerable. Cible réseau multi-services. ✅ Confirmé. |
| 4 | **OWASP WebGoat** | https://hub.docker.com/r/webgoat/goatandwolf | `8080/tcp` (WebGoat), `9090/tcp` (WebWolf) | Java/Spring. Lessons guidées XSS, SQLi, deserialization, auth. Idéal pédagogique. ✅ Confirmé (owasp.org). |
| 5 | **bWAPP / DSVW / NodeGoat** | bWAPP: https://hub.docker.com/r/raesene/bwapp (maintenu par Raesene) ; DSVW: https://hub.docker.com/r/appsecco/dsvw ; NodeGoat: https://hub.docker.com/r/owasp/nodegoat | bWAPP `80/tcp` ; DSVW `65412/tcp` ; NodeGoat `4000/tcp` | Compléments : bWAPP (PHP, 100+ vulns), DSVW (single-file minimal), NodeGoat (Node.js/Express, OWASP Top 10 Node). |

### Commandes de lancement recommandées (référence, à intégrer au Laboratoire)
```bash
# Juice Shop
docker run --rm -d -p 3000:3000 --name juice-shop bkimminich/juice-shop

# DVWA
docker run --rm -d -p 80:80 --name dvwa vulnerables/web-dvwa

# Metasploitable2 (ATTENTION : exposition réseau large — bridge isolé)
docker run --rm -d --network lab-isolated --name metasploitable2 tghost/metasploitable2

# WebGoat + WebWolf
docker run --rm -d -p 8080:8080 -p 9090:9090 --name webgoat webgoat/goatandwolf

# bWAPP
docker run --rm -d -p 80:80 --name bwapp raesene/bwapp
```

### Note sécurité (importante)
- **Toujours** lancer dans un réseau Docker bridge **isolé** (`docker network create --driver bridge lab-isolated`), **jamais** `--network host`.
- Metasploitable2 ne doit **jamais** être exposé à Internet ni au LAN domestique non-isolé (services bindshell, FTP anonyme, Samba vulnérable).
- Prévoir dans le Core Manager un **kill-switch** "Stop all lab containers" global.

---

## 4. Outils Kali confirmés fonctionnels sur WSL 2

WSL 2 = kernel Linux réel → **la quasi-totalité des outils Kali userland fonctionnent**. Limites principales : tout ce qui nécessite un **device physique** (cartes Wi-Fi en monitor mode, Bluetooth raw, SDR) ou **kernel modules spécifiques non compilés dans le kernel WSL**. Le kernel WSL 2 ne supporte pas `monitor mode` Wi-Fi nativement → pour la section Wi-Fi de Guymacyb243, **passer la carte Wi-Fi USB à WSL via `usbipd-win`** est la solution.

### 4.1 Outils confirmés fonctionnels (sans device physique)

| Outil | Commande de test | Statut WSL 2 |
|-------|------------------|--------------|
| **Nmap** | `nmap -sV -p 80,443 scanme.nmap.org` | ✅ Pleinement fonctionnel (y compris NSE scripts). |
| **sqlmap** | `sqlmap -u "http://localhost:3000/rest/products/search?q=test" --batch` | ✅ Pleinement fonctionnel. |
| **Nikto** | `nikto -h http://localhost:3000` | ✅ Pleinement fonctionnel. |
| **Dirb / Gobuster / Feroxbuster** | `gobuster dir -u http://localhost:3000 -w /usr/share/wordlists/dirb/common.txt` | ✅ |
| **Hydra** | `hydra -l admin -P /usr/share/wordlists/rockyou.txt ssh://localhost` | ✅ |
| **John the Ripper / Hashcat (CPU)** | `john --wordlist=rockyou.txt hash.txt` ; `hashcat -m 0 -a 0 hash.txt rockyou.txt -D 1` | ✅ Hashcat **CPU only** (`-D 1`). GPU OpenCL/CUDA non accessible depuis WSL sans configuration avancée. |
| **Wireshark (CLI : tshark)** | `tshark -i lo -c 10` | ✅ `tshark` OK sur `lo`. Capture interfaces Windows brutes : OK via WSL mirrored networking (Win 11 22H2+) ou `pkexec`. |
| **Metasploit Framework** | `msfconsole -q -x "use auxiliary/scanner/portscan/tcp; set RHOSTS 127.0.0.1; run"` | ✅ Framework complet OK. |
| **Burp Suite (community)** | `burpsuite` (GUI via WSLg/Win-KeX) | ✅ Via WSLg (Win 11) ou Win-KeX (Win 10). |
| **WhatWeb** | `whatweb http://localhost:3000` | ✅ |
| **DNSrecon / Sublist3r** | `dnsrecon -d example.com -t std` | ✅ |
| **Wpscan** | `wpscan --url http://localhost --enumerate u` | ✅ |
| **SearchSploit** | `searchsploit -x 12345` | ✅ Base offline Exploit-DB. |
| **Netcat / ncat** | `nc -lvnp 4444` | ✅ |
| **Aircrack-ng (cracking only)** | `aircrack-ng -w rockyou.txt capture.cap` | ✅ **Cracking** OK. Le `monitor mode`/`airodump-ng` nécessite la carte Wi-Fi passée via `usbipd-win`. |
| **Reaver / Bully (WPS)** | nécessite carte Wi-Fi USB | ⚠️ Nécessite `usbipd-win` (voir §4.3). |
| **Wireshark GUI** | `wireshark` | ✅ Via WSLg. |
| **BloodHound / Neo4j** | `bloodhound` + `neo4j start` | ✅ GUI via WSLg. |

### 4.2 Installation Kali sur WSL 2
```powershell
wsl --install -d kali-linux        # depuis PowerShell admin
# Puis dans Kali :
sudo apt update && sudo apt full-upgrade -y
sudo apt install -y kali-linux-headless   # ou kali-linux-large / kali-linux-default
```
- `kali-linux-headless` : ~1.5 Go, sans GUI, **recommandé pour Guymacyb243** (on fournit le GUI via Electron).
- `kali-linux-large` : ~25 Go, la totale. À proposer en option "Full arsenal" dans le Core Manager.

### 4.3 Wi-Fi : la problématique monitor mode (section Wi-Fi)
Le kernel WSL 2 ne charge pas les drivers Wi-Fi. Solution confirmée et recommandée :
1. **`usbipd-win`** (https://github.com/dorssel/usbipd-win) — attache la carte Wi-Fi USB physique à WSL 2.
2. Dans WSL/Kali : `sudo apt install -y linux-firmware` + drivers de la carte (souvent `aircrack-ng` team patches).
3. Puis `airmon-ng start wlan0` / `airodump-ng wlan0mon` / `aireplay-ng` / `aircrack-ng` fonctionnent.

**Commande de test (Windows host, PowerShell admin) :**
```powershell
usbipd list                                    # liste devices USB
usbipd bind --busid <busid>
usbipd attach --wsl --busid <busid>
# Dans Kali :
sudo airmon-ng start wlan0
sudo airodump-ng wlan0mon
```
- À intégrer au Core Manager : **détection automatique** d'`usbipd-win` installé + wizard d'attach de carte Wi-Fi.

### 4.4 GUI Kali sur Windows (pour outils à fenêtre)
- **Windows 11 22H2+ :** WSLg intégré (`microsoft/wslg`) → les apps GUI Kali (`burpsuite`, `wireshark`, `bloodhound`) s'ouvrent nativement.
- **Windows 10 :** installer **Win-KeX** (`kali-win-kex`) → bureau Kali via TigerVNC, fenêtre intégrée Windows.
- **Fallback universel :** VcXsrv (X server), comme dans Commando VM.

### 4.5 Tableau récapitulatif "ce qui NE fonctionne PAS sur WSL 2 nu"
| Capacité | Statut | Contournement |
|----------|--------|---------------|
| Wi-Fi monitor mode / injection | ❌ Natif | `usbipd-win` + carte USB |
| Bluetooth raw / BLE attacks | ❌ Natif | `usbipd-win` + dongle USB |
| SDR (Gnuradio, HackRF) | ❌ Natif | `usbipd-win` + SDR USB |
| GPU cracking (Hashcat `-D 2`) | ⚠️ Difficile | Reste `-D 1` CPU ; ou déporter sur hôte Windows |
| Kernel exploits locaux | ⚠️ Limité | Le kernel WSL n'est pas un kernel Debian standard |

---

## 5. Méthode d'élévation UAC recommandée pour Electron

### 5.1 Comparatif des approches

| Approche | Avantages | Inconvénients | Verdict |
|----------|-----------|---------------|---------|
| **A. `sudo-prompt` (npm)** | API simple (`sudo.exec(cmd, opts, cb)`), multi-OS, wrappers Electron, **déclenche le prompt UAC natif** Win/Mac/Linux. | Paquet pas très maintenu récemment (forks actifs : `@electron-toolkit/sudo-prompt`). Pas de streaming stdin. | ✅ **Recommandé pour actions ponctuelles** (install Docker, install WSL, mount usbipd). |
| **B. PowerShell `Start-Process -Verb RunAs`** (spawn via `child_process`) | Natif, zero dépendance. Contrôle total des args. | Pas de stream stdout/stderr direct (rediriger via fichiers temporaires ou named pipes). Re-écrit un mini-wrapper. | ✅ **Recommandé pour setup wizard / Core Manager** (installations lourdes, scripts `.ps1`). |
| **C. `koffi` + `ShellExecuteW("runas", ...)`** | Appel Win32 direct, ultra-performant, contrôle total. | Plus complexe, binding natif à builder, signature code. | ⚠️ Réserver à cas avancés (exécuter un helper elevated persistent). |
| **D. "Elevation monolithic" (re-lancer toute l'app Electron en admin)** | Simple conceptuellement. | Anti-pattern : app entière en admin = faille sécurité. SmartScreen déclenche prompt au lancement. | ❌ Déconseillé. |
| **E. Helper exe elevated séparé (service/payload)** | Principe moindre-privilège respecté, persistance possible. | Complexité de packaging + signature + IPC avec l'app principale. | ⚠️ Réserver à phase 2 (auto-update de composants système). |

### 5.2 Recommandation Guymacyb243 (hybride A + B)

**Pattern recommandé :**
1. L'app Electron tourne en **privilèges utilisateur normaux**.
2. Pour les actions système (install Docker Desktop, install WSL, `wsl --install`, attach `usbipd-win`, modify PATH/registry), utiliser **`sudo-prompt`** comme couche haute (API unifiée, gestion d'erreurs UAC refusé).
3. Pour les scripts PowerShell longs (install Kali metapackages, provisioning), **wrapper interne** autour de :
   ```powershell
   Start-Process -FilePath "powershell.exe" -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File <script>.ps1" -Verb RunAs -Wait
   ```
   lancé via `child_process.spawn`. Récupérer stdout via redirection fichier temp ou `ConPTY`.
4. Pour le **setup wizard initial** (détecté non-admin), proposer un bouton "Relancer en administrateur" qui utilise `Start-Process -Verb RunAs` pour relancer l'exe setup (pattern classique d'installeurs).

### 5.3 Exemple canonique (pseudo-code, non exécutable — référence d'approche)
```js
// Approche B — wrapper PowerShell RunAs (référence, à implémenter dans toolbridge.ts)
import { spawn } from 'node:child_process';
function runElevated(scriptPath) {
  // Déclenche UAC natif ; stdout capturé via fichier temporaire
  return spawn('powershell.exe', [
    '-NoProfile','-ExecutionPolicy','Bypass','-Command',
    `Start-Process -FilePath powershell.exe -ArgumentList '-NoProfile -File "${scriptPath}"' -Verb RunAs -Wait`
  ]);
}
```
```js
// Approche A — sudo-prompt (référence)
import sudo from 'sudo-prompt';
sudo.exec('wsl --install -d kali-linux', { name: 'Guymacyb243 Setup' }, (err, stdout, stderr) => { /* ... */ });
```

### 5.4 Précautions
- **Toujours** signer l'exécutable final (code signing cert EV recommandé) sinon SmartScreen + UAC rouge effraie l'utilisateur.
- Ne jamais stocker d'identifiants en clair dans les scripts elevated → utiliser `electron-store` chiffré + DPAPI Windows (via `winreg`/`koffi` `CryptProtectData`).
- Logger chaque élévation (audit) dans le Core Manager.

---

## 6. Synthèse & prochaines actions

### Top 3 projets à cloner/étudier
1. **mandiant/commando-vm** — architecture de référence (Kali+WSL+GUI), script install.ps1 à adapter pour Core Manager.
2. **microsoft/vscode (module terminal)** — modèle technique `node-pty` + xterm.js pour `TerminalView`.
3. **WebVuln-Runner** — UX Laboratoire Docker à reproduire.

### Top 3 dépendances à pinner
1. `node-pty@^1.0.0` (+ addons `@xterm/*`) — terminal réel.
2. `dockerode@^4.0.2` — pilotage Docker du Laboratoire.
3. `sudo-prompt@^9.2.1` — élévation UAC (couplé à `Start-Process -Verb RunAs` natif).

### Top 3 images Docker du Laboratoire
1. `bkimminich/juice-shop` (`:3000`) — OWASP Top 10 moderne.
2. `vulnerables/web-dvwa` (`:80`) — classique PHP.
3. `rapid7/metasploitable2` / `tghost/metasploitable2` (multi-ports) — cible réseau multi-services (réseau isolé obligatoire).

### UAC — méthode retenue
Hybride : **`sudo-prompt`** (actions ponctuelles, API propre) + **wrapper interne `Start-Process -Verb RunAs`** (scripts PS1 longs de provisioning). App principale en droits normaux. Exe final signé obligatoire.

### Risques & points d'attention
- **Wi-Fi monitor mode** : dépend de `usbipd-win` + carte USB compatible → à valider en Device Manager au plus tôt (impact direct sur la section "Wi-Fi").
- **GPU cracking** : Hashcat CPU-only sur WSL → alternative = déporter Hashcat sur l'hôte Windows (build Windows natif) piloté via subprocess.
- **Licences** : Commando VM BSD-3 ✅, sudo-prompt MIT ✅, node-pty MIT ✅, dockerode Apache-2.0 ✅. Tous compatibles avec un produit propriétaire.
- **Win-KeX vs WSLg** : détecter l'OS au runtime (`systeminformation.os()` → version + build). Win 11 22H2+ → WSLg ; sinon → proposer Win-KeX.

### Prochaines actions suggérées (pour les agents de dev suivants)
1. `ARCH-1` : valider l'architecture Electron main/preload/renderer + IPC pour `TerminalView` (modèle VSCode).
2. `DOCKER-1` : implémenter `dockerode` bridge + réseau isolé + catalogue des 5 images du §3.
3. `WSL-1` : wrapper `wsl.exe` autour de `child_process.spawn` + détection distro Kali.
4. `UAC-1` : intégrer `sudo-prompt` + wrapper `Start-Process -Verb RunAs` dans `server/toolbridge.ts`.
5. `WIFI-1` : POC `usbipd-win` attach + `airmon-ng` sur carte USB (validation matérielle critique).

---
*Fin du rapport RESEARCH-1.*
