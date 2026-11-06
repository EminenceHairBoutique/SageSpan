# SageSpan V5 — Feature Status Matrix

**As of:** 2026-11-06, branch `feat/v5-dual-market` (built on `feat/pr-001-trust-boundaries` @ `5e1916d`).
**Vocabulary (V5 §16.1):** *Implemented (synthetic)* = working code with tests on synthetic data; *Partially implemented*; *Proposed* = approved requirement, no code; *Blocked* = waiting on a release gate; *Independently validated* = named external reviewer sign-off (none yet).

This matrix describes what the checked-out tree does. It is not a certification and makes no legal or professional claim. Re-verify by running the suites listed in `CLAUDE.md` §7.

## Pillar 1 — SageSpan Personal / Household (B2C)

| Capability | V5 ref | Status | Evidence |
|---|---|---|---|
| Personal workspace shell (Overview, Next steps, Cash flow, Spending, Savings & debt, Goals, Retirement, Scenarios, AI assistant, Learn, Privacy), synthetic banner, mobile nav | §7.2, DUAL-001 | Implemented (synthetic) | `apps/web/src/app/demo/personal/*`, `e2e/dual-market.spec.ts` |
| Manual-entry personal records with V5 data states (USER_REPORTED / ASSUMED / MISSING / STALE / CONFLICTING), dated, revisioned cash balances | §3.1, §19.1, PERS-001 | Implemented (synthetic) | `packages/contracts/src/personal.ts`, `domain/personal/mutations.ts`, `personal.test.ts` |
| Add / edit / retire for cash accounts, income streams, commitments, spending categories, debts and goals (owner only, workspace-scoped, shared Zod validation, append-only revision log, retire never deletes; retiring a debt retires its linked minimum payments) | §3.1, §19.1, PERS-002a | Implemented (synthetic) | `packages/contracts/src/personal-records.ts`, `domain/personal/records.ts`, `ui/personal/RecordForms.tsx`, 5 Vitest cases incl. participant / stranger / foreign-id denial, e2e add→retire |
| "Start fresh" guided intake (Welcome → personal or household → income → bills → spending → cash & debts → goals → verify → baseline); blanks stay MISSING; first baseline is INSUFFICIENT_DATA until the basics exist; person switcher; Castillo demo untouched | §3.1, §7.2, PERS-002b | Implemented (synthetic, demo cookie identity) | `domain/personal/intake.ts`, `app/demo/personal/intake/[step]`, `e2e/pers-002-intake.spec.ts` |
| What-if scenarios on the cash-flow baseline: spending change, savings change (liquid / illiquid, optional goal), 1–12 month income interruption with runway; baseline and scenario side by side; INFEASIBLE instead of capping; receipted; the decision policy cites COMPUTED runs (resilience step, adopt/reject spending or savings change) | §3.3, §19.3, PERS-002c | Implemented (synthetic) | `app/financial/scenario.py`, `personal.cashflow_scenario@2026.1`, 16 pytest cases incl. hand-derived golden (margin during −2,266.50; runway 0.95 months), policy tests, e2e |
| Deterministic cash-flow baseline: median/low income, essential vs discretionary, margin, buffer months, 30/60/90-day dated outlook, bill collisions, flags, data quality; receipted | §3.2, §19.3, PERS-001 | Implemented (synthetic) | `services/calculator/app/financial/cashflow.py`, `personal.cashflow_baseline@2026.1`, 22 pytest cases, golden values hand-derived |
| Debt payoff comparison (minimums only / avalanche / snowball / hybrid) under a user-chosen extra amount and cash floor; receipted | §3.4, §19.3, PERS-002 (first slice) | Implemented (synthetic) | `app/financial/debt.py`, `personal.debt_amortization@2026.1`, 9 pytest cases incl. hand-computed 3-month case |
| Decision policy: constraints before scores, ≤3 primary actions, rejected candidates with reasons, "Ask why", tiers 3–4 disabled | §5, §20, Annex C | Implemented (synthetic) | `packages/contracts/src/decision-policy.ts` (`decision-policy.v1`), 8 Vitest cases |
| User decisions (Done / Snooze / Not relevant / Disagree) as append-only events | §3.6, §20.1 | Implemented (synthetic) | `recordUserDecision`, tests |
| Personal snapshot + receipt verification (request hash re-derived, trusted engine, PUBLISHED method set, snapshot binding) | §17.1 (5), S-04 analogue | Implemented (synthetic) | `domain/personal/runs.ts`, `verifyPersonalReceipt`, tests for bad hash / unknown engine / unpublished set / service down |
| "Understand my finances" AI explanation with validated citations | AI-001 (personal adaptation) | Implemented (offline mock) | `ai/review-orchestrator.ts`, e2e |
| Education module (Tier 0) tied to the user's receipted figures | §3.5 (education first), user request | Implemented (`learn-v1`) | `app/demo/personal/learn/page.tsx` |
| Retirement readiness gate (known / assumed / missing) | §4.1 | Implemented (synthetic) | `retirement/page.tsx`, `updateRetirementIntake` |
| Retirement projection engine (gross-basis annual model) | §4.2, PLAN-001 / SCENARIO-001 | **Proposed** — no engine; UI says so | — |
| Spending/recurring detection from transactions, transfer/refund de-duplication | §3.2, PERS-002d (needs transactions) | Proposed | — |
| Household sharing with per-domain grants / invitation acceptance / consent to a person or firm / revocation | §2.2, §21.1, §17.4 | **Database controls implemented** (migration 0008: `invite_participant`, `accept_invitation`, `revoke_membership`, `grant_consent`, `revoke_consent`, `can_read_workspace_domain`); server identity resolution implemented (`auth/identity.ts`); consumer UI for these controls **Proposed** (needs the store adapter, DATA-001) | SQL `008_*` (74), web `identity.test.ts` (10), `supabase/realstack/run.mjs` (CI only) |
| Connected bank/card/brokerage data | §10.3 | Proposed; gated G3 | — |
| Personalised securities / tax / insurance advice (Tier 3) | §5.3, §10.2 | **Disabled in code** pending REG-001 | `ENABLED_TIERS = [0,1,2]` |
| Money movement (Tier 4) | §5.3 | Out of scope | — |
| Consented monitoring / notifications | §3.6, AI-005 | Quiet-mode preference stored; notifications Proposed | — |

## Pillar 2 — Retirement Studio (B2C + B2B)

| Capability | V5 ref | Status |
|---|---|---|
| Readiness gate | §4.1 | Implemented (synthetic), personal side |
| PLAN-001 bounded annual cash-flow projection, scenario comparisons | §4.2, §19.3 | Proposed |
| SSA / tax / Roth / Medicare / Monte Carlo modules | §4.2, §19.3 | Proposed; each gated G4 |
| Advisor Planning Studio UI | §6 (5) | Honest status page only (`/demo/app/planning-studio`) |

## Pillar 3 — Advisor & Assurance (B2B)

| Capability | V5 ref | Status | Evidence |
|---|---|---|---|
| Import → reconcile → freeze → RMD check → review → approval → packet (synthetic console) | §6, V3 | Implemented (synthetic), unchanged by V5 | existing suites; `assurance-flow.spec.ts` still passes |
| PR-001 trust boundaries (migration 0005/0006, SQL suites, TS receipt verification) | §17.2 | Merged to `master` (#5); **not real-stack validated** | `supabase/tests/005_*`, `006_*` (run on embedded PostgreSQL 16 in the PR-002 session; CI `database` job on postgres:15) |
| PR-002 coverage semantics (S-06/S-07/N-02): typed approval outcome, snapshot payload v2 with policy at freeze, latest-attempt retry semantics | §17.3 | Implemented on `feat/pr-002-coverage` (shim PostgreSQL 16 + CI postgres:15; **not real-stack validated**) | `supabase/migrations/0007_*`, `supabase/tests/007_*` (43 assertions), `packages/contracts/src/coverage.ts`, web `pr-002-coverage.test.ts` (10), e2e `pr-002-coverage.spec.ts` |
| PR-003a/b identity: principals, personal/household workspaces, consent grants, domain-scoped RLS; Supabase session resolution; `/app` sign-in/out | §17.4 | Implemented on `feat/pr-003-identity` (shim PostgreSQL 16; **real-stack evidence only from the CI `realstack` job**, not run locally) | `supabase/migrations/0008_*`, `supabase/tests/008_*`, `apps/web/src/auth/{identity,supabase-server,actor}.ts`, `server/auth-actions.ts`, e2e `pr-003-identity.spec.ts` |
| PR-003 remainder: Supabase store adapter for domain reads/writes (DATA-001), private document storage, trusted document registration, member management UI | §17.4 | **Open** — `/app` shows the resolved identity and says the store is not wired | `ui/ProductionHome.tsx` |
| Firm navigation: Review queue, Clients, Imports & evidence, Checks, Planning studio, AI plan review, Reviews & approvals, Firm settings | §7.2, DUAL-001 | Implemented (synthetic); Planning studio is a status page | `ui/console/ConsoleShell.tsx` |
| AI plan review ("Analyze plan"): grounded findings, questions, draft memo; Accept / Edit / Dismiss / Request evidence as versioned feedback | §18, AI-000/AI-001 | Implemented (offline deterministic mock) | `apps/web/src/ai/*`, 28-case eval suite, e2e |
| Client onboarding, client-to-firm consent grants, client portal | §6 (1), (8) | Grant model + DB entry points implemented (0008, firm reads only through an active grant); onboarding/portal UI Proposed (DATA-001) | SQL `008_*` firm-grant cases; realstack §4 |
| Two permitted real import-format maps, firm insights, operational intelligence | §6, IMPORT-001, ASSURANCE-001 | Proposed | — |

## Shared intelligence layer (AI)

| Capability | V5 ref | Status |
|---|---|---|
| Versioned contracts: `AiReviewReport` (ai-review-v1), findings, scenario proposal, run record, feedback | §18.2, AI-000 | Implemented |
| Provider adapter: deterministic mock, scripted test provider; live adapter | §18.1 | Mock + scripted implemented; **live adapter not implemented** (configuration yields the mock plus an explicit note) |
| Evidence resolver (authorised scope only), allowlisted read-only tools, forbidden-tool denial | §18.1, §18.3 | Implemented |
| Result validator: unresolved/superseded refs, forged locators, uncited amounts, forbidden status, unsupported→PASS, budgets, injection notes | §18.2–18.3 | Implemented |
| 28 labelled evaluation cases AI-E01…E28 | §18.4 | Implemented as Vitest (`ai-evals.test.ts`), all passing on the mock/scripted providers |
| AI-002 extraction, AI-003 scenario execution, AI-004 memo publication, AI-005 monitoring | §18.5 | Proposed |

## Cross-cutting

| Item | Status |
|---|---|
| Public site: Personal · Retirement Planning · For Advisors & Firms · How It Works · Security & Trust · Pricing · Sign In; dual CTAs | Implemented |
| Consumer pricing hypotheses ($8–15 / $15–30) alongside firm hypothesis | Implemented as **unvalidated hypotheses** (`CONSUMER_PRICING_HYPOTHESIS`) |
| Legal perimeter (REG-001), qualified financial reviewer sign-off (FIN-VERIFY-001), SOC 2, vendor DPAs | **Not started / not claimed** |
