begin;
create extension if not exists pgtap with schema extensions;
create schema if not exists tests;
\ir 000_helpers.sql
select plan(12);

-- Fixtures: two synthetic organisations, one user each.
select tests.make_user('11111111-1111-1111-1111-111111111111', 'a-cco@example.test');
select tests.make_user('22222222-2222-2222-2222-222222222222', 'b-cco@example.test');
insert into app.organizations (id, name, slug) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Org A (synthetic)', 'org-a'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Org B (synthetic)', 'org-b');
insert into app.memberships (org_id, user_id, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'COMPLIANCE'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'COMPLIANCE');
insert into app.households (id, org_id, label, tax_year, workflow_status) values
  ('a0000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Household A1', 2026, 'BLOCKED'),
  ('b0000000-0000-0000-0000-000000000001', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Household B1', 2026, 'BLOCKED');
insert into app.persons (id, org_id, household_id, display_name) values
  ('a0000000-0000-0000-0000-00000000aa01', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a0000000-0000-0000-0000-000000000001', 'Person A'),
  ('b0000000-0000-0000-0000-00000000bb01', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'b0000000-0000-0000-0000-000000000001', 'Person B');
insert into app.source_documents (id, org_id, household_id, source_kind, filename, sha256, byte_length, parser_version) values
  ('a0000000-0000-0000-0000-0000000d0c01', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a0000000-0000-0000-0000-000000000001', 'CUSTODIAN_STATEMENT', 'a.txt', repeat('a', 64), 1, 'test'),
  ('b0000000-0000-0000-0000-0000000d0c01', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'b0000000-0000-0000-0000-000000000001', 'CUSTODIAN_STATEMENT', 'b.txt', repeat('b', 64), 1, 'test');

-- Anonymous: nothing is visible.
select tests.clear_auth();
set local role anon;
select throws_ok($$ select count(*) from app.households $$, '42501', null, 'anon has no access to the app schema at all');
select throws_ok($$ insert into app.households (org_id, label, tax_year) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'x', 2026) $$, '42501', null, 'anon cannot insert households');
reset role;

-- Org A user sees only Org A.
select tests.authenticate_as('11111111-1111-1111-1111-111111111111');
select results_eq($$ select id from app.households order by id $$, $$ values ('a0000000-0000-0000-0000-000000000001'::uuid) $$, 'A sees only its own household');
select is((select count(*) from app.households where id = 'b0000000-0000-0000-0000-000000000001'), 0::bigint, 'A cannot read B household by id');
select is((select count(*) from app.persons where org_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'), 0::bigint, 'A cannot read B persons');
select is((select count(*) from app.source_documents where org_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'), 0::bigint, 'A cannot read B documents');

-- Updates against B silently affect zero rows (RLS filters them out).
update app.households set label = 'tampered' where id = 'b0000000-0000-0000-0000-000000000001';
select tests.clear_auth();
select is((select label from app.households where id = 'b0000000-0000-0000-0000-000000000001'), 'Household B1', 'A update against B changed nothing');

-- Inserting a fact into B's household with B's org id is rejected by the with-check policy.
select tests.authenticate_as('11111111-1111-1111-1111-111111111111');
select throws_ok($$
  insert into app.facts (org_id, household_id, subject_type, subject_id, field_key, value_kind, value_number, value_currency, as_of_date, source_document_id, verification_status, created_by)
  values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'b0000000-0000-0000-0000-000000000001', 'PERSON', 'b0000000-0000-0000-0000-00000000bb01', 'account.year_end_balance', 'NUMBER', 1, 'USD', '2025-12-31', 'b0000000-0000-0000-0000-0000000d0c01', 'FACT_CONFIRMED', '11111111-1111-1111-1111-111111111111')
$$, '42501', null, 'A cannot insert facts into B');

-- A cannot forge org_id on its own household rows: composite FK + policy.
select throws_ok($$
  insert into app.persons (org_id, household_id, display_name) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'b0000000-0000-0000-0000-000000000001', 'Smuggled')
$$, '23503', null, 'cross-org composite FK rejects A person under B household');

-- Audit: A sees only A's chain.
select tests.clear_auth();
select app.append_audit('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'DEMO_RESET', 'organization', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'seed B', '{}'::jsonb, 'SYSTEM');
select tests.authenticate_as('11111111-1111-1111-1111-111111111111');
select is((select count(*) from app.audit_events where org_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'), 0::bigint, 'A cannot read B audit events');

-- Workflow functions on B entities are indistinguishable from not found.
select throws_ok($$ select app.freeze_snapshot('b0000000-0000-0000-0000-000000000001', '{}'::jsonb, repeat('0', 64)) $$, 'P0002', null, 'A cannot freeze B household (not found)');
select throws_ok($$ select app.record_review('b0000000-0000-0000-0000-0000000d0c01', 'APPROVED', 'forged approval rationale', true) $$, 'P0002', null, 'A cannot review a B snapshot id (not found)');

select * from finish();
rollback;
