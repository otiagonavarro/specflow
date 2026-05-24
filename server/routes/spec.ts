import { Router, type Request, type Response } from 'express';
import { resolveLocalRepoPath } from '../localRepo.js';
import { generateSpecFromDescription } from '../nimSpecGenerator.js';
import { buildRepoContext } from '../repoContext.js';
import { writeSpecToSpecflow } from '../specflowWriter.js';

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
  const saved = writeSpecToSpecflow(resolved.repoPath, result.markdown, fallbackTitle);

  if (saved.ok === false) {
    console.error('[specflow] write failed:', saved.message, 'repo:', resolved.repoPath);
    return res.status(500).json({
      error: saved.error,
      message: saved.message,
      markdown: result.markdown,
    });
  }

  console.info('[specflow] saved:', saved.absolutePath);

  return res.json({
    markdown: result.markdown,
    model: result.model,
    specTitle: saved.specTitle,
    folderName: saved.folderName,
    savedPath: saved.relativePath,
    savedAbsolutePath: saved.absolutePath,
  });
});

export default router;
