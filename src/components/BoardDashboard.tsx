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

const TYPE_COLORS = ['#818cf8', '#34d399', '#fbbf24', '#f472b6', '#60a5fa'];
const OTHER_COLOR = '#71717a';
const TOP_TYPE_COUNT = 4;

function ThroughputBars({
  rows,
  emptyLabel,
  t,
}: {
  rows: BoardMetricsPayload['throughputByWeek'];
  emptyLabel: string;
  t: (key: string) => string;
}) {
  const counts = useMemo(() => rows.map((r) => r.count), [rows]);

  const topTypes = useMemo(() => {
    const totals = new Map<string, number>();
    for (const r of rows) {
      for (const [type, n] of Object.entries(r.byType || {})) {
        totals.set(type, (totals.get(type) || 0) + n);
      }
    }
    return [...totals.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, TOP_TYPE_COUNT)
      .map(([type]) => type);
  }, [rows]);

  const sortedCounts = useMemo(() => [...counts].sort((a, b) => a - b), [counts]);
  const median = percentile(sortedCounts, 50);
  const p85 = percentile(sortedCounts, 85);

  const max = Math.max(1, ...counts, Math.ceil(p85));
  const gridLines = useMemo(() => {
    const step = Math.max(1, Math.ceil(max / 4));
    const lines: number[] = [];
    for (let v = step; v <= max; v += step) lines.push(v);
    if (lines[lines.length - 1] !== max) lines.push(max);
    return lines;
  }, [max]);

  if (rows.length === 0) {
    return <p className="text-xs text-zinc-600 py-8 text-center">{emptyLabel}</p>;
  }

  const BAR_AREA = 140;
  const fmtStat = (v: number) => (v < 10 ? v.toFixed(1) : String(Math.round(v)));

  return (
    <div className="pt-4">
      <div className="flex gap-2">
        <div className="flex flex-col justify-between text-right shrink-0" style={{ height: BAR_AREA }}>
          {[...gridLines].reverse().map((v) => (
            <span key={v} className="text-[9px] font-mono text-zinc-600 leading-none">
              {v}
            </span>
          ))}
          <span className="text-[9px] font-mono text-zinc-600 leading-none">0</span>
        </div>
        <div className="flex-1 min-w-0 flex items-end gap-2 px-1 relative" style={{ height: BAR_AREA }}>
          {gridLines.map((v) => (
            <div
              key={v}
              className="absolute left-0 right-0 border-t border-dashed border-outline-variant/10"
              style={{ bottom: `${(v / max) * 100}%` }}
            />
          ))}

          {p85 > 0 && (
            <div className="absolute left-0 right-0 z-20 flex items-center" style={{ bottom: `${(p85 / max) * 100}%` }}>
              <div className="w-full border-t border-dashed" style={{ borderColor: '#fbbf24', opacity: 0.8 }} />
              <span className="absolute right-0 -translate-y-3 text-[9px] font-bold" style={{ color: '#fbbf24' }}>
                {t('boardDashboard.throughputP85')} {fmtStat(p85)}
              </span>
            </div>
          )}
          {median > 0 && (
            <div className="absolute left-0 right-0 z-20 flex items-center" style={{ bottom: `${(median / max) * 100}%` }}>
              <div className="w-full border-t" style={{ borderColor: '#e4e4e7', opacity: 0.7 }} />
              <span className="absolute left-0 -translate-y-3 text-[9px] font-bold text-zinc-300">
                {t('boardDashboard.throughputMedian')} {fmtStat(median)}
              </span>
            </div>
          )}

          {rows.map((r) => {
            const otherCount = Math.max(0, r.count - topTypes.reduce((s, ty) => s + (r.byType?.[ty] || 0), 0));
            const segments = [...topTypes.map((ty) => ({ type: ty, count: r.byType?.[ty] || 0 })), ...(otherCount > 0 ? [{ type: '__other__', count: otherCount }] : [])];
            return (
              <div
                key={r.weekStartIso}
                className="flex-1 min-w-0 h-full flex flex-col items-center justify-end gap-1 group relative z-10"
              >
                <span
                  className={`text-[10px] font-black leading-none ${r.count > 0 ? 'text-zinc-200' : 'text-zinc-700'}`}
                >
                  {r.count}
                </span>
                <div
                  className="w-full max-w-[36px] mx-auto flex flex-col-reverse rounded-t-md overflow-hidden shadow-sm transition-opacity group-hover:opacity-90"
                  title={`${r.weekLabel}: ${r.count}`}
                >
                  {segments.map((s, i) => (
                    <div
                      key={s.type}
                      style={{
                        height: `${(s.count / max) * BAR_AREA}px`,
                        backgroundColor: s.type === '__other__' ? OTHER_COLOR : TYPE_COLORS[topTypes.indexOf(s.type) % TYPE_COLORS.length],
                        opacity: 0.9,
                      }}
                      className={i === segments.length - 1 ? 'rounded-t-md' : ''}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex gap-2 mt-1.5">
        <div className="shrink-0" style={{ width: 18 }} />
        <div className="flex-1 min-w-0 flex gap-2 px-1">
          {rows.map((r) => (
            <span
              key={r.weekStartIso}
              className="flex-1 min-w-0 text-[9px] font-bold text-zinc-600 truncate text-center leading-tight"
            >
              {r.weekLabel.replace(/, \d{4}$/, '')}
            </span>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[10px] text-zinc-500 pt-3 mt-1 border-t border-outline-variant/5">
        {topTypes.map((ty) => (
          <span key={ty} className="flex items-center gap-1.5">
            <LegendDot color={TYPE_COLORS[topTypes.indexOf(ty) % TYPE_COLORS.length]} />
            {ty}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <LegendDot color={OTHER_COLOR} />
          {t('boardDashboard.legendOther')}
        </span>
        <span className="flex items-center gap-1.5">
          <LegendLine color="#e4e4e7" />
          {t('boardDashboard.throughputMedian')}
        </span>
        <span className="flex items-center gap-1.5">
          <LegendLine color="#fbbf24" dashed />
          {t('boardDashboard.throughputP85')}
        </span>
      </div>
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

function niceMax(v: number): number {
  if (v <= 5) return Math.max(1, Math.ceil(v));
  const magnitude = 10 ** Math.floor(Math.log10(v));
  const step = magnitude / 2;
  return Math.ceil(v / step) * step;
}

function mean(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;
}

function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(mean(values.map((v) => (v - m) ** 2)));
}

function percentile(sortedValues: number[], p: number): number {
  if (sortedValues.length === 0) return 0;
  const idx = (p / 100) * (sortedValues.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sortedValues[lo];
  return sortedValues[lo] + (sortedValues[hi] - sortedValues[lo]) * (idx - lo);
}

function StatBadge({ value, label, className }: { value: string; label: string; className?: string }) {
  return (
    <div className="flex flex-col items-center px-3">
      <span className={`text-sm font-black leading-tight ${className ?? 'text-white'}`}>{value}</span>
      <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-600 whitespace-nowrap">{label}</span>
    </div>
  );
}

function LegendDot({ color }: { color: string }) {
  return <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />;
}

function LegendLine({ color, dashed }: { color: string; dashed?: boolean }) {
  return (
    <svg width="14" height="8" className="shrink-0">
      <line
        x1={0}
        y1={4}
        x2={14}
        y2={4}
        stroke={color}
        strokeWidth={2}
        strokeDasharray={dashed ? '3 2' : undefined}
      />
    </svg>
  );
}

const CHART_COLOR = {
  issue: '#818cf8',
  average: '#38bdf8',
  threshold: '#f87171',
  percentile: '#a1a1aa',
  rolling: '#34d399',
  band: '#34d399',
};

function LeadTimeControlChart({
  points,
  title,
  locale,
  t,
}: {
  points: BoardMetricsPayload['scatter'];
  title: string;
  locale: string;
  t: (key: string) => string;
}) {
  const w = 720;
  const h = 300;
  const padL = 34;
  const padR = 16;
  const padT = 16;
  const padB = 30;

  if (points.length === 0) {
    return <p className="text-xs text-zinc-600 py-6 text-center">{title}</p>;
  }

  const sorted = [...points].sort(
    (a, b) => new Date(a.resolvedIso).getTime() - new Date(b.resolvedIso).getTime()
  );
  const leadValues = sorted.map((p) => p.leadDays);
  const sortedLeadValues = [...leadValues].sort((a, b) => a - b);

  const avg = mean(leadValues);
  const dev = stddev(leadValues);
  const p75 = percentile(sortedLeadValues, 75);
  const threshold = avg + 2 * dev;
  const breaches = leadValues.filter((v) => v > threshold).length;

  const rollWindow = Math.max(3, Math.min(7, Math.round(sorted.length / 6)));
  const rolling = sorted.map((_, i) => {
    const slice = leadValues.slice(Math.max(0, i - rollWindow + 1), i + 1);
    return { avg: mean(slice), dev: stddev(slice) };
  });

  const rawMaxLead = Math.max(...leadValues, threshold);
  const maxLead = niceMax(rawMaxLead);
  const minT = new Date(sorted[0].resolvedIso).getTime();
  const maxT = new Date(sorted[sorted.length - 1].resolvedIso).getTime();
  const span = Math.max(1, maxT - minT);

  const plotW = w - padL - padR;
  const plotH = h - padT - padB;

  const xOf = (t2: number) => padL + (span > 0 ? ((t2 - minT) / span) * plotW : plotW / 2);
  const yOf = (v: number) => padT + plotH - (Math.max(0, v) / maxLead) * plotH;

  const pts = sorted.map((p, i) => ({
    x: xOf(new Date(p.resolvedIso).getTime()),
    y: yOf(p.leadDays),
    key: p.key,
    leadDays: p.leadDays,
    resolvedIso: p.resolvedIso,
    i,
  }));

  const bandUpper = pts.map((p, i) => `${p.x},${yOf(rolling[i].avg + rolling[i].dev)}`);
  const bandLower = pts
    .map((p, i) => `${p.x},${yOf(rolling[i].avg - rolling[i].dev)}`)
    .reverse();
  const bandPath = `${bandUpper.join(' ')} ${bandLower.join(' ')}`;
  const rollingPath = pts.map((p, i) => `${p.x},${yOf(rolling[i].avg)}`).join(' ');

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(maxLead * f));
  const xTickCount = Math.min(5, sorted.length);
  const xTicks = Array.from({ length: xTickCount }, (_, i) => {
    const tt = xTickCount === 1 ? minT : minT + (span * i) / (xTickCount - 1);
    return { t: tt, x: xOf(tt) };
  });

  const fmtDays = (v: number) => `${v < 10 ? v.toFixed(1) : Math.round(v)}d`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-y-2 -mx-3 border-b border-outline-variant/10 pb-3">
        <StatBadge value={String(sorted.length)} label={t('boardDashboard.scatterItems')} />
        <StatBadge value={fmtDays(avg)} label={t('boardDashboard.scatterAverage')} className="text-sky-400" />
        <StatBadge value={fmtDays(threshold)} label={t('boardDashboard.scatterThreshold')} className="text-red-400" />
        <StatBadge value={String(breaches)} label={t('boardDashboard.scatterBreaches')} className={breaches > 0 ? 'text-amber-400' : 'text-white'} />
        <StatBadge value={fmtDays(p75)} label={t('boardDashboard.scatterPercentile')} />
      </div>

      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label={title}>
        {yTicks.map((v) => {
          const y = yOf(v);
          return (
            <g key={v}>
              <line
                x1={padL}
                y1={y}
                x2={w - padR}
                y2={y}
                stroke="currentColor"
                strokeOpacity={0.08}
                strokeDasharray="3 3"
                strokeWidth={1}
                className="text-zinc-400"
              />
              <text x={padL - 8} y={y} textAnchor="end" dominantBaseline="middle" className="fill-zinc-500" fontSize={9}>
                {v}d
              </text>
            </g>
          );
        })}

        {xTicks.map(({ t: tt, x }) => (
          <text key={tt} x={x} y={h - padB + 16} textAnchor="middle" className="fill-zinc-500" fontSize={9}>
            {formatShortDate(new Date(tt).toISOString(), locale).replace(/ de \d{4}$/, '').replace(/, \d{4}$/, '')}
          </text>
        ))}

        {/* rolling std-dev band */}
        <polygon points={bandPath} fill={CHART_COLOR.band} fillOpacity={0.12} stroke="none" />

        {/* percentile 75 (dashed) */}
        <line x1={padL} y1={yOf(p75)} x2={w - padR} y2={yOf(p75)} stroke={CHART_COLOR.percentile} strokeOpacity={0.7} strokeDasharray="4 3" strokeWidth={1.25} />
        <text x={w - padR - 4} y={yOf(p75) - 4} textAnchor="end" fontSize={9} fill={CHART_COLOR.percentile}>
          75%
        </text>

        {/* average (solid) */}
        <line x1={padL} y1={yOf(avg)} x2={w - padR} y2={yOf(avg)} stroke={CHART_COLOR.average} strokeOpacity={0.85} strokeWidth={1.5} />

        {/* threshold (solid) */}
        <line x1={padL} y1={yOf(threshold)} x2={w - padR} y2={yOf(threshold)} stroke={CHART_COLOR.threshold} strokeOpacity={0.85} strokeWidth={1.5} />

        {/* rolling average */}
        <polyline points={rollingPath} fill="none" stroke={CHART_COLOR.rolling} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        <line x1={padL} y1={padT + plotH} x2={w - padR} y2={padT + plotH} stroke="currentColor" strokeOpacity={0.25} strokeWidth={1} className="text-zinc-400" />
        <line x1={padL} y1={padT} x2={padL} y2={padT + plotH} stroke="currentColor" strokeOpacity={0.25} strokeWidth={1} className="text-zinc-400" />

        {pts.map((p) => (
          <circle key={p.key} cx={p.x} cy={p.y} r={4} fill={CHART_COLOR.issue} opacity={0.8}>
            <title>{`${formatShortDate(p.resolvedIso, locale)} — ${p.leadDays}d`}</title>
          </circle>
        ))}
      </svg>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10px] text-zinc-500">
        <span className="flex items-center gap-1.5"><LegendDot color={CHART_COLOR.issue} />{t('boardDashboard.legendIssue')}</span>
        <span className="flex items-center gap-1.5"><LegendLine color={CHART_COLOR.average} />{t('boardDashboard.legendAverage')}</span>
        <span className="flex items-center gap-1.5"><LegendLine color={CHART_COLOR.threshold} />{t('boardDashboard.legendThreshold')}</span>
        <span className="flex items-center gap-1.5"><LegendLine color={CHART_COLOR.percentile} dashed />{t('boardDashboard.legendPercentile')}</span>
        <span className="flex items-center gap-1.5"><LegendLine color={CHART_COLOR.rolling} />{t('boardDashboard.legendRollingAvg')}</span>
        <span className="flex items-center gap-1.5"><LegendDot color={CHART_COLOR.band} />{t('boardDashboard.legendStdDev')}</span>
      </div>
    </div>
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
                t={t}
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
              <LeadTimeControlChart points={data.scatter} title={t('boardDashboard.emptyScatter')} locale={locale} t={t} />
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
