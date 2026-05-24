import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export type IdeLauncherId = 'cursor' | 'vscode';

const MAC_APPS: Record<'cursor' | 'vscode', { appPath: string; cliRel: string; openName: string }> = {
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
};

function resolveCliBinary(ide: 'cursor' | 'vscode'): string | null {
  const spec = MAC_APPS[ide];
  const embedded = path.join(spec.appPath, spec.cliRel);
  if (fs.existsSync(embedded)) return embedded;

  return ide === 'cursor' ? 'cursor' : 'code';
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
  ide: 'cursor' | 'vscode',
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
  ide: 'cursor' | 'vscode',
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

  if (ide === 'cursor' || ide === 'vscode') {
    if (process.platform === 'win32') {
      const cmd = ide === 'cursor' ? 'cursor' : 'code';
      return runDetached(cmd, newWindow ? ['-n', abs] : [abs]);
    }
    return launchWithEditorCli(ide, abs, newWindow);
  }

  return { ok: false, message: `IDE "${ide}" must be opened via URL handler from the browser.` };
}
