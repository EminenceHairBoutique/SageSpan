import { FACT_FIELDS, ImportFileSchema, assertCan, assertTransition, type DataState, type Fact, type FactConflict, type Household, type ImportFile, type SourceDocument } from "@sagespan/contracts";
import type { Actor } from "@/auth/types";
import { appendAudit } from "./audit";
import { DomainError } from "./errors";
import { conflictGroupKey, factValuesEqual, initialFactStatus, isPrimaryEvidence, isTimeVarying, typedValue } from "./facts";
import { evaluateFreezeGate } from "./freeze";
import { newId, nowIso } from "./ids";
import { householdBundle, requireHousehold } from "./queries";

export interface EntityMapping {
  persons: Record<string, string>; // file ref -> person id | "NEW"
  accounts: Record<string, string>; // file ref -> account id | "NEW"
}

export interface ReconcileSummary {
  household: Household;
  factsCreated: number;
  conflictsOpened: number;
  corroborated: number;
  assumptionsSuperseded: number;
  importedValues: number;
}

/**
 * Reconcile a MAPPED import into typed facts.
 *
 * Policy:
 * - Facts from primary evidence (statement, profile, beneficiary form) are FACT_CONFIRMED.
 * - Facts from planning-tool exports are claims: NEEDS_CONFIRMATION until corroborated.
 * - Equal values corroborate; differing values for a static fact, or for a time-varying
 *   fact at the SAME as-of date, open a FactConflict with the field's materiality.
 * - Differing as-of dates are recorded as a freshness note, never as a conflict.
 * - Primary evidence supersedes an earlier documented assumption for the same fact.
 */
export function reconcileImport(state: DataState, actor: Actor, importId: string, mapping: EntityMapping): ReconcileSummary {
  assertCan(actor.role, "import.map");
  const imp = state.plan_imports.find((i) => i.id === importId && i.org_id === actor.org_id);
  if (!imp) throw new DomainError("NOT_FOUND", "Import not found", 404);
  if (imp.import_status !== "MAPPED") throw new DomainError("INVALID_STATE", `Import is ${imp.import_status}; only MAPPED imports can be reconciled.`);
  const payload = ImportFileSchema.parse(imp.staged_payload);
  const hh = requireHousehold(state, actor.org_id, imp.household_id);
  assertTransition(hh.workflow_status, "RECONCILIATION_PENDING");
  hh.workflow_status = "RECONCILIATION_PENDING";
  const doc = state.source_documents.find((d) => d.id === imp.source_document_id && d.org_id === actor.org_id);
  if (!doc) throw new DomainError("NOT_FOUND", "Source document for import not found", 404);

  const bundle = householdBundle(state, actor.org_id, hh.id);
  const personIds = resolveEntities(state, actor, hh, payload, mapping, bundle.persons.map((p) => p.id), bundle.accounts.map((a) => a.id));

  const summary: ReconcileSummary = { household: hh, factsCreated: 0, conflictsOpened: 0, corroborated: 0, assumptionsSuperseded: 0, importedValues: 0 };
  const synthesized = synthesizeFacts(payload);
  const allFacts = [...payload.facts, ...synthesized];

  for (const f of allFacts) {
    const subjectId = f.subject_type === "PERSON" ? personIds.persons[f.subject_ref] : f.subject_type === "ACCOUNT" ? personIds.accounts[f.subject_ref] : hh.id;
    if (!subjectId) throw new DomainError("UNMAPPED_SUBJECT", `Fact references unmapped ${f.subject_type.toLowerCase()} '${f.subject_ref}'.`);
    let typed: ReturnType<typeof typedValue>;
    try {
      typed = typedValue(f.value_kind, f.value);
    } catch (e) {
      throw new DomainError("INVALID_VALUE", `${f.field_key} for ${f.subject_ref}: ${e instanceof Error ? e.message : "invalid value"}`);
    }
    const loc = addLocation(state, doc, f.source_location ?? null);
    const def = FACT_FIELDS[f.field_key];
    const status = initialFactStatus(payload.source_kind, f.is_assumption);
    if (f.is_assumption && !(def?.assumption_allowed ?? true)) throw new DomainError("ASSUMPTION_NOT_ALLOWED", `${f.field_key} cannot be satisfied by an assumption.`);
    const fact: Fact = {
      id: newId("fact"),
      org_id: actor.org_id,
      household_id: hh.id,
      subject_type: f.subject_type,
      subject_id: subjectId,
      field_key: f.field_key,
      value_kind: f.value_kind,
      ...typed,
      value_currency: f.value_kind === "NUMBER" ? (f.currency ?? "USD") : null,
      unit: f.unit ?? (f.value_kind === "NUMBER" ? (f.currency ?? "USD") : null),
      as_of_date: f.as_of_date,
      effective_from: null,
      effective_to: null,
      source_document_id: doc.id,
      source_location_id: loc?.id ?? null,
      verification_status: status,
      revision: 1,
      supersedes_fact_id: null,
      superseded: false,
      assumption_id: null,
      note: f.note ?? null,
      created_at: nowIso(),
      created_by: actor.user_id,
    };
    reconcileAgainstExisting(state, fact, doc, summary);
    state.facts.push(fact);
    summary.factsCreated++;
  }

  for (const b of payload.beneficiaries) {
    const accountId = personIds.accounts[b.account_ref];
    if (!accountId) throw new DomainError("UNMAPPED_SUBJECT", `Beneficiary references unmapped account '${b.account_ref}'.`);
    const personId = b.person_ref ? personIds.persons[b.person_ref] ?? null : null;
    const exists = state.beneficiary_designations.find((x) => x.account_id === accountId && x.designation_type === b.designation_type && (personId ? x.beneficiary_person_id === personId : x.beneficiary_label === b.beneficiary_label));
    if (!exists) {
      state.beneficiary_designations.push({
        id: newId("ben"),
        org_id: actor.org_id,
        account_id: accountId,
        beneficiary_person_id: personId,
        beneficiary_label: b.beneficiary_label ?? null,
        relationship: b.relationship,
        designation_type: b.designation_type,
        share_percentage: b.share_percentage,
        sole_primary_entire_year: b.sole_primary_entire_year ?? null,
        effective_from: b.effective_from ?? payload.export_as_of,
        effective_to: null,
        source_fact_id: null,
        source_document_id: doc.id,
      });
    }
  }

  for (const c of payload.imported_checks) {
    const accountId = c.account_ref ? personIds.accounts[c.account_ref] ?? null : null;
    if (c.account_ref && !accountId) throw new DomainError("UNMAPPED_SUBJECT", `Imported check references unmapped account '${c.account_ref}'.`);
    const loc = addLocation(state, doc, c.source_location ?? null);
    state.imported_plan_values.push({
      id: newId("ipv"),
      org_id: actor.org_id,
      import_id: imp.id,
      household_id: hh.id,
      account_id: accountId,
      metric_key: c.metric_key,
      tax_year: c.tax_year,
      value_decimal: c.value,
      currency: c.currency,
      methodology_label: c.methodology_label ?? null,
      calculation_scope: c.calculation_scope,
      balance_basis: c.balance_basis,
      declared_inputs: c.declared_inputs ?? null,
      assumptions: c.assumptions,
      source_location_id: loc?.id ?? null,
    });
    summary.importedValues++;
  }

  imp.import_status = "RECONCILED";
  imp.staged_payload = null;
  imp.mapping = { ...(imp.mapping ?? {}), ...Object.fromEntries(Object.entries(mapping.persons).map(([k, v]) => [`person:${k}`, v])), ...Object.fromEntries(Object.entries(mapping.accounts).map(([k, v]) => [`account:${k}`, v])) };
  hh.updated_at = nowIso();
  if (hh.source_tool_label == null && payload.source_kind === "PLAN_EXPORT") hh.source_tool_label = payload.vendor_label ?? null;
  appendAudit(state, { org_id: actor.org_id, actor_user_id: actor.user_id, actor_role: actor.role, actor_type: actor.actor_type, event_type: "IMPORT_RECONCILED", entity_type: "plan_import", entity_id: imp.id, summary: `Import ${imp.id} reconciled into household ${hh.id}: ${summary.factsCreated} facts, ${summary.conflictsOpened} conflict(s) opened, ${summary.corroborated} corroborated`, payload: { import_id: imp.id, facts: summary.factsCreated, conflicts: summary.conflictsOpened } });
  applyGateToStatus(state, actor, hh);
  return summary;
}

/** Move a RECONCILIATION_PENDING household to BLOCKED or READY_TO_FREEZE based on the gate. */
export function applyGateToStatus(state: DataState, actor: Actor | null, hh: Household): void {
  const gate = evaluateFreezeGate(state, hh);
  const target = gate.canFreeze ? "READY_TO_FREEZE" : "BLOCKED";
  if (hh.workflow_status !== target) {
    assertTransition(hh.workflow_status, target);
    hh.workflow_status = target;
    hh.updated_at = nowIso();
  }
}

function addLocation(state: DataState, doc: SourceDocument, location: string | null) {
  if (!location) return null;
  const rowMatch = /^row\s+(\d+)$/i.exec(location);
  const existing = state.source_locations.find((l) => l.document_id === doc.id && (l.json_pointer === location || (rowMatch && l.row_number === Number(rowMatch[1])) || l.text_span === location));
  if (existing) return existing;
  const loc = {
    id: newId("loc"),
    org_id: doc.org_id,
    document_id: doc.id,
    page_number: null,
    row_number: rowMatch ? Number(rowMatch[1]) : null,
    text_span: rowMatch || location.startsWith("/") ? null : location,
    json_pointer: location.startsWith("/") ? location : null,
  };
  state.source_locations.push(loc);
  return loc;
}

function synthesizeFacts(payload: ImportFile): ImportFile["facts"] {
  const out: ImportFile["facts"] = [];
  const has = (subjectType: string, ref: string, key: string) => payload.facts.some((f) => f.subject_type === subjectType && f.subject_ref === ref && f.field_key === key);
  payload.persons.forEach((p, i) => {
    if (p.birth_date && !has("PERSON", p.ref, "person.birth_date")) {
      out.push({ subject_type: "PERSON", subject_ref: p.ref, field_key: "person.birth_date", value_kind: "DATE", value: p.birth_date, currency: null, unit: null, as_of_date: payload.export_as_of, tax_year: null, source_location: `/persons/${i}/birth_date`, is_assumption: false, note: null });
    }
  });
  payload.accounts.forEach((a, i) => {
    if (!has("ACCOUNT", a.ref, "account.account_type")) {
      out.push({ subject_type: "ACCOUNT", subject_ref: a.ref, field_key: "account.account_type", value_kind: "TEXT", value: a.account_type, currency: null, unit: null, as_of_date: payload.export_as_of, tax_year: null, source_location: `/accounts/${i}/account_type`, is_assumption: false, note: null });
    }
    if (a.is_inherited != null && !has("ACCOUNT", a.ref, "account.is_inherited")) {
      out.push({ subject_type: "ACCOUNT", subject_ref: a.ref, field_key: "account.is_inherited", value_kind: "BOOL", value: String(a.is_inherited), currency: null, unit: null, as_of_date: payload.export_as_of, tax_year: null, source_location: `/accounts/${i}/is_inherited`, is_assumption: false, note: null });
    }
    if (a.custodian_label && !has("ACCOUNT", a.ref, "account.custodian_label")) {
      out.push({ subject_type: "ACCOUNT", subject_ref: a.ref, field_key: "account.custodian_label", value_kind: "TEXT", value: a.custodian_label, currency: null, unit: null, as_of_date: payload.export_as_of, tax_year: null, source_location: `/accounts/${i}/custodian_label`, is_assumption: false, note: null });
    }
  });
  payload.beneficiaries.forEach((b, i) => {
    if (b.designation_type === "PRIMARY" && b.relationship === "SPOUSE" && b.sole_primary_entire_year != null && !has("ACCOUNT", b.account_ref, "beneficiary.primary.spouse_sole_entire_year")) {
      out.push({ subject_type: "ACCOUNT", subject_ref: b.account_ref, field_key: "beneficiary.primary.spouse_sole_entire_year", value_kind: "BOOL", value: String(b.sole_primary_entire_year), currency: null, unit: null, as_of_date: b.effective_from ?? payload.export_as_of, tax_year: null, source_location: b.source_location ?? `/beneficiaries/${i}`, is_assumption: false, note: null });
    }
  });
  return out;
}

function resolveEntities(state: DataState, actor: Actor, hh: Household, payload: ImportFile, mapping: EntityMapping, existingPersonIds: string[], existingAccountIds: string[]) {
  const persons: Record<string, string> = {};
  const accounts: Record<string, string> = {};
  for (const p of payload.persons) {
    const target = mapping.persons[p.ref];
    if (!target) throw new DomainError("UNMAPPED_SUBJECT", `Person '${p.ref}' (${p.display_name}) is not mapped.`);
    if (target === "NEW") {
      const id = newId("person");
      state.persons.push({ id, org_id: actor.org_id, household_id: hh.id, display_name: p.display_name, role_in_household: p.role_in_household });
      persons[p.ref] = id;
    } else {
      if (!existingPersonIds.includes(target)) throw new DomainError("INVALID_MAPPING", `Person '${p.ref}' is mapped to an entity outside this household.`);
      persons[p.ref] = target;
    }
  }
  for (const a of payload.accounts) {
    const target = mapping.accounts[a.ref];
    if (!target) throw new DomainError("UNMAPPED_SUBJECT", `Account '${a.ref}' (${a.label}) is not mapped.`);
    if (target === "NEW") {
      const id = newId("acct");
      state.accounts.push({ id, org_id: actor.org_id, household_id: hh.id, label: a.label, account_type: a.account_type, tax_character: a.account_type === "ROTH_IRA" ? "ROTH" : a.account_type === "OTHER" ? "OTHER" : "PRE_TAX", currency: "USD" });
      const ownerId = persons[a.owner_ref];
      if (!ownerId) throw new DomainError("UNMAPPED_SUBJECT", `Account '${a.ref}' owner '${a.owner_ref}' is not mapped.`);
      state.account_ownership.push({ id: newId("own"), org_id: actor.org_id, account_id: id, person_id: ownerId, ownership_type: "INDIVIDUAL", percentage: "100", effective_from: payload.export_as_of, effective_to: null });
      accounts[a.ref] = id;
    } else {
      if (!existingAccountIds.includes(target)) throw new DomainError("INVALID_MAPPING", `Account '${a.ref}' is mapped to an entity outside this household.`);
      accounts[a.ref] = target;
    }
  }
  // Facts may reference refs that only appear in facts (e.g. CSV without PERSON rows): map them too.
  for (const f of payload.facts) {
    if (f.subject_type === "PERSON" && !persons[f.subject_ref] && mapping.persons[f.subject_ref] && mapping.persons[f.subject_ref] !== "NEW") persons[f.subject_ref] = mapping.persons[f.subject_ref]!;
    if (f.subject_type === "ACCOUNT" && !accounts[f.subject_ref] && mapping.accounts[f.subject_ref] && mapping.accounts[f.subject_ref] !== "NEW") accounts[f.subject_ref] = mapping.accounts[f.subject_ref]!;
  }
  return { persons, accounts };
}

function reconcileAgainstExisting(state: DataState, fact: Fact, doc: SourceDocument, summary: ReconcileSummary): void {
  const existing = state.facts.filter((e) => e.org_id === fact.org_id && e.household_id === fact.household_id && !e.superseded && e.subject_type === fact.subject_type && e.subject_id === fact.subject_id && e.field_key === fact.field_key && e.id !== fact.id);
  const def = FACT_FIELDS[fact.field_key];
  const newIsPrimary = isPrimaryEvidence(doc.source_kind);
  for (const e of existing) {
    if (isTimeVarying(fact.field_key) && e.as_of_date !== fact.as_of_date) {
      fact.note = [fact.note, `As-of ${fact.as_of_date} differs from an existing value as of ${e.as_of_date}; not treated as a conflict (freshness, not disagreement).`].filter(Boolean).join(" ");
      continue;
    }
    if (factValuesEqual(e, fact)) {
      if (fact.verification_status === "FACT_CONFIRMED" && e.verification_status === "NEEDS_CONFIRMATION") {
        e.verification_status = "FACT_CONFIRMED";
        e.note = [e.note, `Corroborated by ${doc.filename}`].filter(Boolean).join(" ");
        summary.corroborated++;
      } else if (fact.verification_status === "NEEDS_CONFIRMATION" && e.verification_status === "FACT_CONFIRMED") {
        fact.verification_status = "FACT_CONFIRMED";
        fact.note = [fact.note, `Corroborates confirmed value from ${state.source_documents.find((d) => d.id === e.source_document_id)?.filename ?? "primary source"}`].filter(Boolean).join(" ");
        summary.corroborated++;
      } else if (fact.verification_status === "FACT_CONFIRMED" && e.verification_status === "FACT_CONFIRMED") {
        summary.corroborated++;
      }
      continue;
    }
    if (e.verification_status === "FACT_ASSUMED" && newIsPrimary) {
      e.superseded = true;
      e.note = [e.note, `Superseded by evidence in ${doc.filename}`].filter(Boolean).join(" ");
      summary.assumptionsSuperseded++;
      continue;
    }
    if (e.verification_status === "FACT_CONFIRMED" && fact.verification_status === "FACT_ASSUMED") {
      fact.superseded = true;
      fact.note = [fact.note, "Not recorded: confirmed evidence already exists for this fact."].filter(Boolean).join(" ");
      continue;
    }
    // Disagreement -> conflict
    const key = conflictGroupKey(fact);
    let conflict: FactConflict | undefined = state.fact_conflicts.find((c) => c.household_id === fact.household_id && c.fact_group_key === key && c.status === "OPEN");
    if (!conflict) {
      conflict = {
        id: newId("conf"),
        org_id: fact.org_id,
        household_id: fact.household_id,
        fact_group_key: key,
        field_key: fact.field_key,
        subject_type: fact.subject_type,
        subject_id: fact.subject_id,
        materiality: def?.materiality ?? "NONMATERIAL",
        status: "OPEN",
        reason: `${def?.label ?? fact.field_key} differs between ${state.source_documents.find((d) => d.id === e.source_document_id)?.filename ?? "an existing source"} and ${doc.filename}${isTimeVarying(fact.field_key) ? ` for the same as-of date ${fact.as_of_date}` : ""}.`,
        fact_ids: [e.id],
        chosen_fact_id: null,
        resolution_note: null,
        resolved_by: null,
        resolved_at: null,
        created_at: nowIso(),
      };
      state.fact_conflicts.push(conflict);
      summary.conflictsOpened++;
    }
    if (!conflict.fact_ids.includes(fact.id)) conflict.fact_ids.push(fact.id);
    e.verification_status = "FACT_CONFLICT";
    fact.verification_status = "FACT_CONFLICT";
  }
}
