# Migration number registry (central; coordinator-maintained)

**Rule (see `docs/project/SESSION_OPERATING_MODEL.md` §4):** a number is allocated here *before* the SQL file is created, by the integration coordinator, and is burned once allocated — even if the branch is abandoned. Applied migrations are forward-only and never edited or renumbered. Two open PRs must never carry the same number. Every migration ends with an explicit grant audit for `PUBLIC`, `anon`, `authenticated`, `service_role` and a matching `supabase/tests/NNNN_*.test.sql` file; the CI `database` job (shim) and `realstack` job (genuine pgTAP on a disposable local Supabase) run every file in order.

| Number | File | Track | Branch / PR | Purpose | Status |
|---|---|---|---|---|---|
| 0001 | `0001_types.sql` | data | V3 baseline | enums and domain types | APPLIED (master) |
| 0002 | `0002_core_tables.sql` | data | V3 baseline | organisations, households, accounts, facts, documents, snapshots, check runs, reviews, audit | APPLIED (master) |
| 0003 | `0003_rls.sql` | data | V3 baseline | tenant RLS and helpers | APPLIED (master) |
| 0004 | `0004_workflow_functions.sql` | data | V3 baseline | workflow transitions, freeze, record check run, review/approval entry points | APPLIED (master) |
| 0005 | `0005_trust_boundaries.sql` | data | PR-001 (#5) | S-01…S-05, N-01, N-03…N-05: explicit grants, transition restriction, linear audit chain, canonical snapshot verification, receipts, write-once discrepancies | APPLIED (master) |
| 0006 | `0006_seed_rule_sets.sql` | finance | PR-001 (#5), regenerated in #11 | **generated** published rule-set seed (`services/calculator/scripts/export_rule_sets_sql.py`; `--check` in CI) | APPLIED (master) |
| 0007 | `0007_coverage_and_reproducibility.sql` | data | PR-002 (#9) | S-06 typed review outcome, S-07 snapshot payload v2 with policy at freeze, N-02 latest-attempt semantics | APPLIED (master) |
| 0008 | `0008_workspaces_and_consent.sql` | data | PR-003a (#10) | principals, personal/household workspaces, memberships, consent grants, domain-scoped RLS, personal record tables, `app.workspace_fn` sentinel (coordination only) | APPLIED (master) |
| 0009 | `0009_personal_runs_and_atomic_apply.sql` | data | DATA-002 (#15 → #10) | personal snapshots, receipted calc runs (S-05 shape CHECK), user decisions, retirement intake, `app.apply_personal_changes` single atomic write path | APPLIED (master) |
| 0010 | — | **unallocated** | — | next free number. Expected claimants, in the order the roadmap calls for them: **DATA-003a** firm-side store adjustments (if any SQL is needed over 0002–0007) · **AI persistence** (append-only `ai_runs` / feedback keyed by `workspace_id`, RLS mirroring 0008, writes only through a SECURITY DEFINER entry point) · **PLAN-001** method registry rows (generated seed, like 0006). The coordinator assigns on request. | OPEN |

**Historical note:** the DATA-001 session note "the AI track uses `0010+`" (2026-11-06, `docs/architecture/PARALLEL_SESSIONS_AND_DATA_BOUNDARY.md` §1) was a coordination convention between two concurrent sessions, not an allocation. It is superseded by this registry: `0010` is unallocated until a track asks for it.
