// Audit probes 2026-11-05 (see docs/audits/REPOSITORY_AUDIT_2026-11-05_v2.md). Each `it` asserts the unsafe behaviour AS OF THE AUDIT, so a passing probe = finding confirmed.
// Excluded from Vitest on purpose (not *.test.ts). To reproduce: copy to audit-probes.test.ts, run `npx vitest run audit-probes`, then delete the copy.
// PR-001 inverted S-04, N-01, N-05 into __tests__/trust-boundaries.test.ts; PR-002 inverted S-06, S-07 and N-02 into __tests__/pr-002-coverage.test.ts.
// The S-06 / S-07 / N-02 probes below are kept verbatim as the historical record and are EXPECTED TO FAIL on the current code (the finding is fixed).
import { describe, expect, it, vi } from "vitest";
import type { Actor } from "@/auth/types";
import { buildRmdRequest, runRmdChecks, sendToReview } from "@/domain/checks";
import { generatePacket } from "@/domain/evidence";
import { freezeSnapshot } from "@/domain/freeze";
import { householdBundle } from "@/domain/queries";
import { approveReview, dispositionDiscrepancy, documentException, recordReview, resolveConflict, updatePolicy } from "@/domain/review";
import { MemoryStore } from "@/domain/store";
import * as calc from "@/provenance/calc-client";

vi.mock("@/provenance/calc-client", async () => {
  const { canonicalHash } = await import("@sagespan/contracts");
  const expected = (await import("../../../../../fixtures/synthetic/calc/patel_rmd_expected_response.json")).default;
  class CalcServiceError extends Error {
    constructor(public readonly code: string, message: string, public readonly status: number | null = null) { super(message); this.name = "CalcServiceError"; }
  }
  const control = { fail: false, hashOk: true, status: "PASS" as string };
  return {
    CalcServiceError, __control: control,
    callRmdCheck: async (request: { snapshot_ref?: unknown; imported_comparison?: { import_value_ref: string } | null }, orgId: string) => {
      if (control.fail) throw new CalcServiceError("SERVICE_UNAVAILABLE", "unreachable (probe)");
      const requestHash = await canonicalHash(request);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- probe mock mutates the fixture loosely on purpose
      const response = structuredClone(expected) as unknown as Record<string, any>;
      response.receipt.request_hash = control.hashOk ? requestHash : "0".repeat(64);
      response.receipt.org_context.org_id = orgId;
      response.receipt.snapshot_ref = request.snapshot_ref ?? null;
      response.discrepancy.import_value_ref = request.imported_comparison?.import_value_ref ?? null;
      if (control.status !== "PASS") { response.result_status = control.status; response.coverage_status = "UNSUPPORTED"; response.discrepancy = null; response.annual_rmd = null; }
      return { response, requestHash, requestHashVerified: control.hashOk };
    },
    fetchRuleSets: async () => ({ rule_sets: expected.receipt.rule_sets, engine_name: "mock", engine_version: "0.1.0" }),
    calcHealth: async () => ({ ok: true }),
  };
});
const control = (calc as unknown as { __control: { fail: boolean; hashOk: boolean; status: string } }).__control;
const actor = (user_id: string, role: Actor["role"]): Actor => ({ user_id, org_id: "org_harborpoint", role, display_name: user_id, actor_type: "SIMULATED_REVIEWER", mode: "DEMO" });
const analyst = actor("user_hp_analyst", "ANALYST"), advisor = actor("user_hp_advisor", "ADVISOR"), cco = actor("user_hp_cco", "COMPLIANCE");
const R = "Custodian statement is primary evidence and governs the year-end balance.";
const status = (s: MemoryStore) => s.read().households.find((h) => h.id === "hh_patel")!.workflow_status;
function frozen(store: MemoryStore) {
  store.mutate((s) => resolveConflict(s, analyst, "conf_patel_balance", "f_patel_bal_stmt", R));
  store.mutate((s) => documentException(s, cco, "conf_patel_custodian", "Label difference is cosmetic; custodian identity confirmed."));
  return store.mutate((s) => freezeSnapshot(s, analyst, "hh_patel"));
}
async function toReviewed(store: MemoryStore) {
  await runRmdChecks(store, analyst, "hh_patel");
  store.mutate((s) => sendToReview(s, analyst, "hh_patel"));
  store.mutate((s) => recordReview(s, advisor, "hh_patel", "Reviewed the receipt and discrepancy."));
  for (const d of store.read().discrepancies.filter((x) => x.household_id === "hh_patel" && x.status === "OPEN")) store.mutate((s) => dispositionDiscrepancy(s, advisor, d.id, "Plan used a superseded balance; re-run plan."));
}
const approve = (store: MemoryStore) => store.mutate((s) => approveReview(s, cco, "hh_patel", { rationale: "Approval rationale for probe purposes.", conflictAttestation: true }));

describe("audit probes (TS tier)", () => {
  it("S-04: a receipt whose request_hash does NOT match still completes the check and is approvable", async () => {
    Object.assign(control, { fail: false, hashOk: false, status: "PASS" });
    const store = new MemoryStore(); frozen(store);
    const out = await runRmdChecks(store, analyst, "hh_patel");
    expect(out.runs[0]!.request_hash_verified).toBe(false);
    expect(status(store)).toBe("CHECK_COMPLETE");
    await toReviewed(store);
    expect(approve(store).decision).toBe("APPROVED");
    const pkt = store.mutate((s) => generatePacket(s, cco, "hh_patel"));
    expect(pkt.sha256).toMatch(/^[0-9a-f]{64}$/);
  });
  it("S-06: a household whose only run is UNSUPPORTED is APPROVED and exported like a verified one", async () => {
    Object.assign(control, { fail: false, hashOk: true, status: "UNSUPPORTED" });
    const store = new MemoryStore(); frozen(store);
    await toReviewed(store);
    expect(approve(store).decision).toBe("APPROVED");
    const pkt = store.mutate((s) => generatePacket(s, cco, "hh_patel")).packet as { scope: { check_types: string[] } };
    expect(pkt.scope.check_types).toEqual(["RMD_ANNUAL"]);
  });
  it("N-02: one transient service failure blocks approval of that snapshot forever, even after a successful retry", async () => {
    Object.assign(control, { fail: true, hashOk: true, status: "PASS" });
    const store = new MemoryStore(); frozen(store);
    await runRmdChecks(store, analyst, "hh_patel");
    expect(status(store)).toBe("FROZEN");
    control.fail = false;
    await toReviewed(store);
    expect(status(store)).toBe("REVIEWED");
    expect(() => approve(store)).toThrow(/independent check is required/);
  });
  it("N-01: a disposition can be overwritten after approval", async () => {
    Object.assign(control, { fail: false, hashOk: true, status: "PASS" });
    const store = new MemoryStore(); frozen(store); await toReviewed(store); approve(store);
    const d = store.read().discrepancies.find((x) => x.household_id === "hh_patel")!;
    store.mutate((s) => dispositionDiscrepancy(s, advisor, d.id, "Rewritten after approval by the same advisor."));
    expect(store.read().discrepancies.find((x) => x.id === d.id)!.disposition!.note).toMatch(/Rewritten/);
  });
  it("S-07: the check request for a frozen snapshot changes when live (unfrozen) org policy changes", () => {
    const store = new MemoryStore(); const snap = frozen(store);
    const s1 = store.read(); const b1 = householdBundle(s1, "org_harborpoint", "hh_patel");
    const r1 = JSON.stringify(buildRmdRequest(snap, b1.accounts[0]!.id)); // PR-002 signature: snapshot only
    const s2 = store.read(); s2.organizations.find((o) => o.id === "org_harborpoint")!.policies.tolerance.absolute = "25.00";
    const b2 = householdBundle(s2, "org_harborpoint", "hh_patel");
    expect(JSON.stringify(buildRmdRequest(snap, b2.accounts[0]!.id))).not.toBe(r1); // fails after PR-002: the request is now constant
  });
  it("N-05: firm policy can name ADVISOR as approver, but the TS tier still refuses ADVISOR approval (SQL tier would allow it)", async () => {
    Object.assign(control, { fail: false, hashOk: true, status: "PASS" });
    const store = new MemoryStore();
    store.mutate((s) => updatePolicy(s, cco, { approver_roles: ["ADVISOR"], separation_of_duties: false }));
    frozen(store); await toReviewed(store);
    expect(() => store.mutate((s) => approveReview(s, advisor, "hh_patel", { rationale: "Advisor approval under firm policy.", conflictAttestation: true }))).toThrow(/Permission denied/);
  });
});
