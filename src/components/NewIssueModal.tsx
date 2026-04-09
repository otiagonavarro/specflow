import { useState, useEffect, type FormEvent, type MouseEvent } from 'react';
import { X, ArrowUp, ArrowRight, ArrowDown, ChevronDown, Loader, CheckCircle2, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { isJiraConfigured, getConfig } from '../api/config';
import { createIssue, fetchProjects } from '../api/jira';
import type { JiraProject } from '../api/types';

interface NewIssueModalProps {
  open: boolean;
  onClose: () => void;
}

const PRIORITIES = [
  { label: 'Critical', icon: ArrowUp, className: 'text-error' },
  { label: 'High', icon: ArrowUp, className: 'text-orange-400' },
  { label: 'Medium', icon: ArrowRight, className: 'text-yellow-500' },
  { label: 'Low', icon: ArrowDown, className: 'text-zinc-500' },
];

const STATUSES = ['Todo', 'In Progress', 'In Review', 'Blocked'];

const STATUS_COLORS: Record<string, string> = {
  'Todo': '#71717a',
  'In Progress': '#bdc2ff',
  'In Review': '#bec4ed',
  'Blocked': '#ffb4ab',
};

type SubmitState = 'idle' | 'loading' | 'success' | 'error';

export default function NewIssueModal({ open, onClose }: NewIssueModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('Todo');
  const [priority, setPriority] = useState('Medium');
  const [epicKey, setEpicKey] = useState('');

  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const [submitError, setSubmitError] = useState('');
  const [createdUrl, setCreatedUrl] = useState('');

  const jiraEnabled = isJiraConfigured();
  const [projects, setProjects] = useState<JiraProject[]>([]);
  const [projectKey, setProjectKey] = useState(getConfig().jira?.projectKey || '');

  useEffect(() => {
    if (!open || !jiraEnabled) return;

    let cancelled = false;

    (async () => {
      try {
        const list = await fetchProjects();
        if (!cancelled) setProjects(list);
      } catch {
        if (!cancelled) setProjects([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, jiraEnabled]);

  const reset = () => {
    setTitle(''); setDescription(''); setStatus('Todo'); setPriority('Medium'); setEpicKey('');
    setSubmitState('idle'); setSubmitError(''); setCreatedUrl('');
  };

  const handleClose = () => { reset(); onClose(); };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    if (!jiraEnabled) {
      handleClose();
      return;
    }

    setSubmitState('loading');
    setSubmitError('');

    try {
      const issue = await createIssue({
        summary: title.trim(),
        description: description.trim() || undefined,
        projectKey,
        priority,
        epicKey: epicKey || undefined,
      });
      setSubmitState('success');
      setCreatedUrl(issue.jiraUrl || '');
    } catch (err: any) {
      setSubmitState('error');
      setSubmitError(err.message || 'Failed to create issue');
    }
  };

  const handleBackdrop = (e: MouseEvent) => {
    if (e.target === e.currentTarget && submitState !== 'loading') handleClose();
  };

  const SelectedPriority = PRIORITIES.find(p => p.label === priority)!;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={handleBackdrop}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="w-full max-w-lg bg-surface-low border border-outline-variant/10 rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/10">
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">New Issue</span>
                {jiraEnabled && (
                  <span className="text-[10px] font-bold text-tertiary bg-tertiary/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-tertiary inline-block" />
                    Jira
                  </span>
                )}
              </div>
              <button
                onClick={handleClose}
                disabled={submitState === 'loading'}
                className="p-1.5 text-zinc-600 hover:text-white hover:bg-surface-highest rounded-lg transition-all disabled:opacity-40"
              >
                <X size={16} />
              </button>
            </div>

            {/* Success state */}
            {submitState === 'success' ? (
              <div className="p-8 flex flex-col items-center gap-4 text-center">
                <div className="w-14 h-14 rounded-2xl bg-tertiary/10 flex items-center justify-center">
                  <CheckCircle2 size={28} className="text-tertiary" />
                </div>
                <div className="space-y-1">
                  <p className="text-white font-bold">Issue created</p>
                  <p className="text-zinc-500 text-sm">{title}</p>
                </div>
                <div className="flex items-center gap-3 mt-2">
                  {createdUrl && (
                    <a
                      href={createdUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs font-bold text-primary hover:text-primary/80 transition-colors"
                    >
                      Open in Jira <ExternalLink size={12} />
                    </a>
                  )}
                  <button
                    onClick={handleClose}
                    className="px-4 py-2 text-xs font-bold text-zinc-400 hover:text-white bg-surface-highest rounded-xl transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="p-6 space-y-5">
                <div className="space-y-1.5">
                  <input
                    autoFocus
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="Issue title..."
                    disabled={submitState === 'loading'}
                    className="w-full bg-transparent text-white text-xl font-bold placeholder:text-zinc-700 outline-none tracking-tight disabled:opacity-50"
                  />
                  <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Add description..."
                    rows={3}
                    disabled={submitState === 'loading'}
                    className="w-full bg-transparent text-sm text-zinc-400 placeholder:text-zinc-700 outline-none resize-none leading-relaxed disabled:opacity-50"
                  />
                </div>

                <div className="h-px bg-outline-variant/10" />

                <div className="grid grid-cols-3 gap-3">
                  {/* Status (local only — Jira uses transitions after create) */}
                  {!jiraEnabled && (
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600">Status</label>
                      <div className="relative">
                        <select
                          value={status}
                          onChange={e => setStatus(e.target.value)}
                          className="w-full appearance-none bg-surface-highest text-white text-xs font-bold px-3 py-2 rounded-lg outline-none cursor-pointer border border-outline-variant/10 focus:border-primary/30 transition-colors"
                        >
                          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2">
                          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[status] }} />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Priority */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600">Priority</label>
                    <div className="relative">
                      <select
                        value={priority}
                        onChange={e => setPriority(e.target.value)}
                        className="w-full appearance-none bg-surface-highest text-white text-xs font-bold px-3 py-2 pl-7 rounded-lg outline-none cursor-pointer border border-outline-variant/10 focus:border-primary/30 transition-colors"
                      >
                        {PRIORITIES.map(p => <option key={p.label} value={p.label}>{p.label}</option>)}
                      </select>
                      <SelectedPriority.icon size={13} className={`pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 ${SelectedPriority.className}`} />
                    </div>
                  </div>

                  {jiraEnabled ? (
                    <div className="space-y-1.5 col-span-2">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600">Project</label>
                      <div className="relative">
                        {projects.length > 0 ? (
                          <select
                            value={projectKey}
                            onChange={e => setProjectKey(e.target.value)}
                            className="w-full appearance-none bg-surface-highest text-zinc-300 text-xs font-medium px-3 py-2 rounded-lg outline-none cursor-pointer border border-outline-variant/10 focus:border-primary/30 transition-colors"
                          >
                            <option value="">Select project</option>
                            {projects.map(p => <option key={p.key} value={p.key}>{p.name} ({p.key})</option>)}
                          </select>
                        ) : (
                          <input
                            value={projectKey}
                            onChange={e => setProjectKey(e.target.value.toUpperCase())}
                            placeholder="PROJ"
                            className="w-full bg-surface-highest text-zinc-300 text-xs font-mono px-3 py-2 rounded-lg border border-outline-variant/10 focus:border-primary/30 outline-none transition-colors placeholder:text-zinc-700"
                          />
                        )}
                        <ChevronDown size={13} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-600" />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1.5 col-span-2">
                      <p className="text-[11px] text-zinc-500 leading-relaxed">
                        É necessário configurar o Jira em Configurações → Integrações para criar issues. Este fluxo não usa dados locais fictícios.
                      </p>
                    </div>
                  )}
                </div>

                {/* Error message */}
                {submitState === 'error' && (
                  <p className="text-[11px] text-error bg-error/5 border border-error/20 px-3 py-2 rounded-lg">
                    {submitError}
                  </p>
                )}

                <div className="h-px bg-outline-variant/10" />

                <div className="flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={handleClose}
                    disabled={submitState === 'loading'}
                    className="px-4 py-2 text-xs font-bold text-zinc-400 hover:text-white transition-colors rounded-xl hover:bg-surface-highest disabled:opacity-40"
                  >
                    Cancel
                  </button>
                  <motion.button
                    type="submit"
                    whileHover={{ scale: submitState === 'loading' ? 1 : 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    disabled={!title.trim() || submitState === 'loading' || (jiraEnabled && !projectKey.trim())}
                    className="px-5 py-2 bg-gradient-to-r from-primary to-primary-container text-on-primary text-xs font-black rounded-xl shadow-lg shadow-primary/20 disabled:opacity-30 disabled:cursor-not-allowed transition-opacity flex items-center gap-2"
                  >
                    {submitState === 'loading' && <Loader size={13} className="animate-spin" />}
                    {jiraEnabled ? 'Create in Jira' : 'Create Issue'}
                  </motion.button>
                </div>
              </form>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
