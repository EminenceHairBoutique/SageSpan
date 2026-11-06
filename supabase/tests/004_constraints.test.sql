begin;
create extension if not exists pgtap with schema extensions;
create schema if not exists tests;
\ir 000_helpers.sql
select plan(8);

select tests.make_user('40000000-0000-0000-0000-00000000a0a1', 'e-analyst@example.test');
select tests.make_user('40000000-0000-0000-0000-00000000a0a4', 'e-admin@example.test');
insert into app.organizations (id, name, slug) values
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'Org E (synthetic)', 'org-e'),
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'Org F (synthetic)', 'org-f');
insert into app.memberships (org_id, user_id, role) values
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '40000000-0000-0000-0000-00000000a0a1', 'ANALYST'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '40000000-0000-0000-0000-00000000a0a4', 'ADMIN');
insert into app.households (id, org_id, label, tax_year) values
  ('e0000000-0000-0000-0000-000000000001', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'Household E1', 2026),
  ('f0000000-0000-0000-0000-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff', 'Household F1', 2026);
insert into app.persons (id, org_id, household_id, display_name) values
  ('e0000000-0000-0000-0000-00000000ee01', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'e0000000-0000-0000-0000-000000000001', 'Person E'),
  ('f0000000-0000-0000-0000-00000000ff01', 'ffffffff-ffff-ffff-ffff-ffffffffffff', 'f0000000-0000-0000-0000-000000000001', 'Person F');
insert into app.accounts (id, org_id, household_id, label, account_type) values
  ('e0000000-0000-0000-0000-00000000ac01', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'e0000000-0000-0000-0000-000000000001', 'IRA E', 'TRADITIONAL_IRA');

-- Forged ownership reference across organisations is rejected by the composite FK (even as superuser).
select throws_ok($$
  insert into app.account_ownership (org_id, account_id, person_id, ownership_type, percentage, effective_from)
  values ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'e0000000-0000-0000-0000-00000000ac01', 'f0000000-0000-0000-0000-00000000ff01', 'INDIVIDUAL', 100, '2020-01-01')
$$, '23503', null, 'ownership cannot reference a person from another organisation');

-- Ownership percentages are explicit and bounded; no implied 50/50.
select throws_ok($$
  insert into app.account_ownership (org_id, account_id, person_id, ownership_type, percentage, effective_from)
  values ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'e0000000-0000-0000-0000-00000000ac01', 'e0000000-0000-0000-0000-00000000ee01', 'JOINT', 150, '2020-01-01')
$$, '23514', null, 'ownership percentage above 100 is rejected');

-- Facts: exactly one typed value must match value_kind.
select throws_ok($$
  insert into app.facts (org_id, household_id, subject_type, subject_id, field_key, value_kind, value_number, value_text, value_currency, as_of_date, verification_status, supersedes_fact_id)
  values ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'e0000000-0000-0000-0000-000000000001', 'ACCOUNT', 'e0000000-0000-0000-0000-00000000ac01', 'account.year_end_balance', 'NUMBER', 1, 'also text', 'USD', '2025-12-31', 'NEEDS_CONFIRMATION', null)
$$, '23514', null, 'a NUMBER fact cannot also carry text');
select throws_ok($$
  insert into app.facts (org_id, household_id, subject_type, subject_id, field_key, value_kind, value_bool, as_of_date, verification_status, assumption_id)
  values ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'e0000000-0000-0000-0000-000000000001', 'PERSON', 'e0000000-0000-0000-0000-00000000ee01', 'person.is_alive', 'BOOL', true, '2026-01-01', 'FACT_ASSUMED', null)
$$, '23514', null, 'an ASSUMED fact must reference an assumption');

-- Material conflicts can never be carried by exception (constraint + function).
select throws_ok($$
  insert into app.fact_conflicts (org_id, household_id, fact_group_key, field_key, subject_type, subject_id, materiality, status, reason, resolution_note, resolved_by, resolved_at)
  values ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'e0000000-0000-0000-0000-000000000001', 'k', 'person.birth_date', 'PERSON', 'e0000000-0000-0000-0000-00000000ee01', 'MATERIAL', 'EXCEPTION_DOCUMENTED', 'r', 'note', '40000000-0000-0000-0000-00000000a0a1', now())
$$, '23514', null, 'material conflict cannot be EXCEPTION_DOCUMENTED');

-- Approvals always carry an attestation.
select throws_ok($$
  insert into app.reviews (org_id, snapshot_id, household_id, reviewer_user_id, reviewer_role, decision, rationale, conflict_attestation)
  values ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', gen_random_uuid(), 'e0000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-00000000a0a1', 'COMPLIANCE', 'APPROVED', 'rationale long enough', false)
$$, null, null, 'an APPROVED review without attestation is rejected');

-- Admin cannot change their own role (no self-escalation), and an analyst cannot manage memberships.
select tests.authenticate_as('40000000-0000-0000-0000-00000000a0a4');
update app.memberships set role = 'COMPLIANCE' where user_id = '40000000-0000-0000-0000-00000000a0a4';
select tests.clear_auth();
select is((select role from app.memberships where user_id = '40000000-0000-0000-0000-00000000a0a4'), 'ADMIN'::app.role, 'admin self-escalation changed nothing');
select tests.authenticate_as('40000000-0000-0000-0000-00000000a0a1');
select throws_ok($$ insert into app.memberships (org_id, user_id, role) values ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '40000000-0000-0000-0000-00000000a0a4', 'VIEWER') $$, null, null, 'analyst cannot insert memberships');

select * from finish();
rollback;
