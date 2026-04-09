import { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback } from 'react';
import { ChevronDown, Copy, ExternalLink, Sparkles, Loader } from 'lucide-react';
import { isGithubConfigured } from '../api/config';
import {
  fetchLocalRepoFolders,
  fetchOpenspecChanges,
  fetchOpenspecStatus,
  runOpenspecCliOnServer,
  type LocalRepoFolder,
  type OpenspecInstructionArtifact,
  type OpenspecRunAction,
} from '../api/workspace';

const INSTRUCTION_ARTIFACTS: OpenspecInstructionArtifact[] = ['proposal', 'specs', 'design', 'tasks'];

function instructionButtonLabel(
  a: OpenspecInstructionArtifact,
  t: (key: string) => string,
): string {
  switch (a) {
    case 'proposal':
      return t('openspec.instrProposal');
    case 'specs':
      return t('openspec.instrSpecs');
    case 'design':
      return t('openspec.instrDesign');
    case 'tasks':
      return t('openspec.instrTasks');
    default:
      return a;
  }
}
import { useLocale, interpolate } from '../locales';
import type { OpenspecScope } from '../lib/openspecBindings';
import { getOpenspecRepoFolder, setOpenspecRepoFolder } from '../lib/openspecBindings';
import OpenspecCliMarkdown from './OpenspecCliMarkdown';

const OPENSPEC_SITE = 'https://openspec.dev/';
const CLI_INSTALL_LINE = 'npm install -g @fission-ai/openspec@latest';

interface OpenSpecMenuProps {
  scope: OpenspecScope;
  jiraKey: string;
  compact?: boolean;
  contextTitle?: string;
}

function fallbackCopyToClipboard(text: string): boolean {
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    ta.style.top = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

function copyFromUserGesture(text: string, onResult: (ok: boolean) => void): void {
  const api = typeof navigator !== 'undefined' ? navigator.clipboard : undefined;
  if (api?.writeText) {
    api.writeText(text).then(
      () => onResult(true),
      () => onResult(fallbackCopyToClipboard(text)),
    );
    return;
  }
  onResult(fallbackCopyToClipboard(text));
}

function buildInitScript(repoAbsolutePath: string): string {
  return `${CLI_INSTALL_LINE}\ncd "${repoAbsolutePath}"\nopenspec init`;
}

function defaultChangeIdFromJiraKey(jiraKey: string): string {
  const s = jiraKey
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!s) return 'change';
  return s.slice(0, 80);
}

function isValidChangeId(s: string): boolean {
  return /^[a-z0-9][a-z0-9-]{0,79}$/.test(s);
}

function absolutePathToFileUrl(absPath: string): string {
  const norm = absPath.replace(/\\/g, '/');
  if (/^[A-Za-z]:\/.*/.test(norm)) {
    return `file:///${norm}`;
  }
  if (norm.startsWith('/')) {
    return `file://${norm}`;
  }
  return `file:///${norm}`;
}

function vscodeOpenFolderHref(absPath: string): string {
  return `vscode://vscode/open?url=${encodeURIComponent(absolutePathToFileUrl(absPath))}`;
}

/** Cursor registers a cursor:// handler; path must be absolute on disk. */
function cursorOpenFolderHref(absPath: string): string {
  const norm = absPath.replace(/\\/g, '/');
  return `cursor://file${encodeURI(norm)}`;
}

export default function OpenSpecMenu({
  scope,
  jiraKey,
  compact = false,
  contextTitle,
}: OpenSpecMenuProps) {
  const { t } = useLocale();
  const rootRef = useRef<HTMLDivElement>(null);
  const cliOutputRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [repos, setRepos] = useState<LocalRepoFolder[]>([]);
  const [reposLoading, setReposLoading] = useState(false);
  const [reposError, setReposError] = useState<string | null>(null);
  const [selectedName, setSelectedName] = useState('');
  const [statusLoading, setStatusLoading] = useState(false);
  const [installed, setInstalled] = useState<boolean | null>(null);
  const [repoAbs, setRepoAbs] = useState<string | null>(null);
  const [statusErr, setStatusErr] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const [changeIdInput, setChangeIdInput] = useState(() => defaultChangeIdFromJiraKey(jiraKey));
  const [changesList, setChangesList] = useState<string[]>([]);
  const [changesLoading, setChangesLoading] = useState(false);
  const [changesErr, setChangesErr] = useState<string | null>(null);
  const [runBusy, setRunBusy] = useState<string | null>(null);
  const [runBanner, setRunBanner] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [runOutput, setRunOutput] = useState<string | null>(null);

  const workspaceReady = isGithubConfigured();

  const repoFolderAbs = useMemo(
    () => repoAbs ?? repos.find((r) => r.name === selectedName)?.absolutePath ?? null,
    [repoAbs, repos, selectedName],
  );

  useEffect(() => {
    const saved = getOpenspecRepoFolder(scope, jiraKey);
    setSelectedName(saved || '');
  }, [scope, jiraKey]);

  useEffect(() => {
    setChangeIdInput(defaultChangeIdFromJiraKey(jiraKey));
  }, [jiraKey]);

  useLayoutEffect(() => {
    if (!runOutput || !cliOutputRef.current) return;
    cliOutputRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [runOutput]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const loadRepos = useCallback(async () => {
    setReposLoading(true);
    setReposError(null);
    const { repos: list, error } = await fetchLocalRepoFolders();
    setReposLoading(false);
    if (error) {
      setReposError(error);
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

  const refreshChangesList = useCallback(async () => {
    if (!selectedName.trim()) return;
    setChangesLoading(true);
    setChangesErr(null);
    const { changes, error } = await fetchOpenspecChanges(selectedName);
    setChangesLoading(false);
    if (error) setChangesErr(error);
    setChangesList(changes);
  }, [selectedName]);

  useEffect(() => {
    if (!open || !workspaceReady) return;
    void loadRepos();
  }, [open, workspaceReady, loadRepos]);

  useEffect(() => {
    if (!selectedName.trim() || !workspaceReady) {
      setInstalled(null);
      setRepoAbs(null);
      setStatusErr(null);
      return;
    }
    let cancelled = false;
    setInstalled(null);
    setRepoAbs(null);
    setStatusLoading(true);
    setStatusErr(null);
    fetchOpenspecStatus(selectedName)
      .then((r) => {
        if (cancelled) return;
        setInstalled(r.installed);
        setRepoAbs(r.repoAbsolutePath ?? null);
        if (r.error) setStatusErr(r.error);
      })
      .finally(() => {
        if (!cancelled) setStatusLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedName, workspaceReady]);

  useEffect(() => {
    if (!open || !workspaceReady || !selectedName.trim() || installed !== true) return;
    void refreshChangesList();
  }, [open, workspaceReady, selectedName, installed, refreshChangesList]);

  const onSelectRepo = (name: string) => {
    setSelectedName(name);
    setOpenspecRepoFolder(scope, jiraKey, name);
  };

  const flashCopied = (msg: string) => {
    setFlash(msg);
    window.setTimeout(() => setFlash(null), 3200);
  };

  const handleCopy = (text: string) => {
    copyFromUserGesture(text, (ok) => {
      flashCopied(ok ? t('openspec.copied') : t('openspec.copyFailed'));
    });
  };

  const handleRun = async (action: OpenspecRunAction, artifact?: OpenspecInstructionArtifact) => {
    if (!selectedName.trim()) return;
    const id = changeIdInput.trim();
    if (!isValidChangeId(id)) {
      setRunBanner({ kind: 'err', text: t('openspec.invalidChangeId') });
      setRunOutput(null);
      return;
    }

    if (action === 'instructions-artifact' && !artifact) return;

    const busyKey = action === 'instructions-artifact' && artifact ? `instr-${artifact}` : action;
    setRunBusy(busyKey);
    setRunBanner(null);
    setRunOutput(null);

    const result = await runOpenspecCliOnServer({
      repoName: selectedName,
      action,
      changeName: id,
      description: action === 'new-change' ? contextTitle?.trim() || undefined : undefined,
      artifact: action === 'instructions-artifact' ? artifact : undefined,
    });

    setRunBusy(null);

    if (result.error === 'spawn_failed') {
      setRunBanner({ kind: 'err', text: t('openspec.spawnFailed') });
    } else {
      setRunBanner({
        kind: result.ok ? 'ok' : 'err',
        text: result.ok ? t('openspec.runOk') : t('openspec.runFailed'),
      });
    }

    const parts: string[] = [];
    if (result.stdout) parts.push(result.stdout);
    if (result.stderr) parts.push(`--- stderr ---\n${result.stderr}`);
    let combined = parts.join('\n').trim();
    if (!combined && result.message) {
      combined = result.message.trim();
    }
    if (!combined && !result.ok) {
      combined = interpolate(t('openspec.runNoOutput'), {
        code: result.exitCode != null ? String(result.exitCode) : '—',
      });
    }
    setRunOutput(combined || null);

    if (result.ok && (action === 'new-change' || action === 'archive')) {
      void refreshChangesList();
    }
  };

  const menuWidth = compact ? 'w-[min(100vw-2rem,320px)]' : 'w-[min(100vw-2rem,400px)]';

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className={`inline-flex items-center gap-1.5 rounded-xl border border-outline-variant/15 bg-surface-highest/90 text-zinc-200 hover:text-white hover:border-primary/30 transition-colors ${
          compact ? 'px-2 py-1.5 text-[10px] font-bold' : 'px-3 py-2 text-[11px] font-bold'
        }`}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={t('openspec.menuAria')}
      >
        <Sparkles size={compact ? 14 : 16} className="text-primary shrink-0" />
        {!compact && <span>{t('openspec.menuLabel')}</span>}
        <ChevronDown size={14} className={`opacity-60 transition-transform shrink-0 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          className={`absolute right-0 top-full mt-1 z-[200] max-h-[min(72dvh,32rem)] overflow-y-auto overflow-x-hidden ${menuWidth} rounded-xl border border-outline-variant/15 bg-[#1a1a1c] shadow-xl py-3 px-3 space-y-3`}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          role="menu"
        >
          {flash && (
            <p
              className={`text-[11px] font-bold px-2 py-2 rounded-lg border ${
                flash === t('openspec.copied')
                  ? 'text-emerald-200 bg-emerald-500/15 border-emerald-500/25'
                  : 'text-amber-200 bg-amber-500/15 border-amber-500/25'
              }`}
              role="status"
            >
              {flash}
            </p>
          )}

          {runBanner && (
            <p
              className={`text-[11px] font-bold px-2 py-2 rounded-lg border ${
                runBanner.kind === 'ok'
                  ? 'text-emerald-200 bg-emerald-500/15 border-emerald-500/25'
                  : 'text-amber-200 bg-amber-500/15 border-amber-500/25'
              }`}
              role="status"
            >
              {runBanner.text}
            </p>
          )}

          {!workspaceReady ? (
            <p className="text-[11px] text-zinc-500 leading-relaxed px-1">{t('openspec.needSettings')}</p>
          ) : reposLoading ? (
            <div className="flex items-center gap-2 text-zinc-500 text-xs py-2 px-1">
              <Loader size={14} className="animate-spin" />
              …
            </div>
          ) : reposError ? (
            <p className="text-[11px] text-error/90 px-1">{reposError}</p>
          ) : repos.length === 0 ? (
            <p className="text-[11px] text-zinc-500 px-1">{t('openspec.noRepos')}</p>
          ) : (
            <>
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
              </label>

              <div className="text-[10px] text-zinc-500 px-1 min-h-[2.5rem] flex items-center gap-2">
                {statusLoading ? (
                  <>
                    <Loader size={12} className="animate-spin shrink-0" />
                    {t('openspec.checking')}
                  </>
                ) : statusErr ? (
                  <span className="text-amber-500/90">{statusErr}</span>
                ) : !selectedName ? (
                  <span>{t('openspec.selectRepo')}</span>
                ) : installed ? (
                  <span className="text-tertiary">{t('openspec.installed')}</span>
                ) : (
                  <span>{t('openspec.notInstalled')}</span>
                )}
              </div>

              <div className="border-t border-outline-variant/10 pt-2 space-y-1">
                <a
                  href={OPENSPEC_SITE}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full text-left text-[11px] font-bold text-primary hover:underline px-2 py-2 rounded-lg hover:bg-surface-highest/80"
                  role="menuitem"
                >
                  {t('openspec.docSite')}
                </a>

                {installed === false &&
                selectedName &&
                (repoAbs || repos.find((r) => r.name === selectedName)?.absolutePath) ? (
                  <>
                    <p className="text-[9px] text-zinc-600 px-2 pt-1">{t('openspec.installHint')}</p>
                    <button
                      type="button"
                      role="menuitem"
                      className="w-full text-left text-[11px] text-zinc-300 hover:text-white px-2 py-2 rounded-lg hover:bg-surface-highest/80"
                      onClick={() => handleCopy(CLI_INSTALL_LINE)}
                    >
                      {t('openspec.copyInstallCli')}
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="w-full text-left text-[11px] text-zinc-300 hover:text-white px-2 py-2 rounded-lg hover:bg-surface-highest/80"
                      onClick={() => {
                        const abs = repoAbs || repos.find((r) => r.name === selectedName)?.absolutePath;
                        if (abs) handleCopy(buildInitScript(abs));
                      }}
                    >
                      {t('openspec.copyInitRepo')}
                    </button>
                  </>
                ) : null}

                {installed && selectedName.trim() ? (
                  <div className="space-y-2 px-1 pt-1">
                    <p className="text-[9px] text-zinc-600 leading-relaxed">{t('openspec.serverNote')}</p>

                    <label className="block space-y-1">
                      <span className="text-[9px] font-black uppercase tracking-[0.15em] text-zinc-600">
                        {t('openspec.changeIdLabel')}
                      </span>
                      <input
                        type="text"
                        value={changeIdInput}
                        onChange={(e) => setChangeIdInput(e.target.value)}
                        className="w-full bg-surface-highest text-zinc-200 text-xs font-mono px-2 py-2 rounded-lg border border-outline-variant/10"
                        autoComplete="off"
                        spellCheck={false}
                      />
                      <span className="text-[9px] text-zinc-600">{t('openspec.changeIdHint')}</span>
                    </label>

                    <div className="space-y-1">
                      <span className="text-[9px] font-black uppercase tracking-[0.15em] text-zinc-600">
                        {t('openspec.existingChanges')}
                      </span>
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          value={changesList.includes(changeIdInput) ? changeIdInput : ''}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (v) setChangeIdInput(v);
                          }}
                          className="flex-1 min-w-[8rem] bg-surface-highest text-zinc-200 text-[10px] font-mono px-2 py-1.5 rounded-lg border border-outline-variant/10"
                          disabled={changesLoading}
                        >
                          <option value="">{t('openspec.pickChange')}</option>
                          {changesList.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => void refreshChangesList()}
                          disabled={changesLoading}
                          className="inline-flex items-center gap-1 text-[10px] font-bold text-primary hover:underline disabled:opacity-40 px-1"
                        >
                          {changesLoading ? (
                            <>
                              <Loader size={12} className="animate-spin shrink-0" />
                              …
                            </>
                          ) : (
                            t('openspec.refreshChanges')
                          )}
                        </button>
                      </div>
                    </div>
                    {changesErr ? <p className="text-[10px] text-amber-500/90">{changesErr}</p> : null}

                    <div className="flex flex-col gap-1.5 pt-1">
                      <p className="text-[9px] text-zinc-500 leading-relaxed px-0.5">
                        {t('openspec.newChangeScaffoldNote')}
                      </p>
                      <button
                        type="button"
                        role="menuitem"
                        disabled={runBusy !== null}
                        className="w-full text-left text-[11px] font-bold text-zinc-200 hover:text-white px-2 py-2 rounded-lg hover:bg-surface-highest/80 disabled:opacity-40 border border-outline-variant/10"
                        onClick={() => void handleRun('new-change')}
                      >
                        {runBusy === 'new-change' ? t('openspec.running') : t('openspec.runNewChange')}
                      </button>

                      <div className="space-y-1.5 pt-2 border-t border-outline-variant/10">
                        <p className="text-[9px] font-black uppercase tracking-[0.15em] text-zinc-600">
                          {t('openspec.instructionArtifactsHeading')}
                        </p>
                        <p className="text-[9px] text-zinc-500 leading-relaxed px-0.5">
                          {t('openspec.instructionArtifactsNote')}
                        </p>
                        <div className="grid grid-cols-2 gap-1.5">
                          {INSTRUCTION_ARTIFACTS.map((art) => {
                            const busy = runBusy === `instr-${art}`;
                            return (
                              <button
                                key={art}
                                type="button"
                                role="menuitem"
                                disabled={runBusy !== null}
                                className="text-left text-[10px] font-bold text-zinc-200 hover:text-white px-2 py-2 rounded-lg hover:bg-surface-highest/80 disabled:opacity-40 border border-outline-variant/10"
                                onClick={() => void handleRun('instructions-artifact', art)}
                              >
                                {busy ? t('openspec.running') : instructionButtonLabel(art, t)}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <p className="text-[9px] text-zinc-600 pt-1">{t('openspec.runApplySub')}</p>
                      <button
                        type="button"
                        role="menuitem"
                        disabled={runBusy !== null}
                        className="w-full text-left text-[11px] font-bold text-zinc-200 hover:text-white px-2 py-2 rounded-lg hover:bg-surface-highest/80 disabled:opacity-40 border border-outline-variant/10"
                        onClick={() => void handleRun('instructions-apply')}
                      >
                        {runBusy === 'instructions-apply' ? t('openspec.running') : t('openspec.runApply')}
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        disabled={runBusy !== null}
                        className="w-full text-left text-[11px] font-bold text-zinc-200 hover:text-white px-2 py-2 rounded-lg hover:bg-surface-highest/80 disabled:opacity-40 border border-outline-variant/10"
                        onClick={() => void handleRun('archive')}
                      >
                        {runBusy === 'archive' ? t('openspec.running') : t('openspec.runArchive')}
                      </button>
                    </div>

                    {runOutput ? (
                      <div ref={cliOutputRef} className="pt-2 space-y-2 scroll-mt-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-[9px] font-black uppercase tracking-[0.15em] text-zinc-600">
                            {t('openspec.serverOutput')}
                          </p>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded-lg border border-outline-variant/15 bg-surface-highest/90 px-2 py-1 text-[10px] font-bold text-zinc-200 hover:text-white hover:border-primary/30"
                            onClick={() => handleCopy(runOutput)}
                          >
                            <Copy size={12} className="shrink-0 opacity-80" />
                            {t('openspec.copyOutput')}
                          </button>
                        </div>
                        <div className="bg-black/40 border border-outline-variant/10 rounded-lg p-2 max-h-56 overflow-y-auto">
                          <OpenspecCliMarkdown source={runOutput} />
                        </div>
                        {repoFolderAbs ? (
                          <div className="space-y-1">
                            <div className="flex flex-wrap gap-2">
                              <a
                                href={cursorOpenFolderHref(repoFolderAbs)}
                                className="inline-flex items-center gap-1 rounded-lg border border-primary/25 bg-primary/10 px-2 py-1.5 text-[10px] font-bold text-primary hover:bg-primary/15"
                                rel="noopener noreferrer"
                              >
                                <ExternalLink size={12} className="shrink-0 opacity-80" />
                                {t('openspec.openRepoCursor')}
                              </a>
                              <a
                                href={vscodeOpenFolderHref(repoFolderAbs)}
                                className="inline-flex items-center gap-1 rounded-lg border border-outline-variant/15 bg-surface-highest/90 px-2 py-1.5 text-[10px] font-bold text-zinc-200 hover:text-white hover:border-primary/30"
                                rel="noopener noreferrer"
                              >
                                <ExternalLink size={12} className="shrink-0 opacity-80" />
                                {t('openspec.openRepoVscode')}
                              </a>
                            </div>
                            <p className="text-[9px] text-zinc-600 leading-relaxed">{t('openspec.openRepoHint')}</p>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
