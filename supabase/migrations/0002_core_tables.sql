-- Core relational schema. Every tenant-bound table carries org_id and a
-- composite unique (org_id, id) so child tables can reference parents with a
-- composite foreign key that makes cross-organisation references impossible.

create table app.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 200),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,60}$'),
  policies jsonb not null default '{"separation_of_duties": true, "allow_nonmaterial_exceptions": true, "approver_roles": ["COMPLIANCE"], "tolerance": {"absolute": "1.00", "relative": "0.001"}}'::jsonb,
  created_at timestamptz not null default now(),
  constraint organizations_policies_shape check (
    jsonb_typeof(policies->'separation_of_duties') = 'boolean'
    and jsonb_typeof(policies->'allow_nonmaterial_exceptions') = 'boolean'
    and jsonb_typeof(policies->'approver_roles') = 'array'
  )
);

create table app.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (length(display_name) between 1 and 120),
  title text null,
  created_at timestamptz not null default now()
);

create table app.memberships (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references app.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role app.role not null,
  status app.membership_status not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  unique (org_id, user_id)
);
create index memberships_user_idx on app.memberships (user_id) where status = 'ACTIVE';

create table app.households (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references app.organizations (id) on delete cascade,
  label text not null check (length(label) between 1 and 200),
  status app.household_status not null default 'ACTIVE',
  workflow_status app.workflow_status not null default 'IMPORT_DRAFT',
  assignee_user_id uuid null references auth.users (id) on delete set null,
  source_tool_label text null check (source_tool_label is null or length(source_tool_label) <= 120),
  tax_year int not null check (tax_year between 2022 and 2100),
  current_revision int not null default 0 check (current_revision >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, id)
);
create index households_org_idx on app.households (org_id, workflow_status);

create table app.persons (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  household_id uuid not null,
  display_name text not null check (length(display_name) between 1 and 120),
  role_in_household app.person_role not null default 'OTHER',
  created_at timestamptz not null default now(),
  unique (org_id, id),
  foreign key (org_id, household_id) references app.households (org_id, id) on delete cascade
);
create index persons_household_idx on app.persons (org_id, household_id);

create table app.accounts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  household_id uuid not null,
  label text not null check (length(label) between 1 and 120),
  account_type app.account_type not null,
  tax_character app.tax_character not null default 'PRE_TAX',
  currency char(3) not null default 'USD',
  opened_at date null,
  created_at timestamptz not null default now(),
  unique (org_id, id),
  foreign key (org_id, household_id) references app.households (org_id, id) on delete cascade
);
create index accounts_household_idx on app.accounts (org_id, household_id);

-- Ownership supports multiple owners and effective dating. Percentages are
-- recorded, never assumed (no implied 50/50 for joint registrations).
create table app.account_ownership (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  account_id uuid not null,
  person_id uuid not null,
  ownership_type app.ownership_type not null,
  percentage numeric(7, 4) not null check (percentage > 0 and percentage <= 100),
  effective_from date not null,
  effective_to date null check (effective_to is null or effective_to > effective_from),
  foreign key (org_id, account_id) references app.accounts (org_id, id) on delete cascade,
  foreign key (org_id, person_id) references app.persons (org_id, id) on delete cascade
);
create index account_ownership_account_idx on app.account_ownership (org_id, account_id);

create table app.source_documents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  household_id uuid not null,
  source_kind app.source_kind not null,
  source_vendor_label text null check (source_vendor_label is null or length(source_vendor_label) <= 120),
  filename text not null check (length(filename) between 1 and 200),
  sha256 char(64) not null check (sha256 ~ '^[0-9a-f]{64}$'),
  byte_length bigint not null check (byte_length >= 0),
  storage_path text null,
  uploaded_at timestamptz not null default now(),
  uploaded_by uuid null references auth.users (id) on delete set null,
  source_as_of date null,
  parser_version text not null,
  synthetic boolean not null default false,
  unique (org_id, id),
  foreign key (org_id, household_id) references app.households (org_id, id) on delete cascade
);
create index source_documents_household_idx on app.source_documents (org_id, household_id);

create table app.source_locations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  document_id uuid not null,
  page_number int null check (page_number is null or page_number > 0),
  row_number int null check (row_number is null or row_number > 0),
  text_span text null check (text_span is null or length(text_span) <= 500),
  json_pointer text null check (json_pointer is null or length(json_pointer) <= 200),
  unique (org_id, id),
  foreign key (org_id, document_id) references app.source_documents (org_id, id) on delete cascade
);

create table app.assumption_sets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  household_id uuid not null,
  version int not null check (version > 0),
  created_by uuid null references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  methodology_id text null,
  unique (org_id, id),
  unique (org_id, household_id, version),
  foreign key (org_id, household_id) references app.households (org_id, id) on delete cascade
);

create table app.assumptions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  assumption_set_id uuid not null,
  key text not null check (length(key) between 1 and 80),
  value_kind app.value_kind not null,
  value_decimal numeric(18, 4) null,
  value_text text null,
  unit text null,
  source_fact_id uuid null,
  basis text not null check (length(basis) >= 10),
  unique (org_id, id),
  foreign key (org_id, assumption_set_id) references app.assumption_sets (org_id, id) on delete cascade
);

-- Typed facts: exactly one value column populated, matching value_kind.
create table app.facts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  household_id uuid not null,
  subject_type app.subject_type not null,
  subject_id uuid not null,
  field_key text not null check (field_key ~ '^[a-z_]+(\.[a-z_]+)+$'),
  value_kind app.value_kind not null,
  value_number numeric(18, 2) null,
  value_text text null check (value_text is null or length(value_text) <= 500),
  value_date date null,
  value_bool boolean null,
  value_currency char(3) null,
  unit text null,
  as_of_date date not null,
  effective_from date null,
  effective_to date null,
  source_document_id uuid null,
  source_location_id uuid null,
  verification_status app.fact_status not null,
  revision int not null default 1 check (revision > 0),
  supersedes_fact_id uuid null,
  superseded boolean not null default false,
  assumption_id uuid null,
  note text null check (note is null or length(note) <= 1000),
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users (id) on delete set null,
  unique (org_id, id),
  foreign key (org_id, household_id) references app.households (org_id, id) on delete cascade,
  foreign key (org_id, source_document_id) references app.source_documents (org_id, id) on delete restrict,
  foreign key (org_id, source_location_id) references app.source_locations (org_id, id) on delete restrict,
  foreign key (org_id, supersedes_fact_id) references app.facts (org_id, id) on delete restrict,
  foreign key (org_id, assumption_id) references app.assumptions (org_id, id) on delete restrict,
  constraint facts_exactly_one_value check (
    (value_kind = 'NUMBER' and value_number is not null and value_text is null and value_date is null and value_bool is null and value_currency is not null)
    or (value_kind = 'TEXT' and value_text is not null and value_number is null and value_date is null and value_bool is null)
    or (value_kind = 'DATE' and value_date is not null and value_number is null and value_text is null and value_bool is null)
    or (value_kind = 'BOOL' and value_bool is not null and value_number is null and value_text is null and value_date is null)
  ),
  constraint facts_assumed_has_assumption check (verification_status <> 'FACT_ASSUMED' or assumption_id is not null),
  constraint facts_confirmed_has_source check (verification_status not in ('FACT_CONFIRMED', 'NEEDS_CONFIRMATION', 'FACT_CONFLICT') or source_document_id is not null or supersedes_fact_id is not null)
);
create index facts_subject_idx on app.facts (org_id, household_id, subject_type, subject_id, field_key) where superseded = false;

alter table app.assumptions
  add constraint assumptions_source_fact_fk foreign key (org_id, source_fact_id) references app.facts (org_id, id) on delete set null deferrable initially deferred;

create table app.beneficiary_designations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  account_id uuid not null,
  beneficiary_person_id uuid null,
  beneficiary_label text null check (beneficiary_label is null or length(beneficiary_label) <= 120),
  relationship app.relationship not null,
  designation_type app.designation_type not null,
  share_percentage numeric(7, 4) not null check (share_percentage > 0 and share_percentage <= 100),
  sole_primary_entire_year boolean null,
  effective_from date not null,
  effective_to date null check (effective_to is null or effective_to > effective_from),
  source_fact_id uuid null,
  source_document_id uuid null,
  foreign key (org_id, account_id) references app.accounts (org_id, id) on delete cascade,
  foreign key (org_id, beneficiary_person_id) references app.persons (org_id, id) on delete restrict,
  foreign key (org_id, source_fact_id) references app.facts (org_id, id) on delete set null,
  foreign key (org_id, source_document_id) references app.source_documents (org_id, id) on delete set null,
  constraint beneficiary_person_or_label check (beneficiary_person_id is not null or beneficiary_label is not null)
);
create index beneficiary_designations_account_idx on app.beneficiary_designations (org_id, account_id);

create table app.fact_conflicts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  household_id uuid not null,
  fact_group_key text not null,
  field_key text not null,
  subject_type app.subject_type not null,
  subject_id uuid not null,
  materiality app.materiality not null,
  status app.conflict_status not null default 'OPEN',
  reason text not null,
  chosen_fact_id uuid null,
  resolution_note text null,
  resolved_by uuid null references auth.users (id) on delete set null,
  resolved_at timestamptz null,
  created_at timestamptz not null default now(),
  unique (org_id, id),
  foreign key (org_id, household_id) references app.households (org_id, id) on delete cascade,
  foreign key (org_id, chosen_fact_id) references app.facts (org_id, id) on delete restrict,
  constraint fact_conflicts_resolution_complete check (status = 'OPEN' or (resolution_note is not null and resolved_by is not null and resolved_at is not null)),
  constraint fact_conflicts_material_cannot_be_exception check (not (materiality = 'MATERIAL' and status = 'EXCEPTION_DOCUMENTED'))
);
create index fact_conflicts_open_idx on app.fact_conflicts (org_id, household_id) where status = 'OPEN';

create table app.conflict_fact_links (
  org_id uuid not null,
  conflict_id uuid not null,
  fact_id uuid not null,
  primary key (conflict_id, fact_id),
  foreign key (org_id, conflict_id) references app.fact_conflicts (org_id, id) on delete cascade,
  foreign key (org_id, fact_id) references app.facts (org_id, id) on delete cascade
);

-- Rule registry (global, not tenant-scoped). Writable by service role only.
create table app.rule_sets (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  jurisdiction text not null default 'US-FEDERAL',
  tax_year int null,
  effective_from date not null,
  effective_to date null,
  version text not null,
  source_url text null,
  source_retrieved_at timestamptz null,
  checksum char(64) not null check (checksum ~ '^[0-9a-f]{64}$'),
  status app.rule_set_status not null default 'DRAFT',
  approved_by uuid null references auth.users (id) on delete set null,
  approved_at timestamptz null,
  unique (code, version),
  constraint rule_sets_published_is_approved check (status <> 'PUBLISHED' or approved_at is not null)
);

create table app.rule_parameters (
  id uuid primary key default gen_random_uuid(),
  rule_set_id uuid not null references app.rule_sets (id) on delete cascade,
  parameter_key text not null,
  value_decimal numeric(18, 6) null,
  value_string text null,
  value_date date null,
  unit text null,
  source_locator text null,
  unique (rule_set_id, parameter_key)
);

create table app.plan_imports (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  household_id uuid not null,
  source_document_id uuid null,
  source_vendor_label text null,
  source_kind app.source_kind not null,
  format app.import_format not null,
  format_version text not null,
  imported_at timestamptz not null default now(),
  imported_by uuid null references auth.users (id) on delete set null,
  parser_version text not null,
  import_status app.import_status not null default 'IMPORT_DRAFT',
  mapping jsonb null,
  row_count int not null default 0 check (row_count >= 0),
  issues jsonb not null default '[]'::jsonb,
  staged_payload jsonb null,
  unique (org_id, id),
  foreign key (org_id, household_id) references app.households (org_id, id) on delete cascade,
  foreign key (org_id, source_document_id) references app.source_documents (org_id, id) on delete restrict
);

create table app.imported_plan_values (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  import_id uuid not null,
  household_id uuid not null,
  account_id uuid null,
  metric_key text not null,
  period_start date null,
  period_end date null,
  tax_year int null,
  value_decimal numeric(18, 2) not null,
  currency char(3) not null default 'USD',
  methodology_label text null,
  calculation_scope app.calculation_scope not null default 'UNKNOWN',
  balance_basis app.balance_basis not null default 'UNKNOWN',
  declared_inputs jsonb null,
  assumptions jsonb not null default '{}'::jsonb,
  source_location_id uuid null,
  unique (org_id, id),
  foreign key (org_id, import_id) references app.plan_imports (org_id, id) on delete cascade,
  foreign key (org_id, household_id) references app.households (org_id, id) on delete cascade,
  foreign key (org_id, account_id) references app.accounts (org_id, id) on delete restrict,
  foreign key (org_id, source_location_id) references app.source_locations (org_id, id) on delete set null
);

-- Immutable, content-hashed snapshots (one FROZEN per household at a time).
create table app.snapshots (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  household_id uuid not null,
  revision int not null check (revision > 0),
  content_sha256 char(64) not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
  rule_set_versions jsonb not null default '{}'::jsonb,
  assumption_set_id uuid null,
  created_by uuid not null references auth.users (id) on delete restrict,
  created_by_role app.role not null,
  created_at timestamptz not null default now(),
  status app.snapshot_status not null default 'FROZEN',
  canonical_payload jsonb not null,
  engine_commit text null,
  unique (org_id, id),
  unique (org_id, household_id, revision),
  foreign key (org_id, household_id) references app.households (org_id, id) on delete cascade,
  foreign key (org_id, assumption_set_id) references app.assumption_sets (org_id, id) on delete restrict
);
create unique index snapshots_one_frozen_per_household on app.snapshots (org_id, household_id) where status = 'FROZEN';

create table app.check_runs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  snapshot_id uuid not null,
  household_id uuid not null,
  check_type text not null check (check_type in ('RMD_ANNUAL')),
  engine_name text null,
  engine_version text null,
  rule_set_versions jsonb not null default '{}'::jsonb,
  request_payload jsonb not null,
  request_sha256 char(64) not null check (request_sha256 ~ '^[0-9a-f]{64}$'),
  response jsonb null,
  response_sha256 char(64) null check (response_sha256 is null or response_sha256 ~ '^[0-9a-f]{64}$'),
  executed_at timestamptz not null default now(),
  executed_by uuid not null references auth.users (id) on delete restrict,
  run_status app.run_status not null,
  coverage_status app.coverage_status null,
  error jsonb null,
  request_hash_verified boolean null,
  unique (org_id, id),
  foreign key (org_id, snapshot_id) references app.snapshots (org_id, id) on delete restrict,
  foreign key (org_id, household_id) references app.households (org_id, id) on delete cascade,
  constraint check_runs_error_xor_response check ((run_status = 'ERROR' and response is null and error is not null) or (run_status <> 'ERROR' and response is not null))
);

create table app.discrepancies (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  check_run_id uuid not null,
  household_id uuid not null,
  imported_plan_value_id uuid null,
  classification app.discrepancy_classification not null,
  comparable boolean not null,
  computed_amount numeric(18, 2) null,
  imported_amount numeric(18, 2) null,
  delta_amount numeric(18, 2) null,
  tolerance_applied numeric(18, 2) null,
  explanation text not null,
  next_step text not null,
  status app.discrepancy_status not null default 'OPEN',
  disposition jsonb null,
  unique (org_id, id),
  foreign key (org_id, check_run_id) references app.check_runs (org_id, id) on delete cascade,
  foreign key (org_id, household_id) references app.households (org_id, id) on delete cascade,
  foreign key (org_id, imported_plan_value_id) references app.imported_plan_values (org_id, id) on delete set null,
  constraint discrepancies_disposition_shape check (status = 'OPEN' or disposition is not null)
);

create table app.reviews (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  snapshot_id uuid not null,
  household_id uuid not null,
  reviewer_user_id uuid not null references auth.users (id) on delete restrict,
  reviewer_role app.role not null,
  actor_type app.actor_type not null default 'USER',
  decision app.review_decision not null,
  rationale text not null check (length(rationale) >= 10),
  conflict_attestation boolean not null default false,
  reviewed_at timestamptz not null default now(),
  unique (org_id, id),
  foreign key (org_id, snapshot_id) references app.snapshots (org_id, id) on delete restrict,
  foreign key (org_id, household_id) references app.households (org_id, id) on delete cascade,
  constraint reviews_approval_requires_attestation check (decision <> 'APPROVED' or conflict_attestation = true)
);

create table app.review_comments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  household_id uuid not null,
  snapshot_id uuid null,
  author_user_id uuid not null references auth.users (id) on delete restrict,
  author_role app.role not null,
  body text not null check (length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  foreign key (org_id, household_id) references app.households (org_id, id) on delete cascade,
  foreign key (org_id, snapshot_id) references app.snapshots (org_id, id) on delete set null
);

create table app.evidence_packets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  snapshot_id uuid not null,
  household_id uuid not null,
  review_id uuid not null,
  generated_by uuid not null references auth.users (id) on delete restrict,
  generated_at timestamptz not null default now(),
  sha256 char(64) not null check (sha256 ~ '^[0-9a-f]{64}$'),
  packet_status app.packet_status not null default 'GENERATED',
  export_count int not null default 1 check (export_count >= 1),
  storage_path text null,
  packet jsonb not null,
  unique (org_id, id),
  unique (org_id, snapshot_id, review_id),
  foreign key (org_id, snapshot_id) references app.snapshots (org_id, id) on delete restrict,
  foreign key (org_id, household_id) references app.households (org_id, id) on delete cascade,
  foreign key (org_id, review_id) references app.reviews (org_id, id) on delete restrict
);

-- Append-only, hash-chained audit events (one chain per organisation).
create table app.audit_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references app.organizations (id) on delete cascade,
  actor_user_id uuid null references auth.users (id) on delete set null,
  actor_role app.role null,
  actor_type app.actor_type not null default 'USER',
  event_type text not null check (event_type ~ '^[A-Z_]{3,60}$'),
  entity_type text not null,
  entity_id uuid null,
  created_at timestamptz not null default now(),
  previous_event_hash char(64) null,
  event_hash char(64) not null check (event_hash ~ '^[0-9a-f]{64}$'),
  payload_digest char(64) not null,
  request_id text not null,
  summary text not null check (length(summary) <= 500)
);
create index audit_events_org_idx on app.audit_events (org_id, created_at);
