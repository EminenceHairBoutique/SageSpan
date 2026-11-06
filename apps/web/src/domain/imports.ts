import { assertCan, assertTransition, type DataState, type PlanImport, type SourceKind } from "@sagespan/contracts";
import type { Actor } from "@/auth/types";
import { csvTableToImportFile, type ColumnMapping } from "@/import/csv-contract";
import { parseUploadText, validateUpload, type ParsedUpload } from "@/import/parse";
import { sha256Bytes } from "@/provenance/hash";
import { appendAudit } from "./audit";
import { DomainError } from "./errors";
import { newId, nowIso } from "./ids";
import { householdBundle, requireHousehold } from "./queries";

export interface UploadInput {
  filename: string;
  mimeType: string;
  bytes: Uint8Array;
  sourceKind: SourceKind;
  vendorLabel: string | null;
}

export interface StagedCsv {
  headers: string[];
  rows: string[][];
  suggestedMapping: ColumnMapping;
  missingRequired: string[];
  meta: { source_kind: SourceKind; vendor_label: string | null; export_as_of: string; tax_year: number };
}

/**
 * Create an import from an uploaded file. The file's SHA-256 is recorded as a
 * SourceDocument immediately; parsing yields either a validated JSON payload
 * (-> MAPPED) or a staged CSV table awaiting explicit column mapping
 * (-> IMPORT_DRAFT). Unsupported files raise an actionable error and leave no
 * partial state.
 */
export function createImport(state: DataState, actor: Actor, householdId: string, upload: UploadInput): { importRecord: PlanImport; parsed: ParsedUpload } {
  assertCan(actor.role, "import.create");
  const hh = requireHousehold(state, actor.org_id, householdId);
  const format = validateUpload({ filename: upload.filename, mimeType: upload.mimeType, byteLength: upload.bytes.byteLength });
  const text = new TextDecoder("utf-8", { fatal: false }).decode(upload.bytes);
  const parsed = parseUploadText(format, text);
  const safeName = upload.filename.replace(/[^\w.\-() ]+/g, "_").slice(0, 120);
  const doc = {
    id: newId("doc"),
    org_id: actor.org_id,
    household_id: hh.id,
    source_kind: upload.sourceKind,
    source_vendor_label: upload.vendorLabel,
    filename: safeName,
    sha256: sha256Bytes(upload.bytes),
    byte_length: upload.bytes.byteLength,
    storage_path: null,
    uploaded_at: nowIso(),
    uploaded_by: actor.user_id,
    source_as_of: parsed.kind === "JSON" ? parsed.file.export_as_of : null,
    parser_version: parsed.kind === "JSON" ? "sagespan.import.v1" : "sagespan.import.v1-csv",
    synthetic: actor.mode === "DEMO",
  };
  state.source_documents.push(doc);
  const importRecord: PlanImport = {
    id: newId("imp"),
    org_id: actor.org_id,
    household_id: hh.id,
    source_document_id: doc.id,
    source_vendor_label: upload.vendorLabel,
    source_kind: parsed.kind === "JSON" ? parsed.file.source_kind : upload.sourceKind,
    format,
    format_version: "sagespan.import.v1",
    imported_at: nowIso(),
    imported_by: actor.user_id,
    parser_version: doc.parser_version,
    import_status: parsed.kind === "JSON" ? "MAPPED" : "IMPORT_DRAFT",
    mapping: parsed.kind === "JSON" ? { format: "json-identity" } : null,
    row_count: parsed.kind === "JSON" ? parsed.file.facts.length + parsed.file.imported_checks.length + parsed.file.persons.length + parsed.file.accounts.length : parsed.table.rows.length,
    issues: parsed.kind === "CSV" && parsed.missingRequired.length ? [`Columns not auto-matched: ${parsed.missingRequired.join(", ")}`] : [],
    staged_payload:
      parsed.kind === "JSON"
        ? parsed.file
        : ({ headers: parsed.table.headers, rows: parsed.table.rows, suggestedMapping: parsed.suggestedMapping, missingRequired: parsed.missingRequired, meta: { source_kind: upload.sourceKind, vendor_label: upload.vendorLabel, export_as_of: nowIso().slice(0, 10), tax_year: hh.tax_year } } satisfies StagedCsv),
  };
  state.plan_imports.push(importRecord);
  // A new import opens a new revision cycle for the household.
  if (hh.workflow_status !== "IMPORT_DRAFT") {
    assertTransition(hh.workflow_status, "IMPORT_DRAFT");
    hh.workflow_status = "IMPORT_DRAFT";
  }
  if (importRecord.import_status === "MAPPED") {
    assertTransition(hh.workflow_status, "MAPPED");
    hh.workflow_status = "MAPPED";
  }
  hh.updated_at = nowIso();
  appendAudit(state, { org_id: actor.org_id, actor_user_id: actor.user_id, actor_role: actor.role, actor_type: actor.actor_type, event_type: "IMPORT_CREATED", entity_type: "plan_import", entity_id: importRecord.id, summary: `Import ${importRecord.id} created for household ${hh.id} from ${doc.filename} (${format}, sha256 ${doc.sha256.slice(0, 12)}…)`, payload: { sha256: doc.sha256, format } });
  if (importRecord.import_status === "MAPPED") {
    appendAudit(state, { org_id: actor.org_id, actor_user_id: actor.user_id, actor_role: actor.role, actor_type: actor.actor_type, event_type: "IMPORT_MAPPED", entity_type: "plan_import", entity_id: importRecord.id, summary: `Import ${importRecord.id} validated against sagespan.import.v1 (JSON); mapping is identity` });
  }
  return { importRecord, parsed };
}

/** Apply an explicit CSV column mapping; converts the staged table into a validated import payload. */
export function applyColumnMapping(state: DataState, actor: Actor, importId: string, mapping: ColumnMapping, meta: { export_as_of: string; tax_year: number; household_ref: string }): PlanImport {
  assertCan(actor.role, "import.map");
  const imp = state.plan_imports.find((i) => i.id === importId && i.org_id === actor.org_id);
  if (!imp) throw new DomainError("NOT_FOUND", "Import not found", 404);
  if (imp.import_status !== "IMPORT_DRAFT" || imp.format !== "CSV") throw new DomainError("INVALID_STATE", "Only CSV imports in IMPORT_DRAFT accept a column mapping.");
  const staged = imp.staged_payload as StagedCsv;
  const result = csvTableToImportFile({ headers: staged.headers, rows: staged.rows }, mapping, { source_kind: staged.meta.source_kind, household_ref: meta.household_ref, vendor_label: staged.meta.vendor_label, export_as_of: meta.export_as_of, tax_year: meta.tax_year });
  if (!result.ok) {
    imp.issues = result.errors;
    throw new DomainError("MAPPING_FAILED", `The mapping does not produce a valid import: ${result.errors.slice(0, 5).join(" | ")}`);
  }
  const hh = requireHousehold(state, actor.org_id, imp.household_id);
  imp.staged_payload = result.file;
  imp.mapping = Object.fromEntries(Object.entries(mapping).filter(([, v]) => v)) as Record<string, string>;
  imp.import_status = "MAPPED";
  imp.issues = [];
  imp.row_count = result.rowCount;
  assertTransition(hh.workflow_status, "MAPPED");
  hh.workflow_status = "MAPPED";
  hh.updated_at = nowIso();
  appendAudit(state, { org_id: actor.org_id, actor_user_id: actor.user_id, actor_role: actor.role, actor_type: actor.actor_type, event_type: "IMPORT_MAPPED", entity_type: "plan_import", entity_id: imp.id, summary: `Import ${imp.id} column mapping applied (${Object.keys(imp.mapping).length} columns)` });
  return imp;
}

/** Suggest existing-entity matches for a MAPPED import's refs (by display label). */
export function suggestEntityMapping(state: DataState, actor: Actor, importId: string) {
  const imp = state.plan_imports.find((i) => i.id === importId && i.org_id === actor.org_id);
  if (!imp || imp.import_status !== "MAPPED") return null;
  const payload = imp.staged_payload as { persons: Array<{ ref: string; display_name: string }>; accounts: Array<{ ref: string; label: string }>; facts: Array<{ subject_type: string; subject_ref: string }> };
  const b = householdBundle(state, actor.org_id, imp.household_id);
  const norm = (s: string) => s.trim().toLowerCase();
  const personRefs = new Set([...payload.persons.map((p) => p.ref), ...payload.facts.filter((f) => f.subject_type === "PERSON").map((f) => f.subject_ref)]);
  const accountRefs = new Set([...payload.accounts.map((a) => a.ref), ...payload.facts.filter((f) => f.subject_type === "ACCOUNT").map((f) => f.subject_ref)]);
  return {
    persons: [...personRefs].map((ref) => {
      const decl = payload.persons.find((p) => p.ref === ref);
      const match = decl ? b.persons.find((p) => norm(p.display_name) === norm(decl.display_name)) : undefined;
      return { ref, label: decl?.display_name ?? ref, suggested: match?.id ?? (decl ? "NEW" : ""), options: b.persons.map((p) => ({ id: p.id, label: p.display_name })) };
    }),
    accounts: [...accountRefs].map((ref) => {
      const decl = payload.accounts.find((a) => a.ref === ref);
      const match = decl ? b.accounts.find((a) => norm(a.label) === norm(decl.label)) : undefined;
      return { ref, label: decl?.label ?? ref, suggested: match?.id ?? (decl ? "NEW" : ""), options: b.accounts.map((a) => ({ id: a.id, label: a.label })) };
    }),
  };
}
