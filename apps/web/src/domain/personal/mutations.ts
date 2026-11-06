import { USER_DECISIONS, isDecimalString, normalizeMoney, type CashAccount, type DataState, type UserDecisionEvent, type UserDecisionKind } from "@sagespan/contracts";
import type { PersonalActor } from "@/auth/personal-actor";
import { DomainError } from "../errors";
import { newId, nowIso } from "../ids";
import { personalBundle, requireWorkspace } from "./queries";

/**
 * Personal mutations. All are append-only or versioned:
 *  - a balance update creates a new CashAccount revision (the old one is kept, superseded);
 *  - a policy change rewrites only the user's own preferences;
 *  - a decision is an event; it never edits a recommendation, a fact or a run.
 * Every function re-derives the workspace from the server actor.
 */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function requireOwner(actor: PersonalActor): void {
  if (actor.workspace_role !== "OWNER") throw new DomainError("PERMISSION_DENIED", "Only the workspace owner can change these records.", 403);
}

function requireMoney(value: string, field: string): string {
  const v = value.trim();
  if (!isDecimalString(v)) throw new DomainError("VALIDATION", `${field} must be a decimal amount like 1250.00.`);
  if (v.startsWith("-")) throw new DomainError("VALIDATION", `${field} cannot be negative.`);
  return normalizeMoney(v);
}

export function updateCashBalance(state: DataState, actor: PersonalActor, accountRef: string, balance: string, asOf: string): CashAccount {
  requireOwner(actor);
  const ws = requireWorkspace(state, actor);
  const current = state.cash_accounts.find((a) => a.account_ref === accountRef && a.workspace_id === ws.id && !a.superseded);
  if (!current) throw new DomainError("NOT_FOUND", "Account not found", 404);
  if (!ISO_DATE.test(asOf)) throw new DomainError("VALIDATION", "As-of date must be YYYY-MM-DD.");
  const amount = requireMoney(balance, "Balance");
  current.superseded = true; // history is kept; the engine ref (account_ref) stays stable
  const next: CashAccount = { ...current, id: newId("cash"), balance: amount, balance_as_of: asOf, data_state: "USER_REPORTED", revision: current.revision + 1, supersedes_id: current.id, superseded: false, created_at: nowIso() };
  state.cash_accounts.push(next);
  return next;
}

export function updatePersonalPolicy(state: DataState, actor: PersonalActor, input: { cash_floor?: string; buffer_target_months?: string | null; extra_debt_payment_monthly?: string; notification_mode?: "NORMAL" | "QUIET" }): void {
  requireOwner(actor);
  const ws = requireWorkspace(state, actor);
  const profile = state.personal_profiles.find((p) => p.workspace_id === ws.id);
  if (!profile) throw new DomainError("NOT_FOUND", "Profile not found", 404);
  if (input.cash_floor !== undefined) profile.cash_floor = requireMoney(input.cash_floor, "Cash floor");
  if (input.buffer_target_months !== undefined) {
    if (input.buffer_target_months === null || input.buffer_target_months.trim() === "") profile.buffer_target_months = null;
    else {
      const v = input.buffer_target_months.trim();
      if (!/^\d+(\.\d{1,2})?$/.test(v) || Number(v) > 36) throw new DomainError("VALIDATION", "Buffer target must be a number of months between 0 and 36.");
      profile.buffer_target_months = v;
    }
  }
  if (input.extra_debt_payment_monthly !== undefined) profile.extra_debt_payment_monthly = requireMoney(input.extra_debt_payment_monthly, "Extra payment");
  if (input.notification_mode) profile.notification_mode = input.notification_mode;
  profile.updated_at = nowIso();
}

export function recordUserDecision(state: DataState, actor: PersonalActor, recommendationId: string, decision: string, note: string): UserDecisionEvent {
  const ws = requireWorkspace(state, actor);
  if (!(USER_DECISIONS as readonly string[]).includes(decision)) throw new DomainError("VALIDATION", "Unknown decision.");
  if (!recommendationId.startsWith("rec_")) throw new DomainError("VALIDATION", "Unknown recommendation.");
  const event: UserDecisionEvent = { id: newId("udec"), workspace_id: ws.id, recommendation_id: recommendationId, principal_id: actor.principal_id, decision: decision as UserDecisionKind, note: note.trim().slice(0, 500) || null, created_at: nowIso() };
  state.user_decisions.push(event);
  return event;
}

export function updateRetirementIntake(state: DataState, actor: PersonalActor, input: Record<string, string>): void {
  requireOwner(actor);
  const ws = requireWorkspace(state, actor);
  const intake = state.retirement_intakes.find((r) => r.workspace_id === ws.id);
  if (!intake) throw new DomainError("NOT_FOUND", "Retirement intake not found", 404);
  const moneyFields = ["annual_retirement_spending", "retirement_assets_total", "annual_contributions", "expected_pension_annual", "social_security_estimate_annual"] as const;
  for (const f of moneyFields) {
    if (!(f in input)) continue;
    const v = input[f]!.trim();
    if (v === "") {
      intake[f] = null;
      intake.states[f] = "MISSING";
    } else {
      intake[f] = requireMoney(v, f);
      intake.states[f] = "USER_REPORTED";
    }
  }
  for (const f of ["current_age", "target_retirement_age"] as const) {
    if (!(f in input)) continue;
    const v = input[f]!.trim();
    if (v === "") {
      intake[f] = null;
      intake.states[f] = "MISSING";
    } else {
      const n = Number(v);
      if (!Number.isInteger(n) || n < 16 || n > 110) throw new DomainError("VALIDATION", `${f} must be a whole number of years.`);
      intake[f] = n;
      intake.states[f] = f === "target_retirement_age" && input["target_is_assumed"] === "on" ? "ASSUMED" : "USER_REPORTED";
    }
  }
  if ("retirement_assets_as_of" in input) {
    const v = input["retirement_assets_as_of"]!.trim();
    if (v && !ISO_DATE.test(v)) throw new DomainError("VALIDATION", "As-of date must be YYYY-MM-DD.");
    intake.retirement_assets_as_of = v || null;
  }
  if ("social_security_estimate_source" in input) {
    const v = input["social_security_estimate_source"];
    intake.social_security_estimate_source = v === "SSA_STATEMENT" || v === "USER_GUESS" ? v : null;
    if (intake.social_security_estimate_annual && v === "USER_GUESS") intake.states["social_security_estimate_annual"] = "ASSUMED";
  }
  intake.updated_at = nowIso();
}

/** Convenience for pages/tests: bundle after a mutation. */
export function reloadBundle(state: DataState, actor: PersonalActor) {
  return personalBundle(state, actor);
}
