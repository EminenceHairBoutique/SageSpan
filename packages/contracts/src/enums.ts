/**
 * Domain enumerations shared by the web app, the SQL schema and the fixtures.
 * Keep in sync with supabase/migrations/0001_types.sql.
 */

export const ROLES = ["ADMIN", "COMPLIANCE", "ADVISOR", "ANALYST", "VIEWER"] as const;
export type Role = (typeof ROLES)[number];

export const FACT_STATUSES = ["FACT_CONFIRMED", "FACT_ASSUMED", "NEEDS_CONFIRMATION", "FACT_CONFLICT"] as const;
export type FactStatus = (typeof FACT_STATUSES)[number];

export const FACT_STATUS_LABELS: Record<FactStatus, string> = {
  FACT_CONFIRMED: "Confirmed",
  FACT_ASSUMED: "Assumed",
  NEEDS_CONFIRMATION: "Needs confirmation",
  FACT_CONFLICT: "Conflict",
};

export const MATERIALITIES = ["MATERIAL", "NONMATERIAL"] as const;
export type Materiality = (typeof MATERIALITIES)[number];

export const CONFLICT_STATUSES = ["OPEN", "RESOLVED", "EXCEPTION_DOCUMENTED"] as const;
export type ConflictStatus = (typeof CONFLICT_STATUSES)[number];

export const WORKFLOW_STATUSES = [
  "IMPORT_DRAFT",
  "MAPPED",
  "RECONCILIATION_PENDING",
  "BLOCKED",
  "READY_TO_FREEZE",
  "FROZEN",
  "CHECK_COMPLETE",
  "REVIEW_PENDING",
  "REVIEWED",
  "APPROVED",
  "EXPORTED",
] as const;
export type WorkflowStatus = (typeof WORKFLOW_STATUSES)[number];

export const WORKFLOW_LABELS: Record<WorkflowStatus, string> = {
  IMPORT_DRAFT: "Import draft",
  MAPPED: "Mapped",
  RECONCILIATION_PENDING: "Reconciliation pending",
  BLOCKED: "Blocked",
  READY_TO_FREEZE: "Ready to freeze",
  FROZEN: "Frozen",
  CHECK_COMPLETE: "Check complete",
  REVIEW_PENDING: "Review pending",
  REVIEWED: "Reviewed",
  APPROVED: "Approved",
  EXPORTED: "Exported",
};

export const DISCREPANCY_CLASSIFICATIONS = [
  "SOURCE_CONFLICT",
  "STALE_INPUT",
  "RULE_DISAGREEMENT",
  "METHODOLOGY_DIFFERENCE",
  "MISSING_EVIDENCE",
  "UNSUPPORTED_CHECK",
  "WITHIN_TOLERANCE",
  "NOT_COMPARABLE",
] as const;
export type DiscrepancyClassification = (typeof DISCREPANCY_CLASSIFICATIONS)[number];

export const DISCREPANCY_LABELS: Record<DiscrepancyClassification, string> = {
  SOURCE_CONFLICT: "Source conflict",
  STALE_INPUT: "Stale input",
  RULE_DISAGREEMENT: "Rule disagreement",
  METHODOLOGY_DIFFERENCE: "Methodology difference",
  MISSING_EVIDENCE: "Missing evidence",
  UNSUPPORTED_CHECK: "Unsupported check",
  WITHIN_TOLERANCE: "Within tolerance",
  NOT_COMPARABLE: "Not comparable",
};

export const COVERAGE_STATUSES = ["SUPPORTED_VERIFIED", "SUPPORTED_UNVALIDATED", "NOT_COMPARABLE", "INDETERMINATE", "UNSUPPORTED"] as const;
export type CoverageStatus = (typeof COVERAGE_STATUSES)[number];

export const RESULT_STATUSES = ["PASS", "NOT_REQUIRED", "UNSUPPORTED", "INDETERMINATE"] as const;
export type ResultStatus = (typeof RESULT_STATUSES)[number];

export const ACCOUNT_TYPES = ["TRADITIONAL_IRA", "SEP_IRA", "SIMPLE_IRA", "ROTH_IRA", "EMPLOYER_401K", "EMPLOYER_403B", "OTHER"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const SOURCE_KINDS = ["CUSTODIAN_STATEMENT", "CUSTODIAN_PROFILE", "BENEFICIARY_FORM", "PLAN_EXPORT", "MANUAL_ENTRY"] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];

/** Source kinds that count as primary evidence for a fact (planning-tool exports are claims, not evidence). */
export const PRIMARY_EVIDENCE_KINDS: readonly SourceKind[] = ["CUSTODIAN_STATEMENT", "CUSTODIAN_PROFILE", "BENEFICIARY_FORM"];

export const VALUE_KINDS = ["NUMBER", "TEXT", "DATE", "BOOL"] as const;
export type ValueKind = (typeof VALUE_KINDS)[number];

export const SUBJECT_TYPES = ["PERSON", "ACCOUNT", "HOUSEHOLD"] as const;
export type SubjectType = (typeof SUBJECT_TYPES)[number];

export const RELATIONSHIPS = ["SPOUSE", "NON_SPOUSE_INDIVIDUAL", "TRUST", "ESTATE", "CHARITY", "OTHER"] as const;
export type Relationship = (typeof RELATIONSHIPS)[number];

export const DESIGNATION_TYPES = ["PRIMARY", "CONTINGENT"] as const;
export type DesignationType = (typeof DESIGNATION_TYPES)[number];

export const AUDIT_EVENT_TYPES = [
  "IMPORT_CREATED",
  "IMPORT_MAPPED",
  "IMPORT_RECONCILED",
  "FACT_CONFIRMED",
  "ASSUMPTION_RECORDED",
  "CONFLICT_RESOLVED",
  "EXCEPTION_DOCUMENTED",
  "SNAPSHOT_FROZEN",
  "CHECK_RUN_COMPLETED",
  "CHECK_RUN_FAILED",
  "SENT_TO_REVIEW",
  "REVIEW_COMMENT_ADDED",
  "DISCREPANCY_DISPOSITIONED",
  "REVIEW_RECORDED",
  "APPROVAL_RECORDED",
  "APPROVAL_DENIED",
  "PACKET_GENERATED",
  "PACKET_EXPORTED",
  "ASSIGNEE_CHANGED",
  "POLICY_UPDATED",
  "DEMO_RESET",
] as const;
export type AuditEventType = (typeof AUDIT_EVENT_TYPES)[number];
