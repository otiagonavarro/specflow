import type { Issue } from '../api/types';
import { jiraStatusSortWeight } from './jiraStatusUi';

export type BoardColumnDef = { name: string; statusNames: string[]; statusIds?: string[] };

export type BoardColumnModel = { key: string; header: string; issues: Issue[] };

function normalizeStatusName(name: string): string {
  return name.trim().normalize('NFC').toLowerCase();
}

export function fallbackColumnsFromIssues(issues: Issue[]): BoardColumnDef[] {
  const seen = new Set<string>();
  const order: string[] = [];
  const nameToId = new Map<string, string>();
  for (const i of issues) {
    const s = (i.status || '—').trim() || '—';
    if (!seen.has(s)) {
      seen.add(s);
      order.push(s);
    }
    if (i.statusId && !nameToId.has(s)) nameToId.set(s, i.statusId);
  }
  order.sort((a, b) => {
    const dw = jiraStatusSortWeight(a) - jiraStatusSortWeight(b);
    if (dw !== 0) return dw;
    return a.localeCompare(b, undefined, { sensitivity: 'base' });
  });
  return order.map((name) => ({
    name,
    statusNames: [name],
    statusIds: nameToId.has(name) ? [nameToId.get(name)!] : [],
  }));
}

export function buildBoardColumnModel(
  columnDefs: BoardColumnDef[],
  issues: Issue[],
  otherHeader: string
): BoardColumnModel[] {
  const idToColKey = new Map<string, string>();
  const exactNameToColKey = new Map<string, string>();
  const normNameToColKey = new Map<string, string>();
  const meta: { key: string; header: string }[] = [];

  columnDefs.forEach((col, idx) => {
    const key = `c-${idx}`;
    meta.push({ key, header: (col.name || `Column ${idx + 1}`).trim() || `Column ${idx + 1}` });

    for (const rawId of col.statusIds ?? []) {
      const id = String(rawId).trim();
      if (id && !idToColKey.has(id)) idToColKey.set(id, key);
    }
    for (const sn of col.statusNames) {
      const t = typeof sn === 'string' ? sn.trim() : '';
      if (!t) continue;
      if (!exactNameToColKey.has(t)) exactNameToColKey.set(t, key);
      const nk = normalizeStatusName(t);
      if (!normNameToColKey.has(nk)) normNameToColKey.set(nk, key);
    }
  });

  const buckets = new Map<string, Issue[]>();
  for (const m of meta) buckets.set(m.key, []);
  const unmatched: Issue[] = [];

  for (const issue of issues) {
    const st = (issue.status || '—').trim() || '—';
    let colKey: string | undefined;
    if (issue.statusId) colKey = idToColKey.get(issue.statusId);
    if (!colKey) colKey = exactNameToColKey.get(st) ?? normNameToColKey.get(normalizeStatusName(st));
    if (colKey) {
      buckets.get(colKey)!.push(issue);
    } else {
      unmatched.push(issue);
    }
  }

  const result: BoardColumnModel[] = meta.map((m) => ({
    key: m.key,
    header: m.header,
    issues: buckets.get(m.key) || [],
  }));

  if (unmatched.length > 0) {
    result.push({ key: 'other', header: otherHeader, issues: unmatched });
  }
  return result;
}
