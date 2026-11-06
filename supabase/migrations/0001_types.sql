-- SageSpan (provisional brand) - schema types
-- All business tables are tenant-scoped (org_id). Keep in sync with packages/contracts/src/enums.ts.

create extension if not exists pgcrypto with schema extensions;

create schema if not exists app;

create type app.role as enum ('ADMIN', 'COMPLIANCE', 'ADVISOR', 'ANALYST', 'VIEWER');
create type app.membership_status as enum ('ACTIVE', 'INVITED', 'DISABLED');
create type app.household_status as enum ('ACTIVE', 'ARCHIVED', 'PROSPECT');
create type app.workflow_status as enum (
  'IMPORT_DRAFT', 'MAPPED', 'RECONCILIATION_PENDING', 'BLOCKED', 'READY_TO_FREEZE',
  'FROZEN', 'CHECK_COMPLETE', 'REVIEW_PENDING', 'REVIEWED', 'APPROVED', 'EXPORTED'
);
create type app.fact_status as enum ('FACT_CONFIRMED', 'FACT_ASSUMED', 'NEEDS_CONFIRMATION', 'FACT_CONFLICT');
create type app.materiality as enum ('MATERIAL', 'NONMATERIAL');
create type app.conflict_status as enum ('OPEN', 'RESOLVED', 'EXCEPTION_DOCUMENTED');
create type app.value_kind as enum ('NUMBER', 'TEXT', 'DATE', 'BOOL');
create type app.subject_type as enum ('PERSON', 'ACCOUNT', 'HOUSEHOLD');
create type app.source_kind as enum ('CUSTODIAN_STATEMENT', 'CUSTODIAN_PROFILE', 'BENEFICIARY_FORM', 'PLAN_EXPORT', 'MANUAL_ENTRY');
create type app.account_type as enum ('TRADITIONAL_IRA', 'SEP_IRA', 'SIMPLE_IRA', 'ROTH_IRA', 'EMPLOYER_401K', 'EMPLOYER_403B', 'OTHER');
create type app.tax_character as enum ('PRE_TAX', 'ROTH', 'TAXABLE', 'OTHER');
create type app.ownership_type as enum ('INDIVIDUAL', 'JOINT', 'TRUST', 'CUSTODIAL');
create type app.relationship as enum ('SPOUSE', 'NON_SPOUSE_INDIVIDUAL', 'TRUST', 'ESTATE', 'CHARITY', 'OTHER');
create type app.designation_type as enum ('PRIMARY', 'CONTINGENT');
create type app.person_role as enum ('PRIMARY', 'SPOUSE', 'DEPENDENT', 'OTHER');
create type app.import_status as enum ('IMPORT_DRAFT', 'MAPPED', 'RECONCILED', 'REJECTED');
create type app.import_format as enum ('CSV', 'JSON');
create type app.calculation_scope as enum ('SINGLE_ACCOUNT_ANNUAL_RMD', 'AGGREGATE_ALL_IRAS', 'OTHER', 'UNKNOWN');
create type app.balance_basis as enum ('ACTUAL_PRIOR_YEAR_END', 'PROJECTED', 'UNKNOWN');
create type app.snapshot_status as enum ('FROZEN', 'SUPERSEDED');
create type app.run_status as enum ('PASS', 'NOT_REQUIRED', 'UNSUPPORTED', 'INDETERMINATE', 'ERROR');
create type app.coverage_status as enum ('SUPPORTED_VERIFIED', 'SUPPORTED_UNVALIDATED', 'NOT_COMPARABLE', 'INDETERMINATE', 'UNSUPPORTED');
create type app.discrepancy_classification as enum (
  'SOURCE_CONFLICT', 'STALE_INPUT', 'RULE_DISAGREEMENT', 'METHODOLOGY_DIFFERENCE',
  'MISSING_EVIDENCE', 'UNSUPPORTED_CHECK', 'WITHIN_TOLERANCE', 'NOT_COMPARABLE'
);
create type app.discrepancy_status as enum ('OPEN', 'DISPOSITIONED');
create type app.review_decision as enum ('REVIEWED', 'APPROVED', 'REJECTED');
create type app.actor_type as enum ('USER', 'SYSTEM', 'SIMULATED_REVIEWER');
create type app.packet_status as enum ('GENERATED', 'EXPORTED');
create type app.rule_set_status as enum ('DRAFT', 'PUBLISHED', 'RETIRED');
