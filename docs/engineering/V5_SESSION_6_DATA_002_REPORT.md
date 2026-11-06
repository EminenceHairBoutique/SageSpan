# V5 Session 6 — DATA-002: production persistence for the Personal computed layer + one atomic write path

**Date:** 2026-11-06. **Branch:** `feat/data-002-personal-runs` (from `feat/pr-003-identity` after #12 merged into it; targets #10's branch so it lands with PR-003/DATA-001). **Scope:** migration `0009` (personal snapshots, receipted calc runs, user decisions, retirement intake), the SECURITY DEFINER entry point `app.apply_personal_changes` that makes every personal write a single transaction, the web tier using it, and `/app/personal` gaining the receipted baseline, flags and ranked next steps. **Not in scope:** AI run persistence for production (AI track, `0010+`), the firm-side store (DATA-003), private document storage, member-management/consent UI.

## 1. Design
- **One write path.** DATA-001 wrote records over PostgREST row by row (non-transactional, disclosed as `DATA_PARTIAL_WRITE`). 0009 revokes `INSERT`/`UPDATE` on every personal table from `authenticated` and adds `app.apply_personal_changes(p_workspace, p_plan)`: it re-derives the ACTIVE OWNER from `auth.uid()`, overwrites `workspace_id` and actor columns (`changed_by`, `created_by`, `principal_id`) on every row, allow-lists tables and columns (updates: only the columns a table permits; revisions/runs/decisions have none), raises when an update matches no row of *this* workspace, appends one workspace event per logical change, and runs in one transaction. The repository's persist step is now one RPC; a failure saves nothing.
- **Computed layer, same discipline as the firm side.** `personal_snapshots` (one CURRENT per workspace, immutable except CURRENT→SUPERSEDED), `personal_calc_runs` (append-only; a CHECK enforces S-05 shape: COMPUTED/INSUFFICIENT_DATA/INFEASIBLE rows must be `request_hash_verified`, from `sagespan-calculator`, with a response; ERROR rows carry no response), `user_decisions` (append-only events), `retirement_intakes` (owner upsert; seeded all-MISSING by the replaced `create_personal_workspace`, backfilled for 0008 workspaces). Receipt *verification* stays in the web tier (`verifyPersonalReceipt`) because the database cannot reach the calculator; the database enforces shape and ownership and refuses to store a "success" the web tier did not mark verified.
- **Who reads computed results.** A clarity run cites cash, spending, debt and goals, so `app.can_read_personal_runs(ws)` requires read access to all four domains (owner, or a member/grantee whose scope covers all of them). A SAVINGS_GOALS-only participant sees goals, not runs. `/app/personal` says so to non-owners.
- **Backend-independent runs.** `runs.ts` now works over a two-method `PersonalDataSource` (`bundle()`, `mutate()`): `storeSource(store, actor)` for the demo file store, the Supabase repository for production. `refreshPersonalBaseline`/`runPersonalScenario` keep their old signatures as wrappers; `refreshBaseline`/`runScenario` are the source-based versions. `ensureCurrentSnapshot` was split into an async hash and a synchronous `applySnapshot` so the repository can run it inside its unit of work. Nothing in the engines, contracts or decision policy changed.

## 2. Changed files
- `supabase/migrations/0009_personal_runs_and_atomic_apply.sql`; `supabase/tests/009_*` (50 assertions: forged workspace/actor columns overwritten, allow-lists, atomic rollback on a constraint violation mid-plan, S-05 shape refusals, one-CURRENT, supersede+insert in one call, immutability, decisions, read scope for participant/stranger/partial grant/full grant, N-04 incl. "no direct write privilege on any personal table"); tests 005/007/008 inventories; 008 rewritten to write through the entry point; `realstack/run.mjs` extended (59 assertions).
- `apps/web/src/domain/personal/supabase-repository.ts` (computed-layer mappers, plan incl. snapshot status-only updates and retirement upsert, RPC persist with SQLSTATE→domain code), `repository.ts` (`supportsRuns = true`), `snapshot.ts` (`applySnapshot`), `runs.ts` (`PersonalDataSource`, `storeSource`, `refreshBaseline`, `runScenario`).
- `server/app-personal-actions.ts` (record writes now recompute the baseline; refresh, decide, what-if actions), `server/personal-form.ts` (`scenarioSpecFromForm` shared), `ui/personal/DecisionCard.tsx` (`decide` prop), `/app/personal` (baseline stats with provenance, flags, ranked next steps with decision recording, recompute), `ProductionHome` text.
- Tests: `supabase-repository.test.ts` (14: RPC payload, no-delta no-call, SQLSTATE mapping, DATA-002 plan shapes), `supabase-repository.realstack.test.ts` (4: adds snapshot/run/decision/retirement round-trip, supersede, DB refusal of an unverified success, participant isolation). CI `realstack` job runs 009.

## 3. Suites executed (sandbox)
| Suite | Result |
|---|---|
| SQL harness (shim, PostgreSQL 16, C.UTF-8) | 9 migrations; **9/9 files** (009: 50) — the shim's record comparison caught a collation mismatch in 009 locally before CI |
| typecheck / lint / `next build` | clean; 49 routes |
| Contracts Vitest | 49 |
| Web Vitest (calculator up) | **130 passed, 4 skipped** (realstack file without env) |
| Playwright | **20/20** |
| Calculator pytest | not re-run (no calculator change) |
| Real stack (CI `realstack`, PR #15 run `42241527406`, `a844c3d`) | **green on the first run**: genuine pgTAP **9 files, 310/310**, JWT/PostgREST harness **59/59**, repository vitest **4/4** (snapshot/run/decision/retirement round-trip, supersede, DB refusal of an unverified success, participant isolation) |

## 3a. Real-stack result
Run `42241527406` on `a844c3d`: all five jobs green. `supabase test db` 9 files / 310 assertions PASS (009 included), `realstack/run.mjs` 59/59, `supabase-repository.realstack.test.ts` 4/4. No iteration was needed: the shim's pgTAP-equivalent record comparison and C.UTF-8 cluster (added in PR-003c) caught the only real-stack-only failure class locally.

## 4. Coordination
No files under `apps/web/src/ai/**`, `packages/contracts/src/ai/**`, `docs/ai/**` touched. The AI track's #13 is disjoint from this PR. Migration `0009` is now taken; the AI track takes `0010+` (CLAUDE.md note). `PersonalRepository.bundle()` now carries snapshots/runs/decisions for production, so an AI tool reading a `PersonalBundle` gets the receipted results (or their absence) identically in demo and production.

## 5. Next
- **DATA-003:** firm-side Supabase store (`HouseholdBundle` over the 0002–0007 tables; the firm workflow functions already exist), then member-management and consent UI on `/app` backed by the 0008 RPCs, then private document storage.
- Merge order: #10 (now containing PR-003 + DATA-001 + this) → #13.
