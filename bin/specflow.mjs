#!/usr/bin/env node
/**
 * CLI: install the app into any folder (create) or start API+UI (init).
 * Used via: npx --package=github:OWNER/specflow specflow <command>
 */
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
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

function isSpecflowRoot(dir) {
  return readPackageJson(dir)?.name === 'specflow';
}

function findAppRoot(start = process.cwd()) {
  let dir = path.resolve(start);
  for (;;) {
    if (isSpecflowRoot(dir)) return dir;
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
  const home = process.env.SPECFLOW_HOME?.trim();
  if (home) return path.resolve(home);
  return findAppRoot() ?? bundleRoot;
}

function isLikelyNpxCache(dir) {
  const norm = dir.replace(/\\/g, '/');
  return norm.includes('/_npx/') || norm.includes('/.npm/_npx/');
}

function getCloneUrl(explicit) {
  if (explicit?.trim()) return explicit.trim();
  const env = process.env.SPECFLOW_REPO?.trim();
  if (env) return env;
  const pkg = readPackageJson(bundleRoot);
  const url = pkg?.repository?.url;
  if (!url || typeof url !== 'string') {
    console.error(
      '[specflow] No Git URL for clone. Set SPECFLOW_REPO, pass a second argument, or add "repository.url" to package.json.'
    );
    process.exit(1);
  }
  return url.replace(/^git\+/, '');
}

function usage() {
  console.log(`specflow — Jira kanban UI + local API proxy

Not on npmjs.org — bare "npx specflow" will 404. Use --package=github:… (see below).

Commands:
  specflow init [dir]    Start API + UI (optional path to your clone)
  specflow create [dir] [git-url]
                            Clone into ./dir (default: specflow), then npm install
  specflow update [dir] Update an existing install (git clone: git pull + npm install;
                            global install: pulls/clones into ~/.specflow/src, npm
                            install, then relinks the global bin to it)

From ANY folder (replace OWNER with your GitHub user or org):

  npx --package=github:OWNER/specflow specflow init
  npx --package=github:OWNER/specflow specflow init ~/projects/specflow

Persistent install path (optional, then "init" with no args works anywhere):

  export SPECFLOW_HOME=~/projects/specflow

First-time setup:

  npx --package=github:OWNER/specflow specflow create my-dashboard
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
  if (!isSpecflowRoot(root)) {
    console.error(
      `[specflow] Not a specflow install: ${root}\n` +
        'Use an existing clone path, or create one:\n' +
        '  npx --package=github:OWNER/specflow specflow create my-dashboard'
    );
    process.exit(1);
  }

  if (!fs.existsSync(path.join(root, 'node_modules'))) {
    console.log('[specflow] node_modules missing — running npm install …');
    try {
      execFileSync('npm', ['install'], { cwd: root, stdio: 'inherit', shell });
    } catch {
      console.error('[specflow] npm install failed.');
      process.exit(1);
    }
  }

  if (isLikelyNpxCache(root) && !fs.existsSync(path.join(root, '.env'))) {
    console.warn(
      '[specflow] Starting from the npx cache without .env — Jira settings will be empty.\n' +
        '  Prefer: specflow init /path/to/your/clone\n' +
        '  Or: export SPECFLOW_HOME=/path/to/your/clone'
    );
  }

  console.log(`[specflow] Starting from ${root}`);
  runInit(root);
} else if (cmd === 'create') {
  const dirName = arg1?.trim() || 'specflow';
  const cloneUrl = getCloneUrl(arg2);
  const target = path.resolve(process.cwd(), dirName);
  if (fs.existsSync(target)) {
    console.error(`[specflow] Already exists: ${target}`);
    process.exit(1);
  }
  console.log(`[specflow] git clone → ${target}`);
  try {
    execFileSync('git', ['clone', cloneUrl, target], { stdio: 'inherit' });
  } catch {
    console.error('[specflow] git clone failed. Install Git and check the repository URL.');
    process.exit(1);
  }
  console.log('[specflow] npm install …');
  try {
    execFileSync('npm', ['install'], { cwd: target, stdio: 'inherit', shell });
  } catch {
    console.error('[specflow] npm install failed.');
    process.exit(1);
  }
  const rel = path.relative(process.cwd(), target);
  const cdPath = rel && !rel.startsWith('..') ? rel : dirName;
  console.log(
    `\n[specflow] Done.\n  export SPECFLOW_HOME="${target}"\n  npx --package=github:OWNER/specflow specflow init\n  # or: cd ${cdPath} && npm run init\n`
  );
} else if (cmd === 'update') {
  const root = resolveInitRoot(arg1);
  if (!isSpecflowRoot(root)) {
    console.error(
      `[specflow] Not a specflow install: ${root}\n` +
        'Pass the path to your clone, or set SPECFLOW_HOME.'
    );
    process.exit(1);
  }

  const isGitClone = fs.existsSync(path.join(root, '.git'));

  if (isGitClone) {
    console.log(`[specflow] git pull in ${root} …`);
    try {
      execFileSync('git', ['pull', '--ff-only'], { cwd: root, stdio: 'inherit' });
    } catch {
      console.error(
        '[specflow] git pull failed (local changes or diverged history?). Resolve manually, e.g.:\n' +
          `  cd ${root} && git status`
      );
      process.exit(1);
    }
    console.log('[specflow] npm install …');
    try {
      execFileSync('npm', ['install'], { cwd: root, stdio: 'inherit', shell });
    } catch {
      console.error('[specflow] npm install failed.');
      process.exit(1);
    }
    console.log('[specflow] Up to date.');
  } else if (isLikelyNpxCache(root)) {
    console.log(
      '[specflow] Running from the npx cache — nothing to update here.\n' +
        '  Each "npx --package=github:…" run already fetches the latest.\n' +
        '  For a persistent install: specflow create <dir>, or npm install -g github:OWNER/specflow'
    );
  } else {
    // Assumed global install (npm install -g github:OWNER/specflow).
    //
    // `npm install -g <git-url>` is NOT reused here: npm symlinks that kind of
    // global install into its own cache's ephemeral tmp/git-clone-* dir, which
    // npm garbage-collects almost immediately — sometimes before the install
    // even finishes reifying nested deps. That produces flaky-looking
    // "ENOENT"/"spawn sh ENOENT" failures with files vanishing mid-install.
    // Instead, keep our own persistent clone and point the global install at
    // that directory (a local-path global install just symlinks straight to
    // it, with no npm-cache tmp dir involved).
    const cloneUrl = getCloneUrl(arg2);
    const srcDir = path.join(os.homedir(), '.specflow', 'src');

    if (fs.existsSync(path.join(srcDir, '.git'))) {
      console.log(`[specflow] git pull in ${srcDir} …`);
      try {
        execFileSync('git', ['pull', '--ff-only'], { cwd: srcDir, stdio: 'inherit' });
      } catch {
        console.error(
          `[specflow] git pull failed in ${srcDir} (local changes or diverged history?). Resolve manually, e.g.:\n` +
            `  cd ${srcDir} && git status`
        );
        process.exit(1);
      }
    } else {
      fs.mkdirSync(path.dirname(srcDir), { recursive: true });
      console.log(`[specflow] Cloning ${cloneUrl} into ${srcDir} …`);
      try {
        execFileSync('git', ['clone', cloneUrl, srcDir], { stdio: 'inherit' });
      } catch {
        console.error('[specflow] Clone failed.');
        process.exit(1);
      }
    }

    console.log(`[specflow] npm install in ${srcDir} …`);
    try {
      execFileSync('npm', ['install'], { cwd: srcDir, stdio: 'inherit', shell });
    } catch {
      console.error('[specflow] npm install failed.');
      process.exit(1);
    }

    console.log(`[specflow] npm install -g ${srcDir} …`);
    try {
      execFileSync('npm', ['install', '-g', srcDir], { stdio: 'inherit', shell });
    } catch {
      console.error('[specflow] Global relink failed. Try manually:\n' + `  npm install -g ${srcDir}`);
      process.exit(1);
    }
    console.log('[specflow] Up to date.');
  }
} else {
  usage();
  process.exit(1);
}
