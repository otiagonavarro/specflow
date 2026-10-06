export async function generateIssueSpec(body: {
  jiraKey: string;
  title: string;
  description: string;
  repoName: string;
}): Promise<{
  markdown?: string;
  model?: string;
  specTitle?: string;
  folderName?: string;
  savedPath?: string;
  savedAbsolutePath?: string;
  files?: string[];
  error?: string;
  message?: string;
}> {
  const res = await fetch('/api/spec/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = (await res.json().catch(() => ({}))) as {
    markdown?: string;
    model?: string;
    specTitle?: string;
    folderName?: string;
    savedPath?: string;
    savedAbsolutePath?: string;
      files?: string[];
    error?: string;
    message?: string;
  };

  if (!res.ok) {
    return {
      error: typeof data.error === 'string' ? data.error : 'request_failed',
      message: typeof data.message === 'string' ? data.message : `Request failed (${res.status})`,
      markdown: typeof data.markdown === 'string' ? data.markdown : undefined,
    };
  }

  return {
    markdown: typeof data.markdown === 'string' ? data.markdown : undefined,
    model: typeof data.model === 'string' ? data.model : undefined,
    specTitle: typeof data.specTitle === 'string' ? data.specTitle : undefined,
    folderName: typeof data.folderName === 'string' ? data.folderName : undefined,
    savedPath: typeof data.savedPath === 'string' ? data.savedPath : undefined,
    savedAbsolutePath:
      typeof data.savedAbsolutePath === 'string' ? data.savedAbsolutePath : undefined,
    files: Array.isArray(data.files) ? data.files.filter((f): f is string => typeof f === 'string') : undefined,
  };
}

export interface IssuePr {
  number: number;
  title: string;
  url: string;
  headRefName: string;
  baseRefName: string;
  author: string | null;
}

export interface PrReviewFinding {
  severity: 'important' | 'nit';
  pass: 'bugs' | 'security' | 'compliance';
  file: string;
  line: number | null;
  title: string;
  detail: string;
}

async function postJson<T>(url: string, body: unknown): Promise<{ ok: true; data: T } | { ok: false; message: string }> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, message: typeof data.message === 'string' ? data.message : `Request failed (${res.status})` };
    }
    return { ok: true, data: data as T };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  }
}

/** Open PRs in the selected local repo whose title or branch mentions the Jira key. */
export async function fetchIssuePrs(
  jiraKey: string,
  repoName: string
): Promise<{ ok: true; prs: IssuePr[] } | { ok: false; message: string }> {
  try {
    const qs = new URLSearchParams({ jiraKey, repoName });
    const res = await fetch(`/api/spec/prs?${qs}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, message: typeof data.message === 'string' ? data.message : `Request failed (${res.status})` };
    }
    return { ok: true, prs: Array.isArray(data.prs) ? data.prs : [] };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  }
}

export function reviewIssuePr(body: { jiraKey: string; repoName: string; prNumber: number }) {
  return postJson<{ markdown: string; findings: PrReviewFinding[]; model: string; savedPath: string | null; omitted: string[] }>(
    '/api/spec/review',
    body
  );
}

export function publishPrReview(body: { repoName: string; prNumber: number; markdown: string }) {
  return postJson<{ url: string }>('/api/spec/review/publish', body);
}
