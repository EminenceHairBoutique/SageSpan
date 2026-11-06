import { IMPORT_CSV_COLUMNS, IMPORT_CSV_REQUIRED_COLUMNS, ImportFileSchema, type ImportCsvColumnKey, type ImportFile, type SourceKind } from "@sagespan/contracts";
import type { CsvTable } from "./csv";

/**
 * Maps a parsed CSV table onto the `sagespan.import.v1` contract via an
 * explicit column mapping (contract column -> file header). Nothing is
 * guessed from values; only header names are auto-suggested.
 */
export type ColumnMapping = Partial<Record<ImportCsvColumnKey, string>>;

export function suggestColumnMapping(headers: string[]): ColumnMapping {
  const norm = (s: string) => s.trim().toLowerCase().replace(/[\s-]+/g, "_");
  const mapping: ColumnMapping = {};
  for (const col of IMPORT_CSV_COLUMNS) {
    const hit = headers.find((h) => norm(h) === col.key);
    if (hit) mapping[col.key] = hit;
  }
  return mapping;
}

export function missingRequiredColumns(mapping: ColumnMapping): string[] {
  return IMPORT_CSV_REQUIRED_COLUMNS.filter((k) => !mapping[k]);
}

export interface CsvImportMeta {
  source_kind: SourceKind;
  household_ref: string;
  vendor_label: string | null;
  export_as_of: string;
  tax_year: number;
}

export interface CsvConversion {
  ok: true;
  file: ImportFile;
  rowCount: number;
}

export interface CsvConversionError {
  ok: false;
  errors: string[];
}

export function csvTableToImportFile(table: CsvTable, mapping: ColumnMapping, meta: CsvImportMeta): CsvConversion | CsvConversionError {
  const errors: string[] = [];
  const missing = missingRequiredColumns(mapping);
  if (missing.length) return { ok: false, errors: [`Missing required columns: ${missing.join(", ")}.`] };
  const idx = (key: ImportCsvColumnKey): number => {
    const header = mapping[key];
    if (!header) return -1;
    return table.headers.indexOf(header);
  };
  const cell = (row: string[], key: ImportCsvColumnKey): string => {
    const i = idx(key);
    return i >= 0 ? (row[i] ?? "").trim() : "";
  };
  const persons: ImportFile["persons"] = [];
  const accounts: ImportFile["accounts"] = [];
  const facts: ImportFile["facts"] = [];
  const checks: ImportFile["imported_checks"] = [];
  table.rows.forEach((row, i) => {
    const rowNo = i + 2;
    const type = cell(row, "record_type").toUpperCase();
    const ref = cell(row, "subject_ref");
    const loc = cell(row, "source_location") || `row ${rowNo}`;
    try {
      switch (type) {
        case "PERSON": {
          const role = cell(row, "value").toUpperCase();
          persons.push({ ref, display_name: cell(row, "subject_label") || ref, birth_date: null, role_in_household: (["PRIMARY", "SPOUSE", "DEPENDENT", "OTHER"].includes(role) ? role : "OTHER") as "PRIMARY" | "SPOUSE" | "DEPENDENT" | "OTHER" });
          break;
        }
        case "ACCOUNT": {
          const note = cell(row, "note");
          const owner = /owner_ref=([^;]+)/.exec(note)?.[1]?.trim();
          if (!owner) throw new Error("ACCOUNT rows need note 'owner_ref=<person ref>'");
          const custodian = /custodian_label=([^;]+)/.exec(note)?.[1]?.trim() ?? null;
          accounts.push({ ref, label: cell(row, "subject_label") || ref, account_type: cell(row, "value").toUpperCase() as ImportFile["accounts"][number]["account_type"], owner_ref: owner, is_inherited: null, custodian_label: custodian });
          break;
        }
        case "FACT": {
          facts.push({
            subject_type: (cell(row, "subject_type").toUpperCase() || "ACCOUNT") as "PERSON" | "ACCOUNT" | "HOUSEHOLD",
            subject_ref: ref,
            field_key: cell(row, "field_key"),
            value_kind: (cell(row, "value_kind").toUpperCase() || "TEXT") as "NUMBER" | "TEXT" | "DATE" | "BOOL",
            value: cell(row, "value"),
            currency: cell(row, "currency") || null,
            unit: cell(row, "unit") || null,
            as_of_date: cell(row, "as_of_date"),
            tax_year: cell(row, "tax_year") ? Number(cell(row, "tax_year")) : null,
            source_location: loc,
            is_assumption: false,
            note: cell(row, "note") || null,
          });
          break;
        }
        case "CHECK": {
          const declared = {
            balance: cell(row, "declared_balance") || null,
            balance_as_of: cell(row, "declared_balance_as_of") || null,
            factor: cell(row, "declared_factor") || null,
            table: cell(row, "declared_table") || null,
            method: cell(row, "declared_method") || null,
          };
          const hasDeclared = Object.values(declared).some((v) => v);
          checks.push({
            metric_key: cell(row, "field_key"),
            account_ref: ref || null,
            tax_year: Number(cell(row, "tax_year")),
            value: cell(row, "value"),
            currency: cell(row, "currency") || "USD",
            calculation_scope: (cell(row, "calculation_scope").toUpperCase() || "UNKNOWN") as ImportFile["imported_checks"][number]["calculation_scope"],
            balance_basis: (cell(row, "balance_basis").toUpperCase() || "UNKNOWN") as ImportFile["imported_checks"][number]["balance_basis"],
            methodology_label: null,
            declared_inputs: hasDeclared ? declared : null,
            assumptions: {},
            source_location: loc,
          });
          break;
        }
        default:
          throw new Error(`Unknown record_type '${type || "(blank)"}' (expected PERSON, ACCOUNT, FACT or CHECK)`);
      }
    } catch (e) {
      errors.push(`Row ${rowNo}: ${e instanceof Error ? e.message : String(e)}`);
    }
  });
  if (errors.length) return { ok: false, errors };
  const candidate = { schema_version: "sagespan.import.v1" as const, source_kind: meta.source_kind, household_ref: meta.household_ref, vendor_label: meta.vendor_label, export_as_of: meta.export_as_of, tax_year: meta.tax_year, persons, accounts, beneficiaries: [], facts, imported_checks: checks };
  const parsed = ImportFileSchema.safeParse(candidate);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.slice(0, 20).map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`) };
  }
  return { ok: true, file: parsed.data, rowCount: table.rows.length };
}
