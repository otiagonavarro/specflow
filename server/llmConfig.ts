import { resolveNvidiaApiKey, resolveNvidiaModel } from './nvidiaDefaults.js';

export type LlmProvider = 'nvidia' | 'openai' | 'anthropic';

export const LLM_PROVIDERS: LlmProvider[] = ['nvidia', 'openai', 'anthropic'];

export function isLlmProvider(value: string): value is LlmProvider {
  return (LLM_PROVIDERS as string[]).includes(value);
}

const PROVIDER_DEFAULT_MODEL: Record<LlmProvider, () => string> = {
  nvidia: resolveNvidiaModel,
  openai: () => 'gpt-4o-mini',
  anthropic: () => 'claude-sonnet-5-5',
};

export interface ResolvedLlmConfig {
  provider: LlmProvider;
  apiKey: string;
  model: string;
}

/** "review" lets PR reviews use a stronger model than spec generation (REVIEW_LLM_* in .env). */
export type LlmConfigScope = 'default' | 'review';

/** Resolves the active LLM config. Falls back to NVIDIA (NVIDIA_API_KEY / NVIDIA_SPEC_MODEL) when the user hasn't overridden it. */
export function resolveLlmConfig(scope: LlmConfigScope = 'default'): ResolvedLlmConfig {
  const reviewProvider = process.env.REVIEW_LLM_PROVIDER?.trim().toLowerCase() ?? '';
  if (scope === 'review' && isLlmProvider(reviewProvider)) {
    const key = process.env.REVIEW_LLM_API_KEY?.trim() ?? '';
    return {
      provider: reviewProvider,
      apiKey: reviewProvider === 'nvidia' ? key || resolveNvidiaApiKey() : key,
      model: process.env.REVIEW_LLM_MODEL?.trim() || PROVIDER_DEFAULT_MODEL[reviewProvider](),
    };
  }

  const rawProvider = process.env.LLM_PROVIDER?.trim().toLowerCase() ?? '';
  const provider: LlmProvider = isLlmProvider(rawProvider) ? rawProvider : 'nvidia';
  const userApiKey = process.env.LLM_API_KEY?.trim() ?? '';
  const userModel = process.env.LLM_MODEL?.trim();

  return {
    provider,
    apiKey: provider === 'nvidia' ? userApiKey || resolveNvidiaApiKey() : userApiKey,
    model: userModel || PROVIDER_DEFAULT_MODEL[provider](),
  };
}
