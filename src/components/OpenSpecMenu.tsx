import { useState, useEffect, useRef, useCallback, type MouseEvent as ReactMouseEvent } from 'react';
import { ChevronDown, Sparkles, Loader, GitPullRequest, ShieldCheck, Send, ExternalLink } from 'lucide-react';
import { isGithubConfigured } from '../api/config';
import { fetchLocalRepoFolders, openIdeFolderOnServer, type LocalRepoFolder } from '../api/workspace';
import {
  generateIssueSpec,
  fetchIssuePrs,
  reviewIssuePr,
  publishPrReview,
  type IssuePr,
  type PrReviewFinding,
} from '../api/spec';
import { useLocale, interpolate } from '../locales';
import type { OpenspecScope } from '../lib/openspecBindings';
import { getOpenspecRepoFolder, setOpenspecRepoFolder } from '../lib/openspecBindings';
import { IDE_OPTIONS } from '../lib/ideDeepLinks';
import { AntigravityBrandIcon, CursorBrandIcon, KiroBrandIcon, VsCodeBrandIcon } from './IdeBrandIcons';
import OpenspecCliMarkdown from './OpenspecCliMarkdown';

interface OpenSpecMenuProps {
  scope: OpenspecScope;
  jiraKey: string;
  issueTitle: string;
  description: string | null;
  descriptionLoading?: boolean;
  compact?: boolean;
}

function IdeIcon({ id }: { id: (typeof IDE_OPTIONS)[number]['id'] }) {
  if (id === 'cursor') return <CursorBrandIcon />;
  if (id === 'antigravity') return <AntigravityBrandIcon />;
  if (id === 'kiro') return <KiroBrandIcon />;
  return <VsCodeBrandIcon />;
}

export default function OpenSpecMenu({
  scope,
  jiraKey,
  issueTitle,
  description,
  descriptionLoading = false,
  compact = false,
}: OpenSpecMenuProps) {
  const { t } = useLocale();
  const rootRef = useRef<HTMLDivElement>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [repos, setRepos] = useState<LocalRepoFolder[]>([]);
  const [reposLoading, setReposLoading] = useState(false);
  const [reposError, setReposError] = useState<string | null>(null);
  const [selectedName, setSelectedName] = useState('');
  const [generating, setGenerating] = useState(false);
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [savedPath, setSavedPath] = useState<string | null>(null);
  const [savedFiles, setSavedFiles] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ideOpening, setIdeOpening] = useState<string | null>(null);
  const [prs, setPrs] = useState<IssuePr[]>([]);
  const [prsLoading, setPrsLoading] = useState(false);
  const [prsError, setPrsError] = useState<string | null>(null);
  const [selectedPr, setSelectedPr] = useState<number | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [review, setReview] = useState<{
    reviewId: string;
    markdown: string;
    findings: PrReviewFinding[];
    savedPath: string | null;
    prNumber: number;
  } | null>(null);
  /** Identifies the issue/repo/PR a review belongs to; responses for a stale selection are dropped. */
  const reviewContext = `${jiraKey}|${selectedName.trim()}|${selectedPr ?? ''}`;
  const reviewContextRef = useRef(reviewContext);
  reviewContextRef.current = reviewContext;
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);

  const workspaceReady = isGithubConfigured();

  useEffect(() => {
    setMarkdown(null);
    setSavedPath(null);
    setSavedFiles([]);
    setError(null);
    setSelectedName(getOpenspecRepoFolder(scope, jiraKey) || '');
  }, [scope, jiraKey, description]);

  useEffect(() => {
    if (!panelOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setPanelOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [panelOpen]);

  const loadRepos = useCallback(async () => {
    setReposLoading(true);
    setReposError(null);
    const { repos: list, error: err } = await fetchLocalRepoFolders();
    setReposLoading(false);
    if (err) {
      setReposError(err);
      setRepos([]);
      return;
    }
    setRepos(list);
    if (list.length === 1 && !getOpenspecRepoFolder(scope, jiraKey)) {
      const only = list[0].name;
      setSelectedName(only);
      setOpenspecRepoFolder(scope, jiraKey, only);
    }
  }, [scope, jiraKey]);

  useEffect(() => {
    if (!panelOpen || !workspaceReady) return;
    void loadRepos();
  }, [panelOpen, workspaceReady, loadRepos]);

  useEffect(() => {
    setPrs([]);
    setPrsError(null);
    setSelectedPr(null);
    setReviewing(false);
    setReview(null);
    setReviewError(null);
    setConfirmPublish(false);
    setPublishedUrl(null);
    if (!panelOpen || !selectedName.trim()) return;

    let cancelled = false;
    setPrsLoading(true);
    void fetchIssuePrs(jiraKey, selectedName.trim()).then((result) => {
      if (cancelled) return;
      setPrsLoading(false);
      if (result.ok === false) {
        setPrsError(result.message);
        return;
      }
      setPrs(result.prs);
      setSelectedPr(result.prs[0]?.number ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [panelOpen, selectedName, jiraKey]);

  const runReview = async () => {
    if (selectedPr == null || !selectedName.trim()) return;
    setReviewing(true);
    setReviewError(null);
    setReview(null);
    setConfirmPublish(false);
    setPublishedUrl(null);
    const requestedFor = reviewContext;
    const result = await reviewIssuePr({ jiraKey, repoName: selectedName.trim(), prNumber: selectedPr });
    if (reviewContextRef.current !== requestedFor) return; // selection changed while reviewing
    setReviewing(false);
    if (result.ok === false) {
      setReviewError(result.message);
      return;
    }
    setReview(result.data);
  };

  const runPublish = async () => {
    if (!review) return;
    setPublishing(true);
    setReviewError(null);
    const result = await publishPrReview({ reviewId: review.reviewId });
    setPublishing(false);
    setConfirmPublish(false);
    if (result.ok === false) {
      setReviewError(result.message);
      return;
    }
    setPublishedUrl(result.data.url || null);
  };

  const onSelectRepo = (name: string) => {
    setSelectedName(name);
    setOpenspecRepoFolder(scope, jiraKey, name);
  };

  const runGenerate = async () => {
    if (descriptionLoading) {
      setError(t('openspec.descriptionLoading'));
      return;
    }
    if (!description?.trim()) {
      setError(t('openspec.noDescription'));
      return;
    }
    if (!selectedName.trim()) {
      setError(t('openspec.repoRequired'));
      return;
    }

    setGenerating(true);
    setError(null);
    setMarkdown(null);
    setSavedPath(null);
    setSavedFiles([]);

    const result = await generateIssueSpec({
      jiraKey,
      title: issueTitle,
      description: description.trim(),
      repoName: selectedName.trim(),
    });

    setGenerating(false);

    if (!result.markdown) {
      setError(result.message || t('openspec.generateError'));
      return;
    }

    setMarkdown(result.markdown);
    const pathSaved = result.savedAbsolutePath || result.savedPath;
    if (pathSaved) {
      setSavedPath(pathSaved);
      setSavedFiles(result.files ?? []);
      setError(null);
    } else {
      setError(result.message || t('openspec.saveFailed'));
    }
  };

  const handleTogglePanel = (e: ReactMouseEvent) => {
    e.stopPropagation();
    setPanelOpen((open) => !open);
  };

  const handleOpenIde = async (ide: (typeof IDE_OPTIONS)[number]['id']) => {
    if (!selectedName.trim()) return;

    setIdeOpening(ide);
    const result = await openIdeFolderOnServer({
      ide,
      repoName: selectedName.trim(),
      newWindow: true,
    });
    setIdeOpening(null);

    if (!result.ok) {
      setError(result.message || t('openspec.openIdeFailed'));
      return;
    }
    setError(null);
  };

  const menuWidth = compact ? 'w-[min(100vw-2rem,360px)]' : 'w-[min(100vw-2rem,480px)]';

  const repoFolderAbs = selectedName
    ? repos.find((r) => r.name === selectedName)?.absolutePath ?? null
    : null;

  const importantCount = review?.findings.filter((f) => f.severity === 'important').length ?? 0;

  const canGenerate =
    !!description?.trim() && !descriptionLoading && !!selectedName.trim() && !generating;

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={handleTogglePanel}
        className={`inline-flex items-center gap-1.5 rounded-xl border border-outline-variant/15 bg-surface-highest/90 text-zinc-200 hover:text-white hover:border-primary/30 transition-colors ${
          compact ? 'px-2 py-1.5 text-[10px] font-bold' : 'px-3 py-2 text-[11px] font-bold'
        }`}
        aria-expanded={panelOpen}
        aria-haspopup="dialog"
        aria-label={t('openspec.menuAria')}
      >
        <Sparkles size={compact ? 14 : 16} className="text-primary shrink-0" />
        {!compact && <span>{t('openspec.menuLabel')}</span>}
        <ChevronDown size={14} className={`opacity-60 transition-transform shrink-0 ${panelOpen ? 'rotate-180' : ''}`} />
      </button>

      {panelOpen && (
        <div
          className={`absolute right-0 top-full mt-1 z-[200] max-h-[min(72dvh,36rem)] overflow-y-auto overflow-x-hidden ${menuWidth} rounded-xl border border-outline-variant/15 bg-[#1a1a1c] shadow-xl py-3 px-3 space-y-3`}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          role="dialog"
          aria-label={t('openspec.panelAria')}
        >
          <p className="text-[10px] text-zinc-500 leading-relaxed px-0.5">{t('openspec.sddHint')}</p>

          {!workspaceReady ? (
            <p className="text-[11px] text-zinc-500 leading-relaxed px-1">{t('openspec.needSettings')}</p>
          ) : reposLoading ? (
            <div className="flex items-center gap-2 text-zinc-500 text-xs py-1 px-1">
              <Loader size={14} className="animate-spin" />
              …
            </div>
          ) : reposError ? (
            <p className="text-[11px] text-error/90 px-1">{reposError}</p>
          ) : repos.length === 0 ? (
            <p className="text-[11px] text-zinc-500 px-1">{t('openspec.noRepos')}</p>
          ) : (
            <label className="block space-y-1 px-1">
              <span className="text-[9px] font-black uppercase tracking-[0.15em] text-zinc-600">
                {t('openspec.repoLabel')}
              </span>
              <select
                value={selectedName}
                onChange={(e) => onSelectRepo(e.target.value)}
                className="w-full bg-surface-highest text-zinc-200 text-xs font-mono px-2 py-2 rounded-lg border border-outline-variant/10"
              >
                <option value="">{t('openspec.selectRepo')}</option>
                {repos.map((r) => (
                  <option key={r.absolutePath} value={r.name}>
                    {r.name}
                  </option>
                ))}
              </select>
              <span className="text-[9px] text-zinc-600 leading-relaxed">{t('openspec.repoHint')}</span>
            </label>
          )}

          {repoFolderAbs ? (
            <div className="space-y-1.5 px-1 border-t border-outline-variant/10 pt-2">
              <p className="text-[9px] font-black uppercase tracking-[0.15em] text-zinc-600">
                {t('openspec.openIdeHeading')}
              </p>
              <div className="flex items-center gap-1.5">
                {IDE_OPTIONS.map(({ id, labelKey }) => {
                  const busy = ideOpening === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      disabled={busy || !!ideOpening}
                      onClick={() => void handleOpenIde(id)}
                      aria-label={t(labelKey)}
                      title={t(labelKey)}
                      className="inline-flex items-center justify-center rounded-lg border border-outline-variant/15 bg-surface-highest/90 p-2 text-zinc-200 hover:text-white hover:border-primary/30 disabled:opacity-50"
                    >
                      {busy ? <Loader size={18} className="animate-spin shrink-0" /> : <IdeIcon id={id} />}
                    </button>
                  );
                })}
              </div>
              <p className="text-[9px] text-zinc-600 leading-relaxed">{t('openspec.openIdeHint')}</p>
            </div>
          ) : null}

          {selectedName ? (
            <div className="space-y-1.5 px-1 border-t border-outline-variant/10 pt-2">
              <p className="text-[9px] font-black uppercase tracking-[0.15em] text-zinc-600">{t('openspec.prHeading')}</p>
              {prsLoading ? (
                <div className="flex items-center gap-2 text-zinc-500 text-[10px]">
                  <Loader size={12} className="animate-spin" />
                  {t('openspec.prChecking')}
                </div>
              ) : prsError ? (
                <p className="text-[10px] text-amber-200/90 leading-relaxed">{prsError}</p>
              ) : prs.length === 0 ? (
                <p className="text-[10px] text-zinc-600 leading-relaxed">{t('openspec.prNone')}</p>
              ) : (
                <>
                  <div className="flex items-center gap-1.5">
                    {prs.length > 1 ? (
                      <select
                        value={selectedPr ?? ''}
                        onChange={(e) => {
                          setSelectedPr(Number(e.target.value));
                          setReviewing(false);
                          setReview(null);
                          setPublishedUrl(null);
                        }}
                        className="min-w-0 flex-1 bg-surface-highest text-zinc-200 text-[11px] px-2 py-1.5 rounded-lg border border-outline-variant/10"
                      >
                        {prs.map((pr) => (
                          <option key={pr.number} value={pr.number}>
                            #{pr.number} {pr.title}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <a
                        href={prs[0].url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-w-0 flex-1 inline-flex items-center gap-1.5 text-[11px] text-zinc-200 hover:text-white"
                        title={`${prs[0].headRefName} → ${prs[0].baseRefName}`}
                      >
                        <GitPullRequest size={14} className="text-emerald-400 shrink-0" />
                        <span className="truncate">
                          #{prs[0].number} {prs[0].title}
                        </span>
                        <ExternalLink size={11} className="opacity-60 shrink-0" />
                      </a>
                    )}
                    <button
                      type="button"
                      disabled={reviewing || selectedPr == null}
                      onClick={() => void runReview()}
                      className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1.5 text-[11px] font-bold text-emerald-200 hover:bg-emerald-500/15 disabled:opacity-50"
                    >
                      {reviewing ? (
                        <Loader size={13} className="animate-spin shrink-0" />
                      ) : (
                        <ShieldCheck size={13} className="shrink-0" />
                      )}
                      {reviewing ? t('openspec.reviewing') : t('openspec.reviewPr')}
                    </button>
                  </div>
                  <p className="text-[9px] text-zinc-600 leading-relaxed">{t('openspec.reviewHint')}</p>
                </>
              )}

              {reviewError ? <p className="text-[11px] text-amber-200/95 leading-relaxed">{reviewError}</p> : null}

              {review ? (
                <div className="space-y-2 pt-1">
                  <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold">
                    <span
                      className={`rounded-md px-1.5 py-0.5 ${
                        importantCount > 0 ? 'bg-red-500/15 text-red-200' : 'bg-zinc-500/15 text-zinc-300'
                      }`}
                    >
                      {interpolate(t('openspec.reviewImportant'), { count: String(importantCount) })}
                    </span>
                    <span className="rounded-md bg-zinc-500/15 text-zinc-300 px-1.5 py-0.5">
                      {interpolate(t('openspec.reviewNits'), {
                        count: String(review.findings.filter((f) => f.severity === 'nit').length),
                      })}
                    </span>
                    <span className="font-normal text-zinc-600 break-all">
                      {review.savedPath
                        ? interpolate(t('openspec.reviewSaved'), { path: review.savedPath })
                        : t('openspec.reviewNotSaved')}
                    </span>
                  </div>
                  <div className="bg-black/40 border border-outline-variant/10 rounded-lg p-3 max-h-[min(52dvh,28rem)] overflow-y-auto">
                    <OpenspecCliMarkdown source={review.markdown} className="text-[11px]" />
                  </div>
                  {publishedUrl ? (
                    <a
                      href={publishedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-300 hover:underline"
                    >
                      {t('openspec.published')}
                      <ExternalLink size={11} />
                    </a>
                  ) : confirmPublish ? (
                    <div className="space-y-1.5 rounded-lg border border-amber-400/25 bg-amber-400/10 p-2">
                      <p className="text-[11px] text-amber-100">
                        {interpolate(t('openspec.publishConfirm'), { number: String(review.prNumber) })}
                      </p>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          disabled={publishing}
                          onClick={() => void runPublish()}
                          className="inline-flex items-center gap-1 rounded-lg bg-amber-400/20 px-2 py-1 text-[10px] font-bold text-amber-100 hover:bg-amber-400/30 disabled:opacity-50"
                        >
                          {publishing ? <Loader size={11} className="animate-spin" /> : <Send size={11} />}
                          {publishing ? t('openspec.publishing') : t('openspec.publishYes')}
                        </button>
                        <button
                          type="button"
                          disabled={publishing}
                          onClick={() => setConfirmPublish(false)}
                          className="rounded-lg px-2 py-1 text-[10px] font-bold text-zinc-400 hover:text-white"
                        >
                          {t('openspec.publishCancel')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmPublish(true)}
                      className="inline-flex items-center gap-1 rounded-lg border border-outline-variant/15 bg-surface-highest/90 px-2 py-1 text-[10px] font-bold text-zinc-200 hover:text-white hover:border-primary/30"
                    >
                      <Send size={11} className="shrink-0" />
                      {t('openspec.publishPr')}
                    </button>
                  )}
                </div>
              ) : null}
            </div>
          ) : null}

          <button
            type="button"
            disabled={!canGenerate}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-primary/25 bg-primary/10 px-3 py-2.5 text-[11px] font-bold text-primary hover:bg-primary/15 disabled:opacity-50"
            onClick={() => void runGenerate()}
          >
            {generating ? (
              <>
                <Loader size={14} className="animate-spin shrink-0" />
                {t('openspec.generating')}
              </>
            ) : (
              <>
                <Sparkles size={14} className="shrink-0" />
                {t('openspec.generate')}
              </>
            )}
          </button>

          {error ? <p className="text-[11px] text-amber-200/95 leading-relaxed px-1">{error}</p> : null}

          {savedPath ? (
            <div
              className="space-y-1 px-2 py-2 rounded-lg border border-emerald-500/25 bg-emerald-500/10"
              role="status"
            >
              <p className="text-[11px] font-bold text-emerald-200/95 leading-relaxed">
                {interpolate(t('openspec.specSaved'), { path: savedPath })}
              </p>
              {savedFiles.length > 0 ? (
                <ul className="space-y-0.5 pl-0.5">
                  <li className="text-[9px] font-black uppercase tracking-[0.15em] text-emerald-200/70">
                    {t('openspec.filesGenerated')}
                  </li>
                  {savedFiles.map((f) => (
                    <li key={f} className="text-[10px] font-mono text-emerald-100/80 break-all">
                      {f}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          {markdown ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 px-0.5 border-t border-outline-variant/10 pt-2">
                <p className="text-[9px] font-black uppercase tracking-[0.15em] text-zinc-600">
                  {t('openspec.specReady')}
                </p>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-lg border border-outline-variant/15 bg-surface-highest/90 px-2 py-1 text-[10px] font-bold text-zinc-200 hover:text-white hover:border-primary/30"
                  onClick={() => void runGenerate()}
                  disabled={generating}
                >
                  <Sparkles size={12} className="shrink-0 opacity-80" />
                  {t('openspec.regenerate')}
                </button>
              </div>
              <div className="bg-black/40 border border-outline-variant/10 rounded-lg p-3 max-h-[min(52dvh,28rem)] overflow-y-auto">
                <OpenspecCliMarkdown source={markdown} className="text-[11px]" />
              </div>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
