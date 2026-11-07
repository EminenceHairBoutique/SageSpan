import { randomUUID } from "node:crypto";
import { aiQuotaScopeKey, type AiQuotaDecision, type AiQuotaPolicy, type AiQuotaScope, type AiQuotaUsage } from "@sagespan/contracts";

/**
 * AI-CORE-002b — quota store interface (`ai-quota-v1`) and the in-process implementation.
 *
 * Contract for every implementation:
 *  - `reserve()` is called BEFORE the first provider call of a run; a reservation counts
 *    against `max_runs_per_window` whether or not the run later succeeds (an ERROR run still
 *    spent an attempt, and possibly tokens).
 *  - `settle()` is called after each provider turn with the tokens the provider reported; a run
 *    that never settles leaves its reservation at `tokens: null` (counted as 0 tokens, 1 run).
 *  - A store that cannot answer must THROW; the caller fails closed (the run is an ERROR, never
 *    a quiet bypass or a fallback to another provider).
 *  - Keys are scopes (workspace / household), never bare user ids.
 *
 * `InMemoryAiQuotaStore` is per process and says so in `durability`. A durable store is the AI
 * track's pending migration (table + SECURITY DEFINER reserve/settle; see the 002b runbook §6).
 */
export interface AiQuotaStore {
  readonly durability: "PER_PROCESS" | "DURABLE";
  reserve(scope: AiQuotaScope, policy: AiQuotaPolicy, nowMs: number): Promise<AiQuotaDecision>;
  settle(scope: AiQuotaScope, reservationId: string, tokens: number, nowMs: number): Promise<void>;
  /** Read-only view for dashboards and tests. */
  usage(scope: AiQuotaScope, policy: AiQuotaPolicy, nowMs: number): Promise<AiQuotaUsage>;
}

export class InMemoryAiQuotaStore implements AiQuotaStore {
  readonly durability = "PER_PROCESS" as const;
  private readonly byScope = new Map<string, AiQuotaUsage["reservations"]>();

  private window(scopeKey: string, policy: AiQuotaPolicy, nowMs: number): AiQuotaUsage["reservations"] {
    const kept = (this.byScope.get(scopeKey) ?? []).filter((r) => nowMs - r.started_at_ms < policy.window_ms);
    this.byScope.set(scopeKey, kept);
    return kept;
  }

  async reserve(scope: AiQuotaScope, policy: AiQuotaPolicy, nowMs: number): Promise<AiQuotaDecision> {
    const key = aiQuotaScopeKey(scope);
    const inWindow = this.window(key, policy, nowMs);
    if (inWindow.length >= policy.max_runs_per_window) {
      const oldest = Math.min(...inWindow.map((r) => r.started_at_ms));
      return { allowed: false, reason: "RUNS_EXHAUSTED", retry_after_ms: Math.max(0, oldest + policy.window_ms - nowMs) };
    }
    const spent = inWindow.reduce((n, r) => n + (r.tokens ?? 0), 0);
    if (policy.max_tokens_per_window !== null && spent >= policy.max_tokens_per_window) {
      const oldest = Math.min(...inWindow.map((r) => r.started_at_ms));
      return { allowed: false, reason: "TOKENS_EXHAUSTED", retry_after_ms: Math.max(0, oldest + policy.window_ms - nowMs) };
    }
    const reservation_id = `qr_${randomUUID()}`;
    inWindow.push({ reservation_id, started_at_ms: nowMs, tokens: null });
    return { allowed: true, reservation_id, remaining_runs: policy.max_runs_per_window - inWindow.length, remaining_tokens: policy.max_tokens_per_window === null ? null : Math.max(0, policy.max_tokens_per_window - spent) };
  }

  async settle(scope: AiQuotaScope, reservationId: string, tokens: number, nowMs: number): Promise<void> {
    const key = aiQuotaScopeKey(scope);
    const all = this.byScope.get(key) ?? [];
    const r = all.find((x) => x.reservation_id === reservationId);
    if (!r) throw new Error(`unknown reservation ${reservationId} for ${key}`);
    r.tokens = (r.tokens ?? 0) + Math.max(0, Math.floor(tokens));
    void nowMs;
  }

  async usage(scope: AiQuotaScope, policy: AiQuotaPolicy, nowMs: number): Promise<AiQuotaUsage> {
    const key = aiQuotaScopeKey(scope);
    return { scope_key: key, reservations: [...this.window(key, policy, nowMs)] };
  }
}

/** Test/ops helper: a store that always throws — proves callers fail closed. */
export class UnavailableAiQuotaStore implements AiQuotaStore {
  readonly durability = "PER_PROCESS" as const;
  async reserve(): Promise<AiQuotaDecision> {
    throw new Error("quota store unavailable");
  }
  async settle(): Promise<void> {
    throw new Error("quota store unavailable");
  }
  async usage(): Promise<AiQuotaUsage> {
    throw new Error("quota store unavailable");
  }
}
