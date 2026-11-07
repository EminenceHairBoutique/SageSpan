import {
  AI_ABSTAIN_STATUS,
  AI_RUNTIME_SCHEMA_VERSION,
  AiModelOutputSchema,
  AiRunBudgetSchema,
  canonicalJson,
  DEFAULT_AI_RUN_BUDGET,
  type AiAnalysisKind,
  type AiModelMetadata,
  type AiModelOutput,
  type AiRunBudget,
  type AiRunRecord,
  type AiRuntimeState,
  type AiRuntimeStopReason,
  type AiRuntimeTrace,
  type AiToolResultEnvelope,
  type AiToolTraceEntry,
  type AiValidationIssue,
} from "@sagespan/contracts";
import { sha256 } from "@/domain/audit";
import { newId, nowIso } from "@/domain/ids";
import { looksLikeInjection, type GroundingContext } from "../evidence-resolver";
import { buildContinuationInput, buildProviderInput, describeProvider, type AiProvider, type ProviderInput, type ProviderResult } from "../provider";
import { validateModelOutput } from "../result-validator";
import { dispatchTool, type ToolDispatch } from "../tools";

/**
 * AI-CORE-001 — bounded tool-loop runtime (`ai-runtime-v1`).
 *
 *   AUTHORIZE → RESOLVE_CONTEXT → REQUEST_MODEL → VALIDATE_TOOL_REQUESTS →
 *   AUTHORIZE_EACH_TOOL → EXECUTE_ALLOWED_READ → ADD_TOOL_RESULTS →
 *   CONTINUE_MODEL (bounded) → VALIDATE_FINAL_DRAFT → RECORD → RETURN
 *
 * What the runtime owns, and the model never does:
 *  - budgets (tool calls, turns, wall clock, output and tool-result size),
 *    checked BEFORE any dispatch or continuation;
 *  - per-call authorisation: strict argument schemas, allow/deny lists,
 *    de-duplication, and a fresh re-authorisation of the actor's scope before
 *    every execution and again before RECORD (a revoked membership ends the run
 *    with the same non-disclosing NotFound the resolver throws);
 *  - the envelopes a model receives: denied calls carry a reason only; executed
 *    calls carry the result marked untrusted;
 *  - the outcome vocabulary: DRAFT_READY, REJECTED, ERROR, ABSTAINED. There is
 *    no path to APPROVED/VERIFIED — the validator rejects them (AI-E16).
 *
 * The runtime never touches a store: callers pass an authorised context and an
 * optional `reauthorize()` that re-resolves it from current state. Persistence
 * is the orchestrator's job and stays append-only.
 */
export interface ToolLoopOptions {
  budget?: Partial<AiRunBudget>;
  /** Re-resolve the authorised context from CURRENT state. Must throw (NotFoundError) when access no longer exists. */
  reauthorize?: () => GroundingContext;
  /** Clock injection for tests. */
  now?: () => number;
  /** Cooperative cancellation: checked before each model call and each tool execution. */
  signal?: AbortSignal;
  providerNote?: string | null;
  serverLimitations?: string[];
}

export interface ToolLoopResult {
  record: AiRunRecord;
  toolDispatches: ToolDispatch[];
}

/** Stop reasons that mean "the provider misbehaved or the clock ran out": recorded as ERROR. */
const ERROR_STOPS: ReadonlySet<AiRuntimeStopReason> = new Set(["PROVIDER_ERROR", "WALL_CLOCK_EXCEEDED", "CANCELLED"]);

function sameScope(a: GroundingContext, b: GroundingContext): boolean {
  return canonicalJson(a.scope) === canonicalJson(b.scope) && a.snapshot_id === b.snapshot_id && a.snapshot_sha256 === b.snapshot_sha256;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  if (ms <= 0) return Promise.reject(new TimeoutError());
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new TimeoutError()), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

class TimeoutError extends Error {
  constructor() {
    super("provider wall-clock budget exceeded");
    this.name = "TimeoutError";
  }
}

export async function runToolLoop(initialCtx: GroundingContext, analysisKind: AiAnalysisKind, requestedBy: string, provider: AiProvider, options: ToolLoopOptions = {}): Promise<ToolLoopResult> {
  const now = options.now ?? Date.now;
  const t0 = now();
  const budget = AiRunBudgetSchema.parse({ ...DEFAULT_AI_RUN_BUDGET, ...(options.budget ?? {}) });
  const transitions: AiRuntimeState[] = ["AUTHORIZE", "RESOLVE_CONTEXT"];
  const enter = (s: AiRuntimeState) => transitions.push(s);
  const issues: AiValidationIssue[] = [];
  const dispatches: ToolDispatch[] = [];
  const turns: AiRuntimeTrace["turns"] = [];
  const seenRequests = new Set<string>();
  let ctx = initialCtx;
  let executed = 0;
  let requested = 0;
  let denied = 0;
  let reauthorizations = 0;
  let stop: AiRuntimeStopReason | null = null;
  let finalOutput: unknown = null;
  let estimatedTokens: number | null = null;
  let providerError: string | null = null;

  const firstInput: ProviderInput = buildProviderInput(analysisKind, ctx);
  const metadata: AiModelMetadata = { provider: provider.name, model: provider.model, prompt_version: firstInput.prompt_version, mode: provider.mode, estimated_tokens: null };
  const base = {
    id: newId("airun"),
    scope_kind: ctx.scope.kind,
    org_id: ctx.scope.kind === "FIRM_HOUSEHOLD" ? ctx.scope.org_id : null,
    workspace_id: ctx.scope.kind === "PERSONAL_WORKSPACE" ? ctx.scope.workspace_id : null,
    household_id: ctx.scope.kind === "FIRM_HOUSEHOLD" ? ctx.scope.household_id : null,
    snapshot_id: ctx.snapshot_id,
    snapshot_sha256: ctx.snapshot_sha256,
    analysis_kind: analysisKind,
    requested_by: requestedBy,
    prompt_version: firstInput.prompt_version,
    provider: provider.name,
    model: provider.model,
    mode: provider.mode,
    created_at: nowIso(),
  } as const;

  /** Fresh authorisation. Throws the resolver's own error (non-disclosing) when access is gone. */
  const reauthorize = (): "OK" | "CONTEXT_CHANGED" => {
    if (!options.reauthorize) return "OK";
    reauthorizations++;
    const fresh = options.reauthorize(); // throws NotFoundError on revoked membership / foreign scope
    if (!sameScope(ctx, fresh)) return "CONTEXT_CHANGED";
    ctx = fresh;
    return "OK";
  };

  const remaining = () => budget.max_wall_clock_ms - (now() - t0);

  let input: ProviderInput = firstInput;
  let prior: AiModelOutput | null = null;

  turnLoop: for (let turn = 1; turn <= budget.max_model_turns; turn++) {
    const turnStart = now();
    enter(turn === 1 ? "REQUEST_MODEL" : "CONTINUE_MODEL");
    const results: AiToolResultEnvelope[] = [];
    const trace: AiToolTraceEntry[] = [];
    let output: unknown = null;
    let outputChars = 0;
    let turnTokens: number | null = null;

    const finishTurn = () => turns.push({ turn, state_entered: turn === 1 ? "REQUEST_MODEL" : "CONTINUE_MODEL", model_output_sha256: output == null ? null : sha256(canonicalJson(output)), output_chars: outputChars, tool_requests: results.length, tool_results: trace, estimated_tokens: turnTokens, elapsed_ms: Math.max(0, now() - turnStart) });

    if (options.signal?.aborted) {
      stop = "CANCELLED";
      issues.push({ code: "RUN_CANCELLED", finding_id: null, detail: "The run was cancelled before the model was called.", disposition: "REJECT_REPORT" });
      finishTurn();
      break;
    }

    // ---- model call (first turn or bounded continuation), under the wall clock
    let result: ProviderResult;
    try {
      const call = turn === 1 ? provider.complete(input) : provider.continue!(input as Parameters<NonNullable<AiProvider["continue"]>>[0]);
      result = await withTimeout(call, remaining());
    } catch (e) {
      if (e instanceof TimeoutError) {
        stop = "WALL_CLOCK_EXCEEDED";
        issues.push({ code: "PROVIDER_TIMEOUT", finding_id: null, detail: `The provider did not answer within the ${budget.max_wall_clock_ms} ms run budget (turn ${turn}).`, disposition: "REJECT_REPORT" });
      } else {
        stop = "PROVIDER_ERROR";
        providerError = e instanceof Error ? e.message : String(e);
        issues.push({ code: "REPORT_TEXT_INVALID", finding_id: null, detail: `Provider failed: ${providerError}`, disposition: "REJECT_REPORT" });
      }
      finishTurn();
      break;
    }
    output = result.output;
    turnTokens = result.estimated_tokens;
    estimatedTokens = turnTokens == null ? estimatedTokens : (estimatedTokens ?? 0) + turnTokens;
    outputChars = JSON.stringify(output ?? null).length;
    if (outputChars > budget.max_output_chars) {
      stop = "OUTPUT_BUDGET_EXCEEDED";
      issues.push({ code: "BUDGET_EXCEEDED", finding_id: null, detail: `Turn ${turn} output is ${outputChars} characters; limit ${budget.max_output_chars}.`, disposition: "REJECT_REPORT" });
      finishTurn();
      break;
    }

    const parsed = AiModelOutputSchema.safeParse(output);
    if (!parsed.success) {
      // Not a review object: hand it to the validator, which rejects it with the usual code.
      finalOutput = output;
      stop = "PROVIDER_OUTPUT_INVALID";
      finishTurn();
      break;
    }
    const out = parsed.data;

    if (out.status === AI_ABSTAIN_STATUS) {
      stop = "MODEL_ABSTAINED";
      finalOutput = out;
      issues.push({ code: "MODEL_ABSTAINED", finding_id: null, detail: `The model abstained: ${(out.limitations ?? []).join(" ") || "no reason given"}. Tool requests in an abstention are ignored.`, disposition: "NOTE" });
      finishTurn();
      break;
    }

    // ---- tool requests: budgets first, then per-call authorisation, then execution
    enter("VALIDATE_TOOL_REQUESTS");
    const requests = out.tool_calls ?? [];
    requested += requests.length;
    const canContinue = typeof provider.continue === "function" && turn < budget.max_model_turns;
    if (requests.length > 0 && executed + requests.length > budget.max_tool_calls) {
      // Over budget: nothing in this batch is dispatched, and the run is rejected.
      for (const [i, r] of requests.entries()) {
        const d = { call_id: r.call_id ?? `tc_${turn}_${i + 1}`, tool: r.tool, status: "DENIED" as const, args_digest: sha256(canonicalJson(r.args ?? {})), result_digest: null, reason: "BUDGET_EXCEEDED" as const };
        trace.push(d);
        results.push({ status: "DENIED", call_id: d.call_id, tool: r.tool, reason: "BUDGET_EXCEEDED", args_digest: d.args_digest, untrusted: true });
        denied++;
      }
      issues.push({ code: "BUDGET_EXCEEDED", finding_id: null, detail: `${requests.length} tool call(s) requested on turn ${turn} with ${executed} already executed; limit ${budget.max_tool_calls} per run. None dispatched.`, disposition: "REJECT_REPORT" });
      stop = "TOOL_BUDGET_EXCEEDED";
      finalOutput = out;
      finishTurn();
      break;
    }
    if (requests.length > 0 && typeof provider.continue === "function" && !canContinue) {
      // The model asked for more evidence on its last permitted turn: nothing runs for a consumer that cannot exist.
      for (const [i, r] of requests.entries()) {
        const d = { call_id: r.call_id ?? `tc_${turn}_${i + 1}`, tool: r.tool, status: "DENIED" as const, args_digest: sha256(canonicalJson(r.args ?? {})), result_digest: null, reason: "TURN_BUDGET_EXHAUSTED" as const };
        trace.push(d);
        results.push({ status: "DENIED", call_id: d.call_id, tool: r.tool, reason: "TURN_BUDGET_EXHAUSTED", args_digest: d.args_digest, untrusted: true });
        denied++;
      }
      issues.push({ code: "TURN_BUDGET_EXHAUSTED", finding_id: null, detail: `${requests.length} tool call(s) requested on the final permitted turn (${turn}/${budget.max_model_turns}); not dispatched. The draft is validated as returned.`, disposition: "NOTE" });
      finalOutput = out;
      stop = "FINAL_DRAFT";
      finishTurn();
      break;
    }

    for (const [i, r] of requests.entries()) {
      const call_id = r.call_id ?? `tc_${turn}_${i + 1}`;
      const args = r.args ?? {};
      const args_digest = sha256(canonicalJson(args));
      const deny = (reason: AiToolTraceEntry["reason"] & string, detail: string, code: AiValidationIssue["code"]) => {
        trace.push({ call_id, tool: r.tool, status: "DENIED", args_digest, result_digest: null, reason });
        results.push({ status: "DENIED", call_id, tool: r.tool, reason, args_digest, untrusted: true });
        issues.push({ code, finding_id: null, detail, disposition: "NOTE" });
        denied++;
      };
      if (options.signal?.aborted) {
        stop = "CANCELLED";
        issues.push({ code: "RUN_CANCELLED", finding_id: null, detail: `The run was cancelled before tool "${r.tool}" executed.`, disposition: "REJECT_REPORT" });
        finishTurn();
        break turnLoop;
      }
      enter("AUTHORIZE_EACH_TOOL");
      const key = `${r.tool}:${args_digest}`;
      if (seenRequests.has(key)) {
        deny("DUPLICATE_REQUEST", `Tool "${r.tool}" with identical arguments was already requested in this run; not executed again.`, "DUPLICATE_TOOL_CALL");
        continue;
      }
      seenRequests.add(key);
      // Fresh authorisation for THIS execution. A revoked actor gets the resolver's own NotFound; nothing is recorded.
      const auth = reauthorize();
      if (auth === "CONTEXT_CHANGED") {
        deny("AUTHORIZATION_LOST", `The authorised scope or snapshot changed during the run; tool "${r.tool}" was not executed.`, "CONTEXT_CHANGED");
        issues.push({ code: "CONTEXT_CHANGED", finding_id: null, detail: "The household/workspace snapshot changed between turns. The run is rejected; start a new run on the current snapshot.", disposition: "REJECT_REPORT" });
        stop = "CONTEXT_CHANGED";
        finalOutput = out;
        finishTurn();
        break turnLoop;
      }
      enter("EXECUTE_ALLOWED_READ");
      const d = dispatchTool(ctx, r.tool, args);
      dispatches.push(d);
      if (d.status === "DENIED") {
        const code: AiValidationIssue["code"] = d.reason === "FORBIDDEN_TOOL" ? "FORBIDDEN_TOOL_CALL" : d.reason === "UNKNOWN_TOOL" ? "UNKNOWN_TOOL_CALL" : "TOOL_ARGS_INVALID";
        deny(d.reason, `Tool request "${r.tool}" denied (${d.reason}); not executed.`, code);
        continue;
      }
      const serialized = JSON.stringify(d.result ?? null);
      if (serialized.length > budget.max_tool_result_chars) {
        deny("RESULT_TOO_LARGE", `Tool "${r.tool}" returned ${serialized.length} characters; limit ${budget.max_tool_result_chars}. Withheld rather than truncated.`, "TOOL_RESULT_TOO_LARGE");
        continue;
      }
      if (looksLikeInjection(serialized)) {
        issues.push({ code: "INJECTION_TEXT_DETECTED", finding_id: null, detail: `Instruction-like text inside the ${r.tool} result (call ${call_id}) was passed to the model as data only.`, disposition: "NOTE" });
      }
      executed++;
      trace.push({ call_id, tool: d.tool, status: "OK", args_digest: d.args_digest, result_digest: d.result_digest, reason: null });
      results.push({ status: "OK", call_id, tool: d.tool, args_digest: d.args_digest, result_digest: d.result_digest, untrusted: true, result: d.result });
    }

    enter("ADD_TOOL_RESULTS");
    finishTurn();
    if (requests.length > 0 && canContinue) {
      prior = out;
      input = buildContinuationInput(firstInput, turn + 1, prior, results);
      continue;
    }
    finalOutput = out;
    stop = "FINAL_DRAFT";
    break;
  }

  if (stop === null) stop = "TURN_BUDGET_EXHAUSTED"; // defensive: the loop ended without a terminal decision

  // ---- final validation and record. Re-authorise once more before anything is persisted.
  enter("VALIDATE_FINAL_DRAFT");
  // Report limitations are capped at 400 characters by the contract; a long provider note must not reject a valid draft.
  const limitations = [...(options.serverLimitations ?? []), ...(options.providerNote ? [options.providerNote] : [])].map((l) => l.slice(0, 400));
  metadata.estimated_tokens = estimatedTokens;
  let report: AiRunRecord["report"] = null;
  let accepted = 0;
  let rejected = 0;
  let run_status: AiRunRecord["run_status"];
  if (stop === "FINAL_DRAFT" || stop === "PROVIDER_OUTPUT_INVALID") {
    const validation = validateModelOutput(finalOutput, ctx, analysisKind, metadata, limitations);
    report = validation.report;
    accepted = validation.accepted;
    rejected = validation.rejected;
    issues.unshift(...validation.issues);
    run_status = report ? "DRAFT_READY" : "REJECTED";
  } else if (stop === "MODEL_ABSTAINED") {
    run_status = "ABSTAINED";
  } else if (ERROR_STOPS.has(stop)) {
    run_status = "ERROR";
  } else {
    run_status = "REJECTED";
  }

  enter("RECORD");
  if (reauthorize() === "CONTEXT_CHANGED") {
    issues.push({ code: "CONTEXT_CHANGED", finding_id: null, detail: "The authorised scope or snapshot changed before the run could be recorded; the draft is rejected.", disposition: "REJECT_REPORT" });
    report = null;
    accepted = 0;
    run_status = "REJECTED";
    stop = "CONTEXT_CHANGED";
  }
  enter("RETURN");

  // Described AFTER the turns so a live adapter reports the model that actually served the run.
  const descriptor = describeProvider(provider);
  const runtime: AiRuntimeTrace = {
    schema_version: AI_RUNTIME_SCHEMA_VERSION,
    budget,
    provider_descriptor: descriptor,
    transitions,
    turns,
    tool_calls_requested: requested,
    tool_calls_executed: executed,
    tool_calls_denied: denied,
    reauthorizations,
    stop_reason: stop,
    elapsed_ms: Math.max(0, now() - t0),
  };
  const record: AiRunRecord = {
    ...base,
    tool_calls: dispatches.filter((x): x is Extract<ToolDispatch, { status: "OK" }> => x.status === "OK").map((x) => ({ tool: x.tool, args_digest: x.args_digest, result_digest: x.result_digest })),
    raw_output_sha256: sha256(finalOutput == null ? (providerError ? "provider-error" : "no-output") : canonicalJson(finalOutput)),
    report,
    validation_issues: issues,
    run_status,
    accepted_finding_count: accepted,
    rejected_finding_count: rejected,
    estimated_tokens: estimatedTokens,
    runtime,
  };
  return { record, toolDispatches: dispatches };
}
