import { useState, useEffect, type ReactNode } from 'react';
import { User, Bell, Palette, Shield, Zap, ChevronRight, Link2, Eye, EyeOff, CheckCircle2, XCircle, Loader } from 'lucide-react';
import { motion } from 'motion/react';
import {
  getConfig,
  clearConfig,
  isJiraConfigured,
  isGithubConfigured,
  loadConfigFromServer,
  saveIntegrationPayload,
  clearConfigFromServer,
} from '../api/config';
import { useLocale, type Locale } from '../locales';
import { fetchProjects, invalidateCache } from '../api/jira';
import { useJiraMyself } from '../hooks/useJiraMyself';
import { AvatarImage } from './AvatarImage';
import { fetchLocalRepoFolders, type LocalRepoFolder } from '../api/workspace';
import type { IntegrationConfig, IntegrationSavePayload, LlmProvider } from '../api/types';

const LLM_PROVIDER_OPTIONS: { value: LlmProvider; label: string; defaultModel: string }[] = [
  { value: 'nvidia', label: 'NVIDIA (padrão)', defaultModel: 'meta/llama-3.1-8b-instruct' },
  { value: 'openai', label: 'OpenAI', defaultModel: 'gpt-4o-mini' },
  { value: 'anthropic', label: 'Anthropic', defaultModel: 'claude-3-5-sonnet-latest' },
];

const SECTIONS = [
  { id: 'workspace', label: 'Workspace', icon: Zap },
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'integrations', label: 'Integrations', icon: Link2 },
];

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${checked ? 'bg-primary-container' : 'bg-surface-highest'}`}
    >
      <motion.div
        animate={{ x: checked ? 22 : 2 }}
        transition={{ type: 'spring', stiffness: 500, damping: 35 }}
        className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm"
      />
    </button>
  );
}

function SettingRow({ label, description, children }: { label: string; description?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between py-4 border-b border-outline-variant/5 last:border-0">
      <div className="space-y-0.5">
        <p className="text-sm font-semibold text-zinc-200">{label}</p>
        {description && <p className="text-[11px] text-zinc-600">{description}</p>}
      </div>
      <div className="flex-shrink-0 ml-8">{children}</div>
    </div>
  );
}

function SecretInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="bg-surface-highest text-zinc-300 text-xs font-mono px-3 py-2 pr-8 rounded-lg border border-outline-variant/10 focus:border-primary/30 outline-none w-64 transition-colors placeholder:text-zinc-700"
      />
      <button
        type="button"
        onClick={() => setShow(s => !s)}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-300 transition-colors"
      >
        {show ? <EyeOff size={13} /> : <Eye size={13} />}
      </button>
    </div>
  );
}

type ConnectionStatus = 'idle' | 'testing' | 'ok' | 'error';

function ProfileSettingsPanel() {
  const { t } = useLocale();
  const { user, loading } = useJiraMyself();
  const jira = isJiraConfigured();

  return (
    <div className="space-y-0">
      <p className="text-[11px] text-zinc-600 pb-4 border-b border-outline-variant/5">{t('settings.profileJiraHint')}</p>
      <div className="flex items-center gap-5 py-6 border-b border-outline-variant/5">
        {loading && jira ? (
          <div className="w-16 h-16 rounded-2xl bg-surface-highest flex items-center justify-center border border-outline-variant/10">
            <Loader className="w-7 h-7 text-zinc-500 animate-spin" />
          </div>
        ) : (
          <AvatarImage
            src={user?.avatarUrl ?? null}
            name={user?.displayName ?? '?'}
            size={64}
            roundedClassName="rounded-2xl"
            className="hover:grayscale-0"
            ariaLabel={user?.displayName ?? t('settings.profileNoJira')}
          />
        )}
        <div className="space-y-2 min-w-0">
          <p className="text-sm font-bold text-white">{t('settings.profilePhotoTitle')}</p>
          <p className="text-[11px] text-zinc-600">{t('settings.profilePhotoDesc')}</p>
        </div>
      </div>
      <SettingRow label={t('settings.displayNameLabel')}>
        <input
          readOnly
          value={user?.displayName ?? ''}
          placeholder="—"
          className="bg-surface-highest text-white text-xs font-bold px-3 py-2 rounded-lg border border-outline-variant/10 outline-none w-52 transition-colors"
        />
      </SettingRow>
      <SettingRow label={t('settings.emailLabel')}>
        <input
          readOnly
          value={user?.emailAddress ?? ''}
          placeholder="—"
          className="bg-surface-highest text-zinc-400 text-xs font-mono px-3 py-2 rounded-lg border border-outline-variant/10 outline-none w-52 transition-colors"
        />
      </SettingRow>
      {!jira && <p className="text-[11px] text-zinc-600 py-3">{t('settings.profileNoJira')}</p>}
      {jira && !loading && !user && (
        <p className="text-[11px] text-amber-500/90 py-3">{t('settings.profileLoadFailed')}</p>
      )}
    </div>
  );
}

function LanguagePicker() {
  const { locale, setLocale, t } = useLocale();
  return (
    <SettingRow label={t('settings.language')} description={t('settings.languageDesc')}>
      <select
        value={locale}
        onChange={(e) => setLocale(e.target.value as Locale)}
        className="bg-surface-highest text-white text-xs font-bold px-3 py-2 rounded-lg border border-outline-variant/10 outline-none w-48 cursor-pointer transition-colors"
      >
        <option value="en">{t('settings.langEn')}</option>
        <option value="pt">{t('settings.langPt')}</option>
      </select>
    </SettingRow>
  );
}

function StatusBadge({ status, detail }: { status: ConnectionStatus; detail?: string }) {
  if (status === 'idle') return null;
  if (status === 'testing') return (
    <span className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-500">
      <Loader size={12} className="animate-spin" /> Testing…
    </span>
  );
  if (status === 'ok') return (
    <span className="flex items-center gap-1.5 text-[11px] font-bold text-tertiary">
      <CheckCircle2 size={12} /> {detail || 'Connected'}
    </span>
  );
  return (
    <span className="flex items-center gap-1.5 text-[11px] font-bold text-error">
      <XCircle size={12} /> {detail || 'Failed'}
    </span>
  );
}

function IntegrationsSection() {
  const config = getConfig();

  const [jiraDomain, setJiraDomain] = useState(config.jira?.domain || '');
  const [jiraEmail, setJiraEmail] = useState(config.jira?.email || '');
  const [jiraToken, setJiraToken] = useState(config.jira?.token || '');
  const [jiraTokenConfigured, setJiraTokenConfigured] = useState(!!config.jira?.tokenConfigured);
  const [jiraTokenDirty, setJiraTokenDirty] = useState(false);
  const [jiraProject, setJiraProject] = useState(config.jira?.projectKey || '');
  const [jiraBoardId, setJiraBoardId] = useState(config.jira?.boardId || '');
  const [jiraStatus, setJiraStatus] = useState<ConnectionStatus>('idle');
  const [jiraDetail, setJiraDetail] = useState('');

  const [localReposPath, setLocalReposPath] = useState(config.github?.localReposPath || '');
  const [reposRootStatus, setReposRootStatus] = useState<ConnectionStatus>('idle');
  const [reposRootDetail, setReposRootDetail] = useState('');
  const [workspaceRepoPreview, setWorkspaceRepoPreview] = useState<LocalRepoFolder[]>([]);

  const [llmProvider, setLlmProvider] = useState<LlmProvider>(config.llm?.provider || 'nvidia');
  const [llmModel, setLlmModel] = useState(config.llm?.model || '');
  const [llmApiKey, setLlmApiKey] = useState('');
  const [llmApiKeyConfigured, setLlmApiKeyConfigured] = useState(!!config.llm?.apiKeyConfigured);
  const [llmApiKeyDirty, setLlmApiKeyDirty] = useState(false);

  useEffect(() => {
    loadConfigFromServer().then((serverConfig) => {
      if (serverConfig.jira) {
        setJiraDomain(serverConfig.jira.domain);
        setJiraEmail(serverConfig.jira.email);
        setJiraToken('');
        setJiraTokenDirty(false);
        setJiraTokenConfigured(!!serverConfig.jira.tokenConfigured);
        setJiraProject(serverConfig.jira.projectKey);
        setJiraBoardId(serverConfig.jira.boardId || '');
        setJiraStatus('ok');
        setJiraDetail('Connected');
      } else if (isJiraConfigured()) {
        setJiraStatus('ok');
        setJiraDetail('Connected');
      }
      if (serverConfig.github?.localReposPath) {
        setLocalReposPath(serverConfig.github.localReposPath);
        setReposRootStatus('ok');
        setReposRootDetail('Salvo');
      } else if (isGithubConfigured()) {
        setReposRootStatus('ok');
        setReposRootDetail('Salvo');
      }
      if (serverConfig.llm) {
        setLlmProvider(serverConfig.llm.provider);
        setLlmModel(serverConfig.llm.model);
        setLlmApiKey('');
        setLlmApiKeyDirty(false);
        setLlmApiKeyConfigured(serverConfig.llm.apiKeyConfigured);
      }
    });
  }, []);

  const buildSavePayload = (): IntegrationSavePayload => {
    const jiraReady = !!(
      jiraDomain.trim() &&
      jiraEmail.trim() &&
      (jiraToken.trim() || jiraTokenConfigured)
    );
    const pathTrim = localReposPath.trim();
    const workspaceReady = pathTrim.length > 0;

    const modelTrim = llmModel.trim();
    const llmIsDefault = llmProvider === 'nvidia' && !modelTrim && !llmApiKeyDirty;

    return {
      jira: jiraReady
        ? {
            domain: jiraDomain.replace(/\/$/, ''),
            email: jiraEmail.trim(),
            projectKey: jiraProject.trim(),
            ...(jiraBoardId.trim() ? { boardId: jiraBoardId.trim() } : {}),
            ...(jiraTokenDirty ? { token: jiraToken } : {}),
          }
        : null,
      github: workspaceReady ? { localReposPath: pathTrim } : null,
      llm: llmIsDefault
        ? null
        : {
            provider: llmProvider,
            model: modelTrim,
            ...(llmApiKeyDirty ? { apiKey: llmApiKey } : {}),
          },
    };
  };

  const syncFormFromServerConfig = (c: IntegrationConfig) => {
    if (c.jira) {
      setJiraDomain(c.jira.domain);
      setJiraEmail(c.jira.email);
      setJiraToken('');
      setJiraTokenDirty(false);
      setJiraTokenConfigured(!!c.jira.tokenConfigured);
      setJiraProject(c.jira.projectKey);
      setJiraBoardId(c.jira.boardId || '');
    } else {
      setJiraToken('');
      setJiraTokenConfigured(false);
    }
    if (c.github?.localReposPath) {
      setLocalReposPath(c.github.localReposPath);
    } else {
      setLocalReposPath('');
    }
    if (c.llm) {
      setLlmProvider(c.llm.provider);
      setLlmModel(c.llm.model);
      setLlmApiKey('');
      setLlmApiKeyDirty(false);
      setLlmApiKeyConfigured(c.llm.apiKeyConfigured);
    }
  };

  const testAndSave = async () => {
    const payload = buildSavePayload();
    try {
      await saveIntegrationPayload(payload);
      const refreshed = await loadConfigFromServer();
      syncFormFromServerConfig(refreshed);
      if (payload.jira) invalidateCache();
    } catch (e) {
      console.error(e);
    }

    if (payload.jira) {
      setJiraStatus('testing');
      try {
        await fetchProjects();
        setJiraStatus('ok');
        setJiraDetail('Connected');
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Connection failed';
        setJiraStatus('error');
        setJiraDetail(msg);
      }
    }

    if (payload.github?.localReposPath) {
      setReposRootStatus('testing');
      setWorkspaceRepoPreview([]);
      const { repos, error } = await fetchLocalRepoFolders();
      if (error) {
        setReposRootStatus('error');
        setReposRootDetail(error);
      } else {
        setWorkspaceRepoPreview(repos);
        setReposRootStatus('ok');
        setReposRootDetail(
          repos.length === 0
            ? 'Pasta válida — nenhuma subpasta (clone os repos dentro deste diretório).'
            : `${repos.length} pasta(s) encontrada(s) (repos locais).`
        );
      }
    } else {
      setWorkspaceRepoPreview([]);
    }
  };

  const disconnect = async () => {
    try {
      await clearConfigFromServer();
    } catch (e) {
      console.error(e);
    }
    clearConfig();
    setJiraDomain('');
    setJiraEmail('');
    setJiraToken('');
    setJiraTokenConfigured(false);
    setJiraTokenDirty(false);
    setJiraProject('');
    setJiraBoardId('');
    setLocalReposPath('');
    setJiraStatus('idle');
    setReposRootStatus('idle');
    setReposRootDetail('');
    setWorkspaceRepoPreview([]);
    setLlmProvider('nvidia');
    setLlmModel('');
    setLlmApiKey('');
    setLlmApiKeyDirty(false);
    setLlmApiKeyConfigured(false);
  };

  return (
    <div className="space-y-0">
      {/* Jira */}
      <div className="py-4 border-b border-outline-variant/5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-white">Jira</p>
            <p className="text-[11px] text-zinc-600 mt-0.5">Atlassian Jira REST API v3</p>
          </div>
          <StatusBadge status={jiraStatus} detail={jiraDetail} />
        </div>
        <div className="space-y-3 pl-0">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-[0.15em] text-zinc-600">Domain</label>
              <input
                value={jiraDomain}
                onChange={e => setJiraDomain(e.target.value)}
                placeholder="https://yourco.atlassian.net"
                className="w-full bg-surface-highest text-zinc-300 text-xs font-mono px-3 py-2 rounded-lg border border-outline-variant/10 focus:border-primary/30 outline-none transition-colors placeholder:text-zinc-700"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-[0.15em] text-zinc-600">Email</label>
              <input
                type="email"
                value={jiraEmail}
                onChange={e => setJiraEmail(e.target.value)}
                placeholder="you@company.com"
                className="w-full bg-surface-highest text-zinc-300 text-xs font-mono px-3 py-2 rounded-lg border border-outline-variant/10 focus:border-primary/30 outline-none transition-colors placeholder:text-zinc-700"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-[0.15em] text-zinc-600">API Token</label>
              <SecretInput
                value={jiraToken}
                onChange={(v) => {
                  setJiraToken(v);
                  setJiraTokenDirty(true);
                }}
                placeholder={jiraTokenConfigured ? '(inalterado — já salvo no .env)' : '••••••••••••••••'}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-[0.15em] text-zinc-600">Default Project Key</label>
              <input
                value={jiraProject}
                onChange={e => setJiraProject(e.target.value.toUpperCase())}
                placeholder="PROJ"
                className="w-full bg-surface-highest text-zinc-300 text-xs font-mono px-3 py-2 rounded-lg border border-outline-variant/10 focus:border-primary/30 outline-none transition-colors placeholder:text-zinc-700"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-[0.15em] text-zinc-600">Board ID <span className="normal-case font-normal text-zinc-700">(optional, for Agile API)</span></label>
              <input
                value={jiraBoardId}
                onChange={e => setJiraBoardId(e.target.value)}
                placeholder="e.g. 5631"
                className="w-full bg-surface-highest text-zinc-300 text-xs font-mono px-3 py-2 rounded-lg border border-outline-variant/10 focus:border-primary/30 outline-none transition-colors placeholder:text-zinc-700"
              />
            </div>
          </div>
          <p className="text-[10px] text-zinc-700">
            Gere um token de API em{' '}
            <a href="https://id.atlassian.com/manage-profile/security/api-tokens" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              id.atlassian.com
            </a>
            . As credenciais são gravadas no arquivo <code className="text-zinc-500">.env</code> na raiz do projeto; o proxy usa essas variáveis no servidor (nada de segredo é enviado do navegador para o Jira).
          </p>
        </div>
      </div>

      {/* LLM provider */}
      <div className="py-4 border-b border-outline-variant/5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-white">LLM (geração de spec)</p>
            <p className="text-[11px] text-zinc-600 mt-0.5">
              Provedor usado para gerar specs a partir de issues do Jira. Padrão: NVIDIA (chave embutida no servidor).
            </p>
          </div>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-[0.15em] text-zinc-600">Provedor</label>
              <select
                value={llmProvider}
                onChange={(e) => {
                  const next = e.target.value as LlmProvider;
                  setLlmProvider(next);
                  if (next === 'nvidia') {
                    setLlmApiKey('');
                    setLlmApiKeyDirty(false);
                  }
                }}
                className="w-full bg-surface-highest text-white text-xs font-bold px-3 py-2 rounded-lg border border-outline-variant/10 focus:border-primary/30 outline-none cursor-pointer transition-colors"
              >
                {LLM_PROVIDER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-[0.15em] text-zinc-600">Modelo</label>
              <input
                value={llmModel}
                onChange={(e) => setLlmModel(e.target.value)}
                placeholder={LLM_PROVIDER_OPTIONS.find((o) => o.value === llmProvider)?.defaultModel}
                className="w-full bg-surface-highest text-zinc-300 text-xs font-mono px-3 py-2 rounded-lg border border-outline-variant/10 focus:border-primary/30 outline-none transition-colors placeholder:text-zinc-700"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-[0.15em] text-zinc-600">
              API Key {llmProvider === 'nvidia' && <span className="normal-case font-normal text-zinc-700">(opcional — usa a chave padrão do servidor se vazio)</span>}
            </label>
            <SecretInput
              value={llmApiKey}
              onChange={(v) => {
                setLlmApiKey(v);
                setLlmApiKeyDirty(true);
              }}
              placeholder={llmApiKeyConfigured ? '(inalterado — já salvo no .env)' : '••••••••••••••••'}
            />
          </div>
          <p className="text-[10px] text-zinc-700">
            Ao trocar para OpenAI ou Anthropic, a API Key é obrigatória. As credenciais são gravadas no <code className="text-zinc-500">.env</code> na raiz do projeto (uso apenas no servidor).
          </p>
        </div>
      </div>

      {/* Local repositories root (workspace) */}
      <div className="py-4 border-b border-outline-variant/5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-white">Repositórios locais</p>
            <p className="text-[11px] text-zinc-600 mt-0.5">
              Pasta no computador onde o servidor roda, contendo os clones. Base para vincular épico / task / subtarefa à pasta do repo correspondente.
            </p>
          </div>
          <StatusBadge status={reposRootStatus} detail={reposRootDetail} />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-black uppercase tracking-[0.15em] text-zinc-600">
            Caminho absoluto (LOCAL_REPOS_ROOT)
          </label>
          <input
            value={localReposPath}
            onChange={(e) => setLocalReposPath(e.target.value)}
            placeholder="/Users/voce/codigo ou C:\dev\repos"
            className="w-full bg-surface-highest text-zinc-300 text-xs font-mono px-3 py-2 rounded-lg border border-outline-variant/10 focus:border-primary/30 outline-none transition-colors placeholder:text-zinc-700"
          />
        </div>
        <p className="text-[10px] text-zinc-700 leading-relaxed">
          Cada repositório clonado deve ser uma <strong className="text-zinc-500 font-semibold">subpasta direta</strong> desse caminho. Ao salvar, o app lista essas pastas para conferência. O valor é gravado em{' '}
          <code className="text-zinc-500">LOCAL_REPOS_ROOT</code> no <code className="text-zinc-500">.env</code> na máquina do servidor (não é enviado ao navegador como segredo — é só um path local).
        </p>
        {workspaceRepoPreview.length > 0 && (
          <div className="rounded-xl border border-outline-variant/10 bg-surface-highest/40 px-3 py-2">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-600 mb-2">
              Pastas detectadas (use para alinhar com épicos e issues)
            </p>
            <ul className="text-[11px] font-mono text-zinc-400 space-y-1 max-h-32 overflow-y-auto">
              {workspaceRepoPreview.slice(0, 24).map((r) => (
                <li key={r.absolutePath} className="truncate" title={r.absolutePath}>
                  {r.name}
                </li>
              ))}
            </ul>
            {workspaceRepoPreview.length > 24 ? (
              <p className="text-[10px] text-zinc-600 mt-2">+{workspaceRepoPreview.length - 24} outras…</p>
            ) : null}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="pt-4 flex items-center justify-between">
        <button
          onClick={disconnect}
          className="text-[11px] font-bold text-error hover:text-error/70 transition-colors"
        >
          Disconnect all
        </button>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={testAndSave}
          className="px-5 py-2 bg-gradient-to-r from-primary to-primary-container text-on-primary text-xs font-black rounded-xl shadow-lg shadow-primary/20"
        >
          Save &amp; Test Connection
        </motion.button>
      </div>
    </div>
  );
}

export default function Settings({ initialSection }: { initialSection?: string }) {
  const [activeSection, setActiveSection] = useState(initialSection || 'workspace');

  const [notifEmail, setNotifEmail] = useState(true);
  const [notifMentions, setNotifMentions] = useState(true);
  const [notifBlocked, setNotifBlocked] = useState(true);
  const [notifAutomated, setNotifAutomated] = useState(false);
  const [notifDeadlines, setNotifDeadlines] = useState(true);

  const [density, setDensity] = useState<'compact' | 'default' | 'comfortable'>('default');
  const [groupByEpic, setGroupByEpic] = useState(true);
  const [showAvatars, setShowAvatars] = useState(true);

  const [twoFactor, setTwoFactor] = useState(false);
  const [sessionLog, setSessionLog] = useState(true);

  const renderContent = () => {
    switch (activeSection) {
      case 'workspace':
        return (
          <div className="space-y-0">
            <SettingRow label="Workspace Name" description="Displayed across the navigation and exports.">
              <input defaultValue="specflow" className="bg-surface-highest text-white text-xs font-bold px-3 py-2 rounded-lg border border-outline-variant/10 focus:border-primary/30 outline-none w-44 transition-colors" />
            </SettingRow>
            <SettingRow label="Workspace Slug" description="Used in URLs and API references.">
              <input defaultValue="specflow" className="bg-surface-highest text-zinc-400 text-xs font-mono px-3 py-2 rounded-lg border border-outline-variant/10 focus:border-primary/30 outline-none w-44 transition-colors" />
            </SettingRow>
            <SettingRow label="Default Sprint Duration" description="Applied when creating new sprints.">
              <select defaultValue="2" className="bg-surface-highest text-white text-xs font-bold px-3 py-2 rounded-lg border border-outline-variant/10 focus:border-primary/30 outline-none w-32 cursor-pointer transition-colors">
                <option value="1">1 week</option>
                <option value="2">2 weeks</option>
                <option value="4">4 weeks</option>
              </select>
            </SettingRow>
            <SettingRow label="Auto-assign on Epic Create" description="Assign the creator as the epic lead automatically.">
              <Toggle checked={true} onChange={() => {}} />
            </SettingRow>
          </div>
        );

      case 'profile':
        return <ProfileSettingsPanel />;

      case 'notifications':
        return (
          <div className="space-y-0">
            <SettingRow label="Email Digest" description="Receive a daily summary of workspace activity.">
              <Toggle checked={notifEmail} onChange={setNotifEmail} />
            </SettingRow>
            <SettingRow label="Mentions" description="Notify when you are @mentioned in any issue.">
              <Toggle checked={notifMentions} onChange={setNotifMentions} />
            </SettingRow>
            <SettingRow label="Blocked Issues" description="Alert when an issue you own becomes blocked.">
              <Toggle checked={notifBlocked} onChange={setNotifBlocked} />
            </SettingRow>
            <SettingRow label="Automated Events" description="System bot actions and pipeline completions.">
              <Toggle checked={notifAutomated} onChange={setNotifAutomated} />
            </SettingRow>
            <SettingRow label="Deadline Reminders" description="Remind 7 days before epic deadlines.">
              <Toggle checked={notifDeadlines} onChange={setNotifDeadlines} />
            </SettingRow>
          </div>
        );

      case 'appearance':
        return (
          <div className="space-y-0">
            <LanguagePicker />
            <SettingRow label="Data Density" description="Controls row height and spacing in list views.">
              <div className="flex items-center gap-1 bg-surface-highest p-1 rounded-lg border border-outline-variant/10">
                {(['compact', 'default', 'comfortable'] as const).map(d => (
                  <button
                    key={d}
                    onClick={() => setDensity(d)}
                    className={`px-3 py-1 text-[11px] font-bold rounded-md transition-all capitalize ${density === d ? 'bg-primary-container text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </SettingRow>
            <SettingRow label="Group Issues by Epic" description="Default grouping in the Issues view.">
              <Toggle checked={groupByEpic} onChange={setGroupByEpic} />
            </SettingRow>
            <SettingRow label="Show Assignee Avatars" description="Display avatar photos in list rows.">
              <Toggle checked={showAvatars} onChange={setShowAvatars} />
            </SettingRow>
          </div>
        );

      case 'security':
        return (
          <div className="space-y-0">
            <SettingRow label="Two-Factor Authentication" description="Add an extra layer of security to your account.">
              <Toggle checked={twoFactor} onChange={setTwoFactor} />
            </SettingRow>
            <SettingRow label="Session Activity Log" description="Record login events and active sessions.">
              <Toggle checked={sessionLog} onChange={setSessionLog} />
            </SettingRow>
            <SettingRow label="Active Sessions" description="Currently signed in on 2 devices.">
              <button className="text-[11px] font-bold text-error hover:text-error/70 transition-colors">Revoke all</button>
            </SettingRow>
            <SettingRow label="API Access Tokens" description="Manage personal tokens for API integrations.">
              <button className="flex items-center gap-1 text-[11px] font-bold text-primary hover:text-primary/80 transition-colors">
                Manage <ChevronRight size={12} />
              </button>
            </SettingRow>
          </div>
        );

      case 'integrations':
        return <IntegrationsSection />;

      default:
        return null;
    }
  };

  const ActiveSection = SECTIONS.find(s => s.id === activeSection)!;
  const isIntegrations = activeSection === 'integrations';

  return (
    <div className="p-8 max-w-5xl mx-auto w-full">
      <div className="space-y-1 mb-8">
        <h2 className="text-4xl font-extrabold tracking-tighter text-white">Settings</h2>
        <p className="text-zinc-500 text-sm">Configure workspace, profile, and system preferences.</p>
      </div>

      <div className="flex gap-6">
        <aside className="w-48 flex-shrink-0 space-y-1">
          {SECTIONS.map(section => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                activeSection === section.id
                  ? 'bg-surface-highest text-white'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-surface-low'
              }`}
            >
              <section.icon size={16} />
              {section.label}
              {section.id === 'integrations' && (isJiraConfigured() || isGithubConfigured()) && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-tertiary" />
              )}
            </button>
          ))}
        </aside>

        <div className="flex-1 min-w-0">
          <motion.div
            key={activeSection}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="bg-surface-low rounded-2xl border border-outline-variant/5 overflow-hidden"
          >
            <div className="flex items-center gap-3 px-6 py-4 border-b border-outline-variant/10">
              <ActiveSection.icon size={16} className="text-primary" />
              <h3 className="text-sm font-black uppercase tracking-[0.15em] text-zinc-300">{ActiveSection.label}</h3>
            </div>
            <div className="px-6">
              {renderContent()}
            </div>
            {!isIntegrations && (
              <div className="px-6 py-4 border-t border-outline-variant/10 flex justify-end">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="px-5 py-2 bg-gradient-to-r from-primary to-primary-container text-on-primary text-xs font-black rounded-xl shadow-lg shadow-primary/20"
                >
                  Save Changes
                </motion.button>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
