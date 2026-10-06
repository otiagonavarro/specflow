import { Router, type Request, type Response } from 'express';
import { resolveLocalRepoPath } from '../localRepo.js';
import { generateSpecFromDescription, PROMPT_VERSION } from '../nimSpecGenerator.js';
import { findOpenPrsForIssue, publishReview, reviewPullRequest } from '../prReview.js';
import { buildRepoContext } from '../repoContext.js';
import { writeArtifactsToSpecflow, writeSpecToSpecflow } from '../specflowWriter.js';

const router = Router();

router.post('/generate', async (req: Request, res: Response) => {
  const body = req.body as {
    jiraKey?: string;
    title?: string;
    description?: string;
    repoName?: string;
  };

  const jiraKey = String(body.jiraKey ?? '').trim();
  const title = String(body.title ?? '').trim();
  const description = String(body.description ?? '').trim();
  const repoName = String(body.repoName ?? '').trim();

  if (!jiraKey || !title || !description) {
    return res.status(400).json({
      error: 'invalid_input',
      message: 'jiraKey, title, and description are required.',
    });
  }

  if (!repoName) {
    return res.status(400).json({
      error: 'repo_required',
      message: 'repoName is required to save the spec under .specflow/.',
    });
  }

  const resolved = resolveLocalRepoPath(repoName);
  if ('error' in resolved) {
    return res.status(400).json({
      error: 'invalid_repo',
      message: resolved.error,
    });
  }

  let repoContext: string | null = null;
  try {
    repoContext = buildRepoContext(resolved.repoPath, description);
  } catch (err) {
    return res.status(500).json({
      error: 'repo_context_failed',
      message: err instanceof Error ? err.message : String(err),
    });
  }

  const result = await generateSpecFromDescription({
    jiraKey,
    title,
    description,
    repoContext,
  });

  if (result.ok === false) {
    if (result.error === 'invalid_input') {
      return res.status(400).json({ error: result.error });
    }
    return res.status(502).json({
      error: result.error,
      message: result.message ?? 'Spec generation failed.',
    });
  }

  const fallbackTitle = `${jiraKey}: ${title}`;

  if (result.kind === 'structured') {
    const { artifacts } = result;
    const preview = renderArtifactsPreview(artifacts);
    const saved = writeArtifactsToSpecflow(
      resolved.repoPath,
      artifacts,
      { jiraKey, provider: result.provider, model: result.model, promptVersion: PROMPT_VERSION },
      fallbackTitle
    );

    if (saved.ok === false) {
      console.error('[specflow] artifacts write failed:', saved.message, 'repo:', resolved.repoPath);
      return res.status(500).json({ error: saved.error, message: saved.message, markdown: preview });
    }

    console.info('[specflow] saved (intent/spec/plan):', saved.absolutePath);

    return res.json({
      markdown: preview,
      model: result.model,
      specTitle: saved.specTitle,
      folderName: saved.folderName,
      savedPath: saved.relativePath,
      savedAbsolutePath: saved.absolutePath,
      files: saved.files,
    });
  }

  // Legacy fallback: the model didn't return parseable structured JSON — save its raw markdown as-is.
  const saved = writeSpecToSpecflow(resolved.repoPath, result.markdown, fallbackTitle);

  if (saved.ok === false) {
    console.error('[specflow] write failed:', saved.message, 'repo:', resolved.repoPath);
    return res.status(500).json({
      error: saved.error,
      message: saved.message,
      markdown: result.markdown,
    });
  }

  console.info('[specflow] saved (legacy):', saved.absolutePath);

  return res.json({
    markdown: result.markdown,
    model: result.model,
    specTitle: saved.specTitle,
    folderName: saved.folderName,
    savedPath: saved.relativePath,
    savedAbsolutePath: saved.absolutePath,
  });
});

/** Open PRs in the selected local repo that mention the Jira key (title or branch). */
router.get('/prs', async (req: Request, res: Response) => {
  const jiraKey = String(req.query.jiraKey ?? '').trim();
  const resolved = resolveLocalRepoPath(String(req.query.repoName ?? ''));
  if (!jiraKey) return res.status(400).json({ error: 'invalid_input', message: 'jiraKey is required.' });
  if ('error' in resolved) return res.status(400).json({ error: 'invalid_repo', message: resolved.error });

  const found = await findOpenPrsForIssue(resolved.repoPath, jiraKey);
  if (found.ok === false) return res.status(502).json({ error: 'gh_failed', message: found.message });
  return res.json({ prs: found.prs });
});

router.post('/review', async (req: Request, res: Response) => {
  const body = req.body as { jiraKey?: string; repoName?: string; prNumber?: number };
  const jiraKey = String(body.jiraKey ?? '').trim();
  const prNumber = Number(body.prNumber);
  const resolved = resolveLocalRepoPath(String(body.repoName ?? ''));
  if (!jiraKey || !Number.isInteger(prNumber) || prNumber <= 0) {
    return res.status(400).json({ error: 'invalid_input', message: 'jiraKey and prNumber are required.' });
  }
  if ('error' in resolved) return res.status(400).json({ error: 'invalid_repo', message: resolved.error });

  const result = await reviewPullRequest(resolved.repoPath, jiraKey, prNumber);
  if (result.ok === false) return res.status(result.status).json({ error: result.error, message: result.message });
  console.info('[review] PR #%d reviewed (%s)%s', prNumber, result.model, result.savedPath ? ` → ${result.savedPath}` : '');
  return res.json(result);
});

/** Publishes a review produced by POST /review, identified only by its server-side id. */
router.post('/review/publish', async (req: Request, res: Response) => {
  const reviewId = String((req.body as { reviewId?: string }).reviewId ?? '').trim();
  if (!/^[0-9a-f-]{36}$/i.test(reviewId)) {
    return res.status(400).json({ error: 'invalid_input', message: 'reviewId is required.' });
  }

  const posted = await publishReview(reviewId);
  if (posted.ok === false) return res.status(posted.status).json({ error: 'publish_failed', message: posted.message });
  console.info('[review] published to PR #%d: %s', posted.prNumber, posted.url);
  return res.json({ url: posted.url });
});

function renderArtifactsPreview(artifacts: { intent: string; spec: string; plan: string }): string {
  return [
    '## intent.md',
    artifacts.intent.trim(),
    '---',
    '## spec.md',
    artifacts.spec.trim(),
    '---',
    '## plan.md',
    artifacts.plan.trim(),
  ].join('\n\n');
}

export default router;
