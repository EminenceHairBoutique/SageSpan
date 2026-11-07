import { z } from "zod";
import { AI_TOOLS, type AiToolName } from "./review";
import { SCENARIO_KINDS } from "./scenario";

/**
 * AI-CORE-001 runtime contract (`ai-runtime-v1`).
 *
 * The runtime is a bounded, server-owned state machine around a provider:
 *
 *   AUTHORIZE → RESOLVE_CONTEXT → REQUEST_MODEL → VALIDATE_TOOL_REQUESTS →
 *   AUTHORIZE_EACH_TOOL → EXECUTE_ALLOWED_READ → ADD_TOOL_RESULTS →
 *   CONTINUE_MODEL (bounded) → VALIDATE_FINAL_DRAFT → RECORD → RETURN
 *
 * Everything in this file is DATA about a run: budgets the server enforces
 * before dispatch, the per-call envelopes a model receives (always marked
 * untrusted), and the immutable trace stored beside the validated report.
 * Nothing here grants authority. Tool argument schemas are strict so that a
 * model cannot smuggle a tenant, workspace or org identifier through `args`.
 */
export const AI_RUNTIME_SCHEMA_VERSION = "ai-runtime-v1" as const;

export const AI_RUNTIME_STATES = [
  "AUTHORIZE",
  "RESOLVE_CONTEXT",
  "REQUEST_MODEL",
  "VALIDATE_TOOL_REQUESTS",
  "AUTHORIZE_EACH_TOOL",
  "EXECUTE_ALLOWED_READ",
  "ADD_TOOL_RESULTS",
  "CONTINUE_MODEL",
  "VALIDATE_FINAL_DRAFT",
  "RECORD",
  "RETURN",
] as const;
export type AiRuntimeState = (typeof AI_RUNTIME_STATES)[number];

/** Why the loop stopped. FINAL_DRAFT is the only "normal" stop; every other value is recorded verbatim in the run. */
export const AI_RUNTIME_STOP_REASONS = [
  "FINAL_DRAFT",
  "MODEL_ABSTAINED",
  "TOOL_BUDGET_EXCEEDED",
  "TURN_BUDGET_EXHAUSTED",
  "WALL_CLOCK_EXCEEDED",
  "OUTPUT_BUDGET_EXCEEDED",
  "AUTHORIZATION_LOST",
  "CONTEXT_CHANGED",
  "PROVIDER_ERROR",
  "PROVIDER_OUTPUT_INVALID",
  "CANCELLED",
] as const;
export type AiRuntimeStopReason = (typeof AI_RUNTIME_STOP_REASONS)[number];

/** Server-set budgets, checked BEFORE any dispatch or continuation. */
export const AiRunBudgetSchema = z.strictObject({
  /** Total tool calls the model may request across the whole run (requests beyond this are denied, none dispatched). */
  max_tool_calls: z.number().int().min(0).max(50),
  /** Model completions including the first. 1 = legacy one-pass; 2 = one bounded continuation. */
  max_model_turns: z.number().int().min(1).max(4),
  max_wall_clock_ms: z.number().int().min(1).max(120_000),
  /** Serialized model output per turn. */
  max_output_chars: z.number().int().min(1_000).max(200_000),
  /** Serialized tool result returned to the model per call; larger results are withheld (never truncated silently). */
  max_tool_result_chars: z.number().int().min(100).max(200_000),
});
export type AiRunBudget = z.infer<typeof AiRunBudgetSchema>;

export const DEFAULT_AI_RUN_BUDGET: AiRunBudget = {
  max_tool_calls: 10,
  max_model_turns: 2,
  max_wall_clock_ms: 20_000,
  max_output_chars: 60_000,
  max_tool_result_chars: 40_000,
};

/**
 * Exact argument schemas per allowlisted tool. `strictObject` rejects any
 * extra key, so `org_id`, `workspace_id`, `household_id`, URLs or SQL in
 * `args` fail validation before the dispatcher is reached.
 */
export const AI_TOOL_ARG_SCHEMAS = {
  read_facts: z.strictObject({ ids: z.array(z.string().min(1).max(120)).max(100).optional() }),
  read_evidence: z.strictObject({ document_id: z.string().min(1).max(120) }),
  get_check_runs: z.strictObject({}),
  read_personal_baseline: z.strictObject({}),
  propose_scenario: z.strictObject({
    kind: z.enum(SCENARIO_KINDS),
    title: z.string().min(1).max(160).optional(),
    rationale: z.string().min(1).max(1000).optional(),
    parameters: z.record(z.string().max(80), z.union([z.string().max(200), z.number(), z.boolean()])).optional(),
  }),
} as const satisfies Record<AiToolName, z.ZodTypeAny>;

/** Tool request as a model emits it. `call_id` is optional; the runtime assigns one when absent. */
export const AiToolRequestSchema = z.object({
  call_id: z.string().min(1).max(80).optional(),
  tool: z.string().min(1).max(80),
  args: z.record(z.string(), z.unknown()).optional(),
});
export type AiToolRequest = z.infer<typeof AiToolRequestSchema>;

export const AI_TOOL_DENIAL_REASONS = ["FORBIDDEN_TOOL", "UNKNOWN_TOOL", "BAD_ARGS", "BUDGET_EXCEEDED", "DUPLICATE_REQUEST", "RESULT_TOO_LARGE", "TURN_BUDGET_EXHAUSTED", "AUTHORIZATION_LOST"] as const;
export type AiToolDenialReason = (typeof AI_TOOL_DENIAL_REASONS)[number];

/**
 * What the model receives for each tool request on the next turn. A denied
 * call carries the reason only — never the tool specification, the argument
 * schema or anything about data outside the authorised scope. An executed
 * call carries the result as UNTRUSTED data.
 */
export const AiToolResultEnvelopeSchema = z.discriminatedUnion("status", [
  z.strictObject({
    status: z.literal("OK"),
    call_id: z.string().min(1),
    tool: z.enum(AI_TOOLS),
    args_digest: z.string().length(64),
    result_digest: z.string().length(64),
    /** Always true: a tool result is data the model may read, never an instruction. */
    untrusted: z.literal(true),
    result: z.unknown(),
  }),
  z.strictObject({
    status: z.literal("DENIED"),
    call_id: z.string().min(1),
    tool: z.string().min(1).max(80),
    reason: z.enum(AI_TOOL_DENIAL_REASONS),
    args_digest: z.string().length(64),
    untrusted: z.literal(true),
  }),
]);
export type AiToolResultEnvelope = z.infer<typeof AiToolResultEnvelopeSchema>;

/** Capability/identity descriptor of the provider that actually ran (never the one that was merely configured). */
export const AI_PROVIDER_DATA_HANDLING = ["IN_PROCESS_NO_EGRESS", "HOSTED_VENDOR", "SELF_HOSTED_PRIVATE"] as const;
export const AiProviderDescriptorSchema = z.strictObject({
  provider: z.string().min(1),
  model: z.string().min(1),
  /** Exact revision/weights digest when known; null for the deterministic mocks. */
  model_revision: z.string().nullable(),
  mode: z.enum(["MOCK_DETERMINISTIC", "SCRIPTED_TEST", "LIVE"]),
  data_handling: z.enum(AI_PROVIDER_DATA_HANDLING),
  supports_tool_calls: z.boolean(),
  supports_continuation: z.boolean(),
  structured_output: z.enum(["NATIVE_JSON", "TEXT_JSON", "NONE"]),
  context_ceiling_tokens: z.number().int().positive().nullable(),
});
export type AiProviderDescriptor = z.infer<typeof AiProviderDescriptorSchema>;

/** Trace entry for one tool request: digests and the decision only (no result payload, no args). */
export const AiToolTraceEntrySchema = z.strictObject({
  call_id: z.string().min(1),
  tool: z.string().min(1).max(80),
  status: z.enum(["OK", "DENIED"]),
  args_digest: z.string().length(64),
  result_digest: z.string().length(64).nullable(),
  reason: z.enum(AI_TOOL_DENIAL_REASONS).nullable(),
});
export type AiToolTraceEntry = z.infer<typeof AiToolTraceEntrySchema>;

/** One model turn in the trace: digests only, never prompt text or raw PII. */
export const AiRuntimeTurnSchema = z.strictObject({
  turn: z.number().int().min(1),
  state_entered: z.enum(AI_RUNTIME_STATES),
  model_output_sha256: z.string().length(64).nullable(),
  output_chars: z.number().int().nonnegative(),
  tool_requests: z.number().int().nonnegative(),
  tool_results: z.array(AiToolTraceEntrySchema),
  estimated_tokens: z.number().int().nonnegative().nullable(),
  elapsed_ms: z.number().int().nonnegative(),
});

/** Immutable runtime trace stored on the run record. */
export const AiRuntimeTraceSchema = z.strictObject({
  schema_version: z.literal(AI_RUNTIME_SCHEMA_VERSION),
  budget: AiRunBudgetSchema,
  provider_descriptor: AiProviderDescriptorSchema,
  transitions: z.array(z.enum(AI_RUNTIME_STATES)),
  turns: z.array(AiRuntimeTurnSchema),
  tool_calls_requested: z.number().int().nonnegative(),
  tool_calls_executed: z.number().int().nonnegative(),
  tool_calls_denied: z.number().int().nonnegative(),
  reauthorizations: z.number().int().nonnegative(),
  stop_reason: z.enum(AI_RUNTIME_STOP_REASONS),
  elapsed_ms: z.number().int().nonnegative(),
});
export type AiRuntimeTrace = z.infer<typeof AiRuntimeTraceSchema>;

/** Model-facing abstention: the ONLY non-draft status the runtime recognises, and it produces no report. */
export const AI_ABSTAIN_STATUS = "ABSTAINED_INSUFFICIENT_EVIDENCE" as const;
