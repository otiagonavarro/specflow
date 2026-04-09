import type { GitHubPR } from './types';
import { buildGithubHeaders } from './config';

export async function fetchPRsForIssue(issueKey: string): Promise<GitHubPR[]> {
  const res = await fetch(
    `/api/github/prs?issueKey=${encodeURIComponent(issueKey)}`,
    { headers: buildGithubHeaders() }
  );
  if (!res.ok) throw new Error(`GitHub error ${res.status}`);
  const data = await res.json();
  return data.prs || [];
}

export async function validateRepo(repo: string): Promise<{ name: string; private: boolean }> {
  const headers = buildGithubHeaders();
  const res = await fetch(
    `/api/github/repo?repo=${encodeURIComponent(repo)}`,
    { headers }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `GitHub error ${res.status}`);
  }
  return res.json();
}

export async function fetchRecentPRs(): Promise<GitHubPR[]> {
  const res = await fetch('/api/github/recent-prs', { headers: buildGithubHeaders() });
  if (!res.ok) throw new Error(`GitHub error ${res.status}`);
  const data = await res.json();
  return data.prs || [];
}
