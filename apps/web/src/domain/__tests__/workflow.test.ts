import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Actor } from "@/auth/types";
import { verifyAuditChain } from "@/domain/audit";
import { runRmdChecks, sendToReview } from "@/domain/checks";
import { DomainError } from "@/domain/errors";
import { factsCsv, generatePacket, renderPacketHtml } from "@/domain/evidence";
import { evaluateGateFromBundle, freezeSnapshot } from "@/domain/freeze";
import { createImport, suggestEntityMapping, applyColumnMapping } from "@/domain/imports";
import { householdBundle, householdOrNull, listHouseholds } from "@/domain/queries";
import { reconcileImport } from "@/domain/reconcile";
import { addComment, approveReview, dispositionDiscrepancy, documentException, recordAssumption, recordReview, resolveConflict, updatePolicy } from "@/domain/review";
import { loadSeed } from "@/domain/seed";
import { MemoryStore } from "@/domain/store";
import * as calc from "@/provenance/calc-client";

const FIX = path.resolve(__dirname, "../../../../../fixtures/synthetic");
const HEX64 = /^[0-9a-f]{64}$/;

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
  const control = { fail: false };
  return {
    CalcServiceError,
    __control: control,
    callRmdCheck: async (request: { snapshot_ref?: unknown; imported_comparison?: { import_value_ref: string } | null }, orgId: string) => {
      if (control.fail) throw new CalcServiceError("SERVICE_UNAVAILABLE", "Calculation service is unreachable (test)");
      const requestHash = await canonicalHash(request);
      const response = structuredClone(expected) as typeof expected & { receipt: { request_hash: string; org_context: { org_id: string }; snapshot_ref: unknown }; discrepancy: { import_value_ref: string | null } };
      response.receipt.request_hash = requestHash;
      response.receipt.org_context.org_id = orgId;
      response.receipt.snapshot_ref = request.snapshot_ref ?? null;
      response.discrepancy.import_value_ref = request.imported_comparison?.import_value_ref ?? null;
      return { response, requestHash, requestHashVerified: true };
    },
    fetchRuleSets: async () => ({ rule_sets: expected.receipt.rule_sets, engine_name: "mock", engine_version: "0.1.0" }),
    calcHealth: async () => ({ ok: true }),
  };
});

const control = (calc as unknown as { __control: { fail: boolean } }).__control;

const actor = (user_id: string, org_id: string, role: Actor["role"]): Actor => ({ user_id, org_id, role, display_name: user_id, actor_type: "SIMULATED_REVIEWER", mode: "DEMO" });
const analyst = actor("user_hp_analyst", "org_harborpoint", "ANALYST");
const advisor = actor("user_hp_advisor", "org_harborpoint", "ADVISOR");
const cco = actor("user_hp_cco", "org_harborpoint", "COMPLIANCE");
const admin = actor("user_hp_admin", "org_harborpoint", "ADMIN");
const viewer = actor("user_hp_viewer", "org_harborpoint", "VIEWER");
const nlCco = actor("user_nl_cco", "org_northline", "COMPLIANCE");

const RATIONALE = "Custodian statement is primary evidence and governs the year-end balance.";

function statusOf(store: MemoryStore, id: string) {
  return store.read().households.find((h) => h.id === id)!.workflow_status;
}

/** Drive Patel from seeded BLOCKED to FROZEN. */
function patelToFrozen(store: MemoryStore, freezer: Actor = analyst) {
  store.mutate((s) => resolveConflict(s, analyst, "conf_patel_balance", "f_patel_bal_stmt", RATIONALE));
  store.mutate((s) => documentException(s, cco, "conf_patel_custodian", "Label difference is cosmetic; custodian identity confirmed on profile."));
  return store.mutate((s) => freezeSnapshot(s, freezer, "hh_patel"));
}

describe("seed integrity", () => {
  it("every seeded source document hash matches the fixture file", () => {
    const seed = loadSeed();
    for (const doc of seed.source_documents) {
      const file = ["sources", "imports"].map((d) => path.join(FIX, d, doc.filename)).find((p) => {
        try {
          readFileSync(p);
          return true;
        } catch {
          return false;
        }
      });
      expect(file, doc.filename).toBeDefined();
      const bytes = readFileSync(file!);
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(doc.sha256);
      expect(bytes.byteLength).toBe(doc.byte_length);
    }
  });
});

describe("Patel: conflict -> resolution -> freeze -> check -> review -> approval -> packet", () => {
  let store: MemoryStore;
  beforeEach(() => {
    control.fail = false;
    store = new MemoryStore();
  });

  it("freeze is blocked by a material balance conflict and a nonmaterial label conflict", () => {
    const s = store.read();
    const gate = evaluateGateFromBundle(householdBundle(s, "org_harborpoint", "hh_patel"));
    expect(gate.canFreeze).toBe(false);
    const codes = gate.blockers.map((b) => b.code);
    expect(codes).toContain("OPEN_MATERIAL_CONFLICT");
    expect(codes).toContain("OPEN_NONMATERIAL_CONFLICT");
    const material = gate.blockers.find((b) => b.code === "OPEN_MATERIAL_CONFLICT")!;
    expect(material.message).toMatch(/640,000\.00/);
    expect(material.message).toMatch(/612,000\.00/);
    expect(material.how_to_resolve).toMatch(/primary evidence governs/);
    expect(() => store.mutate((x) => freezeSnapshot(x, analyst, "hh_patel"))).toThrow(DomainError);
    expect(statusOf(store, "hh_patel")).toBe("BLOCKED");
  });

  it("an analyst cannot resolve a material conflict in favour of the planning-tool value", () => {
    expect(() => store.mutate((s) => resolveConflict(s, analyst, "conf_patel_balance", "f_patel_bal_plan", "The plan value looks fine to me."))).toThrow(/primary evidence/);
    expect(() => store.mutate((s) => resolveConflict(s, analyst, "conf_patel_balance", "f_patel_bal_stmt", "short"))).toThrow(/rationale/);
    expect(() => store.mutate((s) => resolveConflict(s, viewer, "conf_patel_balance", "f_patel_bal_stmt", RATIONALE))).toThrow(/Permission denied/);
  });

  it("resolution creates a new fact revision and keeps the rejected value as history", () => {
    store.mutate((s) => resolveConflict(s, analyst, "conf_patel_balance", "f_patel_bal_stmt", RATIONALE));
    const s = store.read();
    const conflict = s.fact_conflicts.find((c) => c.id === "conf_patel_balance")!;
    expect(conflict.status).toBe("RESOLVED");
    const chosen = s.facts.find((f) => f.id === conflict.chosen_fact_id)!;
    expect(chosen.revision).toBe(2);
    expect(chosen.supersedes_fact_id).toBe("f_patel_bal_stmt");
    expect(chosen.verification_status).toBe("FACT_CONFIRMED");
    expect(chosen.value_number).toBe("640000.00");
    expect(s.facts.find((f) => f.id === "f_patel_bal_plan")!.superseded).toBe(true);
    expect(s.facts.find((f) => f.id === "f_patel_bal_stmt")!.superseded).toBe(true);
    expect(statusOf(store, "hh_patel")).toBe("BLOCKED"); // nonmaterial conflict remains
    expect(() => store.mutate((x) => documentException(x, analyst, "conf_patel_custodian", "Cosmetic label difference only."))).toThrow(/Permission denied/);
    store.mutate((x) => documentException(x, cco, "conf_patel_custodian", "Cosmetic label difference only."));
    expect(statusOf(store, "hh_patel")).toBe("READY_TO_FREEZE");
  });

  it("runs the full flow to an exported evidence packet", async () => {
    expect(() => store.mutate((s) => freezeSnapshot(s, viewer, "hh_patel"))).toThrow(/Permission denied/);
    const snap = patelToFrozen(store);
    expect(snap.content_sha256).toMatch(HEX64);
    expect(snap.revision).toBe(1);
    expect(snap.canonical_payload.facts.find((f) => f.field_key === "account.year_end_balance")?.value_number).toBe("640000.00");
    expect(snap.canonical_payload.facts.some((f) => f.value_number === "612000.00")).toBe(false);
    expect(snap.canonical_payload.exceptions).toHaveLength(1);
    expect(statusOf(store, "hh_patel")).toBe("FROZEN");

    const outcome = await runRmdChecks(store, analyst, "hh_patel");
    expect(outcome.errors).toEqual([]);
    const run = outcome.runs[0]!;
    expect(run.run_status).toBe("PASS");
    expect(run.request_hash_verified).toBe(true);
    expect(run.response?.annual_rmd).toBe("25098.04");
    expect(run.request_payload.account.prior_year_end_balance?.amount).toBe("640000.00");
    expect(run.request_payload.imported_comparison?.amount).toBe("24000.00");
    expect(run.request_payload.snapshot_ref?.input_hash).toBe(snap.content_sha256);
    expect(run.request_payload).not.toHaveProperty("org_id");
    expect(run.request_payload.beneficiaries?.find((b) => b.relationship === "SPOUSE")?.birth_date).toBe("1955-07-02");
    expect(statusOf(store, "hh_patel")).toBe("CHECK_COMPLETE");
    const disc = store.read().discrepancies.find((d) => d.check_run_id === run.id)!;
    expect(disc.classification).toBe("SOURCE_CONFLICT");
    expect(disc.delta_amount).toBe("1098.04");

    store.mutate((s) => sendToReview(s, analyst, "hh_patel"));
    expect(statusOf(store, "hh_patel")).toBe("REVIEW_PENDING");
    expect(() => store.mutate((s) => approveReview(s, analyst, "hh_patel", { rationale: RATIONALE, conflictAttestation: true }))).toThrow(/Permission denied/);
    expect(() => store.mutate((s) => approveReview(s, admin, "hh_patel", { rationale: RATIONALE, conflictAttestation: true }))).toThrow(/Permission denied/);
    expect(() => store.mutate((s) => recordReview(s, analyst, "hh_patel", "Reviewed the receipt and discrepancy."))).toThrow(/Permission denied/);
    store.mutate((s) => recordReview(s, advisor, "hh_patel", "Reviewed the receipt and discrepancy."));
    expect(statusOf(store, "hh_patel")).toBe("REVIEWED");
    expect(() => store.mutate((s) => approveReview(s, cco, "hh_patel", { rationale: RATIONALE, conflictAttestation: true }))).toThrow(/disposition/);
    store.mutate((s) => dispositionDiscrepancy(s, advisor, disc.id, "Plan used a superseded balance; advisor to re-run the plan with the confirmed value."));
    expect(() => store.mutate((s) => approveReview(s, cco, "hh_patel", { rationale: RATIONALE, conflictAttestation: false }))).toThrow(/attest/);
    const review = store.mutate((s) => approveReview(s, cco, "hh_patel", { rationale: "Independent check reproduced; difference attributable to plan input.", conflictAttestation: true }));
    expect(review.decision).toBe("APPROVED");
    expect(review.actor_type).toBe("SIMULATED_REVIEWER");
    expect(review.reviewer_role).toBe("COMPLIANCE");
    expect(statusOf(store, "hh_patel")).toBe("APPROVED");

    expect(() => store.mutate((s) => generatePacket(s, viewer, "hh_patel"))).toThrow(/Permission denied/);
    const pkt = store.mutate((s) => generatePacket(s, cco, "hh_patel"));
    expect(pkt.sha256).toMatch(HEX64);
    expect(statusOf(store, "hh_patel")).toBe("EXPORTED");
    const packet = pkt.packet as { snapshot: { content_sha256: string }; engine: { version: string }; rule_sets: Array<{ rule_set_id: string; checksum: string }>; limitations: string[]; reviews: Array<{ decision: string }>; discrepancies: Array<{ classification: string }>; not_checked: string[]; title: string };
    expect(packet.title).toBe("Review evidence packet");
    expect(packet.snapshot.content_sha256).toBe(snap.content_sha256);
    expect(packet.engine.version).toBe("0.1.0");
    expect(packet.rule_sets.map((r) => r.rule_set_id)).toContain("rmd.uniform_lifetime_table");
    expect(packet.limitations.join(" ")).toMatch(/not an SEC examination certification/);
    expect(packet.not_checked.length).toBeGreaterThan(3);
    expect(packet.reviews[0]?.decision).toBe("APPROVED");
    expect(packet.discrepancies[0]?.classification).toBe("SOURCE_CONFLICT");
    const html = renderPacketHtml(pkt);
    expect(html).toContain("Review evidence packet");
    expect(html).toContain(pkt.sha256);
    expect(html).toContain("25,098.04");
    expect(html).toContain("synthetic");
    const csv = factsCsv(pkt);
    expect(csv.startsWith("subject,fact,value")).toBe(true);
    const again = store.mutate((s) => generatePacket(s, cco, "hh_patel"));
    expect(again.id).toBe(pkt.id);
    expect(again.export_count).toBe(2);
    expect(store.read().audit_events.filter((e) => e.event_type === "PACKET_EXPORTED")).toHaveLength(1);
    expect(verifyAuditChain(store.read(), "org_harborpoint").intact).toBe(true);
  });

  it("separation of duties blocks an approver who froze the snapshot or ran the check", async () => {
    patelToFrozen(store, cco);
    await runRmdChecks(store, cco, "hh_patel");
    store.mutate((s) => sendToReview(s, cco, "hh_patel"));
    store.mutate((s) => recordReview(s, advisor, "hh_patel", "Reviewed the receipt and discrepancy."));
    const disc = store.read().discrepancies[0]!;
    store.mutate((s) => dispositionDiscrepancy(s, advisor, disc.id, "Attributable to plan input; advisor to re-run plan."));
    expect(() => store.mutate((s) => approveReview(s, cco, "hh_patel", { rationale: RATIONALE, conflictAttestation: true }))).toThrow(/Separation of duties/);
    expect(store.read().audit_events.some((e) => e.event_type === "APPROVAL_DENIED")).toBe(true);
    expect(() => store.mutate((s) => updatePolicy(s, analyst, { separation_of_duties: false }))).toThrow(/Permission denied/);
    store.mutate((s) => updatePolicy(s, cco, { separation_of_duties: false }));
    const review = store.mutate((s) => approveReview(s, cco, "hh_patel", { rationale: RATIONALE, conflictAttestation: true }));
    expect(review.decision).toBe("APPROVED");
  });

  it("a frozen snapshot is immutable; later facts open a new revision with a new hash", async () => {
    const snap1 = patelToFrozen(store);
    const frozenPayload = structuredClone(snap1.canonical_payload);
    await runRmdChecks(store, analyst, "hh_patel");
    store.mutate((s) => recordAssumption(s, advisor, "hh_patel", "ACCOUNT", "acct_patel_trad_ira", "account.custodian_label", "Custodian A", "Custodian identity confirmed from the account profile (synthetic)."));
    expect(statusOf(store, "hh_patel")).toBe("READY_TO_FREEZE");
    const stored1 = store.read().snapshots.find((s) => s.id === snap1.id)!;
    expect(stored1.content_sha256).toBe(snap1.content_sha256);
    expect(stored1.canonical_payload).toEqual(frozenPayload);
    const snap2 = store.mutate((s) => freezeSnapshot(s, analyst, "hh_patel"));
    expect(snap2.revision).toBe(2);
    expect(snap2.id).not.toBe(snap1.id);
    expect(snap2.content_sha256).not.toBe(snap1.content_sha256);
    const after = store.read();
    expect(after.snapshots.find((s) => s.id === snap1.id)!.status).toBe("SUPERSEDED");
    expect(after.snapshots.find((s) => s.id === snap1.id)!.canonical_payload).toEqual(frozenPayload);
    expect(after.check_runs.every((r) => r.snapshot_id === snap1.id)).toBe(true); // old run stays attached to the old revision
  });

  it("when the calculation service is unavailable the check fails visibly and nothing is computed locally", async () => {
    patelToFrozen(store);
    control.fail = true;
    const outcome = await runRmdChecks(store, analyst, "hh_patel");
    expect(outcome.errors).toHaveLength(1);
    expect(outcome.errors[0]!.code).toBe("SERVICE_UNAVAILABLE");
    const run = outcome.runs[0]!;
    expect(run.run_status).toBe("ERROR");
    expect(run.response).toBeNull();
    expect(statusOf(store, "hh_patel")).toBe("FROZEN");
    expect(store.read().discrepancies).toHaveLength(0);
    expect(JSON.stringify(store.read())).not.toContain("25098.04");
    expect(store.read().audit_events.some((e) => e.event_type === "CHECK_RUN_FAILED")).toBe(true);
    control.fail = false;
  });

  it("rejects an approval forged through the API path for a role without permission (domain level)", () => {
    expect(() => store.mutate((s) => approveReview(s, viewer, "hh_patel", { rationale: RATIONALE, conflictAttestation: true }))).toThrow(/Permission denied/);
    expect(() => store.mutate((s) => approveReview(s, analyst, "hh_patel", { rationale: RATIONALE, conflictAttestation: true }))).toThrow(/Permission denied/);
  });
});

describe("Okafor: date-of-birth conflict then UNSUPPORTED", () => {
  it("blocks on the DOB conflict and can be resolved toward the custodian profile", () => {
    const store = new MemoryStore();
    const gate = evaluateGateFromBundle(householdBundle(store.read(), "org_harborpoint", "hh_okafor"));
    expect(gate.blockers.map((b) => b.field_key)).toContain("person.birth_date");
    store.mutate((s) => resolveConflict(s, advisor, "conf_okafor_dob", "f_okafor_dob_profile", "Custodian profile is the primary identity record."));
    expect(statusOf(store, "hh_okafor")).toBe("READY_TO_FREEZE");
    const snap = store.mutate((s) => freezeSnapshot(s, advisor, "hh_okafor"));
    expect(snap.canonical_payload.facts.find((f) => f.field_key === "person.birth_date" && f.subject_id === "person_okafor_adaeze")?.value_date).toBe("1951-09-20");
  });
});

describe("Reyes-Lindqvist: different as-of dates are freshness, not conflict", () => {
  let store: MemoryStore;
  beforeEach(() => {
    store = new MemoryStore();
  });

  it("imports the custodian statement, maps entities and clears the gate after a documented assumption", () => {
    const bytes = readFileSync(path.join(FIX, "imports", "reyes_custodian_statement_2025-12-31.json"));
    const before = evaluateGateFromBundle(householdBundle(store.read(), "org_harborpoint", "hh_reyes"));
    expect(before.canFreeze).toBe(false);
    expect(before.blockers.map((b) => b.code)).toContain("UNCONFIRMED_REQUIRED_FACT");
    expect(before.blockers.map((b) => b.code)).toContain("MISSING_BENEFICIARY_EVIDENCE");
    expect(() => store.mutate((s) => createImport(s, viewer, "hh_reyes", { filename: "x.json", mimeType: "application/json", bytes, sourceKind: "CUSTODIAN_STATEMENT", vendorLabel: null }))).toThrow(/Permission denied/);
    const { importRecord } = store.mutate((s) => createImport(s, analyst, "hh_reyes", { filename: "reyes_custodian_statement_2025-12-31.json", mimeType: "application/json", bytes, sourceKind: "CUSTODIAN_STATEMENT", vendorLabel: "Custodian C (synthetic)" }));
    expect(importRecord.import_status).toBe("MAPPED");
    expect(statusOf(store, "hh_reyes")).toBe("MAPPED");
    const doc = store.read().source_documents.find((d) => d.id === importRecord.source_document_id)!;
    expect(doc.sha256).toBe(createHash("sha256").update(bytes).digest("hex"));
    const suggestion = suggestEntityMapping(store.read(), analyst, importRecord.id)!;
    expect(suggestion.persons.find((p) => p.ref === "owner")?.suggested).toBe("person_reyes_luis");
    expect(suggestion.accounts.find((a) => a.ref === "ira1")?.suggested).toBe("acct_reyes_trad_ira");
    const summary = store.mutate((s) => reconcileImport(s, analyst, importRecord.id, { persons: { owner: "person_reyes_luis", spouse: "person_lindqvist_ingrid" }, accounts: { ira1: "acct_reyes_trad_ira" } }));
    expect(summary.conflictsOpened).toBe(0);
    expect(summary.corroborated).toBeGreaterThanOrEqual(3);
    const b = householdBundle(store.read(), "org_harborpoint", "hh_reyes");
    const balances = b.activeFacts.filter((f) => f.field_key === "account.year_end_balance");
    expect(balances).toHaveLength(2);
    const yearEnd = balances.find((f) => f.as_of_date === "2025-12-31")!;
    expect(yearEnd.verification_status).toBe("FACT_CONFIRMED");
    expect(yearEnd.note).toMatch(/not treated as a conflict/);
    expect(balances.find((f) => f.as_of_date === "2025-09-30")!.verification_status).toBe("NEEDS_CONFIRMATION");
    expect(b.activeFacts.find((f) => f.id === "f_reyes_dob_plan")!.verification_status).toBe("FACT_CONFIRMED");
    expect(b.beneficiaries.some((d) => d.account_id === "acct_reyes_trad_ira" && d.relationship === "SPOUSE")).toBe(true);
    const gate = evaluateGateFromBundle(b);
    expect(gate.blockers.map((x) => x.code)).toEqual(["MISSING_REQUIRED_FACT"]);
    expect(gate.blockers[0]!.field_key).toBe("person.is_alive");
    expect(statusOf(store, "hh_reyes")).toBe("BLOCKED");
    expect(() => store.mutate((s) => recordAssumption(s, analyst, "hh_reyes", "PERSON", "person_reyes_luis", "person.is_alive", "true", "No death notice; contact confirmed."))).toThrow(/Permission denied/);
    expect(() => store.mutate((s) => recordAssumption(s, advisor, "hh_reyes", "ACCOUNT", "acct_reyes_trad_ira", "account.year_end_balance", "1", "cannot assume a balance"))).toThrow(/primary evidence is required/);
    store.mutate((s) => recordAssumption(s, advisor, "hh_reyes", "PERSON", "person_reyes_luis", "person.is_alive", "true", "No death notice on file; client contact confirmed 2026-11-01 (synthetic)."));
    expect(statusOf(store, "hh_reyes")).toBe("READY_TO_FREEZE");
    const snap = store.mutate((s) => freezeSnapshot(s, advisor, "hh_reyes"));
    expect(snap.canonical_payload.facts.filter((f) => f.field_key === "account.year_end_balance")).toHaveLength(1);
    expect(snap.canonical_payload.assumptions[0]?.key).toBe("person.is_alive");
  });

  it("rejects unsupported uploads with an actionable explanation and leaves no partial state", () => {
    const docsBefore = store.read().source_documents.length;
    expect(() => store.mutate((s) => createImport(s, analyst, "hh_reyes", { filename: "statement.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", bytes: new Uint8Array([1, 2, 3]), sourceKind: "CUSTODIAN_STATEMENT", vendorLabel: null }))).toThrow(/not supported/);
    expect(() => store.mutate((s) => createImport(s, analyst, "hh_reyes", { filename: "big.csv", mimeType: "text/csv", bytes: new Uint8Array(3 * 1024 * 1024), sourceKind: "PLAN_EXPORT", vendorLabel: null }))).toThrow(/limit is 2 MB/);
    expect(() => store.mutate((s) => createImport(s, analyst, "hh_reyes", { filename: "vendor.json", mimeType: "application/json", bytes: new TextEncoder().encode(JSON.stringify({ schema_version: "vendor.v9", rows: [] })), sourceKind: "PLAN_EXPORT", vendorLabel: null }))).toThrow(/Unsupported JSON schema 'vendor.v9'/);
    expect(store.read().source_documents).toHaveLength(docsBefore);
    expect(statusOf(store, "hh_reyes")).toBe("BLOCKED");
    const bytes = readFileSync(path.join(FIX, "imports", "unsupported_vendor_sample.csv"));
    const { importRecord } = store.mutate((s) => createImport(s, analyst, "hh_reyes", { filename: "unsupported_vendor_sample.csv", mimeType: "text/csv", bytes, sourceKind: "PLAN_EXPORT", vendorLabel: "Some vendor" }));
    expect(importRecord.import_status).toBe("IMPORT_DRAFT");
    expect(importRecord.issues[0]).toMatch(/record_type, subject_ref, value, as_of_date/);
    expect(() => store.mutate((s) => applyColumnMapping(s, analyst, importRecord.id, {}, { export_as_of: "2026-01-20", tax_year: 2026, household_ref: "Reyes" }))).toThrow(/Missing required columns/);
  });

  it("converts the Reyes CSV plan export through the column contract", () => {
    const bytes = readFileSync(path.join(FIX, "imports", "reyes_plan_export_2026.csv"));
    const { importRecord } = store.mutate((s) => createImport(s, analyst, "hh_reyes", { filename: "reyes_plan_export_2026.csv", mimeType: "text/csv", bytes, sourceKind: "PLAN_EXPORT", vendorLabel: "Planning tool export (synthetic)" }));
    expect(importRecord.import_status).toBe("IMPORT_DRAFT");
    expect(importRecord.issues).toEqual([]);
    const staged = importRecord.staged_payload as { suggestedMapping: Record<string, string> };
    const mapped = store.mutate((s) => applyColumnMapping(s, analyst, importRecord.id, staged.suggestedMapping, { export_as_of: "2026-01-20", tax_year: 2026, household_ref: "Reyes-Lindqvist household" }));
    expect(mapped.import_status).toBe("MAPPED");
    const file = mapped.staged_payload as { facts: unknown[]; imported_checks: Array<{ declared_inputs: { factor: string } }> };
    expect(file.facts).toHaveLength(4);
    expect(file.imported_checks[0]!.declared_inputs.factor).toBe("26.5");
  });
});

describe("tenant isolation in the demo store", () => {
  it("Northline actors cannot read or mutate Harbor Point data, and vice versa", () => {
    const store = new MemoryStore();
    const s = store.read();
    expect(listHouseholds(s, "org_northline").map((h) => h.id)).toEqual(["hh_bauer"]);
    expect(listHouseholds(s, "org_harborpoint").map((h) => h.id)).not.toContain("hh_bauer");
    expect(householdOrNull(s, "org_northline", "hh_patel")).toBeNull();
    expect(householdOrNull(s, "org_harborpoint", "hh_bauer")).toBeNull();
    expect(() => householdBundle(s, "org_northline", "hh_patel")).toThrow(/not found/i);
    expect(() => store.mutate((x) => resolveConflict(x, nlCco, "conf_patel_balance", "f_patel_bal_stmt", RATIONALE))).toThrow(/not found/i);
    expect(() => store.mutate((x) => documentException(x, nlCco, "conf_patel_custodian", RATIONALE))).toThrow(/not found/i);
    expect(() => store.mutate((x) => freezeSnapshot(x, nlCco, "hh_patel"))).toThrow(/not found/i);
    expect(() => store.mutate((x) => addComment(x, nlCco, "hh_patel", "hello"))).toThrow(/not found/i);
    expect(() => store.mutate((x) => approveReview(x, nlCco, "hh_patel", { rationale: RATIONALE, conflictAttestation: true }))).toThrow(/not found/i);
    expect(() => store.mutate((x) => generatePacket(x, nlCco, "hh_patel"))).toThrow(/not found/i);
    expect(() => store.mutate((x) => recordAssumption(x, nlCco, "hh_patel", "PERSON", "person_patel_rajesh", "person.is_alive", "true", "Should not be possible."))).toThrow(/not found/i);
    expect(JSON.stringify(householdBundle(s, "org_northline", "hh_bauer"))).not.toContain("hh_patel");
    expect(store.read().audit_events.filter((e) => e.org_id === "org_harborpoint").length).toBe(s.audit_events.filter((e) => e.org_id === "org_harborpoint").length);
  });
});

describe("audit chain", () => {
  it("is intact after operations and detects tampering", () => {
    const store = new MemoryStore();
    store.mutate((s) => addComment(s, cco, "hh_patel", "Chain test comment."));
    const s = store.read();
    expect(verifyAuditChain(s, "org_harborpoint").intact).toBe(true);
    const target = s.audit_events.find((e) => e.org_id === "org_harborpoint" && e.event_type === "IMPORT_MAPPED")!;
    target.event_type = "APPROVAL_RECORDED";
    const verdict = verifyAuditChain(s, "org_harborpoint");
    expect(verdict.intact).toBe(false);
    expect(verdict.brokenAt).toBe(target.id);
  });
});
