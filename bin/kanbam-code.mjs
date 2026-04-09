#!/usr/bin/env node
/**
 * CLI: install the app into any folder (create) or start API+UI (init).
 * Used via: npx --package=github:OWNER/kanbam-code kanbam-code <command>
 */
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const bundleRoot = path.resolve(__dirname, '..');

function readPackageJson(dir) {
  const p = path.join(dir, 'package.json');
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function findAppRoot(start = process.cwd()) {
  let dir = path.resolve(start);
  for (;;) {
    const j = readPackageJson(dir);
    if (j?.name === 'kanbam-code') return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function getCloneUrl(explicit) {
  if (explicit?.trim()) return explicit.trim();
  const env = process.env.KANBAM_CODE_REPO?.trim();
  if (env) return env;
  const pkg = readPackageJson(bundleRoot);
  const url = pkg?.repository?.url;
  if (!url || typeof url !== 'string') {
    console.error(
      '[kanbam-code] No Git URL for clone. Set KANBAM_CODE_REPO, pass a second argument, or add "repository.url" to package.json.'
    );
    process.exit(1);
  }
  return url.replace(/^git\+/, '');
}

function usage() {
  console.log(`kanbam-code — Jira kanban UI + local API proxy

Not on npmjs.org — bare "npx kanbam-code" will 404. Use --package=github:… (see below).

Commands:
  kanbam-code init          Start API + UI (run inside the cloned repo; works from any subfolder)
  kanbam-code create [dir] [git-url]
                            Clone into ./dir (default: kanbam-code), then npm install

Install from any parent folder (replace OWNER with your GitHub user or org):
  npx --package=github:OWNER/kanbam-code kanbam-code create my-dashboard
  cd my-dashboard && npm run init

Or clone manually:
  git clone https://github.com/OWNER/kanbam-code.git && cd kanbam-code && npm install && npm run init
`);
}

function runInit(appRoot) {
  const child = spawn('npm', ['run', 'init'], {
    cwd: appRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env },
  });
  child.on('exit', (code) => process.exit(code ?? 0));
}

const [, , cmd, arg1, arg2] = process.argv;
const shell = process.platform === 'win32';

if (!cmd || cmd === '-h' || cmd === '--help' || cmd === 'help') {
  usage();
  const helpCmd = cmd === '-h' || cmd === '--help' || cmd === 'help';
  process.exit(helpCmd ? 0 : 1);
}

if (cmd === 'init' || cmd === 'start') {
  const root = findAppRoot();
  if (!root) {
    console.error(
      '[kanbam-code] Not inside a kanbam-code clone. Create one first:\n  kanbam-code create <folder>\n  cd <folder> && npm run init'
    );
    process.exit(1);
  }
  runInit(root);
} else if (cmd === 'create') {
  const dirName = arg1?.trim() || 'kanbam-code';
  const cloneUrl = getCloneUrl(arg2);
  const target = path.resolve(process.cwd(), dirName);
  if (fs.existsSync(target)) {
    console.error(`[kanbam-code] Already exists: ${target}`);
    process.exit(1);
  }
  console.log(`[kanbam-code] git clone → ${target}`);
  try {
    execFileSync('git', ['clone', cloneUrl, target], { stdio: 'inherit' });
  } catch {
    console.error('[kanbam-code] git clone failed. Install Git and check the repository URL.');
    process.exit(1);
  }
  console.log('[kanbam-code] npm install …');
  try {
    execFileSync('npm', ['install'], { cwd: target, stdio: 'inherit', shell });
  } catch {
    console.error('[kanbam-code] npm install failed.');
    process.exit(1);
  }
  const rel = path.relative(process.cwd(), target);
  const cdPath = rel && !rel.startsWith('..') ? rel : dirName;
  console.log(`\n[kanbam-code] Done.\n  cd ${cdPath}\n  npm run init\n`);
} else {
  usage();
  process.exit(1);
}
