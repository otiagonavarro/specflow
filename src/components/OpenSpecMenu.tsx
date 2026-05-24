import { useState, useEffect, useRef, useCallback, type MouseEvent as ReactMouseEvent } from 'react';
import { ChevronDown, Sparkles, Loader } from 'lucide-react';
import { isGithubConfigured } from '../api/config';
import { fetchLocalRepoFolders, openIdeFolderOnServer, type LocalRepoFolder } from '../api/workspace';
import { generateIssueSpec } from '../api/spec';
import { useLocale, interpolate } from '../locales';
import type { OpenspecScope } from '../lib/openspecBindings';
import { getOpenspecRepoFolder, setOpenspecRepoFolder } from '../lib/openspecBindings';
import { IDE_OPTIONS } from '../lib/ideDeepLinks';
import { CursorBrandIcon, VsCodeBrandIcon } from './IdeBrandIcons';
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
  const [error, setError] = useState<string | null>(null);
  const [ideOpening, setIdeOpening] = useState<string | null>(null);

  const workspaceReady = isGithubConfigured();

  useEffect(() => {
    setMarkdown(null);
    setSavedPath(null);
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
            <p
              className="text-[11px] font-bold text-emerald-200/95 leading-relaxed px-2 py-2 rounded-lg border border-emerald-500/25 bg-emerald-500/10"
              role="status"
            >
              {interpolate(t('openspec.specSaved'), { path: savedPath })}
            </p>
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
