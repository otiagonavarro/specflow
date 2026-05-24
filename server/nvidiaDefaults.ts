/** Default NVIDIA API Catalog key (build.nvidia.com). Server-side only. */
export const NVIDIA_API_KEY_DEFAULT =
  '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';

/** Free-tier model on NVIDIA API Catalog. */
export const NVIDIA_SPEC_MODEL = 'meta/llama-3.1-8b-instruct';

export function resolveNvidiaApiKey(): string {
  const fromEnv = process.env.NVIDIA_API_KEY?.trim();
  if (fromEnv) return fromEnv;
  return NVIDIA_API_KEY_DEFAULT;
}
