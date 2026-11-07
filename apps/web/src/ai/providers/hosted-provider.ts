import { randomUUID } from "node:crypto";
import { z } from "zod";
import { AI_ABSTAIN_STATUS, AI_REVIEW_SCHEMA_VERSION, AI_TOOLS, AI_TOOL_ARG_SCHEMAS, AiFindingSchema, type AiProviderDescriptor } from "@sagespan/contracts";
import type { AiProvider, ContinuationInput, ProviderInput, ProviderResult } from "../provider";
import type { HostedConfig } from "./hosted-config";
import type { LiveProviderFailure, LiveProviderPort, LiveProviderRequest } from "./port";

/**
 * AI-CORE-002a — `AiProvider` over a `LiveProviderPort` (hosted vendor).
 *
 * The runtime does not change for a live vendor: this class turns the runtime's
 * `complete()` / `continue()` into port requests and port responses back into
 * untrusted `AiModelOutput`. What it adds on top of the port:
 *  - a per-process token meter with a hard ceiling (fail CLOSED with a typed
 *    error → the run records ERROR; there is no silent fallback to the mock or to
 *    a cheaper model);
 *  - a per-scope sliding-window run limit (workspace / household key);
 *  - server-generated request ids; the vendor's served model recorded on the run.
 * Secrets: the key lives in `HostedConfig` and is read by the port only.
 */
export class HostedProviderError extends Error {
  constructor(
    readonly kind: LiveProviderFailure["kind"] | "TOKEN_CEILING" | "RATE_LIMIT_SCOPE",
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

export interface HostedProviderOptions {
  now?: () => number;
}

export class HostedProvider implements AiProvider {
  readonly name: string;
  readonly model: string;
  readonly mode = "LIVE" as const;
  /** A hosted model needs a longer run wall clock than the in-process mock's 20 s default. */
  readonly budgetHint: { max_wall_clock_ms: number };
  private tokensSpent = 0;
  private readonly runsByScope = new Map<string, number[]>();
  private readonly now: () => number;

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
  }

  describe(): AiProviderDescriptor {
    return this.port.describe();
  }

  get tokensSpentThisProcess(): number {
    return this.tokensSpent;
  }

  private scopeKey(input: ProviderInput): string {
    const s = input.context.scope;
    return s.kind === "FIRM_HOUSEHOLD" ? `firm:${s.org_id}:${s.household_id}` : `personal:${s.workspace_id}`;
  }

  private admitRun(input: ProviderInput): void {
    const key = this.scopeKey(input);
    const t = this.now();
    const window = (this.runsByScope.get(key) ?? []).filter((x) => t - x < 3_600_000);
    if (window.length >= this.config.runsPerScopePerHour) throw new HostedProviderError("RATE_LIMIT_SCOPE", `${this.config.runsPerScopePerHour} hosted runs per hour reached for this workspace; try later`);
    window.push(t);
    this.runsByScope.set(key, window);
  }

  private async invoke(input: ProviderInput, turn: number, prior: ContinuationInput["prior_output"] | null, toolResults: ContinuationInput["tool_results"]): Promise<ProviderResult> {
    if (this.tokensSpent >= this.config.processTokenCeiling) throw new HostedProviderError("TOKEN_CEILING", `process token ceiling ${this.config.processTokenCeiling} reached; hosted runs are disabled until restart`);
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
    return { output: res.response.output, estimated_tokens: used || null };
  }

  async complete(input: ProviderInput): Promise<ProviderResult> {
    this.admitRun(input);
    return this.invoke(input, 1, null, []);
  }

  async continue(input: ContinuationInput): Promise<ProviderResult> {
    return this.invoke(input, input.turn, input.prior_output, input.tool_results);
  }
}
