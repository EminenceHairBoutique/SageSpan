import {
  PERSONAL_RECORD_WRITE_SCHEMAS,
  normalizeMoney,
  type CashAccount,
  type CashAccountWrite,
  type DataState,
  type GoalWrite,
  type IncomeStream,
  type IncomeStreamWrite,
  type Liability,
  type LiabilityWrite,
  type ObligationWrite,
  type PersonalRecordRevision,
  type PersonalRecordType,
  type RecurringObligation,
  type SavingsGoal,
  type VariableSpendingPattern,
  type VariableSpendingWrite,
} from "@sagespan/contracts";
import type { PersonalActor } from "@/auth/personal-actor";
import { DomainError } from "../errors";
import { newId, nowIso } from "../ids";
import { requireWorkspace } from "./queries";

/**
 * PERS-002a: add / edit / retire personal records.
 *
 * Rules, all enforced here with the server-resolved actor (never from a form id):
 *  - owner only; a participant can read what they were granted, not write;
 *  - every record is scoped by the actor's workspace; a record id from another
 *    workspace is "not found", never "forbidden" (no existence leak);
 *  - every write appends a PersonalRecordRevision (before/after) and bumps the
 *    record's revision; cash accounts additionally keep their per-revision rows;
 *  - retire, never delete: retired records stay stored so old runs keep their
 *    refs, and leave the live bundle and every new snapshot;
 *  - the shared Zod schema validates shape; money is normalised to cents here;
 *    no totals or derived figures are produced in this tier.
 */
type RecordOf<T extends PersonalRecordType> = T extends "CASH_ACCOUNT" ? CashAccount : T extends "INCOME_STREAM" ? IncomeStream : T extends "OBLIGATION" ? RecurringObligation : T extends "VARIABLE_SPENDING" ? VariableSpendingPattern : T extends "LIABILITY" ? Liability : SavingsGoal;

const LIQUID_KINDS: ReadonlySet<CashAccount["kind"]> = new Set(["CHECKING", "SAVINGS", "CASH", "OTHER_LIQUID"]);

function requireOwner(actor: PersonalActor): void {
  if (actor.workspace_role !== "OWNER") throw new DomainError("PERMISSION_DENIED", "Only the workspace owner can change these records.", 403);
}

export function parseRecordInput<T extends PersonalRecordType>(type: T, raw: unknown): ReturnType<(typeof PERSONAL_RECORD_WRITE_SCHEMAS)[T]["parse"]> {
  const schema = PERSONAL_RECORD_WRITE_SCHEMAS[type];
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new DomainError("VALIDATION", parsed.error.issues.map((i) => `${i.path.join(".") || "record"}: ${i.message}`).join("; "));
  return parsed.data as ReturnType<(typeof PERSONAL_RECORD_WRITE_SCHEMAS)[T]["parse"]>;
}

function collection(state: DataState, type: PersonalRecordType): Array<{ id: string; workspace_id: string }> {
  switch (type) {
    case "CASH_ACCOUNT":
      return state.cash_accounts;
    case "INCOME_STREAM":
      return state.income_streams;
    case "OBLIGATION":
      return state.recurring_obligations;
    case "VARIABLE_SPENDING":
      return state.variable_spending;
    case "LIABILITY":
      return state.liabilities;
    case "GOAL":
      return state.savings_goals;
  }
}

function revisionCount(state: DataState, wsId: string, type: PersonalRecordType, ref: string): number {
  return state.personal_record_revisions.filter((r) => r.workspace_id === wsId && r.record_type === type && r.record_ref === ref).length;
}

function log(state: DataState, actor: PersonalActor, type: PersonalRecordType, ref: string, change: PersonalRecordRevision["change"], before: unknown | null, after: unknown | null): PersonalRecordRevision {
  // Seeded records have no CREATE row; their first logged change is revision 2 so the seed is implicitly revision 1.
  const prior = revisionCount(state, actor.workspace_id, type, ref);
  const rev: PersonalRecordRevision = {
    id: newId("prev"),
    workspace_id: actor.workspace_id,
    record_type: type,
    record_ref: ref,
    revision: change === "CREATE" ? 1 : Math.max(prior, 1) + 1,
    change,
    before: before == null ? null : structuredClone(before),
    after: after == null ? null : structuredClone(after),
    changed_by: actor.principal_id,
    created_at: nowIso(),
  };
  state.personal_record_revisions.push(rev);
  return rev;
}

const money = (v: string) => normalizeMoney(v);
const moneyOrNull = (v: string | null | undefined) => (v == null ? null : normalizeMoney(v));

function requireLiabilityInWorkspace(state: DataState, wsId: string, liabilityId: string | null | undefined): string | null {
  if (!liabilityId) return null;
  const l = state.liabilities.find((x) => x.id === liabilityId && x.workspace_id === wsId && !x.retired);
  if (!l) throw new DomainError("VALIDATION", "The linked debt was not found in this workspace.");
  return l.id;
}

function requireAccountInWorkspace(state: DataState, wsId: string, accountRef: string | null | undefined): string | null {
  if (!accountRef) return null;
  const a = state.cash_accounts.find((x) => x.account_ref === accountRef && x.workspace_id === wsId && !x.superseded);
  if (!a) throw new DomainError("VALIDATION", "The funding account was not found in this workspace.");
  return a.account_ref;
}

/** Create a record. Returns the stored row. */
export function createPersonalRecord<T extends PersonalRecordType>(state: DataState, actor: PersonalActor, type: T, raw: unknown): RecordOf<T> {
  requireOwner(actor);
  const ws = requireWorkspace(state, actor);
  const now = nowIso();
  switch (type) {
    case "CASH_ACCOUNT": {
      const w = parseRecordInput("CASH_ACCOUNT", raw) as CashAccountWrite;
      const ref = newId("cash");
      const row: CashAccount = { id: `${ref}_r1`, account_ref: ref, workspace_id: ws.id, label: w.label, kind: w.kind, balance: money(w.balance), currency: "USD", balance_as_of: w.balance_as_of, liquid: w.liquid ?? LIQUID_KINDS.has(w.kind), data_state: "USER_REPORTED", revision: 1, supersedes_id: null, superseded: false, created_at: now };
      state.cash_accounts.push(row);
      log(state, actor, type, ref, "CREATE", null, row);
      return row as RecordOf<T>;
    }
    case "INCOME_STREAM": {
      const w = parseRecordInput("INCOME_STREAM", raw) as IncomeStreamWrite;
      const row: IncomeStream = { id: newId("inc"), workspace_id: ws.id, label: w.label, kind: w.kind, cadence: w.cadence, reliability: w.reliability, observed_monthly_amounts: w.observed_monthly_amounts.map(money), observed_from: w.observed_from ?? null, observed_to: w.observed_to ?? null, expected_amount: moneyOrNull(w.expected_amount), next_expected_date: w.next_expected_date ?? null, data_state: w.observed_monthly_amounts.length ? "USER_REPORTED" : "MISSING", retired: false };
      state.income_streams.push(row);
      log(state, actor, type, row.id, "CREATE", null, row);
      return row as RecordOf<T>;
    }
    case "OBLIGATION": {
      const w = parseRecordInput("OBLIGATION", raw) as ObligationWrite;
      const row: RecurringObligation = { id: newId("obl"), workspace_id: ws.id, label: w.label, category: w.category, amount: money(w.amount), cadence: w.cadence, next_due_date: w.next_due_date, essential: w.essential, liability_id: requireLiabilityInWorkspace(state, ws.id, w.liability_id), data_state: "USER_REPORTED", retired: false };
      state.recurring_obligations.push(row);
      log(state, actor, type, row.id, "CREATE", null, row);
      return row as RecordOf<T>;
    }
    case "VARIABLE_SPENDING": {
      const w = parseRecordInput("VARIABLE_SPENDING", raw) as VariableSpendingWrite;
      if (state.variable_spending.some((v) => v.workspace_id === ws.id && !v.retired && v.category.toLowerCase() === w.category.toLowerCase())) throw new DomainError("VALIDATION", "A spending category with that name already exists; edit it instead.");
      const row: VariableSpendingPattern = { id: newId("vsp"), workspace_id: ws.id, category: w.category, observed_monthly_amounts: w.observed_monthly_amounts.map(money), essential: w.essential, transfers_excluded: w.transfers_excluded, data_state: w.observed_monthly_amounts.length ? "USER_REPORTED" : "MISSING", retired: false };
      state.variable_spending.push(row);
      log(state, actor, type, row.id, "CREATE", null, row);
      return row as RecordOf<T>;
    }
    case "LIABILITY": {
      const w = parseRecordInput("LIABILITY", raw) as LiabilityWrite;
      const row: Liability = { id: newId("liab"), workspace_id: ws.id, label: w.label, kind: w.kind, balance: money(w.balance), balance_as_of: w.balance_as_of, apr_percent: w.apr_percent, minimum_payment: money(w.minimum_payment), rate_type: w.rate_type, promo_apr_percent: w.promo_apr_percent ?? null, promo_apr_expires: w.promo_apr_expires ?? null, due_day_of_month: w.due_day_of_month ?? null, data_state: "USER_REPORTED", retired: false };
      state.liabilities.push(row);
      log(state, actor, type, row.id, "CREATE", null, row);
      return row as RecordOf<T>;
    }
    case "GOAL": {
      const w = parseRecordInput("GOAL", raw) as GoalWrite;
      const row: SavingsGoal = { id: newId("goal"), workspace_id: ws.id, label: w.label, kind: w.kind, target_amount: money(w.target_amount), saved_amount: money(w.saved_amount), target_date: w.target_date ?? null, monthly_contribution: moneyOrNull(w.monthly_contribution), funded_from_account_id: requireAccountInWorkspace(state, ws.id, w.funded_from_account_id), retired: false };
      state.savings_goals.push(row);
      log(state, actor, type, row.id, "CREATE", null, row);
      return row as RecordOf<T>;
    }
  }
  throw new DomainError("VALIDATION", "Unknown record type.");
}

function findLive(state: DataState, wsId: string, type: PersonalRecordType, ref: string) {
  if (type === "CASH_ACCOUNT") return state.cash_accounts.find((a) => a.account_ref === ref && a.workspace_id === wsId && !a.superseded) ?? null;
  const row = (collection(state, type) as Array<{ id: string; workspace_id: string; retired: boolean }>).find((r) => r.id === ref && r.workspace_id === wsId && !r.retired);
  return row ?? null;
}

/** Update a record in full (the form always posts every field). Cash accounts get a new revision row; the others are revised in place and logged. */
export function updatePersonalRecord<T extends PersonalRecordType>(state: DataState, actor: PersonalActor, type: T, ref: string, raw: unknown): RecordOf<T> {
  requireOwner(actor);
  const ws = requireWorkspace(state, actor);
  const live = findLive(state, ws.id, type, ref);
  if (!live) throw new DomainError("NOT_FOUND", "Record not found", 404);
  const before = structuredClone(live);
  switch (type) {
    case "CASH_ACCOUNT": {
      const w = parseRecordInput("CASH_ACCOUNT", raw) as CashAccountWrite;
      const cur = live as CashAccount;
      cur.superseded = true;
      const next: CashAccount = { ...cur, id: newId("cash"), label: w.label, kind: w.kind, balance: money(w.balance), balance_as_of: w.balance_as_of, liquid: w.liquid ?? LIQUID_KINDS.has(w.kind), data_state: "USER_REPORTED", revision: cur.revision + 1, supersedes_id: cur.id, superseded: false, created_at: nowIso() };
      state.cash_accounts.push(next);
      log(state, actor, type, cur.account_ref, "UPDATE", before, next);
      return next as RecordOf<T>;
    }
    case "INCOME_STREAM": {
      const w = parseRecordInput("INCOME_STREAM", raw) as IncomeStreamWrite;
      const cur = live as IncomeStream;
      Object.assign(cur, { label: w.label, kind: w.kind, cadence: w.cadence, reliability: w.reliability, observed_monthly_amounts: w.observed_monthly_amounts.map(money), observed_from: w.observed_from ?? null, observed_to: w.observed_to ?? null, expected_amount: moneyOrNull(w.expected_amount), next_expected_date: w.next_expected_date ?? null, data_state: w.observed_monthly_amounts.length ? "USER_REPORTED" : "MISSING" });
      log(state, actor, type, cur.id, "UPDATE", before, cur);
      return cur as RecordOf<T>;
    }
    case "OBLIGATION": {
      const w = parseRecordInput("OBLIGATION", raw) as ObligationWrite;
      const cur = live as RecurringObligation;
      Object.assign(cur, { label: w.label, category: w.category, amount: money(w.amount), cadence: w.cadence, next_due_date: w.next_due_date, essential: w.essential, liability_id: requireLiabilityInWorkspace(state, ws.id, w.liability_id), data_state: "USER_REPORTED" });
      log(state, actor, type, cur.id, "UPDATE", before, cur);
      return cur as RecordOf<T>;
    }
    case "VARIABLE_SPENDING": {
      const w = parseRecordInput("VARIABLE_SPENDING", raw) as VariableSpendingWrite;
      const cur = live as VariableSpendingPattern;
      Object.assign(cur, { category: w.category, observed_monthly_amounts: w.observed_monthly_amounts.map(money), essential: w.essential, transfers_excluded: w.transfers_excluded, data_state: w.observed_monthly_amounts.length ? "USER_REPORTED" : "MISSING" });
      log(state, actor, type, cur.id, "UPDATE", before, cur);
      return cur as RecordOf<T>;
    }
    case "LIABILITY": {
      const w = parseRecordInput("LIABILITY", raw) as LiabilityWrite;
      const cur = live as Liability;
      Object.assign(cur, { label: w.label, kind: w.kind, balance: money(w.balance), balance_as_of: w.balance_as_of, apr_percent: w.apr_percent, minimum_payment: money(w.minimum_payment), rate_type: w.rate_type, promo_apr_percent: w.promo_apr_percent ?? null, promo_apr_expires: w.promo_apr_expires ?? null, due_day_of_month: w.due_day_of_month ?? null, data_state: "USER_REPORTED" });
      log(state, actor, type, cur.id, "UPDATE", before, cur);
      return cur as RecordOf<T>;
    }
    case "GOAL": {
      const w = parseRecordInput("GOAL", raw) as GoalWrite;
      const cur = live as SavingsGoal;
      Object.assign(cur, { label: w.label, kind: w.kind, target_amount: money(w.target_amount), saved_amount: money(w.saved_amount), target_date: w.target_date ?? null, monthly_contribution: moneyOrNull(w.monthly_contribution), funded_from_account_id: requireAccountInWorkspace(state, ws.id, w.funded_from_account_id) });
      log(state, actor, type, cur.id, "UPDATE", before, cur);
      return cur as RecordOf<T>;
    }
  }
  throw new DomainError("VALIDATION", "Unknown record type.");
}

/**
 * Retire a record (never delete). Retiring a debt also retires the payment
 * obligations linked to it, each logged separately, so the baseline does not
 * keep charging a minimum for a debt that no longer exists.
 */
export function retirePersonalRecord(state: DataState, actor: PersonalActor, type: PersonalRecordType, ref: string): { retired: string[] } {
  requireOwner(actor);
  const ws = requireWorkspace(state, actor);
  const live = findLive(state, ws.id, type, ref);
  if (!live) throw new DomainError("NOT_FOUND", "Record not found", 404);
  const retired: string[] = [];
  if (type === "CASH_ACCOUNT") {
    const cur = live as CashAccount;
    const funded = state.savings_goals.filter((g) => g.workspace_id === ws.id && !g.retired && g.funded_from_account_id === cur.account_ref);
    for (const g of funded) {
      const before = structuredClone(g);
      g.funded_from_account_id = null;
      log(state, actor, "GOAL", g.id, "UPDATE", before, g);
    }
    const before = structuredClone(cur);
    cur.superseded = true; // no successor row: the account_ref has no live revision, which is how a cash account is retired
    log(state, actor, type, cur.account_ref, "RETIRE", before, null);
    retired.push(cur.account_ref);
    return { retired };
  }
  if (type === "LIABILITY") {
    for (const o of state.recurring_obligations.filter((x) => x.workspace_id === ws.id && !x.retired && x.liability_id === ref)) {
      const before = structuredClone(o);
      o.retired = true;
      log(state, actor, "OBLIGATION", o.id, "RETIRE", before, null);
      retired.push(o.id);
    }
  }
  const row = live as { id: string; retired: boolean };
  const before = structuredClone(row);
  row.retired = true;
  log(state, actor, type, row.id, "RETIRE", before, null);
  retired.push(row.id);
  return { retired };
}
