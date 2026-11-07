begin;
create extension if not exists pgtap with schema extensions;
create schema if not exists tests;
\ir 000_helpers.sql
select plan(23);

-- Fixtures: one organisation with an analyst, an advisor, a CCO, an admin and a viewer, and a
-- complete synthetic household with a material balance conflict (statement vs plan export).
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
select tests.seed_household('cccccccc-cccc-cccc-cccc-cccccccccccc', 'c0000000', 'Household C1', 'BLOCKED');
-- open material conflict between the statement balance (f005) and the plan-export balance (f008)
select set_config('app.workflow_fn', '1', true);
update app.facts set verification_status = 'FACT_CONFLICT' where id in ('c0000000-0000-0000-0000-00000000f005', 'c0000000-0000-0000-0000-00000000f008');
select set_config('app.workflow_fn', '', true);
insert into app.fact_conflicts (id, org_id, household_id, fact_group_key, field_key, subject_type, subject_id, materiality, reason) values
  ('c0000000-0000-0000-0000-00000000c001', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'c0000000-0000-0000-0000-000000000001', 'ACCOUNT:ac01:account.year_end_balance:2025-12-31', 'account.year_end_balance', 'ACCOUNT', 'c0000000-0000-0000-0000-00000000ac01', 'MATERIAL', 'statement vs plan');
insert into app.conflict_fact_links (org_id, conflict_id, fact_id) values
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'c0000000-0000-0000-0000-00000000c001', 'c0000000-0000-0000-0000-00000000f005'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'c0000000-0000-0000-0000-00000000c001', 'c0000000-0000-0000-0000-00000000f008');

-- Viewer cannot write facts.
select tests.authenticate_as('10000000-0000-0000-0000-00000000a0a5');
select throws_ok($$
  insert into app.facts (org_id, household_id, subject_type, subject_id, field_key, value_kind, value_text, as_of_date, source_document_id, verification_status)
  values ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'c0000000-0000-0000-0000-000000000001', 'ACCOUNT', 'c0000000-0000-0000-0000-00000000ac01', 'account.custodian_label', 'TEXT', 'x', '2025-12-31', 'c0000000-0000-0000-0000-0000000d0c01', 'FACT_CONFIRMED')
$$, '42501', null, 'viewer cannot insert facts');

-- Analyst cannot resolve a material conflict toward the plan export; can toward the statement.
select tests.authenticate_as('10000000-0000-0000-0000-00000000a0a1');
select throws_ok($$ select app.resolve_conflict('c0000000-0000-0000-0000-00000000c001', 'c0000000-0000-0000-0000-00000000f008', 'plan value preferred by analyst') $$, 'P0001', null, 'analyst cannot resolve toward non-primary evidence');
select throws_ok($$ select app.freeze_snapshot('c0000000-0000-0000-0000-000000000001', app.build_snapshot_payload('c0000000-0000-0000-0000-000000000001'), repeat('1', 64)) $$, 'P0001', null, 'freeze blocked while household is BLOCKED');
select lives_ok($$ select app.resolve_conflict('c0000000-0000-0000-0000-00000000c001', 'c0000000-0000-0000-0000-00000000f005', 'custodian statement governs the year-end balance') $$, 'analyst resolves toward the custodian statement');
select is((select status from app.fact_conflicts where id = 'c0000000-0000-0000-0000-00000000c001'), 'RESOLVED'::app.conflict_status, 'conflict is RESOLVED');
select is((select count(*) from app.facts where supersedes_fact_id = 'c0000000-0000-0000-0000-00000000f005' and revision = 2 and verification_status = 'FACT_CONFIRMED'), 1::bigint, 'a revision-2 confirmed fact supersedes the chosen fact');
select is((select workflow_status from app.households where id = 'c0000000-0000-0000-0000-000000000001'), 'RECONCILIATION_PENDING'::app.workflow_status, 'household re-opened for a new revision');

-- The app tier records the gate outcome through the sanctioned entry point, then the analyst freezes
-- with a payload the database rebuilds from its own rows and a hash it recomputes.
select lives_ok($$ select app.set_reconciliation_status('c0000000-0000-0000-0000-000000000001', 'READY_TO_FREEZE') $$, 'analyst records the reconciliation outcome');
select lives_ok($$ select app.freeze_snapshot('c0000000-0000-0000-0000-000000000001', app.build_snapshot_payload('c0000000-0000-0000-0000-000000000001'), app.sha256_canonical(app.build_snapshot_payload('c0000000-0000-0000-0000-000000000001'))) $$, 'analyst freezes a snapshot');
select is((select workflow_status from app.households where id = 'c0000000-0000-0000-0000-000000000001'), 'FROZEN'::app.workflow_status, 'household is FROZEN');

-- Analyst records a calculator receipt through app.record_check_run (hash verified by the database).
create temp table t_snap as select id as snap from app.snapshots where household_id = 'c0000000-0000-0000-0000-000000000001' and status = 'FROZEN';
grant select on t_snap to authenticated;
select lives_ok($$ select app.record_check_run((select snap from t_snap), tests.calc_request((select snap from t_snap)), tests.calc_response((select snap from t_snap), tests.calc_request((select snap from t_snap)))) $$, 'analyst records a verified check run');
select is((select run_status from app.check_runs where snapshot_id = (select snap from t_snap)), 'PASS'::app.run_status, 'run is PASS with a database-verified receipt');
select is((select workflow_status from app.households where id = 'c0000000-0000-0000-0000-000000000001'), 'CHECK_COMPLETE'::app.workflow_status, 'household is CHECK_COMPLETE');
select lives_ok($$ select app.send_to_review('c0000000-0000-0000-0000-000000000001') $$, 'analyst sends the household to review');

-- Analyst cannot record a review; advisor can.
select throws_ok($$ select app.record_review((select snap from t_snap), 'REVIEWED', 'reviewed everything carefully', false) $$, '42501', null, 'analyst cannot record a review');
select tests.authenticate_as('10000000-0000-0000-0000-00000000a0a2');
select lives_ok($$ select app.record_review((select snap from t_snap), 'REVIEWED', 'reviewed everything carefully', false) $$, 'advisor records a review');
select lives_ok($$ select app.disposition_discrepancy((select id from app.discrepancies where check_run_id in (select id from app.check_runs where snapshot_id = (select snap from t_snap))), 'Plan used a superseded balance; advisor to re-run the plan.') $$, 'advisor dispositions the discrepancy');

-- Approval: analyst and admin denied; advisor denied by policy (approver_roles = COMPLIANCE); CCO approves.
select tests.authenticate_as('10000000-0000-0000-0000-00000000a0a1');
select throws_ok($$ select app.record_review((select snap from t_snap), 'APPROVED', 'forged approval by analyst', true) $$, '42501', null, 'analyst cannot approve even with a forged attestation');
select tests.authenticate_as('10000000-0000-0000-0000-00000000a0a4');
select throws_ok($$ select app.record_review((select snap from t_snap), 'APPROVED', 'admin tries to approve', true) $$, '42501', null, 'admin cannot approve');
select tests.authenticate_as('10000000-0000-0000-0000-00000000a0a2');
select throws_ok($$ select app.record_review((select snap from t_snap), 'APPROVED', 'advisor tries to approve', true) $$, '42501', null, 'advisor is not an approver under default policy');
select tests.authenticate_as('10000000-0000-0000-0000-00000000a0a3');
select throws_ok($$ select app.record_review((select snap from t_snap), 'APPROVED', 'approval without attestation', false) $$, 'P0001', null, 'approval requires the conflict attestation');
select lives_ok($$ select app.record_review((select snap from t_snap), 'APPROVED', 'independent check reproduced; discrepancy dispositioned', true) $$, 'CCO approves with attestation');
select is((select reviewer_user_id from app.reviews where decision = 'APPROVED' limit 1), '10000000-0000-0000-0000-00000000a0a3'::uuid, 'the approval carries the real authenticated reviewer identity');

select * from finish();
rollback;
