"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { getPersonalActor, listPersonalPersonas, PRINCIPAL_COOKIE, type PersonalActor } from "@/auth/personal-actor";
import { errorResult, type ActionResult } from "@/domain/errors";
import { recordUserDecision, updateCashBalance, updatePersonalPolicy, updateRetirementIntake } from "@/domain/personal/mutations";
import { refreshPersonalBaseline } from "@/domain/personal/runs";
import { getStore } from "@/domain/store";
import { runPersonalUnderstand } from "@/ai/review-orchestrator";
import { recordAiFeedback } from "@/domain/ai/feedback";

type Res<T = undefined> = Promise<ActionResult<T>>;

function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v : "";
}

async function run<T>(fn: (actor: PersonalActor) => Promise<T> | T): Res<T> {
  try {
    const actor = await getPersonalActor();
    const data = await fn(actor);
    revalidatePath("/demo/personal", "layout");
    return { ok: true, data };
  } catch (e) {
    return errorResult(e);
  }
}

export async function switchPrincipalAction(formData: FormData): Promise<void> {
  const wanted = str(formData, "principal");
  if (!listPersonalPersonas().some((p) => p.principal_id === wanted)) return;
  const jar = await cookies();
  jar.set(PRINCIPAL_COOKIE, wanted, { httpOnly: true, sameSite: "lax", path: "/" });
  revalidatePath("/demo/personal", "layout");
}

export async function refreshBaselineAction(_prev: ActionResult<{ message: string }> | null, _formData: FormData): Res<{ message: string }> {
  void _prev;
  void _formData;
  return run(async (actor) => {
    const out = await refreshPersonalBaseline(getStore(), actor, { force: true });
    if (out.errors.length) {
      const first = out.errors[0]!;
      throw Object.assign(new Error(`${first.message} (${first.code})`), { name: "CalcServiceError" });
    }
    return { message: `Baseline refreshed from snapshot ${out.snapshotId} with receipts${out.debt ? " (clarity + debt paths)" : ""}.` };
  });
}

export async function updateBalanceAction(_prev: ActionResult<{ message: string }> | null, formData: FormData): Res<{ message: string }> {
  return run(async (actor) => {
    const next = getStore().mutate((s) => updateCashBalance(s, actor, str(formData, "account_ref"), str(formData, "balance"), str(formData, "as_of")));
    await refreshPersonalBaseline(getStore(), actor, { force: true });
    return { message: `${next.label} updated to a new revision (${next.revision}) as of ${next.balance_as_of}. The baseline was recomputed from a new snapshot.` };
  });
}

export async function updatePolicyAction(_prev: ActionResult<{ message: string }> | null, formData: FormData): Res<{ message: string }> {
  return run(async (actor) => {
    getStore().mutate((s) =>
      updatePersonalPolicy(s, actor, {
        cash_floor: str(formData, "cash_floor") || undefined,
        buffer_target_months: formData.has("buffer_target_months") ? str(formData, "buffer_target_months") : undefined,
        extra_debt_payment_monthly: str(formData, "extra_debt_payment_monthly") || undefined,
        notification_mode: str(formData, "notification_mode") === "QUIET" ? "QUIET" : str(formData, "notification_mode") === "NORMAL" ? "NORMAL" : undefined,
      }),
    );
    await refreshPersonalBaseline(getStore(), actor, { force: true });
    return { message: "Preferences saved. Your baseline and comparisons were recomputed from a new snapshot." };
  });
}

export async function decideAction(_prev: ActionResult<{ message: string }> | null, formData: FormData): Res<{ message: string }> {
  return run((actor) => {
    const ev = getStore().mutate((s) => recordUserDecision(s, actor, str(formData, "recommendation_id"), str(formData, "decision"), str(formData, "note")));
    const label = ev.decision === "DONE" ? "Marked done." : ev.decision === "SNOOZE" ? "Snoozed." : ev.decision === "NOT_RELEVANT" ? "Marked not relevant." : ev.decision === "DISAGREE" ? "Recorded that you disagree; nothing was changed." : ev.decision === "ACCEPT" ? "Accepted." : "Recorded.";
    return { message: `${label} Your decision is stored as a separate event; the underlying facts and calculations are unchanged.` };
  });
}

export async function updateRetirementIntakeAction(_prev: ActionResult<{ message: string }> | null, formData: FormData): Res<{ message: string }> {
  return run((actor) => {
    const input: Record<string, string> = {};
    for (const [k, v] of formData.entries()) if (typeof v === "string") input[k] = v;
    getStore().mutate((s) => updateRetirementIntake(s, actor, input));
    return { message: "Retirement intake saved. The readiness gate reflects what is known, assumed and missing; no projection runs until the engine exists." };
  });
}

export async function understandFinancesAction(_prev: ActionResult<{ message: string; runId: string }> | null, _formData: FormData): Res<{ message: string; runId: string }> {
  void _prev;
  void _formData;
  return run(async (actor) => {
    const record = await runPersonalUnderstand(getStore(), actor);
    return { runId: record.id, message: record.run_status === "DRAFT_READY" ? `Draft ready (${record.accepted_finding_count} grounded finding(s), ${record.rejected_finding_count} rejected by the validator). Everything shown is a draft for you to accept, edit or dismiss.` : `The assistant could not produce a grounded draft (${record.run_status}).` };
  });
}

export async function personalAiFeedbackAction(_prev: ActionResult<{ message: string }> | null, formData: FormData): Res<{ message: string }> {
  return run((actor) => {
    getStore().mutate((s) => recordAiFeedback(s, { principal_id: actor.principal_id, role: `WORKSPACE_${actor.workspace_role}`, scope: { kind: "PERSONAL_WORKSPACE", workspace_id: actor.workspace_id } }, { ai_run_id: str(formData, "ai_run_id"), finding_id: str(formData, "finding_id"), action: str(formData, "action") as "ACCEPT" | "EDIT" | "DISMISS" | "REQUEST_EVIDENCE", edited_text: str(formData, "edited_text") || null, rationale: str(formData, "rationale") }));
    return { message: "Feedback recorded as a separate versioned event. The assistant's original output is unchanged." };
  });
}
