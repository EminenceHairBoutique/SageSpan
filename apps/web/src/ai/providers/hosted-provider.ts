import { randomUUID } from "node:crypto";
import { z } from "zod";
import { AI_ABSTAIN_STATUS, AI_QUOTA_SCHEMA_VERSION, AI_REVIEW_SCHEMA_VERSION, AI_TOOLS, AI_TOOL_ARG_SCHEMAS, AiFindingSchema, type AiProviderDescriptor, type AiQuotaPolicy, type AiQuotaScope } from "@sagespan/contracts";
import type { AiProvider, ContinuationInput, ProviderInput, ProviderResult } from "../provider";
import { InMemoryAiQuotaStore, type AiQuotaStore } from "../quota/store";
import type { HostedConfig } from "./hosted-config";
import type { LiveProviderFailure, LiveProviderPort, LiveProviderRequest } from "./port";

/**
 * AI-CORE-002a/b — `AiProvider` over a `LiveProviderPort` (hosted vendor).
 *
 * The runtime does not change for a live vendor: this class turns the runtime's
 * `complete()` / `continue()` into port requests and port responses back into
 * untrusted `AiModelOutput`. What it adds on top of the port:
 *  - a per-process token meter with a hard ceiling (fail CLOSED with a typed
 *    error → the run records ERROR; there is no silent fallback to the mock or to
 *    a cheaper model);
 *  - per-scope quotas through an `AiQuotaStore` (`ai-quota-v1`, AI-CORE-002b):
 *    a reservation is taken BEFORE the first vendor call and settled with the
 *    tokens each turn reports; a store that cannot answer fails the run closed;
 *  - server-generated request ids; the vendor's served model recorded on the run.
 * Secrets: the key lives in `HostedConfig` and is read by the port only.
 */
export class HostedProviderError extends Error {
  constructor(
    readonly kind: LiveProviderFailure["kind"] | "TOKEN_CEILING" | "RATE_LIMIT_SCOPE" | "TOKEN_QUOTA_SCOPE" | "TOKEN_QUOTA_RUN" | "QUOTA_UNAVAILABLE",
    detail: string,
  ) {
    super(`hosted provider ${kind}: ${detail}`);
    this.name = "HostedProviderError";
  }
}

/** Strict shape the vendor must emit through `emit_review`; the runtime's validator re-checks everything regardless. */
export const EmitReviewSchema = z.object({
  status: z.enum(["DRAFT_FOR_HUMAN_REVIEW", AI_ABSTAIN_STATUS]),
  findings: z.array(AiFindingSchema).max(25),
  summary: z.string().max(4000),
  draft_memo: z.string().max(8000).optional(),
  questions: z.array(z.string().max(400)).max(20).optional(),
  limitations: z.array(z.string().max(400)).max(20).optional(),
});

export function toolJsonSchemas(): Array<{ name: string; args_json_schema: Record<string, unknown> }> {
  return AI_TOOLS.map((name) => ({ name, args_json_schema: z.toJSONSchema(AI_TOOL_ARG_SCHEMAS[name]) as Record<string, unknown> }));
}

export function outputJsonSchema(): Record<string, unknown> {
  return z.toJSONSchema(EmitReviewSchema) as Record<string, unknown>;
}

/** The `ai-quota-v1` policy a `HostedConfig` expresses. */
export function quotaPolicyFromConfig(config: HostedConfig): AiQuotaPolicy {
  return { schema_version: AI_QUOTA_SCHEMA_VERSION, window_ms: 3_600_000, max_runs_per_window: config.runsPerScopePerHour, max_tokens_per_window: config.tokensPerScopePerHour, max_tokens_per_run: Math.min(config.tokensPerScopePerHour, config.maxTokens * 8) };
}

export interface HostedProviderOptions {
  now?: () => number;
  /** Defaults to the per-process store; a durable store is the AI track's pending migration. */
  quota?: AiQuotaStore;
}

interface RunLease {
  scope: AiQuotaScope;
  reservation_id: string;
  tokens: number;
}

export class HostedProvider implements AiProvider {
  readonly name: string;
  readonly model: string;
  readonly mode = "LIVE" as const;
  /** A hosted model needs a longer run wall clock than the in-process mock's 20 s default. */
  readonly budgetHint: { max_wall_clock_ms: number };
  private tokensSpent = 0;
  private readonly leases = new Map<string, RunLease>();
  private readonly now: () => number;
  private readonly quota: AiQuotaStore;
  private readonly policy: AiQuotaPolicy;

  constructor(
    private readonly port: LiveProviderPort,
    private readonly config: HostedConfig,
    options: HostedProviderOptions = {},
  ) {
    const d = port.describe();
    this.name = d.provider;
    this.model = config.model;
    this.budgetHint = { max_wall_clock_ms: config.runWallClockMs };
    this.now = options.now ?? Date.now;
    this.quota = options.quota ?? new InMemoryAiQuotaStore();
    this.policy = quotaPolicyFromConfig(config);
  }

  describe(): AiProviderDescriptor {
    return this.port.describe();
  }

  get tokensSpentThisProcess(): number {
    return this.tokensSpent;
  }

  get quotaStore(): AiQuotaStore {
    return this.quota;
  }

  private scope(input: ProviderInput): AiQuotaScope {
    const s = input.context.scope;
    return s.kind === "FIRM_HOUSEHOLD" ? { kind: "FIRM_HOUSEHOLD", org_id: s.org_id, household_id: s.household_id } : { kind: "PERSONAL_WORKSPACE", workspace_id: s.workspace_id };
  }

  private leaseKey(input: ProviderInput): string {
    // The runtime stamps a run id; a provider called outside the runtime still gets a per-scope key.
    return input.run_id ?? `scope:${JSON.stringify(this.scope(input))}`;
  }

  /** Reserve quota for this run BEFORE any vendor call. Any store failure is a closed failure. */
  private async admitRun(input: ProviderInput): Promise<void> {
    const scope = this.scope(input);
    let decision;
    try {
      decision = await this.quota.reserve(scope, this.policy, this.now());
    } catch (e) {
      throw new HostedProviderError("QUOTA_UNAVAILABLE", `quota store did not answer (${e instanceof Error ? e.name : "error"}); refusing to call the vendor without a quota decision`);
    }
    if (!decision.allowed) {
      const retry = decision.retry_after_ms != null ? ` (retry after ${Math.ceil(decision.retry_after_ms / 1000)} s)` : "";
      if (decision.reason === "RUNS_EXHAUSTED") throw new HostedProviderError("RATE_LIMIT_SCOPE", `${this.policy.max_runs_per_window} hosted runs per hour reached for this workspace${retry}`);
      if (decision.reason === "TOKENS_EXHAUSTED") throw new HostedProviderError("TOKEN_QUOTA_SCOPE", `${this.policy.max_tokens_per_window} hosted tokens per hour reached for this workspace${retry}`);
      throw new HostedProviderError("QUOTA_UNAVAILABLE", "quota store unavailable");
    }
    this.leases.set(this.leaseKey(input), { scope, reservation_id: decision.reservation_id, tokens: 0 });
  }

  private async invoke(input: ProviderInput, turn: number, prior: ContinuationInput["prior_output"] | null, toolResults: ContinuationInput["tool_results"]): Promise<ProviderResult> {
    if (this.tokensSpent >= this.config.processTokenCeiling) throw new HostedProviderError("TOKEN_CEILING", `process token ceiling ${this.config.processTokenCeiling} reached; hosted runs are disabled until restart`);
    const lease = this.leases.get(this.leaseKey(input));
    if (lease && this.policy.max_tokens_per_run !== null && lease.tokens >= this.policy.max_tokens_per_run) throw new HostedProviderError("TOKEN_QUOTA_RUN", `this run has already settled ${lease.tokens} tokens; the per-run quota is ${this.policy.max_tokens_per_run}`);
    const req: LiveProviderRequest = {
      output_schema_version: AI_REVIEW_SCHEMA_VERSION,
      output_json_schema: outputJsonSchema(),
      prompt_version: input.prompt_version,
      system_prompt: input.system_prompt,
      context_json: JSON.stringify({ scope: input.context.scope, snapshot_id: input.context.snapshot_id, citable_ids: [...input.context.citable_ids] }),
      tools: toolJsonSchemas(),
      turn,
      prior_output: prior,
      tool_results: toolResults,
      max_output_chars: 60_000,
      timeout_ms: this.config.timeoutMs,
      request_id: `sgs_${randomUUID()}`,
    };
    const res = await this.port.invoke(req);
    if (!res.ok) {
      const f = res.failure;
      const detail = f.kind === "REFUSED" ? f.reason : f.kind === "RATE_LIMITED" ? `vendor rate limit${f.retry_after_ms != null ? ` (retry after ${f.retry_after_ms} ms)` : ""}` : f.kind === "TIMEOUT" ? `no answer within ${this.config.timeoutMs} ms` : f.detail;
      throw new HostedProviderError(f.kind, `${detail} [request ${f.request_id}]`);
    }
    const used = (res.response.usage.input_tokens ?? 0) + (res.response.usage.output_tokens ?? 0);
    this.tokensSpent += used;
    if (lease) {
      lease.tokens += used;
      try {
        await this.quota.settle(lease.scope, lease.reservation_id, used, this.now());
      } catch (e) {
        // The vendor already answered; the tokens are spent. Surface the accounting failure instead of hiding it.
        throw new HostedProviderError("QUOTA_UNAVAILABLE", `quota store could not record ${used} tokens (${e instanceof Error ? e.name : "error"}); the run is stopped so usage is never silently unmetered`);
      }
    }
    return { output: res.response.output, estimated_tokens: used || null };
  }

  async complete(input: ProviderInput): Promise<ProviderResult> {
    await this.admitRun(input);
    return this.invoke(input, 1, null, []);
  }

  async continue(input: ContinuationInput): Promise<ProviderResult> {
    return this.invoke(input, input.turn, input.prior_output, input.tool_results);
  }
}
