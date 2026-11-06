-- SageSpan audit probes (2026-11-05). Each probe performs an action that SHOULD be
-- denied in production and reports whether it SUCCEEDED (= finding confirmed).
-- Runs on the repo's PG16 + Supabase/pgTAP shim harness, as the shim roles.
begin;
create schema if not exists tests;
\ir 000_helpers.sql
create temp table probe(id text, expectation text, result text);
grant all on probe to authenticated;

select tests.make_user('20000000-0000-0000-0000-0000000000a1', 'analyst@c.test');
select tests.make_user('20000000-0000-0000-0000-0000000000a2', 'advisor@c.test');
select tests.make_user('20000000-0000-0000-0000-0000000000a3', 'cco@c.test');
select tests.make_user('20000000-0000-0000-0000-0000000000a5', 'viewer@c.test');
select tests.make_user('20000000-0000-0000-0000-0000000000d1', 'outsider@d.test');
insert into app.organizations (id, name, slug, policies) values
 ('cccccccc-0000-0000-0000-000000000001', 'Org C (synthetic)', 'probe-c', '{"separation_of_duties": true, "approver_roles": ["COMPLIANCE"], "allow_nonmaterial_exceptions": false}'),
 ('dddddddd-0000-0000-0000-000000000001', 'Org D (synthetic)', 'probe-d', '{}');
insert into app.memberships (org_id, user_id, role) values
 ('cccccccc-0000-0000-0000-000000000001', '20000000-0000-0000-0000-0000000000a1', 'ANALYST'),
 ('cccccccc-0000-0000-0000-000000000001', '20000000-0000-0000-0000-0000000000a2', 'ADVISOR'),
 ('cccccccc-0000-0000-0000-000000000001', '20000000-0000-0000-0000-0000000000a3', 'COMPLIANCE'),
 ('cccccccc-0000-0000-0000-000000000001', '20000000-0000-0000-0000-0000000000a5', 'VIEWER'),
 ('dddddddd-0000-0000-0000-000000000001', '20000000-0000-0000-0000-0000000000d1', 'ADMIN');
insert into app.households (id, org_id, label, tax_year, workflow_status) values
 ('c1000000-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001', 'HH reviewed', 2026, 'REVIEWED'),
 ('c1000000-0000-0000-0000-000000000002', 'cccccccc-0000-0000-0000-000000000001', 'HH blocked', 2026, 'RECONCILIATION_PENDING'),
 ('c1000000-0000-0000-0000-000000000003', 'cccccccc-0000-0000-0000-000000000001', 'HH unsupported', 2026, 'READY_TO_FREEZE'),
 ('c1000000-0000-0000-0000-000000000004', 'cccccccc-0000-0000-0000-000000000001', 'HH retry', 2026, 'READY_TO_FREEZE');
insert into app.accounts (id, org_id, household_id, label, account_type) values
 ('c1000000-0000-0000-0000-0000000000a1', 'cccccccc-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002', 'IRA', 'TRADITIONAL_IRA');
insert into app.source_documents (id, org_id, household_id, source_kind, filename, sha256, byte_length, parser_version) values
 ('c1000000-0000-0000-0000-0000000000d1', 'cccccccc-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002', 'PLAN_EXPORT', 'plan.json', repeat('d', 64), 1, 'probe');
insert into app.facts (id, org_id, household_id, subject_type, subject_id, field_key, value_kind, value_number, value_currency, as_of_date, source_document_id, verification_status, superseded) values
 ('c1000000-0000-0000-0000-0000000000f1', 'cccccccc-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002', 'ACCOUNT', 'c1000000-0000-0000-0000-0000000000a1', 'account.year_end_balance', 'NUMBER', 612000, 'USD', '2025-12-31', 'c1000000-0000-0000-0000-0000000000d1', 'NEEDS_CONFIRMATION', false),
 ('c1000000-0000-0000-0000-0000000000f2', 'cccccccc-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002', 'ACCOUNT', 'c1000000-0000-0000-0000-0000000000a1', 'account.year_end_balance', 'NUMBER', 1, 'USD', '2025-12-31', 'c1000000-0000-0000-0000-0000000000d1', 'FACT_CONFIRMED', true);

create or replace function pg_temp.try(p_id text, p_expect text, p_sql text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
    insert into probe values (p_id, p_expect, 'SUCCEEDED (finding confirmed)');
  exception when others then
    insert into probe values (p_id, p_expect, 'denied: ' || sqlstate || ' ' || left(sqlerrm, 70));
  end;
end $$;
grant execute on function pg_temp.try(text, text, text) to authenticated;

-- S-01a: VIEWER skips record_review entirely (no review row, no attestation, no SoD): REVIEWED -> APPROVED.
select tests.authenticate_as('20000000-0000-0000-0000-0000000000a5');
select pg_temp.try('S-01a', 'viewer must not approve via transition_household', $q$ select app.transition_household('c1000000-0000-0000-0000-000000000001', 'APPROVED') $q$);
-- S-01b: user from ANOTHER org (no membership in C) moves Org C household, knowing only its UUID.
select tests.authenticate_as('20000000-0000-0000-0000-0000000000d1');
select pg_temp.try('S-01b', 'non-member must not change another tenant''s status', $q$ select app.transition_household('c1000000-0000-0000-0000-000000000002', 'READY_TO_FREEZE') $q$);
-- S-01c: ANALYST writes workflow_status directly through the households UPDATE policy.
select tests.authenticate_as('20000000-0000-0000-0000-0000000000a1');
select pg_temp.try('S-01c', 'analyst must not set workflow_status by UPDATE', $q$ update app.households set workflow_status = 'EXPORTED' where id = 'c1000000-0000-0000-0000-000000000002' $q$);
-- S-02: outsider appends a forged SYSTEM approval into Org C's audit chain.
select tests.authenticate_as('20000000-0000-0000-0000-0000000000d1');
select pg_temp.try('S-02', 'non-member must not append to another tenant''s audit chain', $q$ select app.append_audit('cccccccc-0000-0000-0000-000000000001', 'APPROVAL_RECORDED', 'review', null, 'forged approval', '{}'::jsonb, 'SYSTEM') $q$);
-- S-05a: ANALYST (no fact.confirm permission in TS) promotes a plan-tool value to FACT_CONFIRMED directly.
select tests.authenticate_as('20000000-0000-0000-0000-0000000000a1');
select pg_temp.try('S-05a', 'analyst must not confirm facts by UPDATE', $q$ update app.facts set verification_status = 'FACT_CONFIRMED' where id = 'c1000000-0000-0000-0000-0000000000f1' $q$);
-- S-05b: ANALYST resurrects a superseded fact.
select pg_temp.try('S-05b', 'superseded facts must stay superseded', $q$ update app.facts set superseded = false where id = 'c1000000-0000-0000-0000-0000000000f2' $q$);

-- S-05d: ANALYST inserts a brand-new fact already marked FACT_CONFIRMED (no evidence, no confirmation step).
select pg_temp.try('S-05d', 'new facts must start in a server-derived status', $q$ insert into app.facts (org_id, household_id, subject_type, subject_id, field_key, value_kind, value_number, value_currency, as_of_date, source_document_id, verification_status) values ('cccccccc-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002', 'ACCOUNT', 'c1000000-0000-0000-0000-0000000000a1', 'account.year_end_balance', 'NUMBER', 999999, 'USD', '2025-12-31', null, 'FACT_CONFIRMED') $q$);
-- S-05e: ANALYST registers a 'custodian statement' with a self-declared hash (no bytes ever uploaded).
select pg_temp.try('S-05e', 'source documents and their hashes must come from the trusted upload path', $q$ insert into app.source_documents (org_id, household_id, source_kind, filename, sha256, byte_length, parser_version) values ('cccccccc-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002', 'CUSTODIAN_STATEMENT', 'made-up-statement.pdf', repeat('a', 64), 1, 'none') $q$);

-- S-03: freeze accepts a caller-supplied payload whose hash is NOT sha256(payload).
select pg_temp.try('S-03', 'freeze must recompute the hash and reject a mismatch', $q$ select app.freeze_snapshot('c1000000-0000-0000-0000-000000000003', '{"facts":[]}'::jsonb, repeat('0', 64)) $q$);
-- S-05c: ANALYST inserts a fabricated UNSUPPORTED check run (no engine receipt).
insert into app.check_runs (org_id, snapshot_id, household_id, check_type, request_payload, request_sha256, response, response_sha256, executed_by, run_status, coverage_status)
select org_id, id, household_id, 'RMD_ANNUAL', '{}'::jsonb, repeat('3', 64), '{}'::jsonb, repeat('4', 64), auth.uid(), 'UNSUPPORTED', 'UNSUPPORTED' from app.snapshots where household_id = 'c1000000-0000-0000-0000-000000000003';
insert into probe select 'S-05c', 'check runs must come only from the trusted service with a receipt', case when count(*) = 1 then 'SUCCEEDED (finding confirmed)' else 'denied' end from app.check_runs where household_id = 'c1000000-0000-0000-0000-000000000003';
select app.transition_household('c1000000-0000-0000-0000-000000000003', 'CHECK_COMPLETE');
select app.transition_household('c1000000-0000-0000-0000-000000000003', 'REVIEW_PENDING');
select tests.authenticate_as('20000000-0000-0000-0000-0000000000a2');
select app.record_review((select id from app.snapshots where household_id = 'c1000000-0000-0000-0000-000000000003'), 'REVIEWED', 'reviewed by advisor for probe');
-- S-06: COMPLIANCE approves a snapshot whose ONLY run is UNSUPPORTED.
select tests.authenticate_as('20000000-0000-0000-0000-0000000000a3');
select pg_temp.try('S-06', 'approval must not treat an UNSUPPORTED-only run as a completed check', $q$ select app.record_review((select id from app.snapshots where household_id = 'c1000000-0000-0000-0000-000000000003'), 'APPROVED', 'approve unsupported-only run', true) $q$);

-- N-01: discrepancy disposition (and its amounts) can be rewritten after approval.
select tests.clear_auth();
insert into app.discrepancies (org_id, check_run_id, household_id, classification, comparable, computed_amount, imported_amount, delta_amount, explanation, next_step, status, disposition)
select org_id, id, household_id, 'RULE_DISAGREEMENT', true, 25098.04, 24000, 1098.04, 'probe', 'probe', 'DISPOSITIONED', '{"by":"20000000-0000-0000-0000-0000000000a2","note":"original"}'::jsonb from app.check_runs where household_id = 'c1000000-0000-0000-0000-000000000003';
select tests.authenticate_as('20000000-0000-0000-0000-0000000000a2');
select pg_temp.try('N-01', 'a recorded disposition and its amounts must be immutable', $q$ update app.discrepancies set delta_amount = 0, classification = 'WITHIN_TOLERANCE', disposition = '{"by":"20000000-0000-0000-0000-0000000000a2","note":"rewritten"}'::jsonb where household_id = 'c1000000-0000-0000-0000-000000000003' $q$);

-- N-02: one transient ERROR run blocks approval forever, even after a successful retry.
select tests.authenticate_as('20000000-0000-0000-0000-0000000000a1');
select app.freeze_snapshot('c1000000-0000-0000-0000-000000000004', '{"facts":[]}'::jsonb, repeat('5', 64));
insert into app.check_runs (org_id, snapshot_id, household_id, check_type, request_payload, request_sha256, response, response_sha256, executed_by, run_status, coverage_status, error)
select org_id, id, household_id, 'RMD_ANNUAL', '{}'::jsonb, repeat('6', 64), null::jsonb, null::text, auth.uid(), 'ERROR'::app.run_status, null::app.coverage_status, '{"code":"SERVICE_UNAVAILABLE"}'::jsonb from app.snapshots where household_id = 'c1000000-0000-0000-0000-000000000004'
union all
select org_id, id, household_id, 'RMD_ANNUAL', '{}'::jsonb, repeat('7', 64), '{}'::jsonb, repeat('8', 64), auth.uid(), 'PASS'::app.run_status, 'SUPPORTED_VERIFIED'::app.coverage_status, null::jsonb from app.snapshots where household_id = 'c1000000-0000-0000-0000-000000000004';
select app.transition_household('c1000000-0000-0000-0000-000000000004', 'CHECK_COMPLETE');
select app.transition_household('c1000000-0000-0000-0000-000000000004', 'REVIEW_PENDING');
select tests.authenticate_as('20000000-0000-0000-0000-0000000000a2');
select app.record_review((select id from app.snapshots where household_id = 'c1000000-0000-0000-0000-000000000004'), 'REVIEWED', 'reviewed by advisor for probe');
select tests.authenticate_as('20000000-0000-0000-0000-0000000000a3');
select pg_temp.try('N-02', 'a superseded ERROR attempt should not block approval of a later PASS', $q$ select app.record_review((select id from app.snapshots where household_id = 'c1000000-0000-0000-0000-000000000004'), 'APPROVED', 'approve after a successful retry', true) $q$);

-- N-03: audit chain linearity when >2 events are appended in one transaction (created_at = now() ties).
select tests.clear_auth();
select app.append_audit('dddddddd-0000-0000-0000-000000000001', 'PROBE_EVENT', 'probe', null, 'e' || g, '{}'::jsonb, 'SYSTEM') from generate_series(1, 12) g;
insert into probe select 'N-03', 'each audit event must have exactly one successor (linear chain)',
  case when max(c) > 1 then 'FORKED: ' || sum(c - 1) || ' extra successor link(s) in 12 events' else 'linear' end
  from (select previous_event_hash, count(*) c from app.audit_events where org_id = 'dddddddd-0000-0000-0000-000000000001' and previous_event_hash is not null group by 1) s;

select tests.clear_auth();
select 'PROBE ' || id || ' | ' || result || ' | expected: ' || expectation from probe order by id;
rollback;
