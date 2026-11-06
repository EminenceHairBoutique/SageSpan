"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { getPersonalActor, listPersonalPersonas, PRINCIPAL_COOKIE, type PersonalActor } from "@/auth/personal-actor";
import { errorResult, type ActionResult } from "@/domain/errors";
import { recordUserDecision, updateCashBalance, updatePersonalPolicy, updateRetirementIntake } from "@/domain/personal/mutations";
import { refreshPersonalBaseline, runPersonalScenario } from "@/domain/personal/runs";
import { PERSONAL_RECORD_TYPES, ScenarioSpecSchema, type PersonalRecordType, type ScenarioSpec } from "@sagespan/contracts";
import { createPersonalRecord, retirePersonalRecord, updatePersonalRecord } from "@/domain/personal/records";
import { startFreshWorkspace } from "@/domain/personal/intake";
import { redirect } from "next/navigation";
import { DomainError } from "@/domain/errors";
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


/** Build a ScenarioSpec from the what-if form. Blank fields are omitted so the shared contract decides what each kind needs. */
function scenarioSpecFromForm(fd: FormData): ScenarioSpec {
  const kind = str(fd, "kind");
  const raw: Record<string, unknown> = { kind };
  const amount = str(fd, "monthly_amount").replace(/[$,\s]/g, "");
  if (kind === "SPENDING_CHANGE") {
    const direction = str(fd, "direction") === "MORE" ? "" : "-";
    if (amount) raw.monthly_amount = `${direction}${amount.replace(/^-/, "")}`;
  } else if (kind === "SAVINGS_CHANGE") {
    if (amount) raw.monthly_amount = amount;
    if (str(fd, "goal_ref")) raw.goal_ref = str(fd, "goal_ref");
    raw.destination = str(fd, "destination") === "ILLIQUID" ? "ILLIQUID" : "LIQUID";
  } else if (kind === "INCOME_INTERRUPTION") {
    if (str(fd, "stream_ref")) raw.stream_ref = str(fd, "stream_ref");
    if (str(fd, "months")) raw.months = Number(str(fd, "months"));
    if (str(fd, "start_date")) raw.start_date = str(fd, "start_date");
  }
  const parsed = ScenarioSpecSchema.safeParse(raw);
  if (!parsed.success) throw new DomainError("VALIDATION", parsed.error.issues.map((i) => `${i.path.join(".") || "scenario"}: ${i.message}`).join("; "));
  return parsed.data;
}

export async function runScenarioAction(_prev: ActionResult<{ message: string }> | null, formData: FormData): Res<{ message: string }> {
  return run(async (actor) => {
    const spec = scenarioSpecFromForm(formData);
    const out = await runPersonalScenario(getStore(), actor, spec);
    if (out.run_status === "ERROR") throw Object.assign(new Error(`${out.error?.message ?? "Scenario failed"} (${out.error?.code ?? "ERROR"})`), { name: "CalcServiceError" });
    return { message: out.run_status === "INFEASIBLE" ? "The engine reports this change cannot be applied to your inputs; see the reason below. Nothing was estimated." : "What-if computed with a receipt. Baseline and scenario are shown side by side below; nothing in your records changed." };
  });
}


// ---------------------------------------------------------------- PERS-002a records
function recordType(fd: FormData): PersonalRecordType {
  const t = str(fd, "record_type");
  if (!(PERSONAL_RECORD_TYPES as readonly string[]).includes(t)) throw new DomainError("VALIDATION", "Unknown record type.");
  return t as PersonalRecordType;
}

const opt = (v: string) => (v.trim() === "" ? null : v.trim());
const amount = (v: string) => v.replace(/[$,\s]/g, "");
const bool = (fd: FormData, k: string) => fd.get(k) === "on" || fd.get(k) === "true";

/** Parse the observed-months textarea: one amount per line or comma-separated, oldest first; blanks dropped. */
function observedMonths(v: string): string[] {
  return v
    .split(/[\n,;]+/)
    .map((x) => amount(x))
    .filter((x) => x.length > 0);
}

/** Shape the raw form into the record's write object. Shared Zod validation runs in the domain layer. */
function recordInputFromForm(type: PersonalRecordType, fd: FormData): unknown {
  switch (type) {
    case "CASH_ACCOUNT":
      return { label: str(fd, "label"), kind: str(fd, "kind"), balance: amount(str(fd, "balance")), balance_as_of: str(fd, "balance_as_of"), ...(fd.has("liquid_explicit") ? { liquid: bool(fd, "liquid") } : {}) };
    case "INCOME_STREAM":
      return { label: str(fd, "label"), kind: str(fd, "kind"), cadence: str(fd, "cadence"), reliability: str(fd, "reliability") || "UNKNOWN", observed_monthly_amounts: observedMonths(str(fd, "observed_monthly_amounts")), observed_from: opt(str(fd, "observed_from")), observed_to: opt(str(fd, "observed_to")), expected_amount: opt(amount(str(fd, "expected_amount"))), next_expected_date: opt(str(fd, "next_expected_date")) };
    case "OBLIGATION":
      return { label: str(fd, "label"), category: str(fd, "category"), amount: amount(str(fd, "amount")), cadence: str(fd, "cadence"), next_due_date: str(fd, "next_due_date"), essential: bool(fd, "essential"), liability_id: opt(str(fd, "liability_id")) };
    case "VARIABLE_SPENDING":
      return { category: str(fd, "category"), observed_monthly_amounts: observedMonths(str(fd, "observed_monthly_amounts")), essential: bool(fd, "essential"), transfers_excluded: bool(fd, "transfers_excluded") };
    case "LIABILITY":
      return { label: str(fd, "label"), kind: str(fd, "kind"), balance: amount(str(fd, "balance")), balance_as_of: str(fd, "balance_as_of"), apr_percent: amount(str(fd, "apr_percent")), minimum_payment: amount(str(fd, "minimum_payment")), rate_type: str(fd, "rate_type"), promo_apr_percent: opt(amount(str(fd, "promo_apr_percent"))), promo_apr_expires: opt(str(fd, "promo_apr_expires")), due_day_of_month: str(fd, "due_day_of_month").trim() ? Number(str(fd, "due_day_of_month")) : null };
    case "GOAL":
      return { label: str(fd, "label"), kind: str(fd, "kind"), target_amount: amount(str(fd, "target_amount")), saved_amount: amount(str(fd, "saved_amount") || "0"), target_date: opt(str(fd, "target_date")), monthly_contribution: opt(amount(str(fd, "monthly_contribution"))), funded_from_account_id: opt(str(fd, "funded_from_account_id")) };
  }
}

export async function saveRecordAction(_prev: ActionResult<{ message: string; ref: string }> | null, formData: FormData): Res<{ message: string; ref: string }> {
  return run(async (actor) => {
    const type = recordType(formData);
    const ref = str(formData, "record_ref");
    const input = recordInputFromForm(type, formData);
    const row = getStore().mutate((s) => (ref ? updatePersonalRecord(s, actor, type, ref, input) : createPersonalRecord(s, actor, type, input)));
    const outRef = type === "CASH_ACCOUNT" ? (row as { account_ref: string }).account_ref : (row as { id: string }).id;
    const label = "label" in (row as object) ? (row as { label: string }).label : (row as { category: string }).category;
    const refresh = await refreshPersonalBaseline(getStore(), actor, { force: true });
    const tail = refresh.errors.length ? " The baseline could not be recomputed right now; the previous figures are kept until the calculation service answers." : " Your baseline was recomputed from a new snapshot.";
    return { ref: outRef, message: `${ref ? "Updated" : "Added"} "${label}" as a new revision; the previous version is kept in history.${tail}` };
  });
}

export async function retireRecordAction(_prev: ActionResult<{ message: string }> | null, formData: FormData): Res<{ message: string }> {
  return run(async (actor) => {
    const type = recordType(formData);
    const out = getStore().mutate((s) => retirePersonalRecord(s, actor, type, str(formData, "record_ref")));
    await refreshPersonalBaseline(getStore(), actor, { force: true });
    return { message: out.retired.length > 1 ? `Retired ${out.retired.length} records (the debt and its linked payments). They stay in history; nothing was deleted.` : "Retired. The record stays in history; nothing was deleted. Your baseline was recomputed." };
  });
}


// ---------------------------------------------------------------- PERS-002b start fresh
/**
 * Creates a new synthetic individual + workspace from the Welcome step and signs
 * the demo session in as them (cookie). Redirects to the first discovery step.
 * Validation errors are returned to the form; nothing is created on failure.
 */
export async function startFreshAction(_prev: ActionResult<{ message: string }> | null, formData: FormData): Res<{ message: string }> {
  let created: { principal_id: string } | null = null;
  try {
    const out = getStore().mutate((s) =>
      startFreshWorkspace(s, {
        display_name: str(formData, "display_name"),
        workspace_kind: str(formData, "workspace_kind") === "HOUSEHOLD" ? "HOUSEHOLD" : "PERSONAL",
        household_size: Number(str(formData, "household_size") || "1"),
        situation: str(formData, "situation"),
        top_concern: str(formData, "top_concern") || null,
        cash_floor: amount(str(formData, "cash_floor")),
        buffer_target_months: str(formData, "buffer_target_months").trim() || null,
      }),
    );
    created = { principal_id: out.principal.id };
    const jar = await cookies();
    jar.set(PRINCIPAL_COOKIE, out.principal.id, { httpOnly: true, sameSite: "lax", path: "/" });
  } catch (e) {
    return errorResult(e);
  }
  revalidatePath("/demo/personal", "layout");
  redirect(`/demo/personal/intake/income?new=${encodeURIComponent(created.principal_id)}`);
}
