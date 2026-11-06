import { canonicalHash, type DebtPathsRequest, type PersonalClarityRequest, type PersonalScenarioRequest, type PersonalSnapshot, type ScenarioSpec } from "@sagespan/contracts";
import type { PersonalActor } from "@/auth/personal-actor";
import { newId, nowIso } from "../ids";
import type { PersonalBundle } from "./queries";

/**
 * The engines are called from a dated personal snapshot, never from whatever the
 * UI happens to show. The snapshot content is the canonical clarity request
 * (refs = record ids), so a receipt's request_hash is reproducible from the
 * snapshot alone and a changed input produces a new revision.
 */
export function asOfDate(b: PersonalBundle, today: () => string = () => new Date().toISOString().slice(0, 10)): string {
  // Latest balance date across cash accounts; otherwise the earliest obligation date; otherwise today, so a fresh
  // workspace with no records yet still gets a dated (INSUFFICIENT_DATA) baseline instead of a fixed past date.
  const dates = b.cashAccounts.map((a) => a.balance_as_of).sort();
  return dates[dates.length - 1] ?? b.obligations.map((o) => o.next_due_date).sort()[0] ?? today();
}

export function buildClarityRequest(b: PersonalBundle): PersonalClarityRequest {
  return {
    schema_version: "sagespan.personal-clarity.v1",
    as_of_date: asOfDate(b),
    horizon_days: 90,
    policy: { cash_floor: b.profile.cash_floor, buffer_target_months: b.profile.buffer_target_months },
    cash_accounts: b.cashAccounts.map((a) => ({ account_ref: a.account_ref, label: a.label, balance: a.balance, currency: a.currency, balance_as_of: a.balance_as_of, liquid: a.liquid, data_state: a.data_state })),
    income_streams: b.incomeStreams.map((s) => ({ stream_ref: s.id, label: s.label, kind: s.kind, cadence: s.cadence, reliability: s.reliability, observed_monthly_amounts: s.observed_monthly_amounts, expected_amount: s.expected_amount, next_expected_date: s.next_expected_date, data_state: s.data_state })),
    obligations: b.obligations.map((o) => ({ obligation_ref: o.id, label: o.label, category: o.category, amount: o.amount, cadence: o.cadence, next_due_date: o.next_due_date, essential: o.essential, liability_ref: o.liability_id, data_state: o.data_state })),
    variable_spending: b.variableSpending.map((v) => ({ category: v.category, observed_monthly_amounts: v.observed_monthly_amounts, essential: v.essential, data_state: v.data_state })),
    liabilities: b.liabilities.map((l) => ({ liability_ref: l.id, label: l.label, balance: l.balance, apr_percent: l.apr_percent, minimum_payment: l.minimum_payment, rate_type: l.rate_type, promo_apr_percent: l.promo_apr_percent, promo_apr_expires: l.promo_apr_expires, due_day_of_month: l.due_day_of_month, data_state: l.data_state })),
    goals: b.goals.map((g) => ({ goal_ref: g.id, label: g.label, target_amount: g.target_amount, saved_amount: g.saved_amount, target_date: g.target_date, monthly_contribution: g.monthly_contribution })),
    workspace_ref: b.workspace.id,
    input_hash: null,
  };
}

export function buildDebtPathsRequest(b: PersonalBundle, inputHash: string): DebtPathsRequest | null {
  if (b.liabilities.length === 0) return null;
  return {
    schema_version: "sagespan.debt-paths.v1",
    as_of_date: asOfDate(b),
    liabilities: b.liabilities.map((l) => ({ liability_ref: l.id, label: l.label, balance: l.balance, apr_percent: l.apr_percent, minimum_payment: l.minimum_payment, rate_type: l.rate_type, promo_apr_percent: l.promo_apr_percent, promo_apr_expires: l.promo_apr_expires, due_day_of_month: l.due_day_of_month, data_state: l.data_state })),
    monthly_debt_budget: null,
    extra_monthly_payment: b.profile.extra_debt_payment_monthly,
    policy: { cash_floor: b.profile.cash_floor, buffer_target_months: b.profile.buffer_target_months },
    liquid_cash: null,
    cash_accounts: b.cashAccounts.map((a) => ({ account_ref: a.account_ref, label: a.label, balance: a.balance, currency: a.currency, balance_as_of: a.balance_as_of, liquid: a.liquid, data_state: a.data_state })),
    strategies: ["MINIMUMS_ONLY", "AVALANCHE", "SNOWBALL", "HYBRID"],
    max_months: 600,
    workspace_ref: b.workspace.id,
    input_hash: inputHash,
  };
}

/** A what-if request: the snapshot's clarity request as the baseline plus one validated scenario spec. */
export function buildScenarioRequest(b: PersonalBundle, spec: ScenarioSpec, inputHash: string): PersonalScenarioRequest {
  // Every spec field is sent explicitly (null when unused) so the request canonicalises to the same bytes the
  // service hashes from its own model dump; otherwise the receipt's request_hash could never be re-derived here.
  const full: ScenarioSpec = {
    kind: spec.kind,
    monthly_amount: spec.monthly_amount ?? null,
    goal_ref: spec.goal_ref ?? null,
    destination: spec.kind === "SAVINGS_CHANGE" ? (spec.destination ?? "LIQUID") : null,
    stream_ref: spec.stream_ref ?? null,
    months: spec.months ?? null,
    start_date: spec.start_date ?? null,
  };
  return {
    schema_version: "sagespan.personal-scenario.v1",
    baseline: { ...buildClarityRequest(b), input_hash: inputHash },
    scenario: full,
    workspace_ref: b.workspace.id,
    input_hash: inputHash,
  };
}

/** Content hash of the snapshot = canonical hash of the clarity request with input_hash cleared. */
export async function snapshotContentHash(req: PersonalClarityRequest): Promise<string> {
  return canonicalHash({ ...req, input_hash: null });
}

/**
 * Ensure the CURRENT snapshot matches the live personal records. If the content
 * hash changed, the previous snapshot is marked SUPERSEDED (kept as history) and
 * a new revision is created. Returns the snapshot and whether it is new.
 */
export async function ensureCurrentSnapshot(b: PersonalBundle, actor: PersonalActor, state: { personal_snapshots: PersonalSnapshot[] }): Promise<{ snapshot: PersonalSnapshot; created: boolean; request: PersonalClarityRequest }> {
  const request = buildClarityRequest(b);
  const hash = await snapshotContentHash(request);
  const current = b.currentSnapshot;
  if (current && current.content_sha256 === hash) return { snapshot: current, created: false, request: { ...request, input_hash: hash } };
  if (current) {
    const stored = state.personal_snapshots.find((s) => s.id === current.id);
    if (stored) stored.status = "SUPERSEDED";
  }
  const snapshot: PersonalSnapshot = {
    id: newId("psnap"),
    workspace_id: b.workspace.id,
    revision: (b.snapshots[0]?.revision ?? 0) + 1,
    as_of_date: request.as_of_date,
    content_sha256: hash,
    created_at: nowIso(),
    created_by: actor.principal_id,
    status: "CURRENT",
  };
  state.personal_snapshots.push(snapshot);
  return { snapshot, created: true, request: { ...request, input_hash: hash } };
}
