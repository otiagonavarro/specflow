import { useEffect, useState, useMemo, useCallback } from 'react';
import { ArrowLeft, RefreshCw, Loader, BarChart3, Activity, Table2, ChartScatter } from 'lucide-react';
import { motion } from 'motion/react';
import { useLocale, interpolate } from '../locales';
import {
  fetchBoardMetrics,
  fetchJiraBoards,
  jiraSoftwareBoardUrl,
  type JiraBoardSummary,
  type BoardMetricsPayload,
} from '../api/jira';
import { getConfig } from '../api/config';

interface BoardDashboardProps {
  board: JiraBoardSummary;
  projectKey: string;
  onBack: () => void;
}

const HISTORY_WINDOW_DAYS = [90, 180, 365, 730, 1095] as const;

function MetricCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-surface-low rounded-2xl border border-outline-variant/10 p-5 space-y-1 min-h-[100px]">
      <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-black">{label}</p>
      <p className="text-3xl font-black tracking-tighter text-white">{value}</p>
      {sub && <p className="text-[10px] text-zinc-600">{sub}</p>}
    </div>
  );
}

function ThroughputBars({
  rows,
  emptyLabel,
}: {
  rows: BoardMetricsPayload['throughputByWeek'];
  emptyLabel: string;
}) {
  const max = useMemo(() => Math.max(1, ...rows.map((r) => r.count)), [rows]);
  if (rows.length === 0) {
    return <p className="text-xs text-zinc-600 py-8 text-center">{emptyLabel}</p>;
  }
  return (
    <div className="flex items-end gap-1.5 h-36 px-1 pt-4">
      {rows.map((r) => (
        <div key={r.weekStartIso} className="flex-1 min-w-0 flex flex-col items-center gap-1 group">
          <div
            className="w-full max-w-[28px] mx-auto rounded-t-md bg-gradient-to-t from-primary/40 to-primary/90 transition-opacity group-hover:opacity-90"
            style={{ height: `${Math.max(8, (r.count / max) * 100)}%`, minHeight: r.count > 0 ? 8 : 2 }}
            title={`${r.weekLabel}: ${r.count}`}
          />
          <span className="text-[8px] font-bold text-zinc-600 truncate w-full text-center leading-tight">
            {r.weekLabel.replace(/, \d{4}$/, '')}
          </span>
        </div>
      ))}
    </div>
  );
}

function HistogramBars({ rows }: { rows: BoardMetricsPayload['leadTimeHistogram'] }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className="space-y-2 pt-2">
      {rows.map((r) => (
        <div key={r.bucket} className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-zinc-500 w-14 shrink-0">{r.bucket}</span>
          <div className="flex-1 h-2 bg-surface-highest rounded-full overflow-hidden">
            <div
              className="h-full bg-secondary/80 rounded-full"
              style={{ width: `${(r.count / max) * 100}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-zinc-400 w-6 text-right">{r.count}</span>
        </div>
      ))}
    </div>
  );
}

function LeadScatter({ points, title }: { points: BoardMetricsPayload['scatter']; title: string }) {
  const w = 320;
  const h = 140;
  const pad = 24;
  if (points.length === 0) {
    return <p className="text-xs text-zinc-600 py-6 text-center">{title}</p>;
  }
  const maxLead = Math.max(1, ...points.map((p) => p.leadDays));
  const minT = Math.min(...points.map((p) => new Date(p.resolvedIso).getTime()));
  const maxT = Math.max(...points.map((p) => new Date(p.resolvedIso).getTime()));
  const span = Math.max(1, maxT - minT);

  const pts = points.map((p) => {
    const t = new Date(p.resolvedIso).getTime();
    const x = pad + ((t - minT) / span) * (w - pad * 2);
    const y = h - pad - (p.leadDays / maxLead) * (h - pad * 2);
    return { x, y, key: p.key };
  });

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full max-w-md mx-auto text-primary/80" aria-hidden>
      {pts.map((p) => (
        <circle key={p.key} cx={p.x} cy={p.y} r={3} fill="currentColor" opacity={0.75} />
      ))}
      <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke="currentColor" strokeOpacity={0.2} strokeWidth={1} />
      <line x1={pad} y1={pad} x2={pad} y2={h - pad} stroke="currentColor" strokeOpacity={0.2} strokeWidth={1} />
    </svg>
  );
}

function formatShortDate(iso: string | null | undefined, locale: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(locale === 'pt' ? 'pt-BR' : 'en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function BoardDashboard({ board, projectKey, onBack }: BoardDashboardProps) {
  const { t, locale } = useLocale();
  const [data, setData] = useState<BoardMetricsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [historyDays, setHistoryDays] = useState<number>(365);
  const domain = getConfig().jira?.domain?.replace(/\/$/, '') ?? '';

  const configBoardIdRaw = getConfig().jira?.boardId?.trim() ?? '';
  const metricsBoardId = useMemo(() => {
    const n = configBoardIdRaw ? Number(configBoardIdRaw) : NaN;
    if (configBoardIdRaw && Number.isFinite(n)) return n;
    return board.id;
  }, [configBoardIdRaw, board.id]);

  const [displayBoard, setDisplayBoard] = useState<JiraBoardSummary>(board);

  useEffect(() => {
    if (metricsBoardId === board.id) {
      setDisplayBoard(board);
      return;
    }
    let cancelled = false;
    fetchJiraBoards(projectKey.trim() || undefined)
      .then((list) => {
        const found = list.find((b) => b.id === metricsBoardId);
        if (!cancelled && found) setDisplayBoard(found);
        else if (!cancelled)
          setDisplayBoard({
            id: metricsBoardId,
            name: `Board ${metricsBoardId}`,
            type: board.type,
            projectKey: projectKey.trim() || board.projectKey,
          });
      })
      .catch(() => {
        if (!cancelled) {
          setDisplayBoard({
            id: metricsBoardId,
            name: `Board ${metricsBoardId}`,
            type: board.type,
            projectKey: projectKey.trim() || board.projectKey,
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [metricsBoardId, board, projectKey]);

  const effectiveProjectKey =
    displayBoard.projectKey?.trim() || projectKey.trim() || getConfig().jira?.projectKey?.trim() || '';

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchBoardMetrics(metricsBoardId, effectiveProjectKey, historyDays)
      .then(setData)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : t('boardDashboard.error')))
      .finally(() => setLoading(false));
  }, [metricsBoardId, effectiveProjectKey, historyDays, t]);

  useEffect(() => {
    load();
  }, [load]);

  const jiraBoardHref =
    domain && effectiveProjectKey
      ? jiraSoftwareBoardUrl(domain, effectiveProjectKey, metricsBoardId)
      : '#';

  const isSprintView = data?.metricsView === 'active_sprint' && data.activeSprint != null;
  const sprint = data?.activeSprint;

  return (
    <div className="p-8 max-w-7xl mx-auto w-full space-y-8 pb-24">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 text-[11px] font-bold text-zinc-500 hover:text-white transition-colors"
          >
            <ArrowLeft size={14} />
            {t('boardDashboard.back')}
          </button>
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-3xl font-extrabold tracking-tighter text-white">{displayBoard.name}</h2>
            <span className="text-[10px] font-mono text-zinc-500">
              {displayBoard.type} · ID {metricsBoardId}
            </span>
          </div>
          <p className="text-sm text-zinc-500 max-w-2xl">
            {isSprintView && sprint && data
              ? interpolate(t('boardDashboard.sprintScopeNote'), {
                  name: sprint.name,
                  start: formatShortDate(sprint.startIso, locale),
                  end: formatShortDate(sprint.endIso, locale),
                  cap: String(data.sampleCap ?? '—'),
                })
              : interpolate(t('boardDashboard.windowNote'), {
                  days: String(data?.windowDays ?? historyDays),
                })}
          </p>
          {data?.metricsView === 'rolling_window' && (
            <p className="text-[11px] text-zinc-600 max-w-2xl">{t('boardDashboard.rollingNoSprintNote')}</p>
          )}
          {data?.baseJqlSource === 'project_fallback' && (
            <p className="text-[11px] text-amber-500/90">{t('boardDashboard.filterFallback')}</p>
          )}
          {data?.resolvedMetricsScope === 'project' && (
            <p className="text-[11px] text-sky-400/90">
              {interpolate(t('boardDashboard.resolvedProjectScope'), { project: projectKey })}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-[11px] text-zinc-500 shrink-0">
            <span className="font-bold whitespace-nowrap">{t('boardDashboard.analysisPeriod')}</span>
            <select
              value={historyDays}
              onChange={(e) => setHistoryDays(Number(e.target.value))}
              disabled={loading}
              className="rounded-lg bg-surface-highest border border-outline-variant/10 text-zinc-200 text-xs font-mono px-2 py-1.5 min-w-[7rem] disabled:opacity-50"
            >
              {HISTORY_WINDOW_DAYS.map((d) => (
                <option key={d} value={d}>
                  {interpolate(t('boardDashboard.periodOption'), { days: String(d) })}
                </option>
              ))}
            </select>
          </label>
          <a
            href={jiraBoardHref}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-bold px-4 py-2 rounded-xl bg-surface-highest border border-outline-variant/10 text-zinc-300 hover:text-white transition-colors"
          >
            {t('projects.openJira')}
          </a>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-xl bg-surface-highest border border-outline-variant/10 text-zinc-300 hover:text-white disabled:opacity-40"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            {t('boardDashboard.refresh')}
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-error">{error}</p>}

      {loading && !data && (
        <div className="flex items-center gap-2 text-zinc-500 text-sm">
          <Loader size={18} className="animate-spin" />
          {t('boardDashboard.loading')}
        </div>
      )}

      {data && (
        <>
          {data.capped && (
            <p className="text-[11px] text-amber-500/90 bg-amber-500/5 border border-amber-500/20 rounded-xl px-4 py-2">
              {interpolate(
                isSprintView ? t('boardDashboard.cappedNoteSprint') : t('boardDashboard.cappedNote'),
                { cap: String(data.sampleCap ?? '—') }
              )}
            </p>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {isSprintView ? (
              <>
                <MetricCard
                  label={t('boardDashboard.sprintOpen')}
                  value={data.openInSprint ?? data.openIssuesSample}
                />
                <MetricCard label={t('boardDashboard.sprintCompleted')} value={data.completedInWindow} />
                <MetricCard
                  label={t('boardDashboard.avgLead')}
                  value={data.avgLeadTimeDays != null ? `${data.avgLeadTimeDays}d` : '—'}
                />
                <MetricCard
                  label={t('boardDashboard.medianLead')}
                  value={data.medianLeadTimeDays != null ? `${data.medianLeadTimeDays}d` : '—'}
                />
              </>
            ) : (
              <>
                <MetricCard label={t('boardDashboard.completed7d')} value={data.completedLast7d} />
                <MetricCard label={t('boardDashboard.completed30d')} value={data.completedLast30d} />
                <MetricCard
                  label={t('boardDashboard.avgLead')}
                  value={data.avgLeadTimeDays != null ? `${data.avgLeadTimeDays}d` : '—'}
                />
                <MetricCard
                  label={t('boardDashboard.medianLead')}
                  value={data.medianLeadTimeDays != null ? `${data.medianLeadTimeDays}d` : '—'}
                />
              </>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <motion.div
              layout
              className="bg-surface-low rounded-2xl border border-outline-variant/10 p-5 space-y-2"
            >
              <div className="flex items-center gap-2 text-zinc-400">
                <BarChart3 size={16} />
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">{t('boardDashboard.throughput')}</span>
              </div>
              <ThroughputBars
                rows={data.throughputByWeek}
                emptyLabel={isSprintView ? t('boardDashboard.emptyThroughputSprint') : t('boardDashboard.emptyThroughput')}
              />
            </motion.div>

            <motion.div
              layout
              className="bg-surface-low rounded-2xl border border-outline-variant/10 p-5 space-y-2"
            >
              <div className="flex items-center gap-2 text-zinc-400">
                <Activity size={16} />
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">{t('boardDashboard.histogramTitle')}</span>
              </div>
              <p className="text-[11px] text-zinc-600">
                {isSprintView ? t('boardDashboard.histogramHintSprint') : t('boardDashboard.histogramHint')}
              </p>
              <HistogramBars rows={data.leadTimeHistogram} />
            </motion.div>

            <motion.div
              layout
              className="bg-surface-low rounded-2xl border border-outline-variant/10 p-5 space-y-3 lg:col-span-2"
            >
              <div className="flex items-center gap-2 text-zinc-400">
                <ChartScatter size={16} />
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">{t('boardDashboard.scatterTitle')}</span>
              </div>
              <p className="text-[11px] text-zinc-600">
                {isSprintView ? t('boardDashboard.scatterHintSprint') : t('boardDashboard.scatterHint')}
              </p>
              <LeadScatter points={data.scatter} title={t('boardDashboard.emptyScatter')} />
            </motion.div>

            <motion.div
              layout
              className="bg-surface-low rounded-2xl border border-outline-variant/10 p-5 space-y-3"
            >
              <div className="flex items-center gap-2 text-zinc-400">
                <Table2 size={16} />
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">{t('boardDashboard.byType')}</span>
              </div>
              <div className="overflow-hidden rounded-xl border border-outline-variant/10">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-outline-variant/10 text-[10px] uppercase tracking-wider text-zinc-500">
                      <th className="px-3 py-2 font-black">{t('boardDashboard.colType')}</th>
                      <th className="px-3 py-2 font-black text-right">{t('boardDashboard.colCount')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byIssueType.length === 0 ? (
                      <tr>
                        <td colSpan={2} className="px-3 py-6 text-center text-zinc-600">
                          {t('boardDashboard.emptyTable')}
                        </td>
                      </tr>
                    ) : (
                      data.byIssueType.map((row) => (
                        <tr key={row.type} className="border-b border-outline-variant/5 last:border-0">
                          <td className="px-3 py-2 text-zinc-300">{row.type}</td>
                          <td className="px-3 py-2 text-right font-mono text-zinc-400">{row.count}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>

            <motion.div
              layout
              className="bg-surface-low rounded-2xl border border-outline-variant/10 p-5 space-y-2"
            >
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">{t('boardDashboard.openWip')}</p>
              <p className="text-3xl font-black text-white">
                {data.openIssuesSample}
                {data.openIssuesHasMore ? '+' : ''}
              </p>
              <p className="text-[11px] text-zinc-600">
                {isSprintView ? t('boardDashboard.openWipHintSprint') : t('boardDashboard.openWipHint')}
              </p>
              <p className="text-[10px] text-zinc-600 pt-2">
                {interpolate(
                  isSprintView ? t('boardDashboard.sampleNoteSprint') : t('boardDashboard.sampleNote'),
                  { n: String(data.sampledResolved) }
                )}
              </p>
            </motion.div>
          </div>

          <div className="rounded-2xl border border-outline-variant/10 bg-surface-low/50 p-5 space-y-3">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">{t('boardDashboard.methodsTitle')}</p>
            <ul className="text-[11px] text-zinc-600 space-y-2 list-disc pl-4 leading-relaxed">
              {isSprintView ? (
                <>
                  <li>{t('boardDashboard.methodsSprintScope')}</li>
                  <li>{t('boardDashboard.methodsSprintResolved')}</li>
                  <li>{t('boardDashboard.methodsSprintLead')}</li>
                  <li>{t('boardDashboard.methodsSprintOpen')}</li>
                  <li>{t('boardDashboard.methodsSample')}</li>
                </>
              ) : (
                <>
                  <li>{t('boardDashboard.methodsScope')}</li>
                  <li>{t('boardDashboard.methodsThroughput')}</li>
                  <li>{interpolate(t('boardDashboard.methodsLead'), { days: String(data.windowDays) })}</li>
                  <li>{t('boardDashboard.methodsCounts')}</li>
                  <li>{t('boardDashboard.methodsSample')}</li>
                  <li>{t('boardDashboard.methodsOpen')}</li>
                </>
              )}
            </ul>
          </div>

          <p className="text-[10px] text-zinc-600 leading-relaxed border-t border-outline-variant/10 pt-6">
            {t('boardDashboard.footnote')}
          </p>
        </>
      )}
    </div>
  );
}
