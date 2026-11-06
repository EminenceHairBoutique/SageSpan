-- PR-002 (migration 0007): S-06 typed coverage outcomes, S-07 snapshot-only reproducibility, N-02 latest-attempt
-- semantics. Each finding gets a negative case (the audit's unsafe behaviour must now be refused or labelled) and a
-- positive case (the sanctioned path still works). Mirrors apps/web/src/domain/__tests__/pr-002-coverage.test.ts.
begin;
create extension if not exists pgtap with schema extensions;
create schema if not exists tests;
\ir 000_helpers.sql
select plan(43);

select tests.make_user('30000000-0000-0000-0000-0000000000a1', 'analyst@e.test');
select tests.make_user('30000000-0000-0000-0000-0000000000a2', 'advisor@e.test');
select tests.make_user('30000000-0000-0000-0000-0000000000a3', 'cco@e.test');
insert into app.organizations (id, name, slug, policies) values
  ('eeeeeeee-0000-0000-0000-000000000001', 'Org E (synthetic)', 'pr002-e', '{"separation_of_duties": true, "approver_roles": ["COMPLIANCE"], "allow_nonmaterial_exceptions": true, "tolerance": {"absolute": "1.00", "relative": "0.001"}}');
insert into app.memberships (org_id, user_id, role) values
  ('eeeeeeee-0000-0000-0000-000000000001', '30000000-0000-0000-0000-0000000000a1', 'ANALYST'),
  ('eeeeeeee-0000-0000-0000-000000000001', '30000000-0000-0000-0000-0000000000a2', 'ADVISOR'),
  ('eeeeeeee-0000-0000-0000-000000000001', '30000000-0000-0000-0000-0000000000a3', 'COMPLIANCE');
-- e1: S-07 reproducibility; e2: N-02 ERROR -> PASS; e3: N-02 PASS -> ERROR; e4: S-06 unsupported only; e5: S-06 verified; e6: two accounts, one unsupported
select tests.seed_household('eeeeeeee-0000-0000-0000-000000000001', 'e1000000', 'E1 reproducible', 'READY_TO_FREEZE');
select tests.seed_household('eeeeeeee-0000-0000-0000-000000000001', 'e2000000', 'E2 recover', 'READY_TO_FREEZE');
select tests.seed_household('eeeeeeee-0000-0000-0000-000000000001', 'e3000000', 'E3 regress', 'READY_TO_FREEZE');
select tests.seed_household('eeeeeeee-0000-0000-0000-000000000001', 'e4000000', 'E4 unsupported', 'READY_TO_FREEZE');
select tests.seed_household('eeeeeeee-0000-0000-0000-000000000001', 'e5000000', 'E5 verified', 'READY_TO_FREEZE');
select tests.seed_household('eeeeeeee-0000-0000-0000-000000000001', 'e6000000', 'E6 mixed', 'READY_TO_FREEZE');
update app.households set source_tool_label = 'Vendor A (synthetic)' where org_id = 'eeeeeeee-0000-0000-0000-000000000001';
-- E6 gets a second, unsupported (Roth) account
insert into app.accounts (id, org_id, household_id, label, account_type, tax_character) values ('e6000000-0000-0000-0000-00000000ac02', 'eeeeeeee-0000-0000-0000-000000000001', 'e6000000-0000-0000-0000-000000000001', 'Roth IRA (synthetic)', 'ROTH_IRA', 'ROTH');
create temp table t (k text primary key, v text);
grant all on t to authenticated, service_role;

-- A request for a named account of a snapshot (tests.calc_request always names the first account).
create or replace function tests.calc_request_for(p_snapshot uuid, p_account uuid) returns jsonb language sql stable as $$
  select jsonb_set(tests.calc_request(p_snapshot), '{account,account_ref}', to_jsonb(p_account::text));
$$;
grant execute on function tests.calc_request_for(uuid, uuid) to authenticated, service_role;

-- ---------------------------------------------------------------- S-07: payload v2 and reproducibility
select tests.authenticate_as('30000000-0000-0000-0000-0000000000a1');
insert into t values ('p1', app.build_snapshot_payload('e1000000-0000-0000-0000-000000000001')::text);
select is(((select v from t where k = 'p1')::jsonb ->> 'snapshot_version'), 'sagespan.snapshot.v2', 'S-07 build_snapshot_payload emits v2');
select is(((select v from t where k = 'p1')::jsonb -> 'policy' -> 'tolerance' ->> 'absolute'), '1.00', 'S-07 payload carries the tolerance at freeze');
select is(((select v from t where k = 'p1')::jsonb -> 'policy' ->> 'policy_sha256'), app.sha256_canonical(((select v from t where k = 'p1')::jsonb -> 'policy') - 'policy_sha256')::text, 'S-07 policy_sha256 is sha256(canonical_json(policy core))');
select is(((select v from t where k = 'p1')::jsonb -> 'household' ->> 'source_tool_label'), 'Vendor A (synthetic)', 'S-07 payload carries the vendor label');
select is(jsonb_array_length((select v from t where k = 'p1')::jsonb -> 'accounts'), 1, 'S-07 payload lists the household accounts with classification');
-- v1 payloads and tampered v2 payloads are refused
select throws_ok($$ select app.freeze_snapshot('e1000000-0000-0000-0000-000000000001', jsonb_set((select v from t where k = 'p1')::jsonb, '{snapshot_version}', '"sagespan.snapshot.v1"'), app.sha256_canonical(jsonb_set((select v from t where k = 'p1')::jsonb, '{snapshot_version}', '"sagespan.snapshot.v1"'))) $$, 'P0001', null, 'S-07 a v1 payload is refused after 0007');
select throws_ok($$ select app.freeze_snapshot('e1000000-0000-0000-0000-000000000001', jsonb_set((select v from t where k = 'p1')::jsonb, '{policy,tolerance,absolute}', '"25.00"'), app.sha256_canonical(jsonb_set((select v from t where k = 'p1')::jsonb, '{policy,tolerance,absolute}', '"25.00"'))) $$, 'P0001', null, 'S-07 a payload whose policy record differs from the organisation''s policies is refused');
select throws_ok($$ select app.freeze_snapshot('e1000000-0000-0000-0000-000000000001', jsonb_set((select v from t where k = 'p1')::jsonb, '{household,source_tool_label}', '"Vendor B"'), app.sha256_canonical(jsonb_set((select v from t where k = 'p1')::jsonb, '{household,source_tool_label}', '"Vendor B"'))) $$, 'P0001', null, 'S-07 a payload with a different vendor label is refused');
select throws_ok($$ select app.freeze_snapshot('e1000000-0000-0000-0000-000000000001', jsonb_set((select v from t where k = 'p1')::jsonb, '{accounts,0,account_type}', '"ROTH_IRA"'), app.sha256_canonical(jsonb_set((select v from t where k = 'p1')::jsonb, '{accounts,0,account_type}', '"ROTH_IRA"'))) $$, 'P0001', null, 'S-07 a payload that reclassifies an account is refused');
select lives_ok($$ select app.freeze_snapshot('e1000000-0000-0000-0000-000000000001', (select v from t where k = 'p1')::jsonb, app.sha256_canonical((select v from t where k = 'p1')::jsonb)) $$, 'S-07 positive: the database''s own v2 payload freezes');
insert into t values ('snap1', (select id::text from app.snapshots where household_id = 'e1000000-0000-0000-0000-000000000001' and status = 'FROZEN'));
-- Live policy and label change AFTER freeze: the frozen payload (and so any request built from it) is unchanged.
select tests.clear_auth();
update app.organizations set policies = jsonb_set(policies, '{tolerance,absolute}', '"25.00"') where id = 'eeeeeeee-0000-0000-0000-000000000001';
update app.households set source_tool_label = 'Vendor renamed after freeze' where id = 'e1000000-0000-0000-0000-000000000001';
select is((select canonical_payload -> 'policy' -> 'tolerance' ->> 'absolute' from app.snapshots where id = (select v from t where k = 'snap1')::uuid), '1.00', 'S-07 frozen tolerance is unchanged by a live policy edit');
select is((select canonical_payload -> 'household' ->> 'source_tool_label' from app.snapshots where id = (select v from t where k = 'snap1')::uuid), 'Vendor A (synthetic)', 'S-07 frozen vendor label is unchanged by a live rename');
select is((select content_sha256::text from app.snapshots where id = (select v from t where k = 'snap1')::uuid), app.sha256_canonical((select v from t where k = 'p1')::jsonb)::text, 'S-07 frozen content hash still equals the hash of the payload at freeze');
select tests.authenticate_as('30000000-0000-0000-0000-0000000000a1');
select is((app.build_snapshot_payload('e2000000-0000-0000-0000-000000000001') -> 'policy' ->> 'policy_sha256') <> ((select v from t where k = 'p1')::jsonb -> 'policy' ->> 'policy_sha256'), true, 'S-07 a NEW freeze records the new policy version (different policy_sha256)');
update app.organizations set policies = jsonb_set(policies, '{tolerance,absolute}', '"1.00"') where id = 'eeeeeeee-0000-0000-0000-000000000001';

-- ---------------------------------------------------------------- N-02: ERROR then PASS recovers (E2)
select app.freeze_snapshot('e2000000-0000-0000-0000-000000000001', app.build_snapshot_payload('e2000000-0000-0000-0000-000000000001'), app.sha256_canonical(app.build_snapshot_payload('e2000000-0000-0000-0000-000000000001')));
insert into t values ('snap2', (select id::text from app.snapshots where household_id = 'e2000000-0000-0000-0000-000000000001' and status = 'FROZEN'));
insert into t values ('req2', tests.calc_request((select v from t where k = 'snap2')::uuid)::text);
-- first attempt: a receipt that fails verification -> ERROR run, household stays FROZEN
insert into t values ('run2_err', (select app.record_check_run((select v from t where k = 'snap2')::uuid, (select v from t where k = 'req2')::jsonb, jsonb_set(tests.calc_response((select v from t where k = 'snap2')::uuid, (select v from t where k = 'req2')::jsonb), '{receipt,request_hash}', to_jsonb(repeat('0', 64)))))::text);
select is((select run_status from app.check_runs where id = (select v from t where k = 'run2_err')::uuid), 'ERROR'::app.run_status, 'N-02 first attempt is recorded as ERROR');
select is((select workflow_status from app.households where id = 'e2000000-0000-0000-0000-000000000001'), 'FROZEN'::app.workflow_status, 'N-02 household stays FROZEN after a failed attempt');
select is((select (app.coverage_summary((select v from t where k = 'snap2')::uuid) ->> 'error')::int), 1, 'N-02 coverage shows the latest attempt as ERROR');
-- retry succeeds -> latest attempt is PASS, history kept, household advances
insert into t values ('run2_ok', (select app.record_check_run((select v from t where k = 'snap2')::uuid, (select v from t where k = 'req2')::jsonb, tests.calc_response((select v from t where k = 'snap2')::uuid, (select v from t where k = 'req2')::jsonb)))::text);
select is((select count(*) from app.check_runs where snapshot_id = (select v from t where k = 'snap2')::uuid), 2::bigint, 'N-02 the failed attempt is kept as history');
select is((select check_run_id from app.latest_check_runs((select v from t where k = 'snap2')::uuid)), (select v from t where k = 'run2_ok')::uuid, 'N-02 latest_check_runs returns the retry');
select is((select superseded_attempts from app.latest_check_runs((select v from t where k = 'snap2')::uuid)), 1, 'N-02 latest_check_runs counts the superseded attempt');
select is((select workflow_status from app.households where id = 'e2000000-0000-0000-0000-000000000001'), 'CHECK_COMPLETE'::app.workflow_status, 'N-02 household advances once the latest attempt is clean');
select app.send_to_review('e2000000-0000-0000-0000-000000000001');
select tests.authenticate_as('30000000-0000-0000-0000-0000000000a2');
select app.disposition_discrepancy((select id from app.discrepancies where check_run_id = (select v from t where k = 'run2_ok')::uuid), 'Plan used a superseded balance; computed amount governs.');
select app.record_review((select v from t where k = 'snap2')::uuid, 'REVIEWED', 'reviewed by advisor after the retry', false);
select tests.authenticate_as('30000000-0000-0000-0000-0000000000a3');
select lives_ok($$ select app.record_review((select v from t where k = 'snap2')::uuid, 'APPROVED', 'ERROR then PASS: the latest attempt is verified; history retained.', true) $$, 'N-02 positive: ERROR followed by PASS is approvable');
select is((select coverage_outcome from app.reviews where snapshot_id = (select v from t where k = 'snap2')::uuid and decision = 'APPROVED'), 'APPROVED_WITH_EXCEPTIONS'::app.review_outcome, 'S-06 a dispositioned SOURCE_CONFLICT makes the outcome APPROVED_WITH_EXCEPTIONS');
select is((select (coverage_summary ->> 'superseded_attempts')::int from app.reviews where snapshot_id = (select v from t where k = 'snap2')::uuid and decision = 'APPROVED'), 1, 'S-06 the approval records the superseded attempt count');

-- ---------------------------------------------------------------- N-02: PASS then ERROR blocks (E3)
select tests.authenticate_as('30000000-0000-0000-0000-0000000000a1');
select app.freeze_snapshot('e3000000-0000-0000-0000-000000000001', app.build_snapshot_payload('e3000000-0000-0000-0000-000000000001'), app.sha256_canonical(app.build_snapshot_payload('e3000000-0000-0000-0000-000000000001')));
insert into t values ('snap3', (select id::text from app.snapshots where household_id = 'e3000000-0000-0000-0000-000000000001' and status = 'FROZEN'));
insert into t values ('req3', tests.calc_request((select v from t where k = 'snap3')::uuid)::text);
insert into t values ('run3_ok', (select app.record_check_run((select v from t where k = 'snap3')::uuid, (select v from t where k = 'req3')::jsonb, tests.calc_response((select v from t where k = 'snap3')::uuid, (select v from t where k = 'req3')::jsonb)))::text);
select is((select workflow_status from app.households where id = 'e3000000-0000-0000-0000-000000000001'), 'CHECK_COMPLETE'::app.workflow_status, 'N-02 E3 first attempt PASS -> CHECK_COMPLETE');
insert into t values ('run3_err', (select app.record_check_run((select v from t where k = 'snap3')::uuid, (select v from t where k = 'req3')::jsonb, jsonb_set(tests.calc_response((select v from t where k = 'snap3')::uuid, (select v from t where k = 'req3')::jsonb), '{receipt,engine_name}', '"someone-elses-engine"')))::text);
select is((select run_status from app.latest_check_runs((select v from t where k = 'snap3')::uuid)), 'ERROR'::app.run_status, 'N-02 the later failed attempt is now the latest');
select app.send_to_review('e3000000-0000-0000-0000-000000000001');
select tests.authenticate_as('30000000-0000-0000-0000-0000000000a2');
select app.disposition_discrepancy((select id from app.discrepancies where check_run_id = (select v from t where k = 'run3_ok')::uuid), 'Dispositioned before the regression was noticed.');
select app.record_review((select v from t where k = 'snap3')::uuid, 'REVIEWED', 'reviewed by advisor on the earlier success', false);
select tests.authenticate_as('30000000-0000-0000-0000-0000000000a3');
select throws_ok($$ select app.record_review((select v from t where k = 'snap3')::uuid, 'APPROVED', 'Attempting to approve on the stale earlier success.', true) $$, 'P0001', null, 'N-02 PASS followed by ERROR blocks approval (CHECK_FAILED_LATEST), the stale success does not carry');
select is((select count(*) from app.reviews where snapshot_id = (select v from t where k = 'snap3')::uuid and decision = 'APPROVED'), 0::bigint, 'N-02 no approval row was written');

-- ---------------------------------------------------------------- S-06: unsupported-only is never "verified" (E4)
select tests.authenticate_as('30000000-0000-0000-0000-0000000000a1');
select app.freeze_snapshot('e4000000-0000-0000-0000-000000000001', app.build_snapshot_payload('e4000000-0000-0000-0000-000000000001'), app.sha256_canonical(app.build_snapshot_payload('e4000000-0000-0000-0000-000000000001')));
insert into t values ('snap4', (select id::text from app.snapshots where household_id = 'e4000000-0000-0000-0000-000000000001' and status = 'FROZEN'));
insert into t values ('req4', tests.calc_request((select v from t where k = 'snap4')::uuid)::text);
select app.record_check_run((select v from t where k = 'snap4')::uuid, (select v from t where k = 'req4')::jsonb, tests.calc_response((select v from t where k = 'snap4')::uuid, (select v from t where k = 'req4')::jsonb, 'UNSUPPORTED'));
select is((select workflow_status from app.households where id = 'e4000000-0000-0000-0000-000000000001'), 'CHECK_COMPLETE'::app.workflow_status, 'S-06 an UNSUPPORTED run with a verified receipt still completes the check step');
select app.send_to_review('e4000000-0000-0000-0000-000000000001');
select tests.authenticate_as('30000000-0000-0000-0000-0000000000a2');
select app.record_review((select v from t where k = 'snap4')::uuid, 'REVIEWED', 'reviewed by advisor; account unsupported', false);
select tests.authenticate_as('30000000-0000-0000-0000-0000000000a3');
select lives_ok($$ select app.record_review((select v from t where k = 'snap4')::uuid, 'APPROVED', 'Reviewer acknowledges the account is outside supported scope.', true) $$, 'S-06 a professional may approve an unsupported-only snapshot');
select is((select coverage_outcome from app.reviews where snapshot_id = (select v from t where k = 'snap4')::uuid and decision = 'APPROVED'), 'REVIEWED_WITH_LIMITATIONS'::app.review_outcome, 'S-06 ...but the outcome is REVIEWED_WITH_LIMITATIONS, never SUPPORTED_CHECK_VERIFIED');
select is((select (coverage_summary ->> 'verified')::int from app.reviews where snapshot_id = (select v from t where k = 'snap4')::uuid and decision = 'APPROVED'), 0, 'S-06 the recorded summary shows zero verified accounts');
select throws_ok($$ update app.reviews set coverage_outcome = 'SUPPORTED_CHECK_VERIFIED' where snapshot_id = (select v from t where k = 'snap4')::uuid $$, '42501', null, 'S-06 the outcome cannot be upgraded by UPDATE (no privilege)');

-- ---------------------------------------------------------------- S-06: fully supported, no exceptions (E5)
select tests.authenticate_as('30000000-0000-0000-0000-0000000000a1');
select app.freeze_snapshot('e5000000-0000-0000-0000-000000000001', app.build_snapshot_payload('e5000000-0000-0000-0000-000000000001'), app.sha256_canonical(app.build_snapshot_payload('e5000000-0000-0000-0000-000000000001')));
insert into t values ('snap5', (select id::text from app.snapshots where household_id = 'e5000000-0000-0000-0000-000000000001' and status = 'FROZEN'));
insert into t values ('req5', tests.calc_request((select v from t where k = 'snap5')::uuid)::text);
-- a PASS whose discrepancy is WITHIN_TOLERANCE is not a material difference
insert into t values ('run5', (select app.record_check_run((select v from t where k = 'snap5')::uuid, (select v from t where k = 'req5')::jsonb, jsonb_set(tests.calc_response((select v from t where k = 'snap5')::uuid, (select v from t where k = 'req5')::jsonb), '{discrepancy,classification}', '"WITHIN_TOLERANCE"')))::text);
select app.send_to_review('e5000000-0000-0000-0000-000000000001');
select tests.authenticate_as('30000000-0000-0000-0000-0000000000a2');
select app.disposition_discrepancy((select id from app.discrepancies where check_run_id = (select v from t where k = 'run5')::uuid), 'Within firm tolerance; no action.');
select app.record_review((select v from t where k = 'snap5')::uuid, 'REVIEWED', 'reviewed by advisor; within tolerance', false);
select tests.authenticate_as('30000000-0000-0000-0000-0000000000a3');
select app.record_review((select v from t where k = 'snap5')::uuid, 'APPROVED', 'All accounts verified within tolerance.', true);
select is((select coverage_outcome from app.reviews where snapshot_id = (select v from t where k = 'snap5')::uuid and decision = 'APPROVED'), 'SUPPORTED_CHECK_VERIFIED'::app.review_outcome, 'S-06 fully supported with only a within-tolerance disposition is SUPPORTED_CHECK_VERIFIED');
select is((select coverage_outcome from app.reviews where snapshot_id = (select v from t where k = 'snap2')::uuid and decision = 'REVIEWED'), null, 'S-06 non-approval reviews carry no outcome');

-- ---------------------------------------------------------------- S-06 / N-02: two accounts, one unsupported, one not yet run (E6)
select tests.authenticate_as('30000000-0000-0000-0000-0000000000a1');
select app.freeze_snapshot('e6000000-0000-0000-0000-000000000001', app.build_snapshot_payload('e6000000-0000-0000-0000-000000000001'), app.sha256_canonical(app.build_snapshot_payload('e6000000-0000-0000-0000-000000000001')));
insert into t values ('snap6', (select id::text from app.snapshots where household_id = 'e6000000-0000-0000-0000-000000000001' and status = 'FROZEN'));
select is(jsonb_array_length((select canonical_payload -> 'accounts' from app.snapshots where id = (select v from t where k = 'snap6')::uuid)), 2, 'S-07 E6 payload lists both accounts');
insert into t values ('req6a', tests.calc_request_for((select v from t where k = 'snap6')::uuid, 'e6000000-0000-0000-0000-00000000ac01')::text);
insert into t values ('req6b', tests.calc_request_for((select v from t where k = 'snap6')::uuid, 'e6000000-0000-0000-0000-00000000ac02')::text);
select app.record_check_run((select v from t where k = 'snap6')::uuid, (select v from t where k = 'req6a')::jsonb, tests.calc_response((select v from t where k = 'snap6')::uuid, (select v from t where k = 'req6a')::jsonb));
select is((select workflow_status from app.households where id = 'e6000000-0000-0000-0000-000000000001'), 'FROZEN'::app.workflow_status, 'N-02 one of two accounts checked: household is NOT yet CHECK_COMPLETE');
select is((select (app.coverage_summary((select v from t where k = 'snap6')::uuid) ->> 'not_run')::int), 1, 'N-02 coverage reports the unchecked account as NOT_RUN');
select app.record_check_run((select v from t where k = 'snap6')::uuid, (select v from t where k = 'req6b')::jsonb, tests.calc_response((select v from t where k = 'snap6')::uuid, (select v from t where k = 'req6b')::jsonb, 'UNSUPPORTED'));
select is((select workflow_status from app.households where id = 'e6000000-0000-0000-0000-000000000001'), 'CHECK_COMPLETE'::app.workflow_status, 'N-02 both accounts have a verified latest attempt -> CHECK_COMPLETE');
select app.send_to_review('e6000000-0000-0000-0000-000000000001');
select tests.authenticate_as('30000000-0000-0000-0000-0000000000a2');
select app.disposition_discrepancy((select d.id from app.discrepancies d where d.household_id = 'e6000000-0000-0000-0000-000000000001'), 'Computed amount governs; plan to be re-run.');
select app.record_review((select v from t where k = 'snap6')::uuid, 'REVIEWED', 'reviewed by advisor; one account unsupported', false);
select tests.authenticate_as('30000000-0000-0000-0000-0000000000a3');
select app.record_review((select v from t where k = 'snap6')::uuid, 'APPROVED', 'One account verified, the Roth account is outside supported scope.', true);
select is((select coverage_outcome from app.reviews where snapshot_id = (select v from t where k = 'snap6')::uuid and decision = 'APPROVED'), 'REVIEWED_WITH_LIMITATIONS'::app.review_outcome, 'S-06 mixed coverage is REVIEWED_WITH_LIMITATIONS even though one account verified and a difference was dispositioned');
select is((select (coverage_summary ->> 'verified')::int || '/' || (coverage_summary ->> 'unsupported')::int || '/' || (coverage_summary ->> 'accounts_in_scope')::int from app.reviews where snapshot_id = (select v from t where k = 'snap6')::uuid and decision = 'APPROVED'), '1/1/2', 'S-06 summary: 1 verified, 1 unsupported, 2 in scope');

-- ---------------------------------------------------------------- N-04: privilege inventory after 0007
select tests.clear_auth();
select is((select count(*) from information_schema.routine_privileges where specific_schema = 'app' and grantee = 'PUBLIC'), 0::bigint, 'N-04 PUBLIC still holds no EXECUTE in schema app');
select results_eq(
  $$ select distinct routine_name::text from information_schema.routine_privileges where specific_schema = 'app' and grantee = 'authenticated' order by 1 $$,
  $$ values ('accept_invitation'), ('build_snapshot_payload'), ('can_read_workspace_domain'), ('can_transition'), ('canonical_json'), ('confirm_fact'), ('coverage_summary'), ('create_personal_workspace'), ('current_role_in'), ('current_user_id'), ('disposition_discrepancy'), ('document_exception'), ('freeze_snapshot'), ('grant_consent'), ('has_role'), ('invite_participant'), ('is_member'), ('is_workspace_member'), ('is_workspace_owner'), ('latest_check_runs'), ('member_orgs'), ('my_workspace_access'), ('policy_record'), ('record_check_run'), ('record_review'), ('require_principal'), ('resolve_conflict'), ('revoke_consent'), ('revoke_membership'), ('send_to_review'), ('set_reconciliation_status'), ('sha256_canonical'), ('verify_audit_chain') $$,
  'N-04 authenticated may execute exactly the sanctioned entry points (0007 adds policy_record, latest_check_runs, coverage_summary; 0008 adds the workspace/consent entry points)');

select * from finish();
rollback;
