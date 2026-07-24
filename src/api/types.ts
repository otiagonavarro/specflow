export type Priority = 'Critical' | 'High' | 'Medium' | 'Low';

export interface Issue {
  id: string;
  code: string;
  title: string;
  /** Jira workflow status name (`fields.status.name`). */
  status: string;
  /** Jira status id (`fields.status.id`) — matches Agile board column config. */
  statusId?: string;
  priority: Priority;
  epic: string;
  epicCode: string;
  assignee: string | null;
  assigneeAvatar: string | null;
  label: string;
  updatedAt: string;
  projectName?: string;
  jiraUrl?: string;
  subtaskCount?: number;
  githubPRs?: GitHubPR[];
}

export interface GitHubPR {
  number: number;
  title: string;
  url: string;
  state: 'open' | 'closed' | 'merged';
  author: string | null;
  branch?: string;
  createdAt?: string;
  repository?: string;
}

export interface JiraProject {
  id: string;
  key: string;
  name: string;
  avatarUrl?: string;
}

export interface JiraTransition {
  id: string;
  name: string;
  to: { name: string };
}

export type LlmProvider = 'nvidia' | 'openai' | 'anthropic';

export interface IntegrationConfig {
  jira: {
    domain: string;
    email: string;
    token: string;
    projectKey: string;
    boardId?: string;
    tokenConfigured?: boolean;
  } | null;
  github: {
    localReposPath: string;
  } | null;
  llm: {
    provider: LlmProvider;
    model: string;
    apiKeyConfigured: boolean;
  };
}

export interface IntegrationSavePayload {
  jira: null | {
    domain: string;
    email: string;
    projectKey: string;
    boardId?: string;
    token?: string;
  };
  github: null | {
    localReposPath: string;
  };
  llm?: null | {
    provider: LlmProvider;
    model?: string;
    apiKey?: string;
  };
}
