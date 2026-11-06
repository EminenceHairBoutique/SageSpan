-- Row-level security. All policies resolve the caller through auth.uid() and
-- active memberships; a client-supplied org_id is never trusted on its own.
-- The anon role has no policies at all. The service role bypasses RLS and is
-- reserved for server-side maintenance paths; it must never reach a browser.

create or replace function app.current_user_id() returns uuid
language sql stable security definer set search_path = app, public as $$
  select auth.uid();
$$;

create or replace function app.member_orgs() returns setof uuid
language sql stable security definer set search_path = app, public as $$
  select org_id from app.memberships where user_id = auth.uid() and status = 'ACTIVE';
$$;

create or replace function app.is_member(p_org uuid) returns boolean
language sql stable security definer set search_path = app, public as $$
  select exists (select 1 from app.memberships where org_id = p_org and user_id = auth.uid() and status = 'ACTIVE');
$$;

create or replace function app.has_role(p_org uuid, p_roles app.role[]) returns boolean
language sql stable security definer set search_path = app, public as $$
  select exists (select 1 from app.memberships where org_id = p_org and user_id = auth.uid() and status = 'ACTIVE' and role = any (p_roles));
$$;

create or replace function app.current_role_in(p_org uuid) returns app.role
language sql stable security definer set search_path = app, public as $$
  select role from app.memberships where org_id = p_org and user_id = auth.uid() and status = 'ACTIVE' limit 1;
$$;

grant usage on schema app to authenticated, service_role;
grant execute on function app.current_user_id(), app.member_orgs(), app.is_member(uuid), app.has_role(uuid, app.role[]), app.current_role_in(uuid) to authenticated, service_role;

-- Table privileges for the authenticated role; RLS narrows them further.
grant select, insert, update on app.organizations, app.profiles, app.memberships, app.households, app.persons, app.accounts,
  app.account_ownership, app.beneficiary_designations, app.source_documents, app.source_locations, app.assumption_sets,
  app.assumptions, app.facts, app.fact_conflicts, app.conflict_fact_links, app.plan_imports, app.imported_plan_values,
  app.discrepancies, app.review_comments, app.evidence_packets to authenticated;
grant select, insert on app.snapshots, app.check_runs, app.audit_events to authenticated;
grant update (status, rule_set_versions) on app.snapshots to authenticated;
grant select on app.reviews, app.rule_sets, app.rule_parameters to authenticated;
grant all on all tables in schema app to service_role;

do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'app' loop
    execute format('alter table app.%I enable row level security', t);
    execute format('alter table app.%I force row level security', t);
  end loop;
end $$;

-- organizations ---------------------------------------------------------------
create policy org_select on app.organizations for select to authenticated using (app.is_member(id));
create policy org_update_policy on app.organizations for update to authenticated
  using (app.has_role(id, array['ADMIN', 'COMPLIANCE']::app.role[]))
  with check (app.has_role(id, array['ADMIN', 'COMPLIANCE']::app.role[]));

-- profiles: visible to people who share an organisation; editable by owner.
create policy profiles_select on app.profiles for select to authenticated
  using (user_id = auth.uid() or exists (
    select 1 from app.memberships m1 join app.memberships m2 on m1.org_id = m2.org_id
    where m1.user_id = auth.uid() and m1.status = 'ACTIVE' and m2.user_id = profiles.user_id and m2.status = 'ACTIVE'));
create policy profiles_insert_own on app.profiles for insert to authenticated with check (user_id = auth.uid());
create policy profiles_update_own on app.profiles for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- memberships: members see their org's roster; only ADMIN manages it; nobody edits their own role.
create policy memberships_select on app.memberships for select to authenticated using (app.is_member(org_id));
create policy memberships_insert on app.memberships for insert to authenticated
  with check (app.has_role(org_id, array['ADMIN']::app.role[]) and user_id <> auth.uid());
create policy memberships_update on app.memberships for update to authenticated
  using (app.has_role(org_id, array['ADMIN']::app.role[]) and user_id <> auth.uid())
  with check (app.has_role(org_id, array['ADMIN']::app.role[]) and user_id <> auth.uid());

-- Generic tenant policies --------------------------------------------------------
-- read: any active member; write: the roles listed per table.
create policy households_select on app.households for select to authenticated using (app.is_member(org_id));
create policy households_insert on app.households for insert to authenticated with check (app.has_role(org_id, array['ADMIN', 'COMPLIANCE', 'ADVISOR', 'ANALYST']::app.role[]));
create policy households_update on app.households for update to authenticated
  using (app.has_role(org_id, array['ADMIN', 'COMPLIANCE', 'ADVISOR', 'ANALYST']::app.role[]))
  with check (app.has_role(org_id, array['ADMIN', 'COMPLIANCE', 'ADVISOR', 'ANALYST']::app.role[]));

create policy persons_select on app.persons for select to authenticated using (app.is_member(org_id));
create policy persons_write on app.persons for insert to authenticated with check (app.has_role(org_id, array['COMPLIANCE', 'ADVISOR', 'ANALYST']::app.role[]));
create policy persons_update on app.persons for update to authenticated using (app.has_role(org_id, array['COMPLIANCE', 'ADVISOR', 'ANALYST']::app.role[])) with check (app.has_role(org_id, array['COMPLIANCE', 'ADVISOR', 'ANALYST']::app.role[]));

create policy accounts_select on app.accounts for select to authenticated using (app.is_member(org_id));
create policy accounts_write on app.accounts for insert to authenticated with check (app.has_role(org_id, array['COMPLIANCE', 'ADVISOR', 'ANALYST']::app.role[]));
create policy accounts_update on app.accounts for update to authenticated using (app.has_role(org_id, array['COMPLIANCE', 'ADVISOR', 'ANALYST']::app.role[])) with check (app.has_role(org_id, array['COMPLIANCE', 'ADVISOR', 'ANALYST']::app.role[]));

create policy ownership_select on app.account_ownership for select to authenticated using (app.is_member(org_id));
create policy ownership_write on app.account_ownership for insert to authenticated with check (app.has_role(org_id, array['COMPLIANCE', 'ADVISOR', 'ANALYST']::app.role[]));
create policy ownership_update on app.account_ownership for update to authenticated using (app.has_role(org_id, array['COMPLIANCE', 'ADVISOR', 'ANALYST']::app.role[])) with check (app.has_role(org_id, array['COMPLIANCE', 'ADVISOR', 'ANALYST']::app.role[]));

create policy beneficiaries_select on app.beneficiary_designations for select to authenticated using (app.is_member(org_id));
create policy beneficiaries_write on app.beneficiary_designations for insert to authenticated with check (app.has_role(org_id, array['COMPLIANCE', 'ADVISOR', 'ANALYST']::app.role[]));
create policy beneficiaries_update on app.beneficiary_designations for update to authenticated using (app.has_role(org_id, array['COMPLIANCE', 'ADVISOR', 'ANALYST']::app.role[])) with check (app.has_role(org_id, array['COMPLIANCE', 'ADVISOR', 'ANALYST']::app.role[]));

create policy documents_select on app.source_documents for select to authenticated using (app.is_member(org_id));
create policy documents_write on app.source_documents for insert to authenticated with check (app.has_role(org_id, array['COMPLIANCE', 'ADVISOR', 'ANALYST']::app.role[]));

create policy locations_select on app.source_locations for select to authenticated using (app.is_member(org_id));
create policy locations_write on app.source_locations for insert to authenticated with check (app.has_role(org_id, array['COMPLIANCE', 'ADVISOR', 'ANALYST']::app.role[]));

create policy assumption_sets_select on app.assumption_sets for select to authenticated using (app.is_member(org_id));
create policy assumption_sets_write on app.assumption_sets for insert to authenticated with check (app.has_role(org_id, array['COMPLIANCE', 'ADVISOR']::app.role[]));
create policy assumptions_select on app.assumptions for select to authenticated using (app.is_member(org_id));
create policy assumptions_write on app.assumptions for insert to authenticated with check (app.has_role(org_id, array['COMPLIANCE', 'ADVISOR']::app.role[]));

-- facts: insert by reconcilers; updates limited to supersession/status (column immutability enforced by trigger).
create policy facts_select on app.facts for select to authenticated using (app.is_member(org_id));
create policy facts_insert on app.facts for insert to authenticated with check (app.has_role(org_id, array['COMPLIANCE', 'ADVISOR', 'ANALYST']::app.role[]) and (created_by is null or created_by = auth.uid()));
create policy facts_update on app.facts for update to authenticated using (app.has_role(org_id, array['COMPLIANCE', 'ADVISOR', 'ANALYST']::app.role[])) with check (app.has_role(org_id, array['COMPLIANCE', 'ADVISOR', 'ANALYST']::app.role[]));

create policy conflicts_select on app.fact_conflicts for select to authenticated using (app.is_member(org_id));
create policy conflicts_insert on app.fact_conflicts for insert to authenticated with check (app.has_role(org_id, array['COMPLIANCE', 'ADVISOR', 'ANALYST']::app.role[]));
-- resolution/exception go through SECURITY DEFINER functions; direct updates are not granted a policy.
create policy conflict_links_select on app.conflict_fact_links for select to authenticated using (app.is_member(org_id));
create policy conflict_links_insert on app.conflict_fact_links for insert to authenticated with check (app.has_role(org_id, array['COMPLIANCE', 'ADVISOR', 'ANALYST']::app.role[]));

create policy imports_select on app.plan_imports for select to authenticated using (app.is_member(org_id));
create policy imports_insert on app.plan_imports for insert to authenticated with check (app.has_role(org_id, array['COMPLIANCE', 'ADVISOR', 'ANALYST']::app.role[]) and (imported_by is null or imported_by = auth.uid()));
create policy imports_update on app.plan_imports for update to authenticated using (app.has_role(org_id, array['COMPLIANCE', 'ADVISOR', 'ANALYST']::app.role[])) with check (app.has_role(org_id, array['COMPLIANCE', 'ADVISOR', 'ANALYST']::app.role[]));

create policy ipv_select on app.imported_plan_values for select to authenticated using (app.is_member(org_id));
create policy ipv_insert on app.imported_plan_values for insert to authenticated with check (app.has_role(org_id, array['COMPLIANCE', 'ADVISOR', 'ANALYST']::app.role[]));

-- snapshots: readable by members; created only through app.freeze_snapshot (no direct insert policy).
create policy snapshots_select on app.snapshots for select to authenticated using (app.is_member(org_id));

-- check runs: readable; inserted by the trusted server path (roles with check permission). Never updated or deleted.
create policy check_runs_select on app.check_runs for select to authenticated using (app.is_member(org_id));
create policy check_runs_insert on app.check_runs for insert to authenticated
  with check (app.has_role(org_id, array['COMPLIANCE', 'ADVISOR', 'ANALYST']::app.role[]) and executed_by = auth.uid()
    and exists (select 1 from app.snapshots s where s.id = snapshot_id and s.org_id = check_runs.org_id and s.status = 'FROZEN'));

create policy discrepancies_select on app.discrepancies for select to authenticated using (app.is_member(org_id));
create policy discrepancies_insert on app.discrepancies for insert to authenticated with check (app.has_role(org_id, array['COMPLIANCE', 'ADVISOR', 'ANALYST']::app.role[]));
create policy discrepancies_disposition on app.discrepancies for update to authenticated
  using (app.has_role(org_id, array['COMPLIANCE', 'ADVISOR']::app.role[]))
  with check (app.has_role(org_id, array['COMPLIANCE', 'ADVISOR']::app.role[]) and status = 'DISPOSITIONED' and (disposition->>'by')::uuid = auth.uid());

-- reviews: readable; created only through app.record_review (no direct insert policy); immutable.
create policy reviews_select on app.reviews for select to authenticated using (app.is_member(org_id));

create policy comments_select on app.review_comments for select to authenticated using (app.is_member(org_id));
create policy comments_insert on app.review_comments for insert to authenticated with check (app.is_member(org_id) and author_user_id = auth.uid() and author_role = app.current_role_in(org_id));

create policy packets_select on app.evidence_packets for select to authenticated using (app.is_member(org_id));
create policy packets_insert on app.evidence_packets for insert to authenticated
  with check (app.has_role(org_id, array['ADMIN', 'COMPLIANCE', 'ADVISOR']::app.role[]) and generated_by = auth.uid()
    and exists (select 1 from app.households h where h.id = household_id and h.org_id = evidence_packets.org_id and h.workflow_status in ('APPROVED', 'EXPORTED'))
    and exists (select 1 from app.reviews r where r.id = review_id and r.org_id = evidence_packets.org_id and r.decision = 'APPROVED' and r.snapshot_id = evidence_packets.snapshot_id));
create policy packets_reexport on app.evidence_packets for update to authenticated
  using (app.has_role(org_id, array['ADMIN', 'COMPLIANCE', 'ADVISOR']::app.role[]))
  with check (app.has_role(org_id, array['ADMIN', 'COMPLIANCE', 'ADVISOR']::app.role[]));

-- audit events: readable by members; appended only through app.append_audit (no direct insert policy); never updated/deleted.
create policy audit_select on app.audit_events for select to authenticated using (app.is_member(org_id));

-- rule registry: readable by every authenticated user; writes are service-role only.
create policy rule_sets_select on app.rule_sets for select to authenticated using (true);
create policy rule_parameters_select on app.rule_parameters for select to authenticated using (true);
