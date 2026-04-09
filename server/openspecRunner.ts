import { spawn, type ChildProcess } from 'node:child_process';

const MAX_OUTPUT_CHARS = 900_000;
const DEFAULT_TIMEOUT_MS = 180_000;

export function getOpenspecExecutable(): { cmd: string; argsPrefix: string[] } {
  const p = process.env.OPENSPEC_CLI_PATH?.trim();
  if (p) return { cmd: p, argsPrefix: [] };
  return { cmd: 'npx', argsPrefix: ['--yes', '@fission-ai/openspec@latest'] };
}

export function isValidChangeName(name: string): boolean {
  return /^[a-z0-9][a-z0-9-]{0,79}$/.test(name);
}

export function sanitizeDescription(s: string): string {
  return s.replace(/\s+/g, ' ').trim().slice(0, 2000);
}

export type OpenspecRunResult = {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  spawnError?: string;
  timedOut?: boolean;
};

export async function runOpenspecCli(
  cwd: string,
  subArgs: string[],
  options?: { timeoutMs?: number },
): Promise<OpenspecRunResult> {
  const { cmd, argsPrefix } = getOpenspecExecutable();
  const args = [...argsPrefix, ...subArgs];
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let oversize = false;

    const child: ChildProcess = spawn(cmd, args, {
      cwd,
      env: { ...process.env },
      shell: false,
      windowsHide: true,
    });

    const timer = setTimeout(() => {
      child.kill('SIGTERM');
    }, timeoutMs);

    const append = (buf: Buffer, which: 'out' | 'err') => {
      const chunk = buf.toString();
      if (which === 'out') {
        stdout += chunk;
        if (stdout.length > MAX_OUTPUT_CHARS) oversize = true;
      } else {
        stderr += chunk;
        if (stderr.length > MAX_OUTPUT_CHARS) oversize = true;
      }
      if (oversize) {
        child.kill('SIGTERM');
      }
    };

    child.stdout?.on('data', (d) => append(d as Buffer, 'out'));
    child.stderr?.on('data', (d) => append(d as Buffer, 'err'));

    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({
        exitCode: null,
        signal: null,
        stdout,
        stderr,
        spawnError: err.message,
      });
    });

    child.on('close', (exitCode, signal) => {
      clearTimeout(timer);
      const timedOut = signal === 'SIGTERM' && exitCode === null;
      if (oversize) {
        resolve({
          exitCode: exitCode ?? 1,
          signal,
          stdout: `${stdout}\n[output truncated — exceeded limit]`,
          stderr,
          timedOut: false,
        });
        return;
      }
      resolve({
        exitCode,
        signal,
        stdout,
        stderr,
        timedOut,
      });
    });
  });
}

export function parseChangesFromListJson(stdout: string): { names: string[]; parseError: boolean } {
  let t = stdout.trim();
  if (!t) return { names: [], parseError: false };
  const first = t.indexOf('{');
  const last = t.lastIndexOf('}');
  if (first >= 0 && last > first) {
    t = t.slice(first, last + 1);
  }
  try {
    const o = JSON.parse(t) as { changes?: unknown };
    const ch = o.changes;
    if (!Array.isArray(ch)) return { names: [], parseError: true };
    const names = ch
      .map((x) => {
        if (x && typeof x === 'object' && 'name' in x && typeof (x as { name: unknown }).name === 'string') {
          return (x as { name: string }).name;
        }
        return '';
      })
      .filter(Boolean);
    return { names, parseError: false };
  } catch {
    return { names: [], parseError: true };
  }
}
