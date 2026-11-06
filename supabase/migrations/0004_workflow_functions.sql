-- Server-authoritative workflow functions and immutability triggers.
-- Functions run as SECURITY DEFINER but re-derive the caller from auth.uid()
-- and validate role, tenant and state transition before writing.

-- Workflow transition matrix (mirrors packages/contracts/src/workflow.ts).
create or replace function app.can_transition(p_from app.workflow_status, p_to app.workflow_status) returns boolean
language sql immutable as $$
  select case
    when p_to = 'IMPORT_DRAFT' then p_from <> 'IMPORT_DRAFT'
    when p_from = 'IMPORT_DRAFT' then p_to = 'MAPPED'
    when p_from = 'MAPPED' then p_to = 'RECONCILIATION_PENDING'
    when p_from = 'RECONCILIATION_PENDING' then p_to in ('BLOCKED', 'READY_TO_FREEZE')
    when p_from = 'BLOCKED' then p_to in ('RECONCILIATION_PENDING', 'READY_TO_FREEZE')
    when p_from = 'READY_TO_FREEZE' then p_to in ('FROZEN', 'BLOCKED', 'RECONCILIATION_PENDING')
    when p_from = 'FROZEN' then p_to in ('CHECK_COMPLETE', 'RECONCILIATION_PENDING')
    when p_from = 'CHECK_COMPLETE' then p_to in ('REVIEW_PENDING', 'RECONCILIATION_PENDING')
    when p_from = 'REVIEW_PENDING' then p_to in ('REVIEWED', 'RECONCILIATION_PENDING')
    when p_from = 'REVIEWED' then p_to in ('APPROVED', 'REVIEW_PENDING', 'RECONCILIATION_PENDING')
    when p_from = 'APPROVED' then p_to in ('EXPORTED', 'RECONCILIATION_PENDING')
    when p_from = 'EXPORTED' then p_to in ('EXPORTED', 'RECONCILIATION_PENDING')
    else false end;
$$;

create or replace function app.transition_household(p_household uuid, p_to app.workflow_status) returns void
language plpgsql security definer set search_path = app, public as $$
declare v_from app.workflow_status;
begin
  select workflow_status into v_from from app.households where id = p_household for update;
  if v_from is null then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  if not app.can_transition(v_from, p_to) then
    raise exception 'INVALID_TRANSITION % -> %', v_from, p_to using errcode = 'P0001';
  end if;
  update app.households set workflow_status = p_to, updated_at = now() where id = p_household;
end $$;

-- Hash-chained audit append (per-organisation chain, serialised with an advisory lock).
create or replace function app.append_audit(
  p_org uuid, p_event_type text, p_entity_type text, p_entity_id uuid, p_summary text, p_payload jsonb default '{}'::jsonb, p_actor_type app.actor_type default 'USER'
) returns uuid
language plpgsql security definer set search_path = app, public, extensions as $$
declare
  v_prev char(64);
  v_id uuid := gen_random_uuid();
  v_created timestamptz := now();
  v_role app.role := app.current_role_in(p_org);
  v_digest char(64) := encode(extensions.digest(coalesce(p_payload, '{}'::jsonb)::text, 'sha256'), 'hex');
  v_core text;
  v_hash char(64);
  v_request text := coalesce(current_setting('request.id', true), 'req_' || replace(gen_random_uuid()::text, '-', ''));
begin
  perform pg_advisory_xact_lock(hashtext('audit:' || p_org::text));
  select event_hash into v_prev from app.audit_events where org_id = p_org order by created_at desc, id desc limit 1;
  v_core := concat_ws('|', v_id::text, p_org::text, coalesce(auth.uid()::text, ''), coalesce(v_role::text, ''), p_actor_type::text, p_event_type, p_entity_type, coalesce(p_entity_id::text, ''), to_char(v_created at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'), coalesce(v_prev, ''), v_digest);
  v_hash := encode(extensions.digest(v_core, 'sha256'), 'hex');
  insert into app.audit_events (id, org_id, actor_user_id, actor_role, actor_type, event_type, entity_type, entity_id, created_at, previous_event_hash, event_hash, payload_digest, request_id, summary)
  values (v_id, p_org, auth.uid(), v_role, p_actor_type, p_event_type, p_entity_type, p_entity_id, v_created, v_prev, v_hash, v_digest, v_request, left(p_summary, 500));
  return v_id;
end $$;

create or replace function app.assert_role(p_org uuid, p_roles app.role[], p_action text) returns app.role
language plpgsql security definer set search_path = app, public as $$
declare v_role app.role := app.current_role_in(p_org);
begin
  if v_role is null then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  if not (v_role = any (p_roles)) then raise exception 'PERMISSION_DENIED: role % cannot %', v_role, p_action using errcode = '42501'; end if;
  return v_role;
end $$;

-- Freeze: fail-closed on open conflicts; the app tier additionally evaluates required-fact completeness.
create or replace function app.freeze_snapshot(p_household uuid, p_canonical_payload jsonb, p_content_sha256 text, p_assumption_set uuid default null) returns uuid
language plpgsql security definer set search_path = app, public as $$
declare
  v_org uuid; v_status app.workflow_status; v_role app.role; v_rev int; v_id uuid := gen_random_uuid();
  v_open_material int; v_open_nonmaterial int;
begin
  select org_id, workflow_status into v_org, v_status from app.households where id = p_household for update;
  if v_org is null then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  v_role := app.assert_role(v_org, array['COMPLIANCE', 'ADVISOR', 'ANALYST']::app.role[], 'freeze snapshots');
  if v_status <> 'READY_TO_FREEZE' then raise exception 'INVALID_STATE: household is %', v_status using errcode = 'P0001'; end if;
  select count(*) filter (where materiality = 'MATERIAL'), count(*) filter (where materiality = 'NONMATERIAL')
    into v_open_material, v_open_nonmaterial from app.fact_conflicts where household_id = p_household and status = 'OPEN';
  if v_open_material > 0 then raise exception 'FREEZE_BLOCKED: % open material conflict(s)', v_open_material using errcode = 'P0001'; end if;
  if v_open_nonmaterial > 0 then raise exception 'FREEZE_BLOCKED: % open nonmaterial conflict(s) need resolution or a documented exception', v_open_nonmaterial using errcode = 'P0001'; end if;
  if p_content_sha256 !~ '^[0-9a-f]{64}$' then raise exception 'INVALID_HASH' using errcode = 'P0001'; end if;
  update app.snapshots set status = 'SUPERSEDED' where household_id = p_household and status = 'FROZEN';
  select coalesce(max(revision), 0) + 1 into v_rev from app.snapshots where household_id = p_household;
  insert into app.snapshots (id, org_id, household_id, revision, content_sha256, assumption_set_id, created_by, created_by_role, canonical_payload)
  values (v_id, v_org, p_household, v_rev, p_content_sha256, p_assumption_set, auth.uid(), v_role, p_canonical_payload);
  perform app.transition_household(p_household, 'FROZEN');
  update app.households set current_revision = v_rev where id = p_household;
  perform app.append_audit(v_org, 'SNAPSHOT_FROZEN', 'snapshot', v_id, format('Snapshot %s (revision %s) frozen for household %s', v_id, v_rev, p_household), jsonb_build_object('content_sha256', p_content_sha256, 'revision', v_rev));
  return v_id;
end $$;

-- Resolve a conflict: new fact revision, supersede the rest, record rationale; material conflicts need primary evidence unless COMPLIANCE.
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

-- Document a nonmaterial exception (COMPLIANCE only, when firm policy allows).
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

-- Record a review decision. Identity is always auth.uid(): nobody can record a review as someone else.
create or replace function app.record_review(p_snapshot uuid, p_decision app.review_decision, p_rationale text, p_attestation boolean default false) returns uuid
language plpgsql security definer set search_path = app, public as $$
declare
  v_org uuid; v_household uuid; v_snap_status app.snapshot_status; v_created_by uuid; v_role app.role; v_hstatus app.workflow_status;
  v_policies jsonb; v_sod boolean; v_approvers text[]; v_open_disc int; v_runs int; v_error_runs int; v_id uuid := gen_random_uuid();
begin
  select org_id, household_id, status, created_by into v_org, v_household, v_snap_status, v_created_by from app.snapshots where id = p_snapshot;
  if v_org is null then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  if v_snap_status <> 'FROZEN' then raise exception 'INVALID_STATE: snapshot is %', v_snap_status using errcode = 'P0001'; end if;
  if length(coalesce(p_rationale, '')) < 10 then raise exception 'RATIONALE_REQUIRED' using errcode = 'P0001'; end if;
  select workflow_status into v_hstatus from app.households where id = v_household for update;
  select policies into v_policies from app.organizations where id = v_org;

  if p_decision = 'REVIEWED' then
    v_role := app.assert_role(v_org, array['COMPLIANCE', 'ADVISOR']::app.role[], 'record reviews');
    perform app.transition_household(v_household, 'REVIEWED');
  elsif p_decision = 'APPROVED' then
    v_role := app.assert_role(v_org, array['COMPLIANCE', 'ADVISOR']::app.role[], 'approve');
    select array_agg(x) into v_approvers from jsonb_array_elements_text(v_policies->'approver_roles') as t(x);
    if not (v_role::text = any (coalesce(v_approvers, array['COMPLIANCE']))) then
      perform app.append_audit(v_org, 'APPROVAL_DENIED', 'snapshot', p_snapshot, format('Approval denied: role %s is not an approver role under firm policy', v_role));
      raise exception 'NOT_AN_APPROVER' using errcode = '42501';
    end if;
    if not coalesce(p_attestation, false) then raise exception 'ATTESTATION_REQUIRED' using errcode = 'P0001'; end if;
    select count(*), count(*) filter (where run_status = 'ERROR') into v_runs, v_error_runs from app.check_runs where snapshot_id = p_snapshot;
    if v_runs = 0 or v_error_runs > 0 then raise exception 'CHECK_REQUIRED' using errcode = 'P0001'; end if;
    select count(*) into v_open_disc from app.discrepancies d join app.check_runs r on r.id = d.check_run_id where r.snapshot_id = p_snapshot and d.status = 'OPEN';
    if v_open_disc > 0 then raise exception 'OPEN_DISCREPANCIES: %', v_open_disc using errcode = 'P0001'; end if;
    v_sod := coalesce((v_policies->>'separation_of_duties')::boolean, true);
    if v_sod and (v_created_by = auth.uid() or exists (select 1 from app.check_runs where snapshot_id = p_snapshot and executed_by = auth.uid())) then
      perform app.append_audit(v_org, 'APPROVAL_DENIED', 'snapshot', p_snapshot, 'Approval denied by separation-of-duties policy');
      raise exception 'SEPARATION_OF_DUTIES' using errcode = '42501';
    end if;
    perform app.transition_household(v_household, 'APPROVED');
  else
    v_role := app.assert_role(v_org, array['COMPLIANCE', 'ADVISOR']::app.role[], 'reject');
    perform app.transition_household(v_household, 'REVIEW_PENDING');
  end if;

  insert into app.reviews (id, org_id, snapshot_id, household_id, reviewer_user_id, reviewer_role, actor_type, decision, rationale, conflict_attestation)
  values (v_id, v_org, p_snapshot, v_household, auth.uid(), v_role, 'USER', p_decision, p_rationale, coalesce(p_attestation, false));
  perform app.append_audit(v_org, case when p_decision = 'APPROVED' then 'APPROVAL_RECORDED' else 'REVIEW_RECORDED' end, 'review', v_id, format('%s recorded for snapshot %s by %s', p_decision, p_snapshot, v_role), jsonb_build_object('review_id', v_id));
  return v_id;
end $$;

grant execute on function app.can_transition(app.workflow_status, app.workflow_status), app.transition_household(uuid, app.workflow_status), app.append_audit(uuid, text, text, uuid, text, jsonb, app.actor_type), app.assert_role(uuid, app.role[], text), app.freeze_snapshot(uuid, jsonb, text, uuid), app.resolve_conflict(uuid, uuid, text), app.document_exception(uuid, text), app.record_review(uuid, app.review_decision, text, boolean) to authenticated, service_role;

-- Immutability triggers ---------------------------------------------------------
create or replace function app.prevent_mutation() returns trigger
language plpgsql as $$
begin
  raise exception 'IMMUTABLE: % rows cannot be % by application roles', tg_table_name, lower(tg_op) using errcode = '42501';
end $$;

create trigger audit_events_immutable before update or delete on app.audit_events for each row execute function app.prevent_mutation();
create trigger check_runs_immutable before update or delete on app.check_runs for each row execute function app.prevent_mutation();
create trigger reviews_immutable before update or delete on app.reviews for each row execute function app.prevent_mutation();
create trigger snapshots_no_delete before delete on app.snapshots for each row execute function app.prevent_mutation();

create or replace function app.snapshots_guard_update() returns trigger
language plpgsql as $$
begin
  if new.canonical_payload is distinct from old.canonical_payload or new.content_sha256 is distinct from old.content_sha256
     or new.revision is distinct from old.revision or new.created_by is distinct from old.created_by or new.household_id is distinct from old.household_id or new.org_id is distinct from old.org_id then
    raise exception 'IMMUTABLE: frozen snapshot content cannot change; create a new revision' using errcode = '42501';
  end if;
  if old.status = 'SUPERSEDED' and new.status = 'FROZEN' then
    raise exception 'IMMUTABLE: a superseded snapshot cannot be re-frozen' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger snapshots_guard before update on app.snapshots for each row execute function app.snapshots_guard_update();

create or replace function app.facts_guard_update() returns trigger
language plpgsql as $$
begin
  -- Only supersession and verification status may change; values and provenance are immutable.
  if new.value_number is distinct from old.value_number or new.value_text is distinct from old.value_text or new.value_date is distinct from old.value_date
     or new.value_bool is distinct from old.value_bool or new.as_of_date is distinct from old.as_of_date or new.source_document_id is distinct from old.source_document_id
     or new.source_location_id is distinct from old.source_location_id or new.field_key is distinct from old.field_key or new.subject_id is distinct from old.subject_id
     or new.org_id is distinct from old.org_id or new.household_id is distinct from old.household_id or new.revision is distinct from old.revision then
    raise exception 'IMMUTABLE: fact values and provenance cannot change; create a new revision' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger facts_guard before update on app.facts for each row execute function app.facts_guard_update();

create or replace function app.packets_guard_update() returns trigger
language plpgsql as $$
begin
  if new.packet is distinct from old.packet or new.sha256 is distinct from old.sha256 or new.snapshot_id is distinct from old.snapshot_id or new.review_id is distinct from old.review_id then
    raise exception 'IMMUTABLE: an approved packet cannot change; re-export logs a separate event' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger packets_guard before update on app.evidence_packets for each row execute function app.packets_guard_update();

create or replace function app.households_touch() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;
create trigger households_touch before update on app.households for each row execute function app.households_touch();
