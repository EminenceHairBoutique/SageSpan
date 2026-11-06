import { AiFeedbackInputSchema, type AiFeedback, type DataState } from "@sagespan/contracts";
import { NotFoundError } from "@/auth/types";
import { DomainError } from "../errors";
import { newId, nowIso } from "../ids";

/**
 * Reviewer / user feedback on an AI finding. Append-only and versioned per
 * (run, finding). The AI run record and its report are never modified: an EDIT
 * stores the human's text beside the model's original, and ACCEPT does not make
 * a finding a fact, a disposition or an approval.
 */
export interface FeedbackActor {
  principal_id: string;
  role: string;
  scope: { kind: "FIRM_HOUSEHOLD"; org_id: string } | { kind: "PERSONAL_WORKSPACE"; workspace_id: string };
}

export function recordAiFeedback(state: DataState, actor: FeedbackActor, rawInput: unknown): AiFeedback {
  const parsed = AiFeedbackInputSchema.safeParse(rawInput);
  if (!parsed.success) throw new DomainError("VALIDATION", parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  const input = parsed.data;
  const run = state.ai_runs.find((r) => r.id === input.ai_run_id);
  // Scope check first, with a non-disclosing failure: a run from another org/workspace "does not exist".
  if (!run) throw new NotFoundError();
  if (actor.scope.kind === "FIRM_HOUSEHOLD" && !(run.scope_kind === "FIRM_HOUSEHOLD" && run.org_id === actor.scope.org_id)) throw new NotFoundError();
  if (actor.scope.kind === "PERSONAL_WORKSPACE" && !(run.scope_kind === "PERSONAL_WORKSPACE" && run.workspace_id === actor.scope.workspace_id)) throw new NotFoundError();
  if (!run.report || !run.report.findings.some((f) => f.finding_id === input.finding_id)) throw new DomainError("NOT_FOUND", "Finding not found on this run", 404);
  if (input.action === "EDIT" && !input.edited_text) throw new DomainError("VALIDATION", "An edit needs the edited text.");
  const version = state.ai_feedback.filter((f) => f.ai_run_id === run.id && f.finding_id === input.finding_id).length + 1;
  const fb: AiFeedback = { id: newId("aifb"), ai_run_id: run.id, finding_id: input.finding_id, actor_principal_id: actor.principal_id, actor_role: actor.role, action: input.action, edited_text: input.action === "EDIT" ? input.edited_text : null, rationale: input.rationale, version, created_at: nowIso() };
  state.ai_feedback.push(fb);
  return fb;
}

export function feedbackForRun(state: DataState, runId: string): AiFeedback[] {
  return state.ai_feedback.filter((f) => f.ai_run_id === runId).sort((a, b) => a.created_at.localeCompare(b.created_at));
}

/** Latest feedback per finding (versions only ever increase). */
export function latestFeedbackByFinding(state: DataState, runId: string): Map<string, AiFeedback> {
  const m = new Map<string, AiFeedback>();
  for (const f of feedbackForRun(state, runId)) {
    const prev = m.get(f.finding_id);
    if (!prev || prev.version < f.version) m.set(f.finding_id, f);
  }
  return m;
}
