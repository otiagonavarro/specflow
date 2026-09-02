import fs from 'node:fs';
import path from 'node:path';
import type { StructuredSpec } from './nimSpecGenerator.js';

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

/** Title from the proposal's first H1 (stripping a leading "Change:" label), or the fallback. */
function extractChangeTitle(proposal: string, fallbackTitle: string): string {
  const title = extractSpecTitle(proposal, fallbackTitle);
  return title.replace(/^Change:\s*/i, '').trim() || fallbackTitle.trim();
}

export type WriteStructuredSpecResult =
  | {
      ok: true;
      specTitle: string;
      folderName: string;
      absolutePath: string;
      relativePath: string;
      files: string[];
    }
  | { ok: false; error: 'write_failed'; message: string };

/**
 * Writes an OpenSpec-shaped change (proposal.md, tasks.md, optional design.md,
 * specs/<capability>/spec.md) under .specflow/<folder>/ — same document
 * structure as openspec/changes/<id>/, without touching the openspec/ dir.
 */
export function writeStructuredSpecToSpecflow(
  repoPath: string,
  structured: StructuredSpec,
  fallbackTitle: string
): WriteStructuredSpecResult {
  const specTitle = extractChangeTitle(structured.proposal, fallbackTitle);
  const folderBase = structured.changeId || specTitleToFolderName(specTitle);
  const specflowRoot = path.join(repoPath, SPECFLOW_DIR);

  try {
    fs.mkdirSync(specflowRoot, { recursive: true });
    const specDir = uniqueSpecDir(specflowRoot, folderBase);
    fs.mkdirSync(specDir, { recursive: true });

    const files: string[] = [];
    const write = (relFromDir: string, content: string) => {
      const abs = path.join(specDir, relFromDir);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, content.endsWith('\n') ? content : `${content}\n`, { encoding: 'utf8', mode: 0o644 });
      files.push(path.posix.join(SPECFLOW_DIR, path.basename(specDir), relFromDir));
    };

    write('proposal.md', structured.proposal);
    write('tasks.md', structured.tasks);
    if (structured.design) {
      write('design.md', structured.design);
    }
    for (const spec of structured.specs) {
      write(path.posix.join('specs', spec.capability, 'spec.md'), spec.delta);
    }

    const proposalFile = path.join(specDir, 'proposal.md');
    if (!fs.existsSync(proposalFile)) {
      return {
        ok: false,
        error: 'write_failed',
        message: `File was not found after write: ${proposalFile}`,
      };
    }

    return {
      ok: true,
      specTitle,
      folderName: path.basename(specDir),
      absolutePath: specDir,
      relativePath: path.posix.join(SPECFLOW_DIR, path.basename(specDir)),
      files,
    };
  } catch (err) {
    return {
      ok: false,
      error: 'write_failed',
      message: err instanceof Error ? err.message : String(err),
    };
  }
}
