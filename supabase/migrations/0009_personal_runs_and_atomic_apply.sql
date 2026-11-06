-- =============================================================================================
-- 0009 — DATA-002: production persistence for the Personal workspace's computed layer
-- (dated snapshots, receipted calculation runs, user decisions, retirement intake) and ONE atomic
-- write entry point, app.apply_personal_changes(), that replaces DATA-001's non-transactional
-- PostgREST multi-row writes.
--
-- Forward-only; touches nothing in 0001–0008 except replacing app.create_personal_workspace (to seed
-- the retirement intake) and widening the workspace event-type allow-list.
--
-- Discipline carried over from the firm side (S-04/S-05, PR-002):
--   * A run is bound to a snapshot; the snapshot content hash is what the receipt's input_hash cites.
--   * A successful run (COMPUTED / INSUFFICIENT_DATA / INFEASIBLE) must carry a verified request hash,
--     the trusted engine name and a response; an ERROR run must carry no response. Enforced by CHECK.
--   * Snapshots are immutable except CURRENT → SUPERSEDED; runs and decisions are append-only.
--   * The database cannot talk to the calculator, so receipt VERIFICATION stays in the web tier
--     (verifyPersonalReceipt); the database enforces SHAPE and ownership and refuses to store a
--     "successful" run that was not marked verified by that tier.
-- =============================================================================================

-- ---------------------------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------------------------
create table if not exists app.personal_snapshots (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references app.workspaces (id) on delete cascade,
  revision int not null check (revision >= 1),
  as_of_date date not null,
  content_sha256 char(64) not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  created_by uuid not null references app.principals (id) on delete restrict,
  status text not null default 'CURRENT' check (status in ('CURRENT', 'SUPERSEDED')),
  unique (workspace_id, revision)
);
create unique index if not exists personal_snapshots_one_current_idx on app.personal_snapshots (workspace_id) where status = 'CURRENT';

create table if not exists app.personal_calc_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references app.workspaces (id) on delete cascade,
  snapshot_id uuid not null references app.personal_snapshots (id) on delete restrict,
  check_type text not null check (check_type in ('PERSONAL_CLARITY', 'DEBT_PATHS', 'PERSONAL_SCENARIO')),
  request_sha256 text not null check (request_sha256 = '' or request_sha256 ~ '^[0-9a-f]{64}$'),
  request_hash_verified boolean not null,
  engine_name text null,
  engine_version text null,
  method_set_versions jsonb not null default '{}'::jsonb,
  response jsonb null,
  run_status text not null check (run_status in ('COMPUTED', 'INSUFFICIENT_DATA', 'INFEASIBLE', 'ERROR')),
  error jsonb null,
  executed_at timestamptz not null default clock_timestamp(),
  -- S-05 analogue: a stored "success" is a verified, engine-attributed, receipted result; an error carries no amounts.
  constraint personal_calc_runs_success_shape check (
    (run_status = 'ERROR' and response is null and error is not null)
    or (run_status <> 'ERROR' and request_hash_verified and engine_name = 'sagespan-calculator' and response is not null and error is null and request_sha256 <> '')
  )
);
create index if not exists personal_calc_runs_snapshot_idx on app.personal_calc_runs (snapshot_id, check_type, executed_at desc);

create table if not exists app.user_decisions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references app.workspaces (id) on delete cascade,
  recommendation_id text not null check (length(recommendation_id) between 1 and 120),
  principal_id uuid not null references app.principals (id) on delete restrict,
  decision text not null check (decision in ('DONE', 'SNOOZE', 'NOT_RELEVANT', 'DISAGREE', 'ASK_WHY', 'ACCEPT')),
  note text null check (note is null or length(note) <= 500),
  created_at timestamptz not null default clock_timestamp()
);
create index if not exists user_decisions_workspace_idx on app.user_decisions (workspace_id, created_at desc);

create table if not exists app.retirement_intakes (
  workspace_id uuid primary key references app.workspaces (id) on delete cascade,
  current_age int null check (current_age is null or current_age between 16 and 110),
  target_retirement_age int null check (target_retirement_age is null or target_retirement_age between 30 and 110),
  annual_retirement_spending numeric(14, 2) null check (annual_retirement_spending is null or annual_retirement_spending >= 0),
  retirement_assets_total numeric(16, 2) null check (retirement_assets_total is null or retirement_assets_total >= 0),
  retirement_assets_as_of date null,
  annual_contributions numeric(14, 2) null check (annual_contributions is null or annual_contributions >= 0),
  expected_pension_annual numeric(14, 2) null check (expected_pension_annual is null or expected_pension_annual >= 0),
  social_security_estimate_annual numeric(14, 2) null check (social_security_estimate_annual is null or social_security_estimate_annual >= 0),
  social_security_estimate_source text null check (social_security_estimate_source is null or social_security_estimate_source in ('SSA_STATEMENT', 'USER_GUESS')),
  life_span_low int null check (life_span_low is null or life_span_low between 50 and 120),
  life_span_high int null check (life_span_high is null or life_span_high between 50 and 120),
  states jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint retirement_intakes_span check ((life_span_low is null) = (life_span_high is null) and (life_span_low is null or life_span_low <= life_span_high))
);

-- Immutability
create or replace function app.personal_snapshots_guard() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then raise exception 'IMMUTABLE: personal snapshots are never deleted' using errcode = '42501'; end if;
  if new.id <> old.id or new.workspace_id <> old.workspace_id or new.revision <> old.revision or new.as_of_date <> old.as_of_date
     or new.content_sha256 <> old.content_sha256 or new.created_at <> old.created_at or new.created_by <> old.created_by then
    raise exception 'IMMUTABLE: a personal snapshot cannot be edited; a changed input creates a new revision' using errcode = '42501';
  end if;
  if old.status = 'SUPERSEDED' and new.status <> 'SUPERSEDED' then
    raise exception 'IMMUTABLE: a superseded snapshot cannot become current again' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists personal_snapshots_guard on app.personal_snapshots;
create trigger personal_snapshots_guard before update or delete on app.personal_snapshots for each row execute function app.personal_snapshots_guard();
drop trigger if exists personal_calc_runs_no_update on app.personal_calc_runs;
create trigger personal_calc_runs_no_update before update or delete on app.personal_calc_runs for each row execute function app.workspace_events_immutable();
drop trigger if exists user_decisions_no_update on app.user_decisions;
create trigger user_decisions_no_update before update or delete on app.user_decisions for each row execute function app.workspace_events_immutable();

-- ---------------------------------------------------------------------------------------------
-- 2. RLS. Computed results span every domain (a clarity run cites cash, spending, debt and goals), so
--    they are readable only by someone who may read ALL four record domains: the owner, or a member /
--    grantee whose scope covers all of them. A SAVINGS_GOALS-only participant sees goals, not the run.
-- ---------------------------------------------------------------------------------------------
create or replace function app.can_read_personal_runs(p_workspace uuid) returns boolean
language sql stable security definer set search_path = app, public as $$
  select app.can_read_workspace_domain(p_workspace, 'CASH_FLOW') and app.can_read_workspace_domain(p_workspace, 'SPENDING')
     and app.can_read_workspace_domain(p_workspace, 'DEBT') and app.can_read_workspace_domain(p_workspace, 'SAVINGS_GOALS');
$$;

do $$
declare t text;
begin
  for t in select unnest(array['personal_snapshots', 'personal_calc_runs', 'user_decisions', 'retirement_intakes']) loop
    execute format('alter table app.%I enable row level security', t);
    execute format('alter table app.%I no force row level security', t);
  end loop;
end $$;

drop policy if exists personal_snapshots_select on app.personal_snapshots;
create policy personal_snapshots_select on app.personal_snapshots for select to authenticated using (app.can_read_personal_runs(workspace_id));
drop policy if exists personal_calc_runs_select on app.personal_calc_runs;
create policy personal_calc_runs_select on app.personal_calc_runs for select to authenticated using (app.can_read_personal_runs(workspace_id));
drop policy if exists user_decisions_select on app.user_decisions;
create policy user_decisions_select on app.user_decisions for select to authenticated using (app.can_read_personal_runs(workspace_id));
drop policy if exists retirement_intakes_select on app.retirement_intakes;
create policy retirement_intakes_select on app.retirement_intakes for select to authenticated using (app.can_read_workspace_domain(workspace_id, 'RETIREMENT'));
-- No INSERT/UPDATE policies: these tables change only through app.apply_personal_changes (below).

-- ---------------------------------------------------------------------------------------------
-- 3. Workspace events: widen the allow-list for the computed layer.
-- ---------------------------------------------------------------------------------------------
alter table app.workspace_events drop constraint if exists workspace_events_event_type_check;
alter table app.workspace_events add constraint workspace_events_event_type_check check (event_type in (
  'WORKSPACE_CREATED', 'PARTICIPANT_INVITED', 'INVITATION_ACCEPTED', 'MEMBERSHIP_REVOKED',
  'CONSENT_GRANTED', 'CONSENT_REVOKED', 'RECORD_CREATED', 'RECORD_UPDATED', 'RECORD_RETIRED', 'PROFILE_UPDATED',
  'SNAPSHOT_CREATED', 'SNAPSHOT_SUPERSEDED', 'CALC_RUN_RECORDED', 'DECISION_RECORDED', 'RETIREMENT_UPDATED'));

-- ---------------------------------------------------------------------------------------------
-- 4. app.apply_personal_changes(p_workspace, p_plan) — the atomic unit of work.
--
-- p_plan = { "profile": {...} | null, "retirement": {...} | null,
--            "updates": [{ "table": "cash_accounts", "id": "<uuid>", "row": {...} }, ...],
--            "inserts": [{ "table": "savings_goals", "rows": [{...}, ...] }, ...] }
--
-- Authorisation is re-derived here (SECURITY DEFINER bypasses RLS): the caller must be the ACTIVE
-- OWNER; every row's workspace_id is overwritten with p_workspace; actor columns (changed_by,
-- created_by, principal_id) are overwritten with auth.uid(); tables and columns are allow-listed;
-- an update that matches no row in this workspace raises; everything is one transaction.
-- Appends one workspace event per logical change. Returns a summary.
-- ---------------------------------------------------------------------------------------------
create or replace function app.personal_table_columns(p_table text, p_for_update boolean) returns text[]
language sql immutable as $$
  select case p_table
    when 'cash_accounts' then array['id', 'account_ref', 'workspace_id', 'label', 'kind', 'balance', 'currency', 'balance_as_of', 'liquid', 'data_state', 'revision', 'supersedes_id', 'superseded']
    when 'income_streams' then array['id', 'workspace_id', 'label', 'kind', 'cadence', 'reliability', 'observed_monthly_amounts', 'observed_from', 'observed_to', 'expected_amount', 'next_expected_date', 'data_state', 'retired']
    when 'recurring_obligations' then array['id', 'workspace_id', 'label', 'category', 'amount', 'cadence', 'next_due_date', 'essential', 'liability_id', 'data_state', 'retired']
    when 'variable_spending' then array['id', 'workspace_id', 'category', 'observed_monthly_amounts', 'essential', 'transfers_excluded', 'data_state', 'retired']
    when 'liabilities' then array['id', 'workspace_id', 'label', 'kind', 'balance', 'balance_as_of', 'apr_percent', 'minimum_payment', 'rate_type', 'promo_apr_percent', 'promo_apr_expires', 'due_day_of_month', 'data_state', 'retired']
    when 'savings_goals' then array['id', 'workspace_id', 'label', 'kind', 'target_amount', 'saved_amount', 'target_date', 'monthly_contribution', 'funded_from_account_ref', 'retired']
    when 'personal_record_revisions' then case when p_for_update then array[]::text[] else array['id', 'workspace_id', 'record_type', 'record_ref', 'revision', 'change', 'before', 'after', 'changed_by'] end
    when 'personal_snapshots' then case when p_for_update then array['status'] else array['id', 'workspace_id', 'revision', 'as_of_date', 'content_sha256', 'created_by', 'status'] end
    when 'personal_calc_runs' then case when p_for_update then array[]::text[] else array['id', 'workspace_id', 'snapshot_id', 'check_type', 'request_sha256', 'request_hash_verified', 'engine_name', 'engine_version', 'method_set_versions', 'response', 'run_status', 'error'] end
    when 'user_decisions' then case when p_for_update then array[]::text[] else array['id', 'workspace_id', 'recommendation_id', 'principal_id', 'decision', 'note'] end
    else null
  end;
$$;

create or replace function app.apply_personal_changes(p_workspace uuid, p_plan jsonb) returns jsonb
language plpgsql security definer set search_path = app, public, extensions as $$
declare
  v_uid uuid := auth.uid();
  v_item jsonb; v_row jsonb; v_table text; v_id uuid; v_cols text[]; v_keys text[]; v_n int;
  v_inserted int := 0; v_updated int := 0; v_events int := 0;
  v_kind app.workspace_kind;
  v_change text;
begin
  if v_uid is null then raise exception 'UNAUTHENTICATED' using errcode = '42501'; end if;
  select kind into v_kind from app.workspaces where id = p_workspace;
  if v_kind is null or v_kind = 'FIRM' or not app.is_workspace_owner(p_workspace) then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  if p_plan is null or jsonb_typeof(p_plan) <> 'object' then raise exception 'VALIDATION: plan must be an object' using errcode = 'P0001'; end if;

  -- profile (single row, update only)
  if p_plan ? 'profile' and jsonb_typeof(p_plan -> 'profile') = 'object' then
    v_row := p_plan -> 'profile';
    update app.personal_profiles p set
      household_size = coalesce((v_row ->> 'household_size')::int, p.household_size),
      situation = coalesce(v_row ->> 'situation', p.situation),
      top_concern = case when v_row ? 'top_concern' then v_row ->> 'top_concern' else p.top_concern end,
      cash_floor = coalesce((v_row ->> 'cash_floor')::numeric, p.cash_floor),
      buffer_target_months = case when v_row ? 'buffer_target_months' then (v_row ->> 'buffer_target_months')::numeric else p.buffer_target_months end,
      extra_debt_payment_monthly = coalesce((v_row ->> 'extra_debt_payment_monthly')::numeric, p.extra_debt_payment_monthly),
      notification_mode = coalesce(v_row ->> 'notification_mode', p.notification_mode),
      updated_at = now()
    where p.workspace_id = p_workspace;
    get diagnostics v_n = row_count;
    if v_n <> 1 then raise exception 'NOT_FOUND: profile' using errcode = 'P0002'; end if;
    v_updated := v_updated + 1;
    perform app.workspace_append_event(p_workspace, 'PROFILE_UPDATED', 'personal_profile', p_workspace, 'guardrails updated', v_row - 'situation' - 'top_concern');
    v_events := v_events + 1;
  end if;

  -- retirement intake (single row, upsert; amounts are user-reported inputs, never results)
  if p_plan ? 'retirement' and jsonb_typeof(p_plan -> 'retirement') = 'object' then
    v_row := p_plan -> 'retirement';
    insert into app.retirement_intakes as r (workspace_id, current_age, target_retirement_age, annual_retirement_spending, retirement_assets_total, retirement_assets_as_of, annual_contributions, expected_pension_annual, social_security_estimate_annual, social_security_estimate_source, life_span_low, life_span_high, states, updated_at)
    values (p_workspace, (v_row ->> 'current_age')::int, (v_row ->> 'target_retirement_age')::int, (v_row ->> 'annual_retirement_spending')::numeric, (v_row ->> 'retirement_assets_total')::numeric, (v_row ->> 'retirement_assets_as_of')::date, (v_row ->> 'annual_contributions')::numeric, (v_row ->> 'expected_pension_annual')::numeric, (v_row ->> 'social_security_estimate_annual')::numeric, v_row ->> 'social_security_estimate_source', (v_row ->> 'life_span_low')::int, (v_row ->> 'life_span_high')::int, coalesce(v_row -> 'states', '{}'::jsonb), now())
    on conflict (workspace_id) do update set
      current_age = excluded.current_age, target_retirement_age = excluded.target_retirement_age, annual_retirement_spending = excluded.annual_retirement_spending,
      retirement_assets_total = excluded.retirement_assets_total, retirement_assets_as_of = excluded.retirement_assets_as_of, annual_contributions = excluded.annual_contributions,
      expected_pension_annual = excluded.expected_pension_annual, social_security_estimate_annual = excluded.social_security_estimate_annual,
      social_security_estimate_source = excluded.social_security_estimate_source, life_span_low = excluded.life_span_low, life_span_high = excluded.life_span_high,
      states = excluded.states, updated_at = now();
    v_updated := v_updated + 1;
    perform app.workspace_append_event(p_workspace, 'RETIREMENT_UPDATED', 'retirement_intake', p_workspace, 'retirement intake updated', v_row -> 'states');
    v_events := v_events + 1;
  end if;

  -- updates: allow-listed table and columns; must hit exactly one row of THIS workspace
  for v_item in select * from jsonb_array_elements(coalesce(p_plan -> 'updates', '[]'::jsonb)) loop
    v_table := v_item ->> 'table';
    v_id := (v_item ->> 'id')::uuid;
    v_row := v_item -> 'row';
    v_cols := app.personal_table_columns(v_table, true);
    if v_cols is null then raise exception 'VALIDATION: unknown table %', v_table using errcode = 'P0001'; end if;
    select array_agg(k) into v_keys from jsonb_object_keys(v_row) k where k = any (v_cols) and k not in ('id', 'workspace_id');
    if v_keys is null or cardinality(v_keys) = 0 then raise exception 'VALIDATION: no updatable columns for %', v_table using errcode = 'P0001'; end if;
    if v_table in ('personal_record_revisions', 'personal_calc_runs', 'user_decisions') then raise exception 'IMMUTABLE: % is append-only', v_table using errcode = '42501'; end if;
    execute format('update app.%I t set (%s) = (select %s from jsonb_populate_record(null::app.%I, $1)) where t.id = $2 and t.workspace_id = $3',
                   v_table, (select string_agg(quote_ident(k), ', ') from unnest(v_keys) k), (select string_agg(quote_ident(k), ', ') from unnest(v_keys) k), v_table)
      using v_row, v_id, p_workspace;
    get diagnostics v_n = row_count;
    if v_n <> 1 then raise exception 'NOT_FOUND: % % is not in this workspace', v_table, v_id using errcode = 'P0002'; end if;
    v_updated := v_updated + 1;
    if v_table = 'personal_snapshots' then
      perform app.workspace_append_event(p_workspace, 'SNAPSHOT_SUPERSEDED', 'personal_snapshot', v_id, 'snapshot superseded', jsonb_build_object('status', v_row ->> 'status'));
      v_events := v_events + 1;
    end if;
  end loop;

  -- inserts: allow-listed columns; workspace and actor columns forced
  for v_item in select * from jsonb_array_elements(coalesce(p_plan -> 'inserts', '[]'::jsonb)) loop
    v_table := v_item ->> 'table';
    v_cols := app.personal_table_columns(v_table, false);
    if v_cols is null then raise exception 'VALIDATION: unknown table %', v_table using errcode = 'P0001'; end if;
    for v_row in select * from jsonb_array_elements(coalesce(v_item -> 'rows', '[]'::jsonb)) loop
      v_row := v_row || jsonb_build_object('workspace_id', p_workspace);
      if v_table = 'personal_record_revisions' then v_row := v_row || jsonb_build_object('changed_by', v_uid); end if;
      if v_table = 'personal_snapshots' then v_row := v_row || jsonb_build_object('created_by', v_uid); end if;
      if v_table = 'user_decisions' then v_row := v_row || jsonb_build_object('principal_id', v_uid); end if;
      select array_agg(k) into v_keys from jsonb_object_keys(v_row) k where k = any (v_cols);
      execute format('insert into app.%I (%s) select %s from jsonb_populate_record(null::app.%I, $1)',
                     v_table, (select string_agg(quote_ident(k), ', ') from unnest(v_keys) k), (select string_agg(quote_ident(k), ', ') from unnest(v_keys) k), v_table)
        using v_row;
      v_inserted := v_inserted + 1;
      -- one event per logical change
      if v_table = 'personal_record_revisions' then
        v_change := v_row ->> 'change';
        perform app.workspace_append_event(p_workspace, case v_change when 'CREATE' then 'RECORD_CREATED' when 'RETIRE' then 'RECORD_RETIRED' else 'RECORD_UPDATED' end,
                                           lower(v_row ->> 'record_type'), (v_row ->> 'record_ref')::uuid, format('%s %s revision %s', lower(v_change), lower(v_row ->> 'record_type'), v_row ->> 'revision'),
                                           jsonb_build_object('record_type', v_row ->> 'record_type', 'revision', v_row -> 'revision'));
        v_events := v_events + 1;
      elsif v_table = 'personal_snapshots' then
        perform app.workspace_append_event(p_workspace, 'SNAPSHOT_CREATED', 'personal_snapshot', (v_row ->> 'id')::uuid, format('snapshot revision %s as of %s', v_row ->> 'revision', v_row ->> 'as_of_date'), jsonb_build_object('content_sha256', v_row ->> 'content_sha256', 'revision', v_row -> 'revision'));
        v_events := v_events + 1;
      elsif v_table = 'personal_calc_runs' then
        perform app.workspace_append_event(p_workspace, 'CALC_RUN_RECORDED', 'personal_calc_run', (v_row ->> 'id')::uuid, format('%s %s', lower(v_row ->> 'check_type'), lower(v_row ->> 'run_status')),
                                           jsonb_build_object('check_type', v_row ->> 'check_type', 'run_status', v_row ->> 'run_status', 'request_sha256', v_row ->> 'request_sha256', 'snapshot_id', v_row ->> 'snapshot_id'));
        v_events := v_events + 1;
      elsif v_table = 'user_decisions' then
        perform app.workspace_append_event(p_workspace, 'DECISION_RECORDED', 'user_decision', (v_row ->> 'id')::uuid, format('%s on %s', lower(v_row ->> 'decision'), v_row ->> 'recommendation_id'), jsonb_build_object('decision', v_row ->> 'decision'));
        v_events := v_events + 1;
      end if;
    end loop;
  end loop;

  return jsonb_build_object('inserted', v_inserted, 'updated', v_updated, 'events', v_events);
end $$;

-- ---------------------------------------------------------------------------------------------
-- 5. create_personal_workspace: also seed an all-MISSING retirement intake (replaces the 0008 body).
-- ---------------------------------------------------------------------------------------------
create or replace function app.create_personal_workspace(p_kind app.workspace_kind, p_label text, p_display_name text, p_household_size int, p_cash_floor numeric, p_buffer_target_months numeric default null, p_situation text default '', p_top_concern text default null) returns uuid
language plpgsql security definer set search_path = app, public, extensions as $$
declare v_uid uuid; v_ws uuid := gen_random_uuid();
begin
  if p_kind = 'FIRM' then raise exception 'INVALID_ARGUMENT: firm workspaces derive from organizations' using errcode = 'P0001'; end if;
  if p_kind = 'HOUSEHOLD' and coalesce(p_household_size, 1) < 2 then raise exception 'VALIDATION: a household workspace needs at least two people' using errcode = 'P0001'; end if;
  if p_cash_floor is null or p_cash_floor < 0 then raise exception 'VALIDATION: cash_floor is required and cannot be negative' using errcode = 'P0001'; end if;
  v_uid := app.require_principal(p_display_name);
  insert into app.workspaces (id, kind, label, owner_principal_id) values (v_ws, p_kind, left(coalesce(nullif(trim(p_label), ''), 'My finances'), 120), v_uid);
  perform set_config('app.workspace_fn', '1', true);
  insert into app.workspace_memberships (workspace_id, principal_id, role, domains, status) values (v_ws, v_uid, 'OWNER', '{}', 'ACTIVE');
  perform set_config('app.workspace_fn', '', true);
  insert into app.personal_profiles (workspace_id, principal_id, household_size, situation, top_concern, cash_floor, buffer_target_months)
  values (v_ws, v_uid, coalesce(p_household_size, 1), left(coalesce(p_situation, ''), 240), left(p_top_concern, 240), p_cash_floor, p_buffer_target_months);
  insert into app.retirement_intakes (workspace_id, states) values (v_ws, '{"current_age":"MISSING","target_retirement_age":"MISSING","annual_retirement_spending":"MISSING","retirement_assets_total":"MISSING","annual_contributions":"MISSING","expected_pension_annual":"MISSING","social_security_estimate_annual":"MISSING"}'::jsonb);
  perform app.workspace_append_event(v_ws, 'WORKSPACE_CREATED', 'workspace', v_ws, format('%s workspace created', lower(p_kind::text)), jsonb_build_object('kind', p_kind::text));
  return v_ws;
end $$;
-- Backfill intakes for workspaces created under 0008.
insert into app.retirement_intakes (workspace_id, states)
select w.id, '{"current_age":"MISSING","target_retirement_age":"MISSING","annual_retirement_spending":"MISSING","retirement_assets_total":"MISSING","annual_contributions":"MISSING","expected_pension_annual":"MISSING","social_security_estimate_annual":"MISSING"}'::jsonb
from app.workspaces w where w.kind <> 'FIRM' on conflict (workspace_id) do nothing;

-- ---------------------------------------------------------------------------------------------
-- 6. Grants (N-04): tables, then the full function inventory re-asserted.
-- ---------------------------------------------------------------------------------------------
grant select on app.personal_snapshots, app.personal_calc_runs, app.user_decisions, app.retirement_intakes to authenticated;
grant all on app.personal_snapshots, app.personal_calc_runs, app.user_decisions, app.retirement_intakes to service_role;
-- DATA-001 wrote records over PostgREST; from 0009 every personal write goes through apply_personal_changes.
revoke insert, update on app.cash_accounts, app.income_streams, app.liabilities, app.recurring_obligations, app.variable_spending, app.savings_goals, app.personal_profiles, app.personal_record_revisions from authenticated;

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
  app.policy_record(jsonb), app.latest_check_runs(uuid), app.coverage_summary(uuid),
  app.is_workspace_owner(uuid), app.is_workspace_member(uuid), app.can_read_workspace_domain(uuid, app.share_domain), app.my_workspace_access(uuid), app.require_principal(text),
  app.create_personal_workspace(app.workspace_kind, text, text, int, numeric, numeric, text, text),
  app.invite_participant(uuid, uuid, app.workspace_role, app.share_domain[]), app.accept_invitation(uuid), app.revoke_membership(uuid),
  app.grant_consent(uuid, uuid, uuid, app.share_domain[], app.consent_purpose, timestamptz, text), app.revoke_consent(uuid),
  app.can_read_personal_runs(uuid), app.apply_personal_changes(uuid, jsonb)
  to authenticated, service_role;
