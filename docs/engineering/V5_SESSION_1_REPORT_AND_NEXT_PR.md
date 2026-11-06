# V5 session 1 — delivery report and next PR plan

**Branch:** `feat/v5-dual-market` (from `feat/pr-001-trust-boundaries` @ `5e1916d`; `master` is an ancestor, PR-001 unmerged).
**Date:** 2026-11-06. **Scope delivered:** DUAL-000, DUAL-001, a PERS-001 vertical slice with the first PERS-002 engine (debt paths), AI-000 and a bounded AI-001 on an offline provider, education module (Tier 0). **Not touched:** PR-001 SQL/security boundaries, migrations 0001–0006, firm workflow domain code.

## 1. Repository reality check

| Area | Before this session | After |
|---|---|---|
| Firm assurance | Full synthetic console; 2-item nav | Unchanged workflow; 8-item nav; AI review tab per household; firm-wide Clients / Imports & evidence / Checks / AI plan review / Reviews & approvals pages; Planning studio status page |
| Personal (B2C) | Nothing | Synthetic workspace (11 routes), engines, policy, assistant, education, readiness gate |
| Calculation service | RMD only | + `/v1/personal/clarity`, `/v1/personal/debt-paths`, `/v1/methods`; methodology registry separate from rule sets; OpenAPI regenerated |
| Contracts | firm domain | + workspace/consent, personal records, personal-calc mirrors, decisions + policy, AI contracts; `DataState` v2 |
| Docs | V5 blueprint/prompt/traceability | + feature matrix, ADR, AI eval matrix, release gates, model registry, this report; CLAUDE.md/README updated; V3 root pack marked superseded |

## 2. Tests actually run (build environment: Linux, Node 22.23, Python 3.13 via `uv` lock)

| Suite | Command | Result |
|---|---|---|
| Calculator | `uv run --locked python -m pytest` (services/calculator) | **99 passed** (69 existing + 30 new) |
| Generated artefacts | `export_rule_sets_sql.py --check`, `export_canonical_sql_test.py --check`, `export_openapi.py` | seed and canonical SQL unchanged; OpenAPI regenerated and drift test green |
| Contracts | `npx vitest run` (packages/contracts) | **38 passed** (23 existing + 15 new) |
| Web unit | `npx vitest run` (apps/web, calculator running) | **85 passed** (44 existing + 30 AI evals + 11 personal) |
| Typecheck / lint | `npm run typecheck`, `npm run lint` | 0 errors, 0 warnings |
| Build | `npm run build --workspace apps/web` | success, 43 routes |
| Playwright | `npx playwright test` (Chrome for Testing 153 via `SAGESPAN_E2E_CHROME_PATH`; real calc service) | **11 passed** (4 existing incl. full Patel flow + 7 new) |
| SQL harness (`supabase/tests`) | — | **Not run**: no PostgreSQL server in the build environment. Migrations untouched; historical 117 assertions on the PR-001 branch stand as a dated baseline only |
| Real Supabase Auth/JWT/PostgREST/RLS | — | **Not run** (never run on any branch) |

## 3. Known risks and blockers (unchanged by this PR)

- PR-001 not merged; PR-002 (S-06/S-07/N-02) and PR-003 (real auth/store/storage) open → G1–G3 not passed.
- No live AI provider; the mock proves the control plane, not model accuracy.
- No qualified financial reviewer has signed any rule or method set; no counsel perimeter (REG-001).
- The Personal workspace has edit forms for balances, guardrails and retirement intake but no "add account/bill/debt/goal" forms yet.
- `.demo-state` v1 files are reseeded on first read (synthetic data only).

## 4. Next PR (recommended): **PERS-002 — personal intake + spending patterns**, small and reviewable

**Goal:** make the Personal workspace useful with the user's own data rather than the Castillo fixture, without new security surface.

**Scope**
1. Add/edit/retire forms (owner only) for cash accounts, income streams (observed months), recurring obligations, variable spending categories, liabilities and goals; each write is a revision or append, scoped by `workspace_id`; validation shared via Zod.
2. "Start fresh" guided intake (Welcome → personal or household → discovery → verify key inputs → baseline) producing the same records; blanks stay MISSING.
3. Scenario inputs on the cash-flow engine: spending change, savings change, one-year income interruption — implemented in Python as `personal.cashflow_baseline` scenario mode or a `personal.cashflow_scenario@2026.1` method set with golden tests; results receipted; the policy consumes them.
4. Recurring-charge pattern detection stays out (needs transactions, PERS-002b).

**Files:** `packages/contracts/src/personal.ts` (schemas for inputs), `apps/web/src/domain/personal/mutations.ts`, `apps/web/src/server/personal-actions.ts`, new `apps/web/src/app/demo/personal/intake/*`, `services/calculator/app/financial/cashflow.py` (+ tests), `packages/contracts/src/decision-policy.ts` (scenario-aware candidates), e2e.

**Definition of done:** a fresh workspace can be populated from nothing to a receipted baseline in the browser; every mutation is owner-scoped and tested for a foreign actor; new engine conventions documented and golden-tested; policy tests for scenario candidates; feature matrix updated; no changes under `supabase/` or to PR-001 code.

**Why next:** it is the smallest step that turns the demo into something a design-partner consumer can try on fictional-but-their-own numbers, and it exercises every V5 safeguard (states, snapshots, receipts, constraints) without waiting on PR-002/003.

**Then:** AI-002 (extraction benchmark) is deliberately *after* PR-003, because document bytes need private storage and trusted hashing first.
