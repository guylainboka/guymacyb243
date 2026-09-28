#!/usr/bin/env node
// Guymacyb243 — build-server-bundle.js
// Bundle le backend Express (server.ts + server/*.ts) en un seul fichier CJS
// self-contained : dist-server/server.cjs + sql-wasm.wasm copié à côté.
// Le bundle est ce que Electron spawn en production.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import esbuild from 'esbuild';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const ENTRY = path.join(PROJECT_ROOT, 'server.ts');
const OUT_DIR = path.join(PROJECT_ROOT, 'dist-server');
const OUT_FILE = path.join(OUT_DIR, 'server.cjs');
const SQL_WASM_SRC = path.join(PROJECT_ROOT, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
const SQL_WASM_DEST = path.join(OUT_DIR, 'sql-wasm.wasm');

function ensureDir(dir) { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); }
function copyFile(src, dest) {
  fs.copyFileSync(src, dest);
  console.log(`[build-server-bundle] copied ${path.basename(dest)} (${fs.statSync(dest).size} bytes)`);
}

async function main() {
  console.log('[build-server-bundle] entry :', path.relative(PROJECT_ROOT, ENTRY));
  console.log('[build-server-bundle] output:', path.relative(PROJECT_ROOT, OUT_FILE));
  if (!fs.existsSync(ENTRY)) throw new Error(`Entry not found: ${ENTRY}`);
  if (!fs.existsSync(SQL_WASM_SRC)) throw new Error(`sql-wasm.wasm not found at ${SQL_WASM_SRC}. Run npm install first.`);
  ensureDir(OUT_DIR);

  await esbuild.build({
    entryPoints: [ENTRY],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node20',
    outfile: OUT_FILE,
    minify: true,
    sourcemap: false,
    legalComments: 'none',
    logLevel: 'info',
    external: [
      // Modules natifs — doivent être dans node_modules au runtime (Electron les apporte)
      'node-pty',
      'dockerode',
      'systeminformation',
      // Pas d'import statique de vite (dev only, voir commentaire server.ts)
    ],
    define: {
      'process.env.NODE_ENV': '"production"',
      'import.meta.url': '__import_meta_url',
    },
    banner: {
      js: [
        '// Guymacyb243 — bundled Express backend (production).',
        '// Built by desktop/build-server-bundle.js — do not edit by hand.',
        'var __import_meta_url = require("url").pathToFileURL(__filename).href;',
      ].join('\n'),
    },
  });

  copyFile(SQL_WASM_SRC, SQL_WASM_DEST);
  console.log(`[build-server-bundle] bundle: ${path.relative(PROJECT_ROOT, OUT_FILE)} (${(fs.statSync(OUT_FILE).size / 1024).toFixed(1)} KB)`);
  console.log('[build-server-bundle] done.');
}

main().catch((err) => { console.error('[build-server-bundle] FAILED:', err); process.exit(1); });
