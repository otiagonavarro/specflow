import { useState, useEffect, useMemo, type ElementType } from 'react';
import {
  ArrowUp,
  ArrowRight,
  ArrowDown,
  MoreHorizontal,
  TrendingUp,
  Filter,
  X,
  ChevronDown,
  ExternalLink,
  RefreshCw,
  Settings2,
  Loader,
} from 'lucide-react';
import { motion } from 'motion/react';
import type { Issue, Priority } from '../api/types';
import { useJiraJqlPages } from '../hooks/useIssues';
import { useBoardColumns } from '../hooks/useBoardColumns';
import { getConfig, isJiraConfigured } from '../api/config';
import { buildAssigneeIssuesJql, intersectJqlWithBoardScope } from '../api/jira';
import { useDefaultBoardScopeJql } from '../hooks/useBoardScope';
import { buildBoardColumnModel, fallbackColumnsFromIssues } from '../lib/jiraBoardColumns';
import { jiraStatusPresentation, jiraStatusSortWeight, isJiraStatusDoneLike } from '../lib/jiraStatusUi';
import IssueDetailModal from './IssueDetailModal';
import PaginationBar from './PaginationBar';
import { useLocale, interpolate } from '../locales';

const PRIORITY_CONFIG: Record<Priority, { icon: ElementType; className: string }> = {
  Critical: { icon: ArrowUp, className: 'text-error' },
  High: { icon: ArrowUp, className: 'text-orange-400' },
  Medium: { icon: ArrowRight, className: 'text-yellow-500' },
  Low: { icon: ArrowDown, className: 'text-zinc-500' },
};

const ALL_PRIORITIES: Priority[] = ['Critical', 'High', 'Medium', 'Low'];

interface MyIssuesProps {
  onNavigateSettings?: () => void;
}

export default function MyIssues({ onNavigateSettings }: MyIssuesProps) {
  const { t } = useLocale();

  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [activeFilter, setActiveFilter] = useState('all');
  const [groupByEpic, setGroupByEpic] = useState(false);
  const [dismissedError, setDismissedError] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'board'>('list');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedPriorities, setSelectedPriorities] = useState<Priority[]>([]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const pk = getConfig().jira?.projectKey?.trim() ?? '';
  const boardScope = useDefaultBoardScopeJql(pk);
  const defaultBoardId = getConfig().jira?.boardId?.trim() ?? '';
  const waitingBoardScope = isJiraConfigured() && !!defaultBoardId && !!pk && !boardScope.ready;

  const listJqlRaw = useMemo(() => {
    if (!isJiraConfigured()) return null;
    return buildAssigneeIssuesJql({ summaryContains: debouncedSearch || undefined });
  }, [debouncedSearch]);

  const listJql = useMemo(
    () => (listJqlRaw ? intersectJqlWithBoardScope(boardScope.baseJql, listJqlRaw) : null),
    [listJqlRaw, boardScope.baseJql]
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
  } = useJiraJqlPages(waitingBoardScope ? null : listJql);

  const listSource = viewMode === 'board' ? allLoadedIssues : pageIssues;

  const statusFilterOptions = useMemo(() => {
    const set = new Set(listSource.map((i) => i.status));
    return [...set].sort(
      (a, b) =>
        jiraStatusSortWeight(a) - jiraStatusSortWeight(b) ||
        a.localeCompare(b, undefined, { sensitivity: 'base' })
    );
  }, [listSource]);

  const filterChips = useMemo(
    () => [
      { label: t('issues.filterAll'), value: 'all' },
      ...statusFilterOptions.map((s) => ({ label: s, value: s })),
    ],
    [t, statusFilterOptions]
  );

  useEffect(() => {
    if (activeFilter === 'all') return;
    const available = new Set(['all', ...statusFilterOptions]);
    if (!available.has(activeFilter)) setActiveFilter('all');
  }, [statusFilterOptions, activeFilter]);

  const configuredForBoard = isJiraConfigured();
  const { columns: jiraBoardColumns } = useBoardColumns(configuredForBoard ? defaultBoardId : undefined);

  const priorityFiltered = useMemo(() => {
    if (selectedPriorities.length === 0) return listSource;
    const set = new Set(selectedPriorities);
    return listSource.filter((i) => set.has(i.priority));
  }, [listSource, selectedPriorities]);

  const filtered =
    activeFilter === 'all' ? priorityFiltered : priorityFiltered.filter((i) => i.status === activeFilter);

  const grouped = useMemo(() => {
    if (groupByEpic) {
      return filtered.reduce<Record<string, Issue[]>>((acc, issue) => {
        const key = issue.epic || issue.projectName || t('myIssues.noEpicGroup');
        if (!acc[key]) acc[key] = [];
        acc[key].push(issue);
        return acc;
      }, {});
    }
    return { [t('myIssues.singleGroup')]: filtered };
  }, [groupByEpic, filtered, t]);

  const boardColumnDefs = useMemo(() => {
    if (jiraBoardColumns.length > 0) return jiraBoardColumns;
    return fallbackColumnsFromIssues(filtered);
  }, [jiraBoardColumns, filtered]);

  const boardModel = useMemo(
    () => buildBoardColumnModel(boardColumnDefs, filtered, t('issues.boardOtherColumn')),
    [boardColumnDefs, filtered, t]
  );

  const configured = isJiraConfigured();
  const done = filtered.filter((i) => isJiraStatusDoneLike(i.status)).length;
  const completionPct = filtered.length > 0 ? Math.round((done / filtered.length) * 100) : 0;

  const stats = useMemo(
    () => [
      {
        label: t('myIssues.statVisible'),
        value: filtered.length,
        sub: viewMode === 'list' ? t('myIssues.statVisibleSubList') : t('myIssues.statVisibleSubBoard'),
      },
      { label: t('myIssues.statOnPage'), value: pageIssues.length, sub: t('myIssues.statOnPageSub') },
      { label: t('myIssues.statLoaded'), value: allLoadedIssues.length, sub: t('myIssues.statLoadedSub') },
      { label: t('myIssues.statDoneFilter'), value: done, sub: `${completionPct}%` },
    ],
    [t, filtered.length, viewMode, pageIssues.length, allLoadedIssues.length, done, completionPct]
  );

  const togglePriority = (p: Priority) => {
    setSelectedPriorities((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  };

  const clearFilters = () => {
    setSearchInput('');
    setDebouncedSearch('');
    setSelectedPriorities([]);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto w-full space-y-6">
      <IssueDetailModal open={selectedIssue !== null} issue={selectedIssue} onClose={() => setSelectedIssue(null)} />

      <div className="flex justify-between items-end flex-wrap gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h2 className="text-4xl font-extrabold tracking-tighter text-white">{t('myIssues.title')}</h2>
            {configured && !loading && !error && (
              <span className="text-[10px] font-black uppercase tracking-wider text-tertiary bg-tertiary/10 px-2.5 py-1 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-tertiary inline-block" />
                Jira
              </span>
            )}
          </div>
          <p className="text-zinc-500 text-sm">{t('myIssues.subtitle')}</p>
          {defaultBoardId && pk && (
            <p className="text-[11px] text-zinc-600 max-w-lg">{t('myIssues.defaultBoardScopeHint')}</p>
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
              {t('myIssues.list')}
            </button>
            <button
              type="button"
              onClick={() => setViewMode('board')}
              className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                viewMode === 'board' ? 'bg-surface-highest text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {t('myIssues.board')}
            </button>
          </div>
          <button
            type="button"
            onClick={() => setGroupByEpic((g) => !g)}
            className={`text-xs font-bold px-4 py-2 rounded-xl transition-all flex items-center gap-2 border border-outline-variant/10 ${
              groupByEpic ? 'bg-primary/10 text-primary' : 'bg-surface-highest text-zinc-400 hover:text-white'
            }`}
          >
            <ChevronDown size={14} />
            {t('myIssues.groupByEpic')}
          </button>
          {configured && (
            <button
              type="button"
              onClick={() => refetch()}
              disabled={loading || needsConfig}
              className="bg-surface-highest hover:bg-surface-high text-white text-xs font-bold px-3 py-2 rounded-xl transition-all flex items-center gap-2 border border-outline-variant/10 disabled:opacity-40"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          )}
          <button
            type="button"
            onClick={() => setFiltersOpen((o) => !o)}
            className={`bg-surface-highest hover:bg-surface-high text-white text-xs font-bold px-4 py-2 rounded-xl transition-all flex items-center gap-2 border border-outline-variant/10 ${
              filtersOpen ? 'ring-1 ring-primary/40' : ''
            }`}
          >
            <Filter size={14} />
            {t('myIssues.filters')}
          </button>
          <div className="flex items-center gap-2 bg-surface-low border border-outline-variant/5 px-4 py-2.5 rounded-xl">
            <TrendingUp size={14} className="text-primary" />
            <span className="text-xs font-bold text-zinc-300">{t('myIssues.doneLabel')}</span>
            <span className="text-xs font-black text-primary">{completionPct}%</span>
            <div className="w-20 h-1 bg-surface-highest rounded-full overflow-hidden ml-1">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${completionPct}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className="h-full bg-primary"
              />
            </div>
          </div>
        </div>
      </div>

      {filtersOpen && (
        <div className="bg-surface-low rounded-2xl border border-outline-variant/10 p-5 space-y-4 relative">
          <button
            type="button"
            onClick={() => setFiltersOpen(false)}
            className="absolute top-4 right-4 p-1 text-zinc-500 hover:text-white"
            aria-label={t('myIssues.closeFiltersAria')}
          >
            <X size={18} />
          </button>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">{t('myIssues.filterPanelTitle')}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl">
            <label className="space-y-1.5 block">
              <span className="text-[11px] text-zinc-500 font-bold">{t('myIssues.searchJqlLabel')}</span>
              <input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder={t('myIssues.searchPlaceholder')}
                className="w-full bg-surface-highest border border-outline-variant/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-zinc-600"
              />
            </label>
            <div className="space-y-2">
              <span className="text-[11px] text-zinc-500 font-bold block">{t('myIssues.priorityLabel')}</span>
              <div className="flex flex-wrap gap-2">
                {ALL_PRIORITIES.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => togglePriority(p)}
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-colors ${
                      selectedPriorities.includes(p)
                        ? 'bg-primary/15 border-primary/40 text-primary'
                        : 'bg-surface-highest border-outline-variant/10 text-zinc-400 hover:text-white'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={clearFilters}
              className="text-xs font-bold text-zinc-500 hover:text-white underline-offset-2 hover:underline"
            >
              {t('myIssues.clearFilters')}
            </button>
            <p className="text-[10px] text-zinc-600">{t('myIssues.filterHelp')}</p>
          </div>
        </div>
      )}

      {waitingBoardScope && (
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <Loader size={16} className="animate-spin shrink-0" />
          {t('myIssues.boardScopeLoading')}
        </div>
      )}
      {boardScope.error && defaultBoardId && pk && (
        <p className="text-sm text-amber-500/90">{boardScope.error}</p>
      )}

      {needsConfig && !dismissedError && (
        <div className="flex items-center justify-between bg-surface-low border border-outline-variant/10 rounded-xl px-4 py-3">
          <p className="text-[11px] text-zinc-500">
            {t('myIssues.configurePrefix')}{' '}
            <button
              type="button"
              onClick={() => onNavigateSettings?.()}
              className="text-primary font-bold hover:underline"
            >
              {t('myIssues.configureLink')}
            </button>{' '}
            {t('myIssues.configureSuffix')}
          </p>
          <button type="button" onClick={() => setDismissedError(true)} className="text-zinc-700 hover:text-zinc-400 text-xs ml-4">
            ✕
          </button>
        </div>
      )}
      {error && !dismissedError && (
        <div className="flex items-center justify-between bg-error/5 border border-error/20 rounded-xl px-4 py-3">
          <p className="text-[11px] text-error">
            {t('myIssues.errorPrefix')} {error}
          </p>
          <button type="button" onClick={() => setDismissedError(true)} className="text-error/60 hover:text-error text-xs ml-4">
            ✕
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <div key={i} className="bg-surface-low p-5 rounded-2xl border border-outline-variant/5 space-y-1">
            <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-black">{stat.label}</p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black tracking-tighter text-white">{loading ? '—' : stat.value}</span>
              <span className="text-[10px] text-zinc-600 font-medium">{stat.sub}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-1 bg-surface-low p-1 rounded-xl border border-outline-variant/5 w-fit flex-wrap">
        {filterChips.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setActiveFilter(f.value)}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
              activeFilter === f.value ? 'bg-surface-highest text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {viewMode === 'board' && (
        <div className="space-y-1 px-1">
          <p className="text-[11px] text-zinc-500">{t('myIssues.boardHint')}</p>
          {defaultBoardId && jiraBoardColumns.length > 0 ? (
            <p className="text-[10px] text-zinc-600">{t('issues.boardColumnsFromJira')}</p>
          ) : null}
        </div>
      )}

      {viewMode === 'board' ? (
        <div className="flex gap-3 overflow-x-auto pb-2 min-h-[280px]">
          {boardModel.map((col) => {
            const presentation = jiraStatusPresentation(col.issues[0]?.status ?? col.header);
            const Icon = presentation.icon;
            return (
              <div
                key={col.key}
                className="flex-shrink-0 w-64 bg-surface-low rounded-2xl border border-outline-variant/10 flex flex-col max-h-[70vh]"
              >
                <div className="px-3 py-2.5 border-b border-outline-variant/10 flex items-center gap-2">
                  <Icon size={12} className={presentation.className} />
                  <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 truncate">
                    {col.header}
                  </span>
                  <span className="text-[10px] font-bold text-zinc-600 bg-surface-highest px-2 py-0.5 rounded-full ml-auto">
                    {col.issues.length}
                  </span>
                </div>
                <div className="p-2 overflow-y-auto flex-1 space-y-2">
                  {col.issues.map((issue) => (
                    <motion.button
                      key={issue.id}
                      type="button"
                      layout
                      onClick={() => setSelectedIssue(issue)}
                      className="w-full text-left p-2.5 rounded-xl bg-surface-highest/80 border border-outline-variant/10 hover:border-primary/30 transition-colors"
                    >
                      <p className="text-[11px] font-bold text-white line-clamp-2">{issue.title}</p>
                      <div className="flex items-center gap-2 flex-wrap mt-1">
                        <p className="text-[10px] text-zinc-500 font-mono">{issue.code}</p>
                        {issue.subtaskCount != null && issue.subtaskCount > 0 ? (
                          <span className="text-[8px] font-black uppercase tracking-wider text-secondary bg-secondary/10 px-1 py-0.5 rounded">
                            {interpolate(t('issues.subtaskBadge'), { n: String(issue.subtaskCount) })}
                          </span>
                        ) : null}
                      </div>
                    </motion.button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped)
            .filter(([, groupIssues]) => (groupIssues as Issue[]).length > 0)
            .map(([group, groupIssues]) => (
            <div key={group} className="bg-surface-low rounded-2xl border border-outline-variant/5 overflow-hidden">
              {groupByEpic && (
                <div className="px-6 py-3 border-b border-outline-variant/10 flex items-center gap-3">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">{group}</span>
                  <span className="text-[10px] font-bold text-zinc-600 bg-surface-highest px-2 py-0.5 rounded-full">
                    {(groupIssues as Issue[]).length}
                  </span>
                </div>
              )}

              <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-outline-variant/5 text-[10px] uppercase tracking-[0.2em] text-zinc-600 font-black">
                <div className="col-span-5">{t('myIssues.colIssue')}</div>
                <div className="col-span-2">{t('myIssues.colStatus')}</div>
                <div className="col-span-2">{t('myIssues.colPriority')}</div>
                <div className="col-span-2">{t('myIssues.colUpdated')}</div>
                <div className="col-span-1"></div>
              </div>

              {loading ? (
                <div className="px-6 py-8 text-sm text-zinc-500">{t('myIssues.loading')}</div>
              ) : (
                <div>
                  {(groupIssues as Issue[]).map((issue: Issue, idx: number) => {
                    const st = jiraStatusPresentation(issue.status);
                    const StatusIcon = st.icon;
                    const PriorityIcon = PRIORITY_CONFIG[issue.priority]?.icon || ArrowRight;
                    return (
                      <motion.div
                        key={issue.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedIssue(issue)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setSelectedIssue(issue);
                          }
                        }}
                        whileHover={{ backgroundColor: 'rgba(52, 53, 54, 0.3)' }}
                        className={`grid grid-cols-12 gap-4 px-6 py-4 items-center cursor-pointer group ${
                          idx < (groupIssues as Issue[]).length - 1 ? 'border-b border-outline-variant/5' : ''
                        }`}
                      >
                        <div className="col-span-5 flex items-center gap-3">
                          <StatusIcon size={15} className={st.className} />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-semibold text-zinc-200 group-hover:text-white transition-colors truncate min-w-0">
                                {issue.title}
                              </p>
                              {issue.subtaskCount != null && issue.subtaskCount > 0 ? (
                                <span className="text-[9px] font-black uppercase tracking-wider text-secondary bg-secondary/10 border border-secondary/25 px-1.5 py-0.5 rounded-md shrink-0">
                                  {interpolate(t('issues.subtaskBadge'), { n: String(issue.subtaskCount) })}
                                </span>
                              ) : null}
                              {issue.jiraUrl && (
                                <a
                                  href={issue.jiraUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-600 hover:text-primary flex-shrink-0"
                                >
                                  <ExternalLink size={12} />
                                </a>
                              )}
                            </div>
                            <p className="text-[10px] text-zinc-600 font-mono mt-0.5">
                              {issue.code} · {issue.epic || issue.projectName || '—'}
                            </p>
                          </div>
                        </div>
                        <div className="col-span-2">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-1.5 h-1.5 rounded-full"
                              style={{
                                backgroundColor: st.dotColor,
                                boxShadow: `0 0 6px ${st.dotColor}80`,
                              }}
                            />
                            <span className="text-[11px] font-bold text-zinc-400">{issue.status}</span>
                          </div>
                        </div>
                        <div className="col-span-2">
                          <div className="flex items-center gap-1.5">
                            <PriorityIcon size={13} className={PRIORITY_CONFIG[issue.priority]?.className || 'text-zinc-500'} />
                            <span className="text-[11px] font-bold text-zinc-400">{issue.priority}</span>
                          </div>
                        </div>
                        <div className="col-span-2">
                          <span className="text-[11px] text-zinc-600 font-mono">{issue.updatedAt}</span>
                        </div>
                        <div className="col-span-1 text-right">
                          <button
                            type="button"
                            onClick={(e) => e.stopPropagation()}
                            className="p-1 text-zinc-700 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
                            aria-label={t('myIssues.moreOptions')}
                          >
                            <MoreHorizontal size={16} />
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="bg-surface-low rounded-2xl border border-outline-variant/5 overflow-hidden">
        <PaginationBar
          pageLabel={
            viewMode === 'list'
              ? `${t('myIssues.pageWord')} ${pageIndex + 1} · ${pageIssues.length} ${t('myIssues.issuesThisPage')}`
              : `${allLoadedIssues.length} ${t('myIssues.issuesLoadedBoard')}`
          }
          canGoPrev={canGoPrev}
          canGoNext={canGoNext}
          onPrev={goPrevPage}
          onNext={goNextPage}
          loadingMore={loadingMore}
          disabled={loading || needsConfig}
        />
      </div>

      {!loading && filtered.length === 0 && !needsConfig && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Settings2 size={24} className="text-zinc-700" />
          <p className="text-zinc-600 text-sm font-medium text-center max-w-md">
            {error ? t('myIssues.emptyError') : t('myIssues.emptyNone')}
          </p>
        </div>
      )}
    </div>
  );
}
