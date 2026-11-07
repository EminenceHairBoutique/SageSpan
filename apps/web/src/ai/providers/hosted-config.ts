/**
 * AI-CORE-002a — enablement gates for the hosted (vendor) provider.
 *
 * The hosted adapter runs ONLY when every gate below holds. Any missing gate
 * resolves to the deterministic mock with a note that names the gate (never
 * the secret), so a half-configured environment is never silently "live".
 *
 * Gates (all server-side; nothing here is ever read in the browser):
 *   SAGESPAN_AI_PROVIDER=hosted
 *   SAGESPAN_AI_HOSTED_API_KEY          vendor key (never logged, never echoed)
 *   SAGESPAN_AI_HOSTED_MODEL            exact model id, pinned by the operator (no default)
 *   SAGESPAN_AI_HOSTED_SYNTHETIC_ACK=I_UNDERSTAND_SYNTHETIC_ONLY
 *   SAGESPAN_DEMO_MODE=1                real-data processing is gate G3 (PR-003 + vendor DPA), not this flag
 * Optional ceilings:
 *   SAGESPAN_AI_HOSTED_BASE_URL         default https://api.anthropic.com
 *   SAGESPAN_AI_HOSTED_MAX_TOKENS       per completion, default 4096
 *   SAGESPAN_AI_HOSTED_TIMEOUT_MS       per completion, default 15000
 *   SAGESPAN_AI_HOSTED_PROCESS_TOKEN_CEILING   total tokens this process may spend, default 250000 (fail closed, no mock fallback)
 *   SAGESPAN_AI_HOSTED_RUNS_PER_SCOPE_PER_HOUR default 10 (per workspace / household; ai-quota-v1 policy)
 *   SAGESPAN_AI_HOSTED_TOKENS_PER_SCOPE_PER_HOUR default 200000 (per workspace / household; ai-quota-v1 policy)
 */
export interface HostedConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
  maxTokens: number;
  timeoutMs: number;
  processTokenCeiling: number;
  runsPerScopePerHour: number;
  tokensPerScopePerHour: number;
}

export type HostedResolution = { enabled: true; config: HostedConfig } | { enabled: false; missing: string[] };

export const SYNTHETIC_ACK = "I_UNDERSTAND_SYNTHETIC_ONLY";

function int(value: string | undefined, fallback: number, min: number, max: number): number {
  const n = value ? Number.parseInt(value, 10) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function resolveHostedConfig(env: Record<string, string | undefined>): HostedResolution {
  const missing: string[] = [];
  if (!env.SAGESPAN_AI_HOSTED_API_KEY?.trim()) missing.push("SAGESPAN_AI_HOSTED_API_KEY is not set");
  if (!env.SAGESPAN_AI_HOSTED_MODEL?.trim()) missing.push("SAGESPAN_AI_HOSTED_MODEL is not set (pin the model id)");
  if (env.SAGESPAN_AI_HOSTED_SYNTHETIC_ACK?.trim() !== SYNTHETIC_ACK) missing.push(`SAGESPAN_AI_HOSTED_SYNTHETIC_ACK is not ${SYNTHETIC_ACK}`);
  if (env.SAGESPAN_DEMO_MODE?.trim() !== "1") missing.push("SAGESPAN_DEMO_MODE is not 1 (real data is gate G3)");
  if (missing.length) return { enabled: false, missing };
  const baseUrl = (env.SAGESPAN_AI_HOSTED_BASE_URL?.trim() || "https://api.anthropic.com").replace(/\/+$/, "");
  if (!/^https:\/\//.test(baseUrl)) return { enabled: false, missing: ["SAGESPAN_AI_HOSTED_BASE_URL must be https://"] };
  return {
    enabled: true,
    config: {
      apiKey: env.SAGESPAN_AI_HOSTED_API_KEY!.trim(),
      model: env.SAGESPAN_AI_HOSTED_MODEL!.trim(),
      baseUrl,
      maxTokens: int(env.SAGESPAN_AI_HOSTED_MAX_TOKENS, 4096, 256, 32_000),
      timeoutMs: int(env.SAGESPAN_AI_HOSTED_TIMEOUT_MS, 15_000, 1_000, 60_000),
      processTokenCeiling: int(env.SAGESPAN_AI_HOSTED_PROCESS_TOKEN_CEILING, 250_000, 1_000, 50_000_000),
      runsPerScopePerHour: int(env.SAGESPAN_AI_HOSTED_RUNS_PER_SCOPE_PER_HOUR, 10, 1, 1_000),
      tokensPerScopePerHour: int(env.SAGESPAN_AI_HOSTED_TOKENS_PER_SCOPE_PER_HOUR, 200_000, 1_000, 50_000_000),
    },
  };
}
