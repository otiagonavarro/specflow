import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

export const JIRA_ENV_KEYS = [
  'JIRA_DOMAIN',
  'JIRA_EMAIL',
  'JIRA_API_TOKEN',
  'JIRA_PROJECT_KEY',
  'JIRA_BOARD_ID',
] as const;

export const GITHUB_ENV_KEYS = [
  'GITHUB_TOKEN',
  'GITHUB_REPOS',
  'GITHUB_REPO',
  'LOCAL_REPOS_ROOT',
] as const;

export const LLM_ENV_KEYS = ['LLM_PROVIDER', 'LLM_API_KEY', 'LLM_MODEL'] as const;

export function getEnvFilePath(): string {
  return path.join(process.cwd(), '.env');
}

export function parseEnvFile(content: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    let key = t.slice(0, eq).trim();
    if (key.startsWith('export ')) key = key.slice(7).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
      val = val.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\'/g, "'");
    }
    out[key] = val;
  }
  return out;
}

function quoteValue(v: string): string {
  return `"${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

export function serializeEnvFile(env: Record<string, string>): string {
  const keys = Object.keys(env).sort();
  const header = [
    '# This file may be updated by specflow (Settings → Integrations).',
    '# Do not commit secrets — keep .env in .gitignore.',
    '',
  ];
  const body = keys.map((k) => `${k}=${quoteValue(env[k] ?? '')}`);
  return `${header.join('\n')}${body.join('\n')}\n`;
}

export function readEnvMap(): Record<string, string> {
  const p = getEnvFilePath();
  try {
    return parseEnvFile(fs.readFileSync(p, 'utf8'));
  } catch {
    return {};
  }
}

export function writeEnvMap(env: Record<string, string>): void {
  fs.writeFileSync(getEnvFilePath(), serializeEnvFile(env), 'utf8');
}

export function deleteKeys(env: Record<string, string>, keys: readonly string[]): void {
  for (const k of keys) delete env[k];
}

export function reloadDotenv(): void {
  dotenv.config({ path: getEnvFilePath(), override: true });
}
