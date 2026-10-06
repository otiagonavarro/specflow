export type IdeId = 'cursor' | 'vscode' | 'antigravity' | 'kiro';

export const IDE_OPTIONS: { id: IdeId; labelKey: string }[] = [
  { id: 'cursor', labelKey: 'openspec.openCursor' },
  { id: 'vscode', labelKey: 'openspec.openVscode' },
  { id: 'antigravity', labelKey: 'openspec.openAntigravity' },
  { id: 'kiro', labelKey: 'openspec.openKiro' },
];
