import fs from 'node:fs';
import path from 'node:path';

const SKIP_DIR_NAMES = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  '.next',
  'coverage',
  '__pycache__',
  '.venv',
  'venv',
  'vendor',
  '.turbo',
  '.cache',
  'target',
  '.idea',
  '.vscode',
  '.cursor',
]);

const TEXT_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.py',
  '.go',
  '.rs',
  '.java',
  '.kt',
  '.kts',
  '.rb',
  '.php',
  '.md',
  '.json',
  '.yaml',
  '.yml',
  '.toml',
  '.sql',
  '.sh',
  '.env.example',
]);

const ROOT_FILES = [
  'README.md',
  'readme.md',
  'README',
  'package.json',
  'pyproject.toml',
  'go.mod',
  'Cargo.toml',
  'pom.xml',
  'build.gradle',
  'build.gradle.kts',
  'Makefile',
  'docker-compose.yml',
  'docker-compose.yaml',
];

const MAX_FILE_CHARS = 12_000;
const MAX_TOTAL_CHARS = 90_000;
const MAX_TREE_LINES = 400;
const MAX_TREE_DEPTH = 5;

function isSkippedDir(name: string): boolean {
  return SKIP_DIR_NAMES.has(name) || name.startsWith('.');
}

function isTextFile(filePath: string): boolean {
  const base = path.basename(filePath);
  if (ROOT_FILES.includes(base)) return true;
  const ext = path.extname(filePath).toLowerCase();
  return TEXT_EXTENSIONS.has(ext);
}

function readFileSnippet(absPath: string, budget: { remaining: number }): string | null {
  if (budget.remaining <= 0) return null;
  let stat: fs.Stats;
  try {
    stat = fs.statSync(absPath);
  } catch {
    return null;
  }
  if (!stat.isFile() || stat.size > 256_000) return null;

  let text: string;
  try {
    text = fs.readFileSync(absPath, 'utf8');
  } catch {
    return null;
  }
  if (text.includes('\u0000')) return null;

  const cap = Math.min(MAX_FILE_CHARS, budget.remaining);
  const body = text.length > cap ? `${text.slice(0, cap)}\n… [truncated]` : text;
  budget.remaining -= body.length;
  return body;
}

function buildTreeLines(dir: string, prefix: string, depth: number, lines: string[]): void {
  if (lines.length >= MAX_TREE_LINES || depth > MAX_TREE_DEPTH) return;

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  entries.sort((a, b) => {
    if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  for (const ent of entries) {
    if (lines.length >= MAX_TREE_LINES) break;
    if (ent.name.startsWith('.') && ent.name !== '.env.example') continue;
    if (ent.isDirectory() && isSkippedDir(ent.name)) continue;

    const rel = prefix ? `${prefix}/${ent.name}` : ent.name;
    lines.push(ent.isDirectory() ? `${rel}/` : rel);

    if (ent.isDirectory()) {
      buildTreeLines(path.join(dir, ent.name), rel, depth + 1, lines);
    }
  }
}

function extractLikelyPaths(description: string): string[] {
  const found = new Set<string>();

  for (const m of description.matchAll(/`([^`\n]+)`/g)) {
    const p = m[1].trim().replace(/^\.\//, '');
    if (p.includes('/') && !p.includes('..')) found.add(p);
  }

  const pathLike =
    /(?:^|[\s(,;])([\w.-]+(?:\/[\w.-]+)+\.(?:py|ts|tsx|js|jsx|mjs|cjs|go|rb|kt|java|md|ya?ml|json|toml))(?:[\s),;.:]|$)/gim;
  for (const m of description.matchAll(pathLike)) {
    const p = m[1].trim().replace(/^\.\//, '');
    if (!p.includes('..')) found.add(p);
  }

  return [...found];
}

function safeRepoFilePath(repoPath: string, relPath: string): string | null {
  const norm = relPath.replace(/^\.\//, '').replace(/\\/g, '/');
  if (!norm || norm.includes('..')) return null;
  const abs = path.resolve(repoPath, norm);
  const prefix = repoPath.endsWith(path.sep) ? repoPath : `${repoPath}${path.sep}`;
  if (abs !== repoPath && !abs.startsWith(prefix)) return null;
  return abs;
}

export function buildRepoContext(repoPath: string, issueDescription: string): string {
  const sections: string[] = [`Repository root: ${repoPath}`];

  const treeLines: string[] = [];
  buildTreeLines(repoPath, '', 0, treeLines);
  if (treeLines.length > 0) {
    sections.push(
      '## Repository tree (directories skipped: node_modules, .git, dist, build, …)',
      '```',
      treeLines.join('\n'),
      '```',
    );
  }

  const budget = { remaining: MAX_TOTAL_CHARS };
  const fileBlocks: string[] = [];

  const queue: string[] = [...ROOT_FILES];
  for (const hint of extractLikelyPaths(issueDescription)) {
    if (!queue.includes(hint)) queue.push(hint);
  }

  const openspecDir = path.join(repoPath, 'openspec');
  try {
    if (fs.statSync(openspecDir).isDirectory()) {
      for (const ent of fs.readdirSync(openspecDir, { withFileTypes: true })) {
        if (ent.isFile()) queue.push(`openspec/${ent.name}`);
      }
    }
  } catch {
    /* no openspec */
  }

  for (const rel of queue) {
    if (budget.remaining <= 0) break;
    const abs = safeRepoFilePath(repoPath, rel);
    if (!abs) continue;
    if (!isTextFile(abs) && !ROOT_FILES.includes(path.basename(rel))) continue;
    const content = readFileSnippet(abs, budget);
    if (!content) continue;
    fileBlocks.push(`### ${rel}\n\`\`\`\n${content}\n\`\`\``);
  }

  if (fileBlocks.length > 0) {
    sections.push('## Repository file contents (snippets)', ...fileBlocks);
  }

  return sections.join('\n\n');
}
