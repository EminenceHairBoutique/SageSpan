begin;
create extension if not exists pgtap with schema extensions;
create schema if not exists tests;
\ir 000_helpers.sql
select plan(9);

select tests.make_user('30000000-0000-0000-0000-00000000a0a3', 'cco-d@example.test');
insert into app.organizations (id, name, slug) values ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Org D (synthetic)', 'org-d');
insert into app.memberships (org_id, user_id, role) values ('dddddddd-dddd-dddd-dddd-dddddddddddd', '30000000-0000-0000-0000-00000000a0a3', 'COMPLIANCE');
insert into app.households (id, org_id, label, tax_year, workflow_status) values ('d0000000-0000-0000-0000-000000000001', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'Household D1', 2026, 'READY_TO_FREEZE');

select tests.authenticate_as('30000000-0000-0000-0000-00000000a0a3');
select lives_ok($$ select app.freeze_snapshot('d0000000-0000-0000-0000-000000000001', '{"facts":[]}'::jsonb, repeat('5', 64)) $$, 'CCO freezes snapshot');

-- Snapshots: content is immutable; delete is refused; a second freeze supersedes the first.
select throws_ok($$ update app.snapshots set canonical_payload = '{"facts":["tampered"]}'::jsonb where household_id = 'd0000000-0000-0000-0000-000000000001' $$, '42501', null, 'snapshot payload cannot be edited');
select throws_ok($$ update app.snapshots set content_sha256 = repeat('9', 64) where household_id = 'd0000000-0000-0000-0000-000000000001' $$, '42501', null, 'snapshot hash cannot be edited');
select throws_ok($$ delete from app.snapshots where household_id = 'd0000000-0000-0000-0000-000000000001' $$, '42501', null, 'snapshots cannot be deleted');
select tests.clear_auth();
update app.households set workflow_status = 'RECONCILIATION_PENDING' where id = 'd0000000-0000-0000-0000-000000000001';
update app.households set workflow_status = 'READY_TO_FREEZE' where id = 'd0000000-0000-0000-0000-000000000001';
select tests.authenticate_as('30000000-0000-0000-0000-00000000a0a3');
select lives_ok($$ select app.freeze_snapshot('d0000000-0000-0000-0000-000000000001', '{"facts":[1]}'::jsonb, repeat('6', 64)) $$, 'second freeze creates revision 2');
select results_eq($$ select revision, status::text from app.snapshots where household_id = 'd0000000-0000-0000-0000-000000000001' order by revision $$,
  $$ values (1, 'SUPERSEDED'), (2, 'FROZEN') $$, 'revision 1 superseded, revision 2 frozen, revision 1 content untouched');

-- Audit events: append-only, hash chain links.
select throws_ok($$ update app.audit_events set summary = 'tampered' where org_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd' $$, '42501', null, 'audit events cannot be updated');
select throws_ok($$ delete from app.audit_events where org_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd' $$, '42501', null, 'audit events cannot be deleted');
select is(
  (select count(*) from app.audit_events a where a.org_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd' and a.previous_event_hash is not null
     and not exists (select 1 from app.audit_events p where p.org_id = a.org_id and p.event_hash = a.previous_event_hash)),
  0::bigint, 'every chained event references an existing previous hash');

select * from finish();
rollback;
