import fs from 'node:fs';
import path from 'node:path';
import type { GeneratedArtifacts } from './nimSpecGenerator.js';

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

export type ArtifactProvenance = {
  jiraKey: string;
  provider: string;
  model: string;
  promptVersion: string;
};

export type WriteArtifactsResult =
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
 * Writes the AI-native SDLC artifact chain (intent.md → spec.md → plan.md)
 * under .specflow/<slug>/, plus provenance.json recording the Jira key, model
 * and prompt version that produced it so the set stays auditable.
 */
export function writeArtifactsToSpecflow(
  repoPath: string,
  artifacts: GeneratedArtifacts,
  provenance: ArtifactProvenance,
  fallbackTitle: string
): WriteArtifactsResult {
  const specTitle = extractSpecTitle(artifacts.intent, fallbackTitle).replace(/^[^:]{1,20}:\s*/, '').trim() || fallbackTitle;
  const folderBase = artifacts.slug || specTitleToFolderName(specTitle);
  const specflowRoot = path.join(repoPath, SPECFLOW_DIR);

  // Write into a hidden staging dir and rename it into place only once every
  // file is on disk, so a failed write never leaves a partial artifact set.
  let stagingDir: string | null = null;
  try {
    fs.mkdirSync(specflowRoot, { recursive: true });
    stagingDir = fs.mkdtempSync(path.join(specflowRoot, `.staging-${folderBase}-`));

    const names: string[] = [];
    const write = (name: string, content: string) => {
      fs.writeFileSync(path.join(stagingDir!, name), content.endsWith('\n') ? content : `${content}\n`, {
        encoding: 'utf8',
        mode: 0o644,
      });
      names.push(name);
    };

    write('intent.md', artifacts.intent);
    write('spec.md', artifacts.spec);
    write('plan.md', artifacts.plan);
    write(
      'provenance.json',
      JSON.stringify(
        {
          ...provenance,
          status: 'draft',
          generatedAt: new Date().toISOString(),
          artifacts: ['intent.md', 'spec.md', 'plan.md'],
        },
        null,
        2
      )
    );

    // mkdtemp creates the dir as 0700; match the permissions of a regular mkdir.
    fs.chmodSync(stagingDir, 0o755);
    const specDir = uniqueSpecDir(specflowRoot, folderBase);
    fs.renameSync(stagingDir, specDir);
    stagingDir = null;

    const folderName = path.basename(specDir);
    return {
      ok: true,
      specTitle,
      folderName,
      absolutePath: specDir,
      relativePath: path.posix.join(SPECFLOW_DIR, folderName),
      files: names.map((name) => path.posix.join(SPECFLOW_DIR, folderName, name)),
    };
  } catch (err) {
    if (stagingDir) {
      try {
        fs.rmSync(stagingDir, { recursive: true, force: true });
      } catch {
        // Best effort: the original error is the one worth reporting.
      }
    }
    return {
      ok: false,
      error: 'write_failed',
      message: err instanceof Error ? err.message : String(err),
    };
  }
}
