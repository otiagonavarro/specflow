import type { Issue, JiraProject, JiraTransition, Priority } from './types';
import { buildJiraHeaders, getConfig, isJiraConfigured } from './config';

const cache = new Map<string, { data: Issue[]; ts: number }>();
const CACHE_TTL_MS = 30_000;

function cached(key: string): Issue[] | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) { cache.delete(key); return null; }
  return entry.data;
}

export function escapeJqlQuoted(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export const DEFAULT_JQL_PAGE_SIZE = 25;

export interface IssuesJqlPageResult {
  issues: Issue[];
  isLast: boolean;
  nextPageToken?: string;
}

function parseJiraErrorPayload(data: Record<string, unknown>): string {
  return (
    (Array.isArray(data.errorMessages) && typeof data.errorMessages[0] === 'string'
      ? data.errorMessages[0]
      : null) ||
    (data.errors && typeof data.errors === 'object'
      ? String(Object.values(data.errors as Record<string, string>)[0] || '')
      : '') ||
    (typeof data.error === 'string' ? data.error : '') ||
    ''
  );
}

async function postJqlSearch(
  jql: string,
  maxResults: number,
  nextPageToken?: string
): Promise<{ issues: unknown[]; isLast: boolean; nextPageToken?: string }> {
  const body: Record<string, unknown> = { jql, maxResults };
  if (nextPageToken) body.nextPageToken = nextPageToken;

  const res = await fetch('/api/jira/issues/jql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...buildJiraHeaders() },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(parseJiraErrorPayload(data) || `Jira error ${res.status}`);
  }

  const issues = Array.isArray(data.issues) ? data.issues : [];
  const token =
    typeof data.nextPageToken === 'string' && data.nextPageToken.trim() ? data.nextPageToken.trim() : undefined;
  let isLast: boolean;
  if (data.isLast === true) isLast = true;
  else if (data.isLast === false) isLast = false;
  else isLast = !token;

  return { issues, isLast, nextPageToken: token };
}

function jiraStatusFromApi(raw: unknown): string {
  if (typeof raw !== 'string') return '—';
  const t = raw.trim();
  return t || '—';
}

function mapPriority(jiraPriority: string): Priority {
  const p = jiraPriority?.toLowerCase() || '';
  if (p === 'highest' || p === 'critical' || p === 'blocker') return 'Critical';
  if (p === 'high') return 'High';
  if (p === 'low' || p === 'lowest' || p === 'trivial') return 'Low';
  return 'Medium';
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function proxiedJiraAvatarUrl(rawUrl: string | null | undefined): string | null {
  if (!rawUrl) return null;
  return `/api/jira/avatar-proxy?url=${encodeURIComponent(rawUrl)}`;
}

function adfToPlainText(doc: unknown): string {
  if (!doc || typeof doc !== 'object') return '';
  const root = doc as { content?: unknown[] };
  if (!Array.isArray(root.content)) return '';
  return root.content
    .map(block => blockToText(block))
    .filter(Boolean)
    .join('\n\n')
    .trim();
}

function blockToText(node: unknown): string {
  if (!node || typeof node !== 'object') return '';
  const n = node as { type?: string; text?: string; content?: unknown[] };
  if (n.type === 'text' && typeof n.text === 'string') return n.text;
  if (n.type === 'hardBreak') return '\n';
  if (Array.isArray(n.content)) return n.content.map(inlineToText).join('');
  return '';
}

function inlineToText(node: unknown): string {
  if (!node || typeof node !== 'object') return '';
  const n = node as { type?: string; text?: string; content?: unknown[] };
  if (n.type === 'text' && typeof n.text === 'string') return n.text;
  if (n.type === 'hardBreak') return '\n';
  if (Array.isArray(n.content)) return n.content.map(inlineToText).join('');
  return '';
}

export interface IssueSubtaskRef {
  key: string;
  summary: string;
  status: string;
  jiraUrl: string;
}

export interface IssueDetailExtras {
  descriptionPlain: string;
  issueTypeName: string;
  subtasks: IssueSubtaskRef[];
}

function parseSubtasksFromFields(fields: Record<string, unknown>, domain: string): IssueSubtaskRef[] {
  const raw = fields.subtasks;
  if (!Array.isArray(raw)) return [];
  const base = domain.replace(/\/$/, '');
  const out: IssueSubtaskRef[] = [];
  for (const st of raw) {
    if (!st || typeof st !== 'object') continue;
    const o = st as { key?: string; fields?: Record<string, unknown> };
    const key = typeof o.key === 'string' ? o.key.trim() : '';
    if (!key) continue;
    const f = o.fields || {};
    const statusObj = f.status as { name?: string } | undefined;
    const summary = typeof f.summary === 'string' && f.summary.trim() ? f.summary.trim() : '(untitled)';
    out.push({
      key,
      summary,
      status: jiraStatusFromApi(statusObj?.name),
      jiraUrl: base ? `${base}/browse/${encodeURIComponent(key)}` : '#',
    });
  }
  return out;
}

export async function fetchIssueDetail(issueKey: string): Promise<IssueDetailExtras | null> {
  if (!isJiraConfigured()) return null;

  const res = await fetch(`/api/jira/issue/${encodeURIComponent(issueKey)}`, {
    headers: buildJiraHeaders(),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err.errorMessages?.[0] || err.error || `Jira error ${res.status}`;
    throw new Error(typeof msg === 'string' ? msg : 'Failed to load issue');
  }

  const data = await res.json();
  const fields = (data.fields || {}) as Record<string, unknown>;
  const rendered = (data.renderedFields || {}) as { description?: string };
  let descriptionPlain = adfToPlainText(fields.description);
  if (!descriptionPlain && typeof rendered.description === 'string') {
    descriptionPlain = rendered.description.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  const domain = getConfig().jira?.domain || '';

  return {
    descriptionPlain,
    issueTypeName: (fields.issuetype as { name?: string } | undefined)?.name || '',
    subtasks: parseSubtasksFromFields(fields, domain),
  };
}

function mapIssue(raw: any): Issue {
  const fields = raw.fields || {};
  const parentKey = fields.parent?.key || fields.epic?.key || '';
  const parentName = fields.parent?.fields?.summary || fields.epic?.name || fields.project?.name || '';
  const label = (fields.labels?.[0] || fields.issuetype?.name || 'TASK').toUpperCase();
  const {subtasks} = fields;
  const subtaskCount = Array.isArray(subtasks) ? subtasks.length : 0;

  const statusField = fields.status as { name?: string; id?: string | number } | undefined;
  const statusIdRaw = statusField?.id != null ? String(statusField.id).trim() : '';

  return {
    id: raw.id,
    code: raw.key,
    title: fields.summary || '(untitled)',
    status: jiraStatusFromApi(statusField?.name),
    ...(statusIdRaw ? { statusId: statusIdRaw } : {}),
    priority: mapPriority(fields.priority?.name || ''),
    epic: parentName,
    epicCode: parentKey,
    assignee: fields.assignee?.displayName || null,
    assigneeAvatar: proxiedJiraAvatarUrl(fields.assignee?.avatarUrls?.['48x48']),
    label,
    updatedAt: formatRelativeTime(fields.updated),
    projectName: fields.project?.name || undefined,
    jiraUrl: `${getConfig().jira?.domain}/browse/${raw.key}`,
    ...(subtaskCount > 0 ? { subtaskCount } : {}),
  };
}

export async function fetchIssuesPage(
  jql: string,
  options?: { maxResults?: number; nextPageToken?: string }
): Promise<IssuesJqlPageResult> {
  const maxResults = options?.maxResults ?? DEFAULT_JQL_PAGE_SIZE;
  const raw = await postJqlSearch(jql, maxResults, options?.nextPageToken);
  return {
    issues: raw.issues.map((row) => mapIssue(row)),
    isLast: raw.isLast,
    nextPageToken: raw.nextPageToken,
  };
}

export function jqlEpicsForProject(projectKey: string): string {
  return `project = "${escapeJqlQuoted(projectKey)}" AND issuetype = Epic ORDER BY updated DESC`;
}

export function jqlAllEpics(): string {
  return 'issuetype = Epic ORDER BY updated DESC';
}

export function jqlIssuesUnderEpic(epicKey: string): string {
  return `parent = "${escapeJqlQuoted(epicKey)}" ORDER BY updated DESC`;
}

export function stripTrailingJqlOrderBy(jql: string): string {
  return jql.replace(/\s+ORDER\s+BY[\s\S]+$/i, '').trim();
}

export function intersectJqlWithBoardScope(boardScopeJql: string | null | undefined, innerJql: string | null): string | null {
  if (!innerJql?.trim()) return null;
  const scope = boardScopeJql?.trim();
  if (!scope) return innerJql;
  const a = stripTrailingJqlOrderBy(scope);
  const b = stripTrailingJqlOrderBy(innerJql);
  if (!a || !b) return innerJql;
  return `(${a}) AND (${b}) ORDER BY updated DESC`;
}

export async function fetchBoardScopeJql(
  boardId: string,
  projectKey: string
): Promise<{ jql: string; source: 'filter' | 'project_fallback' }> {
  const qs = new URLSearchParams({ projectKey: projectKey.trim() });
  const res = await fetch(`/api/jira/board/${encodeURIComponent(boardId)}/scope-jql?${qs}`, {
    headers: buildJiraHeaders(),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(parseJiraErrorPayload(data) || `Failed to load board scope (${res.status})`);
  }
  const jql = typeof data.jql === 'string' ? data.jql.trim() : '';
  if (!jql) throw new Error('Empty board JQL from server');
  const source = data.source === 'project_fallback' ? 'project_fallback' : 'filter';
  return { jql, source };
}

export function jqlDefaultProjectIssues(): string {
  return 'project IS NOT EMPTY ORDER BY updated DESC';
}

export function buildProjectIssuesJql(projectKey: string, opts?: { summaryContains?: string }): string {
  const pk = escapeJqlQuoted(projectKey.trim());
  let jql = `project = "${pk}"`;
  const q = opts?.summaryContains?.trim();
  if (q) {
    const esc = escapeJqlQuoted(q);
    const upper = esc.toUpperCase();
    jql += ` AND (summary ~ "${esc}*" OR key = "${upper}")`;
  }
  return `${jql} ORDER BY updated DESC`;
}

export function buildAllIssuesJql(opts?: { summaryContains?: string }): string {
  const q = opts?.summaryContains?.trim();
  if (q) {
    const esc = escapeJqlQuoted(q);
    const upper = esc.toUpperCase();
    return `(summary ~ "${esc}*" OR key = "${upper}") ORDER BY updated DESC`;
  }
  return 'project IS NOT EMPTY ORDER BY updated DESC';
}

export function buildAssigneeIssuesJql(opts?: { summaryContains?: string }): string {
  let jql = 'assignee = currentUser()';
  const q = opts?.summaryContains?.trim();
  if (q) {
    const esc = escapeJqlQuoted(q);
    const upper = esc.toUpperCase();
    jql += ` AND (summary ~ "${esc}*" OR key = "${upper}")`;
  }
  return `${jql} ORDER BY updated DESC`;
}

export async function fetchIssues(jql?: string): Promise<Issue[]> {
  const query = jql?.trim() || jqlDefaultProjectIssues();
  if (!query) {
    throw new Error('Configure o Jira em Configurações → Integrações para listar issues.');
  }

  const cached_ = cached(query);
  if (cached_) return cached_;

  const all: Issue[] = [];
  let token: string | undefined;
  const pageSize = 50;
  for (let i = 0; i < 60; i++) {
    const page = await fetchIssuesPage(query, { maxResults: pageSize, nextPageToken: token });
    all.push(...page.issues);
    if (page.isLast) break;
    if (!page.nextPageToken) break;
    token = page.nextPageToken;
  }
  cache.set(query, { data: all, ts: Date.now() });
  return all;
}

export function invalidateCache(): void {
  cache.clear();
}

export async function createIssue(payload: {
  summary: string;
  description?: string;
  projectKey: string;
  issueType?: string;
  priority?: string;
  epicKey?: string;
}): Promise<Issue> {
  const body: any = {
    fields: {
      project: { key: payload.projectKey },
      summary: payload.summary,
      issuetype: { name: payload.issueType || 'Task' },
      priority: { name: payload.priority || 'Medium' },
    },
  };

  if (payload.description) {
    body.fields.description = {
      type: 'doc',
      version: 1,
      content: [{ type: 'paragraph', content: [{ type: 'text', text: payload.description }] }],
    };
  }

  if (payload.epicKey) {
    body.fields.parent = { key: payload.epicKey };
  }

  const res = await fetch('/api/jira/issues', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...buildJiraHeaders() },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err.errors ? Object.values(err.errors).join('; ') : `Jira error ${res.status}`;
    throw new Error(msg);
  }

  const created = await res.json();
  invalidateCache();

  try {
    const full = await postJqlSearch(`key = "${escapeJqlQuoted(created.key)}"`, 1);
    if (full.issues?.[0]) return mapIssue(full.issues[0]);
  } catch {
  }

  return {
    id: created.id,
    code: created.key,
    title: payload.summary,
    status: '—',
    priority: mapPriority(payload.priority || 'Medium'),
    epic: '',
    epicCode: payload.epicKey || '',
    assignee: null,
    assigneeAvatar: null,
    label: 'TASK',
    updatedAt: 'just now',
    jiraUrl: `${getConfig().jira?.domain}/browse/${created.key}`,
  };
}

export async function fetchTransitions(issueKey: string): Promise<JiraTransition[]> {
  const res = await fetch(`/api/jira/transitions/${issueKey}`, { headers: buildJiraHeaders() });
  if (!res.ok) throw new Error(`Failed to fetch transitions for ${issueKey}`);
  const data = await res.json();
  return data.transitions || [];
}

export async function transitionIssue(issueKey: string, transitionId: string): Promise<void> {
  const res = await fetch(`/api/jira/transitions/${issueKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...buildJiraHeaders() },
    body: JSON.stringify({ transition: { id: transitionId } }),
  });
  if (!res.ok && res.status !== 204) throw new Error(`Transition failed for ${issueKey}`);
  invalidateCache();
}

function mapJiraProjectPayload(p: Record<string, unknown>): JiraProject {
  return {
    id: String(p.id ?? ''),
    key: String(p.key ?? ''),
    name: String(p.name ?? p.key ?? ''),
    avatarUrl: (p.avatarUrls as Record<string, string> | undefined)?.['48x48'],
  };
}

export async function fetchJiraProjectByKey(projectKey: string): Promise<JiraProject | null> {
  const key = projectKey.trim();
  if (!key) return null;
  const res = await fetch(`/api/jira/project/${encodeURIComponent(key)}`, { headers: buildJiraHeaders() });
  if (!res.ok) return null;
  const p = (await res.json()) as Record<string, unknown>;
  return mapJiraProjectPayload(p);
}

export async function fetchProjects(): Promise<JiraProject[]> {
  const res = await fetch('/api/jira/projects', { headers: buildJiraHeaders() });
  if (!res.ok) throw new Error(`Failed to fetch Jira projects (${res.status})`);
  const data = await res.json();
  return (data.values || []).map((p: any) => mapJiraProjectPayload(p));
}

export interface JiraBoardSummary {
  id: number;
  name: string;
  type: string;
  projectKey?: string;
  projectName?: string;
}

export interface JiraBoardColumn {
  name: string;
  statusNames: string[];
  /** Status ids from Agile board configuration (same as `fields.status.id` on issues). */
  statusIds: string[];
}

export async function fetchBoardColumns(boardId: string): Promise<JiraBoardColumn[]> {
  const id = boardId.trim();
  if (!id) return [];
  const res = await fetch(`/api/jira/board/${encodeURIComponent(id)}/columns`, {
    headers: buildJiraHeaders(),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(parseJiraErrorPayload(data) || `Failed to load board columns (${res.status})`);
  }
  const cols = data.columns;
  if (!Array.isArray(cols)) return [];
  const out: JiraBoardColumn[] = [];
  for (const c of cols) {
    if (!c || typeof c !== 'object') continue;
    const o = c as { name?: unknown; statusNames?: unknown; statusIds?: unknown };
    const name = typeof o.name === 'string' ? o.name.trim() : '';
    const statusNames = Array.isArray(o.statusNames)
      ? o.statusNames
          .filter((x): x is string => typeof x === 'string' && !!x.trim())
          .map((x) => x.trim())
      : [];
    const statusIds = Array.isArray(o.statusIds)
      ? o.statusIds
          .filter((x): x is string => typeof x === 'string' && !!x.trim())
          .map((x) => x.trim())
      : [];
    if (name || statusNames.length || statusIds.length) {
      out.push({ name: name || 'Column', statusNames, statusIds });
    }
  }
  return out;
}

export interface BoardMetricsPayload {
  boardId: number;
  metricsView?: 'active_sprint' | 'rolling_window';
  activeSprint?: {
    id: number;
    name: string;
    startIso: string | null;
    endIso: string | null;
  } | null;
  openInSprint?: number;
  windowDays: number;
  baseJqlSource: 'filter' | 'project_fallback';
  resolvedMetricsScope: 'board_filter' | 'project';
  sampledResolved: number;
  capped: boolean;
  openIssuesSample: number;
  openIssuesHasMore: boolean;
  /** Max issues fetched for resolved metrics (pagination stops here). */
  sampleCap?: number;
  completedLast7d: number;
  completedLast30d: number;
  completedInWindow: number;
  avgLeadTimeDays: number | null;
  medianLeadTimeDays: number | null;
  throughputByWeek: Array<{
    weekLabel: string;
    weekStartIso: string;
    count: number;
    byType: Record<string, number>;
  }>;
  leadTimeHistogram: Array<{ bucket: string; count: number }>;
  byIssueType: Array<{ type: string; count: number }>;
  scatter: Array<{ key: string; resolvedIso: string; leadDays: number }>;
}

export async function fetchBoardMetrics(
  boardId: number,
  projectKey: string,
  days = 365,
  maxSamples?: number
): Promise<BoardMetricsPayload> {
  const qs = new URLSearchParams({
    projectKey: projectKey.trim(),
    days: String(days),
  });
  if (maxSamples != null && Number.isFinite(maxSamples)) {
    qs.set('maxSamples', String(Math.round(maxSamples)));
  }
  const res = await fetch(`/api/jira/board/${encodeURIComponent(String(boardId))}/metrics?${qs}`, {
    headers: buildJiraHeaders(),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(parseJiraErrorPayload(data) || `Failed to load board metrics (${res.status})`);
  }
  return data as unknown as BoardMetricsPayload;
}

function parseAgileError(data: Record<string, unknown>): string {
  return (
    (Array.isArray(data.errorMessages) && typeof data.errorMessages[0] === 'string'
      ? data.errorMessages[0]
      : '') ||
    (typeof data.message === 'string' ? data.message : '') ||
    ''
  );
}

export async function fetchJiraBoards(projectKey?: string): Promise<JiraBoardSummary[]> {
  const pk = projectKey?.trim();
  const url = pk
    ? `/api/jira/boards?projectKey=${encodeURIComponent(pk)}`
    : '/api/jira/boards';
  const res = await fetch(url, {
    headers: buildJiraHeaders(),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(parseAgileError(data) || `Failed to load boards (${res.status})`);
  }
  const values = Array.isArray(data.values) ? data.values : [];
  return values.map((b: unknown) => {
    const o = b as Record<string, unknown>;
    const loc = o.location as Record<string, unknown> | undefined;
    return {
      id: Number(o.id),
      name: String(o.name ?? 'Board'),
      type: String(o.type ?? 'unknown'),
      projectKey: typeof loc?.projectKey === 'string' ? loc.projectKey : undefined,
      projectName: typeof loc?.projectName === 'string' ? loc.projectName : undefined,
    };
  });
}

export function jiraSoftwareBoardUrl(domain: string, projectKey: string, boardId: number): string {
  const base = domain.replace(/\/$/, '');
  return `${base}/jira/software/c/projects/${encodeURIComponent(projectKey)}/boards/${boardId}`;
}

export interface JiraMyself {
  displayName: string;
  emailAddress?: string;
  avatarUrl: string | null;
}

export async function fetchJiraMyself(): Promise<JiraMyself | null> {
  if (!isJiraConfigured()) return null;
  const res = await fetch('/api/jira/myself', { headers: buildJiraHeaders() });
  if (!res.ok) return null;
  const d = (await res.json().catch(() => ({}))) as {
    displayName?: string;
    emailAddress?: string;
    avatarUrls?: Record<string, string>;
  };
  return {
    displayName: typeof d.displayName === 'string' && d.displayName.trim() ? d.displayName.trim() : 'User',
    emailAddress: typeof d.emailAddress === 'string' ? d.emailAddress : undefined,
    avatarUrl: proxiedJiraAvatarUrl(d.avatarUrls?.['48x48'] ?? d.avatarUrls?.['24x24']),
  };
}
