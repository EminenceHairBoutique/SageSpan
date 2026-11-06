-- PR-003a (migration 0008): principals, PERSONAL / HOUSEHOLD workspaces, memberships, purpose-limited consent
-- grants and domain-scoped RLS over the personal record tables. Two firms, three consumers:
--   Ana  owns a PERSONAL workspace (P) and a HOUSEHOLD workspace (H) shared with Ben, SAVINGS_GOALS only.
--   Cara is a stranger (no relationship to anyone).
--   Firm F1 (advisor Dee) receives a grant on P for CASH_FLOW + DEBT; firm F2 (advisor Eve) receives nothing.
-- Mirrors packages/contracts/src/__tests__/v5-contracts.test.ts (actorCanReadDomain) and V5 §21.1.
begin;
create extension if not exists pgtap with schema extensions;
create schema if not exists tests;
\ir 000_helpers.sql
select plan(74);

select tests.make_user('40000000-0000-0000-0000-00000000000a', 'ana@e.test');
select tests.make_user('40000000-0000-0000-0000-00000000000b', 'ben@e.test');
select tests.make_user('40000000-0000-0000-0000-00000000000c', 'cara@e.test');
select tests.make_user('40000000-0000-0000-0000-00000000000d', 'dee@e.test');
select tests.make_user('40000000-0000-0000-0000-00000000000e', 'eve@e.test');
insert into app.organizations (id, name, slug, policies) values
  ('f1f1f1f1-0000-0000-0000-000000000001', 'Firm F1 (synthetic)', 'pr003-f1', '{"separation_of_duties": true, "approver_roles": ["COMPLIANCE"], "allow_nonmaterial_exceptions": true, "tolerance": {"absolute": "1.00", "relative": "0.001"}}'),
  ('f2f2f2f2-0000-0000-0000-000000000002', 'Firm F2 (synthetic)', 'pr003-f2', '{"separation_of_duties": true, "approver_roles": ["COMPLIANCE"], "allow_nonmaterial_exceptions": true, "tolerance": {"absolute": "1.00", "relative": "0.001"}}');
insert into app.memberships (org_id, user_id, role) values
  ('f1f1f1f1-0000-0000-0000-000000000001', '40000000-0000-0000-0000-00000000000d', 'ADVISOR'),
  ('f2f2f2f2-0000-0000-0000-000000000002', '40000000-0000-0000-0000-00000000000e', 'ADVISOR');
create temp table t (k text primary key, v text);
grant all on t to authenticated, service_role;

-- ---------------------------------------------------------------- unauthenticated / anonymous
select tests.clear_auth();
select throws_ok($$ select app.create_personal_workspace('PERSONAL', 'x', 'x', 1, 0) $$, '42501', null, 'S-01 no principal without auth.uid()');

-- ---------------------------------------------------------------- Ana creates P and H
select tests.authenticate_as('40000000-0000-0000-0000-00000000000a');
insert into t values ('P', app.create_personal_workspace('PERSONAL', 'Ana (synthetic)', 'Ana', 1, 1500.00, 3, 'Single, salaried', 'Build a buffer')::text);
insert into t values ('H', app.create_personal_workspace('HOUSEHOLD', 'Ana & Ben (synthetic)', null, 2, 2500.00)::text);
select is((select count(*) from app.principals where id = '40000000-0000-0000-0000-00000000000a'), 1::bigint, 'require_principal created exactly one principal row for Ana');
select is((select display_name from app.principals where id = '40000000-0000-0000-0000-00000000000a'), 'Ana', 'display name taken from the first call');
select is((select role::text || '/' || status::text from app.workspace_memberships where workspace_id = (select v from t where k = 'P')::uuid), 'OWNER/ACTIVE', 'creator is the ACTIVE OWNER of P');
select is((select cash_floor from app.personal_profiles where workspace_id = (select v from t where k = 'P')::uuid), 1500.00::numeric, 'profile stores the cash floor');
select is((select count(*) from app.workspace_events where workspace_id = (select v from t where k = 'P')::uuid and event_type = 'WORKSPACE_CREATED'), 1::bigint, 'WORKSPACE_CREATED event appended');
select throws_ok($$ select app.create_personal_workspace('FIRM', 'x', 'x', 1, 0) $$, 'P0001', null, 'FIRM workspaces cannot be created through the consumer entry point');
select throws_ok($$ select app.create_personal_workspace('HOUSEHOLD', 'x', 'x', 1, 0) $$, 'P0001', null, 'a household needs at least two people');
select throws_ok($$ select app.create_personal_workspace('PERSONAL', 'x', 'x', 1, -1) $$, 'P0001', null, 'negative cash floor refused');

-- Owner writes records (RLS insert policy: ACTIVE OWNER only)
insert into app.cash_accounts (account_ref, workspace_id, label, kind, balance, balance_as_of) values ('40000000-0000-0000-0000-0000000000c1', (select v from t where k = 'P')::uuid, 'Checking (synthetic)', 'CHECKING', 3200.00, '2026-10-31');
insert into app.liabilities (workspace_id, label, kind, balance, balance_as_of, apr_percent, minimum_payment) values ((select v from t where k = 'P')::uuid, 'Card (synthetic)', 'CREDIT_CARD', 1800.00, '2026-10-31', 24.99, 55.00);
insert into app.savings_goals (workspace_id, label, kind, target_amount, saved_amount) values ((select v from t where k = 'H')::uuid, 'Move (synthetic)', 'MOVE', 6000.00, 900.00);
insert into app.cash_accounts (account_ref, workspace_id, label, kind, balance, balance_as_of) values ('40000000-0000-0000-0000-0000000000c2', (select v from t where k = 'H')::uuid, 'Joint checking (synthetic)', 'CHECKING', 4100.00, '2026-10-31');
select is((select count(*) from app.cash_accounts), 2::bigint, 'owner sees both of her cash accounts');
select is((select count(*) from app.workspaces), 2::bigint, 'owner sees exactly her two workspaces');

-- Direct writes to the membership / grant tables are refused even for the owner (privilege, then trigger).
select throws_ok($$ insert into app.workspace_memberships (workspace_id, principal_id, role, domains, status) values ((select v from t where k = 'H')::uuid, '40000000-0000-0000-0000-00000000000a', 'OWNER', '{}', 'ACTIVE') $$, '42501', null, 'S-02 authenticated cannot insert memberships directly');
select throws_ok($$ update app.workspace_memberships set role = 'PARTICIPANT' $$, '42501', null, 'S-02 authenticated cannot update memberships directly');
select throws_ok($$ insert into app.consent_grants (grantor_workspace_id, grantor_principal_id, grantee_org_id, domains, purpose) values ((select v from t where k = 'P')::uuid, '40000000-0000-0000-0000-00000000000a', 'f1f1f1f1-0000-0000-0000-000000000001', '{CASH_FLOW}', 'ADVISOR_REVIEW') $$, '42501', null, 'S-02 authenticated cannot insert consent grants directly');
select throws_ok($$ delete from app.cash_accounts $$, '42501', null, 'personal records are never deleted by end users');
select throws_ok($$ update app.workspace_events set summary = 'x' $$, '42501', null, 'S-04 workspace events are immutable');

-- ---------------------------------------------------------------- Ben: stranger until invited
select tests.authenticate_as('40000000-0000-0000-0000-00000000000b');
select is((select count(*) from app.workspaces), 0::bigint, 'S-01 Ben sees no workspaces before any relationship');
select is((select count(*) from app.cash_accounts), 0::bigint, 'S-01 Ben sees no cash accounts');
select is((select count(*) from app.savings_goals), 0::bigint, 'S-01 Ben sees no goals');
select is((select count(*) from app.principals), 0::bigint, 'Ben has no principal row yet and sees nobody');
select is(app.require_principal('Ben'), '40000000-0000-0000-0000-00000000000b'::uuid, 'Ben registers himself as a principal');

-- Ana invites Ben into H for SAVINGS_GOALS only; Ben cannot invite himself; Cara cannot invite anyone.
select tests.authenticate_as('40000000-0000-0000-0000-00000000000c');
select throws_ok($$ select app.invite_participant((select v from t where k = 'H')::uuid, '40000000-0000-0000-0000-00000000000c', 'PARTICIPANT', '{SAVINGS_GOALS}') $$, 'P0002', null, 'S-01 a stranger inviting into H gets non-disclosing NOT_FOUND');
select tests.authenticate_as('40000000-0000-0000-0000-00000000000a');
select throws_ok($$ select app.invite_participant((select v from t where k = 'P')::uuid, '40000000-0000-0000-0000-00000000000b', 'PARTICIPANT', '{SAVINGS_GOALS}') $$, 'P0001', null, 'a PERSONAL workspace takes no participants');
select throws_ok($$ select app.invite_participant((select v from t where k = 'H')::uuid, '40000000-0000-0000-0000-00000000000b', 'OWNER', '{SAVINGS_GOALS}') $$, 'P0001', null, 'one owner per workspace');
select throws_ok($$ select app.invite_participant((select v from t where k = 'H')::uuid, '40000000-0000-0000-0000-00000000000b', 'PARTICIPANT', '{}') $$, 'P0001', null, 'an invitation needs at least one domain');
select throws_ok($$ select app.invite_participant((select v from t where k = 'H')::uuid, '40000000-0000-0000-0000-00000000000c', 'PARTICIPANT', '{SAVINGS_GOALS}') $$, 'P0002', null, 'cannot invite someone who has not registered as a principal');
insert into t values ('mB', app.invite_participant((select v from t where k = 'H')::uuid, '40000000-0000-0000-0000-00000000000b', 'PARTICIPANT', '{SAVINGS_GOALS}')::text);

-- INVITED is not ACTIVE: Ben sees the invitation and the workspace label, but no records.
select tests.authenticate_as('40000000-0000-0000-0000-00000000000b');
select is((select status::text from app.workspace_memberships where id = (select v from t where k = 'mB')::uuid), 'INVITED', 'Ben sees his own invitation');
select is((select count(*) from app.workspaces), 1::bigint, 'invitee sees the workspace he was invited to');
select is((select count(*) from app.savings_goals), 0::bigint, 'INVITED grants no record access');
select tests.authenticate_as('40000000-0000-0000-0000-00000000000a');
select throws_ok($$ select app.accept_invitation((select v from t where k = 'mB')::uuid) $$, 'P0002', null, 'the owner cannot accept on the invitee''s behalf');
select tests.authenticate_as('40000000-0000-0000-0000-00000000000b');
select lives_ok($$ select app.accept_invitation((select v from t where k = 'mB')::uuid) $$, 'Ben accepts');
select throws_ok($$ select app.accept_invitation((select v from t where k = 'mB')::uuid) $$, 'P0001', null, 'accepting twice is INVALID_STATE');

-- Domain scoping: SAVINGS_GOALS yes; CASH_FLOW no; Ana's PERSONAL workspace never.
select is((select count(*) from app.savings_goals), 1::bigint, 'participant reads goals in H (granted domain)');
select is((select count(*) from app.cash_accounts), 0::bigint, 'participant does not read cash accounts in H (domain not granted) nor in P');
select is((select count(*) from app.liabilities), 0::bigint, 'participant does not read P liabilities');
select is((select count(*) from app.workspaces), 1::bigint, 'participant sees H only, never P');
select is((select count(*) from app.principals), 2::bigint, 'participant sees himself and the owner he shares H with');
select is(app.can_read_workspace_domain((select v from t where k = 'H')::uuid, 'SAVINGS_GOALS'), true, 'helper: SAVINGS_GOALS readable');
select is(app.can_read_workspace_domain((select v from t where k = 'H')::uuid, 'CASH_FLOW'), false, 'helper: CASH_FLOW not readable');
select is((select readable_domains::text || '|' || via from app.my_workspace_access((select v from t where k = 'H')::uuid)), '{SAVINGS_GOALS}|MEMBERSHIP', 'my_workspace_access reports the derived scope');
select is((select count(*) from app.my_workspace_access((select v from t where k = 'P')::uuid)), 0::bigint, 'my_workspace_access on P is empty for Ben (RLS on workspaces)');
-- participant is read-only
select throws_ok($$ insert into app.savings_goals (workspace_id, label, kind, target_amount) values ((select v from t where k = 'H')::uuid, 'Sneaky', 'OTHER', 1) $$, '42501', null, 'participant cannot insert records');
update app.savings_goals set saved_amount = 999999;
select is((select count(*) from app.savings_goals where saved_amount = 999999), 0::bigint, 'participant update touches zero rows (RLS USING hides them from UPDATE)');
select is((select saved_amount from app.savings_goals), 900.00::numeric, 'goal unchanged');
select throws_ok($$ select app.grant_consent((select v from t where k = 'H')::uuid, null, 'f2f2f2f2-0000-0000-0000-000000000002', '{SAVINGS_GOALS}', 'ADVISOR_REVIEW') $$, 'P0002', null, 'a participant cannot grant consent on the household');

-- ---------------------------------------------------------------- Firm access only through a grant
select tests.authenticate_as('40000000-0000-0000-0000-00000000000d');
select is((select count(*) from app.workspaces), 0::bigint, 'S-01 firm membership alone reaches no consumer workspace');
select is((select count(*) from app.cash_accounts), 0::bigint, 'S-01 firm advisor sees no consumer cash accounts without a grant');

select tests.authenticate_as('40000000-0000-0000-0000-00000000000a');
select throws_ok($$ select app.grant_consent((select v from t where k = 'P')::uuid, '40000000-0000-0000-0000-00000000000d', 'f1f1f1f1-0000-0000-0000-000000000001', '{CASH_FLOW}', 'ADVISOR_REVIEW') $$, 'P0001', null, 'exactly one grantee');
select throws_ok($$ select app.grant_consent((select v from t where k = 'P')::uuid, null, 'f1f1f1f1-0000-0000-0000-000000000001', '{CASH_FLOW}', 'ADVISOR_REVIEW', now() - interval '1 day') $$, 'P0001', null, 'expiry must be in the future');
insert into t values ('gF1', app.grant_consent((select v from t where k = 'P')::uuid, null, 'f1f1f1f1-0000-0000-0000-000000000001', '{CASH_FLOW,DEBT}', 'ADVISOR_REVIEW', now() + interval '30 days', 'Delete after the review')::text);

select tests.authenticate_as('40000000-0000-0000-0000-00000000000d');
select is((select count(*) from app.cash_accounts), 1::bigint, 'F1 advisor reads P cash accounts (CASH_FLOW granted) but not H''s');
select is((select count(*) from app.liabilities), 1::bigint, 'F1 advisor reads P liabilities (DEBT granted)');
select is((select count(*) from app.savings_goals), 0::bigint, 'F1 advisor cannot read goals (domain not granted)');
select is((select count(*) from app.workspace_events), 0::bigint, 'grantees never see the workspace event log');
select is((select via from app.my_workspace_access((select v from t where k = 'P')::uuid)), 'CONSENT_GRANT', 'access reported as CONSENT_GRANT, no membership');
select throws_ok($$ insert into app.cash_accounts (account_ref, workspace_id, label, kind, balance, balance_as_of) values ('40000000-0000-0000-0000-0000000000c9', (select v from t where k = 'P')::uuid, 'x', 'CHECKING', 1, '2026-10-31') $$, '42501', null, 'grantee is read-only');
select throws_ok($$ select app.revoke_consent((select v from t where k = 'gF1')::uuid) $$, 'P0002', null, 'the grantee cannot revoke the grant (owner only)');
select throws_ok($$ update app.consent_grants set domains = '{CASH_FLOW,DEBT,SAVINGS_GOALS}' $$, '42501', null, 'S-02 grantee cannot widen the grant');

-- Firm F2 (no grant) stays out.
select tests.authenticate_as('40000000-0000-0000-0000-00000000000e');
select is((select count(*) from app.cash_accounts) + (select count(*) from app.liabilities) + (select count(*) from app.workspaces), 0::bigint, 'S-01 the other firm sees nothing');

-- ---------------------------------------------------------------- Expiry and revocation
-- An expired grant is inert: insert one as the service role (migration-time shape) and check the helper.
select tests.authenticate_as('40000000-0000-0000-0000-00000000000c');
select is(app.require_principal(null), '40000000-0000-0000-0000-00000000000c'::uuid, 'Cara registers; display name falls back to the e-mail local part');
select tests.authenticate_service();
select set_config('app.workspace_fn', '1', true);
insert into app.consent_grants (id, grantor_workspace_id, grantor_principal_id, grantee_principal_id, domains, purpose, granted_at, expires_at)
  values ('40000000-0000-0000-0000-0000000000e1', (select v from t where k = 'P')::uuid, '40000000-0000-0000-0000-00000000000a', '40000000-0000-0000-0000-00000000000c', '{SPENDING}', 'SECOND_OPINION', now() - interval '2 days', now() - interval '1 day');
select set_config('app.workspace_fn', '', true);
select tests.authenticate_as('40000000-0000-0000-0000-00000000000c');
select is(app.can_read_workspace_domain((select v from t where k = 'P')::uuid, 'SPENDING'), false, 'an expired grant confers nothing');
select is((select count(*) from app.consent_grants where id = '40000000-0000-0000-0000-0000000000e1'), 1::bigint, 'the grantee can still see the (expired) grant record itself');

select tests.authenticate_as('40000000-0000-0000-0000-00000000000a');
select lives_ok($$ select app.revoke_consent((select v from t where k = 'gF1')::uuid) $$, 'owner revokes F1''s grant');
select throws_ok($$ select app.revoke_consent((select v from t where k = 'gF1')::uuid) $$, 'P0001', null, 'revoking twice is INVALID_STATE');
select is((select version from app.consent_grants where id = (select v from t where k = 'gF1')::uuid), 2, 'revocation bumps the grant version and keeps the row');
select tests.authenticate_as('40000000-0000-0000-0000-00000000000d');
select is((select count(*) from app.cash_accounts) + (select count(*) from app.liabilities), 0::bigint, 'revocation takes effect immediately for the firm');
select is((select count(*) from app.consent_grants where revoked_at is not null), 1::bigint, 'the former grantee still sees the revoked grant as history');

-- Membership revocation
select tests.authenticate_as('40000000-0000-0000-0000-00000000000a');
select throws_ok($$ select app.revoke_membership((select id from app.workspace_memberships where workspace_id = (select v from t where k = 'H')::uuid and role = 'OWNER')) $$, 'P0001', null, 'the owner cannot be revoked');
select lives_ok($$ select app.revoke_membership((select v from t where k = 'mB')::uuid) $$, 'owner revokes Ben');
select tests.authenticate_as('40000000-0000-0000-0000-00000000000b');
select is((select count(*) from app.savings_goals), 0::bigint, 'revoked participant loses access at once');

-- ---------------------------------------------------------------- Event chain integrity
select tests.authenticate_as('40000000-0000-0000-0000-00000000000a');
select results_eq(
  $$ select event_type from app.workspace_events where workspace_id = (select v from t where k = 'H')::uuid order by seq $$,
  $$ values ('WORKSPACE_CREATED'), ('PARTICIPANT_INVITED'), ('INVITATION_ACCEPTED'), ('MEMBERSHIP_REVOKED') $$,
  'S-04 household event log is linear and complete');
select is((select count(*) from app.workspace_events e where workspace_id = (select v from t where k = 'H')::uuid and seq > 1
             and previous_event_hash is distinct from (select event_hash from app.workspace_events p where p.workspace_id = e.workspace_id and p.seq = e.seq - 1)), 0::bigint, 'S-04 every event links to its predecessor''s hash');

-- ---------------------------------------------------------------- N-04: privilege inventory after 0008
select tests.clear_auth();
select is((select count(*) from information_schema.routine_privileges where specific_schema = 'app' and grantee = 'PUBLIC'), 0::bigint, 'N-04 PUBLIC still holds no EXECUTE in schema app');
select results_eq(
  $$ select distinct routine_name::text from information_schema.routine_privileges where specific_schema = 'app' and grantee = 'authenticated' order by 1 $$,
  $$ values ('accept_invitation'), ('build_snapshot_payload'), ('can_read_workspace_domain'), ('can_transition'), ('canonical_json'), ('confirm_fact'), ('coverage_summary'), ('create_personal_workspace'), ('current_role_in'), ('current_user_id'), ('disposition_discrepancy'), ('document_exception'), ('freeze_snapshot'), ('grant_consent'), ('has_role'), ('invite_participant'), ('is_member'), ('is_workspace_member'), ('is_workspace_owner'), ('latest_check_runs'), ('member_orgs'), ('my_workspace_access'), ('policy_record'), ('record_check_run'), ('record_review'), ('require_principal'), ('resolve_conflict'), ('revoke_consent'), ('revoke_membership'), ('send_to_review'), ('set_reconciliation_status'), ('sha256_canonical'), ('verify_audit_chain') $$,
  'N-04 authenticated may execute exactly the sanctioned entry points (0008 adds the workspace/consent entry points)');
select is((select count(*) from information_schema.routine_privileges where specific_schema = 'app' and grantee = 'authenticated' and routine_name in ('workspace_append_event', 'consent_grants_guard', 'workspace_memberships_guard', 'workspace_events_immutable')), 0::bigint, 'N-04 internal workspace functions are not executable by authenticated');

select * from finish();
rollback;
