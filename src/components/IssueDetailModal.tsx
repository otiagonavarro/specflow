import { useState, useLayoutEffect, useEffect, type MouseEvent } from 'react';
import { X, ExternalLink, Loader } from 'lucide-react';
import { motion } from 'motion/react';
import type { Issue } from '../api/types';
import { isJiraConfigured } from '../api/config';
import { fetchIssueDetail, type IssueSubtaskRef } from '../api/jira';
import { useLocale } from '../locales';
import OpenSpecMenu from './OpenSpecMenu';

interface IssueDetailModalProps {
  open: boolean;
  issue: Issue | null;
  onClose: () => void;
}

const PANEL_WIDTH = 'min(92vw, 960px)';
const EASE = [0.32, 0.72, 0, 1] as const;
const DURATION = 0.32;

export default function IssueDetailModal({ open, issue, onClose }: IssueDetailModalProps) {
  const { t } = useLocale();
  const [stash, setStash] = useState<Issue | null>(null);
  const [description, setDescription] = useState<string | null>(null);
  const [issueTypeName, setIssueTypeName] = useState<string | null>(null);
  const [subtasks, setSubtasks] = useState<IssueSubtaskRef[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  useLayoutEffect(() => {
    if (issue) setStash(issue);
  }, [issue]);

  const active = issue ?? stash;

  useEffect(() => {
    if (!open || !active) {
      if (!open) {
        setDescription(null);
        setIssueTypeName(null);
        setSubtasks([]);
        setDetailError(null);
        setLoadingDetail(false);
      }
      return;
    }

    if (!isJiraConfigured()) {
      setDescription(null);
      setIssueTypeName(null);
      setSubtasks([]);
      setDetailError(null);
      return;
    }

    let cancelled = false;
    setLoadingDetail(true);
    setDetailError(null);
    setDescription(null);
    setIssueTypeName(null);
    setSubtasks([]);

    fetchIssueDetail(active.code)
      .then((extras) => {
        if (cancelled || !extras) return;
        setDescription(extras.descriptionPlain || null);
        setIssueTypeName(extras.issueTypeName || null);
        setSubtasks(extras.subtasks ?? []);
      })
      .catch(() => {
        if (!cancelled) setDetailError('Não foi possível carregar a descrição no Jira.');
      })
      .finally(() => {
        if (!cancelled) setLoadingDetail(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, active]);

  useEffect(() => {
    const lock = open || stash !== null;
    if (lock) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
    document.body.style.overflow = '';
    return undefined;
  }, [open, stash]);

  const handleBackdrop = (e: MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handlePanelAnimationComplete = () => {
    if (!open) setStash(null);
  };

  const showJiraSetupHint = !isJiraConfigured();

  if (!active) return null;

  return (
    <div
      className="fixed inset-0 z-50 pointer-events-none"
      aria-hidden={!open && !stash}
    >
      <motion.div
        initial={false}
        animate={{
          opacity: open ? 1 : 0,
        }}
        transition={{ duration: DURATION, ease: EASE }}
        onClick={handleBackdrop}
        className="absolute inset-0 z-[1] bg-black/65 backdrop-blur-[2px] pointer-events-auto"
      />

      <motion.aside
        initial={{ x: '100%' }}
        animate={{ x: open ? 0 : '100%' }}
        transition={{ duration: DURATION, ease: EASE }}
        onAnimationComplete={handlePanelAnimationComplete}
        onClick={(e) => e.stopPropagation()}
        style={{ width: PANEL_WIDTH, maxWidth: '100vw' }}
        className="absolute right-0 top-0 z-[2] h-full max-h-[100dvh] flex flex-col bg-[#141415] border-l border-outline-variant/15 shadow-[-12px_0_48px_rgba(0,0,0,0.45)] pointer-events-auto overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="issue-detail-title"
      >
        <header className="shrink-0 px-5 py-4 border-b border-outline-variant/10 flex flex-col gap-4 min-[560px]:flex-row min-[560px]:items-start min-[560px]:justify-between bg-surface-low/80 overflow-visible relative z-10">
          <div className="min-w-0 space-y-1 pr-0 min-[560px]:pr-2">
            <p className="text-[10px] font-mono text-zinc-500 tracking-wide">{active.code}</p>
            <h2
              id="issue-detail-title"
              className="text-lg min-[560px]:text-xl font-bold text-white leading-snug tracking-tight break-words"
            >
              {active.title}
            </h2>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-start min-[560px]:justify-end w-full min-[560px]:w-auto">
            <OpenSpecMenu
              scope="issue"
              jiraKey={active.code}
              issueTitle={active.title}
              description={description}
              descriptionLoading={loadingDetail}
            />
            {active.jiraUrl && (
              <a
                href={active.jiraUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-[11px] font-bold text-primary hover:underline px-2.5 py-2 rounded-xl bg-primary/10 border border-primary/15"
              >
                <ExternalLink size={14} />
                Abrir no Jira
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2.5 rounded-xl text-zinc-500 hover:text-white hover:bg-surface-highest transition-colors border border-transparent hover:border-outline-variant/10"
              aria-label="Fechar"
            >
              <X size={20} />
            </button>
          </div>
        </header>

        <div className="flex flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 min-w-0 overflow-y-auto px-5 py-5 space-y-6">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600 mb-2">Descrição</p>
              {loadingDetail ? (
                <div className="flex items-center gap-2 text-zinc-500 text-sm py-6">
                  <Loader size={16} className="animate-spin" />
                  Carregando…
                </div>
              ) : detailError ? (
                <p className="text-sm text-error/90">{detailError}</p>
              ) : showJiraSetupHint ? (
                <p className="text-sm text-zinc-500 leading-relaxed">
                  Conecte o Jira em Configurações → Integrações para carregar a descrição e metadados desta issue.
                </p>
              ) : description ? (
                <div className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed rounded-xl bg-surface-low/60 border border-outline-variant/5 p-4">
                  {description}
                </div>
              ) : (
                <p className="text-sm text-zinc-600">Sem descrição.</p>
              )}
            </div>

            {!showJiraSetupHint ? (
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600 mb-2">
                  {t('issueDetailModal.subtasks')}
                </p>
                {loadingDetail ? (
                  <div className="flex items-center gap-2 text-sm text-zinc-500 py-2">
                    <Loader size={14} className="animate-spin shrink-0" />
                    {t('issueDetailModal.loadingSubtasks')}
                  </div>
                ) : detailError ? (
                  <p className="text-sm text-zinc-600">{t('issueDetailModal.subtasksUnavailable')}</p>
                ) : subtasks.length === 0 ? (
                  <p className="text-sm text-zinc-600">{t('issueDetailModal.noSubtasks')}</p>
                ) : (
                  <ul className="space-y-2 rounded-xl bg-surface-low/60 border border-outline-variant/5 p-3">
                    {subtasks.map((st) => (
                      <li
                        key={st.key}
                        className="flex flex-wrap items-center gap-x-2 gap-y-2 text-sm border-b border-outline-variant/5 pb-2 last:border-0 last:pb-0"
                      >
                        <a
                          href={st.jiraUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-[11px] font-bold text-primary hover:underline shrink-0"
                        >
                          {st.key}
                        </a>
                        <span className="text-zinc-300 flex-1 min-w-[10rem] leading-snug">{st.summary}</span>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 shrink-0">
                          {st.status}
                        </span>
                        <div className="flex items-center gap-1 shrink-0 ml-auto">
                          <a
                            href={st.jiraUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-zinc-500 hover:text-primary p-1"
                            aria-label={`${st.key} Jira`}
                          >
                            <ExternalLink size={14} />
                          </a>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}

            {active.githubPRs && active.githubPRs.length > 0 ? (
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600 mb-2">Pull requests</p>
                <ul className="space-y-2">
                  {active.githubPRs.map((pr) => (
                    <li key={pr.url}>
                      <a
                        href={pr.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary font-medium hover:underline inline-flex items-center gap-1"
                      >
                        #{pr.number} {pr.title}
                        <ExternalLink size={12} className="opacity-60 shrink-0" />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          <aside className="w-[min(280px,34%)] shrink-0 border-l border-outline-variant/10 bg-zinc-950/80 overflow-y-auto px-4 py-5 space-y-5">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600">Informações</p>
            <dl className="space-y-4 text-[11px]">
              <div>
                <dt className="text-[10px] font-bold uppercase tracking-wider text-zinc-600 mb-1">Status</dt>
                <dd className="font-semibold text-zinc-200">{active.status}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold uppercase tracking-wider text-zinc-600 mb-1">Prioridade</dt>
                <dd className="font-semibold text-zinc-200">{active.priority}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold uppercase tracking-wider text-zinc-600 mb-1">Tipo</dt>
                <dd className="font-semibold text-zinc-200">{issueTypeName || active.label}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold uppercase tracking-wider text-zinc-600 mb-1">Atualizado</dt>
                <dd className="font-semibold text-zinc-200">{active.updatedAt}</dd>
              </div>
              {active.epic ? (
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-wider text-zinc-600 mb-1">Épico</dt>
                  <dd className="font-semibold text-zinc-200 leading-snug">
                    {active.epic}
                    {active.epicCode ? (
                      <span className="text-zinc-600 font-mono font-normal ml-1">({active.epicCode})</span>
                    ) : null}
                  </dd>
                </div>
              ) : null}
              <div>
                <dt className="text-[10px] font-bold uppercase tracking-wider text-zinc-600 mb-1">Responsável</dt>
                <dd className="font-semibold text-zinc-200">{active.assignee || 'Não atribuído'}</dd>
              </div>
            </dl>
          </aside>
        </div>
      </motion.aside>
    </div>
  );
}
