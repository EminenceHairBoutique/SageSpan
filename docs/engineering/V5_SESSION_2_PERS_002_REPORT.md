# V5 Session 2 — PERS-002: personal intake, record editing and what-if scenarios

**Date:** 2026-11-06. **Branch:** `feat/pers-002-intake` (from `feat/v5-dual-market` @ `daa8f3b`). **Scope delivered:** PERS-002a (records), PERS-002b ("Start fresh" intake), PERS-002c (cash-flow what-if engine + policy integration). **Not touched:** PR-001 SQL/security boundaries, migrations 0001–0006, firm workflow domain code, AI provider (still offline mock). **Synthetic data only.**

## 1. What changed

### PERS-002c — `personal.cashflow_scenario@2026.1` (calculator)
- `services/calculator/app/financial/scenario.py` — one bounded change applied to a copy of the baseline request; baseline and scenario both computed by `personal.cashflow_baseline@2026.1`; delta, goal changes, new/resolved flags, runway.
  - `SPENDING_CHANGE` (signed monthly amount as an extra non-essential category; reduction > typical discretionary → `INFEASIBLE`).
  - `SAVINGS_CHANGE` (positive amount; optional `goal_ref`; `LIQUID` lowers margins only, `ILLIQUID` adds a monthly non-essential obligation from `start_date`).
  - `INCOME_INTERRUPTION` (`stream_ref`, `months` 1–12, optional `start_date`); the outlook skips the stream's payment dates in the window (`compute_clarity(..., income_blackouts=)`), "during" margins use the remaining streams, runway = cash above floor ÷ monthly shortfall.
- `app/schemas_personal.py` — `ScenarioSpec` (fields validated per kind), `PersonalScenarioRequest`, `PersonalScenarioResponse` (`check_type: PERSONAL_SCENARIO`, `result_status: COMPUTED | INSUFFICIENT_DATA | INFEASIBLE`).
- `app/financial/methods.py` — `PERSONAL_CASHFLOW_SCENARIO` registered (PUBLISHED, internal golden only; separate registry from `ALL_RULE_SETS`, so migration 0006 is untouched).
- `app/financial/personal_receipt.py::run_personal_scenario`; `POST /v1/personal/scenario` in `app/main.py`; OpenAPI regenerated (`packages/contracts/openapi/calculator.openapi.json`).
- Golden fixture: `fixtures/synthetic/personal/castillo_scenario_interruption_{request,expected_response}.json` (receipt hashes committed).

### Web / contracts
- Zod mirror (`ScenarioSpecSchema`, `PersonalScenarioRequestSchema`, `PersonalScenarioResponseSchema`) in `packages/contracts/src/personal-calc.ts`; `PersonalCalcRun.check_type` gains `PERSONAL_SCENARIO`.
- `domain/personal/runs.ts::runPersonalScenario` — owner only, request built from the CURRENT snapshot, receipt verified (request hash re-derived, trusted engine, PUBLISHED sets, snapshot binding), stored as an immutable run; failures are `ERROR` runs with no amounts. `personalInsights` exposes scenario runs for the current snapshot only (superseded snapshots' runs are history).
- `buildScenarioRequest` sends every spec field explicitly (null when unused) so the web-side canonical hash equals the service's.
- Decision policy (`decision-policy.ts`, still `decision-policy.v1` in behaviour for existing candidates) reads COMPUTED scenario runs: uncovered interruption → tier-2 `RESILIENCE_<stream>` citing the run; spending change → `ADOPT_SPENDING_CHANGE` (rejected if it raises a HIGH flag); savings change → `ADOPT_SAVINGS_CHANGE` (rejected by constraint if the low-month margin turns negative). No arithmetic; every figure is copied from the receipted run.
- `EXECUTABLE_SCENARIO_KINDS` now includes the three cash-flow kinds (AI `propose_scenario` reports `engine_required: personal.cashflow_scenario`); retirement kinds remain proposals only.
- Scenarios page: "What if…" panel (`ui/personal/WhatIfForm.tsx`) + side-by-side result with receipt, runway block, goal changes, new/resolved flags, assumptions, limitations.

### PERS-002a — records
- `packages/contracts/src/personal-records.ts` — shared Zod write schemas for the six record types; `PersonalRecordRevision` (append-only `CREATE | UPDATE | RETIRE` with before/after).
- `IncomeStream`, `RecurringObligation`, `VariableSpendingPattern`, `Liability`, `SavingsGoal` gain `retired: boolean`; `DataState` gains `personal_record_revisions`; **demo state version → `sagespan.demo-state.v3`** (older files reseed; synthetic only). Seed script and `seed.json` regenerated.
- `apps/web/src/domain/personal/records.ts` — `createPersonalRecord`, `updatePersonalRecord`, `retirePersonalRecord`: owner only; workspace re-derived from the server actor; foreign ids → not found (no existence leak); linked liability / funding account must be in the workspace; retire never deletes; retiring a debt retires its linked minimum payments (each logged); retiring a cash account unlinks goals funded from it.
- `ui/personal/RecordForms.tsx` (field sets + collapsible Add / inline Edit + Retire) wired into Cash flow, Spending, Savings & debt and Goals pages; `saveRecordAction` / `retireRecordAction` recompute the baseline from a new snapshot.

### PERS-002b — "Start fresh" intake
- `domain/personal/intake.ts::startFreshWorkspace` — new simulated principal, PERSONAL or HOUSEHOLD workspace, OWNER membership, profile with the user's own cash floor (required: it is a hard constraint) and optional buffer target, retirement intake with every field MISSING.
- `app/demo/personal/intake/[step]` — Welcome → Income → Bills → Spending → Cash & debts → Goals → Verify → Baseline; each step uses the same record forms; "Skip for now" is explicit; Verify lists counts and MISSING; Baseline shows the engine's `INSUFFICIENT_DATA` reasons or the first receipted figures.
- `getPersonalActor` / `listPersonalPersonas` now read the demo store (not the static seed) so new workspaces resolve; person switcher and "Start fresh" link in the shell; `asOfDate` fallback is today's date instead of `2026-01-01`.

## 2. Verification (executed in this session, container)

| Suite | Command | Result |
|---|---|---|
| Calculator | `uv run --locked pytest` (services/calculator) | **119 passed** (was 100; +16 scenario, +3 API) |
| Contracts | `npx vitest run` (packages/contracts) | **44 passed** (was 38) |
| Web | `npx vitest run` with `CALC_SERVICE_URL=http://127.0.0.1:8010` | **94 passed** (was 85) |
| Typecheck | `npm run typecheck` | 0 errors |
| Lint | `npm run lint` | 0 errors / warnings |
| Build | `npm run build --workspace apps/web` | compiled; `/demo/personal/intake/[step]` and `/demo/personal/scenarios` are dynamic routes |
| Playwright | `npx playwright test` (real dev server + real calculator, Chrome at `/usr/bin/google-chrome`) | **15 passed** (11 existing + 4 new in `e2e/pers-002-intake.spec.ts`) |

Not run: SQL harness and real Supabase tests (no SQL changed); `ruff`/`mypy` repository-wide baseline unchanged (pre-existing findings), new Python files lint clean.

Hand-derived goldens held: interrupting the contract stream for one month → margin during **−2,266.50** (1,200.00 − 3,024.50 − 442.00), runway **0.95** months (2,150.00 ÷ 2,266.50), essentials-only runway 1.18; a −150.00 spending change moves the 90-day low point by +30.00 and day-90 cash by +455.00; +200.00 to the reserve goal takes it from 23 to 12 months.

## 3. Traceability

- S-04 analogue preserved for the new run type (`verifyPersonalReceipt` covers `PERSONAL_SCENARIO`; bad hash / unknown engine / unpublished set / down service → ERROR run, no amounts).
- S-01/S-07 analogue: every record write and scenario run re-derives the workspace from the server actor; foreign ids are not-found; requests are built from the snapshot, never the page.
- N-02 analogue: scenario runs on a superseded snapshot stay in history and are never reused.
- AI: `propose_scenario` still non-authoritative; no tool runs an engine; `EXECUTABLE_SCENARIO_KINDS` is informational for the proposer.
- Release gates unchanged: G0 synthetic only; tiers 3–4 disabled; no live provider; demo cookie identity until PR-003.

## 4. Known limits / follow-ups
- Record edits (other than cash accounts) are revised in place with the history in `personal_record_revisions`; a per-revision row model like `CashAccount` can be adopted when records move to Postgres (DATA-001) without changing refs.
- The Castillo seed carries no `CREATE` revisions (implicit revision 1); first logged change is revision 2.
- Scenario runs are not yet exported in evidence packets (Personal has none yet).
- PERS-002d (recurring-charge detection from transactions, transfer/refund de-duplication) remains proposed; needs a transactions model and consent (DATA-001).

## 5. Next PR (recommended)
**PR-002 — coverage correctness and reproducibility** on the firm side (S-06 supported/limited/unsupported review outcomes, S-07 snapshot-only calculation requests, N-02 latest-attempt semantics), since PERS-002 has now exercised the same snapshot/receipt discipline on the personal side and the firm workflow should match before PR-003 real auth. Alternative if the founder prefers B2C momentum: PERS-003 — household invitation acceptance and per-domain consent grants UI on the existing `ConsentGrant` model (still synthetic, still cookie identity).
