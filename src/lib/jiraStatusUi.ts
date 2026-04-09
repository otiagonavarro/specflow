import type { ElementType } from 'react';
import { Circle, Clock, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

export type JiraStatusCategory =
  | 'todo'
  | 'in_progress'
  | 'review'
  | 'done'
  | 'cancelled'
  | 'blocked'
  | 'other';

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

export function categorizeJiraStatus(name: string): JiraStatusCategory {
  const s = norm(name.trim() || '—');
  if (!s || s === '—') return 'other';

  if (s.includes('blocked') || s.includes('bloquead') || s.includes('impediment')) return 'blocked';
  if (
    s.includes('cancel') ||
    s.includes('cancelad') ||
    s.includes("won't") ||
    s.includes('wont') ||
    s.includes('descart')
  )
    return 'cancelled';
  if (
    s.includes('done') ||
    s.includes('conclu') ||
    s.includes('closed') ||
    s.includes('resolved') ||
    s.includes('complete') ||
    s.includes('fechad') ||
    s.includes('finaliz')
  )
    return 'done';
  if (
    s.includes('review') ||
    s.includes('validation') ||
    s.includes('validacao') ||
    s.includes('qa') ||
    s.includes('testing') ||
    s.includes('teste')
  )
    return 'review';
  if (s.includes('progress') || s.includes('progresso') || s.includes('doing') || s.includes('andamento'))
    return 'in_progress';
  if (
    s.includes('todo') ||
    s.includes('to do') ||
    s.includes('backlog') ||
    s.includes('prioriz') ||
    s.includes('open') ||
    s.includes('aberto') ||
    s.includes('pendente') ||
    s.includes('planej')
  )
    return 'todo';

  return 'other';
}

const CATEGORY_PRESENTATION: Record<
  JiraStatusCategory,
  { icon: ElementType; className: string; dotColor: string }
> = {
  todo: { icon: Circle, className: 'text-zinc-500', dotColor: '#71717a' },
  in_progress: { icon: Clock, className: 'text-primary', dotColor: '#bdc2ff' },
  review: { icon: AlertCircle, className: 'text-secondary', dotColor: '#bec4ed' },
  done: { icon: CheckCircle2, className: 'text-tertiary', dotColor: '#bec2ff' },
  cancelled: { icon: XCircle, className: 'text-zinc-600', dotColor: '#52525b' },
  blocked: { icon: XCircle, className: 'text-error', dotColor: '#ffb4ab' },
  other: { icon: Circle, className: 'text-zinc-500', dotColor: '#71717a' },
};

export function jiraStatusPresentation(name: string) {
  return CATEGORY_PRESENTATION[categorizeJiraStatus(name)];
}

const SORT_ORDER: JiraStatusCategory[] = [
  'todo',
  'in_progress',
  'review',
  'blocked',
  'done',
  'cancelled',
  'other',
];

export function jiraStatusSortWeight(name: string): number {
  return SORT_ORDER.indexOf(categorizeJiraStatus(name));
}

export function isJiraStatusDoneLike(name: string): boolean {
  const c = categorizeJiraStatus(name);
  return c === 'done' || c === 'cancelled';
}
