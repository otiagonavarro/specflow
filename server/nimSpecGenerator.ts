import { resolveLlmConfig, type LlmProvider } from './llmConfig.js';

const CHAT_URL: Record<LlmProvider, string> = {
  nvidia: 'https://integrate.api.nvidia.com/v1/chat/completions',
  openai: 'https://api.openai.com/v1/chat/completions',
  anthropic: 'https://api.anthropic.com/v1/messages',
};

/**
 * Bump when SYSTEM_PROMPT changes in a way that alters the generated artifacts —
 * it is recorded in provenance.json so each artifact set can be traced back to
 * the prompt that produced it.
 */
export const PROMPT_VERSION = 'ai-native-sdlc/1';

/**
 * Artifact chain from the AI-native SDLC playbook
 * (https://claude.com/blog/the-ai-native-sdlc-playbook):
 * intent.md (Stage 1 · Plan) → spec.md (Stage 2 · Design) → plan.md (Stage 3 · Build).
 */
const SYSTEM_PROMPT = `You turn a Jira issue into the first three artifacts of the AI-native SDLC playbook: intent.md, spec.md and plan.md.
Each artifact is read by the next stage, so together they form the audit trail of the change.
You ground everything in:
1) The Jira issue title and description (source of truth for the intent)
2) Optional repository context (structure and file snippets) when provided

Guardrails:
- Keep the change tightly scoped to the outcome the issue asks for; favor straightforward, minimal implementations.
- Do not invent requirements that aren't evidenced by the issue or repository context — list unknowns under "Open questions" or "Areas of concern" instead.
- Do not write implementation code. Only produce the documents.
- Every artifact notes the Jira key so it stays linked to the system of record.

Output rules:
- Respond with ONLY a single valid JSON object. No markdown code fences, no prose before or after.
- Match the language of the issue description in every text field (Brazilian Portuguese when the description is in Portuguese). Keep the section headings below in the same language as the content.
- JSON shape:
  {
    "slug": "kebab-case feature name, e.g. two-factor-auth",
    "intent": "markdown content of intent.md",
    "spec": "markdown content of spec.md",
    "plan": "markdown content of plan.md"
  }

- "intent" (Stage 1 · Plan) captures the originator's intent in their own words, MUST follow:
  # Intent: <feature name>
  Source: <JIRA-KEY>. Status: draft.

  ## Problem
  <what users cannot do today>

  ## Proposed outcome
  <what better looks like>

  ## Affected users and systems
  <scope of change>

  ## Constraints
  <limitations or requirements stated or implied by the issue>

  ## Open questions
  <items needing clarification>

- "spec" (Stage 2 · Design) collapses requirements and design into one document derived from the intent, MUST follow:
  # Spec: <feature name>
  Source: <JIRA-KEY> · Intent: intent.md. Status: draft — pending product owner sign-off.

  ## Summary
  <1-2 sentences>

  ## Requirements
  ### Requirement: <name>
  The system SHALL ...

  #### Scenario: <name>
  - **WHEN** <condition>
  - **THEN** <expected result>

  ## Design
  <how the change fits the existing architecture; key decisions and trade-offs, citing file.ts:42 when repository context is available>

  ## Non-goals
  <what is explicitly out of scope>

  ## Areas of concern
  <security, compliance, UX, data or brand concerns that need a named policy owner's review; write "None identified." when there are none>

  Use SHALL/MUST wording. Every requirement needs at least one "#### Scenario:" (four hashes, never a bullet or bold line).

- "plan" (Stage 3 · Build) is the implementation plan; an engineer who has never seen the conversation must be able to implement the change from it alone. MUST follow:
  # Plan: <feature name>
  Source: <JIRA-KEY> · Spec: spec.md. Status: draft — pending engineer review.

  ## Files that change
  - <path> — <what changes>

  ## Order of work
  1. <small, verifiable step>
  2. <...>

  ## Risks
  - <what could break> — <mitigation>

  ## Proof
  - <test or check that demonstrates the change is complete; for bug fixes, the failing test to write first>

  Only list files evidenced by the repository context; when context is missing, describe the area of the code and flag it under Risks.`;

export type GeneratedArtifacts = {
  slug: string;
  intent: string;
  spec: string;
  plan: string;
};

export type GenerateSpecResult =
  | { ok: true; kind: 'structured'; artifacts: GeneratedArtifacts; provider: LlmProvider; model: string }
  | { ok: true; kind: 'legacy'; markdown: string; provider: LlmProvider; model: string }
  | {
      ok: false;
      error: 'invalid_input' | 'not_configured' | 'repo_context_failed' | 'upstream_error' | 'empty_response';
      message?: string;
    };

function stripCodeFence(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,79}$/;
const INTENT_HEADING_RE = /^#\s+\S/m;
const SPEC_SCENARIO_RE = /^####\s+Scenario:/m;
const PLAN_STEPS_RE = /^\s*1\.\s+\S/m;

function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
}

function firstHeadingText(markdown: string): string {
  const line = markdown.split('\n').find((l) => /^#\s+/.test(l.trim())) ?? '';
  return line.replace(/^#\s+/, '').replace(/^[^:]{1,20}:\s*/, '').trim();
}

/**
 * Parses the model's JSON into the intent/spec/plan chain. Each artifact must
 * have the minimum shape the next stage relies on: a heading for intent,
 * at least one scenario for spec, and an ordered list of steps for plan.
 */
function parseArtifacts(raw: string): GeneratedArtifacts | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripCodeFence(raw));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;

  const obj = parsed as Record<string, unknown>;
  const text = (key: string) => (typeof obj[key] === 'string' ? (obj[key] as string).trim() : '');
  const intent = text('intent');
  const spec = text('spec');
  const plan = text('plan');

  if (!INTENT_HEADING_RE.test(intent)) return null;
  if (!SPEC_SCENARIO_RE.test(spec)) return null;
  if (!PLAN_STEPS_RE.test(plan)) return null;

  const slugRaw = slugify(text('slug'));
  const slug = SLUG_RE.test(slugRaw) ? slugRaw : slugify(firstHeadingText(intent));
  if (!slug) return null;

  return { slug, intent, spec, plan };
}

function parseModelOutput(raw: string, provider: LlmProvider, model: string): GenerateSpecResult {
  const text = raw.trim();
  if (!text) return { ok: false, error: 'empty_response' };

  const artifacts = parseArtifacts(text);
  if (artifacts) return { ok: true, kind: 'structured', artifacts, provider, model };

  return { ok: true, kind: 'legacy', markdown: text, provider, model };
}

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
        max_tokens: 8192,
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

  const content = raw?.choices?.[0]?.message?.content ?? '';
  return parseModelOutput(content, provider, model);
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
        max_tokens: 8192,
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

  const content = raw?.content?.find((b) => b.type === 'text')?.text ?? '';
  return parseModelOutput(content, 'anthropic', model);
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
