/**
 * PERS-001 domain tests: workspace scoping, snapshot/receipt discipline for the
 * Personal engines (mirrors S-04 for the firm side), versioned facts, append-only
 * decisions, and the policy evaluation on receipted runs. The calculation
 * service is mocked with the committed Castillo fixtures; the mock re-stamps the
 * receipt with the real request hash so the integrity check is exercised.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PersonalActor } from "@/auth/personal-actor";
import { NotFoundError } from "@/auth/types";
import { DomainError } from "@/domain/errors";
import { recordUserDecision, updateCashBalance, updatePersonalPolicy, updateRetirementIntake } from "@/domain/personal/mutations";
import { currentRun, latestDecisions, personalBundle } from "@/domain/personal/queries";
import { personalInsights, refreshPersonalBaseline, verifyPersonalReceipt } from "@/domain/personal/runs";
import { buildClarityRequest, ensureCurrentSnapshot } from "@/domain/personal/snapshot";
import { MemoryStore } from "@/domain/store";
import * as calc from "@/provenance/calc-client";

type Mode = "ok" | "bad_hash" | "bad_engine" | "unpublished" | "down";

vi.mock("@/provenance/calc-client", async () => {
  const { canonicalHash } = await import("@sagespan/contracts");
  const clarity = (await import("../../../../../fixtures/synthetic/personal/castillo_clarity_expected_response.json")).default;
  const debt = (await import("../../../../../fixtures/synthetic/personal/castillo_debt_paths_expected_response.json")).default;
  class CalcServiceError extends Error {
    constructor(
      public readonly code: string,
      message: string,
      public readonly status: number | null = null,
    ) {
      super(message);
      this.name = "CalcServiceError";
    }
  }
  const control: { mode: Mode } = { mode: "ok" };
  const methods = [...clarity.receipt.rule_sets, ...debt.receipt.rule_sets];
  async function respond(fixture: typeof clarity | typeof debt, request: { input_hash?: string | null }) {
    if (control.mode === "down") throw new CalcServiceError("SERVICE_UNAVAILABLE", "Calculation service is unreachable (test).");
    const requestHash = await canonicalHash(request);
    const response = structuredClone(fixture) as unknown as { receipt: { request_hash: string; engine_name: string; inputs_used: Record<string, unknown>; rule_sets: Array<{ checksum: string }> } };
    response.receipt.request_hash = control.mode === "bad_hash" ? "f".repeat(64) : requestHash;
    response.receipt.inputs_used = { ...response.receipt.inputs_used, input_hash: request.input_hash ?? null };
    if (control.mode === "bad_engine") response.receipt.engine_name = "someone-elses-engine";
    if (control.mode === "unpublished") response.receipt.rule_sets[0]!.checksum = "0".repeat(64);
    return { response, requestHash, requestHashVerified: response.receipt.request_hash === requestHash };
  }
  return {
    CalcServiceError,
    __control: control,
    callPersonalClarity: (request: { input_hash?: string | null }) => respond(clarity, request),
    callDebtPaths: (request: { input_hash?: string | null }) => respond(debt, request),
    fetchMethodSets: async () => {
      if (control.mode === "down") throw new CalcServiceError("SERVICE_UNAVAILABLE", "Calculation service is unreachable (test).");
      return { method_sets: methods, engine_name: "sagespan-calculator", engine_version: "0.1.0" };
    },
  };
});

const control = (calc as unknown as { __control: { mode: Mode } }).__control;

const ALVAREZ: PersonalActor = { scope: "PERSONAL", principal_id: "pr_castillo", workspace_id: "ws_castillo_personal", workspace_role: "OWNER", domains: [], display_name: "Maya Castillo", mode: "DEMO", actor_type: "SIMULATED_INDIVIDUAL" };
const PARTNER: PersonalActor = { ...ALVAREZ, principal_id: "pr_castillo_partner", workspace_role: "PARTICIPANT", domains: ["SAVINGS_GOALS"], display_name: "Sam Rivera" };
const STRANGER: PersonalActor = { ...ALVAREZ, principal_id: "pr_nobody", workspace_id: "ws_someone_else" };

describe("workspace scoping", () => {
  it("reads only the actor's own workspace; unknown or foreign workspaces are not found", () => {
    const store = new MemoryStore();
    const b = personalBundle(store.read(), ALVAREZ);
    expect(b.cashAccounts.map((a) => a.account_ref).sort()).toEqual(["cash_castillo_checking", "cash_castillo_savings"]);
    expect(b.liabilities).toHaveLength(2);
    expect(() => personalBundle(store.read(), STRANGER)).toThrow(NotFoundError);
    // an INVITED (not yet active) participant cannot read anything
    expect(() => personalBundle(store.read(), PARTNER)).toThrow(NotFoundError);
  });

  it("firm records never appear in a personal bundle and vice versa", () => {
    const store = new MemoryStore();
    const b = personalBundle(store.read(), ALVAREZ);
    expect(JSON.stringify(b)).not.toMatch(/hh_patel|org_harborpoint|640000/);
  });
});

describe("snapshot and receipted runs", () => {
  beforeEach(() => {
    control.mode = "ok";
  });

  it("builds the clarity request from the records with stable refs and creates a CURRENT snapshot once", async () => {
    const store = new MemoryStore();
    const state = store.read();
    const b = personalBundle(state, ALVAREZ);
    const req = buildClarityRequest(b);
    expect(req.cash_accounts.map((a) => a.account_ref)).toEqual(["cash_castillo_checking", "cash_castillo_savings"]);
    expect(req.policy).toEqual({ cash_floor: "1500.00", buffer_target_months: "2" });
    const first = await ensureCurrentSnapshot(b, ALVAREZ, state);
    expect(first.created).toBe(true);
    expect(first.snapshot.revision).toBe(1);
    store.write(state);
    const again = await ensureCurrentSnapshot(personalBundle(store.read(), ALVAREZ), ALVAREZ, store.read());
    expect(again.created).toBe(false);
    expect(again.snapshot.id).toBe(first.snapshot.id);
  });

  it("records receipted clarity and debt runs bound to the snapshot and evaluates the policy", async () => {
    const store = new MemoryStore();
    const out = await refreshPersonalBaseline(store, ALVAREZ);
    expect(out.errors).toEqual([]);
    expect(out.clarity.run_status).toBe("COMPUTED");
    expect(out.clarity.request_hash_verified).toBe(true);
    expect(out.clarity.method_set_versions).toEqual({ "personal.cashflow_baseline": "2026.1" });
    expect(out.debt?.run_status).toBe("COMPUTED");
    const b = personalBundle(store.read(), ALVAREZ);
    const insights = personalInsights(b);
    expect(insights.clarity?.margin.typical).toBe("1503.50");
    expect(insights.policy?.primary.length).toBeGreaterThan(0);
    expect(insights.policy?.primary.length).toBeLessThanOrEqual(3);
    expect(insights.policy?.primary.every((r) => r.calculation_refs.includes(out.clarity.id))).toBe(true);
    // second refresh without changes reuses the runs
    const second = await refreshPersonalBaseline(store, ALVAREZ);
    expect(second.clarity.id).toBe(out.clarity.id);
  });

  it("rejects a mismatched request hash, an unknown engine and an unpublished methodology set (no amounts recorded)", async () => {
    for (const mode of ["bad_hash", "bad_engine", "unpublished"] as Mode[]) {
      control.mode = mode;
      const store = new MemoryStore();
      const out = await refreshPersonalBaseline(store, ALVAREZ);
      expect(out.clarity.run_status).toBe("ERROR");
      expect(out.clarity.response).toBeNull();
      expect(out.errors[0]?.code).toBe("RECEIPT_INTEGRITY");
      expect(personalInsights(personalBundle(store.read(), ALVAREZ)).clarity).toBeNull();
    }
  });

  it("fails visibly when the service is down: ERROR run, nothing computed locally", async () => {
    control.mode = "down";
    const store = new MemoryStore();
    const out = await refreshPersonalBaseline(store, ALVAREZ);
    expect(out.clarity.run_status).toBe("ERROR");
    expect(out.errors.some((e) => e.code === "SERVICE_UNAVAILABLE")).toBe(true);
    expect(out.debt).toBeNull();
    const insights = personalInsights(personalBundle(store.read(), ALVAREZ));
    expect(insights.clarity).toBeNull();
    expect(insights.policy).toBeNull();
  });

  it("verifyPersonalReceipt checks the snapshot binding", () => {
    const registry = [{ rule_set_id: "personal.cashflow_baseline", version: "2026.1", status: "PUBLISHED" as const, checksum: "a".repeat(64), effective_from: "2026-01-01", effective_to: null, sources: [] }];
    const receipt = { request_hash: "b".repeat(64), engine_name: "sagespan-calculator", inputs_used: { input_hash: "c".repeat(64) }, rule_sets: registry };
    const result = { response: { receipt } as never, requestHash: "b".repeat(64), requestHashVerified: true };
    expect(verifyPersonalReceipt(result, registry, "c".repeat(64))).toBeNull();
    expect(verifyPersonalReceipt(result, registry, "d".repeat(64))).toBe("RECEIPT_SNAPSHOT_REF_MISMATCH");
  });
});

describe("versioned facts, preferences and decisions", () => {
  beforeEach(() => {
    control.mode = "ok";
  });

  it("a balance update creates a new revision, keeps history and supersedes the snapshot", async () => {
    const store = new MemoryStore();
    const before = await refreshPersonalBaseline(store, ALVAREZ);
    const next = store.mutate((s) => updateCashBalance(s, ALVAREZ, "cash_castillo_savings", "900", "2026-11-05"));
    expect(next.balance).toBe("900.00");
    expect(next.revision).toBe(2);
    const all = store.read().cash_accounts.filter((a) => a.account_ref === "cash_castillo_savings");
    expect(all).toHaveLength(2);
    expect(all.find((a) => a.revision === 1)?.superseded).toBe(true);
    const after = await refreshPersonalBaseline(store, ALVAREZ);
    expect(after.snapshotCreated).toBe(true);
    expect(after.snapshotId).not.toBe(before.snapshotId);
    const b = personalBundle(store.read(), ALVAREZ);
    expect(b.snapshots.find((s) => s.id === before.snapshotId)?.status).toBe("SUPERSEDED");
    expect(currentRun(b, "PERSONAL_CLARITY")?.id).toBe(after.clarity.id);
    expect(b.runs.some((r) => r.id === before.clarity.id)).toBe(true); // history retained
  });

  it("only the owner may change facts or preferences; validation refuses bad money", () => {
    const store = new MemoryStore();
    store.mutate((s) => {
      s.workspace_memberships.find((m) => m.id === "wm_castillo_partner")!.status = "ACTIVE";
    });
    expect(() => store.mutate((s) => updateCashBalance(s, PARTNER, "cash_castillo_savings", "1", "2026-11-05"))).toThrow(DomainError);
    expect(() => store.mutate((s) => updateCashBalance(s, ALVAREZ, "cash_castillo_savings", "abc", "2026-11-05"))).toThrow(/decimal amount/);
    expect(() => store.mutate((s) => updateCashBalance(s, ALVAREZ, "cash_castillo_savings", "-5", "2026-11-05"))).toThrow(/negative/);
    expect(() => store.mutate((s) => updatePersonalPolicy(s, ALVAREZ, { buffer_target_months: "99" }))).toThrow(/between 0 and 36/);
    store.mutate((s) => updatePersonalPolicy(s, ALVAREZ, { cash_floor: "1800", buffer_target_months: "3", notification_mode: "QUIET" }));
    const p = personalBundle(store.read(), ALVAREZ).profile;
    expect(p.cash_floor).toBe("1800.00");
    expect(p.buffer_target_months).toBe("3");
    expect(p.notification_mode).toBe("QUIET");
  });

  it("user decisions are append-only events that never touch runs or facts", async () => {
    const store = new MemoryStore();
    await refreshPersonalBaseline(store, ALVAREZ);
    const b = personalBundle(store.read(), ALVAREZ);
    const rec = personalInsights(b).policy!.primary[0]!;
    const factsBefore = JSON.stringify({ a: b.cashAccounts, r: b.runs });
    store.mutate((s) => recordUserDecision(s, ALVAREZ, rec.recommendation_id, "SNOOZE", "later"));
    store.mutate((s) => recordUserDecision(s, ALVAREZ, rec.recommendation_id, "DONE", ""));
    const after = personalBundle(store.read(), ALVAREZ);
    expect(after.decisions).toHaveLength(2);
    expect(latestDecisions(after).get(rec.recommendation_id)?.decision).toBe("DONE");
    expect(JSON.stringify({ a: after.cashAccounts, r: after.runs })).toBe(factsBefore);
    expect(() => store.mutate((s) => recordUserDecision(s, ALVAREZ, rec.recommendation_id, "DELETE_EVERYTHING", ""))).toThrow(/Unknown decision/);
  });

  it("retirement intake tracks known/assumed/missing and never computes a projection", () => {
    const store = new MemoryStore();
    store.mutate((s) => updateRetirementIntake(s, ALVAREZ, { annual_retirement_spending: "48000", target_retirement_age: "67", target_is_assumed: "on", social_security_estimate_annual: "", current_age: "34" }));
    const r = personalBundle(store.read(), ALVAREZ).retirement!;
    expect(r.annual_retirement_spending).toBe("48000.00");
    expect(r.states["annual_retirement_spending"]).toBe("USER_REPORTED");
    expect(r.states["target_retirement_age"]).toBe("ASSUMED");
    expect(r.states["social_security_estimate_annual"]).toBe("MISSING");
    expect(JSON.stringify(r)).not.toMatch(/projection|probability/);
    expect(() => store.mutate((s) => updateRetirementIntake(s, ALVAREZ, { current_age: "7" }))).toThrow(/whole number of years/);
  });
});
