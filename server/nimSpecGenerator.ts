import { resolveLlmConfig, type LlmProvider } from './llmConfig.js';

const CHAT_URL: Record<LlmProvider, string> = {
  nvidia: 'https://integrate.api.nvidia.com/v1/chat/completions',
  openai: 'https://api.openai.com/v1/chat/completions',
  anthropic: 'https://api.anthropic.com/v1/messages',
};

const SYSTEM_PROMPT = `You are a Specification-Driven Development (SDD) expert who writes change proposals following the OpenSpec convention.
You ground everything in:
1) The Jira issue title and description (source of truth for requirements)
2) Optional repository context (structure and file snippets) when provided

Guardrails (same as the OpenSpec /openspec-proposal workflow):
- Favor straightforward, minimal implementations first; add complexity only when clearly required by the issue.
- Keep the proposal tightly scoped to the requested outcome.
- Do not invent requirements that aren't evidenced by the issue or repository context — list unknowns under open questions instead.
- Do not write implementation code. Only produce design/spec documents.
- Map the change into one or more capabilities (verb-noun, single purpose, e.g. "user-auth", "payment-capture").

Output rules:
- Respond with ONLY a single valid JSON object. No markdown code fences, no prose before or after.
- Match the language of the issue description in every text field (Brazilian Portuguese when the description is in Portuguese).
- JSON shape:
  {
    "changeId": "kebab-case verb-led id, e.g. add-two-factor-auth",
    "proposal": "markdown content of proposal.md",
    "tasks": "markdown content of tasks.md",
    "design": "markdown content of design.md, or null if not needed",
    "specs": [ { "capability": "kebab-case-capability", "delta": "markdown spec delta for that capability" } ]
  }

- "proposal" MUST follow this structure:
  # Change: <brief description>

  ## Why
  <1-2 sentences on problem/opportunity>

  ## What Changes
  - <bullet list of changes, mark breaking changes with **BREAKING**>

  ## Impact
  - Affected specs: <capabilities>
  - Affected code: <key files/systems, using file.ts:42 references when repository context is available>

  ## Open Questions
  - <anything not evidenced in the issue or repository — omit this section only if there is truly nothing open>

- "tasks" MUST be an ordered checklist grouped by section, e.g.:
  ## 1. Implementation
  - [ ] 1.1 <small, verifiable, user-visible step>
  - [ ] 1.2 <...>
  ## 2. Validation
  - [ ] 2.1 <tests/tooling>

- "design" is optional (use null when not needed). Only include it for cross-cutting changes, new architectural patterns, new external dependencies, or real trade-offs. When present it follows:
  ## Context
  ## Goals / Non-Goals
  ## Decisions
  ## Risks / Trade-offs
  ## Migration Plan
  ## Open Questions

- Each entry in "specs" is one capability's delta, using OpenSpec's delta format:
  ## ADDED Requirements
  ### Requirement: <name>
  The system SHALL ...

  #### Scenario: <name>
  - **WHEN** <condition>
  - **THEN** <expected result>

  ## MODIFIED Requirements
  ### Requirement: <name>
  <complete updated requirement, including all scenarios>

  ## REMOVED Requirements
  ### Requirement: <name>
  **Reason**: <why>
  **Migration**: <how to handle>

  Use SHALL/MUST wording. Every requirement needs at least one "#### Scenario:" (four hashes, never a bullet or bold line). If multiple capabilities are affected, add one entry per capability to "specs".`;

export type SpecDelta = { capability: string; delta: string };

export type StructuredSpec = {
  changeId: string;
  proposal: string;
  tasks: string;
  design: string | null;
  specs: SpecDelta[];
};

export type GenerateSpecResult =
  | { ok: true; kind: 'structured'; structured: StructuredSpec; model: string }
  | { ok: true; kind: 'legacy'; markdown: string; model: string }
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

const CHANGE_ID_RE = /^[a-z0-9][a-z0-9-]{0,79}$/;
const CAPABILITY_RE = /^[a-z0-9][a-z0-9-]{0,79}$/;
const DELTA_ADDED_OR_MODIFIED_RE = /^##\s+(ADDED|MODIFIED)\s+Requirements/m;
const DELTA_REMOVED_RE = /^##\s+REMOVED\s+Requirements/m;
const DELTA_SCENARIO_RE = /^####\s+Scenario:/m;

/**
 * True when a delta has a recognized OpenSpec section header, and — for
 * ADDED/MODIFIED sections, which introduce requirements — at least one
 * "#### Scenario:" block. REMOVED-only deltas don't need scenarios.
 */
function isValidOpenSpecDelta(delta: string): boolean {
  const hasAddedOrModified = DELTA_ADDED_OR_MODIFIED_RE.test(delta);
  const hasRemoved = DELTA_REMOVED_RE.test(delta);
  if (!hasAddedOrModified && !hasRemoved) return false;
  if (hasAddedOrModified && !DELTA_SCENARIO_RE.test(delta)) return false;
  return true;
}

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

function parseStructuredSpec(raw: string): StructuredSpec | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripCodeFence(raw));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;

  const obj = parsed as Record<string, unknown>;
  const proposal = typeof obj.proposal === 'string' ? obj.proposal.trim() : '';
  const tasks = typeof obj.tasks === 'string' ? obj.tasks.trim() : '';
  if (!proposal || !tasks) return null;

  const specsRaw = Array.isArray(obj.specs) ? obj.specs : [];
  const specs: SpecDelta[] = [];
  const seenCapabilities = new Set<string>();
  for (const entry of specsRaw) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    const capabilityRaw = typeof e.capability === 'string' ? e.capability.trim() : '';
    const delta = typeof e.delta === 'string' ? e.delta.trim() : '';
    if (!capabilityRaw || !delta) continue;
    const capability = slugify(capabilityRaw);
    if (!capability || !CAPABILITY_RE.test(capability)) continue;
    if (!isValidOpenSpecDelta(delta)) continue;
    if (seenCapabilities.has(capability)) continue;
    seenCapabilities.add(capability);
    specs.push({ capability, delta });
  }
  if (specs.length === 0) return null;

  const changeIdRaw = typeof obj.changeId === 'string' ? slugify(obj.changeId) : '';
  const changeId = CHANGE_ID_RE.test(changeIdRaw) ? changeIdRaw : slugify(proposal.split('\n')[0] || '');
  if (!changeId) return null;

  const design = typeof obj.design === 'string' && obj.design.trim() ? obj.design.trim() : null;

  return { changeId, proposal, tasks, design, specs };
}

function parseModelOutput(raw: string, model: string): GenerateSpecResult {
  const text = raw.trim();
  if (!text) return { ok: false, error: 'empty_response' };

  const structured = parseStructuredSpec(text);
  if (structured) return { ok: true, kind: 'structured', structured, model };

  return { ok: true, kind: 'legacy', markdown: text, model };
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

  const content = raw?.choices?.[0]?.message?.content ?? '';
  return parseModelOutput(content, model);
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

  const content = raw?.content?.find((b) => b.type === 'text')?.text ?? '';
  return parseModelOutput(content, model);
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
