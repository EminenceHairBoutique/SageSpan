# Supabase schema, RLS and SQL tests

| Path | Contents |
|---|---|
| `migrations/0001_types.sql` | Enumerated types mirroring `packages/contracts/src/enums.ts`. |
| `migrations/0002_core_tables.sql` | Normalised, tenant-scoped tables with composite `(org_id, id)` foreign keys that make cross-organisation references impossible; typed fact columns with an exactly-one-value check. |
| `migrations/0003_rls.sql` | Row-level security on every table, membership-based helper functions, per-role write policies, read-only rule registry, no anon access. |
| `migrations/0004_workflow_functions.sql` | SECURITY DEFINER workflow functions (`freeze_snapshot`, `resolve_conflict`, `document_exception`, `record_review`, `append_audit`), the transition matrix, and immutability triggers for snapshots, facts, reviews, check runs, packets and audit events. |
| `migrations/0005_trust_boundaries.sql` | PR-001 hardening (forward-only, replaces functions in place): privilege inventory (revoke all, grant explicitly), column-level `households` grant plus the `app.workflow_fn` sentinel trigger, serialised audit chain (`audit_chain_heads`, `seq`, derived `actor_type`, event allow-list, `verify_audit_chain`), `canonical_json`/`sha256_canonical`, full freeze verification with required facts, `confirm_fact`, `record_check_run` against the rule-set registry, service-only document registration, write-once dispositions, approver matrix in `record_review`, `set_reconciliation_status` and `send_to_review` entry points. |
| `migrations/0006_seed_rule_sets.sql` | **Generated** by `services/calculator/scripts/export_rule_sets_sql.py` from the Python rule registry: six rule sets (five PUBLISHED RMD sets, one DRAFT tax set) with checksums and 62 parameters. `tests/test_rule_set_seed.py` fails when it drifts. |
| `migrations/0007_coverage_and_reproducibility.sql` | PR-002: `app.review_outcome`, snapshot payload v2, `policy_record`, `latest_check_runs`, `coverage_summary`, `clock_timestamp()` on check runs. |
| `migrations/0008_workspaces_and_consent.sql` | PR-003a: `principals` (= `auth.users`), `workspaces` (PERSONAL / HOUSEHOLD / FIRM), `workspace_memberships` with share domains, `consent_grants` (to a person or a firm; expiring, revocable, versioned), per-workspace hashed event log, the personal record tables with one share domain each, `can_read_workspace_domain` / `my_workspace_access`, SECURITY DEFINER entry points (`require_principal`, `create_personal_workspace`, `invite_participant`, `accept_invitation`, `revoke_membership`, `grant_consent`, `revoke_consent`). RLS is ENABLE-not-FORCE like 0005. |
| `migrations/0009_personal_runs_and_atomic_apply.sql` | DATA-002: `personal_snapshots`, `personal_calc_runs` (S-05 shape CHECK), `user_decisions`, `retirement_intakes`; `can_read_personal_runs`; **`apply_personal_changes`** — the single atomic write path for every personal table (direct INSERT/UPDATE revoked from `authenticated`); `create_personal_workspace` replaced to seed the intake. |
| `tests/000_helpers.sql` | Test-only schema `tests`: users, JWT impersonation, `authenticate_service()`, `seed_household()`, `calc_request()` / `calc_response()` (synthetic receipts), `set_workflow()` (sentinel-wrapped). |
| `tests/001`–`004` | Tenant isolation (12), roles and workflow (23), immutability and hash chain (11), constraints (8). |
| `tests/005_trust_boundaries.test.sql` | The audit probes inverted into 71 assertions: every S-/N- finding in PR-001 scope as `throws_ok` with the expected SQLSTATE, plus the positive paths and the exact inventory of functions executable by `authenticated`. |
| `tests/006_canonical_json.test.sql` | **Generated** by `services/calculator/scripts/export_canonical_sql_test.py` from `fixtures/synthetic/canonical`: proves `app.canonical_json` is byte-identical to the Python and TypeScript canonicalisers (9 assertions). |
| `tests/007_*`, `tests/008_*`, `tests/009_*` | PR-002 (43), PR-003a (78, writes through the entry point since 0009) and DATA-002 (50: forged columns overwritten, allow-lists, mid-plan rollback, S-05 refusals, one CURRENT snapshot, read scope, N-04) — PR-003a originally (74: two firms, three consumers, invitation lifecycle, one-domain household sharing, firm grant, expiry, revocation, refused direct writes, event chain, N-04 inventory). |
| `realstack/run.mjs` | **Real-stack harness** (Node, `@supabase/supabase-js`): creates synthetic users through GoTrue admin, signs them in for real JWTs and asserts allowed/denied PostgREST reads, RPC entry points and refused writes under RLS. Needs `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (`supabase status -o env`). Run by the CI `realstack` job after `supabase start`, `db reset` and `supabase test db`. |
| `tests/probes/` | Exploratory probes (`run_probe.py <file.sql>`), including `advisor_equivalent.sql`, a local stand-in for the Supabase Security Advisor queries. Probes are evidence, not tests. |

## Running

On the real stack (requires Docker; runs in the CI `realstack` job; not yet run from a developer machine for this repository):

```bash
supabase start -x studio,imgproxy,logflare,vector,edge-runtime
supabase db reset                                  # applies migrations 0001–0009
supabase test db supabase/tests/00*.test.sql       # genuine pgTAP; plan counts are enforced
eval "$(supabase status -o env)"
SUPABASE_URL="$API_URL" SUPABASE_ANON_KEY="$ANON_KEY" SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY" node supabase/realstack/run.mjs
```

The service-role key is used only by the harness process; the web application never reads it.

Without Docker, against any PostgreSQL 15–18 (this is what CI runs):

```bash
python supabase/tests/run_sql_tests.py          # uses PGHOST/PGPORT/PGUSER if set, else an embedded cluster
```

The runner looks for `initdb`/`pg_ctl` on `PATH` or in `SAGESPAN_PG_BIN`
(for example the `embedded-postgres` npm binaries) and listens on
`SAGESPAN_TEST_PG_PORT` (default 54329). It applies the shims
`tests/shim_supabase.sql` (roles `anon`/`authenticated`/`service_role` with
`BYPASSRLS`, `auth.users`, `auth.uid()` reading `request.jwt.claims`) and
`tests/shim_pgtap.sql` (`plan`, `is`, `lives_ok`, `throws_ok`, `results_eq`,
`finish`; failures raise instead of printing `not ok`), then every migration,
then every `*.test.sql` in its own transaction. When the real pgTAP extension
is available the shim is skipped. Under the shim the runner also fails a file
whose `plan(n)` does not equal the number of assertions that ran, because real
pgTAP does.

## Execution status

* 2026-11-05 (PR-001): 6 migrations applied and **6/6 test files, 117
  assertions** passed on PostgreSQL 18.6 (embedded, Windows) via the runner.
  CI's `database` job runs the same files on `postgres:15` (matching
  `config.toml` `db.major_version`).
* 2026-11-06 (PR-002, PR-003a): 8 migrations, **8/8 files** on embedded PostgreSQL 16
  via the runner. Three pre-existing `plan()` mismatches (002: 20→23, 003: 10→11,
  005: 58→71) were corrected; they would have failed under real pgTAP.
* 2026-11-06 (PR-003c): the real Supabase stack ran in the CI `realstack` job
  (PR #10, run 3): `supabase test db` **8 files, 251/251 assertions, PASS** with
  genuine pgTAP, and `realstack/run.mjs` **50/50** with real GoTrue JWTs over
  PostgREST. Runs 1–2 found an implicit-collation bug in three test files and a
  deprecated auth setting; both fixed. This proves RLS and the entry points on a
  disposable local stack, not a deployed project's configuration.

## Decisions recorded in 0005

* **`app` stays in `[api] schemas`** (`config.toml`): the SECURITY DEFINER
  entry points (`freeze_snapshot`, `resolve_conflict`, `document_exception`,
  `confirm_fact`, `record_check_run`, `disposition_discrepancy`,
  `record_review`, `set_reconciliation_status`, `send_to_review`,
  `build_snapshot_payload`, `verify_audit_chain`, `canonical_json`,
  `sha256_canonical`) are meant to be called over PostgREST RPC by the
  application server with the user's JWT. Every entry point asserts
  membership and role *on entry* (`assert_role` / `assert_member`) before
  touching data, so exposure of the schema does not widen what a caller can
  do. Internal functions (`transition_household`, `assert_role`,
  `append_audit`, `audit_core`, `request_role`, `is_privileged_session`,
  trigger functions) are not executable by `authenticated` at all.
* **Explicit grant block at the end of every migration.** Functions created or
  replaced in a migration were observed to carry the built-in PUBLIC EXECUTE
  grant (`=X/`) despite `alter default privileges`, so 0005 ends with
  `revoke execute on all functions in schema app from public, anon,
  authenticated, service_role` followed by explicit grants. Later migrations
  that create functions must repeat that block; `005` asserts the exact list
  executable by `authenticated` and the advisor-equivalent probe lists
  anything executable by PUBLIC or `anon`.
* **`enable` rather than `force row level security`.** The workflow
  functions are SECURITY DEFINER and owned by `postgres`, which also owns the
  tables; with FORCE the owner would be subject to the policies inside those
  functions and every function would need its own policy bypass. `authenticated`
  and `anon` are not owners and remain fully governed by RLS; `service_role`
  has `BYPASSRLS` as on Supabase. This must be re-checked on the real stack,
  where `postgres` is not a superuser.
* **Audit events are service-written only.** `append_audit(org, event_type,
  entity_type, entity_id, summary, payload)` is executable by `service_role`
  only; workflow functions call it internally. `actor_type` is derived, never
  supplied. The chain is per organisation, serialised by an advisory lock on
  `audit_chain_heads`, with `seq` in the hashed core and uniqueness on both
  `(org_id, seq)` and `(org_id, previous_event_hash)`, which makes a fork
  impossible to commit.
* **Documents are registered by the service only.** `authenticated` can no
  longer insert `source_documents`; the server-side path that stores bytes,
  hashes them and registers the row is the next piece of work (PR-003).
* **The required-fact completeness gate now runs in SQL too**
  (`app.rmd_required_facts`, used by `freeze_snapshot`), mirroring the
  application tier's freeze gate.

## Notes

* The service role bypasses RLS and must only be used by trusted server-side
  maintenance paths; it never reaches a browser.
* `app.record_review` always records `auth.uid()` as the reviewer, so an admin
  cannot forge another user's review; the approver matrix (`COMPLIANCE`,
  `ADVISOR` capability × firm policy `approver_roles`) is the same table the
  TypeScript tier uses (`approvalDecision` in `packages/contracts`).
* The `tests` schema is granted to `anon`/`authenticated`/`service_role`
  because the files switch role mid-run and call the helpers again; the anon
  assertions expect `42501`, since anon has no usage on schema `app`.
