-- =============================================================================================
-- 0007 — PR-002: coverage correctness and reproducibility (S-06, S-07, N-02).
-- Forward-only; replaces functions introduced in 0005 and adds typed review outcomes. Mirrors
-- packages/contracts/src/coverage.ts and apps/web/src/domain/{freeze,checks,review}.ts.
--
--   S-07  Snapshot payload v2 carries the firm policy at freeze (tolerance + approval settings,
--         hashed as the recorded policy version), the household's vendor label and each account's
--         classification. freeze_snapshot verifies them against the organisation's own rows, so a
--         calculator request can be rebuilt from the frozen payload alone and a later change to live
--         settings or labels cannot change a request hash.
--   N-02  Only the LATEST attempt per (check_type, account_ref) on a snapshot is evaluated for
--         CHECK_COMPLETE and for approval. Earlier attempts stay as history. ERROR -> PASS recovers;
--         PASS -> ERROR blocks.
--   S-06  Approval records a typed coverage outcome computed by the database from the latest
--         attempts: SUPPORTED_CHECK_VERIFIED, REVIEWED_WITH_LIMITATIONS or APPROVED_WITH_EXCEPTIONS.
--         A snapshot whose accounts are all UNSUPPORTED can be approved but never labelled verified.
-- =============================================================================================

-- ---------------------------------------------------------------------------------------------
-- 1. Typed review outcome (S-06)
-- ---------------------------------------------------------------------------------------------
do $$ begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'app' and t.typname = 'review_outcome') then
    create type app.review_outcome as enum ('SUPPORTED_CHECK_VERIFIED', 'REVIEWED_WITH_LIMITATIONS', 'APPROVED_WITH_EXCEPTIONS');
  end if;
end $$;

alter table app.reviews add column if not exists coverage_outcome app.review_outcome null;
alter table app.reviews add column if not exists coverage_summary jsonb null;
-- An approval must carry an outcome; other decisions must not.
alter table app.reviews drop constraint if exists reviews_outcome_matches_decision;
alter table app.reviews add constraint reviews_outcome_matches_decision
  check ((decision = 'APPROVED' and coverage_outcome is not null and coverage_summary is not null) or (decision <> 'APPROVED' and coverage_outcome is null));

-- ---------------------------------------------------------------------------------------------
-- 2. Policy record at freeze (S-07). Same key set and ordering rules as policyRecord() in freeze.ts:
--    approver_roles sorted in byte order; policy_sha256 = sha256(canonical_json(core)).
-- ---------------------------------------------------------------------------------------------
create or replace function app.policy_record(p_policies jsonb) returns jsonb
language sql stable strict set search_path = app, public, extensions as $$
  with core as (
    select jsonb_build_object(
      'separation_of_duties', coalesce((p_policies ->> 'separation_of_duties')::boolean, true),
      'allow_nonmaterial_exceptions', coalesce((p_policies ->> 'allow_nonmaterial_exceptions')::boolean, false),
      'approver_roles', coalesce((select jsonb_agg(x order by x collate "C") from jsonb_array_elements_text(coalesce(p_policies -> 'approver_roles', '["COMPLIANCE"]'::jsonb)) as t(x)), '[]'::jsonb),
      'tolerance', jsonb_build_object('absolute', p_policies -> 'tolerance' ->> 'absolute', 'relative', p_policies -> 'tolerance' ->> 'relative')
    ) as c
  )
  select c || jsonb_build_object('policy_sha256', app.sha256_canonical(c)) from core;
$$;

-- ---------------------------------------------------------------------------------------------
-- 3. Snapshot payload v2 (S-07): the organisation's own rows, same shape as buildSnapshotPayload().
-- ---------------------------------------------------------------------------------------------
create or replace function app.build_snapshot_payload(p_household uuid) returns jsonb
language plpgsql security definer set search_path = app, public, extensions as $$
declare v_org uuid; v_tax_year int; v_rev int; v_label text; v_policies jsonb;
begin
  select org_id, tax_year, source_tool_label into v_org, v_tax_year, v_label from app.households where id = p_household;
  if v_org is null then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  perform app.assert_member(v_org);
  select policies into v_policies from app.organizations where id = v_org;
  select coalesce(max(revision), 0) + 1 into v_rev from app.snapshots where household_id = p_household;
  return jsonb_build_object(
    'snapshot_version', 'sagespan.snapshot.v2',
    'household_id', p_household::text,
    'tax_year', v_tax_year,
    'revision', v_rev,
    'policy', app.policy_record(v_policies),
    'household', jsonb_build_object('source_tool_label', v_label),
    'accounts', coalesce((select jsonb_agg(jsonb_build_object('id', a.id::text, 'account_type', a.account_type::text, 'tax_character', a.tax_character::text) order by a.id::text collate "C")
      from app.accounts a where a.household_id = p_household), '[]'::jsonb),
    'facts', coalesce((select jsonb_agg(jsonb_build_object(
        'id', f.id::text, 'subject_type', f.subject_type::text, 'subject_id', f.subject_id::text, 'field_key', f.field_key, 'value_kind', f.value_kind::text,
        'value_number', case when f.value_number is null then null else f.value_number::text end, 'value_text', f.value_text,
        'value_date', case when f.value_date is null then null else to_char(f.value_date, 'YYYY-MM-DD') end, 'value_bool', f.value_bool,
        'value_currency', f.value_currency, 'as_of_date', to_char(f.as_of_date, 'YYYY-MM-DD'), 'verification_status', f.verification_status::text,
        'source_document_id', f.source_document_id::text) order by f.id::text collate "C")
      from app.facts f where f.household_id = p_household and f.superseded = false and f.verification_status in ('FACT_CONFIRMED', 'FACT_ASSUMED')), '[]'::jsonb),
    'source_documents', coalesce((select jsonb_agg(jsonb_build_object('id', d.id::text, 'source_kind', d.source_kind::text, 'filename', d.filename, 'sha256', d.sha256, 'source_as_of', case when d.source_as_of is null then null else to_char(d.source_as_of, 'YYYY-MM-DD') end) order by d.id::text collate "C")
      from app.source_documents d where d.household_id = p_household), '[]'::jsonb),
    'ownership', coalesce((select jsonb_agg(jsonb_build_object('account_id', o.account_id::text, 'person_id', o.person_id::text, 'ownership_type', o.ownership_type::text, 'percentage', o.percentage::text, 'effective_from', to_char(o.effective_from, 'YYYY-MM-DD'), 'effective_to', case when o.effective_to is null then null else to_char(o.effective_to, 'YYYY-MM-DD') end) order by (o.account_id::text || o.person_id::text) collate "C")
      from app.account_ownership o join app.accounts a on a.id = o.account_id where a.household_id = p_household), '[]'::jsonb),
    'beneficiaries', coalesce((select jsonb_agg(jsonb_build_object('account_id', b.account_id::text, 'beneficiary_person_id', b.beneficiary_person_id::text, 'relationship', b.relationship::text, 'designation_type', b.designation_type::text, 'share_percentage', b.share_percentage::text, 'sole_primary_entire_year', b.sole_primary_entire_year) order by (b.account_id::text || b.designation_type::text || coalesce(b.beneficiary_person_id::text, '')) collate "C")
      from app.beneficiary_designations b join app.accounts a on a.id = b.account_id where a.household_id = p_household and b.effective_to is null), '[]'::jsonb),
    'assumptions', coalesce((select jsonb_agg(jsonb_build_object('key', s.key, 'value_kind', s.value_kind::text, 'value_decimal', case when s.value_decimal is null then null else s.value_decimal::text end, 'value_text', s.value_text, 'basis', s.basis) order by s.key collate "C")
      from app.assumptions s join app.facts f on f.id = s.source_fact_id where f.household_id = p_household and f.superseded = false and f.verification_status in ('FACT_CONFIRMED', 'FACT_ASSUMED')), '[]'::jsonb),
    'exceptions', coalesce((select jsonb_agg(jsonb_build_object('id', c.id::text, 'field_key', c.field_key, 'materiality', c.materiality::text, 'resolution_note', c.resolution_note, 'resolved_by', c.resolved_by::text) order by c.id::text collate "C")
      from app.fact_conflicts c where c.household_id = p_household and c.status = 'EXCEPTION_DOCUMENTED'), '[]'::jsonb),
    'imported_plan_values', coalesce((select jsonb_agg(jsonb_build_object('id', v.id::text, 'metric_key', v.metric_key, 'tax_year', v.tax_year, 'value_decimal', v.value_decimal::text, 'currency', v.currency, 'calculation_scope', v.calculation_scope::text, 'balance_basis', v.balance_basis::text, 'declared_inputs', v.declared_inputs, 'assumptions', v.assumptions, 'account_id', v.account_id::text) order by v.id::text collate "C")
      from app.imported_plan_values v where v.household_id = p_household and v.tax_year = v_tax_year), '[]'::jsonb)
  );
end $$;

-- ---------------------------------------------------------------------------------------------
-- 4. freeze_snapshot: v2 payload verification (S-07). Everything 0005 verified is still verified;
--    the policy record, vendor label and account list must equal the organisation's own rows.
-- ---------------------------------------------------------------------------------------------
create or replace function app.freeze_snapshot(p_household uuid, p_canonical_payload jsonb, p_content_sha256 text, p_assumption_set uuid default null) returns uuid
language plpgsql security definer set search_path = app, public, extensions as $$
declare
  v_org uuid; v_status app.workflow_status; v_tax_year int; v_label text; v_policies jsonb; v_role app.role; v_rev int; v_id uuid := gen_random_uuid();
  v_open_material int; v_open_nonmaterial int; v_computed char(64); f jsonb; v_fact app.facts%rowtype; req record; v_ok boolean; v_accounts jsonb;
begin
  select org_id, workflow_status, tax_year, source_tool_label into v_org, v_status, v_tax_year, v_label from app.households where id = p_household for update;
  if v_org is null then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  v_role := app.assert_role(v_org, array['COMPLIANCE', 'ADVISOR', 'ANALYST']::app.role[], 'freeze snapshots');
  if v_status <> 'READY_TO_FREEZE' then raise exception 'INVALID_STATE: household is %', v_status using errcode = 'P0001'; end if;
  select count(*) filter (where materiality = 'MATERIAL'), count(*) filter (where materiality = 'NONMATERIAL')
    into v_open_material, v_open_nonmaterial from app.fact_conflicts where household_id = p_household and status = 'OPEN';
  if v_open_material > 0 then raise exception 'FREEZE_BLOCKED: % open material conflict(s)', v_open_material using errcode = 'P0001'; end if;
  if v_open_nonmaterial > 0 then raise exception 'FREEZE_BLOCKED: % open nonmaterial conflict(s) need resolution or a documented exception', v_open_nonmaterial using errcode = 'P0001'; end if;
  if not exists (select 1 from app.accounts where household_id = p_household) then raise exception 'FREEZE_BLOCKED: no accounts recorded' using errcode = 'P0001'; end if;

  -- Caller-supplied payload is verified, never trusted.
  if p_content_sha256 !~ '^[0-9a-f]{64}$' then raise exception 'INVALID_HASH' using errcode = 'P0001'; end if;
  if jsonb_typeof(p_canonical_payload) <> 'object' then raise exception 'SNAPSHOT_PAYLOAD_INVALID: payload must be an object' using errcode = 'P0001'; end if;
  v_computed := app.sha256_canonical(p_canonical_payload);
  if v_computed <> p_content_sha256 then raise exception 'SNAPSHOT_HASH_MISMATCH: supplied hash does not equal sha256(canonical_json(payload))' using errcode = 'P0001'; end if;
  select coalesce(max(revision), 0) + 1 into v_rev from app.snapshots where household_id = p_household;
  if p_canonical_payload ->> 'snapshot_version' is distinct from 'sagespan.snapshot.v2' then raise exception 'SNAPSHOT_PAYLOAD_INVALID: snapshot_version (expected sagespan.snapshot.v2)' using errcode = 'P0001'; end if;
  if p_canonical_payload ->> 'household_id' is distinct from p_household::text then raise exception 'SNAPSHOT_PAYLOAD_INVALID: household_id' using errcode = 'P0001'; end if;
  if (p_canonical_payload ->> 'tax_year') is distinct from v_tax_year::text then raise exception 'SNAPSHOT_PAYLOAD_INVALID: tax_year' using errcode = 'P0001'; end if;
  if (p_canonical_payload ->> 'revision') is distinct from v_rev::text then raise exception 'SNAPSHOT_PAYLOAD_INVALID: revision (expected %)', v_rev using errcode = 'P0001'; end if;
  if jsonb_typeof(p_canonical_payload -> 'facts') is distinct from 'array' then raise exception 'SNAPSHOT_PAYLOAD_INVALID: facts' using errcode = 'P0001'; end if;

  -- S-07: policy, vendor label and account classification are recorded from the organisation's own rows.
  select policies into v_policies from app.organizations where id = v_org;
  if (p_canonical_payload -> 'policy') is distinct from app.policy_record(v_policies) then
    raise exception 'SNAPSHOT_PAYLOAD_INVALID: policy record does not match the organisation''s current policies' using errcode = 'P0001';
  end if;
  if (p_canonical_payload -> 'household' ->> 'source_tool_label') is distinct from v_label then
    raise exception 'SNAPSHOT_PAYLOAD_INVALID: household.source_tool_label' using errcode = 'P0001';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', a.id::text, 'account_type', a.account_type::text, 'tax_character', a.tax_character::text) order by a.id::text collate "C"), '[]'::jsonb)
    into v_accounts from app.accounts a where a.household_id = p_household;
  if (p_canonical_payload -> 'accounts') is distinct from v_accounts then
    raise exception 'SNAPSHOT_PAYLOAD_INVALID: accounts do not match the household''s accounts' using errcode = 'P0001';
  end if;

  -- Every payload fact must be a live, confirmed/assumed fact of this household with matching values.
  for f in select value from jsonb_array_elements(p_canonical_payload -> 'facts') loop
    if (f ->> 'id') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception 'SNAPSHOT_PAYLOAD_INVALID: fact id %', f ->> 'id' using errcode = 'P0001';
    end if;
    select * into v_fact from app.facts where id = (f ->> 'id')::uuid and org_id = v_org and household_id = p_household;
    if not found then raise exception 'SNAPSHOT_PAYLOAD_INVALID: fact % is not a fact of this household', f ->> 'id' using errcode = 'P0001'; end if;
    if v_fact.superseded then raise exception 'SNAPSHOT_PAYLOAD_INVALID: fact % is superseded', f ->> 'id' using errcode = 'P0001'; end if;
    if v_fact.verification_status not in ('FACT_CONFIRMED', 'FACT_ASSUMED') then raise exception 'SNAPSHOT_PAYLOAD_INVALID: fact % is %', f ->> 'id', v_fact.verification_status using errcode = 'P0001'; end if;
    if (f ->> 'field_key') is distinct from v_fact.field_key or (f ->> 'subject_type') is distinct from v_fact.subject_type::text or (f ->> 'subject_id') is distinct from v_fact.subject_id::text
       or (f ->> 'value_kind') is distinct from v_fact.value_kind::text or (f ->> 'as_of_date') is distinct from to_char(v_fact.as_of_date, 'YYYY-MM-DD')
       or (f ->> 'verification_status') is distinct from v_fact.verification_status::text
       or (f ->> 'value_number') is distinct from (case when v_fact.value_number is null then null else v_fact.value_number::text end)
       or (f ->> 'value_text') is distinct from v_fact.value_text
       or (f ->> 'value_date') is distinct from (case when v_fact.value_date is null then null else to_char(v_fact.value_date, 'YYYY-MM-DD') end)
       or (f -> 'value_bool') is distinct from (case when v_fact.value_bool is null then 'null'::jsonb else to_jsonb(v_fact.value_bool) end) then
      raise exception 'SNAPSHOT_PAYLOAD_INVALID: fact % does not match the stored fact', f ->> 'id' using errcode = 'P0001';
    end if;
  end loop;

  -- Completeness for the supported check: each required fact must be present in the payload.
  for req in select * from app.rmd_required_facts(p_household, v_tax_year) loop
    select exists (
      select 1 from jsonb_array_elements(p_canonical_payload -> 'facts') pf
      where pf.value ->> 'subject_type' = req.subject_type::text and pf.value ->> 'subject_id' = req.subject_id::text and pf.value ->> 'field_key' = req.field_key
        and (pf.value ->> 'verification_status' = 'FACT_CONFIRMED' or (req.assumption_allowed and pf.value ->> 'verification_status' = 'FACT_ASSUMED'))
        and (req.required_as_of is null or pf.value ->> 'as_of_date' = to_char(req.required_as_of, 'YYYY-MM-DD'))
    ) into v_ok;
    if not v_ok then
      raise exception 'FREEZE_BLOCKED: required fact % for % % is missing, unconfirmed or stale', req.field_key, lower(req.subject_type::text), req.subject_id using errcode = 'P0001';
    end if;
  end loop;

  update app.snapshots set status = 'SUPERSEDED' where household_id = p_household and status = 'FROZEN';
  insert into app.snapshots (id, org_id, household_id, revision, content_sha256, assumption_set_id, created_by, created_by_role, canonical_payload)
  values (v_id, v_org, p_household, v_rev, p_content_sha256, p_assumption_set, auth.uid(), v_role, p_canonical_payload);
  perform app.transition_household(p_household, 'FROZEN');
  perform set_config('app.workflow_fn', '1', true);
  update app.households set current_revision = v_rev where id = p_household;
  perform set_config('app.workflow_fn', '', true);
  perform app.append_audit(v_org, 'SNAPSHOT_FROZEN', 'snapshot', v_id, format('Snapshot %s (revision %s) frozen for household %s; policy %s', v_id, v_rev, p_household, left(p_canonical_payload -> 'policy' ->> 'policy_sha256', 12)), jsonb_build_object('content_sha256', p_content_sha256, 'revision', v_rev, 'policy_sha256', p_canonical_payload -> 'policy' ->> 'policy_sha256'));
  return v_id;
end $$;

-- ---------------------------------------------------------------------------------------------
-- 5. Latest attempt per (check_type, account_ref) on a snapshot (N-02). SECURITY INVOKER: RLS on
--    check_runs applies, so a caller only sees runs of organisations they belong to.
-- ---------------------------------------------------------------------------------------------
create or replace function app.latest_check_runs(p_snapshot uuid)
returns table (check_run_id uuid, check_type text, account_ref text, run_status app.run_status, coverage_status app.coverage_status, request_hash_verified boolean, executed_at timestamptz, superseded_attempts int)
language sql stable set search_path = app, public as $$
  with ranked as (
    select r.id, r.check_type, r.request_payload -> 'account' ->> 'account_ref' as account_ref, r.run_status, r.coverage_status, r.request_hash_verified, r.executed_at,
           row_number() over (partition by r.check_type, r.request_payload -> 'account' ->> 'account_ref' order by r.executed_at desc, r.id desc) as rn,
           count(*) over (partition by r.check_type, r.request_payload -> 'account' ->> 'account_ref') as attempts
    from app.check_runs r where r.snapshot_id = p_snapshot
  )
  select id, check_type, account_ref, run_status, coverage_status, request_hash_verified, executed_at, (attempts - 1)::int from ranked where rn = 1;
$$;

-- Per-account coverage of a snapshot from its latest attempts (mirror of coverageSummary() in coverage.ts).
-- Accounts come from the frozen payload (v2) so an account with no run is NOT_RUN, not silently out of scope.
create or replace function app.coverage_summary(p_snapshot uuid) returns jsonb
language plpgsql stable set search_path = app, public as $$
declare
  v_payload jsonb; v_rows jsonb; v_verified int; v_not_required int; v_unsupported int; v_indeterminate int; v_error int; v_not_run int;
  v_superseded int; v_exceptions int; v_disp int; v_disp_material int; v_accounts int;
begin
  select canonical_payload into v_payload from app.snapshots where id = p_snapshot;
  if v_payload is null then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  with accts as (
    select a.value ->> 'id' as account_ref from jsonb_array_elements(coalesce(v_payload -> 'accounts', '[]'::jsonb)) a
    union
    -- v1 snapshots (pre-0007) carry no account list: fall back to the accounts that have runs.
    select distinct l.account_ref from app.latest_check_runs(p_snapshot) l where jsonb_typeof(v_payload -> 'accounts') is distinct from 'array'
  ),
  rows_ as (
    select a.account_ref, 'RMD_ANNUAL'::text as check_type, l.check_run_id, l.run_status, l.coverage_status, coalesce(l.request_hash_verified, false) as receipt_verified, coalesce(l.superseded_attempts, 0) as superseded_attempts,
      case
        when l.check_run_id is null then 'NOT_RUN'
        when l.run_status = 'ERROR' or l.request_hash_verified is distinct from true then 'ERROR'
        when l.run_status = 'PASS' then 'VERIFIED'
        else l.run_status::text end as coverage
    from accts a left join app.latest_check_runs(p_snapshot) l on l.account_ref = a.account_ref and l.check_type = 'RMD_ANNUAL'
  )
  select jsonb_agg(jsonb_build_object('account_ref', account_ref, 'check_type', check_type, 'latest_run_id', check_run_id::text, 'coverage', coverage, 'run_status', run_status::text, 'coverage_status', coverage_status::text, 'receipt_verified', receipt_verified, 'superseded_attempts', superseded_attempts) order by account_ref collate "C"),
         count(*) filter (where coverage = 'VERIFIED'), count(*) filter (where coverage = 'NOT_REQUIRED'), count(*) filter (where coverage = 'UNSUPPORTED'),
         count(*) filter (where coverage = 'INDETERMINATE'), count(*) filter (where coverage = 'ERROR'), count(*) filter (where coverage = 'NOT_RUN'), coalesce(sum(superseded_attempts), 0), count(*)
    into v_rows, v_verified, v_not_required, v_unsupported, v_indeterminate, v_error, v_not_run, v_superseded, v_accounts
  from rows_;
  v_exceptions := jsonb_array_length(coalesce(v_payload -> 'exceptions', '[]'::jsonb));
  select count(*), count(*) filter (where d.classification not in ('NOT_COMPARABLE', 'MISSING_EVIDENCE', 'UNSUPPORTED_CHECK', 'WITHIN_TOLERANCE'))
    into v_disp, v_disp_material
    from app.discrepancies d join app.latest_check_runs(p_snapshot) l on l.check_run_id = d.check_run_id where d.disposition is not null;
  return jsonb_build_object(
    'snapshot_id', p_snapshot::text, 'check_types', '["RMD_ANNUAL"]'::jsonb, 'accounts_in_scope', coalesce(v_accounts, 0),
    'verified', coalesce(v_verified, 0), 'not_required', coalesce(v_not_required, 0), 'unsupported', coalesce(v_unsupported, 0), 'indeterminate', coalesce(v_indeterminate, 0),
    'error', coalesce(v_error, 0), 'not_run', coalesce(v_not_run, 0), 'superseded_attempts', coalesce(v_superseded, 0),
    'documented_exceptions', v_exceptions, 'dispositioned_discrepancies', coalesce(v_disp, 0), 'dispositioned_material_differences', coalesce(v_disp_material, 0),
    'rows', coalesce(v_rows, '[]'::jsonb));
end $$;

-- ---------------------------------------------------------------------------------------------
-- 6. record_check_run: CHECK_COMPLETE only when the latest attempt for EVERY account in the frozen
--    payload is a verified non-ERROR run (N-02). Body otherwise identical to 0005.
-- ---------------------------------------------------------------------------------------------
create or replace function app.record_check_run(p_snapshot uuid, p_request jsonb, p_response jsonb) returns uuid
language plpgsql security definer set search_path = app, public, extensions as $$
declare
  v_org uuid; v_household uuid; v_snap_status app.snapshot_status; v_content char(64); v_hstatus app.workflow_status; v_role app.role;
  v_receipt jsonb; v_request_hash char(64); v_fail text; v_result text; v_coverage text; rs jsonb; v_versions jsonb := '{}'::jsonb;
  v_id uuid := gen_random_uuid(); v_disc jsonb; v_ipv uuid; v_ipv_text text; v_summary jsonb;
begin
  select s.org_id, s.household_id, s.status, s.content_sha256, h.workflow_status into v_org, v_household, v_snap_status, v_content, v_hstatus
  from app.snapshots s join app.households h on h.id = s.household_id where s.id = p_snapshot for update of h;
  if v_org is null then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  v_role := app.assert_role(v_org, array['COMPLIANCE', 'ADVISOR', 'ANALYST']::app.role[], 'record check runs');
  if v_snap_status <> 'FROZEN' then raise exception 'INVALID_STATE: snapshot is %', v_snap_status using errcode = 'P0001'; end if;
  if v_hstatus not in ('FROZEN', 'CHECK_COMPLETE') then raise exception 'INVALID_STATE: household is %', v_hstatus using errcode = 'P0001'; end if;
  if jsonb_typeof(p_request) <> 'object' or jsonb_typeof(p_response) <> 'object' then raise exception 'INVALID_ARGUMENT: request and response must be objects' using errcode = 'P0001'; end if;
  if p_request -> 'snapshot_ref' ->> 'snapshot_id' is distinct from p_snapshot::text then raise exception 'SNAPSHOT_REF_MISMATCH: request.snapshot_ref.snapshot_id is not this snapshot' using errcode = 'P0001'; end if;
  v_receipt := p_response -> 'receipt';
  if v_receipt is null or jsonb_typeof(v_receipt) <> 'object' then raise exception 'RECEIPT_MISSING' using errcode = 'P0001'; end if;
  v_result := p_response ->> 'result_status';
  if v_result not in ('PASS', 'NOT_REQUIRED', 'UNSUPPORTED', 'INDETERMINATE') then raise exception 'INVALID_ARGUMENT: result_status' using errcode = 'P0001'; end if;
  v_coverage := p_response ->> 'coverage_status';
  v_request_hash := app.sha256_canonical(p_request);

  -- Receipt integrity: the first failing check is recorded as an ERROR run and a CHECK_RUN_FAILED event.
  if p_request -> 'snapshot_ref' ->> 'input_hash' is distinct from v_content then
    v_fail := 'SNAPSHOT_REF_HASH_MISMATCH';
  elsif v_receipt ->> 'request_hash' is distinct from v_request_hash::text then
    v_fail := 'REQUEST_HASH_MISMATCH';
  elsif v_receipt ->> 'engine_name' is distinct from 'sagespan-calculator' then
    v_fail := 'UNKNOWN_ENGINE';
  elsif v_receipt -> 'snapshot_ref' ->> 'input_hash' is distinct from v_content or v_receipt -> 'snapshot_ref' ->> 'snapshot_id' is distinct from p_snapshot::text then
    v_fail := 'RECEIPT_SNAPSHOT_REF_MISMATCH';
  elsif jsonb_typeof(v_receipt -> 'rule_sets') is distinct from 'array' or jsonb_array_length(v_receipt -> 'rule_sets') = 0 then
    v_fail := 'RULE_SETS_MISSING';
  else
    for rs in select value from jsonb_array_elements(v_receipt -> 'rule_sets') loop
      if not exists (select 1 from app.rule_sets r where r.code = rs ->> 'rule_set_id' and r.version = rs ->> 'version' and r.checksum = rs ->> 'checksum' and r.status = 'PUBLISHED') then
        v_fail := 'RULE_SET_NOT_PUBLISHED: ' || coalesce(rs ->> 'rule_set_id', '?') || '@' || coalesce(rs ->> 'version', '?');
        exit;
      end if;
      v_versions := v_versions || jsonb_build_object(rs ->> 'rule_set_id', rs ->> 'version');
    end loop;
  end if;

  if v_fail is not null then
    insert into app.check_runs (id, org_id, snapshot_id, household_id, check_type, engine_name, engine_version, rule_set_versions, request_payload, request_sha256, response, response_sha256, executed_at, executed_by, run_status, coverage_status, error, request_hash_verified)
    values (v_id, v_org, p_snapshot, v_household, 'RMD_ANNUAL', v_receipt ->> 'engine_name', v_receipt ->> 'engine_version', '{}'::jsonb, p_request, v_request_hash, null, null, clock_timestamp(), auth.uid(), 'ERROR', null,
            jsonb_build_object('code', 'RECEIPT_INTEGRITY_ERROR', 'detail', v_fail), false);
    perform app.append_audit(v_org, 'CHECK_RUN_FAILED', 'check_run', v_id, format('Check run %s rejected: RECEIPT_INTEGRITY_ERROR (%s); no amount was recorded', v_id, v_fail), jsonb_build_object('code', 'RECEIPT_INTEGRITY_ERROR', 'detail', v_fail));
    return v_id;
  end if;

  -- executed_at is stamped with clock_timestamp() (not the transaction-constant now()) so retries within one
  -- transaction still order correctly for the latest-attempt rule.
  insert into app.check_runs (id, org_id, snapshot_id, household_id, check_type, engine_name, engine_version, rule_set_versions, request_payload, request_sha256, response, response_sha256, executed_at, executed_by, run_status, coverage_status, error, request_hash_verified)
  values (v_id, v_org, p_snapshot, v_household, 'RMD_ANNUAL', v_receipt ->> 'engine_name', v_receipt ->> 'engine_version', v_versions, p_request, v_request_hash, p_response, app.sha256_canonical(p_response), clock_timestamp(), auth.uid(),
          v_result::app.run_status, case when v_coverage in ('SUPPORTED_VERIFIED', 'SUPPORTED_UNVALIDATED', 'NOT_COMPARABLE', 'INDETERMINATE', 'UNSUPPORTED') then v_coverage::app.coverage_status else null end, null, true);

  v_disc := p_response -> 'discrepancy';
  if v_disc is not null and jsonb_typeof(v_disc) = 'object' then
    v_ipv_text := v_disc ->> 'import_value_ref';
    if v_ipv_text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      select id into v_ipv from app.imported_plan_values where id = v_ipv_text::uuid and org_id = v_org and household_id = v_household;
    end if;
    insert into app.discrepancies (org_id, check_run_id, household_id, imported_plan_value_id, classification, comparable, computed_amount, imported_amount, delta_amount, tolerance_applied, explanation, next_step, status, disposition)
    values (v_org, v_id, v_household, v_ipv, (v_disc ->> 'classification')::app.discrepancy_classification, coalesce((v_disc ->> 'comparable')::boolean, false),
            nullif(v_disc ->> 'computed_amount', '')::numeric, nullif(v_disc ->> 'imported_amount', '')::numeric, nullif(v_disc ->> 'difference', '')::numeric, nullif(v_disc ->> 'tolerance_applied', '')::numeric,
            coalesce(v_disc ->> 'explanation', ''), coalesce(v_disc ->> 'next_step', ''), 'OPEN', null);
  end if;

  update app.snapshots set rule_set_versions = rule_set_versions || v_versions where id = p_snapshot;
  -- N-02: advance only when the latest attempt for every account in the frozen payload is clean.
  v_summary := app.coverage_summary(p_snapshot);
  if v_hstatus = 'FROZEN' and (v_summary ->> 'not_run')::int = 0 and (v_summary ->> 'error')::int = 0 then
    perform app.transition_household(v_household, 'CHECK_COMPLETE');
  end if;
  perform app.append_audit(v_org, 'CHECK_RUN_COMPLETED', 'check_run', v_id, format('Check run %s recorded: %s (%s); request hash verified by the database; %s of %s accounts have a verified latest attempt', v_id, v_result, coalesce(v_coverage, 'n/a'), (v_summary ->> 'verified')::int + (v_summary ->> 'not_required')::int, v_summary ->> 'accounts_in_scope'), jsonb_build_object('request_hash', v_request_hash, 'run_hash', v_receipt ->> 'run_hash', 'result_status', v_result));
  return v_id;
end $$;

-- ---------------------------------------------------------------------------------------------
-- 7. record_review: approval evaluates the LATEST attempts (N-02) and records the typed outcome (S-06).
-- ---------------------------------------------------------------------------------------------
create or replace function app.record_review(p_snapshot uuid, p_decision app.review_decision, p_rationale text, p_attestation boolean default false) returns uuid
language plpgsql security definer set search_path = app, public as $$
declare
  v_org uuid; v_household uuid; v_snap_status app.snapshot_status; v_created_by uuid; v_role app.role; v_hstatus app.workflow_status;
  v_policies jsonb; v_sod boolean; v_approvers text[]; v_open_disc int; v_id uuid := gen_random_uuid();
  v_summary jsonb; v_outcome app.review_outcome; v_failed text;
begin
  select org_id, household_id, status, created_by into v_org, v_household, v_snap_status, v_created_by from app.snapshots where id = p_snapshot;
  if v_org is null then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  v_role := app.assert_role(v_org, array['COMPLIANCE', 'ADVISOR']::app.role[], case p_decision when 'APPROVED' then 'approve' else 'record reviews' end);
  if v_snap_status <> 'FROZEN' then raise exception 'INVALID_STATE: snapshot is %', v_snap_status using errcode = 'P0001'; end if;
  if length(coalesce(p_rationale, '')) < 10 then raise exception 'RATIONALE_REQUIRED' using errcode = 'P0001'; end if;
  select workflow_status into v_hstatus from app.households where id = v_household for update;
  select policies into v_policies from app.organizations where id = v_org;

  if p_decision = 'REVIEWED' then
    perform app.transition_household(v_household, 'REVIEWED');
  elsif p_decision = 'APPROVED' then
    select array_agg(x) into v_approvers from jsonb_array_elements_text(coalesce(v_policies -> 'approver_roles', '["COMPLIANCE"]'::jsonb)) as t(x);
    if not (v_role::text = any (coalesce(v_approvers, array['COMPLIANCE']))) then
      raise exception 'NOT_AN_APPROVER: firm policy allows % only', array_to_string(coalesce(v_approvers, array['COMPLIANCE']), ', ') using errcode = '42501';
    end if;
    if not coalesce(p_attestation, false) then raise exception 'ATTESTATION_REQUIRED' using errcode = 'P0001'; end if;

    -- S-04 (kept from 0005): a non-ERROR run without a database-verified receipt is an integrity anomaly wherever it
    -- sits in the history (only the service path could insert one); approval is refused outright.
    if exists (select 1 from app.check_runs where snapshot_id = p_snapshot and run_status <> 'ERROR' and request_hash_verified is distinct from true) then
      raise exception 'CHECK_RECEIPT_UNVERIFIED: a non-ERROR run on this snapshot lacks a database-verified receipt' using errcode = 'P0001';
    end if;
    -- N-02 / S-06: readiness from the latest attempt per account; history is never evaluated.
    v_summary := app.coverage_summary(p_snapshot);
    if (v_summary ->> 'accounts_in_scope')::int = 0 then raise exception 'NO_ACCOUNTS_IN_SCOPE' using errcode = 'P0001'; end if;
    if (v_summary ->> 'not_run')::int > 0 then raise exception 'CHECK_REQUIRED: % account(s) have no check run', v_summary ->> 'not_run' using errcode = 'P0001'; end if;
    if (v_summary ->> 'error')::int > 0 then
      select string_agg(r ->> 'account_ref', ', ') into v_failed from jsonb_array_elements(v_summary -> 'rows') r where r ->> 'coverage' = 'ERROR';
      if exists (select 1 from jsonb_array_elements(v_summary -> 'rows') r where r ->> 'coverage' = 'ERROR' and r ->> 'run_status' <> 'ERROR') then
        raise exception 'CHECK_RECEIPT_UNVERIFIED: latest run(s) for % lack a database-verified receipt', v_failed using errcode = 'P0001';
      end if;
      raise exception 'CHECK_FAILED_LATEST: the latest check attempt failed for %; re-run the check, earlier results do not carry over', v_failed using errcode = 'P0001';
    end if;
    select count(*) into v_open_disc from app.discrepancies d join app.latest_check_runs(p_snapshot) l on l.check_run_id = d.check_run_id where d.status = 'OPEN';
    if v_open_disc > 0 then raise exception 'OPEN_DISCREPANCIES: %', v_open_disc using errcode = 'P0001'; end if;
    v_sod := coalesce((v_policies ->> 'separation_of_duties')::boolean, true);
    if v_sod and (v_created_by = auth.uid() or exists (select 1 from app.check_runs where snapshot_id = p_snapshot and executed_by = auth.uid())) then
      raise exception 'SEPARATION_OF_DUTIES' using errcode = '42501';
    end if;
    v_outcome := case
      when (v_summary ->> 'unsupported')::int + (v_summary ->> 'indeterminate')::int > 0 then 'REVIEWED_WITH_LIMITATIONS'
      when (v_summary ->> 'documented_exceptions')::int > 0 or (v_summary ->> 'dispositioned_material_differences')::int > 0 then 'APPROVED_WITH_EXCEPTIONS'
      else 'SUPPORTED_CHECK_VERIFIED' end;
    perform app.transition_household(v_household, 'APPROVED');
  else
    perform app.transition_household(v_household, 'REVIEW_PENDING');
  end if;

  insert into app.reviews (id, org_id, snapshot_id, household_id, reviewer_user_id, reviewer_role, actor_type, decision, rationale, conflict_attestation, coverage_outcome, coverage_summary)
  values (v_id, v_org, p_snapshot, v_household, auth.uid(), v_role, 'USER', p_decision, p_rationale, coalesce(p_attestation, false), v_outcome, case when p_decision = 'APPROVED' then v_summary else null end);
  perform app.append_audit(v_org, case when p_decision = 'APPROVED' then 'APPROVAL_RECORDED' else 'REVIEW_RECORDED' end, 'review', v_id,
    format('%s recorded for snapshot %s by %s%s', p_decision, p_snapshot, v_role, case when v_outcome is null then '' else format('; outcome %s (%s of %s accounts verified, %s outside supported scope, %s superseded attempt(s) kept)', v_outcome, (v_summary ->> 'verified')::int + (v_summary ->> 'not_required')::int, v_summary ->> 'accounts_in_scope', (v_summary ->> 'unsupported')::int + (v_summary ->> 'indeterminate')::int, v_summary ->> 'superseded_attempts') end),
    jsonb_build_object('review_id', v_id, 'coverage_outcome', v_outcome::text));
  return v_id;
end $$;

-- ---------------------------------------------------------------------------------------------
-- 8. Grants (N-04 discipline): re-assert the full inventory. New entry points: policy_record,
--    latest_check_runs and coverage_summary (read-only; RLS applies to the invoker-security ones).
-- ---------------------------------------------------------------------------------------------
revoke execute on all functions in schema app from public, anon, authenticated, service_role;
grant execute on function app.current_user_id(), app.member_orgs(), app.is_member(uuid), app.has_role(uuid, app.role[]), app.current_role_in(uuid)
  to authenticated, service_role;
grant execute on function app.can_transition(app.workflow_status, app.workflow_status) to authenticated, service_role;
grant execute on function app.append_audit(uuid, text, text, uuid, text, jsonb) to service_role;
grant execute on function
  app.freeze_snapshot(uuid, jsonb, text, uuid), app.resolve_conflict(uuid, uuid, text), app.document_exception(uuid, text),
  app.record_review(uuid, app.review_decision, text, boolean), app.confirm_fact(uuid, text, text), app.record_check_run(uuid, jsonb, jsonb),
  app.disposition_discrepancy(uuid, text), app.verify_audit_chain(uuid), app.build_snapshot_payload(uuid),
  app.set_reconciliation_status(uuid, app.workflow_status), app.send_to_review(uuid),
  app.canonical_json(jsonb), app.sha256_canonical(jsonb),
  app.policy_record(jsonb), app.latest_check_runs(uuid), app.coverage_summary(uuid)
  to authenticated, service_role;
