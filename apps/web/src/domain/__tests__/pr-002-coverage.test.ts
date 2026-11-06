/**
 * PR-002 web-tier tests (mirror of supabase/tests/007_coverage_and_reproducibility.test.sql).
 *  S-07 snapshot-only, reproducible calculator requests (payload v2 with policy, label, account classification);
 *  N-02 latest attempt per account: ERROR -> PASS recovers, PASS -> ERROR blocks, history kept;
 *  S-06 typed coverage outcome on approval; unsupported-only is never "verified"; packet title/scope from coverage.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { approvalReadiness, coverageSummary, latestCheckRuns, packetTitle, type CheckRun } from "@sagespan/contracts";
import type { Actor } from "@/auth/types";
import { buildRmdRequest, runRmdChecks, sendToReview } from "@/domain/checks";
import { DomainError } from "@/domain/errors";
import { buildPacket } from "@/domain/evidence";
import { buildSnapshotPayload, freezeSnapshot, policyRecord } from "@/domain/freeze";
import { householdBundle } from "@/domain/queries";
import { approveReview, dispositionDiscrepancy, documentException, recordReview, resolveConflict, updatePolicy } from "@/domain/review";
import { MemoryStore } from "@/domain/store";
import * as calc from "@/provenance/calc-client";

type Mode = "ok" | "down" | "bad_hash" | "unsupported";

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
  const control: { mode: Mode } = { mode: "ok" };
  type SnapshotRef = { snapshot_id: string; revision: number; input_hash: string };
  type Loose = {
    result_status: string;
    coverage_status: string;
    annual_rmd: string | null;
    events: unknown[];
    unsupported_reasons: unknown[];
    receipt: { request_hash: string; engine_name: string; org_context: { org_id: string }; snapshot_ref: SnapshotRef | null; rule_sets: Array<{ checksum: string }> };
    discrepancy: { import_value_ref: string | null } | null;
  };
  return {
    CalcServiceError,
    __control: control,
    callRmdCheck: async (request: { snapshot_ref?: SnapshotRef; imported_comparison?: { import_value_ref: string } | null }, orgId: string) => {
      if (control.mode === "down") throw new CalcServiceError("SERVICE_UNAVAILABLE", "Calculation service unreachable (test)");
      const requestHash = await canonicalHash(request);
      const response = structuredClone(expected) as unknown as Loose;
      response.receipt.request_hash = control.mode === "bad_hash" ? "0".repeat(64) : requestHash;
      response.receipt.org_context.org_id = orgId;
      response.receipt.snapshot_ref = request.snapshot_ref ?? null;
      if (response.discrepancy) response.discrepancy.import_value_ref = request.imported_comparison?.import_value_ref ?? null;
      if (control.mode === "unsupported") {
        response.result_status = "UNSUPPORTED";
        response.coverage_status = "UNSUPPORTED";
        response.annual_rmd = null;
        response.events = [];
        response.discrepancy = null;
        response.unsupported_reasons = [{ code: "ACCOUNT_TYPE_UNSUPPORTED", message: "synthetic", rule_ref: null }];
      }
      return { response, requestHash, requestHashVerified: control.mode !== "bad_hash" };
    },
    fetchRuleSets: async () => ({ rule_sets: expected.receipt.rule_sets, engine_name: "sagespan-calculator", engine_version: "0.1.0" }),
    calcHealth: async () => ({ ok: true }),
  };
});

const control = (calc as unknown as { __control: { mode: Mode } }).__control;
const actor = (user_id: string, org_id: string, role: Actor["role"]): Actor => ({ user_id, org_id, role, display_name: user_id, actor_type: "SIMULATED_REVIEWER", mode: "DEMO" });
const analyst = actor("user_hp_analyst", "org_harborpoint", "ANALYST");
const advisor = actor("user_hp_advisor", "org_harborpoint", "ADVISOR");
const cco = actor("user_hp_cco", "org_harborpoint", "COMPLIANCE");
const RATIONALE = "Custodian statement is primary evidence and governs the year-end balance.";
const DISPOSITION = "Imported figure predates the custodian statement; the computed amount governs.";

const statusOf = (store: MemoryStore, id: string) => store.read().households.find((h) => h.id === id)!.workflow_status;
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
function dispositionAll(store: MemoryStore) {
  for (const d of store.read().discrepancies.filter((x) => x.household_id === "hh_patel" && x.status === "OPEN")) store.mutate((s) => dispositionDiscrepancy(s, advisor, d.id, DISPOSITION));
}
function approve(store: MemoryStore) {
  return store.mutate((s) => approveReview(s, cco, "hh_patel", { rationale: "Approved after review of evidence and receipts.", conflictAttestation: true }));
}

beforeEach(() => {
  control.mode = "ok";
});

describe("S-07: calculator requests come from the frozen snapshot alone", () => {
  it("payload v2 records policy (with hash), vendor label and account classification; the request uses only the payload", () => {
    const store = new MemoryStore();
    const snap = patelToFrozen(store);
    const p = snap.canonical_payload;
    expect(p.snapshot_version).toBe("sagespan.snapshot.v2");
    expect(p.policy.tolerance).toEqual({ absolute: "1.00", relative: "0.001" });
    expect(p.policy.policy_sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(p.household.source_tool_label).toBe("Planning tool export (synthetic)");
    expect(p.accounts).toEqual([{ id: "acct_patel_trad_ira", account_type: "TRADITIONAL_IRA", tax_character: "PRE_TAX" }]);
    const req = buildRmdRequest(snap, "acct_patel_trad_ira");
    expect(req.tolerance).toEqual(p.policy.tolerance);
    expect(req.imported_comparison?.vendor_label).toBe("Planning tool export (synthetic)");
  });

  it("changing live firm policy and the household label AFTER freeze leaves the request and its hash unchanged (the audit's S-07 probe, inverted)", async () => {
    const store = new MemoryStore();
    const snap = patelToFrozen(store);
    const before = JSON.stringify(buildRmdRequest(snap, "acct_patel_trad_ira"));
    store.mutate((s) => {
      s.organizations.find((o) => o.id === "org_harborpoint")!.policies.tolerance.absolute = "25.00";
      s.households.find((h) => h.id === "hh_patel")!.source_tool_label = "Renamed vendor";
      s.accounts.find((a) => a.id === "acct_patel_trad_ira")!.label = "Renamed account";
    });
    const frozen = store.read().snapshots.find((x) => x.id === snap.id)!;
    expect(JSON.stringify(buildRmdRequest(frozen, "acct_patel_trad_ira"))).toBe(before);
    expect(frozen.canonical_payload.policy.tolerance.absolute).toBe("1.00");
    // a NEW freeze would record the new policy version
    const b = householdBundle(store.read(), "org_harborpoint", "hh_patel");
    expect(buildSnapshotPayload(b, 99).policy.policy_sha256).not.toBe(frozen.canonical_payload.policy.policy_sha256);
    expect(policyRecord(b.org.policies).tolerance.absolute).toBe("25.00");
  });

  it("policyRecord sorts approver roles in byte order so the hash does not depend on input order", () => {
    const a = policyRecord({ separation_of_duties: true, allow_nonmaterial_exceptions: false, approver_roles: ["COMPLIANCE", "ADVISOR"], tolerance: { absolute: "1.00", relative: "0.001" } });
    const b = policyRecord({ separation_of_duties: true, allow_nonmaterial_exceptions: false, approver_roles: ["ADVISOR", "COMPLIANCE"], tolerance: { absolute: "1.00", relative: "0.001" } });
    expect(a.policy_sha256).toBe(b.policy_sha256);
    expect(a.approver_roles).toEqual(["ADVISOR", "COMPLIANCE"]);
  });

  it("a request cannot be built from a pre-PR-002 (v1) snapshot", () => {
    const store = new MemoryStore();
    const snap = patelToFrozen(store);
    const legacy = { ...snap, canonical_payload: { ...snap.canonical_payload, snapshot_version: "sagespan.snapshot.v1" as unknown as "sagespan.snapshot.v2" } };
    expect(codeOf(() => buildRmdRequest(legacy, "acct_patel_trad_ira"))).toBe("SNAPSHOT_VERSION_UNSUPPORTED");
  });
});

describe("N-02: the latest attempt per account governs; history is kept", () => {
  it("ERROR then PASS: the retry recovers, the failed run stays as history, the household advances and approval succeeds", async () => {
    const store = new MemoryStore();
    const snap = patelToFrozen(store);
    control.mode = "down";
    const first = await runRmdChecks(store, analyst, "hh_patel");
    expect(first.runs[0]!.run_status).toBe("ERROR");
    expect(statusOf(store, "hh_patel")).toBe("FROZEN");
    control.mode = "ok";
    await new Promise((r) => setTimeout(r, 2));
    const second = await runRmdChecks(store, analyst, "hh_patel");
    expect(second.errors).toEqual([]);
    expect(statusOf(store, "hh_patel")).toBe("CHECK_COMPLETE");
    const runs = store.read().check_runs.filter((r) => r.snapshot_id === snap.id);
    expect(runs).toHaveLength(2);
    const { latest, superseded } = latestCheckRuns(runs, snap.id);
    expect(latest.map((r) => r.id)).toEqual([second.runs[0]!.id]);
    expect(superseded.map((r) => r.id)).toEqual([first.runs[0]!.id]);
    store.mutate((s) => sendToReview(s, analyst, "hh_patel"));
    dispositionAll(store);
    store.mutate((s) => recordReview(s, advisor, "hh_patel", "Reviewed after the retry; the earlier failure is history."));
    const review = approve(store);
    expect(review.decision).toBe("APPROVED");
    expect(review.coverage_summary?.superseded_attempts).toBe(1);
    expect(review.coverage_summary?.error).toBe(0);
  });

  it("PASS then ERROR: the newer failure governs and approval is refused (CHECK_FAILED_LATEST); the stale success does not carry", async () => {
    const store = new MemoryStore();
    patelToFrozen(store);
    await runRmdChecks(store, analyst, "hh_patel");
    expect(statusOf(store, "hh_patel")).toBe("CHECK_COMPLETE");
    await new Promise((r) => setTimeout(r, 2));
    control.mode = "bad_hash";
    const retry = await runRmdChecks(store, analyst, "hh_patel");
    expect(retry.runs[0]!.run_status).toBe("ERROR");
    store.mutate((s) => sendToReview(s, analyst, "hh_patel"));
    dispositionAll(store);
    store.mutate((s) => recordReview(s, advisor, "hh_patel", "Reviewed on the earlier success before noticing the regression."));
    expect(codeOf(() => approve(store))).toBe("CHECK_FAILED_LATEST");
    expect(store.read().reviews.some((r) => r.household_id === "hh_patel" && r.decision === "APPROVED")).toBe(false);
    // and the history still holds both attempts
    expect(store.read().check_runs.filter((r) => r.household_id === "hh_patel")).toHaveLength(2);
  });

  it("an account in the frozen payload with no run at all is NOT_RUN and blocks (CHECK_REQUIRED)", () => {
    const store = new MemoryStore();
    const snap = patelToFrozen(store);
    const b = householdBundle(store.read(), "org_harborpoint", "hh_patel");
    const summary = coverageSummary(snap, b.checkRuns, b.discrepancies);
    expect(summary.not_run).toBe(1);
    expect(approvalReadiness(summary)).toMatchObject({ ready: false, code: "CHECK_REQUIRED" });
    expect(packetTitle(summary, null)).toContain("checks incomplete");
  });
});

describe("S-06: typed coverage outcomes; unsupported-only is never 'verified'", () => {
  it("a household whose only account is UNSUPPORTED can be approved, but the outcome is REVIEWED_WITH_LIMITATIONS and the packet says so (the audit's S-06 probe, inverted)", async () => {
    const store = new MemoryStore();
    patelToFrozen(store);
    control.mode = "unsupported";
    const out = await runRmdChecks(store, analyst, "hh_patel");
    expect(out.runs[0]!.run_status).toBe("UNSUPPORTED");
    expect(statusOf(store, "hh_patel")).toBe("CHECK_COMPLETE");
    store.mutate((s) => sendToReview(s, analyst, "hh_patel"));
    store.mutate((s) => recordReview(s, advisor, "hh_patel", "Reviewed; the account is outside the supported RMD scope."));
    const review = approve(store);
    expect(review.decision).toBe("APPROVED");
    expect(review.coverage_outcome).toBe("REVIEWED_WITH_LIMITATIONS");
    expect(review.coverage_summary).toMatchObject({ accounts_in_scope: 1, verified: 0, unsupported: 1 });
    const state = store.read();
    const pkt = buildPacket(householdBundle(state, "org_harborpoint", "hh_patel"), cco, state);
    expect(pkt.title).toContain("reviewed with limitations");
    expect(pkt.title).toContain("no supported checks");
    expect(pkt.coverage.outcome).toBe("REVIEWED_WITH_LIMITATIONS");
    expect(pkt.scope.accounts[0]!.coverage).toBe("UNSUPPORTED");
    expect(pkt.scope.accounts_verified).toBe(0);
    expect(JSON.stringify(pkt)).not.toMatch(/supported check verified/i);
  });

  it("a fully verified household with a dispositioned SOURCE_CONFLICT is APPROVED_WITH_EXCEPTIONS; the packet title reflects it", async () => {
    const store = new MemoryStore();
    patelToFrozen(store); // includes a documented nonmaterial exception
    await runRmdChecks(store, analyst, "hh_patel");
    store.mutate((s) => sendToReview(s, analyst, "hh_patel"));
    dispositionAll(store);
    store.mutate((s) => recordReview(s, advisor, "hh_patel", "Reviewed the discrepancy and the documented exception."));
    const review = approve(store);
    expect(review.coverage_outcome).toBe("APPROVED_WITH_EXCEPTIONS");
    expect(review.coverage_summary).toMatchObject({ verified: 1, documented_exceptions: 1, dispositioned_material_differences: 1 });
    const state = store.read();
    const pkt = buildPacket(householdBundle(state, "org_harborpoint", "hh_patel"), cco, state);
    expect(pkt.title).toContain("approved with exceptions");
    expect(pkt.check_runs.every((r) => r.latest_attempt)).toBe(true);
    expect(pkt.packet_version).toBe("sagespan.evidence-packet.v2");
  });

  it("SUPPORTED_CHECK_VERIFIED requires no exceptions and no material dispositions; pure function cases", () => {
    const snap = { id: "snap_x", canonical_payload: { accounts: [{ id: "a1", account_type: "TRADITIONAL_IRA", tax_character: "PRE_TAX" }, { id: "a2", account_type: "ROTH_IRA", tax_character: "ROTH" }], exceptions: [] } } as unknown as Parameters<typeof coverageSummary>[0];
    const mk = (id: string, account: string, status: CheckRun["run_status"], at: string, verified = true): CheckRun =>
      ({ id, snapshot_id: "snap_x", check_type: "RMD_ANNUAL", run_status: status, coverage_status: status === "PASS" ? "SUPPORTED_VERIFIED" : status === "ERROR" ? null : "UNSUPPORTED", request_hash_verified: verified, executed_at: at, request_payload: { account: { account_ref: account } } }) as unknown as CheckRun;
    // both verified, no exceptions -> verified
    let s = coverageSummary(snap, [mk("r1", "a1", "PASS", "2026-11-06T10:00:00Z"), mk("r2", "a2", "NOT_REQUIRED", "2026-11-06T10:00:00Z")], []);
    expect(approvalReadiness(s)).toEqual({ ready: true, outcome: "SUPPORTED_CHECK_VERIFIED" });
    expect(packetTitle(s, "SUPPORTED_CHECK_VERIFIED")).toBe("Review evidence packet — supported check verified (2 of 2 accounts)");
    // one unsupported -> limitations, regardless of exceptions
    s = coverageSummary({ ...snap, canonical_payload: { ...snap.canonical_payload, exceptions: [{ id: "c1" }] } } as typeof snap, [mk("r1", "a1", "PASS", "2026-11-06T10:00:00Z"), mk("r2", "a2", "UNSUPPORTED", "2026-11-06T10:00:00Z")], []);
    expect(approvalReadiness(s)).toEqual({ ready: true, outcome: "REVIEWED_WITH_LIMITATIONS" });
    // latest wins by executed_at: an older PASS and a newer ERROR for a1
    s = coverageSummary(snap, [mk("r1", "a1", "PASS", "2026-11-06T10:00:00Z"), mk("r3", "a1", "ERROR", "2026-11-06T10:05:00Z", false), mk("r2", "a2", "PASS", "2026-11-06T10:00:00Z")], []);
    expect(s.rows.find((r) => r.account_ref === "a1")).toMatchObject({ latest_run_id: "r3", coverage: "ERROR", superseded_run_ids: ["r1"] });
    expect(approvalReadiness(s)).toMatchObject({ ready: false, code: "CHECK_FAILED_LATEST" });
    // a PASS without a verified receipt is an ERROR for coverage purposes
    s = coverageSummary(snap, [mk("r1", "a1", "PASS", "2026-11-06T10:00:00Z", false), mk("r2", "a2", "PASS", "2026-11-06T10:00:00Z")], []);
    expect(approvalReadiness(s)).toMatchObject({ ready: false, code: "CHECK_RECEIPT_UNVERIFIED" });
  });

  it("the approver cannot choose the outcome: it is derived server-side and audited", async () => {
    const store = new MemoryStore();
    patelToFrozen(store);
    control.mode = "unsupported";
    await runRmdChecks(store, analyst, "hh_patel");
    store.mutate((s) => sendToReview(s, analyst, "hh_patel"));
    store.mutate((s) => recordReview(s, advisor, "hh_patel", "Reviewed; outside supported scope."));
    approve(store);
    const audit = store.read().audit_events.filter((e) => e.org_id === "org_harborpoint" && e.event_type === "APPROVAL_RECORDED").at(-1)!;
    expect(audit.summary).toContain("REVIEWED_WITH_LIMITATIONS");
    expect(audit.summary).toContain("0 of 1 accounts verified");
    // policy changes after approval never alter the recorded outcome
    store.mutate((s) => updatePolicy(s, cco, { approver_roles: ["COMPLIANCE", "ADVISOR"] }));
    expect(store.read().reviews.find((r) => r.decision === "APPROVED")!.coverage_outcome).toBe("REVIEWED_WITH_LIMITATIONS");
  });
});
