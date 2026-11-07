/**
 * AI-CORE-002a — hosted adapter suite (AI-H01 … AI-H14). Offline: the vendor is a
 * scripted fake `fetch` that returns recorded Anthropic Messages API shapes. No
 * network, no key beyond a throwaway string that must never appear in any record.
 */
import { describe, expect, it } from "vitest";
import { AI_ABSTAIN_STATUS, type AiRunRecord } from "@sagespan/contracts";
import { MemoryStore } from "@/domain/store";
import { resolveFirmContext } from "../evidence-resolver";
import { MockToolLoopProvider, resolveProvider } from "../provider";
import { AnthropicMessagesPort, EMIT_REVIEW_TOOL } from "../providers/anthropic-messages";
import { SYNTHETIC_ACK, resolveHostedConfig, type HostedConfig } from "../providers/hosted-config";
import { HostedProvider, outputJsonSchema, toolJsonSchemas } from "../providers/hosted-provider";
import { orchestrate, runFirmAnalyzePlan, runPersonalUnderstand } from "../review-orchestrator";
import { ALVAREZ, HP_CCO, addCastilloRuns, addPatelCheckRun } from "../evals/fixtures";
import { alignReports, diffReports } from "../evals/regression";

const KEY = "sk-test-DO-NOT-LEAK-7f3a9c";
const FULL_ENV = { SAGESPAN_AI_PROVIDER: "hosted", SAGESPAN_AI_HOSTED_API_KEY: KEY, SAGESPAN_AI_HOSTED_MODEL: "claude-test-model", SAGESPAN_AI_HOSTED_SYNTHETIC_ACK: SYNTHETIC_ACK, SAGESPAN_DEMO_MODE: "1" };
const CONFIG: HostedConfig = { apiKey: KEY, model: "claude-test-model", baseUrl: "https://api.anthropic.com", maxTokens: 4096, timeoutMs: 1000, runWallClockMs: 20_000, processTokenCeiling: 250_000, runsPerScopePerHour: 10, toolChoice: "forced", tokensPerScopePerHour: 200_000 };

type Body = Record<string, unknown> & { messages: Array<{ role: string; content: Array<Record<string, unknown>> }>; tools: Array<{ name: string }>; tool_choice: Record<string, unknown> };
interface Captured {
  url: string;
  headers: Record<string, string>;
  body: Body;
}

/** Scripted vendor: each call pops the next response. Captures every request. */
function fakeVendor(responses: Array<{ status?: number; json?: unknown; text?: string; headers?: Record<string, string>; hang?: boolean }>) {
  const captured: Captured[] = [];
  const fetchImpl = async (url: string, init: { headers: Record<string, string>; body: string; signal: AbortSignal }) => {
    captured.push({ url, headers: init.headers, body: JSON.parse(init.body) as Body });
    const next = responses.shift() ?? { status: 500, json: { error: { type: "script_exhausted" } } };
    if (next.hang) {
      await new Promise<void>((_, reject) => init.signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" }))));
    }
    const text = next.text ?? JSON.stringify(next.json ?? {});
    return { ok: (next.status ?? 200) < 300, status: next.status ?? 200, headers: { get: (n: string) => next.headers?.[n.toLowerCase()] ?? null }, text: async () => text };
  };
  return { captured, fetchImpl };
}

const toolUse = (id: string, name: string, input: Record<string, unknown> = {}) => ({ type: "tool_use", id, name, input });
const emit = (id: string, draft: Record<string, unknown>) => toolUse(id, EMIT_REVIEW_TOOL, draft);
const vendorRaw = (content: unknown[], extra: Record<string, unknown> = {}) => ({ id: "msg_1", model: "claude-test-model-2026-01-01", stop_reason: "tool_use", content, usage: { input_tokens: 600, output_tokens: 150 }, ...extra });
const vendorMsg = (content: unknown[], extra: Record<string, unknown> = {}) => ({ json: vendorRaw(content, extra) });

function hosted(responses: Parameters<typeof fakeVendor>[0], config: Partial<HostedConfig> = {}, now?: () => number) {
  const v = fakeVendor(responses);
  const cfg = { ...CONFIG, ...config };
  const provider = new HostedProvider(new AnthropicMessagesPort(cfg, { fetchImpl: v.fetchImpl }), cfg, { now });
  return { provider, captured: v.captured };
}

const codes = (r: AiRunRecord) => r.validation_issues.map((i) => i.code);
const noSecret = (value: unknown) => expect(JSON.stringify(value)).not.toContain(KEY);

function patelStore() {
  const store = new MemoryStore();
  let runId = "";
  store.mutate((s) => {
    runId = addPatelCheckRun(s).run.id;
  });
  return { store, runId };
}

describe("AI-CORE-002a hosted adapter", () => {
  it("AI-H01 every gate must hold; a missing gate yields the mock plus a note that names the gate and never the secret", () => {
    expect(resolveHostedConfig(FULL_ENV)).toMatchObject({ enabled: true });
    for (const [k, why] of [
      ["SAGESPAN_AI_HOSTED_API_KEY", /API_KEY is not set/],
      ["SAGESPAN_AI_HOSTED_MODEL", /MODEL is not set/],
      ["SAGESPAN_AI_HOSTED_SYNTHETIC_ACK", /SYNTHETIC_ACK/],
      ["SAGESPAN_DEMO_MODE", /DEMO_MODE is not 1 .*G3/],
    ] as const) {
      const env = { ...FULL_ENV, [k]: undefined };
      const r = resolveHostedConfig(env);
      expect(r.enabled).toBe(false);
      expect((r as { missing: string[] }).missing.join(" ")).toMatch(why);
      const resolved = resolveProvider(env);
      expect(resolved.provider).toBeInstanceOf(MockToolLoopProvider);
      expect(resolved.note).toMatch(/hosted adapter is not enabled/);
      noSecret(resolved.note);
    }
    expect(resolveHostedConfig({ ...FULL_ENV, SAGESPAN_AI_HOSTED_BASE_URL: "http://plain.example" }).enabled).toBe(false);
    const live = resolveProvider(FULL_ENV);
    expect(live.provider).toBeInstanceOf(HostedProvider);
    expect(live.provider.mode).toBe("LIVE");
    expect(live.note).toMatch(/SYNTHETIC demo data only/);
    noSecret(live.note);
  });

  it("AI-H02 the first-turn request carries strict tool schemas, forces a tool call, bounds tokens, and keeps the key in the header only", async () => {
    const { store } = patelStore();
    const ctx = resolveFirmContext(store.read(), HP_CCO, "hh_patel");
    const { provider, captured } = hosted([vendorMsg([emit("tu_e", { status: "DRAFT_FOR_HUMAN_REVIEW", findings: [], summary: "nothing to add", limitations: ["none"] })])]);
    const { record } = await orchestrate(ctx, "RETIREMENT_PLAN_REVIEW", HP_CCO.user_id, provider);
    expect(record.run_status).toBe("DRAFT_READY");
    const req = captured[0]!;
    expect(req.url).toBe("https://api.anthropic.com/v1/messages");
    expect(req.headers["x-api-key"]).toBe(KEY);
    expect(req.headers["anthropic-version"]).toBe("2023-06-01");
    noSecret(req.body);
    expect(req.body.tool_choice).toEqual({ type: "any" });
    expect(req.body.tools.map((t) => t.name).sort()).toEqual([EMIT_REVIEW_TOOL, "get_check_runs", "propose_scenario", "read_evidence", "read_facts", "read_personal_baseline"].sort());
    for (const t of toolJsonSchemas()) expect(t.args_json_schema).toMatchObject({ type: "object", additionalProperties: false });
    expect(outputJsonSchema()).toMatchObject({ type: "object" });
    expect(JSON.stringify(outputJsonSchema())).toMatch(/DRAFT_FOR_HUMAN_REVIEW/);
    expect(JSON.stringify(outputJsonSchema())).not.toMatch(/"APPROVED"|"VERIFIED"|"PASS"/);
    expect(req.body.max_tokens as number).toBeLessThanOrEqual(4096);
    expect(String(req.body.system)).toMatch(/Rules you must follow/);
    expect(String(req.body.system)).toMatch(/exactly one of the provided tools/);
    expect((req.body.metadata as { user_id: string }).user_id).toMatch(/^sgs_/);
  });

  it("AI-H03 two live turns through the runtime: a vendor tool_use becomes an authorised read, its result goes back as tool_result data, and the final emit_review is validated", async () => {
    const { store, runId } = patelStore();
    const { provider, captured } = hosted([
      vendorMsg([{ type: "text", text: "Let me look at the checks." }, toolUse("toolu_01", "get_check_runs")]),
      vendorMsg([emit("toolu_02", { status: "DRAFT_FOR_HUMAN_REVIEW", summary: "One discrepancy.", findings: [{ finding_id: "f_live_1", category: "CHECK_DISCREPANCY", severity: "HIGH", title: "Engine and plan disagree", explanation: "The engine reproduced 25098.04 from the frozen inputs.", fact_refs: [], document_refs: [], check_run_refs: [runId], cited_amounts: [{ amount: "25098.04", currency: "USD", check_run_ref: runId, field: "discrepancy.computed_amount" }], evidence_status: "UNVERIFIED", suggested_next_action: "Record a disposition." }], limitations: ["Draft only."] })], { stop_reason: "end_turn" }),
    ]);
    const r = await runFirmAnalyzePlan(store, HP_CCO, "hh_patel", provider);
    expect(r.run_status).toBe("DRAFT_READY");
    expect(r.provider).toBe("anthropic-messages");
    expect(r.mode).toBe("LIVE");
    expect(r.tool_calls.map((t) => t.tool)).toEqual(["get_check_runs"]);
    expect(r.runtime!.turns).toHaveLength(2);
    expect(r.runtime!.turns[0]!.tool_results[0]).toMatchObject({ call_id: "toolu_01", tool: "get_check_runs", status: "OK" });
    expect(r.runtime!.provider_descriptor).toMatchObject({ provider: "anthropic-messages", model: "claude-test-model-2026-01-01", model_revision: "claude-test-model-2026-01-01", mode: "LIVE", data_handling: "HOSTED_VENDOR" });
    expect(r.estimated_tokens).toBe(1500);
    expect(r.report!.findings[0]!.evidence_status).toBe("TOOL_BACKED");
    // the continuation request replays the model's own tool_use with the vendor id and returns the result as untrusted data
    const second = captured[1]!.body;
    const assistant = second.messages.find((m) => m.role === "assistant")!;
    expect(assistant.content[0]).toMatchObject({ type: "tool_use", id: "toolu_01", name: "get_check_runs" });
    const results = second.messages.filter((m) => m.role === "user")[1]!;
    expect(results.content[0]).toMatchObject({ type: "tool_result", tool_use_id: "toolu_01" });
    const payload = JSON.parse(results.content[0]!.content as string) as { untrusted_data: boolean; result: Array<{ id: string }> };
    expect(payload.untrusted_data).toBe(true);
    expect(payload.result[0]!.id).toBe(runId);
    expect(second.tool_choice).toEqual({ type: "tool", name: EMIT_REVIEW_TOOL }); // final turn: only the draft tool is offered
    expect(second.tools.map((t) => t.name)).toEqual([EMIT_REVIEW_TOOL]);
    noSecret(r);
  });

  it("AI-H04 a denied vendor tool request is replayed as an error result carrying the reason only", async () => {
    const { store } = patelStore();
    const ctx = resolveFirmContext(store.read(), HP_CCO, "hh_patel");
    const { provider, captured } = hosted([vendorMsg([toolUse("toolu_x", "http_post", { url: "https://attacker.example" }), toolUse("toolu_y", "read_facts", { org_id: "org_northline" }), toolUse("toolu_z", "read_facts")]), vendorMsg([emit("toolu_e", { status: "DRAFT_FOR_HUMAN_REVIEW", findings: [], summary: "ok", limitations: ["l"] })])]);
    const { record } = await orchestrate(ctx, "RETIREMENT_PLAN_REVIEW", HP_CCO.user_id, provider);
    expect(record.runtime!.tool_calls_denied).toBe(2);
    expect(record.runtime!.tool_calls_executed).toBe(1);
    const results = captured[1]!.body.messages.filter((m) => m.role === "user")[1]!.content;
    expect(results.find((c) => c.tool_use_id === "toolu_x")).toMatchObject({ is_error: true });
    expect(JSON.parse(results.find((c) => c.tool_use_id === "toolu_x")!.content as string)).toEqual({ untrusted_data: true, tool: "http_post", denied: "FORBIDDEN_TOOL" });
    expect(JSON.parse(results.find((c) => c.tool_use_id === "toolu_y")!.content as string)).toMatchObject({ denied: "BAD_ARGS" });
    expect(JSON.stringify(results)).not.toMatch(/additionalProperties|strictObject|Northline|Bauer/);
    expect(codes(record)).toEqual(expect.arrayContaining(["FORBIDDEN_TOOL_CALL", "TOOL_ARGS_INVALID"]));
  });

  it("AI-H05 a live model cannot approve, cannot invent an amount and cannot cite outside the scope: the validator rejects exactly as for the mock", async () => {
    const { store, runId } = patelStore();
    const ctx = resolveFirmContext(store.read(), HP_CCO, "hh_patel");
    const approving = hosted([vendorMsg([emit("e", { status: "APPROVED", findings: [], summary: "approved", limitations: ["x"] })])]);
    let r = await orchestrate(ctx, "RETIREMENT_PLAN_REVIEW", HP_CCO.user_id, approving.provider);
    expect(r.record.run_status).toBe("REJECTED");
    expect(codes(r.record)).toContain("FORBIDDEN_STATUS");
    const inventing = hosted([vendorMsg([emit("e", { status: "DRAFT_FOR_HUMAN_REVIEW", summary: "s", limitations: ["x"], findings: [{ finding_id: "f1", category: "CHECK_DISCREPANCY", severity: "HIGH", title: "RMD", explanation: "The RMD is $31,000.00.", fact_refs: [], document_refs: [], check_run_refs: [runId], cited_amounts: [], evidence_status: "UNVERIFIED", suggested_next_action: null }, { finding_id: "f2", category: "MISSING_EVIDENCE", severity: "LOW", title: "Foreign", explanation: "See the Bauer statement.", fact_refs: ["f_bauer_bal"], document_refs: [], check_run_refs: [], cited_amounts: [], evidence_status: "UNVERIFIED", suggested_next_action: null }] })])]);
    r = await orchestrate(ctx, "RETIREMENT_PLAN_REVIEW", HP_CCO.user_id, inventing.provider);
    expect(codes(r.record)).toEqual(expect.arrayContaining(["AMOUNT_WITHOUT_TOOL_BACKING", "UNRESOLVED_FACT_REF"]));
    expect(r.record.accepted_finding_count).toBe(0);
  });

  it("AI-H06 vendor failures are typed and honest: rate limit, outage, refusal, free text, non-JSON, timeout → ERROR/REJECTED, never a silent mock", async () => {
    const { store } = patelStore();
    const ctx = resolveFirmContext(store.read(), HP_CCO, "hh_patel");
    const cases: Array<[Parameters<typeof fakeVendor>[0][number], RegExp, AiRunRecord["run_status"]]> = [
      [{ status: 429, json: { error: { type: "rate_limit_error" } }, headers: { "retry-after": "7" } }, /RATE_LIMITED.*7000 ms/, "ERROR"],
      [{ status: 503, json: { error: { type: "overloaded_error", message: "secret-ish body text" } } }, /UNAVAILABLE.*HTTP 503.*overloaded_error/, "ERROR"],
      [{ status: 401, json: { error: { type: "authentication_error" } } }, /credentials rejected/, "ERROR"],
      [vendorMsg([{ type: "text", text: "I refuse." }], { stop_reason: "refusal" }), /REFUSED/, "ERROR"],
      [vendorMsg([{ type: "text", text: "Here is my review in prose..." }], { stop_reason: "end_turn" }), /MALFORMED_OUTPUT.*no tool call/, "ERROR"],
      [{ text: "<html>gateway</html>", status: 200 }, /MALFORMED_OUTPUT.*not JSON/, "ERROR"],
      [{ hang: true }, /TIMEOUT/, "ERROR"],
    ];
    for (const [resp, detail, status] of cases) {
      const { provider } = hosted([resp]);
      const { record } = await orchestrate(ctx, "RETIREMENT_PLAN_REVIEW", HP_CCO.user_id, provider);
      expect(record.run_status).toBe(status);
      expect(record.provider).toBe("anthropic-messages"); // what ran is what is recorded; no fallback
      expect(record.validation_issues.map((i) => i.detail).join(" ")).toMatch(detail);
      expect(record.validation_issues.map((i) => i.detail).join(" ")).not.toMatch(/secret-ish/);
      noSecret(record);
    }
  });

  it("AI-H07 the process token ceiling fails closed: the next run is an ERROR from the hosted provider, not a quiet switch to the mock", async () => {
    const { store } = patelStore();
    const draft = () => vendorMsg([emit("e", { status: "DRAFT_FOR_HUMAN_REVIEW", findings: [], summary: "s", limitations: ["l"] })]);
    const { provider } = hosted([draft(), draft()], { processTokenCeiling: 1000 });
    const first = await runFirmAnalyzePlan(store, HP_CCO, "hh_patel", provider);
    expect(first.run_status).toBe("DRAFT_READY");
    expect(provider.tokensSpentThisProcess).toBe(750);
    const second = await runFirmAnalyzePlan(store, HP_CCO, "hh_patel", provider);
    expect(second.run_status).toBe("DRAFT_READY"); // 750 < 1000 before the call; the call pushes it to 1500
    const third = await runFirmAnalyzePlan(store, HP_CCO, "hh_patel", provider);
    expect(third.run_status).toBe("ERROR");
    expect(third.provider).toBe("anthropic-messages");
    expect(third.validation_issues[0]!.detail).toMatch(/TOKEN_CEILING/);
  });

  it("AI-H08 runs are rate-limited per workspace/household scope", async () => {
    const { store } = patelStore();
    store.mutate((s) => {
      addCastilloRuns(s);
    });
    let t = 0;
    const draft = () => vendorMsg([emit("e", { status: "DRAFT_FOR_HUMAN_REVIEW", findings: [], summary: "s", limitations: ["l"] })]);
    const { provider } = hosted([draft(), draft(), draft(), draft()], { runsPerScopePerHour: 1 }, () => t);
    expect((await runFirmAnalyzePlan(store, HP_CCO, "hh_patel", provider)).run_status).toBe("DRAFT_READY");
    const limited = await runFirmAnalyzePlan(store, HP_CCO, "hh_patel", provider);
    expect(limited.run_status).toBe("ERROR");
    expect(limited.validation_issues[0]!.detail).toMatch(/RATE_LIMIT_SCOPE/);
    expect((await runPersonalUnderstand(store, ALVAREZ, provider)).run_status).toBe("DRAFT_READY"); // another scope is unaffected
    t = 3_600_001;
    expect((await runFirmAnalyzePlan(store, HP_CCO, "hh_patel", provider)).run_status).toBe("DRAFT_READY");
  });

  it("AI-H09 a live abstention is recorded as ABSTAINED with no report", async () => {
    const { store } = patelStore();
    const { provider } = hosted([vendorMsg([emit("e", { status: AI_ABSTAIN_STATUS, findings: [], summary: "", limitations: ["No year-end statement is available."] })])]);
    const r = await runFirmAnalyzePlan(store, HP_CCO, "hh_patel", provider);
    expect(r.run_status).toBe("ABSTAINED");
    expect(r.report).toBeNull();
    expect(r.runtime!.stop_reason).toBe("MODEL_ABSTAINED");
  });

  it("AI-H10 nothing persisted or thrown ever contains the vendor key", async () => {
    const { store } = patelStore();
    const { provider } = hosted([{ status: 500, json: { error: { type: "api_error", message: KEY } } }]);
    const r = await runFirmAnalyzePlan(store, HP_CCO, "hh_patel", provider);
    noSecret(r);
    noSecret(store.read().ai_runs);
    noSecret(provider.describe());
  });

  it("AI-H11 tool_choice defaults to auto (some current models reject a forced choice); the final turn still offers only emit_review, and free text still fails closed", async () => {
    expect(resolveHostedConfig(FULL_ENV)).toMatchObject({ enabled: true, config: { toolChoice: "auto" } });
    expect(resolveHostedConfig({ ...FULL_ENV, SAGESPAN_AI_HOSTED_TOOL_CHOICE: "forced" })).toMatchObject({ enabled: true, config: { toolChoice: "forced" } });
    const bad = resolveHostedConfig({ ...FULL_ENV, SAGESPAN_AI_HOSTED_TOOL_CHOICE: "required" });
    expect(bad.enabled).toBe(false);
    expect((bad as { missing: string[] }).missing.join(" ")).toMatch(/TOOL_CHOICE must be auto or forced/);

    const { store, runId } = patelStore();
    const { provider, captured } = hosted(
      [
        vendorMsg([toolUse("toolu_01", "get_check_runs")]),
        vendorMsg([emit("toolu_02", { status: "DRAFT_FOR_HUMAN_REVIEW", summary: "Reviewed.", findings: [], limitations: ["Draft only."] })], { stop_reason: "end_turn" }),
      ],
      { toolChoice: "auto" },
    );
    const r = await runFirmAnalyzePlan(store, HP_CCO, "hh_patel", provider);
    expect(r.run_status).toBe("DRAFT_READY");
    expect(runId).not.toBe("");
    expect(captured[0]!.body.tool_choice).toEqual({ type: "auto" });
    expect(captured[0]!.body.tools.length).toBe(6);
    expect(captured[1]!.body.tool_choice).toEqual({ type: "auto" });
    expect(captured[1]!.body.tools.map((t) => t.name)).toEqual([EMIT_REVIEW_TOOL]);
    for (const c of captured) expect(JSON.stringify(c.body.tool_choice)).not.toMatch(/"any"|"tool"/);

    const prose = hosted([vendorMsg([{ type: "text", text: "Here is my review in prose..." }], { stop_reason: "end_turn" })], { toolChoice: "auto" });
    const ctx = resolveFirmContext(store.read(), HP_CCO, "hh_patel");
    const { record } = await orchestrate(ctx, "RETIREMENT_PLAN_REVIEW", HP_CCO.user_id, prose.provider);
    expect(record.run_status).toBe("ERROR");
    expect(record.report).toBeNull();
    expect(record.validation_issues.map((i) => i.detail).join(" ")).toMatch(/MALFORMED_OUTPUT.*no tool call/);
  });

  it("AI-H12 a vendor request error carries the vendor's reason (bounded, key-shaped text redacted) so an operator can see why it was refused", async () => {
    const { store } = patelStore();
    const message = `tool_choice: type "tool" and "any" are not supported for this model. key ${KEY} sk-ant-api03-abcdefghijk ${"x".repeat(600)}`;
    const { provider } = hosted([{ status: 400, json: { type: "error", error: { type: "invalid_request_error", message } } }]);
    const r = await runFirmAnalyzePlan(store, HP_CCO, "hh_patel", provider);
    expect(r.run_status).toBe("ERROR");
    const detail = r.validation_issues.map((i) => i.detail).join(" ");
    expect(detail).toMatch(/HTTP 400 \(invalid_request_error\): tool_choice: type "tool" and "any" are not supported for this model/);
    expect(detail).not.toMatch(/sk-ant-api03-abcdefghijk/);
    expect(detail).toMatch(/\[redacted\]/);
    expect(detail).not.toContain("x".repeat(400));
    noSecret(r);
    noSecret(store.read().ai_runs);
  });

  it("AI-H13 a hosted run gets a hosted-sized wall clock: per-completion timeout and run budget default to 50 s / 110 s, are clamped, and reach the runtime; a caller override still wins", async () => {
    const cfg = resolveHostedConfig(FULL_ENV);
    expect(cfg).toMatchObject({ enabled: true, config: { timeoutMs: 50_000, runWallClockMs: 110_000 } });
    expect(resolveHostedConfig({ ...FULL_ENV, SAGESPAN_AI_HOSTED_RUN_WALL_CLOCK_MS: "999999", SAGESPAN_AI_HOSTED_TIMEOUT_MS: "999999" })).toMatchObject({ config: { timeoutMs: 110_000, runWallClockMs: 120_000 } });
    const { store } = patelStore();
    const ctx = resolveFirmContext(store.read(), HP_CCO, "hh_patel");
    const draft = () => vendorMsg([emit("e", { status: "DRAFT_FOR_HUMAN_REVIEW", findings: [], summary: "s", limitations: ["l"] })]);
    const { provider } = hosted([draft(), draft()], { runWallClockMs: 110_000 });
    expect(provider.budgetHint).toEqual({ max_wall_clock_ms: 110_000 });
    const a = await orchestrate(ctx, "RETIREMENT_PLAN_REVIEW", HP_CCO.user_id, provider);
    expect(a.record.runtime!.budget.max_wall_clock_ms).toBe(110_000);
    const b = await orchestrate(ctx, "RETIREMENT_PLAN_REVIEW", HP_CCO.user_id, provider, null, { budget: { max_wall_clock_ms: 30_000 } });
    expect(b.record.runtime!.budget.max_wall_clock_ms).toBe(30_000);
    const mock = await orchestrate(ctx, "RETIREMENT_PLAN_REVIEW", HP_CCO.user_id, new MockToolLoopProvider());
    expect(mock.record.runtime!.budget.max_wall_clock_ms).toBe(20_000);
  });

  it("AI-H14 the live-benchmark review aid pairs findings by the evidence they cite, not by the model's own ids, and lists coverage gaps and new findings", async () => {
    const { store } = patelStore();
    const reference = (await runFirmAnalyzePlan(store, HP_CCO, "hh_patel", new MockToolLoopProvider())).report!;
    expect(reference.findings.length).toBeGreaterThanOrEqual(2);
    // a "live" report: same evidence, renamed ids (as a hosted model does), first finding dropped, one extra finding
    const [dropped, ...kept] = reference.findings;
    const candidate = {
      ...reference,
      findings: [
        ...kept.map((f, i) => ({ ...f, finding_id: `F${i + 1}` })),
        { ...kept[0]!, finding_id: "F_extra", fact_refs: [], document_refs: [], check_run_refs: [], cited_amounts: [], category: "FOLLOWUP_QUESTION" as const },
      ],
    };
    expect(diffReports(reference, candidate).changed).toEqual([]); // id-keyed diff sees only add/remove
    expect(diffReports(reference, candidate).added).toHaveLength(candidate.findings.length);
    const a = alignReports(reference, candidate);
    expect(a.pairs.map((p) => p.candidate).sort()).toEqual(kept.map((_, i) => `F${i + 1}`).sort());
    expect(a.pairs.every((p) => p.same_category && p.shared_refs.length > 0)).toBe(true);
    expect(a.candidate_only).toEqual(["F_extra"]);
    // every kept finding keeps its exact counterpart (best-first matching), so the dropped one is the coverage gap
    expect(a.reference_only).toEqual([dropped!.finding_id]);
    // identical reports align one-to-one
    const self = alignReports(reference, reference);
    expect(self.pairs).toHaveLength(reference.findings.length);
    expect(self.reference_only).toEqual([]);
    expect(self.candidate_only).toEqual([]);
  });
});
