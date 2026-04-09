import path from 'node:path';

export function resolveLocalRepoPath(repoName: string): { repoPath: string } | { error: string } {
  const root = process.env.LOCAL_REPOS_ROOT?.trim();
  if (!root) return { error: 'no_workspace_root' };

  const rn = String(repoName ?? '').trim();
  if (!rn || rn === '.' || rn === '..' || /[\\/]/.test(rn) || rn.includes('..')) {
    return { error: 'invalid_repo_name' };
  }

  const resolvedRoot = path.resolve(root);
  const repoPath = path.resolve(path.join(resolvedRoot, rn));
  const prefix = resolvedRoot.endsWith(path.sep) ? resolvedRoot : `${resolvedRoot}${path.sep}`;
  if (repoPath !== resolvedRoot && !repoPath.startsWith(prefix)) {
    return { error: 'invalid_path' };
  }

  return { repoPath };
}
