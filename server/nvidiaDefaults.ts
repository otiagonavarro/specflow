/** Free-tier model on NVIDIA API Catalog. Override with NVIDIA_SPEC_MODEL in .env. */
export const NVIDIA_SPEC_MODEL_DEFAULT = 'openai/gpt-oss-20b';

export function resolveNvidiaModel(): string {
  return process.env.NVIDIA_SPEC_MODEL?.trim() || NVIDIA_SPEC_MODEL_DEFAULT;
}

/** NVIDIA API Catalog key (build.nvidia.com), read from NVIDIA_API_KEY in .env. Server-side only. */
export function resolveNvidiaApiKey(): string {
  return process.env.NVIDIA_API_KEY_DEFAULT?.trim() ?? '';
}
