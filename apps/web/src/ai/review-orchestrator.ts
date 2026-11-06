import { canonicalJson, type AiAnalysisKind, type AiModelMetadata, type AiRunRecord, type DataState } from "@sagespan/contracts";
import type { PersonalActor } from "@/auth/personal-actor";
import type { Actor } from "@/auth/types";
import { sha256 } from "@/domain/audit";
import { newId, nowIso } from "@/domain/ids";
import type { Store } from "@/domain/store";
import { resolveFirmContext, resolvePersonalContext, type GroundingContext } from "./evidence-resolver";
import { buildProviderInput, resolveProvider, type AiProvider } from "./provider";
import { validateModelOutput } from "./result-validator";
import { dispatchTool, type ToolDispatch } from "./tools";

/**
 * Server-owned AI review orchestration (AI-001, synthetic mode).
 *
 *   authorise scope -> resolve minimal grounding -> provider (mock/scripted/live)
 *   -> dispatch any tool requests through the allowlist -> validate output
 *   -> persist an IMMUTABLE draft run record -> human decides.
 *
 * The orchestrator has no path to approve, verify a fact, mutate a snapshot,
 * record a review, move money or contact anything outside the process. Those
 * capabilities simply do not exist in this module or in the tools it can reach.
 */
export const SERVER_LIMITATIONS = ["AI-drafted. Not a verification, approval, professional opinion or regulated advice.", "Every amount shown is copied from a receipted deterministic calculation; the assistant performs no arithmetic.", "Scope is the authorised household/workspace only; nothing outside it was read."];

export interface OrchestrationResult {
  record: AiRunRecord;
  toolDispatches: ToolDispatch[];
}

/** Pure core: given an authorised context and a provider, produce a run record (not yet persisted). */
export async function orchestrate(ctx: GroundingContext, analysisKind: AiAnalysisKind, requestedBy: string, provider: AiProvider, providerNote: string | null = null): Promise<OrchestrationResult> {
  const input = buildProviderInput(analysisKind, ctx);
  const metadata: AiModelMetadata = { provider: provider.name, model: provider.model, prompt_version: input.prompt_version, mode: provider.mode, estimated_tokens: null };
  const toolDispatches: ToolDispatch[] = [];
  let record: AiRunRecord;
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
    prompt_version: input.prompt_version,
    provider: provider.name,
    model: provider.model,
    mode: provider.mode,
    created_at: nowIso(),
  } as const;
  try {
    const result = await provider.complete(input);
    metadata.estimated_tokens = result.estimated_tokens;
    // Tool requests are dispatched (and denied) independently of whatever the model wrote about them.
    for (const call of result.output.tool_calls ?? []) toolDispatches.push(dispatchTool(ctx, call.tool, call.args ?? {}));
    const limitations = [...SERVER_LIMITATIONS, ...(providerNote ? [providerNote] : [])];
    const validation = validateModelOutput(result.output, ctx, analysisKind, metadata, limitations);
    for (const d of toolDispatches.filter((x) => x.status === "DENIED")) {
      validation.issues.push({ code: d.reason === "FORBIDDEN_TOOL" ? "FORBIDDEN_TOOL_CALL" : "UNKNOWN_TOOL_CALL", finding_id: null, detail: `Tool request "${d.tool}" denied (${d.reason}); not executed.`, disposition: "NOTE" });
    }
    record = {
      ...base,
      tool_calls: toolDispatches.filter((x): x is Extract<ToolDispatch, { status: "OK" }> => x.status === "OK").map((x) => ({ tool: x.tool, args_digest: x.args_digest, result_digest: x.result_digest })),
      raw_output_sha256: sha256(canonicalJson(result.output)),
      report: validation.report,
      validation_issues: validation.issues,
      run_status: validation.report ? "DRAFT_READY" : "REJECTED",
      accepted_finding_count: validation.accepted,
      rejected_finding_count: validation.rejected,
      estimated_tokens: result.estimated_tokens,
    };
  } catch (e) {
    record = {
      ...base,
      tool_calls: [],
      raw_output_sha256: sha256("provider-error"),
      report: null,
      validation_issues: [{ code: "REPORT_TEXT_INVALID", finding_id: null, detail: `Provider failed: ${e instanceof Error ? e.message : String(e)}`, disposition: "REJECT_REPORT" }],
      run_status: "ERROR",
      accepted_finding_count: 0,
      rejected_finding_count: 0,
      estimated_tokens: null,
    };
  }
  return { record, toolDispatches };
}

function persist(store: Store, record: AiRunRecord): AiRunRecord {
  store.mutate((s: DataState) => {
    s.ai_runs.push(record); // append-only; never updated afterwards
  });
  return record;
}

/** Firm: "Analyze plan" for one household the actor is authorised to read. */
export async function runFirmAnalyzePlan(store: Store, actor: Actor, householdId: string, provider?: AiProvider): Promise<AiRunRecord> {
  const ctx = resolveFirmContext(store.read(), actor, householdId);
  const resolved = provider ? { provider, note: null } : resolveProvider();
  const { record } = await orchestrate(ctx, "RETIREMENT_PLAN_REVIEW", actor.user_id, resolved.provider, resolved.note);
  return persist(store, record);
}

/** Personal: "Understand my finances" for the actor's own workspace. */
export async function runPersonalUnderstand(store: Store, actor: PersonalActor, provider?: AiProvider): Promise<AiRunRecord> {
  const ctx = resolvePersonalContext(store.read(), actor);
  const resolved = provider ? { provider, note: null } : resolveProvider();
  const { record } = await orchestrate(ctx, "PERSONAL_FINANCES_UNDERSTAND", actor.principal_id, resolved.provider, resolved.note);
  return persist(store, record);
}

/** Scoped read of runs: a firm actor sees its org's household runs; a personal actor its workspace's. */
export function listRunsForHousehold(state: DataState, actor: Actor, householdId: string): AiRunRecord[] {
  return state.ai_runs.filter((r) => r.scope_kind === "FIRM_HOUSEHOLD" && r.org_id === actor.org_id && r.household_id === householdId).sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function listRunsForWorkspace(state: DataState, actor: PersonalActor): AiRunRecord[] {
  return state.ai_runs.filter((r) => r.scope_kind === "PERSONAL_WORKSPACE" && r.workspace_id === actor.workspace_id).sort((a, b) => b.created_at.localeCompare(a.created_at));
}
