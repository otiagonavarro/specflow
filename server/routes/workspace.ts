import { Router, type Request, type Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { resolveLocalRepoPath } from '../localRepo.js';
import {
  isValidChangeName,
  parseChangesFromListJson,
  runOpenspecCli,
  sanitizeDescription,
} from '../openspecRunner.js';

const router = Router();

router.get('/local-repos', (_req: Request, res: Response) => {
  const root = process.env.LOCAL_REPOS_ROOT?.trim();
  if (!root) {
    return res.json({ repos: [], configured: false });
  }

  let stat: fs.Stats;
  try {
    stat = fs.statSync(root);
  } catch {
    return res.status(400).json({
      error: 'path_not_found',
      message: 'Path does not exist or is not readable on the server.',
    });
  }

  if (!stat.isDirectory()) {
    return res.status(400).json({
      error: 'not_a_directory',
      message: 'Configured path is not a directory.',
    });
  }

  try {
    const entries = fs.readdirSync(root, { withFileTypes: true });
    const repos = entries
      .filter((d) => d.isDirectory() && !d.name.startsWith('.'))
      .map((d) => ({
        name: d.name,
        absolutePath: path.join(root, d.name),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return res.json({ repos, configured: true });
  } catch (e) {
    return res.status(400).json({ error: 'read_failed', message: String(e) });
  }
});

router.get('/openspec-status', (req: Request, res: Response) => {
  const resolved = resolveLocalRepoPath(String(req.query.repoName ?? ''));
  if ('error' in resolved) {
    const err = resolved.error;
    if (err === 'no_workspace_root') {
      return res.status(400).json({ error: err, installed: false });
    }
    return res.status(400).json({ error: err, installed: false });
  }

  const openspecDir = path.join(resolved.repoPath, 'openspec');
  let installed = false;
  try {
    const st = fs.statSync(openspecDir);
    installed = st.isDirectory();
  } catch {
    installed = false;
  }

  return res.json({
    installed,
    repoName: String(req.query.repoName ?? '').trim(),
    repoAbsolutePath: resolved.repoPath,
    openspecRelativePath: 'openspec',
  });
});

router.get('/openspec-changes', async (req: Request, res: Response) => {
  const resolved = resolveLocalRepoPath(String(req.query.repoName ?? ''));
  if ('error' in resolved) {
    return res.status(400).json({ error: resolved.error, changes: [] });
  }

  const openspecDir = path.join(resolved.repoPath, 'openspec');
  try {
    const st = fs.statSync(openspecDir);
    if (!st.isDirectory()) {
      return res.json({ changes: [], installed: false });
    }
  } catch {
    return res.json({ changes: [], installed: false });
  }

  const result = await runOpenspecCli(resolved.repoPath, ['list', '--json'], { timeoutMs: 120_000 });
  if (result.spawnError) {
    return res.status(500).json({
      error: 'spawn_failed',
      message: result.spawnError,
      changes: [],
    });
  }

  const { names, parseError } = parseChangesFromListJson(result.stdout);
  return res.json({
    changes: names,
    installed: true,
    exitCode: result.exitCode,
    parseError,
    stderrTail: result.stderr ? result.stderr.slice(-4000) : '',
  });
});

type OpenspecRunAction = 'new-change' | 'instructions-apply' | 'instructions-artifact' | 'archive';

const INSTRUCTION_ARTIFACTS = new Set(['proposal', 'specs', 'design', 'tasks']);

router.post('/openspec-run', async (req: Request, res: Response) => {
  const body = req.body as {
    repoName?: string;
    action?: OpenspecRunAction;
    changeName?: string;
    description?: string;
    artifact?: string;
  };

  const repoName = String(body.repoName ?? '').trim();
  const {action} = body;
  const changeName = String(body.changeName ?? '').trim();
  const description = typeof body.description === 'string' ? sanitizeDescription(body.description) : '';
  const artifact = String(body.artifact ?? '').trim();

  if (!repoName || !action) {
    return res.status(400).json({ error: 'invalid_body', message: 'repoName and action are required.' });
  }

  if (
    action !== 'new-change' &&
    action !== 'instructions-apply' &&
    action !== 'instructions-artifact' &&
    action !== 'archive'
  ) {
    return res.status(400).json({ error: 'invalid_action' });
  }

  const resolved = resolveLocalRepoPath(repoName);
  if ('error' in resolved) {
    return res.status(400).json({ error: resolved.error });
  }

  const openspecDir = path.join(resolved.repoPath, 'openspec');
  try {
    const st = fs.statSync(openspecDir);
    if (!st.isDirectory()) {
      return res.status(400).json({ error: 'openspec_not_installed', message: 'openspec/ directory not found.' });
    }
  } catch {
    return res.status(400).json({ error: 'openspec_not_installed', message: 'openspec/ directory not found.' });
  }

  if (action === 'new-change') {
    if (!changeName || !isValidChangeName(changeName)) {
      return res.status(400).json({
        error: 'invalid_change_name',
        message: 'changeName must be kebab-case (e.g. an-1234-feature).',
      });
    }
    const args = ['new', 'change', changeName];
    if (description) {
      args.push('--description', description);
    }
    const result = await runOpenspecCli(resolved.repoPath, args);
    return respondRunResult(res, result);
  }

  if (!changeName || !isValidChangeName(changeName)) {
    return res.status(400).json({
      error: 'invalid_change_name',
      message: 'changeName is required and must be kebab-case.',
    });
  }

  if (action === 'instructions-apply') {
    const result = await runOpenspecCli(resolved.repoPath, ['instructions', 'apply', '--change', changeName]);
    return respondRunResult(res, result);
  }

  if (action === 'instructions-artifact') {
    if (!INSTRUCTION_ARTIFACTS.has(artifact)) {
      return res.status(400).json({
        error: 'invalid_artifact',
        message: 'artifact must be one of: proposal, specs, design, tasks.',
      });
    }
    const result = await runOpenspecCli(resolved.repoPath, [
      'instructions',
      artifact,
      '--change',
      changeName,
    ]);
    return respondRunResult(res, result);
  }

  const result = await runOpenspecCli(resolved.repoPath, ['archive', changeName, '--yes']);
  return respondRunResult(res, result);
});

function respondRunResult(
  res: Response,
  result: Awaited<ReturnType<typeof runOpenspecCli>>,
): Response {
  if (result.spawnError) {
    return res.status(500).json({
      ok: false,
      error: 'spawn_failed',
      message: result.spawnError,
      stdout: result.stdout,
      stderr: result.stderr,
    });
  }

  const ok = result.exitCode === 0;
  return res.status(ok ? 200 : 422).json({
    ok,
    exitCode: result.exitCode,
    signal: result.signal,
    timedOut: result.timedOut,
    stdout: result.stdout,
    stderr: result.stderr,
  });
}

export default router;
