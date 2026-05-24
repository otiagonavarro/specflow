import fs from 'node:fs';
import path from 'node:path';

export const SPECFLOW_DIR = '.specflow';
export const SPECFLOW_SPEC_FILE = 'spec.md';

/** First Markdown H1, or fallback title from the issue. */
export function extractSpecTitle(markdown: string, fallbackTitle: string): string {
  const line = markdown
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.startsWith('# '));
  if (line) {
    return line.replace(/^#\s+/, '').trim();
  }
  return fallbackTitle.trim();
}

/** Filesystem-safe folder name from the spec title. */
export function specTitleToFolderName(specTitle: string): string {
  const normalized = specTitle
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const slug = normalized.slice(0, 80).replace(/-+$/g, '');
  return slug || 'spec';
}

function uniqueSpecDir(specflowRoot: string, baseName: string): string {
  const first = path.join(specflowRoot, baseName);
  if (!fs.existsSync(first)) return first;

  for (let n = 2; n < 1000; n += 1) {
    const candidate = path.join(specflowRoot, `${baseName}-${n}`);
    if (!fs.existsSync(candidate)) return candidate;
  }
  throw new Error('Could not allocate a unique spec folder name.');
}

export type WriteSpecflowResult =
  | {
      ok: true;
      specTitle: string;
      folderName: string;
      absolutePath: string;
      relativePath: string;
    }
  | { ok: false; error: 'write_failed'; message: string };

export function writeSpecToSpecflow(repoPath: string, markdown: string, fallbackTitle: string): WriteSpecflowResult {
  const specTitle = extractSpecTitle(markdown, fallbackTitle);
  const folderBase = specTitleToFolderName(specTitle);
  const specflowRoot = path.join(repoPath, SPECFLOW_DIR);

  try {
    fs.mkdirSync(specflowRoot, { recursive: true });
    const specDir = uniqueSpecDir(specflowRoot, folderBase);
    fs.mkdirSync(specDir, { recursive: true });

    const specFile = path.join(specDir, SPECFLOW_SPEC_FILE);
    fs.writeFileSync(specFile, markdown, { encoding: 'utf8', mode: 0o644 });

    if (!fs.existsSync(specFile)) {
      return {
        ok: false,
        error: 'write_failed',
        message: `File was not found after write: ${specFile}`,
      };
    }

    const relativePath = path.posix.join(SPECFLOW_DIR, path.basename(specDir), SPECFLOW_SPEC_FILE);

    return {
      ok: true,
      specTitle,
      folderName: path.basename(specDir),
      absolutePath: specFile,
      relativePath,
    };
  } catch (err) {
    return {
      ok: false,
      error: 'write_failed',
      message: err instanceof Error ? err.message : String(err),
    };
  }
}
