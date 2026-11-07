import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEMO_STATE_VERSION,
  normalizeMoney,
  type CashAccount,
  type ConsentGrant,
  type DataState,
  type IncomeStream,
  type Liability,
  type PersonalProfile,
  type PersonalCalcRun,
  type PersonalRecordRevision,
  type PersonalSnapshot,
  type Principal,
  type RetirementIntake,
  type RecurringObligation,
  type SavingsGoal,
  type UserDecisionEvent,
  type VariableSpendingPattern,
  type Workspace,
  type WorkspaceMembership,
} from "@sagespan/contracts";
import type { PersonalActor } from "@/auth/personal-actor";
import { NotFoundError } from "@/auth/types";
import { DomainError } from "../errors";
import { personalBundle, type PersonalBundle } from "./queries";

/**
 * DATA-001 — the Supabase-backed repository for ONE personal / household workspace.
 *
 * Design: a unit of work over the workspace's slice of the schema. `load()` reads every
 * row the signed-in user may see (PostgREST, the user's own JWT, RLS from migration
 * 0008 decides) into a `DataState`-shaped view; the existing, tested domain functions
 * (`records.ts`, `mutations.ts`, `queries.ts`) run unchanged against that view; `mutate()`
 * then diffs the view and persists exactly the rows that were inserted or changed, in
 * foreign-key order, verifying that every write touched one row (an owner-only policy
 * that hides the row makes the write a zero-row no-op, which we refuse to treat as success).
 *
 * Consequences, stated plainly:
 *  - The same validation, ownership rule and revision discipline govern demo and
 *    production: there is one `createPersonalRecord`, not two.
 *  - Ids the domain layer generates (`cash_…`) are remapped to UUIDs at persist time
 *    (uuid columns in 0008). References inside the delta (supersedes_id, liability_id,
 *    record_ref, revision before/after payloads) are remapped together.
 *  - DATA-002: the whole delta is applied by ONE SECURITY DEFINER RPC, `app.apply_personal_changes`,
 *    in a single transaction. The function re-derives the owner from auth.uid(), forces
 *    workspace_id / actor columns, allow-lists tables and columns, and raises on any update
 *    that matches no row — so a failure leaves nothing behind (DATA_WRITE_FAILED, never partial).
 *  - Snapshots, receipted calc runs, user decisions and the retirement intake (0009) are part of
 *    the view, so `runs.ts` / `mutations.ts` work unchanged against production too.
 *  - No money arithmetic. Numeric columns are selected as text (`::text`) so values round-trip
 *    exactly and are normalised with the shared money helper.
 */
type Row = Record<string, unknown>;
const s = (v: unknown): string => (v == null ? "" : String(v));
const sn = (v: unknown): string | null => (v == null ? null : String(v));
const money = (v: unknown): string => normalizeMoney(String(v));
const moneyN = (v: unknown): string | null => (v == null ? null : normalizeMoney(String(v)));
const moneyArr = (v: unknown): string[] => (Array.isArray(v) ? v.map(money) : parsePgTextArray(String(v ?? "{}")).map(money));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `{1200.00,980.50}` → ["1200.00", "980.50"] (numeric[] arrives as a PostgreSQL array literal when cast to text). */
export function parsePgTextArray(literal: string): string[] {
  const t = literal.trim();
  if (t === "" || t === "{}") return [];
  return t
    .replace(/^\{/, "")
    .replace(/\}$/, "")
    .split(",")
    .map((x) => x.replace(/^"|"$/g, "").trim())
    .filter((x) => x.length > 0 && x !== "NULL");
}

// ---------------------------------------------------------------------------------------- row ↔ contract
export const SELECTS = {
  workspaces: "id, kind, label, owner_principal_id, firm_org_id, created_at",
  workspace_memberships: "id, workspace_id, principal_id, role, domains, status, created_at",
  principals: "id, display_name",
  consent_grants: "id, grantor_workspace_id, grantor_principal_id, grantee_principal_id, grantee_org_id, domains, purpose, granted_at, expires_at, revoked_at, revoked_by, retention_note, version",
  personal_profiles: "workspace_id, principal_id, household_size, situation, top_concern, cash_floor::text, buffer_target_months::text, extra_debt_payment_monthly::text, notification_mode, updated_at",
  cash_accounts: "id, account_ref, workspace_id, label, kind, balance::text, currency, balance_as_of, liquid, data_state, revision, supersedes_id, superseded, created_at",
  income_streams: "id, workspace_id, label, kind, cadence, reliability, observed_monthly_amounts::text, observed_from, observed_to, expected_amount::text, next_expected_date, data_state, retired",
  recurring_obligations: "id, workspace_id, label, category, amount::text, cadence, next_due_date, essential, liability_id, data_state, retired",
  variable_spending: "id, workspace_id, category, observed_monthly_amounts::text, essential, transfers_excluded, data_state, retired",
  liabilities: "id, workspace_id, label, kind, balance::text, balance_as_of, apr_percent::text, minimum_payment::text, rate_type, promo_apr_percent::text, promo_apr_expires, due_day_of_month, data_state, retired",
  savings_goals: "id, workspace_id, label, kind, target_amount::text, saved_amount::text, target_date, monthly_contribution::text, funded_from_account_ref, retired",
  personal_record_revisions: "id, workspace_id, record_type, record_ref, revision, change, before, after, changed_by, created_at",
  personal_snapshots: "id, workspace_id, revision, as_of_date, content_sha256, created_at, created_by, status",
  personal_calc_runs: "id, workspace_id, snapshot_id, check_type, request_sha256, request_hash_verified, engine_name, engine_version, method_set_versions, response, run_status, error, executed_at",
  user_decisions: "id, workspace_id, recommendation_id, principal_id, decision, note, created_at",
  retirement_intakes: "workspace_id, current_age, target_retirement_age, annual_retirement_spending::text, retirement_assets_total::text, retirement_assets_as_of, annual_contributions::text, expected_pension_annual::text, social_security_estimate_annual::text, social_security_estimate_source, life_span_low, life_span_high, states, updated_at",
} as const;

export const fromRow = {
  workspace: (r: Row): Workspace => ({ id: s(r.id), kind: s(r.kind) as Workspace["kind"], label: s(r.label), owner_principal_id: sn(r.owner_principal_id), firm_org_id: sn(r.firm_org_id), created_at: s(r.created_at) }),
  membership: (r: Row): WorkspaceMembership => ({ id: s(r.id), workspace_id: s(r.workspace_id), principal_id: s(r.principal_id), role: s(r.role) as WorkspaceMembership["role"], domains: (Array.isArray(r.domains) ? r.domains.map(String) : parsePgTextArray(s(r.domains))) as WorkspaceMembership["domains"], status: s(r.status) as WorkspaceMembership["status"], created_at: s(r.created_at) }),
  principal: (r: Row): Principal => ({ id: s(r.id), display_name: s(r.display_name), simulated: false }),
  grant: (r: Row): ConsentGrant => ({ id: s(r.id), grantor_workspace_id: s(r.grantor_workspace_id), grantor_principal_id: s(r.grantor_principal_id), grantee_principal_id: sn(r.grantee_principal_id), grantee_org_id: sn(r.grantee_org_id), domains: (Array.isArray(r.domains) ? r.domains.map(String) : parsePgTextArray(s(r.domains))) as ConsentGrant["domains"], purpose: s(r.purpose) as ConsentGrant["purpose"], granted_at: s(r.granted_at), expires_at: sn(r.expires_at), revoked_at: sn(r.revoked_at), revoked_by: sn(r.revoked_by), retention_note: sn(r.retention_note), version: Number(r.version ?? 1) }),
  profile: (r: Row): PersonalProfile => ({ workspace_id: s(r.workspace_id), principal_id: s(r.principal_id), household_size: Number(r.household_size), situation: s(r.situation), top_concern: sn(r.top_concern), cash_floor: money(r.cash_floor), buffer_target_months: r.buffer_target_months == null ? null : String(r.buffer_target_months), extra_debt_payment_monthly: money(r.extra_debt_payment_monthly), notification_mode: s(r.notification_mode) as PersonalProfile["notification_mode"], updated_at: s(r.updated_at) }),
  cashAccount: (r: Row): CashAccount => ({ id: s(r.id), account_ref: s(r.account_ref), workspace_id: s(r.workspace_id), label: s(r.label), kind: s(r.kind) as CashAccount["kind"], balance: money(r.balance), currency: s(r.currency || "USD"), balance_as_of: s(r.balance_as_of), liquid: Boolean(r.liquid), data_state: s(r.data_state) as CashAccount["data_state"], revision: Number(r.revision), supersedes_id: sn(r.supersedes_id), superseded: Boolean(r.superseded), created_at: s(r.created_at) }),
  incomeStream: (r: Row): IncomeStream => ({ id: s(r.id), workspace_id: s(r.workspace_id), label: s(r.label), kind: s(r.kind) as IncomeStream["kind"], cadence: s(r.cadence) as IncomeStream["cadence"], reliability: s(r.reliability) as IncomeStream["reliability"], observed_monthly_amounts: moneyArr(r.observed_monthly_amounts), observed_from: sn(r.observed_from), observed_to: sn(r.observed_to), expected_amount: moneyN(r.expected_amount), next_expected_date: sn(r.next_expected_date), data_state: s(r.data_state) as IncomeStream["data_state"], retired: Boolean(r.retired) }),
  obligation: (r: Row): RecurringObligation => ({ id: s(r.id), workspace_id: s(r.workspace_id), label: s(r.label), category: s(r.category) as RecurringObligation["category"], amount: money(r.amount), cadence: s(r.cadence) as RecurringObligation["cadence"], next_due_date: s(r.next_due_date), essential: Boolean(r.essential), liability_id: sn(r.liability_id), data_state: s(r.data_state) as RecurringObligation["data_state"], retired: Boolean(r.retired) }),
  variableSpending: (r: Row): VariableSpendingPattern => ({ id: s(r.id), workspace_id: s(r.workspace_id), category: s(r.category), observed_monthly_amounts: moneyArr(r.observed_monthly_amounts), essential: Boolean(r.essential), transfers_excluded: Boolean(r.transfers_excluded), data_state: s(r.data_state) as VariableSpendingPattern["data_state"], retired: Boolean(r.retired) }),
  liability: (r: Row): Liability => ({ id: s(r.id), workspace_id: s(r.workspace_id), label: s(r.label), kind: s(r.kind) as Liability["kind"], balance: money(r.balance), balance_as_of: s(r.balance_as_of), apr_percent: String(r.apr_percent), minimum_payment: money(r.minimum_payment), rate_type: s(r.rate_type) as Liability["rate_type"], promo_apr_percent: r.promo_apr_percent == null ? null : String(r.promo_apr_percent), promo_apr_expires: sn(r.promo_apr_expires), due_day_of_month: r.due_day_of_month == null ? null : Number(r.due_day_of_month), data_state: s(r.data_state) as Liability["data_state"], retired: Boolean(r.retired) }),
  goal: (r: Row): SavingsGoal => ({ id: s(r.id), workspace_id: s(r.workspace_id), label: s(r.label), kind: s(r.kind) as SavingsGoal["kind"], target_amount: money(r.target_amount), saved_amount: money(r.saved_amount), target_date: sn(r.target_date), monthly_contribution: moneyN(r.monthly_contribution), funded_from_account_id: sn(r.funded_from_account_ref), retired: Boolean(r.retired) }),
  snapshot: (r: Row): PersonalSnapshot => ({ id: s(r.id), workspace_id: s(r.workspace_id), revision: Number(r.revision), as_of_date: s(r.as_of_date), content_sha256: s(r.content_sha256), created_at: s(r.created_at), created_by: s(r.created_by), status: s(r.status) as PersonalSnapshot["status"] }),
  calcRun: (r: Row): PersonalCalcRun => ({ id: s(r.id), workspace_id: s(r.workspace_id), snapshot_id: s(r.snapshot_id), check_type: s(r.check_type) as PersonalCalcRun["check_type"], request_sha256: s(r.request_sha256), request_hash_verified: Boolean(r.request_hash_verified), engine_name: sn(r.engine_name), engine_version: sn(r.engine_version), method_set_versions: (r.method_set_versions as Record<string, string> | null) ?? {}, response: r.response ?? null, run_status: s(r.run_status) as PersonalCalcRun["run_status"], error: (r.error as PersonalCalcRun["error"]) ?? null, executed_at: s(r.executed_at) }),
  decision: (r: Row): UserDecisionEvent => ({ id: s(r.id), workspace_id: s(r.workspace_id), recommendation_id: s(r.recommendation_id), principal_id: s(r.principal_id), decision: s(r.decision) as UserDecisionEvent["decision"], note: sn(r.note), created_at: s(r.created_at) }),
  retirement: (r: Row): RetirementIntake => ({ workspace_id: s(r.workspace_id), current_age: r.current_age == null ? null : Number(r.current_age), target_retirement_age: r.target_retirement_age == null ? null : Number(r.target_retirement_age), annual_retirement_spending: moneyN(r.annual_retirement_spending), retirement_assets_total: moneyN(r.retirement_assets_total), retirement_assets_as_of: sn(r.retirement_assets_as_of), annual_contributions: moneyN(r.annual_contributions), expected_pension_annual: moneyN(r.expected_pension_annual), social_security_estimate_annual: moneyN(r.social_security_estimate_annual), social_security_estimate_source: sn(r.social_security_estimate_source) as RetirementIntake["social_security_estimate_source"], life_span_range: r.life_span_low == null || r.life_span_high == null ? null : { low: Number(r.life_span_low), high: Number(r.life_span_high) }, states: (r.states as RetirementIntake["states"]) ?? {}, updated_at: s(r.updated_at) }),
  revision: (r: Row): PersonalRecordRevision => ({ id: s(r.id), workspace_id: s(r.workspace_id), record_type: s(r.record_type) as PersonalRecordRevision["record_type"], record_ref: s(r.record_ref), revision: Number(r.revision), change: s(r.change) as PersonalRecordRevision["change"], before: r.before ?? null, after: r.after ?? null, changed_by: s(r.changed_by), created_at: s(r.created_at) }),
};

/** Contract → insertable/updatable row. Only the columns the user may write; defaults and audit columns stay server-side. */
export const toRow = {
  profile: (p: PersonalProfile): Row => ({ household_size: p.household_size, situation: p.situation, top_concern: p.top_concern, cash_floor: p.cash_floor, buffer_target_months: p.buffer_target_months, extra_debt_payment_monthly: p.extra_debt_payment_monthly, notification_mode: p.notification_mode, updated_at: p.updated_at }),
  cashAccount: (a: CashAccount): Row => ({ id: a.id, account_ref: a.account_ref, workspace_id: a.workspace_id, label: a.label, kind: a.kind, balance: a.balance, currency: a.currency, balance_as_of: a.balance_as_of, liquid: a.liquid, data_state: a.data_state, revision: a.revision, supersedes_id: a.supersedes_id, superseded: a.superseded }),
  incomeStream: (r: IncomeStream): Row => ({ id: r.id, workspace_id: r.workspace_id, label: r.label, kind: r.kind, cadence: r.cadence, reliability: r.reliability, observed_monthly_amounts: r.observed_monthly_amounts, observed_from: r.observed_from, observed_to: r.observed_to, expected_amount: r.expected_amount, next_expected_date: r.next_expected_date, data_state: r.data_state, retired: r.retired }),
  obligation: (r: RecurringObligation): Row => ({ id: r.id, workspace_id: r.workspace_id, label: r.label, category: r.category, amount: r.amount, cadence: r.cadence, next_due_date: r.next_due_date, essential: r.essential, liability_id: r.liability_id, data_state: r.data_state, retired: r.retired }),
  variableSpending: (r: VariableSpendingPattern): Row => ({ id: r.id, workspace_id: r.workspace_id, category: r.category, observed_monthly_amounts: r.observed_monthly_amounts, essential: r.essential, transfers_excluded: r.transfers_excluded, data_state: r.data_state, retired: r.retired }),
  liability: (r: Liability): Row => ({ id: r.id, workspace_id: r.workspace_id, label: r.label, kind: r.kind, balance: r.balance, balance_as_of: r.balance_as_of, apr_percent: r.apr_percent, minimum_payment: r.minimum_payment, rate_type: r.rate_type, promo_apr_percent: r.promo_apr_percent, promo_apr_expires: r.promo_apr_expires, due_day_of_month: r.due_day_of_month, data_state: r.data_state, retired: r.retired }),
  goal: (r: SavingsGoal): Row => ({ id: r.id, workspace_id: r.workspace_id, label: r.label, kind: r.kind, target_amount: r.target_amount, saved_amount: r.saved_amount, target_date: r.target_date, monthly_contribution: r.monthly_contribution, funded_from_account_ref: r.funded_from_account_id, retired: r.retired }),
  snapshot: (r: PersonalSnapshot): Row => ({ id: r.id, workspace_id: r.workspace_id, revision: r.revision, as_of_date: r.as_of_date, content_sha256: r.content_sha256, created_by: r.created_by, status: r.status }),
  calcRun: (r: PersonalCalcRun): Row => ({ id: r.id, workspace_id: r.workspace_id, snapshot_id: r.snapshot_id, check_type: r.check_type, request_sha256: r.request_sha256, request_hash_verified: r.request_hash_verified, engine_name: r.engine_name, engine_version: r.engine_version, method_set_versions: r.method_set_versions, response: r.response, run_status: r.run_status, error: r.error }),
  decision: (r: UserDecisionEvent): Row => ({ id: r.id, workspace_id: r.workspace_id, recommendation_id: r.recommendation_id, principal_id: r.principal_id, decision: r.decision, note: r.note }),
  retirement: (r: RetirementIntake): Row => ({ current_age: r.current_age, target_retirement_age: r.target_retirement_age, annual_retirement_spending: r.annual_retirement_spending, retirement_assets_total: r.retirement_assets_total, retirement_assets_as_of: r.retirement_assets_as_of, annual_contributions: r.annual_contributions, expected_pension_annual: r.expected_pension_annual, social_security_estimate_annual: r.social_security_estimate_annual, social_security_estimate_source: r.social_security_estimate_source, life_span_low: r.life_span_range?.low ?? null, life_span_high: r.life_span_range?.high ?? null, states: r.states }),
  revision: (r: PersonalRecordRevision): Row => ({ id: r.id, workspace_id: r.workspace_id, record_type: r.record_type, record_ref: r.record_ref, revision: r.revision, change: r.change, before: r.before, after: r.after, changed_by: r.changed_by }),
};

/** A DataState with every collection empty: the shape the personal domain functions expect, holding one workspace's rows. */
export function emptyView(): DataState {
  return {
    state_version: DEMO_STATE_VERSION,
    seeded_at: "",
    mode: "DEMO_SYNTHETIC", // type-level only: this view is loaded from Supabase, never seeded
    organizations: [], profiles: [], memberships: [], households: [], persons: [], accounts: [], account_ownership: [], beneficiary_designations: [], source_documents: [], source_locations: [], facts: [], fact_conflicts: [], assumption_sets: [], assumptions: [], plan_imports: [], imported_plan_values: [], snapshots: [], check_runs: [], discrepancies: [], reviews: [], review_comments: [], evidence_packets: [], audit_events: [], pilot_interest: [],
    principals: [], workspaces: [], workspace_memberships: [], consent_grants: [],
    personal_profiles: [], cash_accounts: [], income_streams: [], recurring_obligations: [], variable_spending: [], liabilities: [], savings_goals: [], retirement_intakes: [], personal_snapshots: [], personal_calc_runs: [], user_decisions: [], personal_record_revisions: [],
    ai_runs: [], ai_feedback: [],
  };
}

type Table = "cash_accounts" | "income_streams" | "recurring_obligations" | "variable_spending" | "liabilities" | "savings_goals" | "personal_record_revisions" | "personal_snapshots" | "personal_calc_runs" | "user_decisions";
/** Parents before children: cash accounts (self-FK supersedes_id) and liabilities (obligations.liability_id) first; snapshots before runs; revisions last. */
const INSERT_ORDER: Table[] = ["cash_accounts", "liabilities", "income_streams", "recurring_obligations", "variable_spending", "savings_goals", "personal_snapshots", "personal_calc_runs", "user_decisions", "personal_record_revisions"];
const TO_ROW: Record<Table, (r: never) => Row> = {
  cash_accounts: toRow.cashAccount as (r: never) => Row,
  income_streams: toRow.incomeStream as (r: never) => Row,
  recurring_obligations: toRow.obligation as (r: never) => Row,
  variable_spending: toRow.variableSpending as (r: never) => Row,
  liabilities: toRow.liability as (r: never) => Row,
  savings_goals: toRow.goal as (r: never) => Row,
  personal_record_revisions: toRow.revision as (r: never) => Row,
  personal_snapshots: toRow.snapshot as (r: never) => Row,
  personal_calc_runs: toRow.calcRun as (r: never) => Row,
  user_decisions: toRow.decision as (r: never) => Row,
};

export interface PersistPlan {
  inserts: Array<{ table: Table; rows: Row[] }>;
  updates: Array<{ table: Table; id: string; row: Row }>;
  profile: Row | null;
  /** retirement intake upsert (single row per workspace) */
  retirement: Row | null;
  /** domain-generated id → uuid, applied to the whole delta */
  idMap: Record<string, string>;
}

/** Pure: compute what changed between two views of the same workspace. Exported for unit tests. */
export function planPersist(before: DataState, after: DataState, newUuid: () => string = () => crypto.randomUUID()): PersistPlan {
  const idMap: Record<string, string> = {};
  const collect = (rows: Array<{ id: string }>) => {
    for (const r of rows) if (!UUID.test(r.id)) idMap[r.id] ??= newUuid();
  };
  for (const t of INSERT_ORDER) collect(after[t] as Array<{ id: string }>);
  for (const a of after.cash_accounts) if (!UUID.test(a.account_ref)) idMap[a.account_ref] ??= newUuid();

  const remap = <T>(v: T): T => {
    if (Object.keys(idMap).length === 0) return v;
    let text = JSON.stringify(v);
    for (const [from, to] of Object.entries(idMap)) text = text.split(`"${from}"`).join(`"${to}"`);
    return JSON.parse(text) as T;
  };

  const inserts: PersistPlan["inserts"] = [];
  const updates: PersistPlan["updates"] = [];
  for (const t of INSERT_ORDER) {
    const prev = new Map((before[t] as Array<{ id: string }>).map((r) => [r.id, JSON.stringify(r)]));
    const newRows: Row[] = [];
    for (const r of after[t] as Array<{ id: string }>) {
      const was = prev.get(r.id);
      const row = TO_ROW[t](remap(r) as never);
      if (was === undefined) newRows.push(row);
      else if (was !== JSON.stringify(r)) updates.push({ table: t, id: r.id, row: t === "personal_snapshots" ? { status: row.status } : row });
    }
    if (newRows.length) {
      // self-referencing cash accounts: a row whose supersedes_id is also new must come after its parent
      if (t === "cash_accounts") newRows.sort((a, b) => (a.supersedes_id && newRows.some((x) => x.id === a.supersedes_id) ? 1 : 0) - (b.supersedes_id && newRows.some((x) => x.id === b.supersedes_id) ? 1 : 0));
      inserts.push({ table: t, rows: newRows });
    }
  }
  const p0 = before.personal_profiles[0];
  const p1 = after.personal_profiles[0];
  const profile = p0 && p1 && JSON.stringify(p0) !== JSON.stringify(p1) ? toRow.profile(p1) : null;
  const r0 = before.retirement_intakes[0];
  const r1 = after.retirement_intakes[0];
  const retirement = r1 && (!r0 || JSON.stringify(r0) !== JSON.stringify(r1)) ? toRow.retirement(r1) : null;
  return { inserts, updates, profile, retirement, idMap };
}

export class SupabasePersonalRepository {
  constructor(
    private readonly client: SupabaseClient,
    readonly actor: PersonalActor,
  ) {}

  private app() {
    return this.client.schema("app");
  }

  private async rows(table: string, select: string, filter: Record<string, string>): Promise<Row[]> {
    let q = this.app().from(table).select(select);
    for (const [k, v] of Object.entries(filter)) q = q.eq(k, v);
    const { data, error } = await q;
    if (error) throw new DomainError("DATA_READ_FAILED", `${table}: ${error.message}`, 502);
    return (data ?? []) as unknown as Row[];
  }

  /** Everything the caller may see of this workspace, as a DataState-shaped view. RLS decides the rows; we only filter. */
  async load(): Promise<DataState> {
    const ws = this.actor.workspace_id;
    const [workspaces, memberships, grants, profiles, cash, income, obligations, variable, liabilities, goals, revisions, snapshots, runs, decisions, retirement] = await Promise.all([
      this.rows("workspaces", SELECTS.workspaces, { id: ws }),
      this.rows("workspace_memberships", SELECTS.workspace_memberships, { workspace_id: ws }),
      this.rows("consent_grants", SELECTS.consent_grants, { grantor_workspace_id: ws }),
      this.rows("personal_profiles", SELECTS.personal_profiles, { workspace_id: ws }),
      this.rows("cash_accounts", SELECTS.cash_accounts, { workspace_id: ws }),
      this.rows("income_streams", SELECTS.income_streams, { workspace_id: ws }),
      this.rows("recurring_obligations", SELECTS.recurring_obligations, { workspace_id: ws }),
      this.rows("variable_spending", SELECTS.variable_spending, { workspace_id: ws }),
      this.rows("liabilities", SELECTS.liabilities, { workspace_id: ws }),
      this.rows("savings_goals", SELECTS.savings_goals, { workspace_id: ws }),
      this.rows("personal_record_revisions", SELECTS.personal_record_revisions, { workspace_id: ws }),
      this.rows("personal_snapshots", SELECTS.personal_snapshots, { workspace_id: ws }),
      this.rows("personal_calc_runs", SELECTS.personal_calc_runs, { workspace_id: ws }),
      this.rows("user_decisions", SELECTS.user_decisions, { workspace_id: ws }),
      this.rows("retirement_intakes", SELECTS.retirement_intakes, { workspace_id: ws }),
    ]);
    if (workspaces.length === 0) throw new NotFoundError();
    const view = emptyView();
    view.workspaces = workspaces.map(fromRow.workspace);
    view.workspace_memberships = memberships.map(fromRow.membership);
    view.consent_grants = grants.map(fromRow.grant);
    view.personal_profiles = profiles.map(fromRow.profile);
    view.cash_accounts = cash.map(fromRow.cashAccount);
    view.income_streams = income.map(fromRow.incomeStream);
    view.recurring_obligations = obligations.map(fromRow.obligation);
    view.variable_spending = variable.map(fromRow.variableSpending);
    view.liabilities = liabilities.map(fromRow.liability);
    view.savings_goals = goals.map(fromRow.goal);
    view.personal_record_revisions = revisions.map(fromRow.revision);
    view.personal_snapshots = snapshots.map(fromRow.snapshot);
    view.personal_calc_runs = runs.map(fromRow.calcRun);
    view.user_decisions = decisions.map(fromRow.decision);
    view.retirement_intakes = retirement.map(fromRow.retirement);
    // principals visible to the caller (RLS: self + co-members + grant counterparties)
    const ids = Array.from(new Set(view.workspace_memberships.map((m) => m.principal_id)));
    if (ids.length) {
      const { data } = await this.app().from("principals").select(SELECTS.principals).in("id", ids);
      view.principals = ((data ?? []) as Row[]).map(fromRow.principal);
    }
    return view;
  }

  async bundle(): Promise<PersonalBundle> {
    return personalBundle(await this.load(), this.actor);
  }

  /** Load → run the (synchronous, already-tested) domain mutation → persist the delta. */
  async mutate<T>(fn: (view: DataState) => T): Promise<T> {
    const view = await this.load();
    const before = structuredClone(view);
    const result = fn(view);
    const plan = planPersist(before, view);
    await this.persist(plan);
    return plan.idMap && typeof result === "object" && result !== null ? remapResult(result, plan.idMap) : result;
  }

  /** One RPC, one transaction: app.apply_personal_changes re-derives the owner and applies the whole plan or nothing. */
  private async persist(plan: PersistPlan): Promise<void> {
    if (!plan.profile && !plan.retirement && plan.updates.length === 0 && plan.inserts.length === 0) return;
    const { error } = await this.app().rpc("apply_personal_changes", {
      p_workspace: this.actor.workspace_id,
      p_plan: {
        profile: plan.profile,
        retirement: plan.retirement,
        updates: plan.updates.map((u) => ({ table: u.table, id: u.id, row: u.row })),
        inserts: plan.inserts.map((i) => ({ table: i.table, rows: i.rows })),
      },
    });
    if (error) {
      // SQLSTATE → domain code. P0002 is the database's non-disclosing "not yours"; 23xxx are the shape constraints.
      const code = error.code === "P0002" ? "NOT_FOUND" : error.code === "42501" ? "PERMISSION_DENIED" : error.code?.startsWith("23") ? "VALIDATION" : "DATA_WRITE_FAILED";
      throw new DomainError(code, `Nothing was saved: ${error.message}`, code === "NOT_FOUND" ? 404 : code === "PERMISSION_DENIED" ? 403 : code === "VALIDATION" ? 400 : 502);
    }
  }
}

function remapResult<T>(result: T, idMap: Record<string, string>): T {
  let text = JSON.stringify(result);
  for (const [from, to] of Object.entries(idMap)) text = text.split(`"${from}"`).join(`"${to}"`);
  return JSON.parse(text) as T;
}
