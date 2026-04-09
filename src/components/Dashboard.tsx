import { useMemo, useState } from 'react';
import { Filter, MoreHorizontal, X, Loader } from 'lucide-react';
import { motion } from 'motion/react';
import type { Issue } from '../api/types';
import { getConfig, isJiraConfigured } from '../api/config';
import { intersectJqlWithBoardScope, jqlAllEpics, jqlEpicsForProject } from '../api/jira';
import { useJiraJqlPages } from '../hooks/useIssues';
import { useDefaultBoardScopeJql } from '../hooks/useBoardScope';
import { categorizeJiraStatus, isJiraStatusDoneLike } from '../lib/jiraStatusUi';
import { useLocale, interpolate } from '../locales';
import PaginationBar from './PaginationBar';
import { AvatarImage } from './AvatarImage';

export interface DashboardEpic {
  id: string;
  name: string;
  code: string;
  category: string;
  status: 'Active' | 'In Review' | 'Blocked' | 'Planning';
  progress: number;
  assignees: Array<{ avatarUrl: string | null; name: string }>;
  color: string;
}

function colorForKey(key: string): string {
  const colors = ['#bdc2ff', '#bec4ed', '#bec2ff', '#5e6ad2', '#ffb4ab'];
  let h = 0;
  for (let i = 0; i < key.length; i++) h = key.charCodeAt(i) + ((h << 5) - h);
  return colors[Math.abs(h) % colors.length];
}

function epicStatusFromIssue(status: string): DashboardEpic['status'] {
  const cat = categorizeJiraStatus(status);
  if (cat === 'blocked') return 'Blocked';
  if (cat === 'review') return 'In Review';
  if (cat === 'done' || cat === 'cancelled') return 'Planning';
  return 'Active';
}

function issueToDashboardEpic(issue: Issue): DashboardEpic {
  const assignees =
    issue.assignee != null
      ? [{ avatarUrl: issue.assigneeAvatar ?? null, name: issue.assignee }]
      : [];
  return {
    id: issue.id,
    name: issue.title,
    code: issue.code,
    category: issue.projectName || issue.epic || 'Project',
    status: epicStatusFromIssue(issue.status),
    progress: isJiraStatusDoneLike(issue.status) ? 100 : 0,
    assignees,
    color: colorForKey(issue.code),
  };
}

const BOARD_COLUMNS: DashboardEpic['status'][] = ['Active', 'In Review', 'Blocked', 'Planning'];

interface DashboardProps {
  onEpicClick: (epic: DashboardEpic) => void;
}

export default function Dashboard({ onEpicClick }: DashboardProps) {
  const { t } = useLocale();
  const [viewMode, setViewMode] = useState<'list' | 'board'>('list');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | DashboardEpic['status']>('all');
  const [filterText, setFilterText] = useState('');

  const configured = isJiraConfigured();
  const pk = getConfig().jira?.projectKey?.trim() ?? '';
  const boardScope = useDefaultBoardScopeJql(pk);
  const defaultBoardId = getConfig().jira?.boardId?.trim() ?? '';
  const waitingBoardScope = configured && !!defaultBoardId && !!pk && !boardScope.ready;

  const epicJqlRaw = configured ? (pk ? jqlEpicsForProject(pk) : jqlAllEpics()) : null;
  const epicJql = useMemo(
    () => (epicJqlRaw ? intersectJqlWithBoardScope(boardScope.baseJql, epicJqlRaw) : null),
    [epicJqlRaw, boardScope.baseJql]
  );

  const {
    issues: pageIssues,
    allLoadedIssues,
    loading,
    loadingMore,
    error,
    needsConfig,
    refetch,
    pageIndex,
    canGoPrev,
    canGoNext,
    goPrevPage,
    goNextPage,
  } = useJiraJqlPages(waitingBoardScope ? null : epicJql);

  const listSource = viewMode === 'board' ? allLoadedIssues : pageIssues;
  const filteredIssues = useMemo(() => {
    let next = listSource;
    if (filterStatus !== 'all') {
      next = next.filter((i) => epicStatusFromIssue(i.status) === filterStatus);
    }
    const q = filterText.trim().toLowerCase();
    if (q) {
      next = next.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          i.code.toLowerCase().includes(q) ||
          (i.projectName || '').toLowerCase().includes(q)
      );
    }
    return next;
  }, [listSource, filterStatus, filterText]);

  const epicsForList = useMemo(() => filteredIssues.map(issueToDashboardEpic), [filteredIssues]);

  const allEpicsForStats = useMemo(() => {
    let next = allLoadedIssues;
    if (filterStatus !== 'all') {
      next = next.filter((i) => epicStatusFromIssue(i.status) === filterStatus);
    }
    const q = filterText.trim().toLowerCase();
    if (q) {
      next = next.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          i.code.toLowerCase().includes(q) ||
          (i.projectName || '').toLowerCase().includes(q)
      );
    }
    return next.map(issueToDashboardEpic);
  }, [allLoadedIssues, filterStatus, filterText]);

  const boardByColumn = useMemo(() => {
    const map: Record<DashboardEpic['status'], DashboardEpic[]> = {
      Active: [],
      'In Review': [],
      Blocked: [],
      Planning: [],
    };
    for (const e of epicsForList) {
      map[e.status].push(e);
    }
    return map;
  }, [epicsForList]);

  const pageLabel =
    viewMode === 'list'
      ? `${t('epics.pageList')} ${pageIndex + 1} · ${pageIssues.length} ${t('epics.epicsOnPage')}`
      : `${allLoadedIssues.length} ${t('epics.epicsOnBoard')}`;

  return (
    <div className="p-8 max-w-7xl mx-auto w-full space-y-10">
      <div className="flex justify-between items-end flex-wrap gap-4">
        <div className="space-y-1">
          <h2 className="text-4xl font-extrabold tracking-tighter text-white">{t('epics.title')}</h2>
          <p className="text-zinc-500 text-sm max-w-md">
            {configured
              ? pk
                ? interpolate(t('epics.subtitleProjectScoped'), { key: pk })
                : t('epics.subtitleConfigured')
              : t('epics.subtitleNotConfigured')}
          </p>
          {defaultBoardId && pk && (
            <p className="text-[11px] text-zinc-600 max-w-lg">
              {t('epics.defaultBoardScopeHint')}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex bg-surface-low p-1 rounded-xl border border-outline-variant/5">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                viewMode === 'list' ? 'bg-surface-highest text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {t('epics.list')}
            </button>
            <button
              type="button"
              onClick={() => setViewMode('board')}
              className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                viewMode === 'board' ? 'bg-surface-highest text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {t('epics.board')}
            </button>
          </div>
          <button
            type="button"
            onClick={() => setFiltersOpen((o) => !o)}
            className={`bg-surface-highest hover:bg-surface-high text-white text-xs font-bold px-4 py-2 rounded-xl transition-all flex items-center gap-2 border border-outline-variant/10 ${
              filtersOpen ? 'ring-1 ring-primary/40' : ''
            }`}
          >
            <Filter size={14} />
            {t('epics.filters')}
          </button>
          {configured && (
            <button
              type="button"
              onClick={() => refetch()}
              disabled={loading}
              className="text-xs font-bold px-3 py-2 rounded-xl bg-surface-highest border border-outline-variant/10 text-zinc-300 hover:text-white disabled:opacity-40"
            >
              {t('epics.refresh')}
            </button>
          )}
        </div>
      </div>

      {filtersOpen && (
        <div className="bg-surface-low rounded-2xl border border-outline-variant/10 p-5 space-y-4 relative">
          <button
            type="button"
            onClick={() => setFiltersOpen(false)}
            className="absolute top-4 right-4 p-1 text-zinc-500 hover:text-white"
            aria-label={t('epics.closeFilters')}
          >
            <X size={18} />
          </button>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">{t('epics.filterTitle')}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
            <label className="space-y-1.5 block">
              <span className="text-[11px] text-zinc-500 font-bold">{t('epics.search')}</span>
              <input
                type="search"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                placeholder={t('epics.searchPh')}
                className="w-full bg-surface-highest border border-outline-variant/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-zinc-600"
              />
            </label>
            <label className="space-y-1.5 block">
              <span className="text-[11px] text-zinc-500 font-bold">{t('epics.statusMapped')}</span>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
                className="w-full bg-surface-highest border border-outline-variant/10 rounded-xl px-3 py-2 text-sm text-white"
              >
                <option value="all">{t('epics.statusAll')}</option>
                <option value="Active">{t('epics.statusActive')}</option>
                <option value="In Review">{t('epics.statusReview')}</option>
                <option value="Blocked">{t('epics.statusBlocked')}</option>
                <option value="Planning">{t('epics.statusPlanning')}</option>
              </select>
            </label>
          </div>
          <p className="text-[10px] text-zinc-600 max-w-xl">{t('epics.filterHint')}</p>
        </div>
      )}

      {waitingBoardScope && (
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <Loader size={16} className="animate-spin shrink-0" />
          {t('epics.boardScopeLoading')}
        </div>
      )}
      {error && <p className="text-sm text-error">{error}</p>}
      {boardScope.error && defaultBoardId && pk && (
        <p className="text-sm text-amber-500/90">{boardScope.error}</p>
      )}
      {!configured && <p className="text-sm text-zinc-500">{t('epics.noMockData')}</p>}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          {
            label: t('epics.statsEpics'),
            value: loading ? '—' : String(allEpicsForStats.length),
            sub: t('epics.statsLoaded'),
            color: 'text-primary',
          },
          {
            label: t('epics.statsActive'),
            value: loading ? '—' : String(allEpicsForStats.filter((e) => e.status === 'Active').length),
            sub: t('epics.statsInFilter'),
            color: 'text-white',
          },
          {
            label: t('epics.statsBlocked'),
            value: loading ? '—' : String(allEpicsForStats.filter((e) => e.status === 'Blocked').length),
            sub: t('epics.statsInFilter'),
            color: 'text-error',
          },
          {
            label: t('epics.statsDone'),
            value: loading ? '—' : String(allEpicsForStats.filter((e) => e.progress >= 100).length),
            sub: t('epics.statsInFilter'),
            color: 'text-white',
          },
        ].map((stat, i) => (
          <div key={i} className="bg-surface-low p-5 rounded-2xl border border-outline-variant/5 space-y-2">
            <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-bold">{stat.label}</p>
            <div className="flex items-baseline gap-3">
              <span className={`text-3xl font-black tracking-tighter ${stat.color}`}>{stat.value}</span>
              {stat.sub && <span className="text-[10px] text-zinc-500 font-medium">{stat.sub}</span>}
            </div>
          </div>
        ))}
      </div>

      {viewMode === 'list' && (
        <div className="bg-surface-low rounded-2xl border border-outline-variant/5 overflow-hidden">
          <div className="grid grid-cols-12 gap-4 px-6 py-4 border-b border-outline-variant/10 text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-black">
            <div className="col-span-5">{t('epics.colEpic')}</div>
            <div className="col-span-2">{t('epics.colStatus')}</div>
            <div className="col-span-2">{t('epics.colProgress')}</div>
            <div className="col-span-2">{t('epics.colAssignee')}</div>
            <div className="col-span-1"></div>
          </div>

          <div className="divide-y divide-outline-variant/5">
            {loading && (
              <div className="px-6 py-12 text-center text-sm text-zinc-500">{t('epics.loading')}</div>
            )}
            {!loading && epicsForList.length === 0 && configured && !error && (
              <div className="px-6 py-12 text-center text-sm text-zinc-500">{t('epics.empty')}</div>
            )}
            {epicsForList.map((epic) => (
              <motion.div
                key={epic.id}
                whileHover={{ backgroundColor: 'rgba(52, 53, 54, 0.3)' }}
                onClick={() => onEpicClick(epic)}
                className="grid grid-cols-12 gap-4 px-6 py-5 items-center cursor-pointer group"
              >
                <div className="col-span-5 flex items-center gap-4">
                  <div
                    className="w-2.5 h-2.5 rounded-full shadow-lg"
                    style={{ backgroundColor: epic.color, boxShadow: `0 0 12px ${epic.color}40` }}
                  />
                  <div>
                    <p className="text-sm font-bold text-white group-hover:text-primary transition-colors">{epic.name}</p>
                    <p className="text-[10px] text-zinc-500 font-mono mt-0.5">
                      {epic.code} • {epic.category}
                    </p>
                  </div>
                </div>
                <div className="col-span-2">
                  <span
                    className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider ${
                      epic.status === 'Active'
                        ? 'bg-primary/10 text-primary'
                        : epic.status === 'Blocked'
                          ? 'bg-error/10 text-error'
                          : 'bg-surface-highest text-zinc-400'
                    }`}
                  >
                    {epic.status}
                  </span>
                </div>
                <div className="col-span-2 flex items-center gap-3">
                  <div className="flex-1 h-1 bg-surface-highest rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${epic.progress}%` }}
                      className="h-full"
                      style={{ backgroundColor: epic.color }}
                    />
                  </div>
                  <span className="text-[11px] font-mono text-zinc-500">{epic.progress}%</span>
                </div>
                <div className="col-span-2 flex -space-x-2">
                  {epic.assignees.length > 0 ? (
                    epic.assignees.map((a, i) => (
                      <div key={`${a.name}-${i}`} className="relative">
                        <AvatarImage
                          src={a.avatarUrl}
                          name={a.name}
                          size={28}
                          className="border-2 border-surface-low grayscale hover:grayscale-0 transition-all"
                          ariaLabel={a.name}
                        />
                      </div>
                    ))
                  ) : (
                    <div className="w-7 h-7 rounded-full border-2 border-surface-low bg-surface-highest flex items-center justify-center text-[10px] text-zinc-500 font-bold">
                      —
                    </div>
                  )}
                </div>
                <div className="col-span-1 text-right">
                  <button type="button" className="p-1.5 text-zinc-600 hover:text-white transition-colors">
                    <MoreHorizontal size={18} />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>

          <PaginationBar
            pageLabel={pageLabel}
            canGoPrev={canGoPrev}
            canGoNext={canGoNext}
            onPrev={goPrevPage}
            onNext={goNextPage}
            loadingMore={loadingMore}
            disabled={loading || needsConfig}
          />
        </div>
      )}

      {viewMode === 'board' && (
        <div className="space-y-3">
          <p className="text-[11px] text-zinc-500 px-1">{t('epics.boardHint')}</p>
          <div className="flex gap-4 overflow-x-auto pb-2 min-h-[320px]">
            {BOARD_COLUMNS.map((col) => (
              <div
                key={col}
                className="flex-shrink-0 w-72 bg-surface-low rounded-2xl border border-outline-variant/10 flex flex-col max-h-[70vh]"
              >
                <div className="px-4 py-3 border-b border-outline-variant/10 flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">{col}</span>
                  <span className="text-[10px] font-bold text-zinc-600 bg-surface-highest px-2 py-0.5 rounded-full">
                    {boardByColumn[col].length}
                  </span>
                </div>
                <div className="p-2 overflow-y-auto flex-1 space-y-2">
                  {boardByColumn[col].map((epic) => (
                    <motion.button
                      key={epic.id}
                      type="button"
                      layout
                      onClick={() => onEpicClick(epic)}
                      className="w-full text-left p-3 rounded-xl bg-surface-highest/80 border border-outline-variant/10 hover:border-primary/30 transition-colors"
                    >
                      <div className="flex items-start gap-2">
                        <span
                          className="w-2 h-2 rounded-full mt-1 flex-shrink-0"
                          style={{ backgroundColor: epic.color }}
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white line-clamp-3">{epic.name}</p>
                          <p className="text-[10px] text-zinc-500 font-mono mt-1">{epic.code}</p>
                        </div>
                      </div>
                    </motion.button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <PaginationBar
            pageLabel={pageLabel}
            canGoPrev={canGoPrev}
            canGoNext={canGoNext}
            onPrev={goPrevPage}
            onNext={goNextPage}
            loadingMore={loadingMore}
            disabled={loading || needsConfig}
          />
        </div>
      )}

      <div className="space-y-6">
        <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">{t('epics.activity')}</h3>
        <p className="text-sm text-zinc-600 max-w-xl leading-relaxed">{t('epics.activityBody')}</p>
      </div>
    </div>
  );
}
