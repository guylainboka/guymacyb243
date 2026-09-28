// Guymacyb243 — server/db.ts
// Persistance SQLite réelle (via sql.js).
// Base vide au démarrage — aucune donnée fictive préchargée.

import initSqlJs, { Database } from 'sql.js';
import * as fs from 'fs';
import * as path from 'path';

const DB_FILE_PATH = process.env.GCYB243_DB_PATH
  || path.join(process.env.APPDATA || process.env.HOME || process.cwd(), 'guymacyb243.db');

let dbInstance: Database | null = null;

export async function getDatabase(): Promise<Database> {
  if (dbInstance) return dbInstance;
  const SQL = await initSqlJs({
    locateFile: (file: string) => {
      // Cherche le wasm dans plusieurs emplacements possibles
      const candidates = [
        path.join(__dirname, file),
        path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', file),
        path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', file),
      ];
      for (const c of candidates) {
        try { if (fs.existsSync(c)) return c; } catch { /* ignore */ }
      }
      return file;
    },
  });

  if (fs.existsSync(DB_FILE_PATH)) {
    try {
      const buffer = fs.readFileSync(DB_FILE_PATH);
      dbInstance = new SQL.Database(buffer);
    } catch (err) {
      console.warn('[Guymacyb243] DB corrompue — recréation:', err);
      dbInstance = new SQL.Database();
    }
  } else {
    dbInstance = new SQL.Database();
  }

  initTables(dbInstance);
  console.log(`[Guymacyb243] SQLite initialisé: ${DB_FILE_PATH}`);
  return dbInstance;
}

function initTables(db: Database) {
  db.run(`
    CREATE TABLE IF NOT EXISTS targets (
      id TEXT PRIMARY KEY,
      url TEXT NOT NULL,
      domain TEXT,
      scope TEXT,
      operator_id TEXT,
      created_at TEXT NOT NULL,
      last_scanned_at TEXT,
      status TEXT
    );

    CREATE TABLE IF NOT EXISTS scans (
      id TEXT PRIMARY KEY,
      target_id TEXT,
      url TEXT,
      scan_type TEXT,
      cvss_score REAL,
      risk_level TEXT,
      duration_ms INTEGER,
      endpoints_count INTEGER,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS findings (
      id TEXT PRIMARY KEY,
      scan_id TEXT,
      target_url TEXT,
      title TEXT,
      severity TEXT,
      cvss REAL,
      confidence INTEGER,
      status TEXT,
      affected_component TEXT,
      category TEXT,
      cwe TEXT,
      description TEXT,
      evidence_request TEXT,
      evidence_response TEXT,
      impact TEXT,
      remediation_title TEXT,
      remediation_steps_json TEXT,
      signature TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      tag TEXT NOT NULL,
      text TEXT NOT NULL,
      operator_id TEXT
    );

    CREATE TABLE IF NOT EXISTS authorizations (
      id TEXT PRIMARY KEY,
      target TEXT NOT NULL,
      scope TEXT,
      operator_id TEXT,
      justification TEXT,
      granted_at TEXT NOT NULL,
      expires_at TEXT
    );
  `);
}

export function saveDatabaseToDisk(db?: Database) {
  try {
    const target = db || dbInstance;
    if (!target) return;
    const data = target.export();
    fs.writeFileSync(DB_FILE_PATH, Buffer.from(data));
  } catch (err) {
    console.error('[Guymacyb243] Erreur sauvegarde DB:', err);
  }
}

export function getDbFilePath() {
  return DB_FILE_PATH;
}
