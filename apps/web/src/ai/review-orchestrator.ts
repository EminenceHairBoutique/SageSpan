import type { AiAnalysisKind, AiRunRecord, DataState } from "@sagespan/contracts";
import type { PersonalActor } from "@/auth/personal-actor";
import type { Actor } from "@/auth/types";
import type { PersonalRepository } from "@/domain/personal/repository";
import type { Store } from "@/domain/store";
import { personalRepositoryResolver, resolveFirmContext, resolvePersonalContext, type GroundingContext } from "./evidence-resolver";
import { resolveProvider, type AiProvider } from "./provider";
import { runToolLoop, type ToolLoopOptions } from "./runtime/tool-loop";
import type { ToolDispatch } from "./tools";

/**
 * Server-owned AI review orchestration (AI-001 synthetic mode; AI-CORE-001 runtime).
 *
 *   authorise scope -> resolve minimal grounding -> bounded tool loop
 *   (model -> allowlisted read-only tools, re-authorised per call -> model)
 *   -> validate output -> persist an IMMUTABLE draft run record -> human decides.
 *
 * The orchestrator has no path to approve, verify a fact, mutate a snapshot,
 * record a review, move money or contact anything outside the process. Those
 * capabilities simply do not exist in this module, in the runtime, or in the
 * tools it can reach. `orchestrate()` keeps its original signature; the loop
 * itself lives in `runtime/tool-loop.ts`.
 */
export const SERVER_LIMITATIONS = ["AI-drafted. Not a verification, approval, professional opinion or regulated advice.", "Every amount shown is copied from a receipted deterministic calculation; the assistant performs no arithmetic.", "Scope is the authorised household/workspace only; nothing outside it was read."];

export interface OrchestrationResult {
  record: AiRunRecord;
  toolDispatches: ToolDispatch[];
}

/**
 * Pure core: given an authorised context and a provider, produce a run record (not yet persisted).
 * `options.reauthorize` re-resolves the scope from current state before every tool execution and
 * before the record is built; when it throws (revoked membership, foreign scope) the error propagates
 * unchanged and nothing is recorded.
 */
export async function orchestrate(ctx: GroundingContext, analysisKind: AiAnalysisKind, requestedBy: string, provider: AiProvider, providerNote: string | null = null, options: Omit<ToolLoopOptions, "providerNote" | "serverLimitations"> = {}): Promise<OrchestrationResult> {
  return runToolLoop(ctx, analysisKind, requestedBy, provider, { ...options, providerNote, serverLimitations: SERVER_LIMITATIONS });
}

function persist(store: Store, record: AiRunRecord): AiRunRecord {
  store.mutate((s: DataState) => {
    s.ai_runs.push(record); // append-only; never updated afterwards
  });
  return record;
}

/** Firm: "Analyze plan" for one household the actor is authorised to read. */
export async function runFirmAnalyzePlan(store: Store, actor: Actor, householdId: string, provider?: AiProvider, options: Omit<ToolLoopOptions, "providerNote" | "serverLimitations" | "reauthorize"> = {}): Promise<AiRunRecord> {
  const authorize = () => resolveFirmContext(store.read(), actor, householdId);
  const ctx = authorize();
  const resolved = provider ? { provider, note: null } : resolveProvider();
  const { record } = await orchestrate(ctx, "RETIREMENT_PLAN_REVIEW", actor.user_id, resolved.provider, resolved.note, { ...options, reauthorize: authorize });
  return persist(store, record);
}

/** Personal: "Understand my finances" for the actor's own workspace. */
export async function runPersonalUnderstand(store: Store, actor: PersonalActor, provider?: AiProvider, options: Omit<ToolLoopOptions, "providerNote" | "serverLimitations" | "reauthorize"> = {}): Promise<AiRunRecord> {
  const authorize = () => resolvePersonalContext(store.read(), actor);
  const ctx = authorize();
  const resolved = provider ? { provider, note: null } : resolveProvider();
  const { record } = await orchestrate(ctx, "PERSONAL_FINANCES_UNDERSTAND", actor.principal_id, resolved.provider, resolved.note, { ...options, reauthorize: authorize });
  return persist(store, record);
}

/** Scoped read of runs: a firm actor sees its org's household runs; a personal actor its workspace's. */
export function listRunsForHousehold(state: DataState, actor: Actor, householdId: string): AiRunRecord[] {
  return state.ai_runs.filter((r) => r.scope_kind === "FIRM_HOUSEHOLD" && r.org_id === actor.org_id && r.household_id === householdId).sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function listRunsForWorkspace(state: DataState, actor: PersonalActor): AiRunRecord[] {
  return state.ai_runs.filter((r) => r.scope_kind === "PERSONAL_WORKSPACE" && r.workspace_id === actor.workspace_id).sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export interface RepositoryRunResult {
  record: AiRunRecord;
  /** True only when the run record was appended to a store that persists `ai_runs` (the demo file store). */
  persisted: boolean;
  /** Why the record was not persisted, when it was not. Never silent. */
  persistence_note: string | null;
}

/**
 * AI-CORE-002b — Personal "Understand my finances" over the Data track's repository seam.
 *
 * The context is resolved from `repo.bundle()` (demo file store or Supabase under the
 * user's own RLS session — DATA-001/002); the same async resolver re-authorises before every
 * tool execution and before RECORD, so a membership revoked mid-run ends the run with the
 * repository's own NotFound and nothing is recorded.
 *
 * Persistence is honest about what exists: the demo store persists `ai_runs`; the production
 * repository has no AI-run table yet (AI persistence is the AI track's future migration — see
 * `supabase/migrations/REGISTRY.md`, next free number), so a PRODUCTION run returns its record
 * with `persisted: false` and a note instead of pushing into a view that would drop it.
 */
export async function runPersonalUnderstandForRepository(repo: PersonalRepository, provider?: AiProvider, options: Omit<ToolLoopOptions, "providerNote" | "serverLimitations" | "reauthorize"> = {}): Promise<RepositoryRunResult> {
  const resolver = personalRepositoryResolver(repo);
  const ctx = await resolver.resolve();
  const resolved = provider ? { provider, note: null } : resolveProvider();
  const { record } = await orchestrate(ctx, "PERSONAL_FINANCES_UNDERSTAND", repo.actor.principal_id, resolved.provider, resolved.note, { ...options, reauthorize: () => resolver.resolve() });
  if (repo.mode === "DEMO") {
    await repo.mutate((s: DataState) => {
      s.ai_runs.push(record); // append-only; never updated afterwards
    });
    return { record, persisted: true, persistence_note: null };
  }
  return { record, persisted: false, persistence_note: "AI run records are not persisted for production workspaces yet: the AI-run tables (RLS mirroring 0008, append-only, SECURITY DEFINER write path) are the AI track's pending migration; allocate a number in supabase/migrations/REGISTRY.md before creating it." };
}
