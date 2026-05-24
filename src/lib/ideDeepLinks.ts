export type IdeId = 'cursor' | 'vscode';

export const IDE_OPTIONS: { id: IdeId; labelKey: string }[] = [
  { id: 'cursor', labelKey: 'openspec.openCursor' },
  { id: 'vscode', labelKey: 'openspec.openVscode' },
];
