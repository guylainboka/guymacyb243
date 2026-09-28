// Types partagés Guymacyb243
export type ModuleView = 'wifi' | 'web-apps' | 'laboratory' | 'core-manager';

export interface ToolDef {
  id: string;
  name: string;
  level: 'core' | 'wifi' | 'web' | 'laboratory' | 'optional';
  category: string;
  description: string;
  whatItModifies?: string;
  requiresAdmin?: boolean;
  aptPackages?: string[];
}

export interface ToolStatus {
  def: ToolDef;
  state: 'installed' | 'missing' | 'version-incorrect' | 'incompatible' | 'admin-required';
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
  wsl: { ready: boolean; distros: any[]; defaultDistro: string | null; reason?: string };
  docker: { ready: boolean; version?: string; reason?: string };
  tools: ToolStatus[];
  adminRequired: boolean;
  readyForUse: boolean;
  missingCritical: string[];
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
  running?: boolean;
  startedAt?: string;
}
