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

These migrations and tests have **not been executed** in this build: the
Supabase local stack needs Docker, which was not running on the build machine.
They are syntax-checked only where noted in `docs/SECURITY_AND_LIMITS.md`.
Do not describe RLS as "proved" until `supabase test db` passes.

## Notes

* The service role bypasses RLS and must only be used by trusted server-side
  maintenance paths; it never reaches a browser.
* `app.record_review` always records `auth.uid()` as the reviewer, so an admin
  cannot forge another user's review.
* The required-fact completeness gate (which facts the RMD check needs, with
  as-of validation) is evaluated in the application tier; the database enforces
  conflict gating, state transitions, roles, identities and immutability.
