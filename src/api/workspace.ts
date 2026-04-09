export interface LocalRepoFolder {
  name: string;
  absolutePath: string;
}

export async function fetchLocalRepoFolders(): Promise<{
  repos: LocalRepoFolder[];
  configured: boolean;
  error?: string;
}> {
  const res = await fetch('/api/workspace/local-repos');
  const data = (await res.json().catch(() => ({}))) as {
    repos?: LocalRepoFolder[];
    configured?: boolean;
    error?: string;
    message?: string;
  };

  if (!res.ok) {
    return {
      repos: [],
      configured: false,
      error: data.message || data.error || `Request failed (${res.status})`,
    };
  }

  const repos = Array.isArray(data.repos) ? data.repos : [];
  return {
    repos,
    configured: data.configured === true,
  };
}

export async function fetchOpenspecStatus(repoFolderName: string): Promise<{
  installed: boolean;
  repoAbsolutePath?: string;
  error?: string;
}> {
  const q = encodeURIComponent(repoFolderName.trim());
  const res = await fetch(`/api/workspace/openspec-status?repoName=${q}`);
  const data = (await res.json().catch(() => ({}))) as {
    installed?: boolean;
    repoAbsolutePath?: string;
    error?: string;
    message?: string;
  };

  if (!res.ok) {
    return {
      installed: false,
      error: data.message || data.error || `Request failed (${res.status})`,
    };
  }

  return {
    installed: data.installed === true,
    repoAbsolutePath: typeof data.repoAbsolutePath === 'string' ? data.repoAbsolutePath : undefined,
  };
}

export async function fetchOpenspecChanges(repoFolderName: string): Promise<{
  changes: string[];
  error?: string;
}> {
  const q = encodeURIComponent(repoFolderName.trim());
  const res = await fetch(`/api/workspace/openspec-changes?repoName=${q}`);
  const data = (await res.json().catch(() => ({}))) as {
    changes?: string[];
    error?: string;
    message?: string;
  };

  if (!res.ok) {
    return {
      changes: [],
      error: data.message || data.error || `Request failed (${res.status})`,
    };
  }

  const changes = Array.isArray(data.changes) ? data.changes : [];
  return { changes };
}

export type OpenspecRunAction =
  | 'new-change'
  | 'instructions-apply'
  | 'instructions-artifact'
  | 'archive';

export type OpenspecInstructionArtifact = 'proposal' | 'specs' | 'design' | 'tasks';

export async function runOpenspecCliOnServer(body: {
  repoName: string;
  action: OpenspecRunAction;
  changeName: string;
  description?: string;
  artifact?: OpenspecInstructionArtifact;
}): Promise<{
  ok: boolean;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  error?: string;
  message?: string;
}> {
  const res = await fetch('/api/workspace/openspec-run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    exitCode?: number | null;
    stdout?: string;
    stderr?: string;
    error?: string;
    message?: string;
  };

  return {
    ok: data.ok === true,
    exitCode: data.exitCode ?? null,
    stdout: typeof data.stdout === 'string' ? data.stdout : '',
    stderr: typeof data.stderr === 'string' ? data.stderr : '',
    error: typeof data.error === 'string' ? data.error : undefined,
    message: typeof data.message === 'string' ? data.message : undefined,
  };
}
