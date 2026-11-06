import { z } from "zod";
import { DecimalString, IsoDate, BALANCE_BASES, CALCULATION_SCOPES, DeclaredInputsSchema } from "./calc";
import { ACCOUNT_TYPES, SOURCE_KINDS, SUBJECT_TYPES, VALUE_KINDS } from "./enums";

/**
 * Explicitly supported import contract `sagespan.import.v1`.
 *
 * - org_id is NEVER part of the file; it is derived from the authenticated
 *   server context at import time.
 * - vendor_label is free-text metadata, not a functional integration.
 * - Every fact carries a typed value kind, as-of date and a source location.
 * - Unsupported formats are rejected with an actionable explanation; nothing
 *   is parsed heuristically.
 */
export const IMPORT_SCHEMA_VERSION = "sagespan.import.v1" as const;

export const ImportPersonSchema = z.strictObject({
  ref: z.string().min(1).max(64),
  display_name: z.string().min(1).max(120),
  birth_date: IsoDate.nullable().optional(),
  role_in_household: z.enum(["PRIMARY", "SPOUSE", "DEPENDENT", "OTHER"]).default("OTHER"),
});

export const ImportAccountSchema = z.strictObject({
  ref: z.string().min(1).max(64),
  label: z.string().min(1).max(120),
  account_type: z.enum(ACCOUNT_TYPES),
  owner_ref: z.string().min(1).max(64),
  is_inherited: z.boolean().nullable().optional(),
  custodian_label: z.string().max(120).nullable().optional(),
});

export const ImportBeneficiarySchema = z.strictObject({
  account_ref: z.string().min(1),
  person_ref: z.string().min(1).nullable().optional(),
  beneficiary_label: z.string().max(120).nullable().optional(),
  relationship: z.enum(["SPOUSE", "NON_SPOUSE_INDIVIDUAL", "TRUST", "ESTATE", "CHARITY", "OTHER"]),
  designation_type: z.enum(["PRIMARY", "CONTINGENT"]),
  share_percentage: DecimalString,
  sole_primary_entire_year: z.boolean().nullable().optional(),
  effective_from: IsoDate.nullable().optional(),
  source_location: z.string().max(200).nullable().optional(),
});

export const ImportFactSchema = z.strictObject({
  subject_type: z.enum(SUBJECT_TYPES),
  subject_ref: z.string().min(1).max(64),
  field_key: z.string().min(1).max(80),
  value_kind: z.enum(VALUE_KINDS),
  value: z.string().min(1).max(200),
  currency: z.string().length(3).nullable().optional(),
  unit: z.string().max(16).nullable().optional(),
  as_of_date: IsoDate,
  tax_year: z.number().int().nullable().optional(),
  source_location: z.string().max(200).nullable().optional(),
  is_assumption: z.boolean().default(false),
  note: z.string().max(500).nullable().optional(),
});

export const ImportedCheckSchema = z.strictObject({
  metric_key: z.string().min(1).max(80),
  account_ref: z.string().min(1).max(64).nullable().optional(),
  tax_year: z.number().int(),
  value: DecimalString,
  currency: z.string().length(3).default("USD"),
  calculation_scope: z.enum(CALCULATION_SCOPES).default("UNKNOWN"),
  balance_basis: z.enum(BALANCE_BASES).default("UNKNOWN"),
  methodology_label: z.string().max(120).nullable().optional(),
  declared_inputs: DeclaredInputsSchema.nullable().optional(),
  assumptions: z.record(z.string(), z.string()).default({}),
  source_location: z.string().max(200).nullable().optional(),
});

export const ImportFileSchema = z.strictObject({
  schema_version: z.literal(IMPORT_SCHEMA_VERSION),
  source_kind: z.enum(SOURCE_KINDS),
  household_ref: z.string().min(1).max(120),
  vendor_label: z.string().max(120).nullable().optional(),
  export_as_of: IsoDate,
  tax_year: z.number().int().min(2022).max(2100),
  persons: z.array(ImportPersonSchema).max(50).default([]),
  accounts: z.array(ImportAccountSchema).max(200).default([]),
  beneficiaries: z.array(ImportBeneficiarySchema).max(200).default([]),
  facts: z.array(ImportFactSchema).max(5000).default([]),
  imported_checks: z.array(ImportedCheckSchema).max(500).default([]),
});
export type ImportFile = z.infer<typeof ImportFileSchema>;
export type ImportFact = z.infer<typeof ImportFactSchema>;
export type ImportedCheck = z.infer<typeof ImportedCheckSchema>;

/** CSV column contract (header row required; order free; mapping is explicit). */
export const IMPORT_CSV_COLUMNS = [
  { key: "record_type", required: true, description: "FACT | CHECK | PERSON | ACCOUNT | BENEFICIARY" },
  { key: "subject_type", required: false, description: "PERSON | ACCOUNT | HOUSEHOLD (FACT rows)" },
  { key: "subject_ref", required: true, description: "Stable reference within the file, e.g. owner, ira1" },
  { key: "subject_label", required: false, description: "Display label for PERSON/ACCOUNT rows" },
  { key: "field_key", required: false, description: "Typed fact key, e.g. account.year_end_balance; metric key for CHECK rows" },
  { key: "value_kind", required: false, description: "NUMBER | TEXT | DATE | BOOL" },
  { key: "value", required: true, description: "Value as text; decimals as plain strings" },
  { key: "currency", required: false, description: "ISO 4217, e.g. USD" },
  { key: "unit", required: false, description: "Unit for NUMBER values" },
  { key: "as_of_date", required: true, description: "YYYY-MM-DD the value is as of" },
  { key: "tax_year", required: false, description: "Tax year for CHECK rows" },
  { key: "source_location", required: false, description: "Page/row/pointer within the source" },
  { key: "note", required: false, description: "Free text (not parsed); ACCOUNT rows may carry owner_ref=<ref>" },
  { key: "declared_balance", required: false, description: "CHECK rows: balance the planning tool used" },
  { key: "declared_balance_as_of", required: false, description: "CHECK rows: as-of date of that balance" },
  { key: "declared_factor", required: false, description: "CHECK rows: divisor the planning tool used" },
  { key: "declared_table", required: false, description: "CHECK rows: table name the planning tool used" },
  { key: "declared_method", required: false, description: "CHECK rows: DIRECT_DIVISION or a vendor method label" },
  { key: "calculation_scope", required: false, description: "CHECK rows: SINGLE_ACCOUNT_ANNUAL_RMD | AGGREGATE_ALL_IRAS | OTHER | UNKNOWN" },
  { key: "balance_basis", required: false, description: "CHECK rows: ACTUAL_PRIOR_YEAR_END | PROJECTED | UNKNOWN" },
] as const;

export const IMPORT_CSV_REQUIRED_COLUMNS = IMPORT_CSV_COLUMNS.filter((c) => c.required).map((c) => c.key);
export const IMPORT_CSV_RECORD_TYPES = ["PERSON", "ACCOUNT", "FACT", "CHECK"] as const;
export type ImportCsvColumnKey = (typeof IMPORT_CSV_COLUMNS)[number]["key"];

export const IMPORT_LIMITS = {
  maxBytes: 2 * 1024 * 1024,
  maxRows: 5000,
  maxColumns: 64,
  allowedExtensions: [".csv", ".json"],
  allowedMimeTypes: ["text/csv", "application/json", "text/plain", "application/vnd.ms-excel", ""],
} as const;
