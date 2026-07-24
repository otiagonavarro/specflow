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

function isKanbamRoot(dir) {
  return readPackageJson(dir)?.name === 'kanbam-code';
}

function findAppRoot(start = process.cwd()) {
  let dir = path.resolve(start);
  for (;;) {
    if (isKanbamRoot(dir)) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function resolveInitRoot(explicitDir) {
  if (explicitDir?.trim()) {
    return path.resolve(process.cwd(), explicitDir.trim());
  }
  const home = process.env.KANBAM_CODE_HOME?.trim();
  if (home) return path.resolve(home);
  return findAppRoot() ?? bundleRoot;
}

function isLikelyNpxCache(dir) {
  const norm = dir.replace(/\\/g, '/');
  return norm.includes('/_npx/') || norm.includes('/.npm/_npx/');
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
  kanbam-code init [dir]    Start API + UI (optional path to your clone)
  kanbam-code create [dir] [git-url]
                            Clone into ./dir (default: kanbam-code), then npm install
  kanbam-code update [dir] Update an existing install (git clone: git pull + npm install;
                            global "npm install -g": reinstalls the latest from GitHub)

From ANY folder (replace OWNER with your GitHub user or org):

  npx --package=github:OWNER/kanbam-code kanbam-code init
  npx --package=github:OWNER/kanbam-code kanbam-code init ~/projects/kanbam-code

Persistent install path (optional, then "init" with no args works anywhere):

  export KANBAM_CODE_HOME=~/projects/kanbam-code

First-time setup:

  npx --package=github:OWNER/kanbam-code kanbam-code create my-dashboard
  cd my-dashboard && npm run init
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
  const root = resolveInitRoot(arg1);
  if (!isKanbamRoot(root)) {
    console.error(
      `[kanbam-code] Not a kanbam-code install: ${root}\n` +
        'Use an existing clone path, or create one:\n' +
        '  npx --package=github:OWNER/kanbam-code kanbam-code create my-dashboard'
    );
    process.exit(1);
  }

  if (!fs.existsSync(path.join(root, 'node_modules'))) {
    console.log('[kanbam-code] node_modules missing — running npm install …');
    try {
      execFileSync('npm', ['install'], { cwd: root, stdio: 'inherit', shell });
    } catch {
      console.error('[kanbam-code] npm install failed.');
      process.exit(1);
    }
  }

  if (isLikelyNpxCache(root) && !fs.existsSync(path.join(root, '.env'))) {
    console.warn(
      '[kanbam-code] Starting from the npx cache without .env — Jira settings will be empty.\n' +
        '  Prefer: kanbam-code init /path/to/your/clone\n' +
        '  Or: export KANBAM_CODE_HOME=/path/to/your/clone'
    );
  }

  console.log(`[kanbam-code] Starting from ${root}`);
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
  console.log(
    `\n[kanbam-code] Done.\n  export KANBAM_CODE_HOME="${target}"\n  npx --package=github:OWNER/kanbam-code kanbam-code init\n  # or: cd ${cdPath} && npm run init\n`
  );
} else if (cmd === 'update') {
  const root = resolveInitRoot(arg1);
  if (!isKanbamRoot(root)) {
    console.error(
      `[kanbam-code] Not a kanbam-code install: ${root}\n` +
        'Pass the path to your clone, or set KANBAM_CODE_HOME.'
    );
    process.exit(1);
  }

  const isGitClone = fs.existsSync(path.join(root, '.git'));

  if (isGitClone) {
    console.log(`[kanbam-code] git pull in ${root} …`);
    try {
      execFileSync('git', ['pull', '--ff-only'], { cwd: root, stdio: 'inherit' });
    } catch {
      console.error(
        '[kanbam-code] git pull failed (local changes or diverged history?). Resolve manually, e.g.:\n' +
          `  cd ${root} && git status`
      );
      process.exit(1);
    }
    console.log('[kanbam-code] npm install …');
    try {
      execFileSync('npm', ['install'], { cwd: root, stdio: 'inherit', shell });
    } catch {
      console.error('[kanbam-code] npm install failed.');
      process.exit(1);
    }
    console.log('[kanbam-code] Up to date.');
  } else if (isLikelyNpxCache(root)) {
    console.log(
      '[kanbam-code] Running from the npx cache — nothing to update here.\n' +
        '  Each "npx --package=github:…" run already fetches the latest.\n' +
        '  For a persistent install: kanbam-code create <dir>, or npm install -g github:OWNER/kanbam-code'
    );
  } else {
    // Assumed global install (npm install -g github:OWNER/kanbam-code).
    const cloneUrl = getCloneUrl(arg2);
    console.log(`[kanbam-code] npm install -g ${cloneUrl} …`);
    try {
      execFileSync('npm', ['install', '-g', cloneUrl], { stdio: 'inherit', shell });
    } catch {
      console.error('[kanbam-code] Global reinstall failed. Try manually:\n' + `  npm install -g ${cloneUrl}`);
      process.exit(1);
    }
    console.log('[kanbam-code] Up to date.');
  }
} else {
  usage();
  process.exit(1);
}
