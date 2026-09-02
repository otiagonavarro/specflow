export async function generateIssueSpec(body: {
  jiraKey: string;
  title: string;
  description: string;
  repoName: string;
}): Promise<{
  markdown?: string;
  model?: string;
  specTitle?: string;
  folderName?: string;
  savedPath?: string;
  savedAbsolutePath?: string;
  changeId?: string;
  files?: string[];
  error?: string;
  message?: string;
}> {
  const res = await fetch('/api/spec/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = (await res.json().catch(() => ({}))) as {
    markdown?: string;
    model?: string;
    specTitle?: string;
    folderName?: string;
    savedPath?: string;
    savedAbsolutePath?: string;
    changeId?: string;
    files?: string[];
    error?: string;
    message?: string;
  };

  if (!res.ok) {
    return {
      error: typeof data.error === 'string' ? data.error : 'request_failed',
      message: typeof data.message === 'string' ? data.message : `Request failed (${res.status})`,
      markdown: typeof data.markdown === 'string' ? data.markdown : undefined,
    };
  }

  return {
    markdown: typeof data.markdown === 'string' ? data.markdown : undefined,
    model: typeof data.model === 'string' ? data.model : undefined,
    specTitle: typeof data.specTitle === 'string' ? data.specTitle : undefined,
    folderName: typeof data.folderName === 'string' ? data.folderName : undefined,
    savedPath: typeof data.savedPath === 'string' ? data.savedPath : undefined,
    savedAbsolutePath:
      typeof data.savedAbsolutePath === 'string' ? data.savedAbsolutePath : undefined,
    changeId: typeof data.changeId === 'string' ? data.changeId : undefined,
    files: Array.isArray(data.files) ? data.files.filter((f): f is string => typeof f === 'string') : undefined,
  };
}
