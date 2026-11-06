import { z } from "zod";
import { ACCOUNT_TYPES, COVERAGE_STATUSES, DESIGNATION_TYPES, DISCREPANCY_CLASSIFICATIONS, RELATIONSHIPS, RESULT_STATUSES } from "./enums";

/**
 * Zod mirror of the Python calculation-service contract
 * (packages/contracts/openapi/calculator.openapi.json). Decimals travel as
 * strings; the web app never parses them into floats for arithmetic.
 */
export const DecimalString = z.string().regex(/^-?\d+(\.\d+)?$/, "decimal string required");
export const IsoDate = z.iso.date();

export const MoneySchema = z.strictObject({
  amount: DecimalString,
  currency: z.string().length(3).default("USD"),
  as_of_date: IsoDate,
});

export const OwnerSchema = z.strictObject({
  person_ref: z.string().min(1),
  birth_date: IsoDate.nullable().optional(),
  is_alive: z.boolean().nullable().optional(),
});

export const AccountInputSchema = z.strictObject({
  account_ref: z.string().min(1),
  account_type: z.enum(ACCOUNT_TYPES).nullable().optional(),
  is_inherited: z.boolean().nullable().optional(),
  prior_year_end_balance: MoneySchema.nullable().optional(),
  prior_prior_year_end_balance: MoneySchema.nullable().optional(),
  outstanding_rollover_adjustment: DecimalString.nullable().optional(),
});

export const BeneficiaryInputSchema = z.strictObject({
  person_ref: z.string().min(1),
  relationship: z.enum(RELATIONSHIPS),
  designation_type: z.enum(DESIGNATION_TYPES),
  share_percent: DecimalString,
  birth_date: IsoDate.nullable().optional(),
  sole_primary_entire_year: z.boolean().nullable().optional(),
});

export const DeclaredInputsSchema = z.strictObject({
  balance: DecimalString.nullable().optional(),
  balance_as_of: IsoDate.nullable().optional(),
  factor: DecimalString.nullable().optional(),
  table: z.string().nullable().optional(),
  method: z.string().nullable().optional(),
});

export const CALCULATION_SCOPES = ["SINGLE_ACCOUNT_ANNUAL_RMD", "AGGREGATE_ALL_IRAS", "OTHER", "UNKNOWN"] as const;
export const BALANCE_BASES = ["ACTUAL_PRIOR_YEAR_END", "PROJECTED", "UNKNOWN"] as const;

export const ImportedComparisonSchema = z.strictObject({
  import_value_ref: z.string().min(1),
  amount: DecimalString,
  currency: z.string().length(3).default("USD"),
  tax_year: z.number().int(),
  vendor_label: z.string().nullable().optional(),
  calculation_scope: z.enum(CALCULATION_SCOPES).default("UNKNOWN"),
  balance_basis: z.enum(BALANCE_BASES).default("UNKNOWN"),
  declared_inputs: DeclaredInputsSchema.nullable().optional(),
  assumptions: z.record(z.string(), z.string()).default({}),
});

export const ToleranceSchema = z.strictObject({
  absolute: DecimalString.default("1.00"),
  relative: DecimalString.default("0.001"),
});

export const SnapshotRefSchema = z.strictObject({
  snapshot_id: z.string().min(1),
  revision: z.number().int(),
  input_hash: z.string().regex(/^[0-9a-f]{64}$/),
});

export const RmdCheckRequestSchema = z.strictObject({
  schema_version: z.literal("sagespan.rmd-check.v1"),
  tax_year: z.number().int().min(2022).max(2100),
  owner: OwnerSchema,
  account: AccountInputSchema,
  beneficiaries: z.array(BeneficiaryInputSchema).nullable().optional(),
  first_rmd_election: z
    .strictObject({
      deferred_first_rmd_to_april_1: z.boolean().nullable().optional(),
      first_rmd_satisfied_in_first_year: z.boolean().nullable().optional(),
    })
    .nullable()
    .optional(),
  imported_comparison: ImportedComparisonSchema.nullable().optional(),
  tolerance: ToleranceSchema.nullable().optional(),
  snapshot_ref: SnapshotRefSchema.nullable().optional(),
});
export type RmdCheckRequest = z.infer<typeof RmdCheckRequestSchema>;

export const ReasonSchema = z.object({ code: z.string(), message: z.string(), rule_ref: z.string().nullable().optional() });
export type Reason = z.infer<typeof ReasonSchema>;

export const EligibilitySchema = z.object({
  status: z.enum(["SUPPORTED", "NOT_REQUIRED", "UNSUPPORTED", "INDETERMINATE"]),
  applicable_age: z.string().nullable().optional(),
  owner_age_in_tax_year: z.number().int().nullable().optional(),
  first_distribution_year: z.number().int().nullable().optional(),
  required_beginning_date: IsoDate.nullable().optional(),
  table_id: z.string().nullable().optional(),
  reasons: z.array(ReasonSchema).default([]),
});

export const ObligationEventSchema = z.object({
  event_type: z.enum(["ANNUAL_RMD", "DEFERRED_FIRST_YEAR_RMD"]),
  distribution_year: z.number().int(),
  deadline: IsoDate,
  status: z.enum(["COMPUTED", "INDETERMINATE", "REPORTED_SATISFIED_UNVERIFIED", "NOT_APPLICABLE"]),
  amount: DecimalString.nullable().optional(),
  basis_balance: DecimalString.nullable().optional(),
  basis_as_of: IsoDate.nullable().optional(),
  owner_age: z.number().int().nullable().optional(),
  factor: DecimalString.nullable().optional(),
  table_id: z.string().nullable().optional(),
  formula: z.string().nullable().optional(),
  reasons: z.array(ReasonSchema).default([]),
});
export type ObligationEvent = z.infer<typeof ObligationEventSchema>;

export const DiscrepancySchema = z.object({
  classification: z.enum(DISCREPANCY_CLASSIFICATIONS),
  comparable: z.boolean(),
  import_value_ref: z.string().nullable().optional(),
  computed_amount: DecimalString.nullable().optional(),
  imported_amount: DecimalString.nullable().optional(),
  difference: DecimalString.nullable().optional(),
  tolerance_absolute: DecimalString.nullable().optional(),
  tolerance_relative: DecimalString.nullable().optional(),
  tolerance_applied: DecimalString.nullable().optional(),
  explanation: z.string(),
  next_step: z.string(),
});
export type DiscrepancyResult = z.infer<typeof DiscrepancySchema>;

export const RuleSetRefSchema = z.object({
  rule_set_id: z.string(),
  version: z.string(),
  status: z.enum(["PUBLISHED", "DRAFT"]),
  checksum: z.string().regex(/^[0-9a-f]{64}$/),
  effective_from: IsoDate,
  effective_to: IsoDate.nullable().optional(),
  sources: z.array(z.object({ title: z.string(), citation: z.string(), url: z.string().nullable().optional() })).default([]),
});
export type RuleSetRef = z.infer<typeof RuleSetRefSchema>;

export const ReceiptSchema = z.object({
  receipt_version: z.literal("sagespan.receipt.v1"),
  engine_name: z.string(),
  engine_version: z.string(),
  request_hash: z.string().regex(/^[0-9a-f]{64}$/),
  run_hash: z.string().regex(/^[0-9a-f]{64}$/),
  computed_at: z.string(),
  org_context: z.object({ org_id: z.string() }),
  snapshot_ref: SnapshotRefSchema.nullable().optional(),
  rule_sets: z.array(RuleSetRefSchema),
  inputs_used: z.record(z.string(), z.unknown()),
  formula: z.string().nullable().optional(),
  limitations: z.array(z.string()),
});
export type Receipt = z.infer<typeof ReceiptSchema>;

export const RmdCheckResponseSchema = z.object({
  check_type: z.literal("RMD_ANNUAL"),
  result_status: z.enum(RESULT_STATUSES),
  coverage_status: z.enum(COVERAGE_STATUSES),
  tax_year: z.number().int(),
  eligibility: EligibilitySchema,
  unsupported_reasons: z.array(ReasonSchema).default([]),
  annual_rmd: DecimalString.nullable().optional(),
  events: z.array(ObligationEventSchema),
  discrepancy: DiscrepancySchema.nullable().optional(),
  receipt: ReceiptSchema,
});
export type RmdCheckResponse = z.infer<typeof RmdCheckResponseSchema>;

export const RuleSetListResponseSchema = z.object({
  rule_sets: z.array(RuleSetRefSchema),
  engine_name: z.string(),
  engine_version: z.string(),
});

export const ServiceErrorSchema = z.object({
  error: z.object({ code: z.string(), message: z.string(), details: z.unknown().optional() }),
});
