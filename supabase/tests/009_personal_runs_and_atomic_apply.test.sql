-- DATA-002 (migration 0009): personal snapshots, receipted calc runs, user decisions, retirement intake, and the
-- atomic entry point app.apply_personal_changes. Ana owns a HOUSEHOLD workspace shared with Ben (SAVINGS_GOALS only);
-- Cara is a stranger. Firm F1's advisor Dee receives a grant covering all four record domains, so she may read runs.
begin;
create extension if not exists pgtap with schema extensions;
create schema if not exists tests;
\ir 000_helpers.sql
select plan(50);

select tests.make_user('50000000-0000-0000-0000-00000000000a', 'ana9@e.test');
select tests.make_user('50000000-0000-0000-0000-00000000000b', 'ben9@e.test');
select tests.make_user('50000000-0000-0000-0000-00000000000c', 'cara9@e.test');
select tests.make_user('50000000-0000-0000-0000-00000000000d', 'dee9@e.test');
insert into app.organizations (id, name, slug, policies) values ('f9f9f9f9-0000-0000-0000-000000000001', 'Firm F1 (synthetic)', 'data002-f1', '{"separation_of_duties": true, "approver_roles": ["COMPLIANCE"], "allow_nonmaterial_exceptions": true, "tolerance": {"absolute": "1.00", "relative": "0.001"}}');
insert into app.memberships (org_id, user_id, role) values ('f9f9f9f9-0000-0000-0000-000000000001', '50000000-0000-0000-0000-00000000000d', 'ADVISOR');
create temp table t (k text primary key, v text);
grant all on t to authenticated, service_role;

-- ---------------------------------------------------------------- workspace + retirement intake seeding
select tests.authenticate_as('50000000-0000-0000-0000-00000000000a');
insert into t values ('H', app.create_personal_workspace('HOUSEHOLD', 'Ana & Ben (synthetic)', 'Ana', 2, 1500.00, 3)::text);
select is((select count(*) from app.retirement_intakes where workspace_id = (select v from t where k = 'H')::uuid), 1::bigint, 'create_personal_workspace (0009 body) seeds an all-MISSING retirement intake');
select is((select states ->> 'current_age' from app.retirement_intakes where workspace_id = (select v from t where k = 'H')::uuid), 'MISSING', 'every intake field starts MISSING');

-- ---------------------------------------------------------------- apply_personal_changes: records + revisions atomically
insert into t values ('plan1', jsonb_build_object(
  'inserts', jsonb_build_array(
    jsonb_build_object('table', 'liabilities', 'rows', jsonb_build_array(jsonb_build_object('id', '50000000-0000-0000-0000-0000000000b1', 'workspace_id', '00000000-0000-0000-0000-000000000000', 'label', 'Card (synthetic)', 'kind', 'CREDIT_CARD', 'balance', '1800.00', 'balance_as_of', '2026-10-31', 'apr_percent', '24.99', 'minimum_payment', '55.00'))),
    jsonb_build_object('table', 'recurring_obligations', 'rows', jsonb_build_array(jsonb_build_object('id', '50000000-0000-0000-0000-0000000000e1', 'label', 'Card minimum', 'category', 'DEBT_MINIMUM', 'amount', '55.00', 'cadence', 'MONTHLY', 'next_due_date', '2026-11-15', 'essential', true, 'liability_id', '50000000-0000-0000-0000-0000000000b1'))),
    jsonb_build_object('table', 'personal_record_revisions', 'rows', jsonb_build_array(
      jsonb_build_object('id', '50000000-0000-0000-0000-0000000000f1', 'record_type', 'LIABILITY', 'record_ref', '50000000-0000-0000-0000-0000000000b1', 'revision', 1, 'change', 'CREATE', 'before', null, 'after', jsonb_build_object('label', 'Card (synthetic)'), 'changed_by', '50000000-0000-0000-0000-00000000000c'),
      jsonb_build_object('id', '50000000-0000-0000-0000-0000000000f2', 'record_type', 'OBLIGATION', 'record_ref', '50000000-0000-0000-0000-0000000000e1', 'revision', 1, 'change', 'CREATE', 'before', null, 'after', jsonb_build_object('label', 'Card minimum'))))))::text);
select is((app.apply_personal_changes((select v from t where k = 'H')::uuid, (select v from t where k = 'plan1')::jsonb)) ->> 'inserted', '4', 'four rows inserted in one call');
select is((select workspace_id from app.liabilities where id = '50000000-0000-0000-0000-0000000000b1'), (select v from t where k = 'H')::uuid, 'S-01 a forged workspace_id in a row is overwritten with the authorised workspace');
select is((select changed_by from app.personal_record_revisions where id = '50000000-0000-0000-0000-0000000000f1'), '50000000-0000-0000-0000-00000000000a'::uuid, 'S-01 a forged changed_by is overwritten with auth.uid()');
select is((select liability_id from app.recurring_obligations where id = '50000000-0000-0000-0000-0000000000e1'), '50000000-0000-0000-0000-0000000000b1'::uuid, 'FK from the same plan resolves (parents inserted first)');
select results_eq(
  $$ select event_type collate "C" from app.workspace_events where workspace_id = (select v from t where k = 'H')::uuid order by seq $$,
  $$ select v collate "C" from (values ('WORKSPACE_CREATED'), ('RECORD_CREATED'), ('RECORD_CREATED')) as x(v) $$,
  'S-04 one event per logical change, in order');

-- atomicity: a plan whose second insert violates a constraint leaves nothing behind
select throws_ok($$ select app.apply_personal_changes((select v from t where k = 'H')::uuid, jsonb_build_object('inserts', jsonb_build_array(
  jsonb_build_object('table', 'savings_goals', 'rows', jsonb_build_array(jsonb_build_object('id', '50000000-0000-0000-0000-0000000000d9', 'label', 'Half', 'kind', 'MOVE', 'target_amount', '1', 'saved_amount', '0'))),
  jsonb_build_object('table', 'liabilities', 'rows', jsonb_build_array(jsonb_build_object('label', 'Bad APR', 'kind', 'CREDIT_CARD', 'balance', '1', 'balance_as_of', '2026-10-31', 'apr_percent', '150', 'minimum_payment', '1')))))) $$,
  '23514', null, 'a constraint violation anywhere in the plan raises');
select is((select count(*) from app.savings_goals where id = '50000000-0000-0000-0000-0000000000d9'), 0::bigint, 'ATOMIC: the earlier insert of the same plan was rolled back');

-- allow-lists
select throws_ok($$ select app.apply_personal_changes((select v from t where k = 'H')::uuid, jsonb_build_object('inserts', jsonb_build_array(jsonb_build_object('table', 'workspace_memberships', 'rows', jsonb_build_array(jsonb_build_object('principal_id', '50000000-0000-0000-0000-00000000000c', 'role', 'OWNER', 'status', 'ACTIVE')))))) $$, 'P0001', null, 'S-02 tables outside the personal record set are refused');
select throws_ok($$ select app.apply_personal_changes((select v from t where k = 'H')::uuid, jsonb_build_object('updates', jsonb_build_array(jsonb_build_object('table', 'personal_record_revisions', 'id', '50000000-0000-0000-0000-0000000000f1', 'row', jsonb_build_object('change', 'RETIRE'))))) $$, 'P0001', null, 'S-04 revisions have no updatable columns');
select throws_ok($$ select app.apply_personal_changes((select v from t where k = 'H')::uuid, jsonb_build_object('updates', jsonb_build_array(jsonb_build_object('table', 'liabilities', 'id', '50000000-0000-0000-0000-0000000000b1', 'row', jsonb_build_object('workspace_id', '00000000-0000-0000-0000-000000000000'))))) $$, 'P0001', null, 'workspace_id is never an updatable column');
select throws_ok($$ select app.apply_personal_changes((select v from t where k = 'H')::uuid, jsonb_build_object('updates', jsonb_build_array(jsonb_build_object('table', 'liabilities', 'id', '00000000-0000-0000-0000-0000000000ff', 'row', jsonb_build_object('balance', '1'))))) $$, 'P0002', null, 'an update that matches no row of this workspace raises (no silent zero-row success)');
select lives_ok($$ select app.apply_personal_changes((select v from t where k = 'H')::uuid, jsonb_build_object('updates', jsonb_build_array(jsonb_build_object('table', 'liabilities', 'id', '50000000-0000-0000-0000-0000000000b1', 'row', jsonb_build_object('balance', '1700.25', 'balance_as_of', '2026-11-05'))))) $$, 'owner updates a liability through the entry point');
select is((select balance from app.liabilities where id = '50000000-0000-0000-0000-0000000000b1'), 1700.25::numeric, 'the update landed');
select is((select apr_percent from app.liabilities where id = '50000000-0000-0000-0000-0000000000b1'), 24.990::numeric, 'columns not in the row are untouched');

-- profile and retirement upsert
select lives_ok($$ select app.apply_personal_changes((select v from t where k = 'H')::uuid, jsonb_build_object('profile', jsonb_build_object('cash_floor', '2000.00', 'notification_mode', 'QUIET'), 'retirement', jsonb_build_object('current_age', 41, 'states', jsonb_build_object('current_age', 'USER_REPORTED')))) $$, 'profile + retirement in one call');
select is((select cash_floor from app.personal_profiles where workspace_id = (select v from t where k = 'H')::uuid), 2000.00::numeric, 'profile cash floor updated');
select is((select current_age from app.retirement_intakes where workspace_id = (select v from t where k = 'H')::uuid), 41, 'retirement intake upserted');

-- ---------------------------------------------------------------- snapshots and runs
insert into t values ('snap1', '50000000-0000-0000-0000-00000000005a');
select lives_ok($$ select app.apply_personal_changes((select v from t where k = 'H')::uuid, jsonb_build_object('inserts', jsonb_build_array(
  jsonb_build_object('table', 'personal_snapshots', 'rows', jsonb_build_array(jsonb_build_object('id', '50000000-0000-0000-0000-00000000005a', 'revision', 1, 'as_of_date', '2026-11-05', 'content_sha256', repeat('a', 64), 'created_by', '50000000-0000-0000-0000-00000000000c', 'status', 'CURRENT'))),
  jsonb_build_object('table', 'personal_calc_runs', 'rows', jsonb_build_array(jsonb_build_object('id', '50000000-0000-0000-0000-00000000006a', 'snapshot_id', '50000000-0000-0000-0000-00000000005a', 'check_type', 'PERSONAL_CLARITY', 'request_sha256', repeat('b', 64), 'request_hash_verified', true, 'engine_name', 'sagespan-calculator', 'engine_version', '0.1.0', 'method_set_versions', jsonb_build_object('personal.clarity', '2026.1'), 'response', jsonb_build_object('result_status', 'COMPUTED'), 'run_status', 'COMPUTED', 'error', null)))))) $$,
  'snapshot + verified run recorded atomically');
select is((select created_by from app.personal_snapshots where id = '50000000-0000-0000-0000-00000000005a'), '50000000-0000-0000-0000-00000000000a'::uuid, 'S-01 forged created_by overwritten with auth.uid()');
-- S-05 shape: an unverified or engine-less "success" cannot be stored; an ERROR run carries no response
select throws_ok($$ select app.apply_personal_changes((select v from t where k = 'H')::uuid, jsonb_build_object('inserts', jsonb_build_array(jsonb_build_object('table', 'personal_calc_runs', 'rows', jsonb_build_array(jsonb_build_object('snapshot_id', '50000000-0000-0000-0000-00000000005a', 'check_type', 'DEBT_PATHS', 'request_sha256', repeat('c', 64), 'request_hash_verified', false, 'engine_name', 'sagespan-calculator', 'response', jsonb_build_object('x', 1), 'run_status', 'COMPUTED')))))) $$, '23514', null, 'S-05 a COMPUTED run with an unverified request hash is refused');
select throws_ok($$ select app.apply_personal_changes((select v from t where k = 'H')::uuid, jsonb_build_object('inserts', jsonb_build_array(jsonb_build_object('table', 'personal_calc_runs', 'rows', jsonb_build_array(jsonb_build_object('snapshot_id', '50000000-0000-0000-0000-00000000005a', 'check_type', 'DEBT_PATHS', 'request_sha256', repeat('c', 64), 'request_hash_verified', true, 'engine_name', 'someone-else', 'response', jsonb_build_object('x', 1), 'run_status', 'COMPUTED')))))) $$, '23514', null, 'S-05 a COMPUTED run from an unknown engine is refused');
select throws_ok($$ select app.apply_personal_changes((select v from t where k = 'H')::uuid, jsonb_build_object('inserts', jsonb_build_array(jsonb_build_object('table', 'personal_calc_runs', 'rows', jsonb_build_array(jsonb_build_object('snapshot_id', '50000000-0000-0000-0000-00000000005a', 'check_type', 'DEBT_PATHS', 'request_sha256', '', 'request_hash_verified', false, 'response', jsonb_build_object('x', 1), 'run_status', 'ERROR', 'error', jsonb_build_object('code', 'X'))))))) $$, '23514', null, 'S-05 an ERROR run with amounts attached is refused');
select lives_ok($$ select app.apply_personal_changes((select v from t where k = 'H')::uuid, jsonb_build_object('inserts', jsonb_build_array(jsonb_build_object('table', 'personal_calc_runs', 'rows', jsonb_build_array(jsonb_build_object('id', '50000000-0000-0000-0000-00000000006b', 'snapshot_id', '50000000-0000-0000-0000-00000000005a', 'check_type', 'DEBT_PATHS', 'request_sha256', '', 'request_hash_verified', false, 'response', null, 'run_status', 'ERROR', 'error', jsonb_build_object('code', 'SERVICE_UNAVAILABLE', 'message', 'down'))))))) $$, 'an ERROR run with no amounts is recorded (history of failures is kept)');
-- a second CURRENT snapshot for the same workspace is impossible; supersede first, in the same call
select throws_ok($$ select app.apply_personal_changes((select v from t where k = 'H')::uuid, jsonb_build_object('inserts', jsonb_build_array(jsonb_build_object('table', 'personal_snapshots', 'rows', jsonb_build_array(jsonb_build_object('revision', 2, 'as_of_date', '2026-11-06', 'content_sha256', repeat('d', 64), 'status', 'CURRENT')))))) $$, '23505', null, 'one CURRENT snapshot per workspace');
select lives_ok($$ select app.apply_personal_changes((select v from t where k = 'H')::uuid, jsonb_build_object(
  'updates', jsonb_build_array(jsonb_build_object('table', 'personal_snapshots', 'id', '50000000-0000-0000-0000-00000000005a', 'row', jsonb_build_object('status', 'SUPERSEDED'))),
  'inserts', jsonb_build_array(jsonb_build_object('table', 'personal_snapshots', 'rows', jsonb_build_array(jsonb_build_object('id', '50000000-0000-0000-0000-00000000005b', 'revision', 2, 'as_of_date', '2026-11-06', 'content_sha256', repeat('d', 64), 'status', 'CURRENT')))))) $$, 'supersede + new revision in one transaction');
select is((select status from app.personal_snapshots where id = '50000000-0000-0000-0000-00000000005a'), 'SUPERSEDED', 'old snapshot superseded, kept');
select throws_ok($$ select app.apply_personal_changes((select v from t where k = 'H')::uuid, jsonb_build_object('updates', jsonb_build_array(jsonb_build_object('table', 'personal_snapshots', 'id', '50000000-0000-0000-0000-00000000005a', 'row', jsonb_build_object('status', 'CURRENT'))))) $$, '42501', null, 'IMMUTABLE: a superseded snapshot cannot become current again');
select throws_ok($$ select app.apply_personal_changes((select v from t where k = 'H')::uuid, jsonb_build_object('updates', jsonb_build_array(jsonb_build_object('table', 'personal_calc_runs', 'id', '50000000-0000-0000-0000-00000000006a', 'row', jsonb_build_object('run_status', 'ERROR'))))) $$, 'P0001', null, 'runs are append-only (no updatable columns)');
select throws_ok($$ update app.personal_calc_runs set run_status = 'ERROR' $$, '42501', null, 'runs cannot be updated directly either (no privilege)');
select throws_ok($$ insert into app.personal_snapshots (workspace_id, revision, as_of_date, content_sha256, created_by) values ((select v from t where k = 'H')::uuid, 9, '2026-11-06', repeat('e', 64), '50000000-0000-0000-0000-00000000000a') $$, '42501', null, 'S-02 snapshots cannot be inserted directly');

-- decisions
select lives_ok($$ select app.apply_personal_changes((select v from t where k = 'H')::uuid, jsonb_build_object('inserts', jsonb_build_array(jsonb_build_object('table', 'user_decisions', 'rows', jsonb_build_array(jsonb_build_object('id', '50000000-0000-0000-0000-00000000007a', 'recommendation_id', 'rec_floor_1', 'principal_id', '50000000-0000-0000-0000-00000000000c', 'decision', 'DONE', 'note', null)))))) $$, 'a decision is recorded as an event');
select is((select principal_id from app.user_decisions where id = '50000000-0000-0000-0000-00000000007a'), '50000000-0000-0000-0000-00000000000a'::uuid, 'S-01 forged principal_id overwritten with auth.uid()');
select throws_ok($$ select app.apply_personal_changes((select v from t where k = 'H')::uuid, jsonb_build_object('inserts', jsonb_build_array(jsonb_build_object('table', 'user_decisions', 'rows', jsonb_build_array(jsonb_build_object('recommendation_id', 'rec_x', 'decision', 'APPROVE_PLAN')))))) $$, '23514', null, 'unknown decision kinds are refused');

-- ---------------------------------------------------------------- who may read the computed layer
select tests.authenticate_as('50000000-0000-0000-0000-00000000000b');
select lives_ok($$ select app.require_principal('Ben') $$, 'Ben registers');
select tests.authenticate_as('50000000-0000-0000-0000-00000000000a');
insert into t values ('mB', app.invite_participant((select v from t where k = 'H')::uuid, '50000000-0000-0000-0000-00000000000b', 'PARTICIPANT', '{SAVINGS_GOALS}')::text);
select tests.authenticate_as('50000000-0000-0000-0000-00000000000b');
select lives_ok($$ select app.accept_invitation((select v from t where k = 'mB')::uuid) $$, 'Ben accepts (SAVINGS_GOALS only)');
select is((select count(*) from app.personal_snapshots), 0::bigint, 'a one-domain participant cannot read snapshots');
select is((select count(*) from app.personal_calc_runs), 0::bigint, 'a one-domain participant cannot read runs (they span every domain)');
select is((select count(*) from app.user_decisions), 0::bigint, '…nor decisions');
select is(app.can_read_personal_runs((select v from t where k = 'H')::uuid), false, 'helper agrees');
select throws_ok($$ select app.apply_personal_changes((select v from t where k = 'H')::uuid, jsonb_build_object('inserts', jsonb_build_array(jsonb_build_object('table', 'user_decisions', 'rows', jsonb_build_array(jsonb_build_object('recommendation_id', 'rec_x', 'decision', 'DONE')))))) $$, 'P0002', null, 'a participant cannot write through the entry point (non-disclosing)');

select tests.authenticate_as('50000000-0000-0000-0000-00000000000c');
select is((select count(*) from app.personal_calc_runs) + (select count(*) from app.personal_snapshots) + (select count(*) from app.retirement_intakes), 0::bigint, 'S-01 a stranger sees nothing of the computed layer');

-- firm advisor with a grant covering every record domain may read runs; one domain short may not
select tests.authenticate_as('50000000-0000-0000-0000-00000000000a');
insert into t values ('g1', app.grant_consent((select v from t where k = 'H')::uuid, null, 'f9f9f9f9-0000-0000-0000-000000000001', '{CASH_FLOW,SPENDING,DEBT}', 'ADVISOR_REVIEW')::text);
select tests.authenticate_as('50000000-0000-0000-0000-00000000000d');
select is((select count(*) from app.personal_calc_runs), 0::bigint, 'a grant covering three of four domains does not open the runs');
select tests.authenticate_as('50000000-0000-0000-0000-00000000000a');
select lives_ok($$ select app.revoke_consent((select v from t where k = 'g1')::uuid) $$, 'owner revokes the partial grant');
insert into t values ('g2', app.grant_consent((select v from t where k = 'H')::uuid, null, 'f9f9f9f9-0000-0000-0000-000000000001', '{CASH_FLOW,SPENDING,DEBT,SAVINGS_GOALS}', 'ADVISOR_REVIEW')::text);
select tests.authenticate_as('50000000-0000-0000-0000-00000000000d');
select is((select count(*) from app.personal_calc_runs), 2::bigint, 'a grant covering all four domains opens the runs (read-only)');
select is((select count(*) from app.retirement_intakes), 0::bigint, 'RETIREMENT was not granted, so the intake stays closed');
select throws_ok($$ select app.apply_personal_changes((select v from t where k = 'H')::uuid, jsonb_build_object('profile', jsonb_build_object('cash_floor', '1'))) $$, 'P0002', null, 'a grantee cannot write');

-- ---------------------------------------------------------------- N-04 after 0009
select tests.clear_auth();
select is((select count(*) from information_schema.routine_privileges where specific_schema = 'app' and grantee = 'PUBLIC'), 0::bigint, 'N-04 PUBLIC holds no EXECUTE in schema app');
select is((select count(*) from information_schema.role_table_grants where table_schema = 'app' and grantee = 'authenticated' and privilege_type in ('INSERT', 'UPDATE', 'DELETE')
             and table_name in ('cash_accounts', 'income_streams', 'liabilities', 'recurring_obligations', 'variable_spending', 'savings_goals', 'personal_profiles', 'personal_record_revisions', 'personal_snapshots', 'personal_calc_runs', 'user_decisions', 'retirement_intakes')), 0::bigint,
  'N-04 authenticated holds no direct write privilege on any personal table (all writes via apply_personal_changes)');

select * from finish();
rollback;
