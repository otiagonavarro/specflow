import { useEffect, useState } from 'react';
import { LayoutGrid, ExternalLink, Star, Loader } from 'lucide-react';
import { motion } from 'motion/react';
import { useLocale, interpolate } from '../locales';
import { isJiraConfigured, getConfig, saveJiraBoardIdOnly } from '../api/config';
import { fetchJiraBoards, invalidateCache, jiraSoftwareBoardUrl, type JiraBoardSummary } from '../api/jira';

interface ProjectsProps {
  onOpenBoard?: (board: JiraBoardSummary, projectKey: string) => void;
}

export default function Projects({ onOpenBoard }: ProjectsProps) {
  const { t } = useLocale();
  const [boards, setBoards] = useState<JiraBoardSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const pk = getConfig().jira?.projectKey?.trim() ?? '';
  const domain = getConfig().jira?.domain?.replace(/\/$/, '') ?? '';
  const currentBoardId = getConfig().jira?.boardId?.trim() ?? '';
  const configured = isJiraConfigured();

  useEffect(() => {
    if (!configured) {
      setBoards([]);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchJiraBoards(pk || undefined)
      .then((list) => {
        if (!cancelled) setBoards(list);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : t('projects.error'));
          setBoards([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [configured, pk, t]);

  const setDefault = async (board: JiraBoardSummary) => {
    setSavingId(board.id);
    setToast(null);
    try {
      await saveJiraBoardIdOnly(String(board.id));
      invalidateCache();
      setToast(t('projects.saved'));
    } catch (e: unknown) {
      setToast(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto w-full space-y-10">
      <div className="flex justify-between items-end flex-wrap gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center text-primary">
              <LayoutGrid size={22} />
            </div>
            <h2 className="text-4xl font-extrabold tracking-tighter text-white">{t('projects.title')}</h2>
          </div>
          <p className="text-zinc-500 text-sm max-w-2xl">
            {pk ? interpolate(t('projects.subtitleScoped'), { key: pk }) : t('projects.subtitle')}
          </p>
        </div>
      </div>

      {toast && (
        <p className="text-sm text-tertiary font-medium" role="status">
          {toast}
        </p>
      )}

      {!configured && <p className="text-sm text-zinc-500">{t('projects.configure')}</p>}
      {error && <p className="text-sm text-error">{error}</p>}

      {loading && (
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <Loader size={16} className="animate-spin" />
          {t('projects.loading')}
        </div>
      )}

      {!loading && configured && boards.length === 0 && !error && (
        <p className="text-sm text-zinc-500">
          {pk ? interpolate(t('projects.noneScoped'), { key: pk }) : t('projects.none')}
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {boards.map((board) => {
          const projectKey = board.projectKey || pk;
          const href = domain ? jiraSoftwareBoardUrl(domain, projectKey, board.id) : '#';
          const isDefault = currentBoardId === String(board.id);

          return (
            <motion.div
              key={board.id}
              layout
              role={onOpenBoard ? 'button' : undefined}
              tabIndex={onOpenBoard ? 0 : undefined}
              onClick={
                onOpenBoard
                  ? () => onOpenBoard(board, projectKey)
                  : undefined
              }
              onKeyDown={
                onOpenBoard
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onOpenBoard(board, projectKey);
                      }
                    }
                  : undefined
              }
              className={`bg-surface-low rounded-2xl border border-outline-variant/10 p-6 space-y-4 flex flex-col ${
                onOpenBoard ? 'cursor-pointer hover:border-primary/25 transition-colors' : ''
              }`}
            >
              <div className="space-y-1 min-w-0">
                <p className="text-lg font-black text-white tracking-tight truncate">{board.name}</p>
                <p className="text-[10px] font-mono text-zinc-500">
                  {t('projects.boardType')}: {board.type} · ID {board.id}
                </p>
                {board.projectName && (
                  <p className="text-xs text-zinc-600 truncate">
                    {board.projectKey || pk} · {board.projectName}
                  </p>
                )}
                {onOpenBoard && (
                  <p className="text-[10px] text-zinc-600 pt-1">{t('projects.metricsHint')}</p>
                )}
              </div>

              <div className="flex flex-wrap gap-2 mt-auto pt-2">
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl bg-surface-highest border border-outline-variant/10 text-zinc-300 hover:text-white transition-colors"
                >
                  <ExternalLink size={14} />
                  {t('projects.openJira')}
                </a>
                <button
                  type="button"
                  disabled={savingId !== null}
                  onClick={(e) => {
                    e.stopPropagation();
                    void setDefault(board);
                  }}
                  className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl border transition-colors ${
                    isDefault
                      ? 'bg-primary/20 border-primary/40 text-primary'
                      : 'bg-surface-highest border-outline-variant/10 text-zinc-300 hover:text-white'
                  } disabled:opacity-40`}
                >
                  {savingId === board.id ? (
                    <Loader size={14} className="animate-spin" />
                  ) : (
                    <Star size={14} className={isDefault ? 'fill-current' : ''} />
                  )}
                  {t('projects.setDefault')}
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
