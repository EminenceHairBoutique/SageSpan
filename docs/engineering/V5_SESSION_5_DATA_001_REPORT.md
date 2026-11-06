# V5 Session 5 — DATA-001: Supabase store adapter for personal records

**Date:** 2026-11-06. **Branch:** `feat/data-001-store-adapter` (stacked on `feat/pr-003-identity`, PR #10, after merging `master` @ `5299791`). **Scope:** production persistence for the Personal workspace's *records* (profile/guardrails, cash accounts, income, bills, variable spending, debts, goals, revision history) through Supabase under the signed-in user's session, plus the `/app/personal` pages and a production "Start fresh". **Not in scope (deliberately):** snapshots, receipted calc runs, decisions, AI runs (DATA-002), the firm-side store (DATA-003), private document storage, member-management UI, any new migration.

## 1. Design decision: a unit of work over the 0008 tables, not a second domain layer
The personal domain functions (`records.ts`, `mutations.ts`, `queries.ts`) are pure, synchronous, well-tested functions over a `DataState`. Rewriting them as async repository calls would have produced a second copy of every validation and ownership rule. Instead:

- `SupabasePersonalRepository.load()` reads every row the user may see of **one** workspace (PostgREST, anon key + the user's JWT; RLS from 0008 decides) into a `DataState`-shaped view with every other collection empty.
- `mutate(fn)` runs the **unchanged** domain function against the view, then `planPersist(before, after)` diffs it: new rows → inserts in FK order (cash accounts and liabilities before obligations/goals; revisions last), changed rows → per-row updates, profile → one update. Domain-generated ids (`cash_…`) are remapped to UUIDs everywhere they appear (row ids, `supersedes_id`, `liability_id`, `funded_from_account_ref`, `record_ref`, and inside revision `before`/`after` payloads).
- Every write is verified to have touched exactly one row. With RLS, an owner-only policy makes a non-owner's update a zero-row no-op; the repository treats that as an error (`DATA_PARTIAL_WRITE`), never as success, and names what already landed.
- Numerics are selected as text (`balance::text`, `observed_monthly_amounts::text`) and normalised with the shared money helper, so values round-trip exactly and the web tier still does no arithmetic.
- `PersonalRepository` (`repository.ts`) is the single seam: `demoPersonalRepository()` (file store + persona cookie) and `productionPersonalRepository()` (Supabase + resolved identity) expose `bundle()` and `mutate()`. **This is the data source the AI track consumes** (see `docs/architecture/PARALLEL_SESSIONS_AND_DATA_BOUNDARY.md`).

Known limitation, disclosed in code and UI: PostgREST has no multi-statement transaction, so a multi-row write can land partially; the error says so. The atomic replacement is one `app.apply_personal_changes(jsonb)` SECURITY DEFINER RPC in DATA-002 (reserved migration `0009`).

## 2. What changed
- `apps/web/src/domain/personal/supabase-repository.ts` — row↔contract mappers, `planPersist`, `SupabasePersonalRepository`.
- `apps/web/src/domain/personal/repository.ts` — `PersonalRepository` seam, demo and production factories.
- `apps/web/src/auth/personal-actor.ts` — `PersonalActor` now admits `{ mode: "PRODUCTION", actor_type: "USER" }`; `auth/actor.ts` gains `getProductionPersonalActor()`.
- `apps/web/src/server/personal-form.ts` — form → record input parsing extracted from the demo actions and shared; `server/app-personal-actions.ts` — production save/retire/guardrails/start-fresh actions (same domain functions, Supabase repository; no baseline recompute).
- `apps/web/src/ui/personal/RecordForms.tsx` — `AddRecord`/`EditRecord` accept `save`/`retire` actions (demo defaults unchanged).
- `/app/personal` (records by domain with provenance chips, owner-only forms, guardrails, change history, honest "records only" banner) and `/app/personal/start` (`app.create_personal_workspace` RPC). `ProductionHome` links to them.
- CI `realstack` job: new vitest step running `supabase-repository.realstack.test.ts` against the live local stack.
- Docs: this report, `PARALLEL_SESSIONS_AND_DATA_BOUNDARY.md`, TRACEABILITY §H, SECURITY_AND_LIMITS rows, FEATURE_STATUS_MATRIX, CLAUDE.md status note (migration-number reservation: `0009` data track, `0010+` AI track).

## 3. Suites executed in this session (Linux sandbox)
| Suite | Result |
|---|---|
| `npm run typecheck` / `npm run lint` | clean |
| `npm run build --workspace apps/web` | compiled; 49 routes (adds `/app/personal`, `/app/personal/start`) |
| Contracts Vitest | 47 passed |
| Web Vitest (calculator up) | **127 passed, 3 skipped** (115 + 12 `supabase-repository.test.ts`; the 3 skipped are the realstack file without env) |
| Playwright | **20 passed** (18 + 2 `data-001-personal.spec.ts`) |
| SQL harness / calculator pytest | not re-run (no SQL or calculator change in this PR) |
| Real stack | **not run here**; the CI `realstack` job on this PR runs pgTAP, the harness and the new repository vitest step |

## 4. Coordination with the parallel AI-CORE session
- Nothing in this PR touches `apps/web/src/ai/**`, `packages/contracts/src/ai/**` or `docs/ai/**`.
- Shared files were edited append-only (CLAUDE.md status note, TRACEABILITY §H, matrix rows). The one conflict with the AI track's open PR #11 is `CLAUDE.md`; resolution is "keep both notes".
- Integration points for AI-CORE-001 steps 1–2 and 9 are `getProductionIdentity()` / `getProductionPersonalActor()`, `PersonalRepository.bundle()`, and `app.workspace_append_event` for the audit line — documented in the boundary note so the AI runtime consumes rather than re-implements authorisation.

## 5. Next
- **DATA-002:** migration `0009` (personal snapshots, calc runs, decisions; atomic `apply_personal_changes` RPC), `supportsRuns = true` for production, `/app/personal` gains the receipted baseline through the same `runs.ts` path, realstack coverage. Then **DATA-003** (firm store), member-management/consent UI, private storage.
- Gate: `realstack` green on this PR, then #10 → #11/this PR merge order per §1 of the boundary note.
