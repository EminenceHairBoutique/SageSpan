/**
 * PR-001 trust-boundary tests for the web tier (mirror of supabase/tests/005_trust_boundaries.test.sql).
 * Findings covered: S-03 (ordering), S-04 (receipt integrity), N-01 (write-once dispositions),
 * N-03 (fail-closed environment), N-05 (shared approval matrix) and the workflow sentinel equivalent.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Actor } from "@/auth/types";
import { EnvironmentError, demoModeEnabled, env, failClosed } from "@/config/env";
import { runRmdChecks, sendToReview } from "@/domain/checks";
import { DomainError } from "@/domain/errors";
import { buildSnapshotPayload, byteCompare, freezeSnapshot } from "@/domain/freeze";
import { householdBundle } from "@/domain/queries";
import { approveReview, attemptApproval, dispositionDiscrepancy, documentException, recordReview, resolveConflict, updatePolicy } from "@/domain/review";
import { MemoryStore } from "@/domain/store";
import { recordDisposition, transitionHousehold } from "@/domain/workflow";
import * as calc from "@/provenance/calc-client";

type Mode = "ok" | "bad_hash" | "bad_snapshot" | "bad_engine" | "bad_ruleset" | "no_rulesets";

vi.mock("@/provenance/calc-client", async () => {
  const { canonicalHash } = await import("@sagespan/contracts");
  const expected = (await import("../../../../../fixtures/synthetic/calc/patel_rmd_expected_response.json")).default;
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
  const control: { mode: Mode; registryDown: boolean } = { mode: "ok", registryDown: false };
  type SnapshotRef = { snapshot_id: string; revision: number; input_hash: string };
  type Loose = {
    receipt: { request_hash: string; engine_name: string; org_context: { org_id: string }; snapshot_ref: SnapshotRef | null; rule_sets: Array<{ checksum: string }> };
    discrepancy: { import_value_ref: string | null };
  };
  return {
    CalcServiceError,
    __control: control,
    callRmdCheck: async (request: { snapshot_ref?: SnapshotRef; imported_comparison?: { import_value_ref: string } | null }, orgId: string) => {
      const requestHash = await canonicalHash(request);
      const response = structuredClone(expected) as unknown as Loose;
      response.receipt.request_hash = requestHash;
      response.receipt.org_context.org_id = orgId;
      response.receipt.snapshot_ref = request.snapshot_ref ?? null;
      response.discrepancy.import_value_ref = request.imported_comparison?.import_value_ref ?? null;
      let requestHashVerified = true;
      switch (control.mode) {
        case "bad_hash":
          response.receipt.request_hash = "0".repeat(64);
          requestHashVerified = false;
          break;
        case "bad_snapshot":
          response.receipt.snapshot_ref = request.snapshot_ref ? { ...request.snapshot_ref, input_hash: "f".repeat(64) } : null;
          break;
        case "bad_engine":
          response.receipt.engine_name = "someone-elses-engine";
          break;
        case "bad_ruleset":
          response.receipt.rule_sets[0]!.checksum = "a".repeat(64);
          break;
        case "no_rulesets":
          response.receipt.rule_sets = [];
          break;
        default:
          break;
      }
      return { response, requestHash, requestHashVerified };
    },
    fetchRuleSets: async () => {
      if (control.registryDown) throw new CalcServiceError("SERVICE_UNAVAILABLE", "Rule registry unreachable (test)");
      return { rule_sets: expected.receipt.rule_sets, engine_name: "sagespan-calculator", engine_version: "0.1.0" };
    },
    calcHealth: async () => ({ ok: true }),
  };
});

const control = (calc as unknown as { __control: { mode: Mode; registryDown: boolean } }).__control;

const actor = (user_id: string, org_id: string, role: Actor["role"]): Actor => ({ user_id, org_id, role, display_name: user_id, actor_type: "SIMULATED_REVIEWER", mode: "DEMO" });
const analyst = actor("user_hp_analyst", "org_harborpoint", "ANALYST");
const advisor = actor("user_hp_advisor", "org_harborpoint", "ADVISOR");
const cco = actor("user_hp_cco", "org_harborpoint", "COMPLIANCE");
const admin = actor("user_hp_admin", "org_harborpoint", "ADMIN");
const RATIONALE = "Custodian statement is primary evidence and governs the year-end balance.";
const DISPOSITION = "Imported figure predates the custodian statement; the computed amount governs.";

const statusOf = (store: MemoryStore, id: string) => store.read().households.find((h) => h.id === id)!.workflow_status;
const lastAudit = (store: MemoryStore) => store.read().audit_events.filter((e) => e.org_id === "org_harborpoint").at(-1)!;

function codeOf(fn: () => unknown): string {
  try {
    fn();
  } catch (e) {
    if (e instanceof DomainError) return e.code;
    if (e instanceof Error) return e.name === "PermissionDeniedError" ? "PERMISSION_DENIED" : e.message;
  }
  return "NO_ERROR";
}

function patelToFrozen(store: MemoryStore) {
  store.mutate((s) => resolveConflict(s, analyst, "conf_patel_balance", "f_patel_bal_stmt", RATIONALE));
  store.mutate((s) => documentException(s, cco, "conf_patel_custodian", "Label difference is cosmetic; custodian identity confirmed on profile."));
  return store.mutate((s) => freezeSnapshot(s, analyst, "hh_patel"));
}

async function frozenToReviewPending(store: MemoryStore) {
  const outcome = await runRmdChecks(store, analyst, "hh_patel");
  expect(outcome.errors).toEqual([]);
  store.mutate((s) => sendToReview(s, analyst, "hh_patel"));
  return outcome.runs[0]!;
}

async function patelToReviewPending(store: MemoryStore) {
  patelToFrozen(store);
  return frozenToReviewPending(store);
}

describe("S-04: calculation receipts are verified before anything is recorded as computed", () => {
  let store: MemoryStore;
  beforeEach(() => {
    control.mode = "ok";
    control.registryDown = false;
    store = new MemoryStore();
    patelToFrozen(store);
  });

  const cases: Array<[Mode, string]> = [
    ["bad_hash", "REQUEST_HASH_MISMATCH"],
    ["bad_snapshot", "RECEIPT_SNAPSHOT_REF_MISMATCH"],
    ["bad_engine", "UNKNOWN_ENGINE"],
    ["bad_ruleset", "RULE_SET_NOT_PUBLISHED"],
    ["no_rulesets", "RULE_SETS_MISSING"],
  ];
  for (const [mode, reason] of cases) {
    it(`${mode}: ERROR run + CHECK_RUN_FAILED, no discrepancy, household stays FROZEN (${reason})`, async () => {
      control.mode = mode;
      const discrepanciesBefore = store.read().discrepancies.length;
      const outcome = await runRmdChecks(store, analyst, "hh_patel");
      expect(outcome.errors).toHaveLength(1);
      expect(outcome.errors[0]!.code).toBe("RECEIPT_INTEGRITY_ERROR");
      expect(outcome.errors[0]!.message).toContain(reason);
      const run = outcome.runs[0]!;
      expect(run.run_status).toBe("ERROR");
      expect(run.response).toBeNull();
      expect(run.request_hash_verified).toBe(false);
      expect(run.error).toMatchObject({ code: "RECEIPT_INTEGRITY_ERROR" });
      expect(store.read().discrepancies).toHaveLength(discrepanciesBefore);
      expect(statusOf(store, "hh_patel")).toBe("FROZEN");
      expect(lastAudit(store).event_type).toBe("CHECK_RUN_FAILED");
    });
  }

  it("a genuine receipt is accepted and the household advances", async () => {
    const outcome = await runRmdChecks(store, analyst, "hh_patel");
    expect(outcome.errors).toEqual([]);
    expect(outcome.runs[0]!.request_hash_verified).toBe(true);
    expect(outcome.runs[0]!.engine_name).toBe("sagespan-calculator");
    expect(statusOf(store, "hh_patel")).toBe("CHECK_COMPLETE");
  });

  it("an unreachable rule registry yields an ERROR run, never a locally trusted result", async () => {
    control.registryDown = true;
    const outcome = await runRmdChecks(store, analyst, "hh_patel");
    expect(outcome.errors[0]!.code).toBe("SERVICE_UNAVAILABLE");
    expect(outcome.runs[0]!.run_status).toBe("ERROR");
    expect(statusOf(store, "hh_patel")).toBe("FROZEN");
  });

  it("approval refuses a snapshot whose non-ERROR run lacks a verified receipt (CHECK_RECEIPT_UNVERIFIED)", async () => {
    const run = await frozenToReviewPending(store);
    const disc = store.read().discrepancies.find((d) => d.check_run_id === run.id)!;
    store.mutate((s) => dispositionDiscrepancy(s, advisor, disc.id, DISPOSITION));
    store.mutate((s) => recordReview(s, advisor, "hh_patel", "Reviewed the receipt and the discrepancy."));
    // Simulate a legacy or tampered row: the verification flag is cleared after the fact.
    store.mutate((s) => {
      s.check_runs.find((r) => r.id === run.id)!.request_hash_verified = null;
    });
    expect(codeOf(() => store.mutate((s) => approveReview(s, cco, "hh_patel", { rationale: RATIONALE, conflictAttestation: true })))).toBe("CHECK_RECEIPT_UNVERIFIED");
    expect(statusOf(store, "hh_patel")).toBe("REVIEWED");
  });
});

describe("N-01: discrepancy dispositions are write-once and closed after approval", () => {
  let store: MemoryStore;
  beforeEach(() => {
    control.mode = "ok";
    control.registryDown = false;
    store = new MemoryStore();
  });

  it("a second disposition is refused and the first one is kept verbatim", async () => {
    const run = await patelToReviewPending(store);
    const disc = store.read().discrepancies.find((d) => d.check_run_id === run.id)!;
    store.mutate((s) => dispositionDiscrepancy(s, advisor, disc.id, DISPOSITION));
    expect(codeOf(() => store.mutate((s) => dispositionDiscrepancy(s, cco, disc.id, "Rewritten by compliance afterwards.")))).toBe("ALREADY_DISPOSITIONED");
    const after = store.read().discrepancies.find((d) => d.id === disc.id)!;
    expect(after.status).toBe("DISPOSITIONED");
    expect(after.disposition).toMatchObject({ by: advisor.user_id, role: "ADVISOR", note: DISPOSITION });
  });

  it("no disposition can be recorded once the household is APPROVED", async () => {
    const run = await patelToReviewPending(store);
    const disc = store.read().discrepancies.find((d) => d.check_run_id === run.id)!;
    store.mutate((s) => dispositionDiscrepancy(s, advisor, disc.id, DISPOSITION));
    store.mutate((s) => recordReview(s, advisor, "hh_patel", "Reviewed the receipt and the discrepancy."));
    store.mutate((s) => approveReview(s, cco, "hh_patel", { rationale: RATIONALE, conflictAttestation: true }));
    expect(statusOf(store, "hh_patel")).toBe("APPROVED");
    // A stray OPEN discrepancy injected after approval (synthetic) must still be unwritable.
    store.mutate((s) => {
      s.discrepancies.push({ ...disc, id: "disc_injected", status: "OPEN", disposition: null });
    });
    expect(codeOf(() => store.mutate((s) => dispositionDiscrepancy(s, cco, "disc_injected", DISPOSITION)))).toBe("INVALID_STATE");
  });

  it("the workflow helper itself is write-once", () => {
    const d = { status: "OPEN", disposition: null } as unknown as Parameters<typeof recordDisposition>[0];
    recordDisposition(d, { by: "u", role: "ADVISOR", at: "2026-11-05T00:00:00.000Z", note: DISPOSITION });
    expect(() => recordDisposition(d, { by: "u2", role: "COMPLIANCE", at: "2026-11-05T00:00:00.000Z", note: "again" })).toThrow(/write-once/);
  });
});

describe("N-05: one approval matrix for policy, UI and the domain tier", () => {
  let store: MemoryStore;
  beforeEach(async () => {
    control.mode = "ok";
    control.registryDown = false;
    store = new MemoryStore();
    const run = await patelToReviewPending(store);
    const disc = store.read().discrepancies.find((d) => d.check_run_id === run.id)!;
    store.mutate((s) => dispositionDiscrepancy(s, cco, disc.id, DISPOSITION));
    store.mutate((s) => updatePolicy(s, admin, { approver_roles: ["COMPLIANCE"] }));
  });

  it("ADVISOR has the capability but is denied by the default firm policy; the denial is audited", () => {
    store.mutate((s) => recordReview(s, cco, "hh_patel", "Reviewed by compliance."));
    expect(codeOf(() => attemptApproval(store, advisor, "hh_patel", { rationale: RATIONALE, conflictAttestation: true }))).toBe("NOT_AN_APPROVER");
    const ev = lastAudit(store);
    expect(ev.event_type).toBe("APPROVAL_DENIED");
    expect(ev.summary).toContain("NOT_AN_APPROVER");
    expect(statusOf(store, "hh_patel")).toBe("REVIEWED");
  });

  it("ADMIN lacks the capability regardless of firm policy", () => {
    store.mutate((s) => recordReview(s, cco, "hh_patel", "Reviewed by compliance."));
    store.mutate((s) => updatePolicy(s, admin, { approver_roles: ["COMPLIANCE", "ADVISOR", "ADMIN" as never] }));
    expect(store.read().organizations.find((o) => o.id === "org_harborpoint")!.policies.approver_roles).toEqual(["COMPLIANCE", "ADVISOR"]);
    expect(codeOf(() => attemptApproval(store, admin, "hh_patel", { rationale: RATIONALE, conflictAttestation: true }))).toBe("PERMISSION_DENIED");
    expect(lastAudit(store).event_type).toBe("APPROVAL_DENIED");
  });

  it("firm policy may admit ADVISOR, subject to separation of duties", () => {
    store.mutate((s) => updatePolicy(s, admin, { approver_roles: ["COMPLIANCE", "ADVISOR"] }));
    store.mutate((s) => recordReview(s, cco, "hh_patel", "Reviewed by compliance."));
    const review = store.mutate((s) => approveReview(s, advisor, "hh_patel", { rationale: RATIONALE, conflictAttestation: true }));
    expect(review.decision).toBe("APPROVED");
    expect(statusOf(store, "hh_patel")).toBe("APPROVED");
  });
});

describe("Workflow sentinel equivalent: workflow-owned fields move only through the helpers", () => {
  it("transitionHousehold enforces the state machine", () => {
    const store = new MemoryStore();
    const hh = structuredClone(store.read().households.find((h) => h.id === "hh_patel")!);
    expect(hh.workflow_status).toBe("BLOCKED");
    expect(() => transitionHousehold(hh, "APPROVED")).toThrow();
    expect(hh.workflow_status).toBe("BLOCKED");
    transitionHousehold(hh, "READY_TO_FREEZE");
    expect(hh.workflow_status).toBe("READY_TO_FREEZE");
  });
});

describe("S-03: snapshot ordering is byte order, matching Postgres collate \"C\" and Python sorted()", () => {
  it("byteCompare differs from localeCompare exactly where locales would reorder", () => {
    const ids = ["b", "B", "_", "a", "1"];
    expect([...ids].sort(byteCompare)).toEqual(["1", "B", "_", "a", "b"]);
    expect([...ids].sort(byteCompare)).toEqual([...ids].sort());
    expect([...ids].sort((x, y) => x.localeCompare(y))).not.toEqual([...ids].sort(byteCompare));
  });

  it("the Patel payload lists facts, documents and exceptions in byte order", () => {
    const store = new MemoryStore();
    patelToFrozen(store);
    const b = householdBundle(store.read(), "org_harborpoint", "hh_patel");
    const p = buildSnapshotPayload(b, 1);
    const factIds = p.facts.map((f) => f.id);
    expect(factIds).toEqual([...factIds].sort());
    const docIds = p.source_documents.map((d) => d.id);
    expect(docIds).toEqual([...docIds].sort());
    expect(p.snapshot_version).toBe("sagespan.snapshot.v1");
  });
});

describe("N-03: the server environment fails closed in production", () => {
  const saved = { NODE_ENV: process.env.NODE_ENV, SAGESPAN_DEMO_MODE: process.env.SAGESPAN_DEMO_MODE, CALC_SERVICE_TOKEN: process.env.CALC_SERVICE_TOKEN, CALC_SERVICE_URL: process.env.CALC_SERVICE_URL };
  const clear = (k: keyof typeof saved) => {
    delete process.env[k];
  };
  afterEach(() => {
    vi.unstubAllEnvs();
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it("production without SAGESPAN_DEMO_MODE=1 refuses demo defaults", () => {
    vi.stubEnv("NODE_ENV", "production");
    clear("SAGESPAN_DEMO_MODE");
    clear("CALC_SERVICE_TOKEN");
    clear("CALC_SERVICE_URL");
    expect(failClosed()).toBe(true);
    expect(demoModeEnabled()).toBe(false);
    expect(() => env.calcServiceToken).toThrow(EnvironmentError);
    expect(() => env.calcServiceUrl).toThrow(EnvironmentError);
    vi.stubEnv("CALC_SERVICE_TOKEN", "demo-local-token");
    expect(() => env.calcServiceToken).toThrow(/non-demo/);
    vi.stubEnv("CALC_SERVICE_TOKEN", "synthetic-production-token-not-a-secret");
    vi.stubEnv("CALC_SERVICE_URL", "https://calc.internal.example/");
    expect(env.calcServiceToken).toBe("synthetic-production-token-not-a-secret");
    expect(env.calcServiceUrl).toBe("https://calc.internal.example");
  });

  it("production with an explicit demo opt-in keeps the demo defaults", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SAGESPAN_DEMO_MODE", "1");
    clear("CALC_SERVICE_TOKEN");
    expect(failClosed()).toBe(false);
    expect(demoModeEnabled()).toBe(true);
    expect(env.calcServiceToken).toBe("demo-local-token");
  });

  it("development defaults to demo mode", () => {
    vi.stubEnv("NODE_ENV", "development");
    clear("SAGESPAN_DEMO_MODE");
    clear("CALC_SERVICE_TOKEN");
    expect(failClosed()).toBe(false);
    expect(demoModeEnabled()).toBe(true);
    expect(env.calcServiceUrl).toBe("http://127.0.0.1:8010");
  });
});
