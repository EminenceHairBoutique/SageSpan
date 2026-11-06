-- Shared helpers for pgTAP tests. Each test file is wrapped in a transaction
-- and rolled back; fixtures are synthetic and created inline.
-- Run with: supabase test db   (requires the Supabase local stack / Docker)
-- or:       python supabase/tests/run_sql_tests.py   (plain Postgres with the shims)

create or replace function tests.make_user(p_id uuid, p_email text) returns uuid
language plpgsql as $$
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  values (p_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', p_email, '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}')
  on conflict (id) do nothing;
  return p_id;
end $$;

create or replace function tests.authenticate_as(p_user uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user::text, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

-- A service-role request context (no end-user sub claim), as PostgREST sets it for the service key.
create or replace function tests.authenticate_service() returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  perform set_config('role', 'service_role', true);
end $$;

create or replace function tests.clear_auth() returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('role', 'postgres', true);
end $$;

-- Test-setup only: move a household's workflow status directly (what the app tier does after its
-- freeze-gate evaluation). Sets and clears the workflow sentinel around the update.
create or replace function tests.set_workflow(p_household uuid, p_status app.workflow_status) returns void
language plpgsql as $$
begin
  perform set_config('app.workflow_fn', '1', true);
  update app.households set workflow_status = p_status where id = p_household;
  perform set_config('app.workflow_fn', '', true);
end $$;

-- Test-setup only: a complete, reconciled synthetic household (one owner, one spouse beneficiary,
-- one traditional IRA, primary-evidence facts for everything the RMD check requires).
-- p_prefix must be 8 hex characters; all ids derive from it so files can seed several households.
create or replace function tests.seed_household(p_org uuid, p_prefix text, p_label text, p_status app.workflow_status default 'READY_TO_FREEZE', p_tax_year int default 2026) returns uuid
language plpgsql as $$
declare
  v_hh uuid := (p_prefix || '-0000-0000-0000-000000000001')::uuid;
  v_owner uuid := (p_prefix || '-0000-0000-0000-00000000aa01')::uuid;
  v_spouse uuid := (p_prefix || '-0000-0000-0000-00000000aa02')::uuid;
  v_acct uuid := (p_prefix || '-0000-0000-0000-00000000ac01')::uuid;
  v_stmt uuid := (p_prefix || '-0000-0000-0000-0000000d0c01')::uuid;
  v_plan uuid := (p_prefix || '-0000-0000-0000-0000000d0c02')::uuid;
  v_asm_set uuid := (p_prefix || '-0000-0000-0000-00000000a501')::uuid;
  v_asm uuid := (p_prefix || '-0000-0000-0000-00000000a502')::uuid;
  v_alive uuid := (p_prefix || '-0000-0000-0000-00000000f006')::uuid;
  v_year_end date := make_date(p_tax_year - 1, 12, 31);
begin
  perform set_config('app.workflow_fn', '1', true);
  insert into app.households (id, org_id, label, tax_year, workflow_status) values (v_hh, p_org, p_label, p_tax_year, p_status);
  perform set_config('app.workflow_fn', '', true);
  insert into app.persons (id, org_id, household_id, display_name, role_in_household) values
    (v_owner, p_org, v_hh, p_label || ' owner', 'PRIMARY'), (v_spouse, p_org, v_hh, p_label || ' spouse', 'SPOUSE');
  insert into app.accounts (id, org_id, household_id, label, account_type) values (v_acct, p_org, v_hh, 'Traditional IRA (synthetic)', 'TRADITIONAL_IRA');
  insert into app.account_ownership (org_id, account_id, person_id, ownership_type, percentage, effective_from) values (p_org, v_acct, v_owner, 'INDIVIDUAL', 100, '2010-01-01');
  insert into app.source_documents (id, org_id, household_id, source_kind, filename, sha256, byte_length, parser_version, source_as_of) values
    (v_stmt, p_org, v_hh, 'CUSTODIAN_STATEMENT', 'statement.txt', repeat('a', 64), 100, 'test', v_year_end),
    (v_plan, p_org, v_hh, 'PLAN_EXPORT', 'plan.json', repeat('b', 64), 100, 'test', v_year_end);
  insert into app.beneficiary_designations (org_id, account_id, beneficiary_person_id, relationship, designation_type, share_percentage, sole_primary_entire_year, effective_from, source_document_id)
    values (p_org, v_acct, v_spouse, 'SPOUSE', 'PRIMARY', 100, true, '2020-01-01', v_stmt);
  insert into app.assumption_sets (id, org_id, household_id, version) values (v_asm_set, p_org, v_hh, 1);
  insert into app.facts (id, org_id, household_id, subject_type, subject_id, field_key, value_kind, value_number, value_text, value_date, value_bool, value_currency, unit, as_of_date, source_document_id, verification_status) values
    ((p_prefix || '-0000-0000-0000-00000000f001')::uuid, p_org, v_hh, 'PERSON', v_owner, 'person.birth_date', 'DATE', null, null, '1952-03-14', null, null, null, v_year_end, v_stmt, 'FACT_CONFIRMED'),
    ((p_prefix || '-0000-0000-0000-00000000f002')::uuid, p_org, v_hh, 'PERSON', v_spouse, 'person.birth_date', 'DATE', null, null, '1955-07-02', null, null, null, v_year_end, v_stmt, 'FACT_CONFIRMED'),
    ((p_prefix || '-0000-0000-0000-00000000f003')::uuid, p_org, v_hh, 'ACCOUNT', v_acct, 'account.account_type', 'TEXT', null, 'TRADITIONAL_IRA', null, null, null, null, v_year_end, v_stmt, 'FACT_CONFIRMED'),
    ((p_prefix || '-0000-0000-0000-00000000f004')::uuid, p_org, v_hh, 'ACCOUNT', v_acct, 'account.is_inherited', 'BOOL', null, null, null, false, null, null, v_year_end, v_stmt, 'FACT_CONFIRMED'),
    ((p_prefix || '-0000-0000-0000-00000000f005')::uuid, p_org, v_hh, 'ACCOUNT', v_acct, 'account.year_end_balance', 'NUMBER', 640000.00, null, null, null, 'USD', 'USD', v_year_end, v_stmt, 'FACT_CONFIRMED'),
    ((p_prefix || '-0000-0000-0000-00000000f007')::uuid, p_org, v_hh, 'ACCOUNT', v_acct, 'beneficiary.primary.spouse_sole_entire_year', 'BOOL', null, null, null, true, null, null, v_year_end, v_stmt, 'FACT_CONFIRMED'),
    ((p_prefix || '-0000-0000-0000-00000000f008')::uuid, p_org, v_hh, 'ACCOUNT', v_acct, 'account.year_end_balance', 'NUMBER', 612000.00, null, null, null, 'USD', 'USD', v_year_end, v_plan, 'NEEDS_CONFIRMATION');
  -- living status as a documented assumption (assumption row first, then the fact that references it)
  insert into app.assumptions (id, org_id, assumption_set_id, key, value_kind, value_text, basis) values (v_asm, p_org, v_asm_set, 'person.is_alive', 'BOOL', 'true', 'No death notice on file (synthetic test fixture).');
  insert into app.facts (id, org_id, household_id, subject_type, subject_id, field_key, value_kind, value_bool, as_of_date, verification_status, assumption_id)
    values (v_alive, p_org, v_hh, 'PERSON', v_owner, 'person.is_alive', 'BOOL', true, v_year_end, 'FACT_ASSUMED', v_asm);
  update app.assumptions set source_fact_id = v_alive where id = v_asm;
  insert into app.plan_imports (id, org_id, household_id, source_document_id, source_kind, format, format_version, parser_version, import_status)
    values ((p_prefix || '-0000-0000-0000-00000000ee00')::uuid, p_org, v_hh, v_plan, 'PLAN_EXPORT', 'JSON', 'sagespan.import.v1', 'test', 'RECONCILED');
  insert into app.imported_plan_values (id, org_id, import_id, household_id, account_id, metric_key, tax_year, value_decimal, currency, calculation_scope, balance_basis, declared_inputs)
    values ((p_prefix || '-0000-0000-0000-00000000ee01')::uuid, p_org, (p_prefix || '-0000-0000-0000-00000000ee00')::uuid, v_hh, v_acct, 'rmd.annual_amount', p_tax_year, 24000.00, 'USD', 'SINGLE_ACCOUNT_ANNUAL_RMD', 'ACTUAL_PRIOR_YEAR_END', '{"balance": "612000.00", "balance_as_of": "2025-12-31", "factor": "25.5"}'::jsonb);
  return v_hh;
end $$;

-- A calculator-shaped receipt for a frozen snapshot, using the seeded PUBLISHED rule sets, so tests can
-- exercise app.record_check_run with a valid request/response pair (and mutate it for negative cases).
create or replace function tests.calc_request(p_snapshot uuid) returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'schema_version', 'sagespan.rmd-check.v1', 'tax_year', h.tax_year,
    'owner', jsonb_build_object('person_ref', 'owner', 'birth_date', '1952-03-14', 'is_alive', true),
    -- account_ref is the household's real account id (PR-002 N-02 evaluates the latest attempt per payload account)
    'account', jsonb_build_object('account_ref', (select a.id::text from app.accounts a where a.household_id = h.id order by a.id::text collate "C" limit 1), 'account_type', 'TRADITIONAL_IRA', 'is_inherited', false,
      'prior_year_end_balance', jsonb_build_object('amount', '640000.00', 'currency', 'USD', 'as_of_date', '2025-12-31')),
    'beneficiaries', '[]'::jsonb,
    'snapshot_ref', jsonb_build_object('snapshot_id', s.id::text, 'revision', s.revision, 'input_hash', s.content_sha256))
  from app.snapshots s join app.households h on h.id = s.household_id where s.id = p_snapshot;
$$;

create or replace function tests.calc_response(p_snapshot uuid, p_request jsonb, p_result text default 'PASS') returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'check_type', 'RMD_ANNUAL', 'result_status', p_result,
    'coverage_status', case when p_result in ('PASS', 'NOT_REQUIRED') then 'SUPPORTED_VERIFIED' else p_result end,
    'tax_year', 2026, 'eligibility', jsonb_build_object('status', case when p_result = 'PASS' then 'SUPPORTED' else p_result end, 'reasons', '[]'::jsonb),
    'unsupported_reasons', '[]'::jsonb, 'annual_rmd', case when p_result = 'PASS' then '25098.04' else null end, 'events', '[]'::jsonb,
    'discrepancy', case when p_result = 'PASS' then jsonb_build_object('classification', 'SOURCE_CONFLICT', 'comparable', true, 'import_value_ref', null, 'computed_amount', '25098.04', 'imported_amount', '24000.00', 'difference', '1098.04', 'tolerance_applied', '25.10', 'explanation', 'test', 'next_step', 'test') else null end,
    'receipt', jsonb_build_object(
      'receipt_version', 'sagespan.receipt.v1', 'engine_name', 'sagespan-calculator', 'engine_version', '0.1.0',
      'request_hash', app.sha256_canonical(p_request), 'run_hash', repeat('7', 64), 'computed_at', '2026-11-05T12:00:00Z',
      'org_context', jsonb_build_object('org_id', s.org_id::text), 'snapshot_ref', p_request -> 'snapshot_ref',
      'rule_sets', (select jsonb_agg(jsonb_build_object('rule_set_id', r.code, 'version', r.version, 'status', r.status::text, 'checksum', r.checksum, 'effective_from', r.effective_from::text, 'effective_to', r.effective_to::text, 'sources', '[]'::jsonb) order by r.code)
                    from app.rule_sets r where r.status = 'PUBLISHED' and r.code like 'rmd.%'),
      'inputs_used', '{}'::jsonb, 'formula', '640000.00 / 25.5', 'limitations', '[]'::jsonb))
  from app.snapshots s where s.id = p_snapshot;
$$;

-- Tests switch to the anon/authenticated roles mid-file and then call these
-- helpers again, so those roles need to reach the tests schema.
grant usage on schema tests to anon, authenticated, service_role;
grant execute on all functions in schema tests to anon, authenticated, service_role;
