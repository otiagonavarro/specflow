/**
 * One-command dev startup: ensure .env, start Express API, wait for health, start Vite UI.
 * Usage: npm run init (after npm install)
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { DEFAULT_API_PORT, DEFAULT_UI_DEV_PORT } from './dev-ports.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
process.chdir(root);

const envPath = path.join(root, '.env');
const examplePath = path.join(root, '.env.example');

if (!fs.existsSync(envPath) && fs.existsSync(examplePath)) {
  fs.copyFileSync(examplePath, envPath);
  console.log('[specflow] Created .env from .env.example — add Jira settings there or in the app UI.');
}

dotenv.config({ path: envPath });
const serverPort = String(Number(process.env.SERVER_PORT) || DEFAULT_API_PORT);
const apiPortNum = Number(serverPort);
const healthUrl = `http://127.0.0.1:${serverPort}/api/health`;

const shell = process.platform === 'win32';

function runNpm(script) {
  return spawn('npm', ['run', script], {
    cwd: root,
    stdio: 'inherit',
    shell,
    env: { ...process.env, FORCE_COLOR: process.env.FORCE_COLOR ?? '1' },
  });
}

function canListen(port) {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.once('error', () => resolve(false));
    s.listen(port, '127.0.0.1', () => {
      s.close(() => resolve(true));
    });
  });
}

async function findFreeUiPort(fromPort, reservedApiPort, maxAttempts = 40) {
  for (let p = fromPort; p < fromPort + maxAttempts; p++) {
    if (p === reservedApiPort) continue;
    if (await canListen(p)) return p;
  }
  throw new Error(`No free TCP port for the UI between ${fromPort} and ${fromPort + maxAttempts - 1}`);
}

function runVite(uiPort) {
  return spawn('npx', ['vite', '--port', String(uiPort), '--host', '0.0.0.0', '--strictPort'], {
    cwd: root,
    stdio: 'inherit',
    shell,
    env: { ...process.env, FORCE_COLOR: process.env.FORCE_COLOR ?? '1' },
  });
}

const server = runNpm('server');

let ui = null;
let intentionalShutdown = false;

function shutdown(code = 0) {
  intentionalShutdown = true;
  try {
    if (ui && !ui.killed) ui.kill('SIGTERM');
  } catch {
    /* ignore */
  }
  try {
    if (server && !server.killed) server.kill('SIGTERM');
  } catch {
    /* ignore */
  }
  process.exit(code);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

async function waitForHealth(timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (server.exitCode != null && server.exitCode !== 0) {
      throw new Error('Server process exited before becoming ready');
    }
    try {
      const res = await fetch(healthUrl);
      if (res.ok) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Timed out waiting for ${healthUrl} (check SERVER_PORT in .env)`);
}

try {
  await waitForHealth();
} catch (err) {
  console.error('[specflow]', err instanceof Error ? err.message : err);
  try {
    server.kill('SIGTERM');
  } catch {
    /* ignore */
  }
  process.exit(1);
}

const preferredUi =
  Number(process.env.VITE_PORT || process.env.UI_PORT || '') || DEFAULT_UI_DEV_PORT;
const uiPort = await findFreeUiPort(preferredUi, apiPortNum);
if (uiPort !== preferredUi) {
  console.log(`[specflow] Port ${preferredUi} is in use — starting UI on ${uiPort} instead`);
}

console.log('[specflow] API ready — starting UI (Vite)…');
console.log(`[specflow] Open http://localhost:${uiPort} (API proxy → port ${serverPort})`);

ui = runVite(uiPort);

ui.on('exit', (code) => {
  try {
    server.kill('SIGTERM');
  } catch {
    /* ignore */
  }
  process.exit(code ?? 0);
});

server.on('exit', (code, signal) => {
  if (intentionalShutdown) return;
  if (signal === 'SIGTERM' || signal === 'SIGINT') {
    if (ui && !ui.killed) ui.kill('SIGTERM');
    return;
  }
  const cleanCode = code === 0 || code === null || code === 143 || code === 130;
  if (!cleanCode) {
    console.error('[specflow] Server exited with code', code);
    if (ui && !ui.killed) ui.kill('SIGTERM');
    process.exit(code ?? 1);
  }
  if (ui && !ui.killed) ui.kill('SIGTERM');
});
