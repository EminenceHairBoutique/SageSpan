import { z } from "zod";

/**
 * AI-CORE-002b — per-workspace quota contract (`ai-quota-v1`).
 *
 * A live provider spends money and sends authorised data outside the process, so
 * how much of it a workspace may do is POLICY, decided by the server before a
 * call, not by the model and not by whoever holds the key. This contract names:
 *  - the policy (what a scope may spend in a rolling window),
 *  - the usage counters a store keeps per scope,
 *  - the decision a store returns when a run asks to start,
 *  - the reservation a run settles when it knows what it spent.
 *
 * Durability is the store's property, not the contract's. The in-process store
 * shipped with 002b is honest about being per-process; a durable store needs the
 * AI track's migration (table sketch in docs/ai/AI_CORE_002B_LIVE_BENCHMARK_REVIEW.md
 * §6) and a number from `supabase/migrations/REGISTRY.md`.
 */
export const AI_QUOTA_SCHEMA_VERSION = "ai-quota-v1" as const;

/** Scope key: one personal workspace or one firm household. Never a bare user id (quotas follow the data, not the person). */
export const AiQuotaScopeSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("PERSONAL_WORKSPACE"), workspace_id: z.string().min(1) }),
  z.strictObject({ kind: z.literal("FIRM_HOUSEHOLD"), org_id: z.string().min(1), household_id: z.string().min(1) }),
]);
export type AiQuotaScope = z.infer<typeof AiQuotaScopeSchema>;

export function aiQuotaScopeKey(scope: AiQuotaScope): string {
  return scope.kind === "PERSONAL_WORKSPACE" ? `personal:${scope.workspace_id}` : `firm:${scope.org_id}:${scope.household_id}`;
}

export const AiQuotaPolicySchema = z.strictObject({
  schema_version: z.literal(AI_QUOTA_SCHEMA_VERSION),
  /** Rolling window in which the limits apply. */
  window_ms: z.number().int().min(60_000).max(31 * 24 * 3_600_000),
  /** Runs a scope may START in the window (a reservation counts even if the run later errors). */
  max_runs_per_window: z.number().int().min(1).max(10_000),
  /** Tokens (input + output, as reported by the provider) a scope may settle in the window; null = unlimited by tokens. */
  max_tokens_per_window: z.number().int().min(1).nullable(),
  /** Hard stop for a single run; the runtime's wall-clock and output budgets still apply. */
  max_tokens_per_run: z.number().int().min(1).nullable(),
});
export type AiQuotaPolicy = z.infer<typeof AiQuotaPolicySchema>;

export const DEFAULT_AI_QUOTA_POLICY: AiQuotaPolicy = {
  schema_version: AI_QUOTA_SCHEMA_VERSION,
  window_ms: 3_600_000,
  max_runs_per_window: 10,
  max_tokens_per_window: 200_000,
  max_tokens_per_run: 40_000,
};

/** Counters a store keeps per scope; rows older than the window are irrelevant to a decision. */
export const AiQuotaUsageSchema = z.strictObject({
  scope_key: z.string().min(1),
  /** Reservations whose started_at is inside the window, with settled tokens (null until settled). */
  reservations: z.array(z.strictObject({ reservation_id: z.string().min(1), started_at_ms: z.number().int().nonnegative(), tokens: z.number().int().nonnegative().nullable() })),
});
export type AiQuotaUsage = z.infer<typeof AiQuotaUsageSchema>;

export const AI_QUOTA_DENIALS = ["RUNS_EXHAUSTED", "TOKENS_EXHAUSTED", "STORE_UNAVAILABLE"] as const;
export type AiQuotaDenial = (typeof AI_QUOTA_DENIALS)[number];

/** Decision for one run. `retry_after_ms` is advisory and never shortens a denial. */
export const AiQuotaDecisionSchema = z.discriminatedUnion("allowed", [
  z.strictObject({
    allowed: z.literal(true),
    reservation_id: z.string().min(1),
    remaining_runs: z.number().int().nonnegative(),
    remaining_tokens: z.number().int().nonnegative().nullable(),
  }),
  z.strictObject({
    allowed: z.literal(false),
    reason: z.enum(AI_QUOTA_DENIALS),
    retry_after_ms: z.number().int().nonnegative().nullable(),
  }),
]);
export type AiQuotaDecision = z.infer<typeof AiQuotaDecisionSchema>;
