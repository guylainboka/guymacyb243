// Guymacyb243 — server/labManager.ts
// ---------------------------------------------------------------
// Laboratory Manager : pilote Docker pour créer/démarrer/arrêter de vrais
// environnements de test isolés. Aucune simulation : chaque action appelle
// l'API Docker réelle (dockerode).
//
// Réseau isolé : chaque lab tourne sur son propre réseau Docker (driver
// bridge, internal: true) — le conteneur n'a PAS accès au réseau hôte ni à
// internet. Accès uniquement via les ports explicitement mappés sur localhost.

import Docker from 'dockerode';
import { execFileSync } from 'child_process';

let dockerConn: Docker | null = null;

function getDocker(): Docker {
  if (dockerConn) return dockerConn;
  // Sur Windows : npipe:////./pipe/docker_engine ; sur Linux : socket Unix
  dockerConn = process.platform === 'win32'
    ? new Docker({ socketPath: '//./pipe/docker_engine' })
    : new Docker();
  return dockerConn;
}

export interface LabEnvironment {
  id: string;
  name: string;
  description: string;
  image: string;
  ports: { host: number; container: number; protocol: string }[];
  category: 'web' | 'multi-service' | 'wifi' | 'custom';
  difficulty: 'Débutant' | 'Intermédiaire' | 'Avancé';
  credentials?: { user: string; password: string }[];
  isolatedNetwork: boolean;
}

// Catalogue des environnements de laboratoire disponibles (images Docker réelles)
export const LAB_CATALOG: LabEnvironment[] = [
  {
    id: 'dvwa',
    name: 'DVWA — Damn Vulnerable Web App',
    description: "Application PHP/MySQL volontairement vulnérable. OWASP Top 10 classique. Idéale pour apprendre les injections SQL, XSS, file upload, etc.",
    image: 'vulnerables/web-dvwa',
    ports: [{ host: 8080, container: 80, protocol: 'http' }],
    category: 'web',
    difficulty: 'Débutant',
    credentials: [{ user: 'admin', password: 'password' }],
    isolatedNetwork: true,
  },
  {
    id: 'juice-shop',
    name: 'OWASP Juice Shop',
    description: "Application moderne Node.js/Angular avec vulnérabilités OWASP Top 10 et challenges de difficulté progressive. Tracking de progression.",
    image: 'bkimminich/juice-shop',
    ports: [{ host: 3000, container: 3000, protocol: 'http' }],
    category: 'web',
    difficulty: 'Intermédiaire',
    isolatedNetwork: true,
  },
  {
    id: 'metasploitable2',
    name: 'Metasploitable 2',
    description: "Machine Linux volontairement vulnérable avec de multiples services (FTP, SSH, HTTP, Samba, MySQL, Tomcat...). Pour tests d'exploitation multi-vecteurs.",
    image: 'tghost/metasploitable2',
    ports: [
      { host: 8081, container: 80, protocol: 'http' },
      { host: 8022, container: 22, protocol: 'ssh' },
      { host: 8445, container: 445, protocol: 'smb' },
    ],
    category: 'multi-service',
    difficulty: 'Avancé',
    credentials: [{ user: 'msfadmin', password: 'msfadmin' }],
    isolatedNetwork: true,
  },
  {
    id: 'webgoat',
    name: 'WebGoat',
    description: "Plateforme d'apprentissage OWASP avec leçons structurées sur les vulnérabilités web (injection, auth, access control, crypto...).",
    image: 'webgoat/goatandwolf',
    ports: [{ host: 8088, container: 8080, protocol: 'http' }, { host: 9090, container: 9090, protocol: 'http' }],
    category: 'web',
    difficulty: 'Intermédiaire',
    isolatedNetwork: true,
  },
];

const RUNNING_LABS: Map<string, { containerId: string; networkId: string; startedAt: string }> = new Map();

/** Vérifie que Docker est disponible. */
async function checkDocker(): Promise<{ ready: boolean; reason?: string }> {
  try {
    const docker = getDocker();
    await docker.ping();
    return { ready: true };
  } catch (err: any) {
    return { ready: false, reason: `Docker non disponible — ${err.message}. Démarrez Docker Desktop.` };
  }
}

/** Liste les environnements de laboratoire disponibles + leur état réel. */
export async function listLabEnvironments(): Promise<Array<LabEnvironment & { running: boolean; startedAt?: string }>> {
  const dockerStatus = await checkDocker();
  if (!dockerStatus.ready) {
    return LAB_CATALOG.map((env) => ({ ...env, running: false }));
  }
  const result: Array<LabEnvironment & { running: boolean; startedAt?: string }> = [];
  for (const env of LAB_CATALOG) {
    const running = RUNNING_LABS.has(env.id);
    const info = RUNNING_LABS.get(env.id);
    result.push({ ...env, running, startedAt: info?.startedAt });
  }
  return result;
}

/** Démarre un environnement de laboratoire réel (pull image + réseau isolé + conteneur). */
export async function startLab(labId: string): Promise<{ ok: boolean; labId: string; message: string; url?: string }> {
  const env = LAB_CATALOG.find((e) => e.id === labId);
  if (!env) return { ok: false, labId, message: `Lab inconnu: ${labId}` };

  const dockerStatus = await checkDocker();
  if (!dockerStatus.ready) {
    return { ok: false, labId, message: dockerStatus.reason || 'Docker non disponible' };
  }

  if (RUNNING_LABS.has(labId)) {
    return { ok: false, labId, message: `Lab ${env.name} déjà en cours d'exécution` };
  }

  const docker = getDocker();

  try {
    // 1. Crée un réseau Docker isolé (internal, pas d'accès internet depuis le conteneur)
    const networkName = `guymacyb-lab-${labId}-net`;
    let network;
    try {
      network = await docker.createNetwork({
        Name: networkName,
        Driver: 'bridge',
        Internal: env.isolatedNetwork, // true = pas d'accès internet depuis le conteneur
      });
    } catch {
      // Réseau existe déjà — on le réutilise
      network = docker.getNetwork(networkName);
    }

    // 2. Pull l'image (réel)
    await new Promise<void>((resolve, reject) => {
      docker.pull(env.image, (err: any, stream: any) => {
        if (err) return reject(err);
        docker.modem.followProgress(stream, (err: any) => err ? reject(err) : resolve());
      });
    });

    // 3. Crée et démarre le conteneur avec port mapping + réseau isolé
    const portBindings: any = {};
    for (const p of env.ports) {
      portBindings[`${p.container}/${p.protocol}`] = [{ HostPort: String(p.host), HostIp: '127.0.0.1' }];
    }
    const container = await docker.createContainer({
      name: `guymacyb-lab-${labId}`,
      Image: env.image,
      HostConfig: {
        PortBindings: portBindings,
        NetworkMode: networkName,
        AutoRemove: false,
        RestartPolicy: { Name: 'no' },
      },
    });
    await container.start();
    await network.connect({ Container: container.id });

    RUNNING_LABS.set(labId, {
      containerId: container.id,
      networkId: (network as any).id || networkName,
      startedAt: new Date().toISOString(),
    });

    const url = `http://127.0.0.1:${env.ports[0].host}`;
    return {
      ok: true,
      labId,
      message: `Lab ${env.name} démarré — isolé sur le réseau Docker ${networkName}`,
      url,
    };
  } catch (err: any) {
    return { ok: false, labId, message: `Échec du démarrage: ${err.message}` };
  }
}

/** Arrête et supprime un environnement de laboratoire (réel). */
export async function stopLab(labId: string): Promise<{ ok: boolean; labId: string; message: string }> {
  const env = LAB_CATALOG.find((e) => e.id === labId);
  if (!env) return { ok: false, labId, message: `Lab inconnu: ${labId}` };
  const info = RUNNING_LABS.get(labId);
  if (!info) return { ok: false, labId, message: `Lab ${env.name} n'est pas en cours d'exécution` };

  const dockerStatus = await checkDocker();
  if (!dockerStatus.ready) {
    return { ok: false, labId, message: dockerStatus.reason || 'Docker non disponible' };
  }

  const docker = getDocker();
  try {
    const container = docker.getContainer(info.containerId);
    await container.stop();
    await container.remove();
    try {
      const network = docker.getNetwork(info.networkId);
      await network.remove();
    } catch {
      // Réseau peut être en cours d'usage — on ignore
    }
    RUNNING_LABS.delete(labId);
    return { ok: true, labId, message: `Lab ${env.name} arrêté et supprimé` };
  } catch (err: any) {
    return { ok: false, labId, message: `Échec de l'arrêt: ${err.message}` };
  }
}

/** Statut réel d'un lab (inspecte le conteneur Docker). */
export async function getLabStatus(labId: string): Promise<{ running: boolean; startedAt?: string; ports?: Record<string, unknown> }> {
  const info = RUNNING_LABS.get(labId);
  if (!info) return { running: false };
  const dockerStatus = await checkDocker();
  if (!dockerStatus.ready) return { running: false };
  try {
    const docker = getDocker();
    const container = docker.getContainer(info.containerId);
    const data = await container.inspect();
    return {
      running: data.State.Running,
      startedAt: info.startedAt,
      ports: data.NetworkSettings.Ports as Record<string, unknown>,
    };
  } catch {
    return { running: false };
  }
}
