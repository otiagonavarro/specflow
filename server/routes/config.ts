import { Router, Request, Response } from 'express';
import {
  readEnvMap,
  writeEnvMap,
  deleteKeys,
  reloadDotenv,
  JIRA_ENV_KEYS,
  GITHUB_ENV_KEYS,
  LLM_ENV_KEYS,
} from '../envFile.js';
import { isLlmProvider } from '../llmConfig.js';

const router = Router();

interface JiraPostBody {
  domain: string;
  email: string;
  projectKey: string;
  boardId?: string;
  token?: string;
}

interface GithubPostBody {
  localReposPath?: string;
}

interface LlmPostBody {
  provider: string;
  model?: string;
  apiKey?: string;
}

router.get('/', (_req: Request, res: Response) => {
  try {
    const jiraDomain = process.env.JIRA_DOMAIN?.trim();
    const jiraEmail = process.env.JIRA_EMAIL?.trim();
    const jiraTokenPresent = !!process.env.JIRA_API_TOKEN?.trim();

    const jira =
      jiraDomain && jiraEmail
        ? {
            domain: jiraDomain.replace(/\/$/, ''),
            email: jiraEmail,
            token: '',
            tokenConfigured: jiraTokenPresent,
            projectKey: process.env.JIRA_PROJECT_KEY?.trim() || '',
            boardId: process.env.JIRA_BOARD_ID?.trim() || '',
          }
        : null;

    const localReposPath = process.env.LOCAL_REPOS_ROOT?.trim() || '';

    const github = localReposPath ? { localReposPath } : null;

    const llm = {
      provider: process.env.LLM_PROVIDER?.trim() || 'nvidia',
      model: process.env.LLM_MODEL?.trim() || '',
      apiKeyConfigured: !!process.env.LLM_API_KEY?.trim(),
    };

    res.json({ jira, github, llm });
  } catch (err) {
    console.error('[config] read error:', err);
    res.status(500).json({ error: String(err) });
  }
});

router.post('/', (req: Request, res: Response) => {
  try {
    const body = req.body as {
      jira?: null | JiraPostBody;
      github?: null | GithubPostBody;
      llm?: null | LlmPostBody;
    };

    const env = readEnvMap();

    if ('jira' in body) {
      if (body.jira === null) {
        deleteKeys(env, JIRA_ENV_KEYS);
      } else {
        const j = body.jira;
        env.JIRA_DOMAIN = String(j.domain || '')
          .trim()
          .replace(/\/$/, '');
        env.JIRA_EMAIL = String(j.email || '').trim();
        const pk = String(j.projectKey || '').trim();
        if (pk) env.JIRA_PROJECT_KEY = pk;
        else delete env.JIRA_PROJECT_KEY;
        const bid = String(j.boardId ?? '').trim();
        if (bid) env.JIRA_BOARD_ID = bid;
        else delete env.JIRA_BOARD_ID;
        if (Object.prototype.hasOwnProperty.call(j, 'token')) {
          const t = j.token ?? '';
          if (t) env.JIRA_API_TOKEN = t;
          else delete env.JIRA_API_TOKEN;
        }
      }
    }

    if ('github' in body) {
      if (body.github === null) {
        deleteKeys(env, GITHUB_ENV_KEYS);
      } else {
        const g = body.github;
        const p = String(g.localReposPath ?? '').trim();
        if (p) {
          env.LOCAL_REPOS_ROOT = p;
          delete env.GITHUB_TOKEN;
          delete env.GITHUB_REPOS;
          delete env.GITHUB_REPO;
        } else {
          delete env.LOCAL_REPOS_ROOT;
          delete env.GITHUB_TOKEN;
          delete env.GITHUB_REPOS;
          delete env.GITHUB_REPO;
        }
      }
    }

    if ('llm' in body) {
      if (body.llm === null) {
        deleteKeys(env, LLM_ENV_KEYS);
      } else {
        const l = body.llm;
        const provider = String(l.provider || '').trim().toLowerCase();
        if (isLlmProvider(provider)) {
          if (provider === 'nvidia') {
            delete env.LLM_PROVIDER;
          } else {
            env.LLM_PROVIDER = provider;
          }
          const model = String(l.model ?? '').trim();
          if (model) env.LLM_MODEL = model;
          else delete env.LLM_MODEL;
          if (Object.prototype.hasOwnProperty.call(l, 'apiKey')) {
            const key = l.apiKey ?? '';
            if (key) env.LLM_API_KEY = key;
            else delete env.LLM_API_KEY;
          }
        }
      }
    }

    writeEnvMap(env);
    reloadDotenv();
    res.json({ ok: true });
  } catch (err) {
    console.error('[config] write error:', err);
    res.status(500).json({ error: String(err) });
  }
});

router.delete('/', (_req: Request, res: Response) => {
  try {
    const env = readEnvMap();
    deleteKeys(env, [...JIRA_ENV_KEYS, ...GITHUB_ENV_KEYS, ...LLM_ENV_KEYS]);
    writeEnvMap(env);
    reloadDotenv();
    res.json({ ok: true });
  } catch (err) {
    console.error('[config] clear error:', err);
    res.status(500).json({ error: String(err) });
  }
});

export default router;
