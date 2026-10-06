import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export type IdeLauncherId = 'cursor' | 'vscode' | 'antigravity' | 'kiro';

const MAC_APPS: Record<IdeLauncherId, { appPath: string; cliRel: string; openName: string }> = {
  cursor: {
    appPath: '/Applications/Cursor.app',
    cliRel: 'Contents/Resources/app/bin/cursor',
    openName: 'Cursor',
  },
  vscode: {
    appPath: '/Applications/Visual Studio Code.app',
    cliRel: 'Contents/Resources/app/bin/code',
    openName: 'Visual Studio Code',
  },
  antigravity: {
    appPath: '/Applications/Antigravity IDE.app',
    cliRel: 'Contents/Resources/app/bin/antigravity-ide',
    openName: 'Antigravity IDE',
  },
  kiro: {
    appPath: '/Applications/Kiro.app',
    // Kiro ships its bundled CLI under the VS Code name.
    cliRel: 'Contents/Resources/app/bin/code',
    openName: 'Kiro',
  },
};

/** CLI name on PATH (non-macOS installs, or when the app bundle is elsewhere). */
const CLI_NAMES: Record<IdeLauncherId, string> = {
  cursor: 'cursor',
  vscode: 'code',
  antigravity: 'antigravity-ide',
  kiro: 'kiro',
};

function resolveCliBinary(ide: IdeLauncherId): string | null {
  const spec = MAC_APPS[ide];
  const embedded = path.join(spec.appPath, spec.cliRel);
  if (fs.existsSync(embedded)) return embedded;

  return CLI_NAMES[ide];
}

function runDetached(command: string, args: string[]): Promise<{ ok: true } | { ok: false; message: string }> {
  return new Promise((resolve) => {
    const label = `${command} ${args.join(' ')}`;
    try {
      const child = spawn(command, args, {
        detached: true,
        stdio: 'ignore',
        env: process.env,
      });

      child.once('error', (err) => {
        resolve({ ok: false, message: `${label}: ${err.message}` });
      });

      child.once('spawn', () => {
        child.unref();
        resolve({ ok: true });
      });
    } catch (err) {
      resolve({ ok: false, message: `${label}: ${err instanceof Error ? err.message : String(err)}` });
    }
  });
}

/** macOS fallback when CLI spawn fails — must pass folder via --args. */
async function launchMacOpenApp(
  ide: IdeLauncherId,
  folderPath: string,
  newWindow: boolean,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const spec = MAC_APPS[ide];
  if (!fs.existsSync(spec.appPath)) {
    return { ok: false, message: `${spec.openName} not found at ${spec.appPath}` };
  }

  const openArgs = newWindow
    ? ['-na', spec.openName, '--args', '-n', folderPath]
    : ['-a', spec.openName, '--args', folderPath];

  return runDetached('open', openArgs);
}

async function launchWithEditorCli(
  ide: IdeLauncherId,
  folderPath: string,
  newWindow: boolean,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const bin = resolveCliBinary(ide);
  if (!bin) {
    return { ok: false, message: `${ide} CLI not found.` };
  }

  const args = newWindow ? ['-n', folderPath] : [folderPath];
  const primary = await runDetached(bin, args);
  if (primary.ok) return primary;

  if (process.platform === 'darwin') {
    const fallback = await launchMacOpenApp(ide, folderPath, newWindow);
    if (fallback.ok) return fallback;
    const parts = [
      primary.ok === false ? primary.message : '',
      fallback.ok === false ? fallback.message : '',
    ].filter(Boolean);
    return { ok: false, message: parts.join('; ') || 'Failed to launch IDE.' };
  }

  return primary;
}

export async function launchIdeFolder(
  ide: IdeLauncherId,
  folderPath: string,
  options?: { newWindow?: boolean },
): Promise<{ ok: true } | { ok: false; message: string }> {
  const abs = path.resolve(folderPath);
  if (!fs.existsSync(abs)) {
    return { ok: false, message: `Path does not exist: ${abs}` };
  }
  if (!fs.statSync(abs).isDirectory()) {
    return { ok: false, message: `Not a directory: ${abs}` };
  }

  const newWindow = options?.newWindow !== false;

  if (ide in MAC_APPS) {
    if (process.platform === 'win32') {
      return runDetached(CLI_NAMES[ide], newWindow ? ['-n', abs] : [abs]);
    }
    return launchWithEditorCli(ide, abs, newWindow);
  }

  return { ok: false, message: `IDE "${ide}" must be opened via URL handler from the browser.` };
}
