begin;
create extension if not exists pgtap with schema extensions;
create schema if not exists tests;
\ir 000_helpers.sql
select plan(16);

-- Fixtures: one organisation with an analyst, an advisor, a CCO, an admin and a viewer.
select tests.make_user('10000000-0000-0000-0000-00000000a0a1', 'analyst@example.test');
select tests.make_user('10000000-0000-0000-0000-00000000a0a2', 'advisor@example.test');
select tests.make_user('10000000-0000-0000-0000-00000000a0a3', 'cco@example.test');
select tests.make_user('10000000-0000-0000-0000-00000000a0a4', 'admin@example.test');
select tests.make_user('10000000-0000-0000-0000-00000000a0a5', 'viewer@example.test');
insert into app.organizations (id, name, slug) values ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Org C (synthetic)', 'org-c');
insert into app.memberships (org_id, user_id, role) values
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '10000000-0000-0000-0000-00000000a0a1', 'ANALYST'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '10000000-0000-0000-0000-00000000a0a2', 'ADVISOR'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '10000000-0000-0000-0000-00000000a0a3', 'COMPLIANCE'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '10000000-0000-0000-0000-00000000a0a4', 'ADMIN'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '10000000-0000-0000-0000-00000000a0a5', 'VIEWER');
insert into app.households (id, org_id, label, tax_year, workflow_status) values ('c0000000-0000-0000-0000-000000000001', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Household C1', 2026, 'BLOCKED');
insert into app.accounts (id, org_id, household_id, label, account_type) values ('c0000000-0000-0000-0000-00000000ac01', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'c0000000-0000-0000-0000-000000000001', 'IRA', 'TRADITIONAL_IRA');
insert into app.source_documents (id, org_id, household_id, source_kind, filename, sha256, byte_length, parser_version) values
  ('c0000000-0000-0000-0000-0000000d0c01', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'c0000000-0000-0000-0000-000000000001', 'CUSTODIAN_STATEMENT', 'stmt.txt', repeat('c', 64), 1, 'test'),
  ('c0000000-0000-0000-0000-0000000d0c02', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'c0000000-0000-0000-0000-000000000001', 'PLAN_EXPORT', 'plan.json', repeat('d', 64), 1, 'test');
insert into app.facts (id, org_id, household_id, subject_type, subject_id, field_key, value_kind, value_number, value_currency, as_of_date, source_document_id, verification_status) values
  ('c0000000-0000-0000-0000-00000000f001', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'c0000000-0000-0000-0000-000000000001', 'ACCOUNT', 'c0000000-0000-0000-0000-00000000ac01', 'account.year_end_balance', 'NUMBER', 640000.00, 'USD', '2025-12-31', 'c0000000-0000-0000-0000-0000000d0c01', 'FACT_CONFLICT'),
  ('c0000000-0000-0000-0000-00000000f002', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'c0000000-0000-0000-0000-000000000001', 'ACCOUNT', 'c0000000-0000-0000-0000-00000000ac01', 'account.year_end_balance', 'NUMBER', 612000.00, 'USD', '2025-12-31', 'c0000000-0000-0000-0000-0000000d0c02', 'FACT_CONFLICT');
insert into app.fact_conflicts (id, org_id, household_id, fact_group_key, field_key, subject_type, subject_id, materiality, reason) values
  ('c0000000-0000-0000-0000-00000000c001', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'c0000000-0000-0000-0000-000000000001', 'ACCOUNT:ac01:account.year_end_balance:2025-12-31', 'account.year_end_balance', 'ACCOUNT', 'c0000000-0000-0000-0000-00000000ac01', 'MATERIAL', 'statement vs plan');
insert into app.conflict_fact_links (org_id, conflict_id, fact_id) values
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'c0000000-0000-0000-0000-00000000c001', 'c0000000-0000-0000-0000-00000000f001'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'c0000000-0000-0000-0000-00000000c001', 'c0000000-0000-0000-0000-00000000f002');

-- Viewer cannot write facts.
select tests.authenticate_as('10000000-0000-0000-0000-00000000a0a5');
select throws_ok($$
  insert into app.facts (org_id, household_id, subject_type, subject_id, field_key, value_kind, value_text, as_of_date, source_document_id, verification_status)
  values ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'c0000000-0000-0000-0000-000000000001', 'ACCOUNT', 'c0000000-0000-0000-0000-00000000ac01', 'account.custodian_label', 'TEXT', 'x', '2025-12-31', 'c0000000-0000-0000-0000-0000000d0c01', 'FACT_CONFIRMED')
$$, '42501', null, 'viewer cannot insert facts');

-- Analyst cannot resolve a material conflict toward the plan export; can toward the statement.
select tests.authenticate_as('10000000-0000-0000-0000-00000000a0a1');
select throws_ok($$ select app.resolve_conflict('c0000000-0000-0000-0000-00000000c001', 'c0000000-0000-0000-0000-00000000f002', 'plan value preferred by analyst') $$, 'P0001', null, 'analyst cannot resolve toward non-primary evidence');
select throws_ok($$ select app.freeze_snapshot('c0000000-0000-0000-0000-000000000001', '{}'::jsonb, repeat('1', 64)) $$, 'P0001', null, 'freeze blocked while household is BLOCKED');
select lives_ok($$ select app.resolve_conflict('c0000000-0000-0000-0000-00000000c001', 'c0000000-0000-0000-0000-00000000f001', 'custodian statement governs the year-end balance') $$, 'analyst resolves toward the custodian statement');
select is((select status from app.fact_conflicts where id = 'c0000000-0000-0000-0000-00000000c001'), 'RESOLVED'::app.conflict_status, 'conflict is RESOLVED');
select is((select count(*) from app.facts where supersedes_fact_id = 'c0000000-0000-0000-0000-00000000f001' and revision = 2 and verification_status = 'FACT_CONFIRMED'), 1::bigint, 'a revision-2 confirmed fact supersedes the chosen fact');
select is((select workflow_status from app.households where id = 'c0000000-0000-0000-0000-000000000001'), 'RECONCILIATION_PENDING'::app.workflow_status, 'household re-opened for a new revision');

-- The app tier moves the household to READY_TO_FREEZE after the gate passes (simulated here), then the analyst freezes.
select tests.clear_auth();
update app.households set workflow_status = 'READY_TO_FREEZE' where id = 'c0000000-0000-0000-0000-000000000001';
select tests.authenticate_as('10000000-0000-0000-0000-00000000a0a1');
select lives_ok($$ select app.freeze_snapshot('c0000000-0000-0000-0000-000000000001', '{"snapshot_version":"sagespan.snapshot.v1"}'::jsonb, repeat('2', 64)) $$, 'analyst freezes a snapshot');
select is((select workflow_status from app.households where id = 'c0000000-0000-0000-0000-000000000001'), 'FROZEN'::app.workflow_status, 'household is FROZEN');

-- Analyst records a check run (trusted server path) and then nobody can edit it.
insert into app.check_runs (org_id, snapshot_id, household_id, check_type, request_payload, request_sha256, response, response_sha256, executed_by, run_status, coverage_status)
select org_id, id, household_id, 'RMD_ANNUAL', '{}'::jsonb, repeat('3', 64), '{"annual_rmd":"25098.04"}'::jsonb, repeat('4', 64), '10000000-0000-0000-0000-00000000a0a1', 'PASS', 'SUPPORTED_VERIFIED'
from app.snapshots where household_id = 'c0000000-0000-0000-0000-000000000001' and status = 'FROZEN';
select tests.clear_auth();
update app.households set workflow_status = 'CHECK_COMPLETE' where id = 'c0000000-0000-0000-0000-000000000001';
update app.households set workflow_status = 'REVIEW_PENDING' where id = 'c0000000-0000-0000-0000-000000000001';

-- Analyst cannot record a review; advisor can.
select tests.authenticate_as('10000000-0000-0000-0000-00000000a0a1');
select throws_ok($$ select app.record_review((select id from app.snapshots where status = 'FROZEN' and household_id = 'c0000000-0000-0000-0000-000000000001'), 'REVIEWED', 'reviewed everything carefully', false) $$, '42501', null, 'analyst cannot record a review');
select tests.authenticate_as('10000000-0000-0000-0000-00000000a0a2');
select lives_ok($$ select app.record_review((select id from app.snapshots where status = 'FROZEN' and household_id = 'c0000000-0000-0000-0000-000000000001'), 'REVIEWED', 'reviewed everything carefully', false) $$, 'advisor records a review');

-- Approval: analyst and admin denied; advisor denied by policy (approver_roles = COMPLIANCE); CCO approves.
select tests.authenticate_as('10000000-0000-0000-0000-00000000a0a1');
select throws_ok($$ select app.record_review((select id from app.snapshots where status = 'FROZEN' and household_id = 'c0000000-0000-0000-0000-000000000001'), 'APPROVED', 'forged approval by analyst', true) $$, '42501', null, 'analyst cannot approve even with a forged attestation');
select tests.authenticate_as('10000000-0000-0000-0000-00000000a0a4');
select throws_ok($$ select app.record_review((select id from app.snapshots where status = 'FROZEN' and household_id = 'c0000000-0000-0000-0000-000000000001'), 'APPROVED', 'admin tries to approve', true) $$, '42501', null, 'admin cannot approve');
select tests.authenticate_as('10000000-0000-0000-0000-00000000a0a2');
select throws_ok($$ select app.record_review((select id from app.snapshots where status = 'FROZEN' and household_id = 'c0000000-0000-0000-0000-000000000001'), 'APPROVED', 'advisor tries to approve', true) $$, '42501', null, 'advisor is not an approver under default policy');
select tests.authenticate_as('10000000-0000-0000-0000-00000000a0a3');
select throws_ok($$ select app.record_review((select id from app.snapshots where status = 'FROZEN' and household_id = 'c0000000-0000-0000-0000-000000000001'), 'APPROVED', 'approval without attestation', false) $$, 'P0001', null, 'approval requires the conflict attestation');
select lives_ok($$ select app.record_review((select id from app.snapshots where status = 'FROZEN' and household_id = 'c0000000-0000-0000-0000-000000000001'), 'APPROVED', 'independent check reproduced; discrepancy dispositioned', true) $$, 'CCO approves with attestation');
select is((select reviewer_user_id from app.reviews where decision = 'APPROVED' limit 1), '10000000-0000-0000-0000-00000000a0a3'::uuid, 'the approval carries the real authenticated reviewer identity');

select * from finish();
rollback;
