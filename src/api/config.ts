import type { IntegrationConfig, IntegrationSavePayload, LlmProvider } from './types';

const DEFAULT_LLM: IntegrationConfig['llm'] = { provider: 'nvidia', model: '', apiKeyConfigured: false };

let clientCache: IntegrationConfig = { jira: null, github: null, llm: DEFAULT_LLM };

function normalizeJira(j: unknown): IntegrationConfig['jira'] {
  if (!j || typeof j !== 'object') return null;
  const o = j as Record<string, unknown>;
  const domain = typeof o.domain === 'string' ? o.domain.trim() : '';
  const email = typeof o.email === 'string' ? o.email.trim() : '';
  if (!domain || !email) return null;
  const token = typeof o.token === 'string' ? o.token : '';
  const tokenConfigured = o.tokenConfigured === true;
  const projectKey = typeof o.projectKey === 'string' ? o.projectKey.trim() : '';
  const boardRaw = typeof o.boardId === 'string' ? o.boardId.trim() : '';
  return {
    domain: domain.replace(/\/$/, ''),
    email,
    token,
    tokenConfigured,
    projectKey,
    boardId: boardRaw || undefined,
  };
}

function normalizeGithub(gh: unknown): IntegrationConfig['github'] {
  if (!gh || typeof gh !== 'object') return null;
  const g = gh as { localReposPath?: string };
  const localReposPath = typeof g.localReposPath === 'string' ? g.localReposPath.trim() : '';
  if (!localReposPath) return null;
  return { localReposPath };
}

function normalizeLlm(l: unknown): IntegrationConfig['llm'] {
  if (!l || typeof l !== 'object') return DEFAULT_LLM;
  const o = l as Record<string, unknown>;
  const provider: LlmProvider =
    o.provider === 'openai' || o.provider === 'anthropic' ? o.provider : 'nvidia';
  const model = typeof o.model === 'string' ? o.model : '';
  const apiKeyConfigured = o.apiKeyConfigured === true;
  return { provider, model, apiKeyConfigured };
}

function normalizeConfig(parsed: { jira?: unknown; github?: unknown; llm?: unknown }): IntegrationConfig {
  return {
    jira: normalizeJira(parsed.jira),
    github: normalizeGithub(parsed.github),
    llm: normalizeLlm(parsed.llm),
  };
}

export function getConfig(): IntegrationConfig {
  return clientCache;
}

export function clearConfig(): void {
  clientCache = { jira: null, github: null, llm: DEFAULT_LLM };
}

export function isJiraConfigured(): boolean {
  const { jira } = clientCache;
  return !!(jira?.domain && jira?.email && (jira.token || jira.tokenConfigured));
}

export function isGithubConfigured(): boolean {
  const p = clientCache.github?.localReposPath?.trim();
  return !!p;
}

export function buildJiraHeaders(): Record<string, string> {
  return {};
}

export function buildGithubHeaders(): Record<string, string> {
  return {};
}

export async function loadConfigFromServer(): Promise<IntegrationConfig> {
  try {
    const res = await fetch('/api/config');
    if (!res.ok) {
      clearConfig();
      return clientCache;
    }
    const data = await res.json();
    const normalized = normalizeConfig(data as { jira?: unknown; github?: unknown; llm?: unknown });
    clientCache = normalized;
    return normalized;
  } catch {
    clearConfig();
    return clientCache;
  }
}

export async function saveIntegrationPayload(payload: IntegrationSavePayload): Promise<void> {
  const res = await fetch('/api/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(errBody || `Failed to save config (${res.status})`);
  }
}

export async function clearConfigFromServer(): Promise<void> {
  const res = await fetch('/api/config', { method: 'DELETE' });
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(errBody || `Failed to clear config (${res.status})`);
  }
}

export async function saveJiraBoardIdOnly(boardId: string): Promise<void> {
  const j = clientCache.jira;
  if (!j) throw new Error('Jira is not configured');

  const res = await fetch('/api/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jira: {
        domain: j.domain,
        email: j.email,
        projectKey: j.projectKey,
        boardId: boardId.trim(),
      },
    }),
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(errBody || `Failed to save board (${res.status})`);
  }
  await loadConfigFromServer();
}
