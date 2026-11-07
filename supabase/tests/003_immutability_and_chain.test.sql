begin;
create extension if not exists pgtap with schema extensions;
create schema if not exists tests;
\ir 000_helpers.sql
select plan(11);

select tests.make_user('30000000-0000-0000-0000-00000000a0a3', 'cco-d@example.test');
insert into app.organizations (id, name, slug) values ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Org D (synthetic)', 'org-d');
insert into app.memberships (org_id, user_id, role) values ('dddddddd-dddd-dddd-dddd-dddddddddddd', '30000000-0000-0000-0000-00000000a0a3', 'COMPLIANCE');
select tests.seed_household('dddddddd-dddd-dddd-dddd-dddddddddddd', 'd0000000', 'Household D1', 'READY_TO_FREEZE');

select tests.authenticate_as('30000000-0000-0000-0000-00000000a0a3');
select lives_ok($$ select app.freeze_snapshot('d0000000-0000-0000-0000-000000000001', app.build_snapshot_payload('d0000000-0000-0000-0000-000000000001'), app.sha256_canonical(app.build_snapshot_payload('d0000000-0000-0000-0000-000000000001'))) $$, 'CCO freezes snapshot');

-- Snapshots: content is immutable; delete is refused; a second freeze supersedes the first.
select throws_ok($$ update app.snapshots set canonical_payload = '{"facts":["tampered"]}'::jsonb where household_id = 'd0000000-0000-0000-0000-000000000001' $$, '42501', null, 'snapshot payload cannot be edited');
select throws_ok($$ update app.snapshots set content_sha256 = repeat('9', 64) where household_id = 'd0000000-0000-0000-0000-000000000001' $$, '42501', null, 'snapshot hash cannot be edited');
select throws_ok($$ delete from app.snapshots where household_id = 'd0000000-0000-0000-0000-000000000001' $$, '42501', null, 'snapshots cannot be deleted');
select lives_ok($$ select app.set_reconciliation_status('d0000000-0000-0000-0000-000000000001', 'RECONCILIATION_PENDING') $$, 'household re-opened for a new revision');
select lives_ok($$ select app.set_reconciliation_status('d0000000-0000-0000-0000-000000000001', 'READY_TO_FREEZE') $$, 'household ready to freeze again');
select lives_ok($$ select app.freeze_snapshot('d0000000-0000-0000-0000-000000000001', app.build_snapshot_payload('d0000000-0000-0000-0000-000000000001'), app.sha256_canonical(app.build_snapshot_payload('d0000000-0000-0000-0000-000000000001'))) $$, 'second freeze creates revision 2');
select results_eq($$ select revision, status::text from app.snapshots where household_id = 'd0000000-0000-0000-0000-000000000001' order by revision $$,
  $$ values (1, 'SUPERSEDED'), (2, 'FROZEN') $$, 'revision 1 superseded, revision 2 frozen, revision 1 content untouched');

-- Audit events: append-only, and the per-organisation chain verifies by sequence.
select throws_ok($$ update app.audit_events set summary = 'tampered' where org_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd' $$, '42501', null, 'audit events cannot be updated');
select throws_ok($$ delete from app.audit_events where org_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd' $$, '42501', null, 'audit events cannot be deleted');
select is((select intact from app.verify_audit_chain('dddddddd-dddd-dddd-dddd-dddddddddddd')), true, 'audit chain verifies by seq with one head');

select * from finish();
rollback;
