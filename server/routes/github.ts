import { Router, Request, Response } from 'express';

const router = Router();

function resolveToken(_req: Request): string | null {
  return process.env.GITHUB_TOKEN || null;
}

function resolveRepos(_req: Request): string[] {
  const envMulti = (process.env.GITHUB_REPOS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (envMulti.length > 0) return [...new Set(envMulti)];

  const legacy = (process.env.GITHUB_REPO || '').trim();
  if (legacy) return [legacy];

  return [];
}

function prSearchQuery(repos: string[], issueKey: string): string {
  const key = issueKey.trim();
  if (repos.length === 1) {
    return `is:pr repo:${repos[0]} ${key} in:head,title`;
  }
  const repoGroup = repos.map((r) => `repo:${r}`).join(' OR ');
  return `is:pr (${repoGroup}) ${key} in:head,title`;
}

async function githubFetch(token: string, path: string, options: RequestInit = {}) {
  const url = `https://api.github.com${path}`;
  return await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.headers as Record<string, string> | undefined),
    },
  });
}

router.get('/prs', async (req: Request, res: Response) => {
  const token = resolveToken(req);
  if (!token) return res.json({ prs: [] });

  const repos = resolveRepos(req);
  if (repos.length === 0) return res.json({ prs: [] });

  const issueKey = req.query.issueKey as string;
  if (!issueKey) return res.status(400).json({ error: 'Missing issueKey parameter' });

  try {
    const query = prSearchQuery(repos, issueKey);
    const searchRes = await githubFetch(
      token,
      `/search/issues?q=${encodeURIComponent(query)}&per_page=10`
    );
    const data = await searchRes.json();

    if (!searchRes.ok) return res.status(searchRes.status).json(data);

    const prs = (data.items || []).map((item: any) => ({
      number: item.number,
      title: item.title,
      url: item.html_url,
      state: item.pull_request?.merged_at ? 'merged' : item.state,
      author: item.user?.login || null,
      createdAt: item.created_at,
    }));

    res.json({ prs });
  } catch (err) {
    res.status(502).json({ error: 'Failed to reach GitHub', detail: String(err) });
  }
});

router.get('/repo', async (req: Request, res: Response) => {
  const token = resolveToken(req);
  if (!token) return res.status(503).json({ message: 'GitHub API integration disabled; use local repos in Settings.' });

  const repos = resolveRepos(req);
  const repoParam = (req.query.repo as string)?.trim() || repos[0] || '';
  if (!repoParam) return res.status(400).json({ error: 'Missing repo parameter' });

  try {
    const repoRes = await githubFetch(token, `/repos/${repoParam}`);
    const data = await repoRes.json();
    if (!repoRes.ok) return res.status(repoRes.status).json(data);

    res.json({
      name: data.name,
      fullName: data.full_name,
      private: data.private,
      defaultBranch: data.default_branch,
      openIssues: data.open_issues_count,
    });
  } catch (err) {
    res.status(502).json({ error: 'Failed to reach GitHub', detail: String(err) });
  }
});

router.get('/recent-prs', async (req: Request, res: Response) => {
  const token = resolveToken(req);
  if (!token) return res.json({ prs: [] });

  const repos = resolveRepos(req);
  if (repos.length === 0) return res.json({ prs: [] });

  try {
    const allPrs: {
      number: number;
      title: string;
      url: string;
      state: 'open';
      author: string | null;
      branch: string | null;
      createdAt: string;
      updatedAt: string;
      repository: string;
    }[] = [];

    for (const repo of repos) {
      const prRes = await githubFetch(
        token,
        `/repos/${repo}/pulls?state=open&per_page=20&sort=updated`
      );
      const data = await prRes.json();
      if (!prRes.ok) {
        console.warn(`[github] recent-prs skip ${repo}:`, prRes.status);
        continue;
      }
      for (const pr of data as any[]) {
        allPrs.push({
          number: pr.number,
          title: pr.title,
          url: pr.html_url,
          state: 'open',
          author: pr.user?.login || null,
          branch: pr.head?.ref || null,
          createdAt: pr.created_at,
          updatedAt: pr.updated_at,
          repository: repo,
        });
      }
    }

    allPrs.sort((a, b) => {
      const ta = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const tb = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return tb - ta;
    });

    res.json({ prs: allPrs.slice(0, 20) });
  } catch (err) {
    res.status(502).json({ error: 'Failed to reach GitHub', detail: String(err) });
  }
});

export default router;
