const STORAGE_PREFIX = 'kanbam.openspec.repo.';

export type OpenspecScope = 'epic' | 'issue' | 'subtask';

function key(scope: OpenspecScope, jiraKey: string): string {
  return `${STORAGE_PREFIX}${scope}.${jiraKey.trim().toUpperCase()}`;
}

export function getOpenspecRepoFolder(scope: OpenspecScope, jiraKey: string): string | null {
  try {
    const k = key(scope, jiraKey);
    const v = localStorage.getItem(k);
    return v?.trim() ? v.trim() : null;
  } catch {
    return null;
  }
}

export function setOpenspecRepoFolder(scope: OpenspecScope, jiraKey: string, folderName: string): void {
  try {
    const k = key(scope, jiraKey);
    const t = folderName.trim();
    if (t) localStorage.setItem(k, t);
    else localStorage.removeItem(k);
  } catch {
    /* private mode */
  }
}
