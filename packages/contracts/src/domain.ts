import type {
  AccountType,
  AuditEventType,
  ConflictStatus,
  CoverageStatus,
  DesignationType,
  DiscrepancyClassification,
  FactStatus,
  Materiality,
  Relationship,
  Role,
  SourceKind,
  SubjectType,
  ValueKind,
  WorkflowStatus,
} from "./enums";
import type { RmdCheckRequest, RmdCheckResponse } from "./calc";
import type { AiFeedback, AiRunRecord } from "./ai";
import type { UserDecisionEvent } from "./decisions";
import type { CashAccount, IncomeStream, Liability, PersonalCalcRun, PersonalProfile, PersonalSnapshot, RecurringObligation, RetirementIntake, SavingsGoal, VariableSpendingPattern } from "./personal";
import type { PersonalRecordRevision } from "./personal-records";
import type { ConsentGrant, Principal, Workspace, WorkspaceMembership } from "./workspace";

/**
 * Domain record shapes. These mirror the Supabase tables in
 * supabase/migrations (snake_case columns) so that the demo file store and a
 * future Supabase-backed store share one shape.
 */

export interface OrgPolicies {
  separation_of_duties: boolean;
  allow_nonmaterial_exceptions: boolean;
  approver_roles: Role[];
  tolerance: { absolute: string; relative: string };
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  policies: OrgPolicies;
  created_at: string;
}

export interface Profile {
  user_id: string;
  display_name: string;
  title: string;
}

export interface Membership {
  id: string;
  org_id: string;
  user_id: string;
  role: Role;
  status: "ACTIVE" | "INVITED" | "DISABLED";
}

export interface Household {
  id: string;
  org_id: string;
  label: string;
  status: "ACTIVE" | "ARCHIVED" | "PROSPECT";
  workflow_status: WorkflowStatus;
  assignee_user_id: string | null;
  source_tool_label: string | null;
  tax_year: number;
  current_revision: number;
  created_at: string;
  updated_at: string;
}

export interface Person {
  id: string;
  org_id: string;
  household_id: string;
  display_name: string;
  role_in_household: "PRIMARY" | "SPOUSE" | "DEPENDENT" | "OTHER";
}

export interface Account {
  id: string;
  org_id: string;
  household_id: string;
  label: string;
  account_type: AccountType;
  tax_character: "PRE_TAX" | "ROTH" | "TAXABLE" | "OTHER";
  currency: string;
}

export interface AccountOwnership {
  id: string;
  org_id: string;
  account_id: string;
  person_id: string;
  ownership_type: "INDIVIDUAL" | "JOINT" | "TRUST" | "CUSTODIAL";
  percentage: string;
  effective_from: string;
  effective_to: string | null;
}

export interface BeneficiaryDesignation {
  id: string;
  org_id: string;
  account_id: string;
  beneficiary_person_id: string | null;
  beneficiary_label: string | null;
  relationship: Relationship;
  designation_type: DesignationType;
  share_percentage: string;
  sole_primary_entire_year: boolean | null;
  effective_from: string;
  effective_to: string | null;
  source_fact_id: string | null;
  source_document_id: string | null;
}

export interface SourceDocument {
  id: string;
  org_id: string;
  household_id: string;
  source_kind: SourceKind;
  source_vendor_label: string | null;
  filename: string;
  sha256: string;
  byte_length: number;
  storage_path: string | null;
  uploaded_at: string;
  uploaded_by: string | null;
  source_as_of: string | null;
  parser_version: string;
  synthetic: boolean;
}

export interface SourceLocation {
  id: string;
  org_id: string;
  document_id: string;
  page_number: number | null;
  row_number: number | null;
  text_span: string | null;
  json_pointer: string | null;
}

export interface Fact {
  id: string;
  org_id: string;
  household_id: string;
  subject_type: SubjectType;
  subject_id: string;
  field_key: string;
  value_kind: ValueKind;
  value_number: string | null;
  value_text: string | null;
  value_date: string | null;
  value_bool: boolean | null;
  value_currency: string | null;
  unit: string | null;
  as_of_date: string;
  effective_from: string | null;
  effective_to: string | null;
  source_document_id: string | null;
  source_location_id: string | null;
  verification_status: FactStatus;
  revision: number;
  supersedes_fact_id: string | null;
  superseded: boolean;
  assumption_id: string | null;
  note: string | null;
  created_at: string;
  created_by: string | null;
}

export interface FactConflict {
  id: string;
  org_id: string;
  household_id: string;
  fact_group_key: string;
  field_key: string;
  subject_type: SubjectType;
  subject_id: string;
  materiality: Materiality;
  status: ConflictStatus;
  reason: string;
  fact_ids: string[];
  chosen_fact_id: string | null;
  resolution_note: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
}

export interface AssumptionSet {
  id: string;
  org_id: string;
  household_id: string;
  version: number;
  created_by: string;
  created_at: string;
  methodology_id: string | null;
}

export interface Assumption {
  id: string;
  org_id: string;
  assumption_set_id: string;
  key: string;
  value_kind: ValueKind;
  value_decimal: string | null;
  value_text: string | null;
  unit: string | null;
  source_fact_id: string | null;
  basis: string;
}

export interface PlanImport {
  id: string;
  org_id: string;
  household_id: string;
  source_document_id: string | null;
  source_vendor_label: string | null;
  source_kind: SourceKind;
  format: "CSV" | "JSON";
  format_version: string;
  imported_at: string;
  imported_by: string | null;
  parser_version: string;
  import_status: "IMPORT_DRAFT" | "MAPPED" | "RECONCILED" | "REJECTED";
  mapping: Record<string, string> | null;
  row_count: number;
  issues: string[];
  /** Parsed, validated payload awaiting mapping/reconciliation (synthetic only in demo). */
  staged_payload: unknown | null;
}

export interface ImportedPlanValue {
  id: string;
  org_id: string;
  import_id: string;
  household_id: string;
  account_id: string | null;
  metric_key: string;
  tax_year: number | null;
  value_decimal: string;
  currency: string;
  methodology_label: string | null;
  calculation_scope: "SINGLE_ACCOUNT_ANNUAL_RMD" | "AGGREGATE_ALL_IRAS" | "OTHER" | "UNKNOWN";
  balance_basis: "ACTUAL_PRIOR_YEAR_END" | "PROJECTED" | "UNKNOWN";
  declared_inputs: { balance?: string | null; balance_as_of?: string | null; factor?: string | null; table?: string | null; method?: string | null } | null;
  assumptions: Record<string, string>;
  source_location_id: string | null;
}

export interface Snapshot {
  id: string;
  org_id: string;
  household_id: string;
  revision: number;
  content_sha256: string;
  rule_set_versions: Record<string, string>;
  assumption_set_id: string | null;
  created_by: string;
  created_by_role: Role;
  created_at: string;
  status: "FROZEN" | "SUPERSEDED";
  canonical_payload: SnapshotPayload;
}

export interface SnapshotPayload {
  snapshot_version: "sagespan.snapshot.v1";
  household_id: string;
  tax_year: number;
  revision: number;
  facts: Array<Pick<Fact, "id" | "subject_type" | "subject_id" | "field_key" | "value_kind" | "value_number" | "value_text" | "value_date" | "value_bool" | "value_currency" | "as_of_date" | "verification_status" | "source_document_id">>;
  source_documents: Array<Pick<SourceDocument, "id" | "source_kind" | "filename" | "sha256" | "source_as_of">>;
  ownership: Array<Pick<AccountOwnership, "account_id" | "person_id" | "ownership_type" | "percentage" | "effective_from" | "effective_to">>;
  beneficiaries: Array<Pick<BeneficiaryDesignation, "account_id" | "beneficiary_person_id" | "relationship" | "designation_type" | "share_percentage" | "sole_primary_entire_year">>;
  assumptions: Array<Pick<Assumption, "key" | "value_kind" | "value_decimal" | "value_text" | "basis">>;
  exceptions: Array<Pick<FactConflict, "id" | "field_key" | "materiality" | "resolution_note" | "resolved_by">>;
  imported_plan_values: Array<Pick<ImportedPlanValue, "id" | "metric_key" | "tax_year" | "value_decimal" | "currency" | "calculation_scope" | "balance_basis" | "declared_inputs" | "assumptions" | "account_id">>;
}

export interface CheckRun {
  id: string;
  org_id: string;
  snapshot_id: string;
  household_id: string;
  check_type: "RMD_ANNUAL";
  engine_name: string | null;
  engine_version: string | null;
  rule_set_versions: Record<string, string>;
  request_payload: RmdCheckRequest;
  request_sha256: string;
  response: RmdCheckResponse | null;
  response_sha256: string | null;
  executed_at: string;
  executed_by: string;
  run_status: "PASS" | "NOT_REQUIRED" | "UNSUPPORTED" | "INDETERMINATE" | "ERROR";
  coverage_status: CoverageStatus | null;
  error: { code: string; message: string } | null;
  request_hash_verified: boolean | null;
}

export interface Discrepancy {
  id: string;
  org_id: string;
  check_run_id: string;
  household_id: string;
  imported_plan_value_id: string | null;
  classification: DiscrepancyClassification;
  comparable: boolean;
  computed_amount: string | null;
  imported_amount: string | null;
  delta_amount: string | null;
  tolerance_applied: string | null;
  explanation: string;
  next_step: string;
  status: "OPEN" | "DISPOSITIONED";
  disposition: { by: string; role: Role; at: string; note: string } | null;
}

export interface Review {
  id: string;
  org_id: string;
  snapshot_id: string;
  household_id: string;
  reviewer_user_id: string;
  reviewer_role: Role;
  actor_type: "USER" | "SIMULATED_REVIEWER";
  decision: "REVIEWED" | "APPROVED" | "REJECTED";
  rationale: string;
  conflict_attestation: boolean;
  reviewed_at: string;
}

export interface ReviewComment {
  id: string;
  org_id: string;
  household_id: string;
  snapshot_id: string | null;
  author_user_id: string;
  author_role: Role;
  body: string;
  created_at: string;
}

export interface EvidencePacket {
  id: string;
  org_id: string;
  snapshot_id: string;
  household_id: string;
  review_id: string;
  generated_by: string;
  generated_at: string;
  sha256: string;
  packet_status: "GENERATED" | "EXPORTED";
  export_count: number;
  packet: unknown;
}

export interface AuditEvent {
  id: string;
  org_id: string;
  actor_user_id: string | null;
  actor_role: Role | null;
  actor_type: "USER" | "SYSTEM" | "SIMULATED_REVIEWER";
  event_type: AuditEventType;
  entity_type: string;
  entity_id: string;
  created_at: string;
  previous_event_hash: string | null;
  event_hash: string;
  payload_digest: string;
  request_id: string;
  summary: string;
}

export interface PilotInterest {
  id: string;
  created_at: string;
  firm_name: string;
  role: string;
  contact: string;
  advisors_band: string;
  planning_tools: string;
  note: string;
}

/**
 * Demo state version. v2 (V5) added the workspace model, Personal (B2C) records,
 * AI runs and feedback alongside the unchanged firm records; v3 (PERS-002) adds
 * the append-only personal record revision log and the `retired` flag on
 * personal records. A stored state with an older version is reseeded (synthetic
 * data only, nothing to migrate).
 */
export const DEMO_STATE_VERSION = "sagespan.demo-state.v3" as const;

export interface DataState {
  state_version: typeof DEMO_STATE_VERSION;
  seeded_at: string;
  mode: "DEMO_SYNTHETIC";
  organizations: Organization[];
  profiles: Profile[];
  memberships: Membership[];
  households: Household[];
  persons: Person[];
  accounts: Account[];
  account_ownership: AccountOwnership[];
  beneficiary_designations: BeneficiaryDesignation[];
  source_documents: SourceDocument[];
  source_locations: SourceLocation[];
  facts: Fact[];
  fact_conflicts: FactConflict[];
  assumption_sets: AssumptionSet[];
  assumptions: Assumption[];
  plan_imports: PlanImport[];
  imported_plan_values: ImportedPlanValue[];
  snapshots: Snapshot[];
  check_runs: CheckRun[];
  discrepancies: Discrepancy[];
  reviews: Review[];
  review_comments: ReviewComment[];
  evidence_packets: EvidencePacket[];
  audit_events: AuditEvent[];
  pilot_interest: PilotInterest[];
  // ---- V5: workspaces (firm workspaces map 1:1 onto organizations) ----
  principals: Principal[];
  workspaces: Workspace[];
  workspace_memberships: WorkspaceMembership[];
  consent_grants: ConsentGrant[];
  // ---- V5: Personal (B2C) records, every row scoped by workspace_id ----
  personal_profiles: PersonalProfile[];
  cash_accounts: CashAccount[];
  income_streams: IncomeStream[];
  recurring_obligations: RecurringObligation[];
  variable_spending: VariableSpendingPattern[];
  liabilities: Liability[];
  savings_goals: SavingsGoal[];
  retirement_intakes: RetirementIntake[];
  personal_snapshots: PersonalSnapshot[];
  personal_calc_runs: PersonalCalcRun[];
  user_decisions: UserDecisionEvent[];
  /** PERS-002: append-only history of every personal record write (create / update / retire). */
  personal_record_revisions: PersonalRecordRevision[];
  // ---- V5: AI draft runs and separate reviewer feedback ----
  ai_runs: AiRunRecord[];
  ai_feedback: AiFeedback[];
}
