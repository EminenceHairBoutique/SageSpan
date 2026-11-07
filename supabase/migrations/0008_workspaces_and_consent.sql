-- =============================================================================================
-- 0008 — PR-003a: production-shaped identity for consumers (principals, PERSONAL / HOUSEHOLD
-- workspaces, memberships, purpose-limited consent grants), the personal record tables with
-- domain-scoped row-level security, and an append-only per-workspace event log.
--
-- Mirrors packages/contracts/src/workspace.ts, personal.ts and personal-records.ts, and the ADR in
-- docs/architecture/DUAL_WORKSPACE_ADR.md. Forward-only; touches nothing in 0001–0007.
--
-- Security model (V5 §17.4, §21.1):
--   * A principal IS an auth.users row (same uuid). Identity is derived from auth.uid(), never from a
--     client-supplied id.
--   * Firm membership (app.memberships) never reaches a personal workspace. Only an ACTIVE
--     workspace membership covering the domain, or an ACTIVE, unexpired consent grant to the
--     principal or to a firm the principal is an active member of, does — and then read-only.
--   * Only the ACTIVE OWNER writes personal records. Participants, viewers and grantees read.
--   * Memberships, grants, workspaces and events change only through SECURITY DEFINER entry points
--     that re-derive the actor; `authenticated` holds no INSERT/UPDATE/DELETE on them.
--   * Revocation is a versioned update that keeps the row; nothing is deleted.
-- =============================================================================================

-- ---------------------------------------------------------------------------------------------
-- 1. Types
-- ---------------------------------------------------------------------------------------------
do $$ begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'app' and t.typname = 'workspace_kind') then
    create type app.workspace_kind as enum ('PERSONAL', 'HOUSEHOLD', 'FIRM');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'app' and t.typname = 'workspace_role') then
    create type app.workspace_role as enum ('OWNER', 'PARTICIPANT', 'VIEWER');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'app' and t.typname = 'workspace_membership_status') then
    create type app.workspace_membership_status as enum ('ACTIVE', 'INVITED', 'REVOKED');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'app' and t.typname = 'share_domain') then
    create type app.share_domain as enum ('CASH_FLOW', 'SPENDING', 'DEBT', 'SAVINGS_GOALS', 'RETIREMENT', 'DOCUMENTS', 'AI_SUMMARIES');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'app' and t.typname = 'consent_purpose') then
    create type app.consent_purpose as enum ('HOUSEHOLD_PLANNING', 'ADVISOR_REVIEW', 'SECOND_OPINION', 'SUPPORT');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'app' and t.typname = 'personal_data_state') then
    create type app.personal_data_state as enum ('USER_REPORTED', 'EVIDENCE_VERIFIED', 'ASSUMED', 'MISSING', 'STALE', 'CONFLICTING');
  end if;
end $$;

-- ---------------------------------------------------------------------------------------------
-- 2. Identity: principals and workspaces
-- ---------------------------------------------------------------------------------------------
create table if not exists app.principals (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (length(display_name) between 1 and 60),
  created_at timestamptz not null default now()
);

create table if not exists app.workspaces (
  id uuid primary key default gen_random_uuid(),
  kind app.workspace_kind not null,
  label text not null check (length(label) between 1 and 120),
  owner_principal_id uuid null references app.principals (id) on delete restrict,
  firm_org_id uuid null references app.organizations (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint workspaces_firm_shape check ((kind = 'FIRM') = (firm_org_id is not null)),
  constraint workspaces_owner_shape check ((kind = 'FIRM') = (owner_principal_id is null)),
  constraint workspaces_firm_unique unique (firm_org_id)
);

create table if not exists app.workspace_memberships (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references app.workspaces (id) on delete cascade,
  principal_id uuid not null references app.principals (id) on delete cascade,
  role app.workspace_role not null,
  domains app.share_domain[] not null default '{}',
  status app.workspace_membership_status not null default 'INVITED',
  created_at timestamptz not null default now(),
  unique (workspace_id, principal_id)
);
create index if not exists workspace_memberships_principal_idx on app.workspace_memberships (principal_id, status);

create table if not exists app.consent_grants (
  id uuid primary key default gen_random_uuid(),
  grantor_workspace_id uuid not null references app.workspaces (id) on delete cascade,
  grantor_principal_id uuid not null references app.principals (id) on delete restrict,
  grantee_principal_id uuid null references app.principals (id) on delete cascade,
  grantee_org_id uuid null references app.organizations (id) on delete cascade,
  domains app.share_domain[] not null check (cardinality(domains) >= 1),
  purpose app.consent_purpose not null,
  granted_at timestamptz not null default now(),
  expires_at timestamptz null,
  revoked_at timestamptz null,
  revoked_by uuid null references app.principals (id) on delete set null,
  retention_note text null check (retention_note is null or length(retention_note) <= 500),
  version int not null default 1 check (version >= 1),
  constraint consent_grants_one_grantee check ((grantee_principal_id is null) <> (grantee_org_id is null)),
  constraint consent_grants_expiry check (expires_at is null or expires_at > granted_at)
);
create index if not exists consent_grants_grantee_principal_idx on app.consent_grants (grantee_principal_id) where grantee_principal_id is not null;
create index if not exists consent_grants_grantee_org_idx on app.consent_grants (grantee_org_id) where grantee_org_id is not null;
create index if not exists consent_grants_workspace_idx on app.consent_grants (grantor_workspace_id);

-- Append-only, per-workspace event log (the consumer counterpart of app.audit_events, which is firm/org-scoped).
create table if not exists app.workspace_event_heads (
  workspace_id uuid primary key references app.workspaces (id) on delete cascade,
  last_seq bigint not null default 0,
  last_hash char(64) null
);
create table if not exists app.workspace_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references app.workspaces (id) on delete cascade,
  seq bigint not null,
  actor_principal_id uuid null references app.principals (id) on delete set null,
  event_type text not null check (event_type in (
    'WORKSPACE_CREATED', 'PARTICIPANT_INVITED', 'INVITATION_ACCEPTED', 'MEMBERSHIP_REVOKED',
    'CONSENT_GRANTED', 'CONSENT_REVOKED', 'RECORD_CREATED', 'RECORD_UPDATED', 'RECORD_RETIRED', 'PROFILE_UPDATED')),
  entity_type text not null check (length(entity_type) between 1 and 40),
  entity_id uuid null,
  summary text not null check (length(summary) <= 500),
  payload_digest char(64) not null,
  previous_event_hash char(64) null,
  event_hash char(64) not null,
  created_at timestamptz not null default now(),
  unique (workspace_id, seq),
  unique (workspace_id, previous_event_hash)
);

create or replace function app.workspace_events_immutable() returns trigger
language plpgsql as $$
begin
  raise exception 'IMMUTABLE: workspace events are append-only' using errcode = '42501';
end $$;
drop trigger if exists workspace_events_no_update on app.workspace_events;
create trigger workspace_events_no_update before update or delete on app.workspace_events for each row execute function app.workspace_events_immutable();

-- Internal: append to the workspace chain. Not executable by authenticated; definer entry points call it.
create or replace function app.workspace_append_event(p_workspace uuid, p_event_type text, p_entity_type text, p_entity_id uuid, p_summary text, p_payload jsonb default '{}'::jsonb) returns uuid
language plpgsql security definer set search_path = app, public, extensions as $$
declare
  v_id uuid := gen_random_uuid(); v_seq bigint; v_prev char(64); v_hash char(64); v_created timestamptz := now();
  v_digest char(64) := encode(extensions.digest(app.canonical_json(coalesce(p_payload, '{}'::jsonb)), 'sha256'), 'hex');
begin
  perform pg_advisory_xact_lock(hashtext('wsaudit:' || p_workspace::text));
  insert into app.workspace_event_heads (workspace_id) values (p_workspace) on conflict (workspace_id) do nothing;
  select last_seq, last_hash into v_seq, v_prev from app.workspace_event_heads where workspace_id = p_workspace for update;
  v_seq := v_seq + 1;
  v_hash := encode(extensions.digest(concat_ws('|', v_seq::text, v_id::text, p_workspace::text, coalesce(auth.uid()::text, ''), p_event_type, p_entity_type, coalesce(p_entity_id::text, ''), to_char(v_created at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'), coalesce(v_prev, ''), v_digest), 'sha256'), 'hex');
  insert into app.workspace_events (id, workspace_id, seq, actor_principal_id, event_type, entity_type, entity_id, summary, payload_digest, previous_event_hash, event_hash, created_at)
  values (v_id, p_workspace, v_seq, auth.uid(), p_event_type, p_entity_type, p_entity_id, left(p_summary, 500), v_digest, v_prev, v_hash, v_created);
  update app.workspace_event_heads set last_seq = v_seq, last_hash = v_hash where workspace_id = p_workspace;
  return v_id;
end $$;

-- ---------------------------------------------------------------------------------------------
-- 3. Authorisation helpers (mirror of actorCanReadDomain / grantCovers in workspace.ts)
-- ---------------------------------------------------------------------------------------------
create or replace function app.is_workspace_owner(p_workspace uuid) returns boolean
language sql stable security definer set search_path = app, public as $$
  select exists (select 1 from app.workspace_memberships m where m.workspace_id = p_workspace and m.principal_id = auth.uid() and m.status = 'ACTIVE' and m.role = 'OWNER');
$$;

create or replace function app.is_workspace_member(p_workspace uuid) returns boolean
language sql stable security definer set search_path = app, public as $$
  select exists (select 1 from app.workspace_memberships m where m.workspace_id = p_workspace and m.principal_id = auth.uid() and m.status = 'ACTIVE');
$$;

-- True when the caller may READ records of p_domain in p_workspace:
--   ACTIVE OWNER, or ACTIVE member whose domains include it, or an ACTIVE unexpired grant covering it
--   made to the caller personally or to a firm the caller is an ACTIVE member of. Nothing else.
create or replace function app.can_read_workspace_domain(p_workspace uuid, p_domain app.share_domain) returns boolean
language sql stable security definer set search_path = app, public as $$
  select auth.uid() is not null and (
    exists (select 1 from app.workspace_memberships m
            where m.workspace_id = p_workspace and m.principal_id = auth.uid() and m.status = 'ACTIVE'
              and (m.role = 'OWNER' or p_domain = any (m.domains)))
    or exists (select 1 from app.consent_grants g
            where g.grantor_workspace_id = p_workspace and g.revoked_at is null and (g.expires_at is null or g.expires_at > now())
              and p_domain = any (g.domains)
              and (g.grantee_principal_id = auth.uid()
                   or (g.grantee_org_id is not null and exists (select 1 from app.memberships om where om.org_id = g.grantee_org_id and om.user_id = auth.uid() and om.status = 'ACTIVE'))))
  );
$$;

-- ---------------------------------------------------------------------------------------------
-- 4. Personal record tables (workspace-scoped; one share domain per table)
-- ---------------------------------------------------------------------------------------------
create table if not exists app.personal_profiles (
  workspace_id uuid primary key references app.workspaces (id) on delete cascade,
  principal_id uuid not null references app.principals (id) on delete restrict,
  household_size int not null default 1 check (household_size between 1 and 12),
  situation text not null default '' check (length(situation) <= 240),
  top_concern text null check (top_concern is null or length(top_concern) <= 240),
  cash_floor numeric(14, 2) not null check (cash_floor >= 0),
  buffer_target_months numeric(5, 2) null check (buffer_target_months is null or (buffer_target_months >= 0 and buffer_target_months <= 36)),
  extra_debt_payment_monthly numeric(14, 2) not null default 0 check (extra_debt_payment_monthly >= 0),
  notification_mode text not null default 'NORMAL' check (notification_mode in ('NORMAL', 'QUIET')),
  updated_at timestamptz not null default now()
);

create table if not exists app.cash_accounts (
  id uuid primary key default gen_random_uuid(),
  account_ref uuid not null,
  workspace_id uuid not null references app.workspaces (id) on delete cascade,
  label text not null check (length(label) between 1 and 80),
  kind text not null check (kind in ('CHECKING', 'SAVINGS', 'CASH', 'OTHER_LIQUID', 'RETIREMENT', 'INVESTMENT', 'OTHER')),
  balance numeric(14, 2) not null check (balance >= 0),
  currency char(3) not null default 'USD',
  balance_as_of date not null,
  liquid boolean not null default true,
  data_state app.personal_data_state not null default 'USER_REPORTED',
  revision int not null default 1 check (revision >= 1),
  supersedes_id uuid null references app.cash_accounts (id) on delete restrict,
  superseded boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index if not exists cash_accounts_live_ref_idx on app.cash_accounts (workspace_id, account_ref) where superseded = false;

create table if not exists app.income_streams (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references app.workspaces (id) on delete cascade,
  label text not null check (length(label) between 1 and 80),
  kind text not null check (kind in ('SALARY', 'HOURLY', 'VARIABLE_PAY', 'SELF_EMPLOYMENT', 'BENEFIT', 'PENSION', 'RENTAL', 'OTHER')),
  cadence text not null check (cadence in ('WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUAL', 'ONE_TIME')),
  reliability text not null default 'UNKNOWN' check (reliability in ('REGULAR', 'VARIABLE', 'IRREGULAR', 'UNKNOWN')),
  observed_monthly_amounts numeric(14, 2)[] not null default '{}',
  observed_from text null check (observed_from is null or observed_from ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  observed_to text null check (observed_to is null or observed_to ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  expected_amount numeric(14, 2) null check (expected_amount is null or expected_amount >= 0),
  next_expected_date date null,
  data_state app.personal_data_state not null default 'USER_REPORTED',
  retired boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists app.liabilities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references app.workspaces (id) on delete cascade,
  label text not null check (length(label) between 1 and 80),
  kind text not null check (kind in ('CREDIT_CARD', 'AUTO_LOAN', 'STUDENT_LOAN', 'PERSONAL_LOAN', 'MORTGAGE', 'MEDICAL', 'OTHER')),
  balance numeric(14, 2) not null check (balance >= 0),
  balance_as_of date not null,
  apr_percent numeric(6, 3) not null check (apr_percent between 0 and 100),
  minimum_payment numeric(14, 2) not null check (minimum_payment >= 0),
  rate_type text not null default 'FIXED' check (rate_type in ('FIXED', 'VARIABLE', 'PROMOTIONAL')),
  promo_apr_percent numeric(6, 3) null check (promo_apr_percent is null or promo_apr_percent between 0 and 100),
  promo_apr_expires date null,
  due_day_of_month int null check (due_day_of_month is null or due_day_of_month between 1 and 31),
  data_state app.personal_data_state not null default 'USER_REPORTED',
  retired boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists app.recurring_obligations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references app.workspaces (id) on delete cascade,
  label text not null check (length(label) between 1 and 80),
  category text not null check (category in ('HOUSING', 'UTILITIES', 'INSURANCE', 'DEBT_MINIMUM', 'SUBSCRIPTION', 'TRANSPORT', 'FOOD', 'CHILDCARE', 'HEALTH', 'SAVINGS_TRANSFER', 'OTHER')),
  amount numeric(14, 2) not null check (amount >= 0),
  cadence text not null check (cadence in ('WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUAL', 'ONE_TIME')),
  next_due_date date not null,
  essential boolean not null default true,
  liability_id uuid null references app.liabilities (id) on delete set null,
  data_state app.personal_data_state not null default 'USER_REPORTED',
  retired boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists app.variable_spending (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references app.workspaces (id) on delete cascade,
  category text not null check (length(category) between 1 and 80),
  observed_monthly_amounts numeric(14, 2)[] not null default '{}',
  essential boolean not null default false,
  transfers_excluded boolean not null default false,
  data_state app.personal_data_state not null default 'USER_REPORTED',
  retired boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists app.savings_goals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references app.workspaces (id) on delete cascade,
  label text not null check (length(label) between 1 and 80),
  kind text not null check (kind in ('EMERGENCY_RESERVE', 'MOVE', 'EDUCATION', 'HOME', 'MEDICAL', 'CAREGIVING', 'TRAVEL', 'RETIREMENT', 'OTHER')),
  target_amount numeric(14, 2) not null check (target_amount >= 0),
  saved_amount numeric(14, 2) not null default 0 check (saved_amount >= 0),
  target_date date null,
  monthly_contribution numeric(14, 2) null check (monthly_contribution is null or monthly_contribution >= 0),
  funded_from_account_ref uuid null,
  retired boolean not null default false,
  created_at timestamptz not null default now()
);

-- Append-only history of every personal record write (mirror of PersonalRecordRevision).
create table if not exists app.personal_record_revisions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references app.workspaces (id) on delete cascade,
  record_type text not null check (record_type in ('CASH_ACCOUNT', 'INCOME_STREAM', 'OBLIGATION', 'VARIABLE_SPENDING', 'LIABILITY', 'GOAL')),
  record_ref uuid not null,
  revision int not null check (revision >= 1),
  change text not null check (change in ('CREATE', 'UPDATE', 'RETIRE')),
  before jsonb null,
  after jsonb null,
  changed_by uuid not null references app.principals (id) on delete restrict,
  created_at timestamptz not null default now()
);
drop trigger if exists personal_record_revisions_no_update on app.personal_record_revisions;
create trigger personal_record_revisions_no_update before update or delete on app.personal_record_revisions for each row execute function app.workspace_events_immutable();

-- ---------------------------------------------------------------------------------------------
-- 5. Row-level security
-- ---------------------------------------------------------------------------------------------
do $$
declare t text;
begin
  for t in select unnest(array['principals', 'workspaces', 'workspace_memberships', 'consent_grants', 'workspace_event_heads', 'workspace_events',
                                'personal_profiles', 'cash_accounts', 'income_streams', 'liabilities', 'recurring_obligations', 'variable_spending', 'savings_goals', 'personal_record_revisions']) loop
    -- ENABLE, not FORCE: same mode as 0005 §0 (SECURITY DEFINER entry points run as the owner; on Supabase
    -- the owner is not a superuser, so FORCE would subject the trusted path to end-user policies).
    execute format('alter table app.%I enable row level security', t);
    execute format('alter table app.%I no force row level security', t);
  end loop;
end $$;

-- principals: yourself, people who share a workspace with you, and grantees/grantors of your grants.
drop policy if exists principals_select on app.principals;
create policy principals_select on app.principals for select to authenticated
  using (id = auth.uid()
    or exists (select 1 from app.workspace_memberships a join app.workspace_memberships b on a.workspace_id = b.workspace_id
               where a.principal_id = auth.uid() and a.status = 'ACTIVE' and b.principal_id = principals.id)
    or exists (select 1 from app.consent_grants g where (g.grantee_principal_id = auth.uid() and g.grantor_principal_id = principals.id) or (g.grantor_principal_id = auth.uid() and g.grantee_principal_id = principals.id)));

-- workspaces: members (any status, so an invitee can see what they were invited to), grantees of an active grant, and firm members of a FIRM workspace.
drop policy if exists workspaces_select on app.workspaces;
create policy workspaces_select on app.workspaces for select to authenticated
  using (exists (select 1 from app.workspace_memberships m where m.workspace_id = workspaces.id and m.principal_id = auth.uid() and m.status in ('ACTIVE', 'INVITED'))
    or (firm_org_id is not null and app.is_member(firm_org_id))
    or exists (select 1 from app.consent_grants g where g.grantor_workspace_id = workspaces.id and g.revoked_at is null and (g.expires_at is null or g.expires_at > now())
               and (g.grantee_principal_id = auth.uid() or (g.grantee_org_id is not null and app.is_member(g.grantee_org_id)))));

-- memberships: ACTIVE members see the roster; an invitee sees their own invitation.
drop policy if exists workspace_memberships_select on app.workspace_memberships;
create policy workspace_memberships_select on app.workspace_memberships for select to authenticated
  using (principal_id = auth.uid() or app.is_workspace_member(workspace_id));

-- grants: the grantor's workspace members and the grantee (principal or firm member) see them, including revoked history.
drop policy if exists consent_grants_select on app.consent_grants;
create policy consent_grants_select on app.consent_grants for select to authenticated
  using (app.is_workspace_member(grantor_workspace_id)
    or grantee_principal_id = auth.uid()
    or (grantee_org_id is not null and app.is_member(grantee_org_id)));

-- events: ACTIVE members only (never grantees).
drop policy if exists workspace_events_select on app.workspace_events;
create policy workspace_events_select on app.workspace_events for select to authenticated using (app.is_workspace_member(workspace_id));
drop policy if exists workspace_event_heads_select on app.workspace_event_heads;
create policy workspace_event_heads_select on app.workspace_event_heads for select to authenticated using (app.is_workspace_member(workspace_id));

-- personal records: read by domain; written by the ACTIVE OWNER only; never deleted.
drop policy if exists personal_profiles_select on app.personal_profiles;
create policy personal_profiles_select on app.personal_profiles for select to authenticated using (app.is_workspace_member(workspace_id) or app.can_read_workspace_domain(workspace_id, 'CASH_FLOW'));
drop policy if exists personal_profiles_update on app.personal_profiles;
create policy personal_profiles_update on app.personal_profiles for update to authenticated using (app.is_workspace_owner(workspace_id)) with check (app.is_workspace_owner(workspace_id));

do $$
declare r record;
begin
  for r in select * from (values ('cash_accounts', 'CASH_FLOW'), ('income_streams', 'CASH_FLOW'), ('recurring_obligations', 'CASH_FLOW'),
                                 ('variable_spending', 'SPENDING'), ('liabilities', 'DEBT'), ('savings_goals', 'SAVINGS_GOALS')) as v(tbl, dom) loop
    execute format('drop policy if exists %I_select on app.%I', r.tbl, r.tbl);
    execute format('create policy %I_select on app.%I for select to authenticated using (app.can_read_workspace_domain(workspace_id, %L::app.share_domain))', r.tbl, r.tbl, r.dom);
    execute format('drop policy if exists %I_insert on app.%I', r.tbl, r.tbl);
    execute format('create policy %I_insert on app.%I for insert to authenticated with check (app.is_workspace_owner(workspace_id))', r.tbl, r.tbl);
    execute format('drop policy if exists %I_update on app.%I', r.tbl, r.tbl);
    execute format('create policy %I_update on app.%I for update to authenticated using (app.is_workspace_owner(workspace_id)) with check (app.is_workspace_owner(workspace_id))', r.tbl, r.tbl);
  end loop;
end $$;

drop policy if exists personal_record_revisions_select on app.personal_record_revisions;
create policy personal_record_revisions_select on app.personal_record_revisions for select to authenticated using (app.is_workspace_owner(workspace_id));
drop policy if exists personal_record_revisions_insert on app.personal_record_revisions;
create policy personal_record_revisions_insert on app.personal_record_revisions for insert to authenticated with check (app.is_workspace_owner(workspace_id) and changed_by = auth.uid());

-- ---------------------------------------------------------------------------------------------
-- 6. Guards: grants and memberships change only through the entry points below, and a grant can
--    only ever move towards revocation. The PRIMARY control is privilege: `authenticated` holds
--    SELECT only on these two tables (§8). The `app.workspace_fn` sentinel is coordination for the
--    owner path, never a boundary on its own (same stance as app.workflow_fn, CLAUDE.md §4.3).
-- ---------------------------------------------------------------------------------------------
create or replace function app.consent_grants_guard() returns trigger
language plpgsql as $$
begin
  if coalesce(current_setting('app.workspace_fn', true), '') <> '1' then
    raise exception 'PERMISSION_DENIED: consent grants change only through app.grant_consent / app.revoke_consent' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' then
    if new.id <> old.id or new.grantor_workspace_id <> old.grantor_workspace_id or new.grantor_principal_id <> old.grantor_principal_id
       or new.grantee_principal_id is distinct from old.grantee_principal_id or new.grantee_org_id is distinct from old.grantee_org_id
       or new.domains <> old.domains or new.purpose <> old.purpose or new.granted_at <> old.granted_at or new.expires_at is distinct from old.expires_at then
      raise exception 'IMMUTABLE: a consent grant''s scope cannot be edited; revoke it and grant again' using errcode = '42501';
    end if;
    if old.revoked_at is not null and new.revoked_at is distinct from old.revoked_at then
      raise exception 'IMMUTABLE: a revoked grant cannot be un-revoked' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists consent_grants_guard on app.consent_grants;
create trigger consent_grants_guard before insert or update on app.consent_grants for each row execute function app.consent_grants_guard();
drop trigger if exists consent_grants_no_delete on app.consent_grants;
create trigger consent_grants_no_delete before delete on app.consent_grants for each row execute function app.workspace_events_immutable();

create or replace function app.workspace_memberships_guard() returns trigger
language plpgsql as $$
begin
  if coalesce(current_setting('app.workspace_fn', true), '') <> '1' then
    raise exception 'PERMISSION_DENIED: memberships change only through the workspace entry points' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists workspace_memberships_guard on app.workspace_memberships;
create trigger workspace_memberships_guard before insert or update or delete on app.workspace_memberships for each row execute function app.workspace_memberships_guard();

-- ---------------------------------------------------------------------------------------------
-- 7. Entry points (SECURITY DEFINER; actor derived from auth.uid())
-- ---------------------------------------------------------------------------------------------
create or replace function app.require_principal(p_display_name text default null) returns uuid
language plpgsql security definer set search_path = app, public as $$
declare v_uid uuid := auth.uid(); v_name text;
begin
  if v_uid is null then raise exception 'UNAUTHENTICATED' using errcode = '42501'; end if;
  if not exists (select 1 from app.principals where id = v_uid) then
    select coalesce(nullif(trim(p_display_name), ''), split_part(u.email, '@', 1), 'Member') into v_name from auth.users u where u.id = v_uid;
    insert into app.principals (id, display_name) values (v_uid, left(coalesce(v_name, 'Member'), 60));
  elsif nullif(trim(p_display_name), '') is not null then
    update app.principals set display_name = left(trim(p_display_name), 60) where id = v_uid;
  end if;
  return v_uid;
end $$;

-- The production counterpart of "Start fresh": a new PERSONAL or HOUSEHOLD workspace owned by the caller.
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
  perform app.workspace_append_event(v_ws, 'WORKSPACE_CREATED', 'workspace', v_ws, format('%s workspace created', lower(p_kind::text)), jsonb_build_object('kind', p_kind::text));
  return v_ws;
end $$;

-- Owner invites an existing principal into a HOUSEHOLD workspace with an explicit domain list.
create or replace function app.invite_participant(p_workspace uuid, p_principal uuid, p_role app.workspace_role, p_domains app.share_domain[]) returns uuid
language plpgsql security definer set search_path = app, public, extensions as $$
declare v_kind app.workspace_kind; v_id uuid := gen_random_uuid();
begin
  select kind into v_kind from app.workspaces where id = p_workspace;
  if v_kind is null or not app.is_workspace_owner(p_workspace) then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  if v_kind <> 'HOUSEHOLD' then raise exception 'INVALID_STATE: only household workspaces take participants' using errcode = 'P0001'; end if;
  if p_role = 'OWNER' then raise exception 'INVALID_ARGUMENT: a workspace has one owner' using errcode = 'P0001'; end if;
  if p_principal = auth.uid() then raise exception 'INVALID_ARGUMENT: the owner is already a member' using errcode = 'P0001'; end if;
  if not exists (select 1 from app.principals where id = p_principal) then raise exception 'NOT_FOUND: principal' using errcode = 'P0002'; end if;
  if cardinality(coalesce(p_domains, '{}')) = 0 then raise exception 'VALIDATION: at least one domain is required' using errcode = 'P0001'; end if;
  perform set_config('app.workspace_fn', '1', true);
  insert into app.workspace_memberships (id, workspace_id, principal_id, role, domains, status) values (v_id, p_workspace, p_principal, p_role, p_domains, 'INVITED');
  perform set_config('app.workspace_fn', '', true);
  perform app.workspace_append_event(p_workspace, 'PARTICIPANT_INVITED', 'workspace_membership', v_id, format('%s invited with domains %s', lower(p_role::text), array_to_string(p_domains, ',')), jsonb_build_object('role', p_role::text, 'domains', to_jsonb(p_domains)));
  return v_id;
end $$;

-- Only the invited principal accepts; nobody can accept on their behalf.
create or replace function app.accept_invitation(p_membership uuid) returns void
language plpgsql security definer set search_path = app, public, extensions as $$
declare v_ws uuid; v_principal uuid; v_status app.workspace_membership_status;
begin
  select workspace_id, principal_id, status into v_ws, v_principal, v_status from app.workspace_memberships where id = p_membership;
  if v_ws is null or v_principal is distinct from auth.uid() then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  if v_status <> 'INVITED' then raise exception 'INVALID_STATE: membership is %', v_status using errcode = 'P0001'; end if;
  perform set_config('app.workspace_fn', '1', true);
  update app.workspace_memberships set status = 'ACTIVE' where id = p_membership;
  perform set_config('app.workspace_fn', '', true);
  perform app.workspace_append_event(v_ws, 'INVITATION_ACCEPTED', 'workspace_membership', p_membership, 'invitation accepted');
end $$;

-- Owner revokes a participant; a participant may leave (revoke their own). The owner cannot revoke themself.
create or replace function app.revoke_membership(p_membership uuid) returns void
language plpgsql security definer set search_path = app, public, extensions as $$
declare v_ws uuid; v_principal uuid; v_role app.workspace_role; v_status app.workspace_membership_status;
begin
  select workspace_id, principal_id, role, status into v_ws, v_principal, v_role, v_status from app.workspace_memberships where id = p_membership;
  if v_ws is null or not (app.is_workspace_owner(v_ws) or v_principal = auth.uid()) then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  if v_role = 'OWNER' then raise exception 'INVALID_STATE: the owner cannot be revoked' using errcode = 'P0001'; end if;
  if v_status = 'REVOKED' then raise exception 'INVALID_STATE: already revoked' using errcode = 'P0001'; end if;
  perform set_config('app.workspace_fn', '1', true);
  update app.workspace_memberships set status = 'REVOKED' where id = p_membership;
  perform set_config('app.workspace_fn', '', true);
  perform app.workspace_append_event(v_ws, 'MEMBERSHIP_REVOKED', 'workspace_membership', p_membership, 'membership revoked');
end $$;

-- Owner grants purpose-limited, optionally expiring, read access to a principal OR a firm. Never both; never the owner.
create or replace function app.grant_consent(p_workspace uuid, p_grantee_principal uuid, p_grantee_org uuid, p_domains app.share_domain[], p_purpose app.consent_purpose, p_expires_at timestamptz default null, p_retention_note text default null) returns uuid
language plpgsql security definer set search_path = app, public, extensions as $$
declare v_id uuid := gen_random_uuid(); v_kind app.workspace_kind;
begin
  select kind into v_kind from app.workspaces where id = p_workspace;
  if v_kind is null or not app.is_workspace_owner(p_workspace) then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  if v_kind = 'FIRM' then raise exception 'INVALID_STATE: firm workspaces do not issue consent grants' using errcode = 'P0001'; end if;
  if (p_grantee_principal is null) = (p_grantee_org is null) then raise exception 'INVALID_ARGUMENT: exactly one grantee' using errcode = 'P0001'; end if;
  if p_grantee_principal = auth.uid() then raise exception 'INVALID_ARGUMENT: the owner needs no grant' using errcode = 'P0001'; end if;
  if p_grantee_principal is not null and not exists (select 1 from app.principals where id = p_grantee_principal) then raise exception 'NOT_FOUND: principal' using errcode = 'P0002'; end if;
  if p_grantee_org is not null and not exists (select 1 from app.organizations where id = p_grantee_org) then raise exception 'NOT_FOUND: organization' using errcode = 'P0002'; end if;
  if cardinality(coalesce(p_domains, '{}')) = 0 then raise exception 'VALIDATION: at least one domain is required' using errcode = 'P0001'; end if;
  if p_expires_at is not null and p_expires_at <= now() then raise exception 'VALIDATION: expires_at must be in the future' using errcode = 'P0001'; end if;
  perform set_config('app.workspace_fn', '1', true);
  insert into app.consent_grants (id, grantor_workspace_id, grantor_principal_id, grantee_principal_id, grantee_org_id, domains, purpose, expires_at, retention_note)
  values (v_id, p_workspace, auth.uid(), p_grantee_principal, p_grantee_org, p_domains, p_purpose, p_expires_at, left(p_retention_note, 500));
  perform set_config('app.workspace_fn', '', true);
  perform app.workspace_append_event(p_workspace, 'CONSENT_GRANTED', 'consent_grant', v_id, format('consent granted to %s for %s (%s)%s', case when p_grantee_org is null then 'a person' else 'a firm' end, array_to_string(p_domains, ','), p_purpose, case when p_expires_at is null then '' else ' until ' || to_char(p_expires_at at time zone 'UTC', 'YYYY-MM-DD') end),
    jsonb_build_object('domains', to_jsonb(p_domains), 'purpose', p_purpose::text, 'grantee_kind', case when p_grantee_org is null then 'PRINCIPAL' else 'ORG' end));
  return v_id;
end $$;

-- Owner revokes; the row stays (versioned), the grantee loses access at once.
create or replace function app.revoke_consent(p_grant uuid) returns void
language plpgsql security definer set search_path = app, public, extensions as $$
declare v_ws uuid; v_revoked timestamptz;
begin
  select grantor_workspace_id, revoked_at into v_ws, v_revoked from app.consent_grants where id = p_grant;
  if v_ws is null or not app.is_workspace_owner(v_ws) then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  if v_revoked is not null then raise exception 'INVALID_STATE: already revoked' using errcode = 'P0001'; end if;
  perform set_config('app.workspace_fn', '1', true);
  update app.consent_grants set revoked_at = now(), revoked_by = auth.uid(), version = version + 1 where id = p_grant;
  perform set_config('app.workspace_fn', '', true);
  perform app.workspace_append_event(v_ws, 'CONSENT_REVOKED', 'consent_grant', p_grant, 'consent revoked');
end $$;

-- What the caller may read in a workspace, as one row (or none): used by the web tier to build a WorkspaceActor
-- without trusting any client-supplied role or domain list. SECURITY DEFINER bypasses RLS, so it filters itself.
create or replace function app.my_workspace_access(p_workspace uuid)
returns table (workspace_id uuid, kind app.workspace_kind, label text, membership_role app.workspace_role, membership_status app.workspace_membership_status, readable_domains app.share_domain[], via text)
language sql stable security definer set search_path = app, public as $$
  with d as (select unnest(enum_range(null::app.share_domain)) as dom)
  select w.id, w.kind, w.label, m.role, m.status,
         coalesce((select array_agg(d.dom) from d where app.can_read_workspace_domain(w.id, d.dom)), '{}'::app.share_domain[]),
         case when m.status = 'ACTIVE' then 'MEMBERSHIP' when g.granted then 'CONSENT_GRANT' else 'INVITED_ONLY' end
  from app.workspaces w
  left join app.workspace_memberships m on m.workspace_id = w.id and m.principal_id = auth.uid()
  cross join lateral (select exists (select 1 from app.consent_grants g where g.grantor_workspace_id = w.id and g.revoked_at is null and (g.expires_at is null or g.expires_at > now())
                                      and (g.grantee_principal_id = auth.uid() or (g.grantee_org_id is not null and app.is_member(g.grantee_org_id)))) as granted) g
  where w.id = p_workspace and auth.uid() is not null
    -- Non-disclosing: a caller with neither a membership (any status) nor an active grant gets no row at all (S-01).
    and (m.id is not null or g.granted);
$$;

-- ---------------------------------------------------------------------------------------------
-- 8. Grants (N-04 discipline): tables first, then the full function inventory re-asserted.
-- ---------------------------------------------------------------------------------------------
grant select on app.principals, app.workspaces, app.workspace_memberships, app.consent_grants, app.workspace_events, app.workspace_event_heads to authenticated;
grant select, insert, update on app.cash_accounts, app.income_streams, app.liabilities, app.recurring_obligations, app.variable_spending, app.savings_goals to authenticated;
grant select, update on app.personal_profiles to authenticated;
grant select, insert on app.personal_record_revisions to authenticated;
grant all on app.principals, app.workspaces, app.workspace_memberships, app.consent_grants, app.workspace_events, app.workspace_event_heads,
  app.personal_profiles, app.cash_accounts, app.income_streams, app.liabilities, app.recurring_obligations, app.variable_spending, app.savings_goals, app.personal_record_revisions to service_role;

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
  app.grant_consent(uuid, uuid, uuid, app.share_domain[], app.consent_purpose, timestamptz, text), app.revoke_consent(uuid)
  to authenticated, service_role;
