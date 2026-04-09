import { useState, useMemo } from 'react';
import { MoreHorizontal, ShieldAlert, Clock, Activity, ExternalLink, Loader } from 'lucide-react';
import { motion } from 'motion/react';
import type { Issue } from '../api/types';
import { isJiraConfigured, getConfig } from '../api/config';
import { intersectJqlWithBoardScope, jqlIssuesUnderEpic } from '../api/jira';
import { useJiraJqlPages } from '../hooks/useIssues';
import { useDefaultBoardScopeJql } from '../hooks/useBoardScope';
import { useLocale, interpolate } from '../locales';
import IssueDetailModal from './IssueDetailModal';
import PaginationBar from './PaginationBar';
import { AvatarImage } from './AvatarImage';
import OpenSpecMenu from './OpenSpecMenu';

export interface EpicDetailEpic {
  id: string;
  name: string;
  code: string;
  category: string;
  status: string;
  progress: number;
  color: string;
}

interface EpicDetailProps {
  epic: EpicDetailEpic;
  onProposalClick: () => void;
}

export default function EpicDetail({ epic, onProposalClick }: EpicDetailProps) {
  const { t } = useLocale();
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);

  const pk = getConfig().jira?.projectKey?.trim() ?? '';
  const boardScope = useDefaultBoardScopeJql(pk);
  const defaultBoardId = getConfig().jira?.boardId?.trim() ?? '';
  const waitingBoardScope = isJiraConfigured() && !!defaultBoardId && !!pk && !boardScope.ready;

  const childJqlRaw = useMemo(
    () => (isJiraConfigured() && epic.code.trim() ? jqlIssuesUnderEpic(epic.code) : null),
    [epic.code]
  );
  const childJql = useMemo(
    () => (childJqlRaw ? intersectJqlWithBoardScope(boardScope.baseJql, childJqlRaw) : null),
    [childJqlRaw, boardScope.baseJql]
  );

  const {
    issues: pageIssues,
    allLoadedIssues,
    loading,
    loadingMore,
    error,
    canGoPrev,
    canGoNext,
    goPrevPage,
    goNextPage,
    pageIndex,
  } = useJiraJqlPages(waitingBoardScope ? null : childJql);

  const jiraBase = getConfig().jira?.domain?.replace(/\/$/, '');
  const epicBrowseUrl = jiraBase ? `${jiraBase}/browse/${epic.code}` : null;

  return (
    <div className="flex h-full overflow-hidden">
      <IssueDetailModal
        open={selectedIssue !== null}
        issue={selectedIssue}
        onClose={() => setSelectedIssue(null)}
      />
      <div className="flex-1 overflow-y-auto p-10 min-w-0">
        <div className="max-w-5xl mx-auto space-y-12">
          <div className="space-y-6">
            <div className="flex flex-col gap-3 min-[520px]:flex-row min-[520px]:flex-wrap min-[520px]:items-center min-[520px]:justify-between">
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <span className="bg-surface-highest text-zinc-400 text-[10px] font-black px-2.5 py-1 rounded tracking-widest uppercase shrink-0">
                  {epic.code}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <div
                    className="w-2 h-2 rounded-full animate-pulse shadow-[0_0_10px_currentColor]"
                    style={{ backgroundColor: epic.color, color: epic.color }}
                  />
                  <span className="text-xs text-zinc-400 font-bold tracking-tight">{epic.status}</span>
                </div>
              </div>
              <div className="shrink-0 w-full min-[520px]:w-auto min-[520px]:max-w-full flex justify-start min-[520px]:justify-end">
                <OpenSpecMenu scope="epic" jiraKey={epic.code} contextTitle={epic.name} />
              </div>
            </div>

            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tighter leading-tight break-words">
              {epic.name}
            </h2>
            <p className="text-zinc-500 max-w-2xl text-sm leading-relaxed">
              {interpolate(t('epicDetail.blurb'), { category: epic.category, code: epic.code })}
            </p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: t('epicDetail.statEpicProgress'), value: `${epic.progress}%` },
              { label: t('epicDetail.statChildIssues'), value: loading ? '…' : String(allLoadedIssues.length) },
              { label: t('epicDetail.statProject'), value: epic.category },
              { label: t('epicDetail.statKey'), value: epic.code },
            ].map((stat, i) => (
              <div key={i} className="bg-surface-low p-6 rounded-2xl border border-outline-variant/5">
                <span className="block text-[10px] text-zinc-500 uppercase tracking-[0.2em] font-bold mb-2">{stat.label}</span>
                <span className="text-xl font-black text-white tracking-tighter">{stat.value}</span>
              </div>
            ))}
          </div>

          <section className="space-y-6">
            <div className="flex items-center justify-between px-2">
              <h3 className="text-xs font-black uppercase tracking-[0.3em] text-zinc-500">{t('epicDetail.sectionJiraIssues')}</h3>
            </div>

            {waitingBoardScope && (
              <div className="flex items-center gap-2 text-sm text-zinc-500 px-2">
                <Loader size={16} className="animate-spin shrink-0" />
                {t('epics.boardScopeLoading')}
              </div>
            )}
            {boardScope.error && defaultBoardId && pk && (
              <p className="text-sm text-amber-500/90 px-2">{boardScope.error}</p>
            )}
            {error && <p className="text-sm text-error px-2">{error}</p>}
            {loading && !waitingBoardScope && (
              <p className="text-sm text-zinc-500 px-2">{t('epicDetail.loading')}</p>
            )}
            {!waitingBoardScope && !loading && !error && pageIssues.length === 0 && (
              <p className="text-sm text-zinc-500 px-2">{t('epicDetail.emptyPage')}</p>
            )}

            <div className="space-y-2">
              {pageIssues.map((task) => (
                <motion.div
                  key={task.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedIssue(task)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedIssue(task);
                    }
                  }}
                  whileHover={{ x: 4, backgroundColor: 'rgba(52, 53, 54, 0.3)' }}
                  className="flex items-center bg-surface-low p-4 rounded-xl border border-outline-variant/5 group cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <div className="w-24 shrink-0">
                    <span className="text-[10px] font-mono text-zinc-600 font-bold">{task.code}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 min-w-0 flex-wrap">
                      <h4 className="text-sm font-bold text-white truncate group-hover:text-zinc-100 min-w-0">
                        {task.title}
                      </h4>
                      {task.subtaskCount != null && task.subtaskCount > 0 ? (
                        <span className="text-[9px] font-black uppercase tracking-wider text-secondary bg-secondary/10 border border-secondary/25 px-1.5 py-0.5 rounded-md shrink-0">
                          {interpolate(t('issues.subtaskBadge'), { n: String(task.subtaskCount) })}
                        </span>
                      ) : null}
                      {task.jiraUrl && (
                        <a
                          href={task.jiraUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-600 hover:text-primary flex-shrink-0 p-0.5"
                          aria-label={interpolate(t('epicDetail.openInJira'), { code: task.code })}
                        >
                          <ExternalLink size={14} />
                        </a>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-1.5">
                      <span className="text-[10px] text-zinc-500 font-bold flex items-center gap-1.5">
                        <ShieldAlert size={12} className="text-zinc-500" />
                        {task.priority}
                      </span>
                      <span className="text-[10px] text-zinc-500 font-bold flex items-center gap-1.5">
                        <Clock size={12} />
                        {task.updatedAt}
                      </span>
                    </div>
                  </div>
                  <div className="w-36 flex items-center gap-2.5 shrink-0">
                    <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">{task.status}</span>
                  </div>
                  <div className="w-48 flex items-center gap-3 shrink-0 min-w-0">
                    <AvatarImage
                      src={task.assigneeAvatar}
                      name={task.assignee?.trim() ? task.assignee : '?'}
                      size={28}
                      className="border-outline-variant/20 grayscale flex-shrink-0"
                      ariaLabel={task.assignee || undefined}
                    />
                    <span className="text-[11px] text-zinc-400 font-bold truncate">{task.assignee || '—'}</span>
                  </div>
                  <div onClick={(e) => e.stopPropagation()} className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <OpenSpecMenu scope="issue" jiraKey={task.code} compact contextTitle={task.title} />
                  </div>
                  <button
                    type="button"
                    onClick={(e) => e.stopPropagation()}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 text-zinc-600 hover:text-white flex-shrink-0"
                    aria-label="Mais opções"
                  >
                    <MoreHorizontal size={18} />
                  </button>
                </motion.div>
              ))}
            </div>

            <PaginationBar
              pageLabel={`${t('epicDetail.pageOf')} ${pageIndex + 1} · ${pageIssues.length} ${t('epicDetail.issuesOnPage')}`}
              canGoPrev={canGoPrev}
              canGoNext={canGoNext}
              onPrev={goPrevPage}
              onNext={goNextPage}
              loadingMore={loadingMore}
              disabled={loading}
            />
          </section>
        </div>
      </div>

      <aside className="w-80 bg-zinc-950 border-l border-outline-variant/10 flex flex-col p-8 gap-10 overflow-y-auto">
        <div className="space-y-6">
          <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-600">Jira</h3>
          <div className="space-y-4 text-sm text-zinc-400">
            {epicBrowseUrl ? (
              <a
                href={epicBrowseUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary font-bold hover:underline break-all"
              >
                {interpolate(t('epicDetail.openInJira'), { code: epic.code })}
              </a>
            ) : (
              <p>{t('epicDetail.configureDomain')}</p>
            )}
            <p className="text-xs text-zinc-600">
              {interpolate(t('epicDetail.loadedCount'), { n: allLoadedIssues.length })}
            </p>
          </div>
        </div>

        <div className="mt-auto space-y-4">
          <div className="bg-surface-low p-5 rounded-2xl border border-outline-variant/5 flex items-center gap-3">
            <Activity size={14} className="text-primary" />
            <span className="text-[10px] text-zinc-500">{t('epicDetail.dataNote')}</span>
          </div>
          <button
            type="button"
            onClick={onProposalClick}
            className="w-full bg-primary-container text-white py-3 rounded-xl font-black text-xs uppercase tracking-widest shadow-xl shadow-primary-container/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            {t('epicDetail.proposal')}
          </button>
        </div>
      </aside>
    </div>
  );
}
