import { resolveLlmConfig, type LlmProvider } from './llmConfig.js';

const CHAT_URL: Record<LlmProvider, string> = {
  nvidia: 'https://integrate.api.nvidia.com/v1/chat/completions',
  openai: 'https://api.openai.com/v1/chat/completions',
  anthropic: 'https://api.anthropic.com/v1/messages',
};

const SYSTEM_PROMPT = `You are a Specification-Driven Development (SDD) expert.
You write precise, implementation-ready technical specifications grounded in:
1) The Jira issue title and description (source of truth for requirements)
2) Optional repository context (structure and file snippets) when provided

SDD practices you follow:
- Separate WHAT (requirements) from HOW (technical approach tied to the existing codebase)
- Testable acceptance criteria with clear pass/fail conditions
- Explicit scope boundaries and "## Out of scope"
- "## Open questions" for anything not evidenced in the issue or repository — never invent requirements
- Implementation notes that reference real paths/modules from the repository context when available

Output rules:
- Valid Markdown only — do not wrap the entire document in a single outer code fence
- Match the language of the issue description (Brazilian Portuguese when the description is in Portuguese)
- Structure when applicable:
  # <issue key>: <title>
  ## Summary
  ## Context
  ## Acceptance criteria
  ## Technical approach
  ## Repository impact
  ## Out of scope
  ## Open questions`;

export type GenerateSpecResult =
  | { ok: true; markdown: string; model: string }
  | {
      ok: false;
      error: 'invalid_input' | 'not_configured' | 'repo_context_failed' | 'upstream_error' | 'empty_response';
      message?: string;
    };

async function callOpenAiCompatible(
  provider: LlmProvider,
  apiKey: string,
  model: string,
  userContent: string
): Promise<GenerateSpecResult> {
  let response: Response;
  try {
    response = await fetch(CHAT_URL[provider], {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userContent },
        ],
        temperature: 0.2,
        max_tokens: 4096,
      }),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: 'upstream_error', message };
  }

  const raw = (await response.json().catch(() => null)) as {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message?: string };
  } | null;

  if (!response.ok) {
    const detail =
      raw && typeof raw === 'object' && typeof raw.error?.message === 'string' ? raw.error.message : null;
    let message = detail ?? `${provider.toUpperCase()} API HTTP ${response.status}`;
    if (response.status === 401) {
      message = `${provider} authentication failed (HTTP 401). Check the configured API key.`;
    } else if (response.status === 403) {
      message = detail ?? `${provider} authorization failed (HTTP 403). Check that the model is enabled on your account.`;
    }
    return { ok: false, error: 'upstream_error', message };
  }

  const markdown = raw?.choices?.[0]?.message?.content?.trim() ?? '';
  if (!markdown) return { ok: false, error: 'empty_response' };
  return { ok: true, markdown, model };
}

async function callAnthropic(apiKey: string, model: string, userContent: string): Promise<GenerateSpecResult> {
  let response: Response;
  try {
    response = await fetch(CHAT_URL.anthropic, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        model,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userContent }],
        max_tokens: 4096,
      }),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: 'upstream_error', message };
  }

  const raw = (await response.json().catch(() => null)) as {
    content?: Array<{ type?: string; text?: string }>;
    error?: { message?: string };
  } | null;

  if (!response.ok) {
    const detail =
      raw && typeof raw === 'object' && typeof raw.error?.message === 'string' ? raw.error.message : null;
    let message = detail ?? `anthropic API HTTP ${response.status}`;
    if (response.status === 401) {
      message = 'anthropic authentication failed (HTTP 401). Check the configured API key.';
    }
    return { ok: false, error: 'upstream_error', message };
  }

  const markdown = raw?.content?.find((b) => b.type === 'text')?.text?.trim() ?? '';
  if (!markdown) return { ok: false, error: 'empty_response' };
  return { ok: true, markdown, model };
}

export async function generateSpecFromDescription(input: {
  jiraKey: string;
  title: string;
  description: string;
  repoContext?: string | null;
}): Promise<GenerateSpecResult> {
  const jiraKey = input.jiraKey.trim();
  const title = input.title.trim();
  const description = input.description.trim();

  if (!jiraKey || !title || !description) {
    return { ok: false, error: 'invalid_input' };
  }

  const { provider, apiKey, model } = resolveLlmConfig();
  if (!apiKey) {
    return {
      ok: false,
      error: 'not_configured',
      message: `No API key configured for ${provider}. Set it in Settings → Integrations.`,
    };
  }

  const parts = [`Issue: ${jiraKey}`, `Title: ${title}`, '', '## Jira description', description];

  const repoContext = input.repoContext?.trim();
  if (repoContext) {
    parts.push('', '## Repository context', repoContext);
  }

  const userContent = parts.join('\n');

  if (provider === 'anthropic') {
    return callAnthropic(apiKey, model, userContent);
  }
  return callOpenAiCompatible(provider, apiKey, model, userContent);
}
