-- PR-001: the audit's negative probes (supabase/tests/probes/900_audit_probes.sql), inverted.
-- Every probe that SUCCEEDED on master 1151c1e must now be DENIED, and the same action must succeed
-- through the sanctioned function for the right role. Privileges, RLS, triggers and function checks
-- are exercised separately where they are independent layers.
begin;
create extension if not exists pgtap with schema extensions;
create schema if not exists tests;
\ir 000_helpers.sql
select plan(71);

select tests.make_user('20000000-0000-0000-0000-0000000000a1', 'analyst@c.test');
select tests.make_user('20000000-0000-0000-0000-0000000000a2', 'advisor@c.test');
select tests.make_user('20000000-0000-0000-0000-0000000000a3', 'cco@c.test');
select tests.make_user('20000000-0000-0000-0000-0000000000a5', 'viewer@c.test');
select tests.make_user('20000000-0000-0000-0000-0000000000d1', 'outsider@d.test');
insert into app.organizations (id, name, slug, policies) values
  ('cccccccc-0000-0000-0000-000000000001', 'Org C (synthetic)', 'probe-c', '{"separation_of_duties": true, "approver_roles": ["COMPLIANCE"], "allow_nonmaterial_exceptions": false, "tolerance": {"absolute": "1.00", "relative": "0.001"}}'),
  ('dddddddd-0000-0000-0000-000000000001', 'Org D (synthetic)', 'probe-d', '{"separation_of_duties": true, "approver_roles": ["COMPLIANCE"], "allow_nonmaterial_exceptions": false, "tolerance": {"absolute": "1.00", "relative": "0.001"}}');
insert into app.memberships (org_id, user_id, role) values
  ('cccccccc-0000-0000-0000-000000000001', '20000000-0000-0000-0000-0000000000a1', 'ANALYST'),
  ('cccccccc-0000-0000-0000-000000000001', '20000000-0000-0000-0000-0000000000a2', 'ADVISOR'),
  ('cccccccc-0000-0000-0000-000000000001', '20000000-0000-0000-0000-0000000000a3', 'COMPLIANCE'),
  ('cccccccc-0000-0000-0000-000000000001', '20000000-0000-0000-0000-0000000000a5', 'VIEWER'),
  ('dddddddd-0000-0000-0000-000000000001', '20000000-0000-0000-0000-0000000000d1', 'ADMIN');
-- Org C households: hh1 freeze/check flow, hh2 REVIEWED (S-01a), hh3 fact confirmation, hh4 approval + N-01,
-- hh5 unverified-receipt approval guard, hh6 approver policy. Org D: hd1 (foreign facts, cross-tenant).
select tests.seed_household('cccccccc-0000-0000-0000-000000000001', 'c1000000', 'HH1 freeze', 'READY_TO_FREEZE');
select tests.seed_household('cccccccc-0000-0000-0000-000000000001', 'c2000000', 'HH2 reviewed', 'REVIEWED');
select tests.seed_household('cccccccc-0000-0000-0000-000000000001', 'c3000000', 'HH3 confirm', 'BLOCKED');
select tests.seed_household('cccccccc-0000-0000-0000-000000000001', 'c4000000', 'HH4 approve', 'READY_TO_FREEZE');
select tests.seed_household('cccccccc-0000-0000-0000-000000000001', 'c5000000', 'HH5 unverified', 'READY_TO_FREEZE');
select tests.seed_household('cccccccc-0000-0000-0000-000000000001', 'c6000000', 'HH6 policy', 'READY_TO_FREEZE');
select tests.seed_household('dddddddd-0000-0000-0000-000000000001', 'd1000000', 'HD1 foreign', 'READY_TO_FREEZE');
create temp table t (k text primary key, v text);
grant all on t to authenticated, service_role;

-- ---------------------------------------------------------------- S-01: workflow transitions
select tests.authenticate_as('20000000-0000-0000-0000-0000000000a5');
select throws_ok($$ select app.transition_household('c2000000-0000-0000-0000-000000000001', 'APPROVED') $$, '42501', null, 'S-01a viewer cannot call transition_household (not executable by authenticated)');
select tests.authenticate_as('20000000-0000-0000-0000-0000000000d1');
select throws_ok($$ select app.transition_household('c1000000-0000-0000-0000-000000000001', 'READY_TO_FREEZE') $$, '42501', null, 'S-01b outsider cannot call transition_household');
select throws_ok($$ select app.set_reconciliation_status('c1000000-0000-0000-0000-000000000001', 'BLOCKED') $$, 'P0002', null, 'S-01b outsider gets not-found from the sanctioned entry point');
select tests.authenticate_as('20000000-0000-0000-0000-0000000000a1');
select throws_ok($$ update app.households set workflow_status = 'EXPORTED' where id = 'c1000000-0000-0000-0000-000000000001' $$, '42501', null, 'S-01c analyst cannot set workflow_status by UPDATE (column privilege)');
select throws_ok($$ update app.households set current_revision = 9 where id = 'c1000000-0000-0000-0000-000000000001' $$, '42501', null, 'S-01c analyst cannot set current_revision by UPDATE');
select lives_ok($$ update app.households set label = 'HH1 renamed', assignee_user_id = '20000000-0000-0000-0000-0000000000a1' where id = 'c1000000-0000-0000-0000-000000000001' $$, 'S-01 positive: analyst may still edit label and assignee');
select tests.clear_auth();
select throws_ok($$ update app.households set workflow_status = 'EXPORTED' where id = 'c1000000-0000-0000-0000-000000000001' $$, '42501', null, 'S-01 trigger layer: even the owner cannot change workflow_status outside a workflow function');
select is((select workflow_status from app.households where id = 'c1000000-0000-0000-0000-000000000001'), 'READY_TO_FREEZE'::app.workflow_status, 'S-01 household status unchanged by all attempts');

-- ---------------------------------------------------------------- S-02: audit injection
select tests.authenticate_as('20000000-0000-0000-0000-0000000000d1');
select throws_ok($$ select app.append_audit('cccccccc-0000-0000-0000-000000000001', 'APPROVAL_RECORDED', 'review', null, 'forged approval', '{}'::jsonb) $$, '42501', null, 'S-02 outsider cannot append to another tenant''s chain (not executable)');
select tests.authenticate_as('20000000-0000-0000-0000-0000000000a3');
select throws_ok($$ select app.append_audit('cccccccc-0000-0000-0000-000000000001', 'APPROVAL_RECORDED', 'review', null, 'self-authored approval event', '{}'::jsonb) $$, '42501', null, 'S-02 even a member cannot append directly');
select tests.authenticate_service();
select lives_ok($$ select app.append_audit('dddddddd-0000-0000-0000-000000000001', 'DEMO_RESET', 'organization', 'dddddddd-0000-0000-0000-000000000001', 'service maintenance event', '{}'::jsonb) $$, 'S-02 positive: a service context may append');
select is((select actor_type from app.audit_events where org_id = 'dddddddd-0000-0000-0000-000000000001' order by seq desc limit 1), 'SYSTEM'::app.actor_type, 'S-02 service appends are SYSTEM (derived, not supplied)');
select throws_ok($$ select app.append_audit('dddddddd-0000-0000-0000-000000000001', 'PROBE_EVENT', 'probe', null, 'unknown event type', '{}'::jsonb) $$, '23514', null, 'S-02 event types are allow-listed');
select throws_ok($$ select app.append_audit('eeeeeeee-0000-0000-0000-000000000001', 'DEMO_RESET', 'organization', null, 'unknown org', '{}'::jsonb) $$, 'P0002', null, 'S-02 unknown organisation is not found');
select tests.clear_auth();

-- ---------------------------------------------------------------- anon: no entry point is reachable
set local role anon;
select throws_ok($$ select app.freeze_snapshot('c1000000-0000-0000-0000-000000000001', '{}'::jsonb, repeat('0', 64)) $$, '42501', null, 'anon cannot call freeze_snapshot');
select throws_ok($$ select app.record_review('c1000000-0000-0000-0000-000000000001', 'APPROVED', 'anon approval attempt', true) $$, '42501', null, 'anon cannot call record_review');
select throws_ok($$ select app.record_check_run('c1000000-0000-0000-0000-000000000001', '{}'::jsonb, '{}'::jsonb) $$, '42501', null, 'anon cannot call record_check_run');
reset role;

-- ---------------------------------------------------------------- S-03: freeze verifies the payload and the hash
select tests.authenticate_as('20000000-0000-0000-0000-0000000000a1');
insert into t values ('p1', app.build_snapshot_payload('c1000000-0000-0000-0000-000000000001')::text);
select throws_ok($$ select app.freeze_snapshot('c1000000-0000-0000-0000-000000000001', (select v from t where k = 'p1')::jsonb, repeat('0', 64)) $$, 'P0001', null, 'S-03 wrong hash is rejected');
select throws_ok($$ select app.freeze_snapshot('c1000000-0000-0000-0000-000000000001', '{"facts":[]}'::jsonb, app.sha256_canonical('{"facts":[]}'::jsonb)) $$, 'P0001', null, 'S-03 payload without the household identity is rejected');
-- missing required fact (balance removed, hash recomputed honestly)
insert into t values ('p_nobal', (select jsonb_set((select v from t where k = 'p1')::jsonb, '{facts}', (select coalesce(jsonb_agg(f), '[]'::jsonb) from jsonb_array_elements(((select v from t where k = 'p1')::jsonb) -> 'facts') f where f ->> 'field_key' <> 'account.year_end_balance')))::text);
select throws_ok($$ select app.freeze_snapshot('c1000000-0000-0000-0000-000000000001', (select v from t where k = 'p_nobal')::jsonb, app.sha256_canonical((select v from t where k = 'p_nobal')::jsonb)) $$, 'P0001', null, 'S-03 payload missing a required fact is rejected (FREEZE_BLOCKED)');
-- unconfirmed fact smuggled in
insert into t values ('p_unconf', (select jsonb_set((select v from t where k = 'p1')::jsonb, '{facts}', (((select v from t where k = 'p1')::jsonb) -> 'facts') || jsonb_build_array(jsonb_build_object('id', 'c1000000-0000-0000-0000-00000000f008', 'subject_type', 'ACCOUNT', 'subject_id', 'c1000000-0000-0000-0000-00000000ac01', 'field_key', 'account.year_end_balance', 'value_kind', 'NUMBER', 'value_number', '612000.00', 'value_text', null, 'value_date', null, 'value_bool', null, 'value_currency', 'USD', 'as_of_date', '2025-12-31', 'verification_status', 'NEEDS_CONFIRMATION', 'source_document_id', 'c1000000-0000-0000-0000-0000000d0c02'))))::text);
select throws_ok($$ select app.freeze_snapshot('c1000000-0000-0000-0000-000000000001', (select v from t where k = 'p_unconf')::jsonb, app.sha256_canonical((select v from t where k = 'p_unconf')::jsonb)) $$, 'P0001', null, 'S-03 payload containing a NEEDS_CONFIRMATION fact is rejected');
-- foreign fact (Org D) smuggled in
insert into t values ('p_foreign', (select jsonb_set((select v from t where k = 'p1')::jsonb, '{facts}', (((select v from t where k = 'p1')::jsonb) -> 'facts') || jsonb_build_array(jsonb_build_object('id', 'd1000000-0000-0000-0000-00000000f005', 'subject_type', 'ACCOUNT', 'subject_id', 'd1000000-0000-0000-0000-00000000ac01', 'field_key', 'account.year_end_balance', 'value_kind', 'NUMBER', 'value_number', '640000.00', 'value_text', null, 'value_date', null, 'value_bool', null, 'value_currency', 'USD', 'as_of_date', '2025-12-31', 'verification_status', 'FACT_CONFIRMED', 'source_document_id', 'd1000000-0000-0000-0000-0000000d0c01'))))::text);
select throws_ok($$ select app.freeze_snapshot('c1000000-0000-0000-0000-000000000001', (select v from t where k = 'p_foreign')::jsonb, app.sha256_canonical((select v from t where k = 'p_foreign')::jsonb)) $$, 'P0001', null, 'S-03 payload containing another tenant''s fact is rejected');
-- tampered value for a real fact id
insert into t values ('p_tamper', (select replace((select v from t where k = 'p1'), '"640000.00"', '"6400000.00"')));
select throws_ok($$ select app.freeze_snapshot('c1000000-0000-0000-0000-000000000001', (select v from t where k = 'p_tamper')::jsonb, app.sha256_canonical((select v from t where k = 'p_tamper')::jsonb)) $$, 'P0001', null, 'S-03 payload whose values differ from the stored fact is rejected');
-- superseded fact smuggled in
select tests.clear_auth();
update app.facts set superseded = true where id = 'c1000000-0000-0000-0000-00000000f008';
select tests.authenticate_as('20000000-0000-0000-0000-0000000000a1');
insert into t values ('p_super', (select jsonb_set((select v from t where k = 'p1')::jsonb, '{facts}', (((select v from t where k = 'p1')::jsonb) -> 'facts') || jsonb_build_array(jsonb_build_object('id', 'c1000000-0000-0000-0000-00000000f008', 'subject_type', 'ACCOUNT', 'subject_id', 'c1000000-0000-0000-0000-00000000ac01', 'field_key', 'account.year_end_balance', 'value_kind', 'NUMBER', 'value_number', '612000.00', 'value_text', null, 'value_date', null, 'value_bool', null, 'value_currency', 'USD', 'as_of_date', '2025-12-31', 'verification_status', 'NEEDS_CONFIRMATION', 'source_document_id', 'c1000000-0000-0000-0000-0000000d0c02'))))::text);
select throws_ok($$ select app.freeze_snapshot('c1000000-0000-0000-0000-000000000001', (select v from t where k = 'p_super')::jsonb, app.sha256_canonical((select v from t where k = 'p_super')::jsonb)) $$, 'P0001', null, 'S-03 payload containing a superseded fact is rejected');
select lives_ok($$ select app.freeze_snapshot('c1000000-0000-0000-0000-000000000001', (select v from t where k = 'p1')::jsonb, app.sha256_canonical((select v from t where k = 'p1')::jsonb)) $$, 'S-03 positive: the honest payload and hash freeze');
select is((select content_sha256 from app.snapshots where household_id = 'c1000000-0000-0000-0000-000000000001' and status = 'FROZEN'), app.sha256_canonical((select v from t where k = 'p1')::jsonb), 'S-03 stored hash equals the database''s own recomputation');
insert into t values ('snap1', (select id::text from app.snapshots where household_id = 'c1000000-0000-0000-0000-000000000001' and status = 'FROZEN'));

-- ---------------------------------------------------------------- S-05a/b: facts
select throws_ok($$ update app.facts set verification_status = 'FACT_CONFIRMED' where id = 'c3000000-0000-0000-0000-00000000f008' $$, '42501', null, 'S-05a analyst cannot confirm facts by UPDATE (no privilege)');
select throws_ok($$ update app.facts set superseded = false where id = 'c1000000-0000-0000-0000-00000000f008' $$, '42501', null, 'S-05b analyst cannot un-supersede a fact (no privilege)');
select tests.clear_auth();
select throws_ok($$ update app.facts set superseded = false where id = 'c1000000-0000-0000-0000-00000000f008' $$, '42501', null, 'S-05b trigger layer: superseded is false -> true only, even for the owner');
select throws_ok($$ update app.facts set verification_status = 'FACT_CONFIRMED' where id = 'c3000000-0000-0000-0000-00000000f008' $$, '42501', null, 'S-05a trigger layer: verification_status changes only inside workflow functions');
select tests.authenticate_as('20000000-0000-0000-0000-0000000000a1');
select throws_ok($$ select app.confirm_fact('c3000000-0000-0000-0000-00000000f008', 'analyst confirms the plan value', 'ref 1') $$, '42501', null, 'S-05a analyst cannot confirm through the function either');
select tests.authenticate_as('20000000-0000-0000-0000-0000000000a2');
select throws_ok($$ select app.confirm_fact('c3000000-0000-0000-0000-00000000f008', 'short', 'custodian call 2026-11-03') $$, 'P0001', null, 'S-05a confirmation needs a rationale');
select throws_ok($$ select app.confirm_fact('c3000000-0000-0000-0000-00000000f008', 'verified by phone with the custodian', '') $$, 'P0001', null, 'S-05a confirmation needs an evidence reference');
select lives_ok($$ select app.confirm_fact('c3000000-0000-0000-0000-00000000f008', 'verified by phone with the custodian', 'custodian call 2026-11-03 ref 1234') $$, 'S-05a positive: advisor confirms with rationale and evidence reference');
select is((select count(*) from app.facts where supersedes_fact_id = 'c3000000-0000-0000-0000-00000000f008' and verification_status = 'FACT_CONFIRMED' and superseded = false), 1::bigint, 'S-05a confirmation created a new confirmed revision');
select is((select superseded from app.facts where id = 'c3000000-0000-0000-0000-00000000f008'), true, 'S-05a the unconfirmed original is superseded');

-- ---------------------------------------------------------------- S-05c/e: check runs and documents
select tests.authenticate_as('20000000-0000-0000-0000-0000000000a1');
select throws_ok($$ insert into app.check_runs (org_id, snapshot_id, household_id, check_type, request_payload, request_sha256, response, response_sha256, executed_by, run_status, coverage_status)
  values ('cccccccc-0000-0000-0000-000000000001', (select v from t where k = 'snap1')::uuid, 'c1000000-0000-0000-0000-000000000001', 'RMD_ANNUAL', '{}'::jsonb, repeat('3', 64), '{}'::jsonb, repeat('4', 64), auth.uid(), 'UNSUPPORTED', 'UNSUPPORTED') $$, '42501', null, 'S-05c analyst cannot insert check runs directly');
select throws_ok($$ insert into app.source_documents (org_id, household_id, source_kind, filename, sha256, byte_length, parser_version) values ('cccccccc-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'CUSTODIAN_STATEMENT', 'made-up-statement.pdf', repeat('a', 64), 1, 'none') $$, '42501', null, 'S-05e analyst cannot register a document with a self-declared hash');
select tests.authenticate_service();
select lives_ok($$ insert into app.source_documents (org_id, household_id, source_kind, filename, sha256, byte_length, parser_version) values ('cccccccc-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'CUSTODIAN_STATEMENT', 'uploaded-by-service.txt', repeat('c', 64), 10, 'service') $$, 'S-05e positive: the service path registers documents');

-- ---------------------------------------------------------------- S-04 (SQL): record_check_run verifies the receipt
select tests.authenticate_as('20000000-0000-0000-0000-0000000000a5');
select throws_ok($$ select app.record_check_run((select v from t where k = 'snap1')::uuid, tests.calc_request((select v from t where k = 'snap1')::uuid), tests.calc_response((select v from t where k = 'snap1')::uuid, tests.calc_request((select v from t where k = 'snap1')::uuid))) $$, '42501', null, 'S-04 viewer cannot record check runs');
select tests.authenticate_as('20000000-0000-0000-0000-0000000000a1');
insert into t values ('req1', tests.calc_request((select v from t where k = 'snap1')::uuid)::text);
insert into t values ('resp_ok', tests.calc_response((select v from t where k = 'snap1')::uuid, (select v from t where k = 'req1')::jsonb)::text);
-- tampered request hash
insert into t values ('run_badhash', (select app.record_check_run((select v from t where k = 'snap1')::uuid, (select v from t where k = 'req1')::jsonb, jsonb_set((select v from t where k = 'resp_ok')::jsonb, '{receipt,request_hash}', to_jsonb(repeat('0', 64)))))::text);
select is((select run_status from app.check_runs where id = (select v from t where k = 'run_badhash')::uuid), 'ERROR'::app.run_status, 'S-04 tampered request_hash is recorded as ERROR');
select is((select error ->> 'code' from app.check_runs where id = (select v from t where k = 'run_badhash')::uuid), 'RECEIPT_INTEGRITY_ERROR', 'S-04 error code is RECEIPT_INTEGRITY_ERROR');
select is((select response is null and request_hash_verified = false from app.check_runs where id = (select v from t where k = 'run_badhash')::uuid), true, 'S-04 no response or amount is stored for a rejected receipt');
select is((select count(*) from app.audit_events where entity_id = (select v from t where k = 'run_badhash')::uuid and event_type = 'CHECK_RUN_FAILED'), 1::bigint, 'S-04 CHECK_RUN_FAILED is appended');
select is((select workflow_status from app.households where id = 'c1000000-0000-0000-0000-000000000001'), 'FROZEN'::app.workflow_status, 'S-04 household stays FROZEN after a rejected receipt');
-- wrong snapshot_ref hash inside the request
insert into t values ('run_badref', (select app.record_check_run((select v from t where k = 'snap1')::uuid, jsonb_set((select v from t where k = 'req1')::jsonb, '{snapshot_ref,input_hash}', to_jsonb(repeat('1', 64))), tests.calc_response((select v from t where k = 'snap1')::uuid, jsonb_set((select v from t where k = 'req1')::jsonb, '{snapshot_ref,input_hash}', to_jsonb(repeat('1', 64))))))::text);
select is((select error ->> 'detail' from app.check_runs where id = (select v from t where k = 'run_badref')::uuid), 'SNAPSHOT_REF_HASH_MISMATCH', 'S-04 request not bound to this snapshot hash is rejected');
-- request for a different snapshot id
select throws_ok($$ select app.record_check_run((select v from t where k = 'snap1')::uuid, jsonb_set((select v from t where k = 'req1')::jsonb, '{snapshot_ref,snapshot_id}', to_jsonb('d1000000-0000-0000-0000-000000000001'::text)), (select v from t where k = 'resp_ok')::jsonb) $$, 'P0001', null, 'S-04 request naming another snapshot is refused');
-- unknown rule-set checksum
insert into t values ('run_badrule', (select app.record_check_run((select v from t where k = 'snap1')::uuid, (select v from t where k = 'req1')::jsonb, jsonb_set((select v from t where k = 'resp_ok')::jsonb, '{receipt,rule_sets,0,checksum}', to_jsonb(repeat('e', 64)))))::text);
select is((select left(error ->> 'detail', 22) from app.check_runs where id = (select v from t where k = 'run_badrule')::uuid), 'RULE_SET_NOT_PUBLISHED', 'S-04 unknown rule-set checksum is rejected');
-- unknown engine
insert into t values ('run_badengine', (select app.record_check_run((select v from t where k = 'snap1')::uuid, (select v from t where k = 'req1')::jsonb, jsonb_set((select v from t where k = 'resp_ok')::jsonb, '{receipt,engine_name}', to_jsonb('someone-elses-engine'::text))))::text);
select is((select error ->> 'detail' from app.check_runs where id = (select v from t where k = 'run_badengine')::uuid), 'UNKNOWN_ENGINE', 'S-04 unknown engine is rejected');
-- valid receipt
insert into t values ('run_ok', (select app.record_check_run((select v from t where k = 'snap1')::uuid, (select v from t where k = 'req1')::jsonb, (select v from t where k = 'resp_ok')::jsonb))::text);
select is((select run_status = 'PASS' and request_hash_verified = true and response is not null from app.check_runs where id = (select v from t where k = 'run_ok')::uuid), true, 'S-04 positive: a verified receipt is recorded as PASS');
select is((select count(*) from app.discrepancies where check_run_id = (select v from t where k = 'run_ok')::uuid and status = 'OPEN'), 1::bigint, 'S-04 positive: the receipt''s discrepancy is recorded OPEN');
select is((select workflow_status from app.households where id = 'c1000000-0000-0000-0000-000000000001'), 'CHECK_COMPLETE'::app.workflow_status, 'S-04 positive: household is CHECK_COMPLETE');

-- ---------------------------------------------------------------- approval flow on HH4, then N-01
select tests.authenticate_as('20000000-0000-0000-0000-0000000000a1');
select app.freeze_snapshot('c4000000-0000-0000-0000-000000000001', app.build_snapshot_payload('c4000000-0000-0000-0000-000000000001'), app.sha256_canonical(app.build_snapshot_payload('c4000000-0000-0000-0000-000000000001')));
insert into t values ('snap4', (select id::text from app.snapshots where household_id = 'c4000000-0000-0000-0000-000000000001' and status = 'FROZEN'));
select app.record_check_run((select v from t where k = 'snap4')::uuid, tests.calc_request((select v from t where k = 'snap4')::uuid), tests.calc_response((select v from t where k = 'snap4')::uuid, tests.calc_request((select v from t where k = 'snap4')::uuid)));
select app.send_to_review('c4000000-0000-0000-0000-000000000001');
select tests.authenticate_as('20000000-0000-0000-0000-0000000000a2');
select app.record_review((select v from t where k = 'snap4')::uuid, 'REVIEWED', 'reviewed by advisor', false);
insert into t values ('disc4', (select id::text from app.discrepancies where household_id = 'c4000000-0000-0000-0000-000000000001'));
select throws_ok($$ update app.discrepancies set delta_amount = 0, classification = 'WITHIN_TOLERANCE' where id = (select v from t where k = 'disc4')::uuid $$, '42501', null, 'N-01 advisor cannot rewrite discrepancy amounts (no privilege)');
select lives_ok($$ select app.disposition_discrepancy((select v from t where k = 'disc4')::uuid, 'Plan used a superseded balance; advisor to re-run the plan.') $$, 'N-01 positive: advisor records the disposition once');
select throws_ok($$ select app.disposition_discrepancy((select v from t where k = 'disc4')::uuid, 'Rewritten disposition by the same advisor.') $$, 'P0001', null, 'N-01 a second disposition is refused (ALREADY_DISPOSITIONED)');
select tests.authenticate_as('20000000-0000-0000-0000-0000000000a3');
select lives_ok($$ select app.record_review((select v from t where k = 'snap4')::uuid, 'APPROVED', 'independent check reproduced; discrepancy dispositioned', true) $$, 'approval positive: CCO approves HH4');
select tests.clear_auth();
select throws_ok($$ update app.discrepancies set delta_amount = 0 where id = (select v from t where k = 'disc4')::uuid $$, '42501', null, 'N-01 trigger layer: amounts immutable even for the owner');
select set_config('app.workflow_fn', '1', true);
select throws_ok($$ update app.discrepancies set disposition = '{"note":"rewritten"}'::jsonb where id = (select v from t where k = 'disc4')::uuid $$, '42501', null, 'N-01 trigger layer: a recorded disposition is write-once even inside the sentinel');
select set_config('app.workflow_fn', '', true);

-- ---------------------------------------------------------------- S-04 (SQL): approval requires database-verified receipts
select tests.authenticate_as('20000000-0000-0000-0000-0000000000a1');
select app.freeze_snapshot('c5000000-0000-0000-0000-000000000001', app.build_snapshot_payload('c5000000-0000-0000-0000-000000000001'), app.sha256_canonical(app.build_snapshot_payload('c5000000-0000-0000-0000-000000000001')));
insert into t values ('snap5', (select id::text from app.snapshots where household_id = 'c5000000-0000-0000-0000-000000000001' and status = 'FROZEN'));
select app.record_check_run((select v from t where k = 'snap5')::uuid, tests.calc_request((select v from t where k = 'snap5')::uuid), tests.calc_response((select v from t where k = 'snap5')::uuid, tests.calc_request((select v from t where k = 'snap5')::uuid)));
select app.send_to_review('c5000000-0000-0000-0000-000000000001');
select tests.authenticate_as('20000000-0000-0000-0000-0000000000a2');
select app.record_review((select v from t where k = 'snap5')::uuid, 'REVIEWED', 'reviewed by advisor', false);
select app.disposition_discrepancy((select id from app.discrepancies where household_id = 'c5000000-0000-0000-0000-000000000001'), 'Plan used a superseded balance; re-run plan.');
select tests.clear_auth();
-- a legacy / unverified PASS row inserted by the owner (service path): approval must refuse it
insert into app.check_runs (org_id, snapshot_id, household_id, check_type, request_payload, request_sha256, response, response_sha256, executed_by, run_status, coverage_status, request_hash_verified)
  values ('cccccccc-0000-0000-0000-000000000001', (select v from t where k = 'snap5')::uuid, 'c5000000-0000-0000-0000-000000000001', 'RMD_ANNUAL', '{}'::jsonb, repeat('5', 64), '{}'::jsonb, repeat('6', 64), '20000000-0000-0000-0000-0000000000a1', 'PASS', 'SUPPORTED_VERIFIED', false);
select tests.authenticate_as('20000000-0000-0000-0000-0000000000a3');
select throws_ok($$ select app.record_review((select v from t where k = 'snap5')::uuid, 'APPROVED', 'approve with an unverified receipt present', true) $$, 'P0001', null, 'S-04 approval refuses a snapshot with an unverified receipt (CHECK_RECEIPT_UNVERIFIED)');

-- ---------------------------------------------------------------- N-05: approver = capability x firm policy
select tests.authenticate_as('20000000-0000-0000-0000-0000000000a1');
select app.freeze_snapshot('c6000000-0000-0000-0000-000000000001', app.build_snapshot_payload('c6000000-0000-0000-0000-000000000001'), app.sha256_canonical(app.build_snapshot_payload('c6000000-0000-0000-0000-000000000001')));
insert into t values ('snap6', (select id::text from app.snapshots where household_id = 'c6000000-0000-0000-0000-000000000001' and status = 'FROZEN'));
select app.record_check_run((select v from t where k = 'snap6')::uuid, tests.calc_request((select v from t where k = 'snap6')::uuid), tests.calc_response((select v from t where k = 'snap6')::uuid, tests.calc_request((select v from t where k = 'snap6')::uuid)));
select app.send_to_review('c6000000-0000-0000-0000-000000000001');
select tests.authenticate_as('20000000-0000-0000-0000-0000000000a2');
select app.record_review((select v from t where k = 'snap6')::uuid, 'REVIEWED', 'reviewed by advisor', false);
select app.disposition_discrepancy((select id from app.discrepancies where household_id = 'c6000000-0000-0000-0000-000000000001'), 'Plan used a superseded balance; re-run plan.');
select throws_ok($$ select app.record_review((select v from t where k = 'snap6')::uuid, 'APPROVED', 'advisor approval under default policy', true) $$, '42501', null, 'N-05 ADVISOR denied under default policy (COMPLIANCE only)');
select tests.clear_auth();
update app.organizations set policies = policies || '{"approver_roles": ["ADVISOR"], "separation_of_duties": false}'::jsonb where id = 'cccccccc-0000-0000-0000-000000000001';
select tests.authenticate_as('20000000-0000-0000-0000-0000000000a3');
select throws_ok($$ select app.record_review((select v from t where k = 'snap6')::uuid, 'APPROVED', 'cco approval outside policy', true) $$, '42501', null, 'N-05 COMPLIANCE denied when policy names ADVISOR only (NOT_AN_APPROVER)');
select tests.authenticate_as('20000000-0000-0000-0000-0000000000a1');
select throws_ok($$ select app.record_review((select v from t where k = 'snap6')::uuid, 'APPROVED', 'analyst approval under advisor policy', true) $$, '42501', null, 'N-05 ANALYST has no approval capability regardless of policy');
select tests.authenticate_as('20000000-0000-0000-0000-0000000000a2');
select lives_ok($$ select app.record_review((select v from t where k = 'snap6')::uuid, 'APPROVED', 'advisor approval permitted by firm policy', true) $$, 'N-05 positive: ADVISOR approves when capability and policy both allow');
select tests.clear_auth();

-- ---------------------------------------------------------------- N-03: linear audit chain under many appends in one transaction
select tests.authenticate_service();
select app.append_audit('dddddddd-0000-0000-0000-000000000001', 'DEMO_RESET', 'organization', null, 'e' || g, jsonb_build_object('i', g)) from generate_series(1, 20) g;
select tests.clear_auth();
select is((select count(*) from (select previous_event_hash from app.audit_events where org_id = 'dddddddd-0000-0000-0000-000000000001' and previous_event_hash is not null group by 1 having count(*) > 1) s), 0::bigint, 'N-03 no two events share a predecessor');
select is((select count(*) from app.audit_chain_heads where org_id = 'dddddddd-0000-0000-0000-000000000001'), 1::bigint, 'N-03 exactly one chain head per organisation');
select is((select intact from app.verify_audit_chain('dddddddd-0000-0000-0000-000000000001')), true, 'N-03 verify_audit_chain is intact after 20 appends in one transaction');
select is((select max(seq) - min(seq) + 1 = count(*) from app.audit_events where org_id = 'dddddddd-0000-0000-0000-000000000001'), true, 'N-03 sequence numbers are gapless');
select tests.authenticate_as('20000000-0000-0000-0000-0000000000d1');
select throws_ok($$ select * from app.verify_audit_chain('cccccccc-0000-0000-0000-000000000001') $$, 'P0002', null, 'N-03 a non-member cannot verify another tenant''s chain');
select tests.clear_auth();

-- ---------------------------------------------------------------- N-04: privilege inventory
select is((select count(*) from information_schema.routine_privileges where specific_schema = 'app' and grantee = 'PUBLIC'), 0::bigint, 'N-04 PUBLIC holds no EXECUTE in schema app');
select results_eq(
  $$ select distinct routine_name::text collate "C" from information_schema.routine_privileges where specific_schema = 'app' and grantee = 'authenticated' order by 1 $$,
  $$ select v collate "C" from (values ('accept_invitation'), ('apply_personal_changes'), ('build_snapshot_payload'), ('can_read_personal_runs'), ('can_read_workspace_domain'), ('can_transition'), ('canonical_json'), ('confirm_fact'), ('coverage_summary'), ('create_personal_workspace'), ('current_role_in'), ('current_user_id'), ('disposition_discrepancy'), ('document_exception'), ('freeze_snapshot'), ('grant_consent'), ('has_role'), ('invite_participant'), ('is_member'), ('is_workspace_member'), ('is_workspace_owner'), ('latest_check_runs'), ('member_orgs'), ('my_workspace_access'), ('policy_record'), ('record_check_run'), ('record_review'), ('require_principal'), ('resolve_conflict'), ('revoke_consent'), ('revoke_membership'), ('send_to_review'), ('set_reconciliation_status'), ('sha256_canonical'), ('verify_audit_chain')) as x(v) $$,
  'N-04 authenticated may execute exactly the sanctioned entry points (inventory as of migration 0009)');
select is((select count(*) from information_schema.routine_privileges where specific_schema = 'app' and grantee = 'authenticated' and routine_name in ('transition_household', 'append_audit', 'assert_role')), 0::bigint, 'N-04 internal functions are not executable by authenticated');

select * from finish();
rollback;
