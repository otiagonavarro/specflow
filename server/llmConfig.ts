import { resolveNvidiaApiKey, NVIDIA_SPEC_MODEL } from './nvidiaDefaults.js';

export type LlmProvider = 'nvidia' | 'openai' | 'anthropic';

export const LLM_PROVIDERS: LlmProvider[] = ['nvidia', 'openai', 'anthropic'];

export function isLlmProvider(value: string): value is LlmProvider {
  return (LLM_PROVIDERS as string[]).includes(value);
}

const PROVIDER_DEFAULT_MODEL: Record<LlmProvider, string> = {
  nvidia: NVIDIA_SPEC_MODEL,
  openai: 'gpt-4o-mini',
  anthropic: 'claude-3-5-sonnet-latest',
};

export interface ResolvedLlmConfig {
  provider: LlmProvider;
  apiKey: string;
  model: string;
}

/** Resolves the active LLM config. Falls back to the built-in NVIDIA default when the user hasn't overridden it. */
export function resolveLlmConfig(): ResolvedLlmConfig {
  const rawProvider = process.env.LLM_PROVIDER?.trim().toLowerCase() ?? '';
  const provider: LlmProvider = isLlmProvider(rawProvider) ? rawProvider : 'nvidia';
  const userApiKey = process.env.LLM_API_KEY?.trim() ?? '';
  const userModel = process.env.LLM_MODEL?.trim();

  return {
    provider,
    apiKey: provider === 'nvidia' ? userApiKey || resolveNvidiaApiKey() : userApiKey,
    model: userModel || PROVIDER_DEFAULT_MODEL[provider],
  };
}
