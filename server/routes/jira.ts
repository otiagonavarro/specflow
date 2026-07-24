import { Router, Request, Response } from 'express';

const router = Router();

interface JiraCreds {
  domain: string;
  email: string;
  token: string;
}

function resolveCreds(_req: Request): JiraCreds | null {
  const domain = process.env.JIRA_DOMAIN;
  const email = process.env.JIRA_EMAIL;
  const token = process.env.JIRA_API_TOKEN;

  if (!domain || !email || !token) return null;
  return { domain: domain.replace(/\/$/, ''), email, token };
}

function authHeader(creds: JiraCreds): string {
  return 'Basic ' + Buffer.from(`${creds.email}:${creds.token}`).toString('base64');
}

async function jiraFetch(creds: JiraCreds, path: string, options: RequestInit = {}) {
  const url = `${creds.domain}/rest/api/3${path}`;
  console.log(`[jira] ${options.method || 'GET'} ${url}`);
  return await fetch(url, {
      ...options,
      headers: {
        'Authorization': authHeader(creds),
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string> || {}),
      },
    });
}

async function jiraAgileFetch(creds: JiraCreds, path: string, options: RequestInit = {}) {
  const p = path.startsWith('/') ? path : `/${path}`;
  const url = `${creds.domain}/rest/agile/1.0${p}`;
  console.log(`[jira] ${options.method || 'GET'} ${url}`);
  return await fetch(url, {
    ...options,
    headers: {
      Authorization: authHeader(creds),
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    },
  });
}

async function agileBoardGet(
  creds: JiraCreds,
  query: Record<string, string>
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const qs = new URLSearchParams(query);
  const jiraRes = await jiraAgileFetch(creds, `/board?${qs.toString()}`);
  const data = (await jiraRes.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: jiraRes.ok, status: jiraRes.status, data };
}

function parseBoardConfigurationColumns(data: Record<string, unknown>): {
  name: string;
  statusNames: string[];
  statusIds: string[];
}[] {
  const columnConfig = data.columnConfig as { columns?: unknown[] } | undefined;
  const cols = Array.isArray(columnConfig?.columns) ? columnConfig!.columns! : [];
  const out: { name: string; statusNames: string[]; statusIds: string[] }[] = [];
  for (const c of cols) {
    if (!c || typeof c !== 'object') continue;
    const col = c as { name?: string; statuses?: unknown[] };
    const name =
      typeof col.name === 'string' && col.name.trim() ? col.name.trim() : 'Column';
    const statusNames: string[] = [];
    const statusIds: string[] = [];
    if (Array.isArray(col.statuses)) {
      for (const s of col.statuses) {
        if (!s || typeof s !== 'object') continue;
        const st = s as { name?: string; id?: string | number };
        if (typeof st.name === 'string' && st.name.trim()) statusNames.push(st.name.trim());
        const idStr = st.id != null ? String(st.id).trim() : '';
        if (idStr) statusIds.push(idStr);
      }
    }
    out.push({ name, statusNames, statusIds });
  }
  return out;
}

function boardsMatchingProject(values: unknown[], projectKey: string): unknown[] {
  const upper = projectKey.toUpperCase();
  return values.filter((b) => {
    const o = b as { location?: { type?: string; projectKey?: string } };
    const loc = o.location;
    return (
      loc?.type === 'project' &&
      typeof loc.projectKey === 'string' &&
      loc.projectKey.toUpperCase() === upper
    );
  });
}

const JIRA_SEARCH_FIELDS = [
  'summary',
  'status',
  'priority',
  'assignee',
  'labels',
  'issuetype',
  'parent',
  'updated',
  'project',
  'description',
  'subtasks',
] as const;

const METRICS_SEARCH_FIELDS = ['created', 'resolutiondate', 'issuetype', 'summary', 'status'] as const;

async function postSearchJqlToAtlassian(
  creds: JiraCreds,
  jql: string,
  maxResults: number,
  nextPageToken?: string,
  fields: readonly string[] = JIRA_SEARCH_FIELDS
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const searchUrl = `${creds.domain}/rest/api/3/search/jql`;
  const postBody: Record<string, unknown> = {
    jql,
    maxResults,
    fields: [...fields],
  };
  if (nextPageToken) postBody.nextPageToken = nextPageToken;

  console.log(`[jira] POST ${searchUrl} (jql search, maxResults=${maxResults})`);

  let jiraRes = await fetch(searchUrl, {
    method: 'POST',
    headers: {
      Authorization: authHeader(creds),
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(postBody),
  });

  let data: unknown = await jiraRes.json();

  if (!jiraRes.ok && jiraRes.status === 400) {
    const errObj = data as { errorMessages?: string[] };
    const msg = errObj?.errorMessages?.[0] || '';
    if (/jql/i.test(msg) && /large|length|long/i.test(msg)) {
      const params = new URLSearchParams();
      params.set('jql', jql);
      params.set('maxResults', String(maxResults));
      for (const f of fields) params.append('fields', f);
      if (nextPageToken) params.set('nextPageToken', nextPageToken);
      console.log('[jira] POST body rejected (jql size); retrying GET with repeated fields params');
      jiraRes = await fetch(`${searchUrl}?${params.toString()}`, {
        method: 'GET',
        headers: {
          Authorization: authHeader(creds),
          Accept: 'application/json',
        },
      });
      data = await jiraRes.json();
    }
  }

  console.log('[jira] issues response:', jiraRes.status, JSON.stringify(data).slice(0, 200));
  return { ok: jiraRes.ok, status: jiraRes.status, data };
}

function escapeJqlQuotedSegment(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function stripJqlOrderBy(jql: string): string {
  return jql.replace(/\s+order\s+by\s+[\s\S]+$/i, '').trim();
}

function normalizeJqlWhitespace(jql: string): string {
  return jql.replace(/\s+/g, ' ').trim();
}

function jqlNarrowsBeyondProjectKey(jql: string): boolean {
  return /\bcf\[\d+\]/i.test(jql);
}

function relaxJqlForResolvedMetrics(jql: string): string {
  let j = normalizeJqlWhitespace(jql);
  if (!j) return j;

  const clauseRemovers: RegExp[] = [
    /\bAND\s+resolution\s+is\s+empty\b/gi,
    /\bAND\s+resolution\s*=\s*unresolved\b/gi,
    /\bAND\s+resolved\s+is\s+empty\b/gi,
    /\bAND\s+unresolved\s*\(\s*\)/gi,
    /\bAND\s+resolution\s+in\s*\(\s*unresolved\s*\)/gi,
    /\bAND\s+sprint\s+in\s+openSprints\s*\(\s*\)/gi,
    /\bAND\s+openSprints\s*\(\s*\)/gi,
    /\bAND\s+statuscategory\s+in\s*\([^)]*\)/gi,
    /\bAND\s+statuscategory\s*(!=|<>)\s*["']?done["']?/gi,
    /\bAND\s+not\s+statuscategory\s*=\s*["']?done["']?/gi,
    /\bAND\s+statuscategory\s+not\s+in\s*\([^)]*\)/gi,
  ];

  for (let iter = 0; iter < 12; iter++) {
    const before = j;
    for (const re of clauseRemovers) {
      j = j.replace(re, ' ');
    }
    j = normalizeJqlWhitespace(j)
      .replace(/^\s*AND\s+/i, '')
      .replace(/\s+AND\s*$/i, '');
    if (j === before) break;
  }

  return normalizeJqlWhitespace(j);
}

function boardJqlLikelyExcludesResolved(jql: string): boolean {
  const j = jql.trim();
  if (!j) return false;
  const lower = j.toLowerCase();
  if (/\bresolution\s+is\s+empty\b/.test(lower)) return true;
  if (/\bresolution\s*=\s*unresolved\b/.test(lower)) return true;
  if (/\bresolved\s+is\s+empty\b/.test(lower)) return true;
  if (/\bunresolved\s*\(\s*\)/.test(lower)) return true;
  if (/\bresolution\s+in\s*\(\s*unresolved\s*\)/.test(lower)) return true;
  if (/statuscategory\s*(!=|<>)\s*["']?done["']?/i.test(j)) return true;
  if (/not\s+statuscategory\s*=\s*["']?done["']?/i.test(j)) return true;
  if (/statuscategory\s+not\s+in\s*\([^)]*\bdone\b/i.test(j)) return true;
  const scIn = j.match(/statuscategory\s+in\s*\(([^)]+)\)/i);
  if (scIn) {
    const inner = scIn[1].toLowerCase().replace(/["']/g, '');
    if (!/\bdone\b/.test(inner) && !/\bcomplete\b/.test(inner)) return true;
  }
  if (/\bsprint\s+in\s+opensprints\b/i.test(j)) return true;
  if (/\bopensprints\s*\(\s*\)/i.test(j)) return true;
  return false;
}

async function resolveBoardBaseJql(
  creds: JiraCreds,
  boardId: string,
  fallbackProjectKey: string
): Promise<{ jql: string; source: 'filter' | 'project_fallback' }> {
  const esc = escapeJqlQuotedSegment(fallbackProjectKey.trim());
  const fallback = `project = "${esc}"`;

  try {
    const cfgRes = await jiraAgileFetch(creds, `/board/${encodeURIComponent(boardId)}/configuration`);
    const cfg = (await cfgRes.json().catch(() => ({}))) as {
      filter?: { id?: string | number };
    };
    if (cfgRes.ok && cfg.filter?.id != null) {
      const fid = String(cfg.filter.id);
      const filterRes = await jiraFetch(creds, `/filter/${encodeURIComponent(fid)}`);
      const fd = (await filterRes.json().catch(() => ({}))) as { jql?: string };
      if (filterRes.ok && typeof fd.jql === 'string' && fd.jql.trim()) {
        return { jql: fd.jql.trim(), source: 'filter' };
      }
    }
  } catch {
    /* use fallback */
  }

  return { jql: fallback, source: 'project_fallback' };
}

async function fetchIssuesPageMetrics(
  creds: JiraCreds,
  jql: string,
  maxResults: number,
  nextPageToken?: string
): Promise<{ ok: boolean; status: number; issues: unknown[]; nextPageToken?: string; isLast: boolean }> {
  const { ok, status, data } = await postSearchJqlToAtlassian(
    creds,
    jql,
    maxResults,
    nextPageToken,
    METRICS_SEARCH_FIELDS
  );
  if (!ok) {
    return { ok: false, status, issues: [], isLast: true };
  }
  const d = data as {
    issues?: unknown[];
    nextPageToken?: string;
    isLast?: boolean;
  };
  const issues = Array.isArray(d.issues) ? d.issues : [];
  const token =
    typeof d.nextPageToken === 'string' && d.nextPageToken.trim() ? d.nextPageToken.trim() : undefined;
  let isLast: boolean;
  if (d.isLast === true) isLast = true;
  else if (d.isLast === false) isLast = false;
  else isLast = !token;
  return { ok: true, status, issues, nextPageToken: token, isLast };
}

function metricsMaxPages(cap: number, pageSize: number): number {
  return Math.min(250, Math.max(20, Math.ceil(cap / pageSize) + 30));
}

async function collectIssuesUpTo(
  creds: JiraCreds,
  jql: string,
  cap: number,
  pageSize: number
): Promise<{ issues: unknown[]; capped: boolean }> {
  const all: unknown[] = [];
  let token: string | undefined;
  let capped = false;
  const pageLimit = metricsMaxPages(cap, pageSize);

  for (let i = 0; i < pageLimit; i++) {
    if (all.length >= cap) break;
    const page = await fetchIssuesPageMetrics(creds, jql, pageSize, token);
    if (!page.ok) break;
    for (const issue of page.issues) {
      if (all.length >= cap) {
        capped = true;
        break;
      }
      all.push(issue);
    }
    if (capped) break;
    if (page.isLast || !page.nextPageToken) break;
    token = page.nextPageToken;
  }

  return { issues: all, capped };
}

async function collectIssuesViaAgileBoard(
  creds: JiraCreds,
  boardId: string,
  cap: number,
  pageSize: number,
  jql?: string
): Promise<{ issues: unknown[]; capped: boolean }> {
  const all: unknown[] = [];
  let startAt = 0;
  let capped = false;
  const jqlTrimmed = typeof jql === 'string' ? jql.trim() : '';

  const pageLimit = metricsMaxPages(cap, pageSize);
  for (let page = 0; page < pageLimit; page++) {
    if (all.length >= cap) break;
    const take = Math.min(pageSize, cap - all.length);
    const params = new URLSearchParams();
    if (jqlTrimmed) params.set('jql', jqlTrimmed);
    params.set('startAt', String(startAt));
    params.set('maxResults', String(take));
    for (const f of METRICS_SEARCH_FIELDS) params.append('fields', f);

    const res = await jiraAgileFetch(
      creds,
      `/board/${encodeURIComponent(boardId)}/issue?${params.toString()}`
    );
    if (!res.ok) {
      console.warn('[jira] board metrics: Agile board/issue request failed', res.status);
      break;
    }

    const data = (await res.json().catch(() => ({}))) as {
      issues?: unknown[];
      total?: number;
      maxResults?: number;
      startAt?: number;
    };
    const issues = Array.isArray(data.issues) ? data.issues : [];
    for (const issue of issues) {
      if (all.length >= cap) {
        capped = true;
        break;
      }
      all.push(issue);
    }
    if (capped) break;

    const total = typeof data.total === 'number' ? data.total : startAt + issues.length;
    startAt += issues.length;
    if (issues.length === 0 || startAt >= total) break;
  }

  return { issues: all, capped };
}

function parseIsoDate(v: unknown): Date | null {
  if (typeof v !== 'string' || !v.trim()) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfWeekUtcMonday(d: Date): Date {
  const x = new Date(d.getTime());
  const day = x.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setUTCDate(x.getUTCDate() + diff);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

function weekLabelEn(d: Date): string {
  const s = startOfWeekUtcMonday(d);
  return s.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function daysBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / 86_400_000;
}

interface RawMetricIssue {
  key: string;
  created: Date | null;
  resolved: Date | null;
  issuetype: string;
}

function mapRawIssue(row: unknown): RawMetricIssue | null {
  const o = row as { key?: string; fields?: Record<string, unknown> };
  if (!o.key || !o.fields) return null;
  const created = parseIsoDate(o.fields.created);
  const resolved = parseIsoDate(o.fields.resolutiondate);
  const issuetype =
    typeof (o.fields.issuetype as { name?: string } | undefined)?.name === 'string'
      ? String((o.fields.issuetype as { name: string }).name)
      : 'Unknown';
  return { key: o.key, created, resolved, issuetype };
}

function filterIssueRowsResolvedInWindow(
  rows: unknown[],
  windowDays: number,
  now: Date
): unknown[] {
  const windowStart = new Date(now.getTime() - windowDays * 86_400_000);
  const out: unknown[] = [];
  for (const row of rows) {
    const m = mapRawIssue(row);
    if (!m?.resolved) continue;
    if (m.resolved < windowStart) continue;
    if (m.resolved.getTime() > now.getTime()) continue;
    out.push(row);
  }
  return out;
}

type BoardMetricsAgg = {
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
};

function aggregateResolvedMetricsInResolutionWindow(
  resolvedRows: RawMetricIssue[],
  now: Date,
  resolutionMin: Date,
  resolutionMax: Date
): BoardMetricsAgg {
  const ms7 = 7 * 86_400_000;
  const ms30 = 30 * 86_400_000;

  const withDates = resolvedRows.filter((r) => r.resolved && r.created);
  const leadDaysList: number[] = [];

  let completedLast7d = 0;
  let completedLast30d = 0;
  let completedInWindow = 0;

  const weekMap = new Map<
    string,
    { label: string; startIso: string; count: number; byType: Record<string, number> }
  >();
  const typeMap = new Map<string, number>();
  const hist = { d1: 0, d3: 0, d7: 0, d14: 0, more: 0 };
  const scatter: Array<{ key: string; resolvedIso: string; leadDays: number }> = [];

  for (const r of withDates) {
    const res = r.resolved!;
    const cre = r.created!;
    if (res < resolutionMin || res > resolutionMax) continue;

    completedInWindow += 1;
    if (now.getTime() - res.getTime() <= ms7) completedLast7d += 1;
    if (now.getTime() - res.getTime() <= ms30) completedLast30d += 1;

    const ld = daysBetween(cre, res);
    if (ld >= 0 && Number.isFinite(ld)) {
      leadDaysList.push(ld);
      if (ld <= 1) hist.d1 += 1;
      else if (ld <= 3) hist.d3 += 1;
      else if (ld <= 7) hist.d7 += 1;
      else if (ld <= 14) hist.d14 += 1;
      else hist.more += 1;
      if (scatter.length < 400) {
        scatter.push({ key: r.key, resolvedIso: res.toISOString(), leadDays: Math.round(ld * 10) / 10 });
      }
    }

    const wk = startOfWeekUtcMonday(res);
    const wkKey = wk.toISOString().slice(0, 10);
    const prev = weekMap.get(wkKey) || { label: weekLabelEn(res), startIso: wkKey, count: 0, byType: {} };
    prev.count += 1;
    prev.byType[r.issuetype] = (prev.byType[r.issuetype] || 0) + 1;
    weekMap.set(wkKey, prev);

    typeMap.set(r.issuetype, (typeMap.get(r.issuetype) || 0) + 1);
  }

  leadDaysList.sort((a, b) => a - b);
  const medianLeadTimeDays =
    leadDaysList.length === 0
      ? null
      : leadDaysList.length % 2 === 1
        ? leadDaysList[(leadDaysList.length - 1) / 2]
        : (leadDaysList[leadDaysList.length / 2 - 1] + leadDaysList[leadDaysList.length / 2]) / 2;
  const avgLeadTimeDays =
    leadDaysList.length === 0 ? null : leadDaysList.reduce((a, b) => a + b, 0) / leadDaysList.length;

  const throughputByWeek = [...weekMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => ({ weekLabel: v.label, weekStartIso: v.startIso, count: v.count, byType: v.byType }));

  const leadTimeHistogram = [
    { bucket: '≤1d', count: hist.d1 },
    { bucket: '1–3d', count: hist.d3 },
    { bucket: '3–7d', count: hist.d7 },
    { bucket: '7–14d', count: hist.d14 },
    { bucket: '14d+', count: hist.more },
  ];

  const byIssueType = [...typeMap.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);

  return {
    completedLast7d,
    completedLast30d,
    completedInWindow,
    avgLeadTimeDays: avgLeadTimeDays != null ? Math.round(avgLeadTimeDays * 10) / 10 : null,
    medianLeadTimeDays: medianLeadTimeDays != null ? Math.round(medianLeadTimeDays * 10) / 10 : null,
    throughputByWeek,
    leadTimeHistogram,
    byIssueType,
    scatter,
  };
}

function aggregateBoardMetrics(resolvedRows: RawMetricIssue[], now: Date, windowDays: number): BoardMetricsAgg {
  const resolutionMin = new Date(now.getTime() - windowDays * 86_400_000);
  return aggregateResolvedMetricsInResolutionWindow(resolvedRows, now, resolutionMin, now);
}

interface ActiveSprintSummary {
  id: number;
  name: string;
  start: Date | null;
  end: Date | null;
}

async function fetchActiveSprintForBoard(
  creds: JiraCreds,
  boardId: string
): Promise<ActiveSprintSummary | null> {
  const res = await jiraAgileFetch(
    creds,
    `/board/${encodeURIComponent(boardId)}/sprint?state=active&maxResults=50`
  );
  if (!res.ok) return null;
  const data = (await res.json().catch(() => ({}))) as {
    values?: Array<{ id?: number; name?: string; startDate?: string; endDate?: string }>;
  };
  const v = Array.isArray(data.values) ? data.values[0] : undefined;
  if (!v || v.id == null) return null;
  return {
    id: Number(v.id),
    name: typeof v.name === 'string' && v.name.trim() ? v.name.trim() : `Sprint ${v.id}`,
    start: parseIsoDate(v.startDate),
    end: parseIsoDate(v.endDate),
  };
}

async function collectIssuesInActiveSprint(
  creds: JiraCreds,
  boardId: string,
  sprintId: number,
  cap: number,
  pageSize: number
): Promise<{ issues: unknown[]; capped: boolean }> {
  const all: unknown[] = [];
  let startAt = 0;
  let capped = false;
  const sid = encodeURIComponent(String(sprintId));
  const bid = encodeURIComponent(boardId);

  const pageLimit = metricsMaxPages(cap, pageSize);
  for (let page = 0; page < pageLimit; page++) {
    if (all.length >= cap) break;
    const take = Math.min(pageSize, cap - all.length);
    const params = new URLSearchParams();
    params.set('startAt', String(startAt));
    params.set('maxResults', String(take));
    for (const f of METRICS_SEARCH_FIELDS) params.append('fields', f);

    const res = await jiraAgileFetch(
      creds,
      `/board/${bid}/sprint/${sid}/issue?${params.toString()}`
    );
    if (!res.ok) {
      console.warn('[jira] board metrics: sprint issues request failed', res.status);
      break;
    }

    const data = (await res.json().catch(() => ({}))) as {
      issues?: unknown[];
      total?: number;
    };
    const issues = Array.isArray(data.issues) ? data.issues : [];
    for (const issue of issues) {
      if (all.length >= cap) {
        capped = true;
        break;
      }
      all.push(issue);
    }
    if (capped) break;

    const total = typeof data.total === 'number' ? data.total : startAt + issues.length;
    startAt += issues.length;
    if (issues.length === 0 || startAt >= total) break;
  }

  return { issues: all, capped };
}

router.get('/myself', async (req: Request, res: Response) => {
  const creds = resolveCreds(req);
  if (!creds) return res.status(401).json({ error: 'Jira credentials not configured' });

  try {
    const jiraRes = await jiraFetch(creds, '/myself');
    const data = await jiraRes.json();
    if (!jiraRes.ok) return res.status(jiraRes.status).json(data);
    res.json(data);
  } catch (err) {
    console.error('[jira] myself error:', err);
    res.status(502).json({ error: 'Failed to reach Jira', detail: String(err) });
  }
});

router.get('/issue/:issueKey', async (req: Request, res: Response) => {
  const creds = resolveCreds(req);
  if (!creds) return res.status(401).json({ error: 'Jira credentials not configured' });

  const issueKey = encodeURIComponent(req.params.issueKey);
  const fields = [
    'summary',
    'status',
    'priority',
    'assignee',
    'labels',
    'issuetype',
    'parent',
    'updated',
    'project',
    'description',
    'subtasks',
  ].join(',');

  try {
    const jiraRes = await jiraFetch(creds, `/issue/${issueKey}?fields=${fields}&expand=renderedFields`);
    const data = await jiraRes.json();
    if (!jiraRes.ok) return res.status(jiraRes.status).json(data);
    res.json(data);
  } catch (err) {
    console.error('[jira] fetch error:', err);
    res.status(502).json({ error: 'Failed to reach Jira', detail: String(err) });
  }
});

router.get('/issues', async (req: Request, res: Response) => {
  const creds = resolveCreds(req);
  if (!creds) return res.status(401).json({ error: 'Jira credentials not configured' });

  const jql = (req.query.jql as string) || 'ORDER BY updated DESC';
  const maxResults = Number(req.query.maxResults) || 50;
  const nextPageToken = (req.query.nextPageToken as string) || undefined;

  try {
    const { ok, status, data } = await postSearchJqlToAtlassian(creds, jql, maxResults, nextPageToken);
    if (!ok) return res.status(status).json(data);
    res.json(data);
  } catch (err) {
    console.error('[jira] fetch error:', err);
    res.status(502).json({ error: 'Failed to reach Jira', detail: String(err) });
  }
});

router.post('/issues/jql', async (req: Request, res: Response) => {
  const creds = resolveCreds(req);
  if (!creds) return res.status(401).json({ error: 'Jira credentials not configured' });

  const jql = typeof req.body?.jql === 'string' ? req.body.jql.trim() : '';
  if (!jql) return res.status(400).json({ error: 'Missing body.jql' });

  const rawMax = Number(req.body?.maxResults);
  const maxResults = Number.isFinite(rawMax) ? Math.min(500, Math.max(1, rawMax)) : 100;
  const nextPageToken =
    typeof req.body?.nextPageToken === 'string' && req.body.nextPageToken.trim()
      ? req.body.nextPageToken.trim()
      : undefined;

  try {
    const { ok, status, data } = await postSearchJqlToAtlassian(creds, jql, maxResults, nextPageToken);
    if (!ok) return res.status(status).json(data);
    res.json(data);
  } catch (err) {
    console.error('[jira] fetch error:', err);
    res.status(502).json({ error: 'Failed to reach Jira', detail: String(err) });
  }
});

router.post('/issues', async (req: Request, res: Response) => {
  const creds = resolveCreds(req);
  if (!creds) return res.status(401).json({ error: 'Jira credentials not configured' });

  try {
    const jiraRes = await jiraFetch(creds, '/issue', {
      method: 'POST',
      body: JSON.stringify(req.body),
    });
    const data = await jiraRes.json();
    if (!jiraRes.ok) return res.status(jiraRes.status).json(data);
    res.status(201).json(data);
  } catch (err) {
    console.error('[jira] fetch error:', err);
    res.status(502).json({ error: 'Failed to reach Jira', detail: String(err) });
  }
});

router.get('/transitions/:issueKey', async (req: Request, res: Response) => {
  const creds = resolveCreds(req);
  if (!creds) return res.status(401).json({ error: 'Jira credentials not configured' });

  try {
    const jiraRes = await jiraFetch(creds, `/issue/${req.params.issueKey}/transitions`);
    const data = await jiraRes.json();
    if (!jiraRes.ok) return res.status(jiraRes.status).json(data);
    res.json(data);
  } catch (err) {
    console.error('[jira] fetch error:', err);
    res.status(502).json({ error: 'Failed to reach Jira', detail: String(err) });
  }
});

router.post('/transitions/:issueKey', async (req: Request, res: Response) => {
  const creds = resolveCreds(req);
  if (!creds) return res.status(401).json({ error: 'Jira credentials not configured' });

  try {
    const jiraRes = await jiraFetch(creds, `/issue/${req.params.issueKey}/transitions`, {
      method: 'POST',
      body: JSON.stringify(req.body),
    });
    if (!jiraRes.ok) {
      const data = await jiraRes.json();
      return res.status(jiraRes.status).json(data);
    }
    res.status(204).send();
  } catch (err) {
    console.error('[jira] fetch error:', err);
    res.status(502).json({ error: 'Failed to reach Jira', detail: String(err) });
  }
});

router.get('/board/:boardId/scope-jql', async (req: Request, res: Response) => {
  const creds = resolveCreds(req);
  if (!creds) return res.status(401).json({ error: 'Jira credentials not configured' });

  const boardId = String(req.params.boardId || '').trim();
  const projectKey =
    String(req.query.projectKey ?? '').trim() || String(process.env.JIRA_PROJECT_KEY ?? '').trim();
  if (!boardId) return res.status(400).json({ error: 'Missing board id' });
  if (!projectKey) {
    return res.status(400).json({
      error: 'Missing projectKey query parameter (set default project in Settings or JIRA_PROJECT_KEY)',
    });
  }

  try {
    const { jql, source } = await resolveBoardBaseJql(creds, boardId, projectKey);
    res.json({ jql, source });
  } catch (err) {
    console.error('[jira] board scope-jql error:', err);
    res.status(502).json({ error: 'Failed to reach Jira', detail: String(err) });
  }
});

router.get('/board/:boardId/columns', async (req: Request, res: Response) => {
  const creds = resolveCreds(req);
  if (!creds) return res.status(401).json({ error: 'Jira credentials not configured' });

  const boardId = String(req.params.boardId || '').trim();
  if (!boardId) return res.status(400).json({ error: 'Missing board id' });

  try {
    const jiraRes = await jiraAgileFetch(creds, `/board/${encodeURIComponent(boardId)}/configuration`);
    const data = (await jiraRes.json().catch(() => ({}))) as Record<string, unknown>;
    if (!jiraRes.ok) {
      const msg =
        (Array.isArray(data.errorMessages) && typeof data.errorMessages[0] === 'string'
          ? data.errorMessages[0]
          : null) ||
        (typeof data.message === 'string' ? data.message : '') ||
        `Jira error ${jiraRes.status}`;
      return res.status(jiraRes.status >= 400 && jiraRes.status < 600 ? jiraRes.status : 502).json({
        error: msg,
      });
    }
    const columns = parseBoardConfigurationColumns(data);
    res.json({ columns });
  } catch (err) {
    console.error('[jira] board columns error:', err);
    res.status(502).json({ error: 'Failed to reach Jira', detail: String(err) });
  }
});

router.get('/board/:boardId/metrics', async (req: Request, res: Response) => {
  const creds = resolveCreds(req);
  if (!creds) return res.status(401).json({ error: 'Jira credentials not configured' });

  const boardId = String(req.params.boardId || '').trim();
  const projectKey = String(req.query.projectKey || '').trim();
  if (!boardId) return res.status(400).json({ error: 'Missing board id' });
  if (!projectKey) return res.status(400).json({ error: 'Missing projectKey query parameter' });

  const rawDays = Number(req.query.days);
  const windowDays = Number.isFinite(rawDays) ? Math.min(1095, Math.max(7, rawDays)) : 365;
  const rawCap = Number(req.query.maxSamples);
  const cap = Number.isFinite(rawCap)
    ? Math.min(15_000, Math.max(500, Math.round(rawCap)))
    : Math.min(12_000, Math.max(2500, Math.round(windowDays * 40)));
  const pageSize = 100;

  try {
    const { jql: baseJql, source } = await resolveBoardBaseJql(creds, boardId, projectKey);
    const core = stripJqlOrderBy(baseJql);
    if (!core) {
      return res.status(400).json({ error: 'Empty board JQL scope' });
    }

    const metricsNow = new Date();

    const activeSprint = await fetchActiveSprintForBoard(creds, boardId);
    if (activeSprint) {
      const { issues: sprintIssues, capped: sprintCapped } = await collectIssuesInActiveSprint(
        creds,
        boardId,
        activeSprint.id,
        cap,
        pageSize
      );
      const resStart =
        activeSprint.start ?? new Date(metricsNow.getTime() - 42 * 86_400_000);
      const resEnd =
        activeSprint.end != null && activeSprint.end < metricsNow ? activeSprint.end : metricsNow;

      const sprintResolvedRows: RawMetricIssue[] = [];
      let openInSprint = 0;
      for (const row of sprintIssues) {
        const m = mapRawIssue(row);
        if (!m) continue;
        if (!m.resolved) {
          openInSprint += 1;
          continue;
        }
        if (m.resolved >= resStart && m.resolved <= resEnd) {
          sprintResolvedRows.push(m);
        }
      }

      const agg = aggregateResolvedMetricsInResolutionWindow(
        sprintResolvedRows,
        metricsNow,
        resStart,
        resEnd
      );
      const nominalWindowDays = Math.max(
        1,
        Math.ceil((resEnd.getTime() - resStart.getTime()) / 86_400_000)
      );

      console.log(
        '[jira] board metrics: active sprint view',
        activeSprint.id,
        activeSprint.name,
        'sprintIssues',
        sprintIssues.length,
        'open',
        openInSprint,
        'resolvedInSprintWindow',
        sprintResolvedRows.length
      );

      return res.json({
        boardId: Number(boardId),
        metricsView: 'active_sprint',
        activeSprint: {
          id: activeSprint.id,
          name: activeSprint.name,
          startIso: activeSprint.start ? activeSprint.start.toISOString() : null,
          endIso: activeSprint.end ? activeSprint.end.toISOString() : null,
        },
        windowDays: nominalWindowDays,
        sampleCap: cap,
        baseJqlSource: source,
        resolvedMetricsScope: 'board_filter',
        sampledResolved: sprintResolvedRows.length,
        capped: sprintCapped,
        openIssuesSample: Math.min(openInSprint, 100),
        openInSprint,
        openIssuesHasMore: openInSprint > 100 || sprintIssues.length >= cap,
        ...agg,
      });
    }

    const openJql = `(${core}) AND resolution IS EMPTY`;
    const openPage = await fetchIssuesPageMetrics(creds, openJql, 100);
    const openIssuesSample = openPage.ok ? openPage.issues.length : 0;
    const openIssuesHasMore = openPage.ok && openPage.issues.length >= 100 && !openPage.isLast;

    const escPk = escapeJqlQuotedSegment(projectKey);
    const projectOnlyCore = `project = "${escPk}"`;

    let resolvedMetricsScope: 'board_filter' | 'project' = 'board_filter';
    let resolvedJql = `(${core}) AND resolved >= -${windowDays}d ORDER BY resolutiondate DESC`;
    let { issues: rawResolved, capped } = await collectIssuesUpTo(creds, resolvedJql, cap, pageSize);

    const openHasIssues = openPage.ok && openPage.issues.length > 0;
    const normalizedCore = normalizeJqlWhitespace(core).toLowerCase();
    const normalizedProject = normalizeJqlWhitespace(projectOnlyCore).toLowerCase();
    const coreIsProjectOnly = normalizedCore === normalizedProject;

    const firstPassResolvedEmpty = rawResolved.length === 0;
    const shouldWidenResolvedScope =
      firstPassResolvedEmpty &&
      openHasIssues &&
      source === 'filter' &&
      !coreIsProjectOnly &&
      boardJqlLikelyExcludesResolved(core);

    const allowProjectWideResolvedFallback =
      coreIsProjectOnly || !jqlNarrowsBeyondProjectKey(core);

    if (firstPassResolvedEmpty && openHasIssues && source === 'filter' && !coreIsProjectOnly) {
      const relaxedCore = relaxJqlForResolvedMetrics(core);
      const relaxedNorm = normalizeJqlWhitespace(relaxedCore).toLowerCase();
      if (relaxedNorm && relaxedNorm !== normalizedCore) {
        resolvedJql = `(${relaxedCore}) AND resolved >= -${windowDays}d ORDER BY resolutiondate DESC`;
        const relaxedCollect = await collectIssuesUpTo(creds, resolvedJql, cap, pageSize);
        if (relaxedCollect.issues.length > 0) {
          rawResolved = relaxedCollect.issues;
          capped = relaxedCollect.capped;
          resolvedMetricsScope = 'board_filter';
          console.log(
            '[jira] board metrics: using relaxed board JQL (open-only clauses stripped) for resolved work'
          );
        }
      }
    }

    if (rawResolved.length === 0 && openHasIssues && source === 'filter' && !coreIsProjectOnly) {
      const agileResolvedJql = `resolved >= -${windowDays}d ORDER BY resolutiondate DESC`;
      const agile = await collectIssuesViaAgileBoard(
        creds,
        boardId,
        cap,
        pageSize,
        agileResolvedJql
      );
      if (agile.issues.length > 0) {
        rawResolved = agile.issues;
        capped = agile.capped;
        resolvedMetricsScope = 'board_filter';
        console.log(
          '[jira] board metrics: using Agile board/{id}/issue for resolved work (per-board scope)'
        );
      }
    }

    if (rawResolved.length === 0 && openHasIssues && source === 'filter' && !coreIsProjectOnly) {
      const bulk = await collectIssuesViaAgileBoard(creds, boardId, cap, pageSize);
      const scoped = filterIssueRowsResolvedInWindow(bulk.issues, windowDays, metricsNow);
      if (scoped.length > 0) {
        rawResolved = scoped;
        capped = bulk.capped;
        resolvedMetricsScope = 'board_filter';
        console.log(
          '[jira] board metrics: Agile board/{id}/issue without JQL, filtered by resolutiondate in window'
        );
      }
    }

    if (rawResolved.length === 0 && shouldWidenResolvedScope && allowProjectWideResolvedFallback) {
      console.warn(
        '[jira] board metrics: board filter excludes resolved work and Agile board issues returned none; using project scope for throughput/lead time'
      );
      resolvedMetricsScope = 'project';
      resolvedJql = `(${projectOnlyCore}) AND resolved >= -${windowDays}d ORDER BY resolutiondate DESC`;
      const second = await collectIssuesUpTo(creds, resolvedJql, cap, pageSize);
      rawResolved = second.issues;
      capped = second.capped;
    } else if (
      rawResolved.length === 0 &&
      openHasIssues &&
      source === 'filter' &&
      !coreIsProjectOnly &&
      allowProjectWideResolvedFallback
    ) {
      const probeJql = `(${projectOnlyCore}) AND resolved >= -${windowDays}d ORDER BY resolutiondate DESC`;
      const probe = await fetchIssuesPageMetrics(creds, probeJql, 1);
      if (probe.ok && probe.issues.length > 0) {
        console.warn(
          '[jira] board metrics: 0 resolved with board-scoped JQL / Agile; project has resolved issues in window; using project scope for throughput/lead time'
        );
        resolvedMetricsScope = 'project';
        resolvedJql = probeJql;
        const second = await collectIssuesUpTo(creds, resolvedJql, cap, pageSize);
        rawResolved = second.issues;
        capped = second.capped;
      } else {
        console.warn(
          '[jira] board metrics: 0 resolved in window for this board filter (per-board scope). Board JQL (truncated):',
          core.slice(0, 320)
        );
      }
    } else if (
      rawResolved.length === 0 &&
      openHasIssues &&
      source === 'filter' &&
      !coreIsProjectOnly &&
      !allowProjectWideResolvedFallback
    ) {
      console.warn(
        '[jira] board metrics: 0 resolved in window for squad/team-scoped filter (cf[...]); skipping project-wide fallback so metrics stay board-specific. Board JQL (truncated):',
        core.slice(0, 320)
      );
    }

    const resolvedRows: RawMetricIssue[] = [];
    for (const row of rawResolved) {
      const m = mapRawIssue(row);
      if (m?.resolved) resolvedRows.push(m);
    }

    const agg = aggregateBoardMetrics(resolvedRows, metricsNow, windowDays);

    res.json({
      boardId: Number(boardId),
      metricsView: 'rolling_window',
      activeSprint: null,
      windowDays,
      sampleCap: cap,
      baseJqlSource: source,
      resolvedMetricsScope,
      sampledResolved: resolvedRows.length,
      capped,
      openIssuesSample,
      openIssuesHasMore,
      ...agg,
    });
  } catch (err) {
    console.error('[jira] board metrics error:', err);
    res.status(502).json({ error: 'Failed to compute board metrics', detail: String(err) });
  }
});

router.get('/boards', async (req: Request, res: Response) => {
  const creds = resolveCreds(req);
  if (!creds) return res.status(401).json({ error: 'Jira credentials not configured' });

  const projectKey = String(req.query.projectKey || '').trim();
  const pageSize = 50;
  const tryFallbackOn = new Set([400, 403, 404]);

  try {
    if (!projectKey) {
      const collected: unknown[] = [];
      let startAt = 0;
      const maxPages = 40;
      let sawOkPage = false;
      for (let page = 0; page < maxPages; page++) {
        const pageRes = await agileBoardGet(creds, {
          maxResults: String(pageSize),
          startAt: String(startAt),
        });
        if (!pageRes.ok) {
          if (!sawOkPage) {
            return res.status(pageRes.status).json(pageRes.data);
          }
          break;
        }
        sawOkPage = true;
        const values = Array.isArray(pageRes.data.values) ? pageRes.data.values : [];
        collected.push(...values);
        if (pageRes.data.isLast === true || values.length < pageSize) break;
        startAt += pageSize;
      }
      res.json({
        maxResults: collected.length,
        startAt: 0,
        total: collected.length,
        isLast: true,
        values: collected,
      });
      return;
    }

    let { ok, status, data } = await agileBoardGet(creds, {
      projectKeyOrId: projectKey,
      maxResults: String(pageSize),
      startAt: '0',
    });

    if (ok) {
      res.json(data);
      return;
    }

    if (tryFallbackOn.has(status)) {
      const projRes = await jiraFetch(creds, `/project/${encodeURIComponent(projectKey)}`);
      const proj = (await projRes.json().catch(() => ({}))) as { id?: string | number };
      if (projRes.ok && proj.id != null && String(proj.id) !== projectKey) {
        const second = await agileBoardGet(creds, {
          projectKeyOrId: String(proj.id),
          maxResults: String(pageSize),
          startAt: '0',
        });
        if (second.ok) {
          console.log('[jira] boards: using numeric project id for projectKeyOrId');
          res.json(second.data);
          return;
        }
        ({ ok, status, data } = second);
      }

      console.warn(
        `[jira] boards project filter failed (${status}), listing accessible boards and filtering by ${projectKey}`
      );
      const collected: unknown[] = [];
      let startAt = 0;
      let sawOkPage = false;

      for (let page = 0; page < 20; page++) {
        const pageRes = await agileBoardGet(creds, {
          maxResults: String(pageSize),
          startAt: String(startAt),
        });
        if (!pageRes.ok) {
          console.warn('[jira] boards unfiltered page:', pageRes.status, 'startAt=', startAt);
          break;
        }
        sawOkPage = true;
        const values = Array.isArray(pageRes.data.values) ? pageRes.data.values : [];
        collected.push(...boardsMatchingProject(values, projectKey));
        const isLast = pageRes.data.isLast === true;
        if (isLast || values.length < pageSize) break;
        startAt += pageSize;
      }

      if (sawOkPage) {
        res.json({
          maxResults: collected.length,
          startAt: 0,
          total: collected.length,
          isLast: true,
          values: collected,
        });
        return;
      }
    }

    if (!ok) {
      res.status(status).json(data);
      return;
    }
    res.json(data);
  } catch (err) {
    console.error('[jira] boards fetch error:', err);
    res.status(502).json({ error: 'Failed to reach Jira', detail: String(err) });
  }
});

router.get('/project/:projectKey', async (req: Request, res: Response) => {
  const creds = resolveCreds(req);
  if (!creds) return res.status(401).json({ error: 'Jira credentials not configured' });

  const projectKey = String(req.params.projectKey || '').trim();
  if (!projectKey) {
    return res.status(400).json({ error: 'Missing project key' });
  }

  try {
    const jiraRes = await jiraFetch(creds, `/project/${encodeURIComponent(projectKey)}`);
    const data = await jiraRes.json();
    if (!jiraRes.ok) return res.status(jiraRes.status).json(data);
    res.json(data);
  } catch (err) {
    console.error('[jira] project by key error:', err);
    res.status(502).json({ error: 'Failed to reach Jira', detail: String(err) });
  }
});

router.get('/projects', async (req: Request, res: Response) => {
  const creds = resolveCreds(req);
  if (!creds) return res.status(401).json({ error: 'Jira credentials not configured' });

  try {
    const jiraRes = await jiraFetch(creds, '/project/search?maxResults=50');
    const data = await jiraRes.json();
    if (!jiraRes.ok) return res.status(jiraRes.status).json(data);
    res.json(data);
  } catch (err) {
    console.error('[jira] fetch error:', err);
    res.status(502).json({ error: 'Failed to reach Jira', detail: String(err) });
  }
});

router.get('/avatar-proxy', async (req: Request, res: Response) => {
  const creds = resolveCreds(req);
  if (!creds) return res.status(401).json({ error: 'Jira credentials not configured' });

  const url = req.query.url as string;
  if (!url) return res.status(400).json({ error: 'Missing url parameter' });

  if (!url.startsWith(creds.domain)) {
    return res.status(403).json({ error: 'URL not from configured Jira domain' });
  }

  try {
    const imgRes = await fetch(url, {
      headers: { 'Authorization': authHeader(creds) },
    });
    if (!imgRes.ok) return res.status(imgRes.status).send();

    const contentType = imgRes.headers.get('content-type') || 'image/png';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600');

    const buffer = await imgRes.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (err) {
    res.status(502).json({ error: 'Failed to fetch avatar', detail: String(err) });
  }
});

export default router;
