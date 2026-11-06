import { describe, expect, it } from "vitest";
import { AI_FORBIDDEN_TOOLS, AI_TOOLS, AI_TOOL_ARG_SCHEMAS, AiRunBudgetSchema, AiRuntimeTraceSchema, AiToolResultEnvelopeSchema, DEFAULT_AI_RUN_BUDGET, AI_ABSTAIN_STATUS, AI_REPORT_STATUSES } from "../src/index";

/** AI-CORE-001 runtime contract (`ai-runtime-v1`): shapes the runtime and every provider adapter must respect. */
describe("ai-runtime-v1 contracts", () => {
  it("every allowlisted tool has a strict argument schema and no forbidden tool does", () => {
    for (const t of AI_TOOLS) expect(AI_TOOL_ARG_SCHEMAS[t]).toBeDefined();
    for (const t of AI_FORBIDDEN_TOOLS) expect((AI_TOOL_ARG_SCHEMAS as Record<string, unknown>)[t]).toBeUndefined();
    // tenant-shaped keys never pass, on any tool
    for (const schema of Object.values(AI_TOOL_ARG_SCHEMAS)) {
      for (const smuggled of [{ org_id: "org_x" }, { workspace_id: "ws_x" }, { household_id: "hh_x" }, { url: "https://attacker.example" }, { sql: "select 1" }]) {
        expect(schema.safeParse({ ...smuggled }).success).toBe(false);
      }
    }
    expect(AI_TOOL_ARG_SCHEMAS.read_facts.safeParse({}).success).toBe(true);
    expect(AI_TOOL_ARG_SCHEMAS.read_facts.safeParse({ ids: ["f_1"] }).success).toBe(true);
    expect(AI_TOOL_ARG_SCHEMAS.read_evidence.safeParse({}).success).toBe(false);
    expect(AI_TOOL_ARG_SCHEMAS.propose_scenario.safeParse({ kind: "NOT_A_KIND" }).success).toBe(false);
    expect(AI_TOOL_ARG_SCHEMAS.propose_scenario.safeParse({ kind: "RETIREMENT_DATE_CHANGE", parameters: { retire_age: 62 } }).success).toBe(true);
  });

  it("budgets are bounded above and below; the default fits", () => {
    expect(AiRunBudgetSchema.safeParse(DEFAULT_AI_RUN_BUDGET).success).toBe(true);
    expect(AiRunBudgetSchema.safeParse({ ...DEFAULT_AI_RUN_BUDGET, max_model_turns: 0 }).success).toBe(false);
    expect(AiRunBudgetSchema.safeParse({ ...DEFAULT_AI_RUN_BUDGET, max_model_turns: 5 }).success).toBe(false);
    expect(AiRunBudgetSchema.safeParse({ ...DEFAULT_AI_RUN_BUDGET, max_tool_calls: 51 }).success).toBe(false);
    expect(AiRunBudgetSchema.safeParse({ ...DEFAULT_AI_RUN_BUDGET, max_wall_clock_ms: 10 * 60_000 }).success).toBe(false);
    expect(AiRunBudgetSchema.safeParse({ ...DEFAULT_AI_RUN_BUDGET, extra: 1 }).success).toBe(false);
  });

  it("tool-result envelopes are always untrusted; a denial carries a reason and never a result", () => {
    const d = "a".repeat(64);
    expect(AiToolResultEnvelopeSchema.safeParse({ status: "OK", call_id: "c1", tool: "read_facts", args_digest: d, result_digest: d, untrusted: true, result: [] }).success).toBe(true);
    expect(AiToolResultEnvelopeSchema.safeParse({ status: "OK", call_id: "c1", tool: "read_facts", args_digest: d, result_digest: d, untrusted: false, result: [] }).success).toBe(false);
    expect(AiToolResultEnvelopeSchema.safeParse({ status: "OK", call_id: "c1", tool: "http_post", args_digest: d, result_digest: d, untrusted: true, result: [] }).success).toBe(false);
    expect(AiToolResultEnvelopeSchema.safeParse({ status: "DENIED", call_id: "c1", tool: "http_post", reason: "FORBIDDEN_TOOL", args_digest: d, untrusted: true }).success).toBe(true);
    expect(AiToolResultEnvelopeSchema.safeParse({ status: "DENIED", call_id: "c1", tool: "http_post", reason: "FORBIDDEN_TOOL", args_digest: d, untrusted: true, result: { leaked: true } }).success).toBe(false);
  });

  it("the trace stores digests and decisions only; abstention is the only non-draft model status and is not a report status", () => {
    const d = "b".repeat(64);
    const trace = {
      schema_version: "ai-runtime-v1",
      budget: DEFAULT_AI_RUN_BUDGET,
      provider_descriptor: { provider: "sagespan-mock", model: "deterministic-rules-2-toolloop", model_revision: null, mode: "MOCK_DETERMINISTIC", data_handling: "IN_PROCESS_NO_EGRESS", supports_tool_calls: true, supports_continuation: true, structured_output: "NATIVE_JSON", context_ceiling_tokens: null },
      transitions: ["AUTHORIZE", "RESOLVE_CONTEXT", "REQUEST_MODEL", "VALIDATE_FINAL_DRAFT", "RECORD", "RETURN"],
      turns: [{ turn: 1, state_entered: "REQUEST_MODEL", model_output_sha256: d, output_chars: 10, tool_requests: 1, tool_results: [{ call_id: "c1", tool: "get_check_runs", status: "OK", args_digest: d, result_digest: d, reason: null }], estimated_tokens: null, elapsed_ms: 1 }],
      tool_calls_requested: 1,
      tool_calls_executed: 1,
      tool_calls_denied: 0,
      reauthorizations: 2,
      stop_reason: "FINAL_DRAFT",
      elapsed_ms: 2,
    };
    expect(AiRuntimeTraceSchema.safeParse(trace).success).toBe(true);
    expect(AiRuntimeTraceSchema.safeParse({ ...trace, turns: [{ ...trace.turns[0], tool_results: [{ ...trace.turns[0]!.tool_results[0], result: [1] }] }] }).success).toBe(false);
    expect(AiRuntimeTraceSchema.safeParse({ ...trace, stop_reason: "APPROVED" }).success).toBe(false);
    expect((AI_REPORT_STATUSES as readonly string[]).includes(AI_ABSTAIN_STATUS)).toBe(false);
  });
});
