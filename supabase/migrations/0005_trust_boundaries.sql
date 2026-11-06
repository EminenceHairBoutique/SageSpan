-- PR-001: trust-boundary hardening (audit findings S-01, S-02, S-03, S-04, S-05, N-01, N-03, N-04, N-05).
--
-- Principles enforced here, independently of each other:
--   * Postgres privileges: no PUBLIC EXECUTE on app functions; internal helpers are not executable by
--     authenticated; table grants are column-scoped where the workflow owns a column.
--   * Triggers: workflow-owned columns and immutable rows reject changes unless the transaction-local
--     sentinel `app.workflow_fn = '1'` was set by a workflow function.
--   * Functions: every entry point derives org_id from the entity, asserts membership and role on
--     entry, validates state in the same transaction, and never trusts caller-supplied actor, org,
--     hash or payload claims.
--   * The audit chain is sequenced per organisation under an advisory lock (no forks).
-- Forward-only; 0001-0004 are not edited. Synthetic data only; pre-existing audit rows are re-chained
-- (this repository has never held production data).

-- =============================================================================================
-- 0. Row-level security mode: ENABLE for all roles, no FORCE for the table owner.
--    SECURITY DEFINER workflow functions run as the owner (postgres); FORCE would subject the trusted
--    path to policies written for end users (and break on Supabase, where postgres is not a superuser).
--    authenticated / anon remain fully governed by RLS. service_role has BYPASSRLS by design.
-- =============================================================================================
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'app' loop
    execute format('alter table app.%I no force row level security', t);
  end loop;
end $$;

-- =============================================================================================
-- 1. Privileges (N-04, S-01, S-02): revoke PUBLIC, then grant explicitly.
-- =============================================================================================
revoke execute on all functions in schema app from public;
alter default privileges in schema app revoke execute on functions from public;
revoke execute on all functions in schema app from anon, authenticated, service_role;

-- RLS helper functions answer questions about the caller's own memberships only; policies need them.
grant execute on function app.current_user_id(), app.member_orgs(), app.is_member(uuid), app.has_role(uuid, app.role[]), app.current_role_in(uuid)
  to authenticated, service_role;
grant execute on function app.can_transition(app.workflow_status, app.workflow_status) to authenticated, service_role;
-- app.transition_household, app.assert_role and app.append_audit stay internal (see below for append_audit's service path).

-- =============================================================================================
-- 2. Households (S-01c): column-scoped UPDATE + workflow guard trigger.
-- =============================================================================================
revoke update on app.households from authenticated;
grant update (label, status, assignee_user_id, source_tool_label) on app.households to authenticated;

create or replace function app.households_workflow_guard() returns trigger
language plpgsql as $$
begin
  if (new.workflow_status is distinct from old.workflow_status
      or new.current_revision is distinct from old.current_revision
      or new.tax_year is distinct from old.tax_year
      or new.org_id is distinct from old.org_id
      or new.id is distinct from old.id)
     and coalesce(current_setting('app.workflow_fn', true), '') <> '1' then
    raise exception 'WORKFLOW_GUARD: workflow_status, current_revision, tax_year and identity change only inside app workflow functions' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists households_workflow_guard on app.households;
create trigger households_workflow_guard before update on app.households for each row execute function app.households_workflow_guard();

create or replace function app.transition_household(p_household uuid, p_to app.workflow_status) returns void
language plpgsql security definer set search_path = app, public as $$
declare v_from app.workflow_status;
begin
  select workflow_status into v_from from app.households where id = p_household for update;
  if v_from is null then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  if not app.can_transition(v_from, p_to) then
    raise exception 'INVALID_TRANSITION % -> %', v_from, p_to using errcode = 'P0001';
  end if;
  perform set_config('app.workflow_fn', '1', true);
  update app.households set workflow_status = p_to, updated_at = now() where id = p_household;
  perform set_config('app.workflow_fn', '', true);
end $$;

-- =============================================================================================
-- 3. Audit chain (S-02, N-03): internal, actor derived, event types allow-listed, sequenced heads.
-- =============================================================================================
create table app.audit_chain_heads (
  org_id uuid primary key references app.organizations (id) on delete cascade,
  last_seq bigint not null default 0 check (last_seq >= 0),
  last_hash char(64) null check (last_hash is null or last_hash ~ '^[0-9a-f]{64}$')
);
alter table app.audit_chain_heads enable row level security;
create policy audit_chain_heads_select on app.audit_chain_heads for select to authenticated using (app.is_member(org_id));
grant select on app.audit_chain_heads to authenticated;
grant all on app.audit_chain_heads to service_role;

alter table app.audit_events add column seq bigint;

-- Event types mirror packages/contracts/src/enums.ts AUDIT_EVENT_TYPES (keep in sync; tested).
alter table app.audit_events add constraint audit_events_event_type_allowed check (event_type in (
  'IMPORT_CREATED', 'IMPORT_MAPPED', 'IMPORT_RECONCILED', 'FACT_CONFIRMED', 'ASSUMPTION_RECORDED', 'CONFLICT_RESOLVED',
  'EXCEPTION_DOCUMENTED', 'SNAPSHOT_FROZEN', 'CHECK_RUN_COMPLETED', 'CHECK_RUN_FAILED', 'SENT_TO_REVIEW', 'REVIEW_COMMENT_ADDED',
  'DISCREPANCY_DISPOSITIONED', 'REVIEW_RECORDED', 'APPROVAL_RECORDED', 'APPROVAL_DENIED', 'PACKET_GENERATED', 'PACKET_EXPORTED',
  'ASSIGNEE_CHANGED', 'POLICY_UPDATED', 'DEMO_RESET')) not valid;

-- The hashed core of an event. seq is included so the chain position itself is covered by the hash.
create or replace function app.audit_core(
  p_seq bigint, p_id uuid, p_org uuid, p_actor uuid, p_role app.role, p_actor_type app.actor_type, p_event_type text,
  p_entity_type text, p_entity_id uuid, p_created timestamptz, p_prev char(64), p_digest char(64)
) returns text language sql immutable as $$
  select concat_ws('|', p_seq::text, p_id::text, p_org::text, coalesce(p_actor::text, ''), coalesce(p_role::text, ''), p_actor_type::text, p_event_type,
                   p_entity_type, coalesce(p_entity_id::text, ''), to_char(p_created at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'), coalesce(p_prev, ''), p_digest);
$$;

-- Re-chain pre-existing rows by (created_at, id) within each organisation. Synthetic/dev rows only.
alter table app.audit_events disable trigger audit_events_immutable;
do $$
declare r record; v_org uuid; v_prev char(64); v_seq bigint := 0; v_hash char(64);
begin
  for r in select * from app.audit_events order by org_id, created_at, id loop
    if v_org is distinct from r.org_id then v_org := r.org_id; v_prev := null; v_seq := 0; end if;
    v_seq := v_seq + 1;
    v_hash := encode(extensions.digest(app.audit_core(v_seq, r.id, r.org_id, r.actor_user_id, r.actor_role, r.actor_type, r.event_type, r.entity_type, r.entity_id, r.created_at, v_prev, r.payload_digest), 'sha256'), 'hex');
    update app.audit_events set seq = v_seq, previous_event_hash = v_prev, event_hash = v_hash where id = r.id;
    v_prev := v_hash;
  end loop;
end $$;
alter table app.audit_events enable trigger audit_events_immutable;
alter table app.audit_events alter column seq set not null;
alter table app.audit_events add constraint audit_events_seq_positive check (seq > 0);
alter table app.audit_events add constraint audit_events_org_seq_unique unique (org_id, seq);
alter table app.audit_events add constraint audit_events_org_prev_unique unique (org_id, previous_event_hash);
alter table app.audit_events validate constraint audit_events_event_type_allowed;
insert into app.audit_chain_heads (org_id, last_seq, last_hash)
  select org_id, max(seq), (array_agg(event_hash order by seq desc))[1] from app.audit_events group by org_id
  on conflict (org_id) do update set last_seq = excluded.last_seq, last_hash = excluded.last_hash;

-- JWT role claim (PostgREST sets request.jwt.claims); empty when there is no request context.
create or replace function app.request_role() returns text
language sql stable as $$
  select nullif(coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  ), '');
$$;

-- True for maintenance sessions (database owner / superuser) that carry no end-user JWT.
create or replace function app.is_privileged_session() returns boolean
language sql stable as $$
  select session_user in ('postgres', 'supabase_admin')
      or exists (select 1 from pg_roles where rolname = session_user and (rolsuper or rolbypassrls));
$$;

-- Membership assertion for read-style entry points (any active role).
create or replace function app.assert_member(p_org uuid) returns void
language plpgsql security definer set search_path = app, public as $$
begin
  if auth.uid() is not null then
    if not app.is_member(p_org) then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  elsif not (app.request_role() = 'service_role' or (app.request_role() is null and app.is_privileged_session())) then
    raise exception 'PERMISSION_DENIED: no authenticated member and no service context' using errcode = '42501';
  end if;
end $$;

drop function if exists app.append_audit(uuid, text, text, uuid, text, jsonb, app.actor_type);
create function app.append_audit(p_org uuid, p_event_type text, p_entity_type text, p_entity_id uuid, p_summary text, p_payload jsonb default '{}'::jsonb) returns uuid
language plpgsql security definer set search_path = app, public, extensions as $$
declare
  v_uid uuid := auth.uid();
  v_role app.role;
  v_actor app.actor_type;
  v_jwt_role text := app.request_role();
  v_seq bigint;
  v_prev char(64);
  v_id uuid := gen_random_uuid();
  v_created timestamptz := now();
  v_digest char(64) := encode(extensions.digest(app.canonical_json(coalesce(p_payload, '{}'::jsonb)), 'sha256'), 'hex');
  v_hash char(64);
  v_request text := coalesce(current_setting('request.id', true), 'req_' || replace(gen_random_uuid()::text, '-', ''));
begin
  if not exists (select 1 from app.organizations where id = p_org) then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  -- Actor type is derived, never accepted from the caller.
  if v_uid is not null then
    v_role := app.current_role_in(p_org);
    if v_role is null then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
    v_actor := 'USER';
  elsif v_jwt_role = 'service_role' or (v_jwt_role is null and app.is_privileged_session()) then
    v_actor := 'SYSTEM';
  else
    raise exception 'PERMISSION_DENIED: audit append requires an authenticated member or a service context' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtext('audit:' || p_org::text));
  insert into app.audit_chain_heads (org_id) values (p_org) on conflict (org_id) do nothing;
  select last_seq, last_hash into v_seq, v_prev from app.audit_chain_heads where org_id = p_org for update;
  v_seq := v_seq + 1;
  v_hash := encode(extensions.digest(app.audit_core(v_seq, v_id, p_org, v_uid, v_role, v_actor, p_event_type, p_entity_type, p_entity_id, v_created, v_prev, v_digest), 'sha256'), 'hex');
  insert into app.audit_events (id, org_id, actor_user_id, actor_role, actor_type, event_type, entity_type, entity_id, created_at, previous_event_hash, event_hash, payload_digest, request_id, summary, seq)
  values (v_id, p_org, v_uid, v_role, v_actor, p_event_type, p_entity_type, p_entity_id, v_created, v_prev, v_hash, v_digest, v_request, left(p_summary, 500), v_seq);
  update app.audit_chain_heads set last_seq = v_seq, last_hash = v_hash where org_id = p_org;
  return v_id;
end $$;
-- Service paths may append SYSTEM events; end users never call this directly (workflow functions do, as owner).
grant execute on function app.append_audit(uuid, text, text, uuid, text, jsonb) to service_role;

create or replace function app.verify_audit_chain(p_org uuid) returns table (intact boolean, broken_at uuid, count bigint)
language plpgsql security definer set search_path = app, public, extensions as $$
declare r record; v_prev char(64) := null; v_expect bigint := 0; v_hash char(64); v_count bigint := 0; v_head record;
begin
  perform app.assert_member(p_org);
  for r in select * from app.audit_events where org_id = p_org order by seq loop
    v_count := v_count + 1;
    v_expect := v_expect + 1;
    v_hash := encode(extensions.digest(app.audit_core(r.seq, r.id, r.org_id, r.actor_user_id, r.actor_role, r.actor_type, r.event_type, r.entity_type, r.entity_id, r.created_at, v_prev, r.payload_digest), 'sha256'), 'hex');
    if r.seq <> v_expect or r.previous_event_hash is distinct from v_prev or r.event_hash <> v_hash then
      return query select false, r.id, v_count; return;
    end if;
    v_prev := r.event_hash;
  end loop;
  select last_seq, last_hash into v_head from app.audit_chain_heads where org_id = p_org;
  if v_head is not null and (v_head.last_seq <> v_count or v_head.last_hash is distinct from v_prev) then
    return query select false, null::uuid, v_count; return;
  end if;
  return query select true, null::uuid, v_count;
end $$;

-- =============================================================================================
-- 4. Canonical JSON (S-03): byte-compatible with contracts/src/canonical.ts and app/financial/canonical.py
--    (sorted keys in byte order, no whitespace, strings JSON-escaped; integers round-trip, decimals are strings).
-- =============================================================================================
create or replace function app.canonical_json(p jsonb) returns text
language plpgsql stable strict as $$
declare t text := jsonb_typeof(p); parts text[];
begin
  if t = 'object' then
    select coalesce(array_agg(to_json(key)::text || ':' || app.canonical_json(value) order by key collate "C"), '{}'::text[]) into parts from jsonb_each(p);
    return '{' || array_to_string(parts, ',') || '}';
  elsif t = 'array' then
    select coalesce(array_agg(app.canonical_json(value) order by ordinality), '{}'::text[]) into parts from jsonb_array_elements(p) with ordinality;
    return '[' || array_to_string(parts, ',') || ']';
  elsif t = 'string' then
    return to_json(p #>> '{}')::text;
  else
    return p::text; -- number, boolean, null
  end if;
end $$;

create or replace function app.sha256_canonical(p jsonb) returns char(64)
language sql stable strict set search_path = app, public, extensions as $$
  select encode(extensions.digest(app.canonical_json(p), 'sha256'), 'hex')::char(64);
$$;

-- Required facts for the supported RMD check (mirrors packages/contracts/src/facts.ts REQUIRED_FACT_KEYS_RMD).
create or replace function app.rmd_required_facts(p_household uuid, p_tax_year int)
returns table (subject_type app.subject_type, subject_id uuid, field_key text, assumption_allowed boolean, required_as_of date)
language sql stable set search_path = app, public as $$
  with accts as (
    select a.id as account_id from app.accounts a where a.household_id = p_household and a.account_type in ('TRADITIONAL_IRA', 'SEP_IRA', 'SIMPLE_IRA')
  ),
  owners as (
    select o.account_id, o.person_id from app.account_ownership o join accts on accts.account_id = o.account_id where o.effective_to is null
  ),
  spouses as (
    select d.account_id, d.beneficiary_person_id as person_id from app.beneficiary_designations d join accts on accts.account_id = d.account_id
    where d.designation_type = 'PRIMARY' and d.relationship = 'SPOUSE' and d.sole_primary_entire_year = true and d.effective_to is null and d.beneficiary_person_id is not null
  )
  select 'ACCOUNT'::app.subject_type, account_id, 'account.account_type', false, null::date from accts
  union all select 'ACCOUNT', account_id, 'account.is_inherited', false, null from accts
  union all select 'ACCOUNT', account_id, 'account.year_end_balance', false, make_date(p_tax_year - 1, 12, 31) from accts
  union all select 'ACCOUNT', account_id, 'beneficiary.primary.spouse_sole_entire_year', false, null from accts
  union all select 'PERSON', person_id, 'person.birth_date', false, null from owners
  union all select 'PERSON', person_id, 'person.is_alive', true, null from owners
  union all select 'PERSON', person_id, 'person.birth_date', false, null from spouses;
$$;

-- Snapshot payload built from the organisation's own rows (same shape as the web tier's buildSnapshotPayload).
create or replace function app.build_snapshot_payload(p_household uuid) returns jsonb
language plpgsql security definer set search_path = app, public as $$
declare v_org uuid; v_tax_year int; v_rev int;
begin
  select org_id, tax_year into v_org, v_tax_year from app.households where id = p_household;
  if v_org is null then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  perform app.assert_member(v_org);
  select coalesce(max(revision), 0) + 1 into v_rev from app.snapshots where household_id = p_household;
  return jsonb_build_object(
    'snapshot_version', 'sagespan.snapshot.v1',
    'household_id', p_household::text,
    'tax_year', v_tax_year,
    'revision', v_rev,
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

create or replace function app.freeze_snapshot(p_household uuid, p_canonical_payload jsonb, p_content_sha256 text, p_assumption_set uuid default null) returns uuid
language plpgsql security definer set search_path = app, public, extensions as $$
declare
  v_org uuid; v_status app.workflow_status; v_tax_year int; v_role app.role; v_rev int; v_id uuid := gen_random_uuid();
  v_open_material int; v_open_nonmaterial int; v_computed char(64); f jsonb; v_fact app.facts%rowtype; req record; v_ok boolean;
begin
  select org_id, workflow_status, tax_year into v_org, v_status, v_tax_year from app.households where id = p_household for update;
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
  if p_canonical_payload ->> 'snapshot_version' is distinct from 'sagespan.snapshot.v1' then raise exception 'SNAPSHOT_PAYLOAD_INVALID: snapshot_version' using errcode = 'P0001'; end if;
  if p_canonical_payload ->> 'household_id' is distinct from p_household::text then raise exception 'SNAPSHOT_PAYLOAD_INVALID: household_id' using errcode = 'P0001'; end if;
  if (p_canonical_payload ->> 'tax_year') is distinct from v_tax_year::text then raise exception 'SNAPSHOT_PAYLOAD_INVALID: tax_year' using errcode = 'P0001'; end if;
  if (p_canonical_payload ->> 'revision') is distinct from v_rev::text then raise exception 'SNAPSHOT_PAYLOAD_INVALID: revision (expected %)', v_rev using errcode = 'P0001'; end if;
  if jsonb_typeof(p_canonical_payload -> 'facts') is distinct from 'array' then raise exception 'SNAPSHOT_PAYLOAD_INVALID: facts' using errcode = 'P0001'; end if;

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
  perform app.append_audit(v_org, 'SNAPSHOT_FROZEN', 'snapshot', v_id, format('Snapshot %s (revision %s) frozen for household %s', v_id, v_rev, p_household), jsonb_build_object('content_sha256', p_content_sha256, 'revision', v_rev));
  return v_id;
end $$;

-- =============================================================================================
-- 5. Facts (S-05a/b): no direct UPDATE; confirmation through app.confirm_fact; guarded supersession.
-- =============================================================================================
revoke update on app.facts from authenticated;
drop policy if exists facts_update on app.facts;

create or replace function app.facts_guard_update() returns trigger
language plpgsql as $$
declare in_wf boolean := coalesce(current_setting('app.workflow_fn', true), '') = '1';
begin
  if new.value_number is distinct from old.value_number or new.value_text is distinct from old.value_text or new.value_date is distinct from old.value_date
     or new.value_bool is distinct from old.value_bool or new.as_of_date is distinct from old.as_of_date or new.source_document_id is distinct from old.source_document_id
     or new.source_location_id is distinct from old.source_location_id or new.field_key is distinct from old.field_key or new.subject_id is distinct from old.subject_id
     or new.subject_type is distinct from old.subject_type or new.org_id is distinct from old.org_id or new.household_id is distinct from old.household_id
     or new.revision is distinct from old.revision or new.supersedes_fact_id is distinct from old.supersedes_fact_id or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at or new.id is distinct from old.id then
    raise exception 'IMMUTABLE: fact values and provenance cannot change; create a new revision' using errcode = '42501';
  end if;
  if new.superseded is distinct from old.superseded and not (old.superseded = false and new.superseded = true) then
    raise exception 'IMMUTABLE: superseded may only change from false to true' using errcode = '42501';
  end if;
  if (new.verification_status is distinct from old.verification_status or new.note is distinct from old.note or new.assumption_id is distinct from old.assumption_id) and not in_wf then
    raise exception 'WORKFLOW_GUARD: verification_status changes only inside app workflow functions' using errcode = '42501';
  end if;
  return new;
end $$;

create or replace function app.confirm_fact(p_fact uuid, p_rationale text, p_evidence_ref text) returns uuid
language plpgsql security definer set search_path = app, public as $$
declare v_org uuid; v_household uuid; v_status app.fact_status; v_superseded boolean; v_role app.role; v_new uuid := gen_random_uuid(); v_hstatus app.workflow_status;
begin
  select org_id, household_id, verification_status, superseded into v_org, v_household, v_status, v_superseded from app.facts where id = p_fact;
  if v_org is null then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  v_role := app.assert_role(v_org, array['COMPLIANCE', 'ADVISOR']::app.role[], 'confirm facts');
  if v_superseded or v_status <> 'NEEDS_CONFIRMATION' then raise exception 'INVALID_STATE: only active NEEDS_CONFIRMATION facts can be confirmed' using errcode = 'P0001'; end if;
  if length(coalesce(p_rationale, '')) < 10 then raise exception 'RATIONALE_REQUIRED' using errcode = 'P0001'; end if;
  if length(coalesce(p_evidence_ref, '')) < 3 then raise exception 'EVIDENCE_REFERENCE_REQUIRED' using errcode = 'P0001'; end if;
  insert into app.facts (id, org_id, household_id, subject_type, subject_id, field_key, value_kind, value_number, value_text, value_date, value_bool, value_currency, unit, as_of_date, effective_from, effective_to, source_document_id, source_location_id, verification_status, revision, supersedes_fact_id, superseded, assumption_id, note, created_by)
  select v_new, org_id, household_id, subject_type, subject_id, field_key, value_kind, value_number, value_text, value_date, value_bool, value_currency, unit, as_of_date, effective_from, effective_to, source_document_id, source_location_id, 'FACT_CONFIRMED', revision + 1, id, false, assumption_id,
         left(format('Manually confirmed by %s: %s [evidence: %s]', v_role, p_rationale, p_evidence_ref), 1000), auth.uid()
  from app.facts where id = p_fact;
  update app.facts set superseded = true where id = p_fact;
  select workflow_status into v_hstatus from app.households where id = v_household;
  if v_hstatus in ('FROZEN', 'CHECK_COMPLETE', 'REVIEW_PENDING', 'REVIEWED', 'APPROVED', 'EXPORTED', 'BLOCKED', 'READY_TO_FREEZE') then
    perform app.transition_household(v_household, 'RECONCILIATION_PENDING');
  end if;
  perform app.append_audit(v_org, 'FACT_CONFIRMED', 'fact', v_new, format('Fact %s manually confirmed as revision of %s with evidence reference', v_new, p_fact));
  return v_new;
end $$;

-- resolve_conflict and document_exception: assert role immediately after locating the entity (unchanged otherwise).
create or replace function app.resolve_conflict(p_conflict uuid, p_chosen_fact uuid, p_rationale text) returns uuid
language plpgsql security definer set search_path = app, public as $$
declare
  v_org uuid; v_household uuid; v_status app.conflict_status; v_materiality app.materiality; v_role app.role;
  v_kind app.source_kind; v_new uuid := gen_random_uuid(); v_rev int; v_hstatus app.workflow_status;
begin
  select org_id, household_id, status, materiality into v_org, v_household, v_status, v_materiality from app.fact_conflicts where id = p_conflict for update;
  if v_org is null then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  v_role := app.assert_role(v_org, array['COMPLIANCE', 'ADVISOR', 'ANALYST']::app.role[], 'resolve conflicts');
  if v_status <> 'OPEN' then raise exception 'INVALID_STATE: conflict is %', v_status using errcode = 'P0001'; end if;
  if length(coalesce(p_rationale, '')) < 10 then raise exception 'RATIONALE_REQUIRED' using errcode = 'P0001'; end if;
  if not exists (select 1 from app.conflict_fact_links where conflict_id = p_conflict and fact_id = p_chosen_fact) then
    raise exception 'INVALID_CHOICE' using errcode = 'P0001';
  end if;
  select d.source_kind into v_kind from app.facts f left join app.source_documents d on d.id = f.source_document_id where f.id = p_chosen_fact;
  if v_materiality = 'MATERIAL' and v_role <> 'COMPLIANCE' and (v_kind is null or v_kind not in ('CUSTODIAN_STATEMENT', 'CUSTODIAN_PROFILE', 'BENEFICIARY_FORM')) then
    raise exception 'PRIMARY_EVIDENCE_REQUIRED' using errcode = 'P0001';
  end if;
  select max(f.revision) + 1 into v_rev from app.facts f join app.conflict_fact_links l on l.fact_id = f.id where l.conflict_id = p_conflict;
  insert into app.facts (id, org_id, household_id, subject_type, subject_id, field_key, value_kind, value_number, value_text, value_date, value_bool, value_currency, unit, as_of_date, effective_from, effective_to, source_document_id, source_location_id, verification_status, revision, supersedes_fact_id, superseded, assumption_id, note, created_by)
  select v_new, org_id, household_id, subject_type, subject_id, field_key, value_kind, value_number, value_text, value_date, value_bool, value_currency, unit, as_of_date, effective_from, effective_to, source_document_id, source_location_id, 'FACT_CONFIRMED', v_rev, id, false, assumption_id, left('Resolved conflict ' || p_conflict::text || ': ' || p_rationale, 1000), auth.uid()
  from app.facts where id = p_chosen_fact;
  update app.facts set superseded = true where id in (select fact_id from app.conflict_fact_links where conflict_id = p_conflict);
  update app.fact_conflicts set status = 'RESOLVED', chosen_fact_id = v_new, resolution_note = p_rationale, resolved_by = auth.uid(), resolved_at = now() where id = p_conflict;
  select workflow_status into v_hstatus from app.households where id = v_household;
  if v_hstatus in ('FROZEN', 'CHECK_COMPLETE', 'REVIEW_PENDING', 'REVIEWED', 'APPROVED', 'EXPORTED', 'BLOCKED', 'READY_TO_FREEZE') then
    perform app.transition_household(v_household, 'RECONCILIATION_PENDING');
  end if;
  perform app.append_audit(v_org, 'CONFLICT_RESOLVED', 'fact_conflict', p_conflict, format('Conflict %s resolved; fact %s (revision %s) governs', p_conflict, v_new, v_rev), jsonb_build_object('chosen_fact_id', v_new));
  return v_new;
end $$;

create or replace function app.document_exception(p_conflict uuid, p_rationale text) returns void
language plpgsql security definer set search_path = app, public as $$
declare v_org uuid; v_household uuid; v_status app.conflict_status; v_materiality app.materiality; v_allowed boolean;
begin
  select org_id, household_id, status, materiality into v_org, v_household, v_status, v_materiality from app.fact_conflicts where id = p_conflict for update;
  if v_org is null then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  perform app.assert_role(v_org, array['COMPLIANCE']::app.role[], 'document exceptions');
  if v_status <> 'OPEN' then raise exception 'INVALID_STATE' using errcode = 'P0001'; end if;
  if v_materiality <> 'NONMATERIAL' then raise exception 'EXCEPTION_NOT_ALLOWED: material conflicts must be resolved' using errcode = 'P0001'; end if;
  select (policies->>'allow_nonmaterial_exceptions')::boolean into v_allowed from app.organizations where id = v_org;
  if not coalesce(v_allowed, false) then raise exception 'EXCEPTION_NOT_ALLOWED: firm policy' using errcode = 'P0001'; end if;
  if length(coalesce(p_rationale, '')) < 10 then raise exception 'RATIONALE_REQUIRED' using errcode = 'P0001'; end if;
  update app.fact_conflicts set status = 'EXCEPTION_DOCUMENTED', resolution_note = p_rationale, resolved_by = auth.uid(), resolved_at = now() where id = p_conflict;
  perform app.append_audit(v_org, 'EXCEPTION_DOCUMENTED', 'fact_conflict', p_conflict, format('Nonmaterial conflict %s carried by documented exception', p_conflict));
end $$;

-- =============================================================================================
-- 6. Rule registry definition + check runs (S-04 in SQL, S-05c).
-- =============================================================================================
alter table app.rule_sets add column if not exists definition jsonb;
create or replace function app.rule_sets_checksum_guard() returns trigger
language plpgsql as $$
begin
  if new.definition is not null and new.checksum <> app.sha256_canonical(new.definition) then
    raise exception 'RULE_SET_CHECKSUM_MISMATCH: checksum must equal sha256(canonical_json(definition))' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists rule_sets_checksum_guard on app.rule_sets;
create trigger rule_sets_checksum_guard before insert or update on app.rule_sets for each row execute function app.rule_sets_checksum_guard();

revoke insert on app.check_runs from authenticated;
drop policy if exists check_runs_insert on app.check_runs;
revoke insert, update on app.discrepancies from authenticated;
drop policy if exists discrepancies_insert on app.discrepancies;
drop policy if exists discrepancies_disposition on app.discrepancies;

create or replace function app.record_check_run(p_snapshot uuid, p_request jsonb, p_response jsonb) returns uuid
language plpgsql security definer set search_path = app, public, extensions as $$
declare
  v_org uuid; v_household uuid; v_snap_status app.snapshot_status; v_content char(64); v_hstatus app.workflow_status; v_role app.role;
  v_receipt jsonb; v_request_hash char(64); v_fail text; v_result text; v_coverage text; rs jsonb; v_versions jsonb := '{}'::jsonb;
  v_id uuid := gen_random_uuid(); v_disc jsonb; v_ipv uuid; v_ipv_text text;
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
    insert into app.check_runs (id, org_id, snapshot_id, household_id, check_type, engine_name, engine_version, rule_set_versions, request_payload, request_sha256, response, response_sha256, executed_by, run_status, coverage_status, error, request_hash_verified)
    values (v_id, v_org, p_snapshot, v_household, 'RMD_ANNUAL', v_receipt ->> 'engine_name', v_receipt ->> 'engine_version', '{}'::jsonb, p_request, v_request_hash, null, null, auth.uid(), 'ERROR', null,
            jsonb_build_object('code', 'RECEIPT_INTEGRITY_ERROR', 'detail', v_fail), false);
    perform app.append_audit(v_org, 'CHECK_RUN_FAILED', 'check_run', v_id, format('Check run %s rejected: RECEIPT_INTEGRITY_ERROR (%s); no amount was recorded', v_id, v_fail), jsonb_build_object('code', 'RECEIPT_INTEGRITY_ERROR', 'detail', v_fail));
    return v_id;
  end if;

  insert into app.check_runs (id, org_id, snapshot_id, household_id, check_type, engine_name, engine_version, rule_set_versions, request_payload, request_sha256, response, response_sha256, executed_by, run_status, coverage_status, error, request_hash_verified)
  values (v_id, v_org, p_snapshot, v_household, 'RMD_ANNUAL', v_receipt ->> 'engine_name', v_receipt ->> 'engine_version', v_versions, p_request, v_request_hash, p_response, app.sha256_canonical(p_response), auth.uid(),
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
  if v_hstatus = 'FROZEN' then perform app.transition_household(v_household, 'CHECK_COMPLETE'); end if;
  perform app.append_audit(v_org, 'CHECK_RUN_COMPLETED', 'check_run', v_id, format('Check run %s recorded: %s (%s); request hash verified by the database', v_id, v_result, coalesce(v_coverage, 'n/a')), jsonb_build_object('request_hash', v_request_hash, 'run_hash', v_receipt ->> 'run_hash', 'result_status', v_result));
  return v_id;
end $$;

-- =============================================================================================
-- 7. Source documents (S-05e): registration is a service-role server path that computes the digest
--    from stored bytes (Storage wiring is PR-003). Members keep SELECT.
-- =============================================================================================
revoke insert on app.source_documents from authenticated;
drop policy if exists documents_write on app.source_documents;

-- =============================================================================================
-- 8. Discrepancies (N-01): write-once dispositions through app.disposition_discrepancy; immutable amounts.
-- =============================================================================================
create or replace function app.discrepancies_guard() returns trigger
language plpgsql as $$
declare in_wf boolean := coalesce(current_setting('app.workflow_fn', true), '') = '1';
begin
  if tg_op = 'DELETE' then raise exception 'IMMUTABLE: discrepancies cannot be deleted' using errcode = '42501'; end if;
  if new.classification is distinct from old.classification or new.comparable is distinct from old.comparable or new.computed_amount is distinct from old.computed_amount
     or new.imported_amount is distinct from old.imported_amount or new.delta_amount is distinct from old.delta_amount or new.tolerance_applied is distinct from old.tolerance_applied
     or new.check_run_id is distinct from old.check_run_id or new.household_id is distinct from old.household_id or new.org_id is distinct from old.org_id or new.id is distinct from old.id
     or new.imported_plan_value_id is distinct from old.imported_plan_value_id or new.explanation is distinct from old.explanation or new.next_step is distinct from old.next_step then
    raise exception 'IMMUTABLE: discrepancy classification and amounts cannot change' using errcode = '42501';
  end if;
  if old.disposition is not null and (new.disposition is distinct from old.disposition or new.status is distinct from old.status) then
    raise exception 'IMMUTABLE: a recorded disposition is write-once' using errcode = '42501';
  end if;
  if (new.disposition is distinct from old.disposition or new.status is distinct from old.status) then
    if not in_wf then raise exception 'WORKFLOW_GUARD: dispositions are recorded through app.disposition_discrepancy' using errcode = '42501'; end if;
    if not (old.status = 'OPEN' and new.status = 'DISPOSITIONED' and new.disposition is not null) then
      raise exception 'IMMUTABLE: disposition must move OPEN -> DISPOSITIONED exactly once' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists discrepancies_guard on app.discrepancies;
create trigger discrepancies_guard before update or delete on app.discrepancies for each row execute function app.discrepancies_guard();

create or replace function app.disposition_discrepancy(p_discrepancy uuid, p_note text) returns void
language plpgsql security definer set search_path = app, public as $$
declare v_org uuid; v_status app.discrepancy_status; v_hstatus app.workflow_status; v_role app.role;
begin
  select d.org_id, d.status, h.workflow_status into v_org, v_status, v_hstatus from app.discrepancies d join app.households h on h.id = d.household_id where d.id = p_discrepancy for update of d;
  if v_org is null then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  v_role := app.assert_role(v_org, array['COMPLIANCE', 'ADVISOR']::app.role[], 'disposition discrepancies');
  if v_status <> 'OPEN' then raise exception 'ALREADY_DISPOSITIONED' using errcode = 'P0001'; end if;
  if v_hstatus in ('APPROVED', 'EXPORTED') then raise exception 'INVALID_STATE: household is %; dispositions are closed after approval', v_hstatus using errcode = 'P0001'; end if;
  if length(coalesce(p_note, '')) < 10 then raise exception 'RATIONALE_REQUIRED' using errcode = 'P0001'; end if;
  perform set_config('app.workflow_fn', '1', true);
  update app.discrepancies set status = 'DISPOSITIONED', disposition = jsonb_build_object('by', auth.uid(), 'role', v_role, 'at', now(), 'note', p_note) where id = p_discrepancy;
  perform set_config('app.workflow_fn', '', true);
  perform app.append_audit(v_org, 'DISCREPANCY_DISPOSITIONED', 'discrepancy', p_discrepancy, format('Discrepancy %s dispositioned by %s', p_discrepancy, v_role));
end $$;

-- =============================================================================================
-- 9. Reviews (N-05, S-04): approval requires database-verified receipts on every non-ERROR run;
--    approver = capability (COMPLIANCE or ADVISOR) x firm policy approver_roles (default COMPLIANCE only).
-- =============================================================================================
create or replace function app.record_review(p_snapshot uuid, p_decision app.review_decision, p_rationale text, p_attestation boolean default false) returns uuid
language plpgsql security definer set search_path = app, public as $$
declare
  v_org uuid; v_household uuid; v_snap_status app.snapshot_status; v_created_by uuid; v_role app.role; v_hstatus app.workflow_status;
  v_policies jsonb; v_sod boolean; v_approvers text[]; v_open_disc int; v_runs int; v_error_runs int; v_unverified int; v_id uuid := gen_random_uuid();
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
    select count(*), count(*) filter (where run_status = 'ERROR'), count(*) filter (where run_status <> 'ERROR' and request_hash_verified is distinct from true)
      into v_runs, v_error_runs, v_unverified from app.check_runs where snapshot_id = p_snapshot;
    if v_runs = 0 or v_error_runs > 0 then raise exception 'CHECK_REQUIRED' using errcode = 'P0001'; end if;
    if v_unverified > 0 then raise exception 'CHECK_RECEIPT_UNVERIFIED: % run(s) lack a database-verified receipt', v_unverified using errcode = 'P0001'; end if;
    select count(*) into v_open_disc from app.discrepancies d join app.check_runs r on r.id = d.check_run_id where r.snapshot_id = p_snapshot and d.status = 'OPEN';
    if v_open_disc > 0 then raise exception 'OPEN_DISCREPANCIES: %', v_open_disc using errcode = 'P0001'; end if;
    v_sod := coalesce((v_policies ->> 'separation_of_duties')::boolean, true);
    if v_sod and (v_created_by = auth.uid() or exists (select 1 from app.check_runs where snapshot_id = p_snapshot and executed_by = auth.uid())) then
      raise exception 'SEPARATION_OF_DUTIES' using errcode = '42501';
    end if;
    perform app.transition_household(v_household, 'APPROVED');
  else
    perform app.transition_household(v_household, 'REVIEW_PENDING');
  end if;

  insert into app.reviews (id, org_id, snapshot_id, household_id, reviewer_user_id, reviewer_role, actor_type, decision, rationale, conflict_attestation)
  values (v_id, v_org, p_snapshot, v_household, auth.uid(), v_role, 'USER', p_decision, p_rationale, coalesce(p_attestation, false));
  perform app.append_audit(v_org, case when p_decision = 'APPROVED' then 'APPROVAL_RECORDED' else 'REVIEW_RECORDED' end, 'review', v_id, format('%s recorded for snapshot %s by %s', p_decision, p_snapshot, v_role), jsonb_build_object('review_id', v_id));
  return v_id;
end $$;

-- =============================================================================================
-- 9b. Workflow entry points that became necessary once app.transition_household went internal:
--     reconciliation outcomes (app tier's freeze-gate evaluation) and sending a completed check to review.
-- =============================================================================================
create or replace function app.set_reconciliation_status(p_household uuid, p_to app.workflow_status) returns void
language plpgsql security definer set search_path = app, public as $$
declare v_org uuid;
begin
  select org_id into v_org from app.households where id = p_household;
  if v_org is null then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  perform app.assert_role(v_org, array['COMPLIANCE', 'ADVISOR', 'ANALYST']::app.role[], 'reconcile');
  if p_to not in ('IMPORT_DRAFT', 'MAPPED', 'RECONCILIATION_PENDING', 'BLOCKED', 'READY_TO_FREEZE') then
    raise exception 'INVALID_ARGUMENT: % is not a reconciliation outcome', p_to using errcode = 'P0001';
  end if;
  perform app.transition_household(p_household, p_to);
end $$;

create or replace function app.send_to_review(p_household uuid) returns void
language plpgsql security definer set search_path = app, public as $$
declare v_org uuid;
begin
  select org_id into v_org from app.households where id = p_household;
  if v_org is null then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  perform app.assert_role(v_org, array['COMPLIANCE', 'ADVISOR', 'ANALYST']::app.role[], 'send to review');
  perform app.transition_household(p_household, 'REVIEW_PENDING');
  perform app.append_audit(v_org, 'SENT_TO_REVIEW', 'household', p_household, format('Household %s sent to review', p_household));
end $$;

-- =============================================================================================
-- 10. Explicit grants for the entry points. Everything else in schema app is internal.
--     The PUBLIC revoke is re-asserted here because functions created or replaced above were
--     observed to carry the built-in PUBLIC EXECUTE grant (=X/) regardless of section 1's
--     ALTER DEFAULT PRIVILEGES. Every later migration that creates a function must end with the
--     same pattern; supabase/tests/005_trust_boundaries.test.sql asserts the exact inventory.
-- =============================================================================================
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
  app.canonical_json(jsonb), app.sha256_canonical(jsonb)
  to authenticated, service_role;
