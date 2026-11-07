/**
 * DATA-001 — the Supabase repository is a unit of work over a workspace view. These tests
 * drive the REAL domain functions (records.ts / mutations.ts) against the view and check
 * the persist plan the repository derives: which rows are inserted or updated, in what
 * order, with domain ids remapped to UUIDs everywhere they appear. A second group runs
 * the repository against a mocked PostgREST builder to verify filters, `::text` casts,
 * write verification and the partial-write error path. The real-stack counterpart is
 * `supabase-record-store.realstack.test.ts` (CI only).
 */
import { describe, expect, it } from "vitest";
import type { DataState } from "@sagespan/contracts";
import type { PersonalActor } from "@/auth/personal-actor";
import { DomainError } from "@/domain/errors";
import { updatePersonalPolicy } from "@/domain/personal/mutations";
import { createPersonalRecord, retirePersonalRecord, updatePersonalRecord } from "@/domain/personal/records";
import { emptyView, fromRow, parsePgTextArray, planPersist, SELECTS, SupabasePersonalRepository } from "@/domain/personal/supabase-repository";

const WS = "11111111-1111-4111-8111-111111111111";
const ANA = "22222222-2222-4222-8222-222222222222";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACTOR: PersonalActor = { scope: "PERSONAL", principal_id: ANA, workspace_id: WS, workspace_role: "OWNER", domains: [], display_name: "Ana", mode: "PRODUCTION", actor_type: "USER" };

function seededView(): DataState {
  const v = emptyView();
  v.workspaces.push({ id: WS, kind: "PERSONAL", label: "Ana", owner_principal_id: ANA, firm_org_id: null, created_at: "2026-11-01T00:00:00Z" });
  v.workspace_memberships.push({ id: "33333333-3333-4333-8333-333333333333", workspace_id: WS, principal_id: ANA, role: "OWNER", domains: [], status: "ACTIVE", created_at: "2026-11-01T00:00:00Z" });
  v.principals.push({ id: ANA, display_name: "Ana", simulated: false });
  v.personal_profiles.push({ workspace_id: WS, principal_id: ANA, household_size: 1, situation: "", top_concern: null, cash_floor: "1500.00", buffer_target_months: "3", extra_debt_payment_monthly: "0.00", notification_mode: "NORMAL", updated_at: "2026-11-01T00:00:00Z" });
  v.liabilities.push({ id: "44444444-4444-4444-8444-444444444444", workspace_id: WS, label: "Card", kind: "CREDIT_CARD", balance: "1800.00", balance_as_of: "2026-10-31", apr_percent: "24.990", minimum_payment: "55.00", rate_type: "FIXED", promo_apr_percent: null, promo_apr_expires: null, due_day_of_month: null, data_state: "USER_REPORTED", retired: false });
  v.recurring_obligations.push({ id: "55555555-5555-4555-8555-555555555555", workspace_id: WS, label: "Card minimum", category: "DEBT_MINIMUM", amount: "55.00", cadence: "MONTHLY", next_due_date: "2026-11-15", essential: true, liability_id: "44444444-4444-4444-8444-444444444444", data_state: "USER_REPORTED", retired: false });
  return v;
}

describe("planPersist (unit of work over the workspace view)", () => {
  it("a created cash account becomes one insert with UUID ids, plus one CREATE revision whose record_ref and payload are remapped", () => {
    const view = seededView();
    const before = structuredClone(view);
    const row = createPersonalRecord(view, ACTOR, "CASH_ACCOUNT", { label: "Checking", kind: "CHECKING", balance: "3200", balance_as_of: "2026-10-31" });
    expect(row.id).toMatch(/^cash_/); // the domain layer's own id scheme…
    const plan = planPersist(before, view, () => "99999999-9999-4999-8999-999999999999".replace("9999-4999", `${Math.random().toString(16).slice(2, 6)}-4999`));
    expect(plan.updates).toEqual([]);
    expect(plan.profile).toBeNull();
    expect(plan.inserts.map((i) => i.table)).toEqual(["cash_accounts", "personal_record_revisions"]);
    const cash = plan.inserts[0]!.rows[0]!;
    expect(String(cash.id)).toMatch(UUID); // …remapped to the uuid columns of 0008
    expect(String(cash.account_ref)).toMatch(UUID);
    expect(cash.balance).toBe("3200.00");
    expect(cash.workspace_id).toBe(WS);
    const rev = plan.inserts[1]!.rows[0]!;
    expect(rev.record_ref).toBe(cash.account_ref);
    expect(rev.change).toBe("CREATE");
    expect(rev.changed_by).toBe(ANA);
    expect((rev.after as { id: string }).id).toBe(cash.id); // ids inside the JSON payload follow the remap
    expect(Object.keys(plan.idMap)).toHaveLength(3); // id, account_ref, revision id
  });

  it("updating a cash account marks the old row superseded (update) and inserts the successor with supersedes_id pointing at the real uuid", () => {
    const view = seededView();
    const OLD = "66666666-6666-4666-8666-666666666666";
    const REF = "77777777-7777-4777-8777-777777777777";
    view.cash_accounts.push({ id: OLD, account_ref: REF, workspace_id: WS, label: "Checking", kind: "CHECKING", balance: "3200.00", currency: "USD", balance_as_of: "2026-10-31", liquid: true, data_state: "USER_REPORTED", revision: 1, supersedes_id: null, superseded: false, created_at: "2026-11-01T00:00:00Z" });
    const before = structuredClone(view);
    updatePersonalRecord(view, ACTOR, "CASH_ACCOUNT", REF, { label: "Checking", kind: "CHECKING", balance: "2900.10", balance_as_of: "2026-11-05" });
    const plan = planPersist(before, view);
    expect(plan.updates).toHaveLength(1);
    expect(plan.updates[0]).toMatchObject({ table: "cash_accounts", id: OLD });
    expect(plan.updates[0]!.row.superseded).toBe(true);
    const ins = plan.inserts.find((i) => i.table === "cash_accounts")!.rows[0]!;
    expect(ins.supersedes_id).toBe(OLD);
    expect(ins.account_ref).toBe(REF); // the engine ref is stable across revisions
    expect(ins.revision).toBe(2);
    expect(ins.balance).toBe("2900.10");
    const rev = plan.inserts.find((i) => i.table === "personal_record_revisions")!.rows[0]!;
    expect(rev.change).toBe("UPDATE");
    expect((rev.before as { id: string }).id).toBe(OLD);
  });

  it("retiring a debt updates the debt and its linked payment (both in place) and logs two RETIRE revisions; liabilities are ordered before obligations", () => {
    const view = seededView();
    const before = structuredClone(view);
    const out = retirePersonalRecord(view, ACTOR, "LIABILITY", "44444444-4444-4444-8444-444444444444");
    expect(out.retired).toHaveLength(2);
    const plan = planPersist(before, view);
    expect(plan.inserts.map((i) => i.table)).toEqual(["personal_record_revisions"]);
    expect(plan.inserts[0]!.rows.map((r) => r.change)).toEqual(["RETIRE", "RETIRE"]);
    expect(plan.updates.map((u) => `${u.table}:${u.row.retired}`)).toEqual(["liabilities:true", "recurring_obligations:true"]);
  });

  it("a guardrail change becomes a profile update and nothing else", () => {
    const view = seededView();
    const before = structuredClone(view);
    updatePersonalPolicy(view, ACTOR, { cash_floor: "2000", notification_mode: "QUIET" });
    const plan = planPersist(before, view);
    expect(plan.inserts).toEqual([]);
    expect(plan.updates).toEqual([]);
    expect(plan.profile).toMatchObject({ cash_floor: "2000.00", notification_mode: "QUIET", buffer_target_months: "3" });
  });

  it("a mutation that throws (participant, or a record from elsewhere) leaves no plan to persist", () => {
    const view = seededView();
    const participant: PersonalActor = { ...ACTOR, principal_id: "88888888-8888-4888-8888-888888888888", workspace_role: "PARTICIPANT", domains: ["SAVINGS_GOALS"] };
    expect(() => createPersonalRecord(view, participant, "GOAL", { label: "x", kind: "OTHER", target_amount: "1", saved_amount: "0" })).toThrow(DomainError);
    expect(() => updatePersonalRecord(view, ACTOR, "LIABILITY", "00000000-0000-4000-8000-000000000000", {})).toThrow(/not found/i);
    const plan = planPersist(seededView(), view);
    expect(plan.inserts).toEqual([]);
    expect(plan.updates).toEqual([]);
  });

  it("an obligation created against a liability in the view keeps the uuid FK; a new goal funded from a new account follows the remap", () => {
    const view = seededView();
    const before = structuredClone(view);
    createPersonalRecord(view, ACTOR, "OBLIGATION", { label: "Min", category: "DEBT_MINIMUM", amount: "60", cadence: "MONTHLY", next_due_date: "2026-12-01", essential: true, liability_id: "44444444-4444-4444-8444-444444444444" });
    const acct = createPersonalRecord(view, ACTOR, "CASH_ACCOUNT", { label: "Savings", kind: "SAVINGS", balance: "900", balance_as_of: "2026-10-31" });
    createPersonalRecord(view, ACTOR, "GOAL", { label: "Move", kind: "MOVE", target_amount: "6000", saved_amount: "900", funded_from_account_id: acct.account_ref });
    const plan = planPersist(before, view);
    const tables = plan.inserts.map((i) => i.table);
    expect(tables.indexOf("cash_accounts")).toBeLessThan(tables.indexOf("savings_goals"));
    expect(tables.indexOf("liabilities") === -1 || tables.indexOf("liabilities") < tables.indexOf("recurring_obligations")).toBe(true);
    const goal = plan.inserts.find((i) => i.table === "savings_goals")!.rows[0]!;
    const cash = plan.inserts.find((i) => i.table === "cash_accounts")!.rows[0]!;
    expect(goal.funded_from_account_ref).toBe(cash.account_ref);
    expect(String(goal.funded_from_account_ref)).toMatch(UUID);
    const obl = plan.inserts.find((i) => i.table === "recurring_obligations")!.rows[0]!;
    expect(obl.liability_id).toBe("44444444-4444-4444-8444-444444444444");
  });
});

describe("row mapping", () => {
  it("numeric text casts and PostgreSQL array literals round-trip to normalised money strings", () => {
    expect(parsePgTextArray("{1200.00,980.50}")).toEqual(["1200.00", "980.50"]);
    expect(parsePgTextArray("{}")).toEqual([]);
    const inc = fromRow.incomeStream({ id: "x", workspace_id: WS, label: "Pay", kind: "SALARY", cadence: "MONTHLY", reliability: "REGULAR", observed_monthly_amounts: "{4200,4200.5}", observed_from: "2026-01", observed_to: "2026-02", expected_amount: "4200", next_expected_date: null, data_state: "USER_REPORTED", retired: false });
    expect(inc.observed_monthly_amounts).toEqual(["4200.00", "4200.50"]);
    expect(inc.expected_amount).toBe("4200.00");
    const goal = fromRow.goal({ id: "g", workspace_id: WS, label: "Move", kind: "MOVE", target_amount: "6000", saved_amount: "900.5", target_date: null, monthly_contribution: null, funded_from_account_ref: "r", retired: false });
    expect(goal).toMatchObject({ target_amount: "6000.00", saved_amount: "900.50", funded_from_account_id: "r" });
    expect(SELECTS.cash_accounts).toContain("balance::text");
    expect(SELECTS.liabilities).toContain("apr_percent::text");
  });
});

// ---------------------------------------------------------------- mocked PostgREST
type Call = { table: string; op: string; args: unknown; filters: Array<[string, unknown]>; select?: string };
function mockClient(tables: Record<string, Row[]>, opts: { failOn?: string; zeroRowsOn?: string; rpcError?: { code: string; message: string } } = {}) {
  const calls: Call[] = [];
  const rpcs: Array<{ fn: string; args: Record<string, unknown> }> = [];
  const builder = (table: string) => {
    const call: Call = { table, op: "select", args: null, filters: [] };
    calls.push(call);
    const api = {
      select(sel: string) {
        if (call.op === "select") call.select = sel;
        else call.select = sel;
        return api;
      },
      insert(rows: Row[]) {
        call.op = "insert";
        call.args = rows;
        return api;
      },
      update(row: Row) {
        call.op = "update";
        call.args = row;
        return api;
      },
      eq(k: string, v: unknown) {
        call.filters.push([k, v]);
        return api;
      },
      in(k: string, v: unknown) {
        call.filters.push([k, v]);
        return api;
      },
      then(resolve: (v: { data: unknown; error: { message: string; code?: string } | null }) => void) {
        if (opts.failOn && `${call.table}:${call.op}` === opts.failOn) return resolve({ data: null, error: { message: "permission denied for table " + call.table, code: "42501" } });
        if (call.op === "select") {
          const rows = (tables[call.table] ?? []).filter((r) => call.filters.every(([k, v]) => (Array.isArray(v) ? v.includes(r[k]) : r[k] === v)));
          return resolve({ data: rows, error: null });
        }
        if (opts.zeroRowsOn && `${call.table}:${call.op}` === opts.zeroRowsOn) return resolve({ data: [], error: null });
        if (call.op === "insert") return resolve({ data: (call.args as Row[]).map((r) => ({ id: r.id })), error: null });
        return resolve({ data: [{ id: call.filters[0]?.[1] ?? "x", workspace_id: WS }], error: null });
      },
    };
    return api;
  };
  const rpc = (fn: string, args: Record<string, unknown>) => {
    rpcs.push({ fn, args });
    return Promise.resolve(opts.rpcError ? { data: null, error: opts.rpcError } : { data: { inserted: 1, updated: 0, events: 1 }, error: null });
  };
  const client = { schema: () => ({ from: builder, rpc }) };
  return { client: client as never, calls, rpcs };
}
type Row = Record<string, unknown>;

const DB: Record<string, Row[]> = {
  workspaces: [{ id: WS, kind: "PERSONAL", label: "Ana", owner_principal_id: ANA, firm_org_id: null, created_at: "2026-11-01T00:00:00Z" }, { id: "other", kind: "PERSONAL", label: "Someone else", owner_principal_id: "z", firm_org_id: null, created_at: "" }],
  workspace_memberships: [{ id: "m1", workspace_id: WS, principal_id: ANA, role: "OWNER", domains: "{}", status: "ACTIVE", created_at: "" }],
  consent_grants: [],
  personal_profiles: [{ workspace_id: WS, principal_id: ANA, household_size: 1, situation: "", top_concern: null, cash_floor: "1500.00", buffer_target_months: null, extra_debt_payment_monthly: "0.00", notification_mode: "NORMAL", updated_at: "" }],
  cash_accounts: [{ id: "c1", account_ref: "r1", workspace_id: WS, label: "Checking", kind: "CHECKING", balance: "3200.00", currency: "USD", balance_as_of: "2026-10-31", liquid: true, data_state: "USER_REPORTED", revision: 1, supersedes_id: null, superseded: false, created_at: "" }, { id: "cx", account_ref: "rx", workspace_id: "other", label: "Leak", kind: "CHECKING", balance: "1.00", currency: "USD", balance_as_of: "2026-10-31", liquid: true, data_state: "USER_REPORTED", revision: 1, supersedes_id: null, superseded: false, created_at: "" }],
  income_streams: [],
  recurring_obligations: [],
  variable_spending: [],
  liabilities: [],
  savings_goals: [],
  personal_record_revisions: [],
  personal_snapshots: [],
  personal_calc_runs: [],
  user_decisions: [],
  retirement_intakes: [{ workspace_id: WS, current_age: null, target_retirement_age: null, annual_retirement_spending: null, retirement_assets_total: null, retirement_assets_as_of: null, annual_contributions: null, expected_pension_annual: null, social_security_estimate_annual: null, social_security_estimate_source: null, life_span_low: null, life_span_high: null, states: {}, updated_at: "" }],
  principals: [{ id: ANA, display_name: "Ana" }],
};

describe("SupabasePersonalRepository over a mocked PostgREST builder", () => {
  it("loads only the actor's workspace (filters on every table) and selects numerics as text", async () => {
    const { client, calls } = mockClient(DB);
    const repo = new SupabasePersonalRepository(client, ACTOR);
    const b = await repo.bundle();
    expect(b.cashAccounts.map((a) => a.label)).toEqual(["Checking"]);
    expect(b.workspace.id).toBe(WS);
    for (const c of calls.filter((c) => c.op === "select" && c.table !== "principals")) {
      expect(c.filters.some(([k, v]) => (k === "workspace_id" || k === "id" || k === "grantor_workspace_id") && v === WS)).toBe(true);
    }
    expect(calls.find((c) => c.table === "cash_accounts")!.select).toContain("balance::text");
  });

  it("a workspace the database does not return is NOT_FOUND, never an empty workspace", async () => {
    const { client } = mockClient({ ...DB, workspaces: [] });
    await expect(new SupabasePersonalRepository(client, ACTOR).bundle()).rejects.toThrow(/not found/i);
  });

  it("mutate sends the whole delta as ONE apply_personal_changes RPC (atomic) and remaps the returned record's ids", async () => {
    const { client, calls, rpcs } = mockClient(DB);
    const repo = new SupabasePersonalRepository(client, ACTOR);
    const row = await repo.mutate((v) => createPersonalRecord(v, ACTOR, "LIABILITY", { label: "Card", kind: "CREDIT_CARD", balance: "1800", balance_as_of: "2026-10-31", apr_percent: "24.99", minimum_payment: "55", rate_type: "FIXED" }));
    expect(row.id).toMatch(UUID);
    expect(calls.filter((c) => c.op !== "select")).toEqual([]); // no direct PostgREST writes any more
    expect(rpcs).toHaveLength(1);
    expect(rpcs[0]!.fn).toBe("apply_personal_changes");
    const args = rpcs[0]!.args as { p_workspace: string; p_plan: { inserts: Array<{ table: string; rows: Row[] }>; updates: unknown[]; profile: unknown } };
    expect(args.p_workspace).toBe(WS);
    expect(args.p_plan.inserts.map((i) => i.table)).toEqual(["liabilities", "personal_record_revisions"]);
    expect(args.p_plan.inserts[0]!.rows[0]!.id).toBe(row.id);
    expect(args.p_plan.updates).toEqual([]);
    expect(args.p_plan.profile).toBeNull();
  });

  it("a mutation with no delta sends no RPC", async () => {
    const { client, rpcs } = mockClient(DB);
    const repo = new SupabasePersonalRepository(client, ACTOR);
    await repo.mutate(() => undefined);
    expect(rpcs).toEqual([]);
  });

  it("a refused RPC maps SQLSTATE to a domain code and states that nothing was saved", async () => {
    const notFound = new SupabasePersonalRepository(mockClient(DB, { rpcError: { code: "P0002", message: "NOT_FOUND" } }).client, ACTOR);
    await expect(notFound.mutate((v) => createPersonalRecord(v, ACTOR, "GOAL", { label: "Move", kind: "MOVE", target_amount: "6000", saved_amount: "0" }))).rejects.toMatchObject({ code: "NOT_FOUND", message: expect.stringMatching(/Nothing was saved/) });
    const shape = new SupabasePersonalRepository(mockClient(DB, { rpcError: { code: "23514", message: "check constraint" } }).client, ACTOR);
    await expect(shape.mutate((v) => createPersonalRecord(v, ACTOR, "GOAL", { label: "Move", kind: "MOVE", target_amount: "6000", saved_amount: "0" }))).rejects.toMatchObject({ code: "VALIDATION" });
    const priv = new SupabasePersonalRepository(mockClient(DB, { rpcError: { code: "42501", message: "IMMUTABLE" } }).client, ACTOR);
    await expect(priv.mutate((v) => createPersonalRecord(v, ACTOR, "GOAL", { label: "Move", kind: "MOVE", target_amount: "6000", saved_amount: "0" }))).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
  });

  it("DATA-002: a baseline refresh plan supersedes the old snapshot (status only), inserts the new one before its runs, and keeps ERROR runs amount-free", async () => {
    const view = seededView();
    const OLD = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    view.personal_snapshots.push({ id: OLD, workspace_id: WS, revision: 1, as_of_date: "2026-10-31", content_sha256: "a".repeat(64), created_at: "2026-11-01T00:00:00Z", created_by: ANA, status: "CURRENT" });
    const before = structuredClone(view);
    const old = view.personal_snapshots[0]!;
    old.status = "SUPERSEDED";
    view.personal_snapshots.push({ id: "psnap_new", workspace_id: WS, revision: 2, as_of_date: "2026-11-05", content_sha256: "b".repeat(64), created_at: "2026-11-05T00:00:00Z", created_by: ANA, status: "CURRENT" });
    view.personal_calc_runs.push({ id: "pcr_1", workspace_id: WS, snapshot_id: "psnap_new", check_type: "PERSONAL_CLARITY", request_sha256: "c".repeat(64), request_hash_verified: true, engine_name: "sagespan-calculator", engine_version: "0.1.0", method_set_versions: { "personal.clarity": "2026.1" }, response: { result_status: "COMPUTED" }, run_status: "COMPUTED", error: null, executed_at: "2026-11-05T00:00:01Z" });
    view.personal_calc_runs.push({ id: "pcr_2", workspace_id: WS, snapshot_id: "psnap_new", check_type: "DEBT_PATHS", request_sha256: "", request_hash_verified: false, engine_name: null, engine_version: null, method_set_versions: {}, response: null, run_status: "ERROR", error: { code: "SERVICE_UNAVAILABLE", message: "down" }, executed_at: "2026-11-05T00:00:02Z" });
    view.user_decisions.push({ id: "dec_1", workspace_id: WS, recommendation_id: "rec_floor", principal_id: ANA, decision: "DONE", note: null, created_at: "2026-11-05T00:00:03Z" });
    const plan = planPersist(before, view);
    expect(plan.updates).toEqual([{ table: "personal_snapshots", id: OLD, row: { status: "SUPERSEDED" } }]);
    expect(plan.inserts.map((i) => i.table)).toEqual(["personal_snapshots", "personal_calc_runs", "user_decisions"]);
    const snap = plan.inserts[0]!.rows[0]!;
    expect(String(snap.id)).toMatch(UUID);
    const runs = plan.inserts[1]!.rows;
    expect(runs.map((r) => r.snapshot_id)).toEqual([snap.id, snap.id]);
    expect(runs[1]).toMatchObject({ run_status: "ERROR", response: null, request_hash_verified: false });
    expect(plan.inserts[2]!.rows[0]).toMatchObject({ recommendation_id: "rec_floor", decision: "DONE" });
    expect(plan.retirement).toBeNull();
  });

  it("DATA-002: a retirement intake change becomes an upsert row with the life-span range flattened", async () => {
    const view = seededView();
    view.retirement_intakes.push({ workspace_id: WS, current_age: null, target_retirement_age: null, annual_retirement_spending: null, retirement_assets_total: null, retirement_assets_as_of: null, annual_contributions: null, expected_pension_annual: null, social_security_estimate_annual: null, social_security_estimate_source: null, life_span_range: null, states: { current_age: "MISSING" }, updated_at: "" });
    const before = structuredClone(view);
    Object.assign(view.retirement_intakes[0]!, { current_age: 41, life_span_range: { low: 85, high: 95 }, states: { current_age: "USER_REPORTED" } });
    const plan = planPersist(before, view);
    expect(plan.retirement).toMatchObject({ current_age: 41, life_span_low: 85, life_span_high: 95, states: { current_age: "USER_REPORTED" } });
    expect(plan.inserts).toEqual([]);
    expect(plan.updates).toEqual([]);
  });
});
