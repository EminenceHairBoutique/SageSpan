import { FACT_FIELDS, REQUIRED_FACT_KEYS_RMD, assertCan, assertTransition, canonicalJson, priorYearEnd, type DataState, type Fact, type Household, type Snapshot, type SnapshotPayload } from "@sagespan/contracts";
import type { Actor } from "@/auth/types";
import { appendAudit, sha256 } from "./audit";
import { DomainError } from "./errors";
import { newId, nowIso } from "./ids";
import { householdBundle, requireHousehold, subjectLabel, type HouseholdBundle } from "./queries";

export type BlockerCode = "OPEN_MATERIAL_CONFLICT" | "OPEN_NONMATERIAL_CONFLICT" | "MISSING_REQUIRED_FACT" | "UNCONFIRMED_REQUIRED_FACT" | "STALE_BALANCE" | "MISSING_BENEFICIARY_EVIDENCE" | "NO_ACCOUNTS";

export interface Blocker {
  code: BlockerCode;
  field_key: string | null;
  subject_label: string;
  message: string;
  how_to_resolve: string;
  conflict_id?: string;
  fact_ids?: string[];
}

export interface RequiredFactStatus {
  field_key: string;
  label: string;
  subject_type: "PERSON" | "ACCOUNT";
  subject_id: string;
  subject_label: string;
  status: "SATISFIED" | "ASSUMED" | "MISSING" | "UNCONFIRMED" | "STALE" | "CONFLICT";
  fact_id: string | null;
}

export interface FreezeGate {
  canFreeze: boolean;
  blockers: Blocker[];
  warnings: string[];
  required: RequiredFactStatus[];
}

const RMD_ACCOUNT_TYPES = new Set(["TRADITIONAL_IRA", "SEP_IRA", "SIMPLE_IRA"]);

/**
 * Fail-closed freeze gate. A snapshot can be frozen only when every material
 * fact required by the supported check is confirmed (or satisfied by an
 * allowed documented assumption) and no conflict is open. Nonmaterial
 * conflicts must be resolved or carried by a documented exception.
 */
export function evaluateFreezeGate(state: DataState, household: Household): FreezeGate {
  const b = householdBundle(state, household.org_id, household.id);
  return evaluateGateFromBundle(b);
}

export function evaluateGateFromBundle(b: HouseholdBundle): FreezeGate {
  const blockers: Blocker[] = [];
  const warnings: string[] = [];
  const required: RequiredFactStatus[] = [];
  const yearEnd = priorYearEnd(b.household.tax_year);

  for (const c of b.conflicts.filter((c) => c.status === "OPEN")) {
    const label = subjectLabel(b, c.subject_type, c.subject_id);
    const def = FACT_FIELDS[c.field_key];
    if (c.materiality === "MATERIAL") {
      blockers.push({ code: "OPEN_MATERIAL_CONFLICT", field_key: c.field_key, subject_label: label, conflict_id: c.id, fact_ids: c.fact_ids, message: `Material conflict on ${def?.label ?? c.field_key} for ${label}: ${c.reason}`, how_to_resolve: "Choose the governing source fact with a written rationale (primary evidence governs). This creates a new fact revision; the rejected value is retained as history." });
    } else {
      blockers.push({ code: "OPEN_NONMATERIAL_CONFLICT", field_key: c.field_key, subject_label: label, conflict_id: c.id, fact_ids: c.fact_ids, message: `Nonmaterial conflict on ${def?.label ?? c.field_key} for ${label}: ${c.reason}`, how_to_resolve: b.org.policies.allow_nonmaterial_exceptions ? "Resolve it, or have a COMPLIANCE user document an exception with rationale (firm policy allows nonmaterial exceptions)." : "Resolve it. Firm policy does not allow nonmaterial exceptions." });
    }
  }

  if (b.accounts.length === 0) {
    blockers.push({ code: "NO_ACCOUNTS", field_key: null, subject_label: b.household.label, message: "No accounts are recorded for this household.", how_to_resolve: "Import a plan export or statement that declares at least one account." });
  }

  for (const account of b.accounts) {
    if (!RMD_ACCOUNT_TYPES.has(account.account_type)) {
      warnings.push(`${account.label} (${account.account_type}) is outside the supported RMD scope; it will be reported UNSUPPORTED.`);
    }
    const owners = b.ownership.filter((o) => o.account_id === account.id && !o.effective_to).map((o) => o.person_id);
    const subjects: Array<{ subject_type: "PERSON" | "ACCOUNT"; subject_id: string }> = [{ subject_type: "ACCOUNT", subject_id: account.id }, ...owners.map((p) => ({ subject_type: "PERSON" as const, subject_id: p }))];
    const soleSpouse = b.beneficiaries.find((d) => d.account_id === account.id && d.designation_type === "PRIMARY" && d.relationship === "SPOUSE" && d.sole_primary_entire_year === true && !d.effective_to);
    if (soleSpouse?.beneficiary_person_id) subjects.push({ subject_type: "PERSON", subject_id: soleSpouse.beneficiary_person_id });
    const hasAnyBeneficiary = b.beneficiaries.some((d) => d.account_id === account.id && !d.effective_to);

    for (const s of subjects) {
      for (const key of REQUIRED_FACT_KEYS_RMD) {
        const def = FACT_FIELDS[key]!;
        if (def.subject_type !== s.subject_type) continue;
        // spouse persons only need birth date
        if (s.subject_type === "PERSON" && !owners.includes(s.subject_id) && key !== "person.birth_date") continue;
        const label = subjectLabel(b, s.subject_type, s.subject_id);
        const candidates = b.activeFacts.filter((f) => f.subject_type === s.subject_type && f.subject_id === s.subject_id && f.field_key === key);
        const atRequiredDate = (f: Fact) => !def.must_be_prior_year_end || f.as_of_date === yearEnd;
        const confirmed = candidates.find((f) => f.verification_status === "FACT_CONFIRMED" && atRequiredDate(f));
        const assumed = candidates.find((f) => f.verification_status === "FACT_ASSUMED" && def.assumption_allowed && atRequiredDate(f));
        const conflicted = candidates.some((f) => f.verification_status === "FACT_CONFLICT");
        const unconfirmed = candidates.find((f) => f.verification_status === "NEEDS_CONFIRMATION" && atRequiredDate(f));
        const staleConfirmed = def.must_be_prior_year_end ? candidates.find((f) => f.verification_status === "FACT_CONFIRMED" && f.as_of_date !== yearEnd) : undefined;
        const row: RequiredFactStatus = { field_key: key, label: def.label, subject_type: s.subject_type, subject_id: s.subject_id, subject_label: label, status: "MISSING", fact_id: null };
        if (confirmed) {
          row.status = "SATISFIED";
          row.fact_id = confirmed.id;
        } else if (assumed) {
          row.status = "ASSUMED";
          row.fact_id = assumed.id;
        } else if (conflicted) {
          row.status = "CONFLICT";
        } else if (unconfirmed) {
          row.status = "UNCONFIRMED";
          row.fact_id = unconfirmed.id;
          blockers.push({ code: "UNCONFIRMED_REQUIRED_FACT", field_key: key, subject_label: label, fact_ids: [unconfirmed.id], message: `${def.label} for ${label} is only a planning-tool value (needs confirmation).`, how_to_resolve: "Import primary evidence (custodian statement, profile or beneficiary form) that corroborates it, or have an ADVISOR/COMPLIANCE user confirm it with a written rationale and evidence reference." });
        } else if (staleConfirmed) {
          row.status = "STALE";
          row.fact_id = staleConfirmed.id;
          blockers.push({ code: "STALE_BALANCE", field_key: key, subject_label: label, fact_ids: [staleConfirmed.id], message: `${def.label} for ${label} is confirmed as of ${staleConfirmed.as_of_date}, but the ${b.household.tax_year} RMD requires the ${yearEnd} value.`, how_to_resolve: "A different as-of date is not an error. Import the year-end statement so the balance as of " + yearEnd + " is confirmed." });
        } else {
          row.status = "MISSING";
          if (key === "beneficiary.primary.spouse_sole_entire_year" && !hasAnyBeneficiary) {
            blockers.push({ code: "MISSING_BENEFICIARY_EVIDENCE", field_key: key, subject_label: label, message: `No beneficiary designation evidence is on file for ${label}; the joint-table requirement cannot be ruled out.`, how_to_resolve: "Import the beneficiary designation form or a statement that lists beneficiaries." });
          } else if (key === "person.is_alive") {
            blockers.push({ code: "MISSING_REQUIRED_FACT", field_key: key, subject_label: label, message: `Living status for ${label} is not recorded.`, how_to_resolve: "An ADVISOR or COMPLIANCE user records a documented assumption (with basis) or confirms it from evidence." });
          } else {
            blockers.push({ code: "MISSING_REQUIRED_FACT", field_key: key, subject_label: label, message: `${def.label} for ${label} is missing.`, how_to_resolve: def.assumption_allowed ? "Import evidence or record a documented assumption." : "Import primary evidence that establishes this fact." });
          }
        }
        required.push(row);
      }
    }
  }

  return { canFreeze: blockers.length === 0, blockers, warnings, required };
}

/**
 * Byte-order string comparison (UTF-16 code units; identical to UTF-8 byte order
 * for the ASCII identifiers used here). Snapshot payload ordering must match
 * app.canonical_json / app.build_snapshot_payload in Postgres (collate "C") and
 * Python's sorted(), none of which are locale-aware. Never use localeCompare here.
 */
export function byteCompare(x: string, y: string): number {
  return x < y ? -1 : x > y ? 1 : 0;
}

/** Deterministic, canonical snapshot payload built only from confirmed/assumed active facts. */
export function buildSnapshotPayload(b: HouseholdBundle, revision: number): SnapshotPayload {
  const facts = b.activeFacts
    .filter((f) => f.verification_status === "FACT_CONFIRMED" || f.verification_status === "FACT_ASSUMED")
    .map((f) => ({ id: f.id, subject_type: f.subject_type, subject_id: f.subject_id, field_key: f.field_key, value_kind: f.value_kind, value_number: f.value_number, value_text: f.value_text, value_date: f.value_date, value_bool: f.value_bool, value_currency: f.value_currency, as_of_date: f.as_of_date, verification_status: f.verification_status, source_document_id: f.source_document_id }))
    .sort((a, c) => byteCompare(a.id, c.id));
  const docIds = new Set(facts.map((f) => f.source_document_id).filter(Boolean));
  return {
    snapshot_version: "sagespan.snapshot.v1",
    household_id: b.household.id,
    tax_year: b.household.tax_year,
    revision,
    facts,
    source_documents: b.documents.filter((d) => docIds.has(d.id) || b.importedValues.some((v) => b.imports.find((i) => i.id === v.import_id)?.source_document_id === d.id)).map((d) => ({ id: d.id, source_kind: d.source_kind, filename: d.filename, sha256: d.sha256, source_as_of: d.source_as_of })).sort((a, c) => byteCompare(a.id, c.id)),
    ownership: b.ownership.map((o) => ({ account_id: o.account_id, person_id: o.person_id, ownership_type: o.ownership_type, percentage: o.percentage, effective_from: o.effective_from, effective_to: o.effective_to })).sort((a, c) => byteCompare((a.account_id + a.person_id), c.account_id + c.person_id)),
    beneficiaries: b.beneficiaries.filter((d) => !d.effective_to).map((d) => ({ account_id: d.account_id, beneficiary_person_id: d.beneficiary_person_id, relationship: d.relationship, designation_type: d.designation_type, share_percentage: d.share_percentage, sole_primary_entire_year: d.sole_primary_entire_year })).sort((a, c) => byteCompare((a.account_id + a.designation_type + (a.beneficiary_person_id ?? "")), c.account_id + c.designation_type + (c.beneficiary_person_id ?? ""))),
    assumptions: b.assumptions.filter((a) => facts.some((f) => f.id === a.source_fact_id)).map((a) => ({ key: a.key, value_kind: a.value_kind, value_decimal: a.value_decimal, value_text: a.value_text, basis: a.basis })).sort((a, c) => byteCompare(a.key, c.key)),
    exceptions: b.conflicts.filter((c) => c.status === "EXCEPTION_DOCUMENTED").map((c) => ({ id: c.id, field_key: c.field_key, materiality: c.materiality, resolution_note: c.resolution_note, resolved_by: c.resolved_by })).sort((a, c) => byteCompare(a.id, c.id)),
    imported_plan_values: b.importedValues.filter((v) => v.tax_year === b.household.tax_year).map((v) => ({ id: v.id, metric_key: v.metric_key, tax_year: v.tax_year, value_decimal: v.value_decimal, currency: v.currency, calculation_scope: v.calculation_scope, balance_basis: v.balance_basis, declared_inputs: v.declared_inputs, assumptions: v.assumptions, account_id: v.account_id })).sort((a, c) => byteCompare(a.id, c.id)),
  };
}

export function freezeSnapshot(state: DataState, actor: Actor, householdId: string): Snapshot {
  assertCan(actor.role, "snapshot.freeze");
  const hh = requireHousehold(state, actor.org_id, householdId);
  if (hh.workflow_status !== "READY_TO_FREEZE") throw new DomainError("INVALID_STATE", `Household is ${hh.workflow_status}; freezing requires READY_TO_FREEZE.`);
  const b = householdBundle(state, actor.org_id, householdId);
  const gate = evaluateGateFromBundle(b);
  if (!gate.canFreeze) {
    throw new DomainError("FREEZE_BLOCKED", `Freeze blocked: ${gate.blockers.map((x) => x.message).join(" | ")}`);
  }
  assertTransition(hh.workflow_status, "FROZEN");
  for (const s of b.snapshots) if (s.status === "FROZEN") s.status = "SUPERSEDED";
  const revision = b.snapshots.length + 1;
  const payload = buildSnapshotPayload(b, revision);
  const content_sha256 = sha256(canonicalJson(payload));
  const snapshot: Snapshot = {
    id: newId("snap"),
    org_id: actor.org_id,
    household_id: householdId,
    revision,
    content_sha256,
    rule_set_versions: {},
    assumption_set_id: b.assumptionSets.at(-1)?.id ?? null,
    created_by: actor.user_id,
    created_by_role: actor.role,
    created_at: nowIso(),
    status: "FROZEN",
    canonical_payload: payload,
  };
  state.snapshots.push(snapshot);
  hh.workflow_status = "FROZEN";
  hh.current_revision = revision;
  hh.updated_at = nowIso();
  appendAudit(state, { org_id: actor.org_id, actor_user_id: actor.user_id, actor_role: actor.role, actor_type: actor.actor_type, event_type: "SNAPSHOT_FROZEN", entity_type: "snapshot", entity_id: snapshot.id, summary: `Snapshot ${snapshot.id} (revision ${revision}) frozen for household ${householdId}; content sha256 ${content_sha256.slice(0, 12)}…`, payload: { snapshot_id: snapshot.id, content_sha256, revision } });
  return snapshot;
}

/** Any later change to inputs re-opens reconciliation for a NEW revision; frozen snapshots are never edited. */
export function reopenForNewRevision(state: DataState, actor: Actor, hh: Household, reason: string): void {
  if (["FROZEN", "CHECK_COMPLETE", "REVIEW_PENDING", "REVIEWED", "APPROVED", "EXPORTED"].includes(hh.workflow_status)) {
    assertTransition(hh.workflow_status, "RECONCILIATION_PENDING");
    hh.workflow_status = "RECONCILIATION_PENDING";
    hh.updated_at = nowIso();
    appendAudit(state, { org_id: actor.org_id, actor_user_id: actor.user_id, actor_role: actor.role, actor_type: actor.actor_type, event_type: "IMPORT_RECONCILED", entity_type: "household", entity_id: hh.id, summary: `Household ${hh.id} re-opened for a new input revision: ${reason}. Prior snapshot remains immutable.` });
  } else if (["BLOCKED", "READY_TO_FREEZE"].includes(hh.workflow_status)) {
    assertTransition(hh.workflow_status, "RECONCILIATION_PENDING");
    hh.workflow_status = "RECONCILIATION_PENDING";
  }
}
