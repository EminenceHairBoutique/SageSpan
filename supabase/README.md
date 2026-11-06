# Supabase schema, RLS and SQL tests

| Path | Contents |
|---|---|
| `migrations/0001_types.sql` | Enumerated types mirroring `packages/contracts/src/enums.ts`. |
| `migrations/0002_core_tables.sql` | Normalised, tenant-scoped tables with composite `(org_id, id)` foreign keys that make cross-organisation references impossible; typed fact columns with an exactly-one-value check. |
| `migrations/0003_rls.sql` | Row-level security on every table (forced), membership-based helper functions, per-role write policies, read-only rule registry, no anon access. |
| `migrations/0004_workflow_functions.sql` | SECURITY DEFINER workflow functions (`freeze_snapshot`, `resolve_conflict`, `document_exception`, `record_review`, `append_audit`), the transition matrix, and immutability triggers for snapshots, facts, reviews, check runs, packets and audit events. |
| `tests/*.test.sql` | pgTAP tests: tenant isolation, role permissions and workflow, immutability and hash chain, constraints and self-escalation. |

## Running

```bash
supabase start          # requires Docker
supabase db reset       # applies migrations
supabase test db        # runs tests/*.test.sql with pgTAP
```

## Execution status

Executed on 2026-11-05 against a real PostgreSQL cluster (16 locally; CI pins `postgres:15` to match `config.toml`'s `db.major_version`) via
`python supabase/tests/run_sql_tests.py`: all four migrations applied and all
four test files passed (45 assertions: tenant isolation 12, roles and workflow
16, immutability and hash chain 9, constraints 8). The same runner is the
`database` job in `.github/workflows/ci.yml`.

The runner provides two shims for plain Postgres (never applied on Supabase):
`tests/shim_supabase.sql` (roles `anon`/`authenticated`/`service_role`,
`auth.users`, `auth.uid()` reading `request.jwt.claims`) and
`tests/shim_pgtap.sql` (`plan`, `is`, `lives_ok`, `throws_ok`, `results_eq`,
`finish`; failures raise instead of printing `not ok`). When the real pgTAP
extension is available the shim is skipped. `supabase test db` on the local
stack remains the authoritative run before any deployment.

Two test-side fixes were needed to execute: the `tests` schema is now granted
to `anon`/`authenticated` (the files switch role mid-run and call the
helpers again), and the anon assertion in `001` expects `42501`, since anon
has no usage on the `app` schema at all.

## Notes

* The service role bypasses RLS and must only be used by trusted server-side
  maintenance paths; it never reaches a browser.
* `app.record_review` always records `auth.uid()` as the reviewer, so an admin
  cannot forge another user's review.
* The required-fact completeness gate (which facts the RMD check needs, with
  as-of validation) is evaluated in the application tier; the database enforces
  conflict gating, state transitions, roles, identities and immutability.
