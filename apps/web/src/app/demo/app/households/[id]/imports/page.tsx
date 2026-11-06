import { notFound } from "next/navigation";
import { IMPORT_CSV_COLUMNS, IMPORT_LIMITS, can } from "@sagespan/contracts";
import { getDemoActor } from "@/auth/actor";
import { suggestEntityMapping, type StagedCsv } from "@/domain/imports";
import { householdBundle, householdOrNull } from "@/domain/queries";
import { getStore } from "@/domain/store";
import { applyCsvMappingAction, reconcileImportAction, uploadImportAction } from "@/server/actions";
import { ActionForm } from "@/ui/ActionForm";
import { Alert, Card, Chip, Field, Td, Th, inputClasses } from "@/ui/primitives";

export const dynamic = "force-dynamic";

const SAMPLES = [
  { name: "reyes_custodian_statement_2025-12-31.json", label: "Reyes custodian statement (JSON, primary evidence)", hint: "Import into Reyes-Lindqvist to supply the missing year-end balance, beneficiary and date-of-birth evidence." },
  { name: "reyes_plan_export_2026.csv", label: "Reyes plan export (CSV contract)", hint: "Shows the CSV column mapping step." },
  { name: "patel_plan_export_2026.json", label: "Patel plan export (JSON contract)", hint: "The planning-tool export already reconciled for Patel." },
  { name: "unsupported_vendor_sample.csv", label: "Unsupported vendor layout (CSV)", hint: "Demonstrates actionable rejection: headers do not match the contract." },
];

export default async function ImportsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await getDemoActor();
  const state = getStore().read();
  if (!householdOrNull(state, actor.org_id, id)) notFound();
  const b = householdBundle(state, actor.org_id, id);
  const canImport = can(actor.role, "import.create");
  const draft = b.imports.find((i) => i.import_status === "IMPORT_DRAFT" && i.format === "CSV");
  const mapped = b.imports.find((i) => i.import_status === "MAPPED");
  const entitySuggestion = mapped ? suggestEntityMapping(state, actor, mapped.id) : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        <Card title="1 · Upload a supported file" subtitle={`Only sagespan.import.v1 JSON or the documented CSV contract. Max ${IMPORT_LIMITS.maxBytes / 1024 / 1024} MB, ${IMPORT_LIMITS.maxRows} rows. The file's SHA-256 is recorded before parsing.`}>
          <ActionForm action={uploadImportAction} hidden={{ household_id: id }} submitLabel="Upload and validate" pendingLabel="Validating…" disabled={!canImport} disabledReason={`Role ${actor.role} cannot import.`}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="File" required>
                <input type="file" name="file" accept=".csv,.json,text/csv,application/json" required className="block w-full text-sm file:mr-3 file:rounded-lg file:border file:border-line-strong file:bg-surface file:px-3 file:py-1.5 file:text-sm file:font-medium" />
              </Field>
              <Field label="Source kind" required hint="Statements, profiles and beneficiary forms are primary evidence; plan exports are claims to be corroborated.">
                <select name="source_kind" defaultValue="PLAN_EXPORT" className={inputClasses}>
                  <option value="PLAN_EXPORT">Planning-tool export</option>
                  <option value="CUSTODIAN_STATEMENT">Custodian statement</option>
                  <option value="CUSTODIAN_PROFILE">Custodian account profile</option>
                  <option value="BENEFICIARY_FORM">Beneficiary designation form</option>
                  <option value="MANUAL_ENTRY">Manual entry</option>
                </select>
              </Field>
              <Field label="Vendor label (free text, metadata only)" hint="Not an integration. Naming a vendor here does not connect to it.">
                <input type="text" name="vendor_label" maxLength={120} placeholder="e.g. Planning tool export (synthetic)" className={inputClasses} />
              </Field>
            </div>
          </ActionForm>
        </Card>

        {draft && (
          <Card title="2 · Map CSV columns" subtitle={`${draft.source_document_id ? b.documents.find((d) => d.id === draft.source_document_id)?.filename : draft.id}: choose which file column feeds each contract column. Required columns are marked.`}>
            <CsvMappingForm importId={draft.id} staged={draft.staged_payload as StagedCsv} taxYear={b.household.tax_year} householdLabel={b.household.label} />
          </Card>
        )}

        {mapped && entitySuggestion && (
          <Card title={draft ? "3 · Map entities and reconcile" : "2 · Map entities and reconcile"} subtitle="Match the file's references to this household's people and accounts, or create new ones. Reconciliation classifies facts and opens conflicts.">
            <ActionForm action={reconcileImportAction} hidden={{ import_id: mapped.id }} submitLabel="Reconcile into facts" pendingLabel="Reconciling…" disabled={!can(actor.role, "import.map")} disabledReason={`Role ${actor.role} cannot map imports.`}>
              <div className="grid gap-3 sm:grid-cols-2">
                {entitySuggestion.persons.map((p) => (
                  <Field key={p.ref} label={`Person ref "${p.ref}" — ${p.label}`}>
                    <select name={`person:${p.ref}`} defaultValue={p.suggested} className={inputClasses} required>
                      <option value="">Choose…</option>
                      <option value="NEW">Create new person</option>
                      {p.options.map((o) => (
                        <option key={o.id} value={o.id}>
                          Existing: {o.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                ))}
                {entitySuggestion.accounts.map((a) => (
                  <Field key={a.ref} label={`Account ref "${a.ref}" — ${a.label}`}>
                    <select name={`account:${a.ref}`} defaultValue={a.suggested} className={inputClasses} required>
                      <option value="">Choose…</option>
                      <option value="NEW">Create new account</option>
                      {a.options.map((o) => (
                        <option key={o.id} value={o.id}>
                          Existing: {o.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                ))}
              </div>
            </ActionForm>
          </Card>
        )}

        <Card title="Import history">
          <div className="-mx-5 overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead className="border-b border-line bg-surface-muted/60">
                <tr>
                  <Th>Import</Th>
                  <Th>File</Th>
                  <Th>Kind</Th>
                  <Th>Format</Th>
                  <Th>Status</Th>
                  <Th>Rows</Th>
                  <Th>Issues</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {b.imports.map((i) => {
                  const doc = b.documents.find((d) => d.id === i.source_document_id);
                  return (
                    <tr key={i.id}>
                      <Td>
                        <code className="font-mono text-xs">{i.id}</code>
                        <div className="text-xs text-ink-faint">{i.imported_at.slice(0, 10)}</div>
                      </Td>
                      <Td>
                        {doc?.filename ?? "—"}
                        {doc && <div className="font-mono text-[11px] text-ink-faint">{doc.sha256.slice(0, 16)}…</div>}
                      </Td>
                      <Td>{i.source_kind.toLowerCase().replace(/_/g, " ")}</Td>
                      <Td>{i.format}</Td>
                      <Td>
                        <Chip tone={i.import_status === "RECONCILED" ? "teal" : i.import_status === "REJECTED" ? "conflict" : "amber"}>{i.import_status.toLowerCase().replace(/_/g, " ")}</Chip>
                      </Td>
                      <Td>{i.row_count}</Td>
                      <Td className="text-xs text-ink-muted">{i.issues.length ? i.issues.join("; ") : "—"}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
      <div className="space-y-6">
        <Card title="Sample files (synthetic)" subtitle="Download, then upload above. These are the only supported layouts in this build.">
          <ul className="space-y-3 text-sm">
            {SAMPLES.map((s) => (
              <li key={s.name}>
                <a href={`/api/samples/${s.name}`} className="font-semibold text-navy underline-offset-2 hover:underline" download>
                  {s.label}
                </a>
                <p className="text-xs text-ink-muted">{s.hint}</p>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="CSV contract columns">
          <ul className="space-y-1 text-xs">
            {IMPORT_CSV_COLUMNS.map((c) => (
              <li key={c.key}>
                <code className="font-mono">{c.key}</code>
                {c.required && <span className="text-conflict"> *</span>} <span className="text-ink-muted">— {c.description}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Alert tone="slate" title="What is not supported">
          PDF statements, spreadsheets and vendor-native exports are not parsed. There is no OCR and no AI extraction; a file either matches the contract or is rejected with the reason.
        </Alert>
      </div>
    </div>
  );
}

function CsvMappingForm({ importId, staged, taxYear, householdLabel }: { importId: string; staged: StagedCsv; taxYear: number; householdLabel: string }) {
  return (
    <ActionForm action={applyCsvMappingAction} hidden={{ import_id: importId, household_ref: householdLabel }} submitLabel="Apply mapping" pendingLabel="Validating…" successMessage="Mapping applied; the file validated against the contract. Continue with entity mapping.">
      {staged.missingRequired.length > 0 && (
        <Alert tone="amber" title={`Headers did not auto-match ${staged.missingRequired.length} required column(s)`}>
          Detected headers: {staged.headers.join(", ")}. Map them below or download the CSV template. If your export cannot provide <code>record_type</code>, <code>subject_ref</code>, <code>value</code> and <code>as_of_date</code>, it is not supported in this build.
        </Alert>
      )}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {IMPORT_CSV_COLUMNS.map((c) => (
          <Field key={c.key} label={c.key} required={c.required}>
            <select name={`map_${c.key}`} defaultValue={staged.suggestedMapping[c.key] ?? ""} className={inputClasses}>
              <option value="">(not provided)</option>
              {staged.headers.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </Field>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Export as-of date" required>
          <input type="date" name="export_as_of" defaultValue={staged.meta.export_as_of} required className={inputClasses} />
        </Field>
        <Field label="Tax year" required>
          <input type="number" name="tax_year" defaultValue={taxYear} min={2022} max={2100} required className={inputClasses} />
        </Field>
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer font-medium text-navy">Preview first rows ({staged.rows.length} data rows)</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr>
                {staged.headers.map((h) => (
                  <th key={h} className="border-b border-line px-2 py-1 text-left font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {staged.rows.slice(0, 5).map((r, i) => (
                <tr key={i}>
                  {r.map((c, j) => (
                    <td key={j} className="border-b border-line px-2 py-1 whitespace-nowrap">
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </ActionForm>
  );
}
