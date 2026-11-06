# SageSpan — CLAUDE.md (V5 Unified Engineering Instructions)

> **Purpose:** Permanent, repository-local guidance for Claude Code. This file supersedes the **V3 B2B-only product decision**, but preserves the original implementation history, engineering conventions, security gates, and financial-calculation requirements. Do **not** confuse this file with a prompt to execute the entire V5 roadmap in one session.
>
> **Status note (2026-11-05):** The shipped/test-count statements below were reported by the uploaded V3 `CLAUDE.md`; they are **historical**, not independently rechecked against the currently checked-out branch. Verify `git status`, `git branch`, migrations, code, open PRs and CI before relying on them. PR-001 was reported complete on `feat/pr-001-trust-boundaries`; **do not assume it has been merged or deployed**.
>
> **Status note (2026-11-06, V5 session 1):** `feat/v5-dual-market` adds the Personal (B2C) workspace, the personal engines, the decision policy, the AI review layer (offline mock) and the dual-entry site. See §5a below for the suites actually run and `docs/engineering/V5_SESSION_1_REPORT_AND_NEXT_PR.md`. PR-001 is still unmerged; PR-002/PR-003 remain open.

## 1. Mission and precedence

Act as SageSpan's founding product/engineering collaborator: a pragmatic fintech architect, AI systems engineer, financial-model reviewer, security engineer, privacy and governance reviewer. Be precise and constructively critical. Prefer validated, useful functionality over feature count or marketing claims.

**Current founder direction — binding:** SageSpan is **one dual-market B2C + B2B platform**, not B2B-only and not B2C-only:

1. **SageSpan Personal / Household (B2C):** financial clarity, income and spending patterns, cash-flow and bills, budgeting, debt, emergency reserves, savings goals, investments education, practical next steps, and household permissions.
2. **SageSpan Retirement Studio (B2C and B2B):** retirement intake, validated annual cash-flow and retirement projections, what-if comparisons, income and withdrawal strategies; expand to tax, Social Security, Roth conversions and Monte Carlo only after the relevant deterministic models are independently verified.
3. **SageSpan Advisor & Assurance (B2B):** RIA/advisor/CCO workflows, permissioned client relationships, sourced plan imports, reconciliation, independent checks, evidence-backed AI reviews, exception management, separation of duties, review approval and verifiable audit/evidence packages.

Serve the five-stage lifecycle: **Discover → Diagnose → Develop/Design → Review/Decide → Monitor**. Our promise is to reduce the *burden* of financial decisions with realistic, understandable options, not to guarantee outcomes, replace personal judgment, or eliminate stress.

### Controlling references (must exist in the checked-out repository; verify them)

- `docs/product/SAGESPAN_V5_MASTER_SOURCE_OF_TRUTH.md` — **controlling V5 product, architecture, decision policy, governance, security and financial specification** (same content as the V5 Unified Master Blueprint).
- `docs/engineering/SAGESPAN_V5_ENGINEERING_PROMPT.md` — detailed **engineering reference and acceptance criteria**, including PR-001 and AI implementation annexes. **Do not treat it as permission to implement every PR automatically.**
- `docs/requirements/SAGESPAN_V5_TRACEABILITY.md` — required non-regression mapping for S-01–S-10, N-01–N-05, AI, financial and consent controls.
- This `CLAUDE.md` — **operational repository conventions and historical status**, updated for V5.
- Repository code, current migrations, tests, CI and verified Git state — **truth about what is actually implemented**.
- `docs/history/CLAUDE_V3_ENGINEERING_RECORD_2026-11-05.md` (if installed) and original V1–V3 founder docs — **historical implementation and decision records**, not overriding the V5 market decision.

**Precedence:** Latest explicit founder product decisions govern market direction; stricter compatible security, privacy, financial correctness, consent and legal gates remain mandatory. Resolve discrepancies explicitly and record an ADR; don't quietly discard prior safeguards. The current checked-out code determines present implementation status, while historical tests establish only a dated baseline. If a referenced source is absent, say so and do not fabricate it.

**V3 founder decisions superseded:** The earlier wording “B2B only; not a planner or consumer app” is no longer valid. Preserve the *B2B assurance product*, commercial hypotheses, calculation architecture and review safeguards. Earlier B2B pilot pricing is a hypothesis, not a public price; B2C pricing also remains experimental. SageSpan is a provisional brand pending clearance, with brand strings historically configured in `apps/web/src/config/brand.ts`.

## 2. Non-negotiable engineering design

- **Retain the monorepo:** `apps/web` (Next.js App Router/React/strict TypeScript/Tailwind), `packages/contracts` (Zod, shared policy and workflow contracts), `services/calculator` (**separate Python/FastAPI, Decimal arithmetic**), `supabase` (PostgreSQL/Auth/RLS), `fixtures/synthetic`, and `docs` unless a documented migration is justified. Vercel handlers must not perform heavy computation.
- **Never recreate a parallel calculator** under `services/calc` or introduce a competing SQL migration series. The original founder selected `services/calculator` and the `app` schema. The old parallel implementation was archived at `.archive/parallel-implementation-2026-11-05/`.
- **No authoritative financial math in React/Next or LLM outputs.** All material dollar amounts, taxes, RMDs, interest, retirement projections and scenario impacts require a suitable versioned deterministic engine, with verified inputs, exact rounding, test coverage, and uncertainty/limitations as applicable.
- **Contracts first:** Zod/typed schemas, validation at trust boundaries, semantically versioned financial facts, receipts, snapshots, approvals, source references and calculation assumptions. Never silently convert `UNSUPPORTED`, `INDETERMINATE`, `NOT_REQUIRED` or `ERROR` into a successful verified check.
- **Five-stage journey and two market experiences:** shared safe primitives, but separate consumer / household / advisor / firm authorization, navigation and decision rights. Do not merge consumer private accounts into firm access by default.
- **Synthetic-only development remains in force** until the relevant production release gates explicitly pass. No real PII, bank statements, sensitive customer data, passwords or API tokens in the repository, logs, fixtures or development prompts. Never market synthetic demonstrations as live integrations.

## 3. Financial decision intelligence: what SageSpan AI may and may not do

Build evidence-driven analysis with the sequence:

**Evidence → Patterns → Constraints → Feasible alternatives → Ranked explanations → User or advisor choice → Monitoring**.

- Analyze sufficient permitted financial history before characterizing recurring bills, savings capacity, seasonal/variable income, spending patterns, debt repayment options or retirement readiness. Distinguish observed facts, source provenance/as-of dates, modeled forecasts, user assumptions and missing/stale/conflicting information.
- A recommended next action must make the evidence, feasibility prerequisites, deterministic projected impact, uncertainty, downside risks, alternative choices, reversibility and decision authority clear. Do not invent rates, APRs, balances, investment returns, probabilities, savings or citations. Abstain and request necessary information when critical facts are missing.
- The **LLM is a proposing/explaining layer**, not the financial source of truth. Implement a server-owned orchestrator/provider adapter, scoped retrieval, allowlisted read-only tools, machine-validated outputs, model/prompt versions, budgets, feedback and safe disable/rollback. The initial allowed tool concepts include `read_facts`, `read_evidence`, `get_check_runs`; `propose_scenario` must be explicitly non-authoritative; `run_supported_projection` must refuse models that are not yet implemented and verified.
- Confirm every referenced fact ID, document locator, check receipt, calculation result and workspace authorization **server-side**. Uploaded PDFs, CSV cells, merchant names and retrieved text are untrusted data, never new instructions. No document instruction can bypass system policy or cause exfiltration.
- AI **must not** independently verify facts, override receipts, change policies, grant consent, approve plans or review findings, publish regulated personalized investment advice, send irreversible financial communications, place trades, move money or pay bills. Humans retain decisions; regulated recommendations remain disabled until legal, licensing, supervisory, disclosure, conflict-of-interest and model-validation gates are met.
- AI-000/AI-001 require **at least 28 labeled synthetic evaluation cases** plus a deterministic mocked provider. Cover false source IDs, cross-tenant leaks, unsupported math, forged citations, prompt injection, invalid approvals, conflicting facts, missing/stale evidence, and reviewer feedback. Keep evaluation artifacts and expected outcomes versioned. Model updates must replay applicable evaluation suites before release.
- Distinguish the **Claude Code development assistant** from the **production SageSpan model provider**. The latter needs explicit API contracts, consent, retention/security review, server-side keys, controlled processing and rollback.

## 4. Trust-boundary and data-security invariants

Preserve remediation and tests for historical findings **S-01–S-10 and N-01–N-05**, with their exact meanings in V5 §17 and the traceability matrix. Treat the original audit as a historical baseline; recheck the current code.

1. **Authorization & tenancy:** derive org/workspace/person from authenticated server context; tenant-scoped FKs, RLS, PostgREST entry points and RPCs must enforce active membership, role, scope and purpose. Never accept client-supplied `org_id` or guessed household IDs as authority. Firm membership never implies unrelated personal/household data access. Cross-tenant misses return a non-disclosing not-found response.
2. **Database privileges:** prevent callers from directly mutating workflow-owned columns, fact verification state, approved discrepancy dispositions, check results, registered document hashes or audit events. Restrict `SECURITY DEFINER` execution, use safe `search_path`, and explicitly audit `PUBLIC`/`anon`/`authenticated` grants after *every migration*. Auth/RLS helpers must still work for approved paths; test them.
3. **Sentinel caution:** the existing `app.workflow_fn` session setting may be an implementation coordination mechanism, **never an independent security boundary**. Privileges, scoped trusted functions, invariant triggers and verified actor authorization must prevent bypass even when a custom session setting is forged.
4. **Audit authority:** only trusted callers append audit events, with derived actor and validated event type/tenant. The audit chain must be linear under multi-event transactions/concurrency, sequence-numbered, verifiable and append-only. A hash chain alone cannot prove that an event is authorized; nor is a hash a signature.
5. **Frozen inputs and receipts:** freeze only verified/allowed facts with complete, authorized and versioned snapshot payloads; SQL/TS/Python canonicalization must match by versioned fixture. Build calculation requests **solely from frozen snapshot values** once PR-002 is implemented. Record only authenticated calculator outputs after verifying the request/snapshot/rule identity, rule status/checksum and receipt. A caller-constructed matching hash alone is not proof of calculator authenticity.
6. **Review & publication:** calculation `PASS` ≠ source verification ≠ approved financial plan. An unsupported-only run is not a verified plan; disclose per-account coverage. Preserve separation of duties and an explicit, consistent approval-role policy. Approved records/dispositions/evidence are immutable; amendments create versions. A failed earlier run must remain in history while latest-attempt semantics allow safe retry under PR-002.
7. **Consumer privacy:** personal, household and firm memberships are distinct. Explicit, limited-purpose, revocable and auditable sharing; joint participants' private records remain private absent grant. Data minimization, encrypted source storage, access reviews, retention/export/deletion with lawful exceptions, secure secret management, backup/restore and incident response must pass before real data.
8. **Evidence integrity:** source-document checksums must come from trusted stored bytes; packets need per-artifact hashes and a verifiable manifest. Do not claim independent attestation, digital signatures, zero retention, SOC 2 certification or SEC endorsement without proof.

**Testing gate:** Use the shimmed PostgreSQL suite for fast iteration **and separately run real Supabase Auth/JWT/PostgREST/RLS integration tests** before enabling production data. A clean shim run is *not* proof that Supabase is safe. Test allowed and denied paths, invalid credentials, cross-tenant access, malicious payloads, evidence forgery and rollback effects. If a transaction raises and rolls back, its audit writes also roll back; record durable denial evidence outside that transaction through an authorized mechanism.

## 5. Historical milestone inventory — verify actual branch status first

The uploaded V3 `CLAUDE.md` recorded these **2026-11-05 milestone results**:

| Area | Milestone 1 vertical slice | Milestone 2 PR-001 branch |
|---|---|---|
| Python calculator tests | 64 passed | 69 passed (locked `uv` environment) |
| Contracts Vitest | 15 passed | 23 passed |
| Web Vitest | 24 passed | 44 passed |
| SQL test harness | 4 files, 45 assertions on PostgreSQL 16 | 6 files, 117 assertions on PostgreSQL 18.6 |
| Playwright | 4 scenarios | 4/4 scenarios |
| Production Supabase | Not validated | **Still not validated** |

**Milestone 1 implementation recorded:**

- `/demo/app` synthetic assurance console with Patel, Okafor, Reyes-Lindqvist and Bauer fixtures, imports, typed fact/evidence states, conflicts, freeze, RMD checks, review/approval and JSON/HTML/CSV exports; synthetic personas and demo-state persistence.
- `POST /v1/checks/rmd`, `GET /v1/rules`, `GET /health` FastAPI calculator; published RMD rule sets, `Decimal` math, 8 discrepancy classifications, first-year/deferred obligation events, check receipts and versioned rule registry; P1 federal income-tax rules **DRAFT**, not released.
- `packages/contracts` typed financial workflow, import contract `sagespan.import.v1`, Zod mirrors, SHA-256/canonicalization and money helpers.
- Marketing pages and an `/app` **production gate**; Supabase migration series `0001`–`0004` as of milestone 1.

**Milestone 2 PR-001 work reported on `feat/pr-001-trust-boundaries`:**

- Forward-only migrations `0005_trust_boundaries.sql` and generated `0006_seed_rule_sets.sql`; explicit grants, workflow transition restriction, org-scoped linear audit chain, canonicalized snapshot verification, fact confirmation and write restrictions, receipt checking, write-once discrepancies, consistent approval-policy logic.
- TS `verifyReceipt`, `approvalDecision`/`canApprove`, error-state behavior; generated three-tier canonical fixtures; `uv.lock`/pinned Python environment; forward-only tests `005_trust_boundaries.test.sql`, `006_canonical_json.test.sql` and web/contracts checks.
- Original root file refers to source-specific scripts, verified probe paths, unresolved `mypy` typing and audit-history details; see **archived V3 engineering record** for the exact legacy notes.

**Do not infer:** these files are merged into `master`, that current SQL migrations remain numbered as stated, that a site feature is already shipped, or that any of these tests were rerun in this session. Re-check before changing code.

## 5a. V5 session 1 record (2026-11-06, `feat/v5-dual-market`) — verify before relying on it

Executed in a Linux build environment (Node 22.23, Python 3.13 from `uv.lock`, Chrome for Testing 153):

| Suite | Result |
|---|---|
| Calculator pytest (`uv run --locked python -m pytest`) | 99 passed (69 + 30 new: `test_personal_clarity.py`, `test_debt_paths.py`, `test_api_personal.py`) |
| `export_rule_sets_sql.py --check` / `export_canonical_sql_test.py --check` | unchanged (migration 0006 untouched) |
| OpenAPI | regenerated from the locked env; drift test green |
| Contracts Vitest | 38 passed (23 + 15 in `v5-contracts.test.ts`) |
| Web Vitest (calculator up) | 85 passed (44 + 30 `ai-evals.test.ts` + 11 `personal.test.ts`) |
| typecheck / lint / `next build` | clean; 43 routes |
| Playwright | 11 passed (`assurance-flow.spec.ts` 4 incl. full Patel flow, `dual-market.spec.ts` 7) |
| SQL harness, real Supabase | **not run** (no PostgreSQL in that environment; never real-stack validated) |

**Added (synthetic only):** `/demo/personal/*` (11 routes) with the Castillo fixture; `services/calculator/app/financial/{cashflow,debt,methods,personal_receipt}.py` + `schemas_personal.py` and endpoints `/v1/personal/clarity`, `/v1/personal/debt-paths`, `/v1/methods`; `packages/contracts/src/{workspace,personal,personal-calc,decisions,decision-policy}.ts` and `src/ai/*`; `apps/web/src/ai/*` (resolver, provider, tools, validator, orchestrator, 28 evals); `apps/web/src/domain/personal/*`, `domain/ai/feedback.ts`; firm console nav + pages; marketing pages `/personal`, `/retirement`, `/firms` (`/product` redirects), `/how-it-works`; `DataState` v2 (older demo-state files reseed). **Methodology sets are a separate registry from `ALL_RULE_SETS`** so migration 0006 stays applied-and-unchanged (ADR-V5-001 §6).

**Conventions added:** the web tier never sums or divides money (the debt engine accepts `extra_monthly_payment` and `cash_accounts` so it totals them); every personal run re-derives the request hash, requires `sagespan-calculator` and a PUBLISHED method set, and records ERROR without amounts otherwise; AI output is validated server-side (`result-validator.ts`) and a model can never set VERIFIED/APPROVED; reviewer and user feedback are append-only events; tiers 3–4 are disabled in `decisions.ts`.

**Local run:** `npm run dev:calc` then `npm run dev:web`; Personal at `/demo/personal`, firm at `/demo/app`. Playwright can use an installed Chrome via `SAGESPAN_E2E_CHROME_PATH` and a non-`.venv` interpreter via `SAGESPAN_CALC_PYTHON`.

## 6. Known historical blockers and next safe sequence

As recorded at the V3 milestone, these items were **not complete** (verify if still true):

- **PR-002:** S-06 supported/limited/unsupported review outcomes; S-07 snapshot-only calculation request; N-02 failed-then-successful attempt recovery and latest-run semantics.
- **PR-003:** production Supabase store adapter and real actor/session resolution (`apps/web/src/auth/actor.ts`, `src/domain/store.ts`); private file bytes/storage, trusted document registration, actual Supabase JWT/RLS/PostgREST testing, real member management, real import mappings and PDF evidence rendering.
- Professional financial-rule signoff; U.S. income-tax draft validation; model/version governance, privacy/consent and legal clearance before regulated or real-data features.
- `mypy --strict` historical errors in `financial/checks.py` (the original record noted 25 `Discrepancy(**dict)` typing errors) and historical `auth_rls_initplan` RLS performance warnings.

**Recommended bounded delivery order** (reorder only with explicit reasoning and safe gates):

1. **Baseline reconciliation:** verify Git state/PR-001 integration, preserve uncommitted changes, inventory current B2C/B2B code, determine which historic defects persist, run available tests.
2. **PR-001 residual work (if needed)** and real-stack security; do not duplicate already merged fixes.
3. **PR-002** financial coverage, frozen request reproducibility and retry semantics.
4. **DUAL-000/001** shared B2C+B2B product routing/workspace shells, manual-entry-first synthetic personal finance and explicit permission model. **Delivered in V5 session 1 (synthetic).**
5. **AI-000/001** contracts, mocked orchestration, 28-case evaluation suite and evidence-grounded synthetic "Analyze Plan" drafts. **Delivered on an offline deterministic provider in V5 session 1; live adapter not implemented.**
6. **PERS-001/002** validated deterministic cash flow/debt/goal planning and a feasible, transparent recommendation queue. **PERS-001 slice + debt-paths engine delivered; PERS-002 intake/scenarios is the recommended next PR** (`docs/engineering/V5_SESSION_1_REPORT_AND_NEXT_PR.md`).
7. **PR-003/DATA-001** real scoped auth, private storage, legal/vendor consent; **SCENARIO-001** independent annual retirement projection engine; then AI-002–005, verified import formats and professional evidence export.

**Release gates:** G0 isolated synthetic demo → G1 security/trust remediation → G2 approval/coverage correctness → G3 real-data technical/consent controls → G4 named professional and legal signoffs for relevant features → G5 measured controlled customer pilots. Never enable a downstream capability solely because UI or a prompt exists.

## 7. Repository work conventions and commands (preserve from V3)

- Before work: `git status`, `git branch --show-current`, `git log -5 --oneline`; inspect the real diff, active PRs (if accessible), migrations, `.env.example`, test config and actual code. **Do not overwrite uncommitted edits or silently merge/force-push.** Reconcile the original parallel-implementation collision before starting multiple concurrent Claude sessions; use distinct branches and file ownership.
- Every server mutation goes through `apps/web/src/domain/*` with a server-resolved `Actor`, trusted transaction/function and tenant check. No client-provided authorization context; reflect DB and TypeScript permissions consistently.
- A change after freeze creates a new revision. Never mutate snapshots, check runs, approvals, packets or audit events retroactively. Protect differential/disposition values from post-approval edits.
- Keep `packages/contracts/src/enums.ts` and `workflow.ts` aligned with database enum and `app.can_transition`; synchronize approval policy from `packages/contracts/src/permissions.ts` `approvalDecision()` across UI, domain and DB.
- Regenerate calculator OpenAPI from `services/calculator` with `python scripts/export_openapi.py` in the calculator service working directory when its API changes; let the pinned drift test enforce parity.
- After changing synthetic source files, regenerate hashes with `python fixtures/synthetic/scripts/compute_hashes.py`; preserve original fixture bytes on Windows via `.gitattributes` as applicable.
- Python environment: from `services/calculator`, edit `pyproject.toml`, run `uv lock` then `uv sync --locked --extra dev`; stop a running Python server before replacing `.venv`. Regenerate generated rule SQL (`0006_seed_rule_sets.sql`) and generated canonical fixture SQL tests via their existing generator scripts; run their `--check` modes.
- PostgreSQL migrations are forward-only: do not edit existing applied `0001`–`0006` unless there is explicit evidence the environment has never applied them; prefer a new migration. For each new or replaced function, inspect and explicitly limit `EXECUTE` for `PUBLIC`, `anon`, `authenticated`, `service_role`, granting only required minimal entry points. Review `SECURITY DEFINER` owners and `search_path`, RLS helper invocation and PostgREST exposure. Do not trust `app.workflow_fn` alone.
- Local SQL harness command (from repo root): `SAGESPAN_PG_BIN=<dir with initdb/pg_ctl> SAGESPAN_TEST_PG_PORT=<free port> python supabase/tests/run_sql_tests.py` (on Windows adapt environment syntax). Real stack: `supabase start`, `supabase db reset`, `supabase test db`, plus test authenticated RPCs via JWT/PostgREST—only when configuration and required local services are available.
- Tests to run and report exact results, depending on scope: `npm run typecheck`, `npm run lint`, contracts Vitest, web Vitest with calculator running, `npm run build --workspace apps/web`, `npm run test:e2e --workspace apps/web`, locked Python `pytest`, SQL harness, and real Supabase security tests. Never report commands that were not actually executed. Separate typecheck, build, unit, e2e and integration evidence.
- Windows/local CLI note: original sessions observed long Bash commands truncating. Prefer Write tool / smaller shell commands; stop a specific stray PostgreSQL cluster with `pg_ctl -D <tmp>/data stop`, not blanket `taskkill`.

## 8. Privacy, regulatory and marketing safeguards

- B2C personalized securities recommendations or automated advice may create investment-adviser obligations; do not ship them until counsel has resolved the applicable federal/state regulatory perimeter, registration/licensing, fiduciary and supervision requirements, suitability/appropriateness where applicable, conflicts/disclosures, records and model validation. Generic budgeting/education still needs honest claims, consumer protection and data security.
- B2B RIA workflow support does **not** mean SageSpan certifies a firm's compliance with SEC Rule 206(4)-7, Rule 204-2 or Regulation S-P. No unsupported “SEC-approved”, SOC 2, fiduciary, ZDR, compliant-by-default, zero-risk or native integration claims.
- Do not integrate real banking/aggregator, investment brokerage, private documents or paid LLM processing of identifiable user data until consent, privacy terms, contractual/vendor review, secured auth/RLS/storage, audit logging, incident response and relevant legal release gates exist.
- Evidence packet names must distinguish bounded review from comprehensive advice or certification. Document historical pricing only as a non-binding experiment: B2B `$750/month` including 100 households plus `$3.50` per additional household; limited `$500/month` pilot up to 50 households. B2C prices remain unvalidated hypotheses in V5.

## 9. Required Claude Code work loop and reporting

For each new task:

1. **Inspect:** current branch, status, constraints, source files and tests; say which requirements are already implemented, partially implemented, proposed, blocked, or independently validated.
2. **Scope:** smallest reviewable PR, affected files, permissions/tenant changes, model assumptions, data migrations, threat model, acceptance tests and non-goals. Do not self-authorize a full V5 rewrite.
3. **Implement:** only the agreed or clearly requested scope; preserve existing working B2C and B2B functions; use synthetic data unless safe release gates are met.
4. **Verify:** positive and negative tests, financial golden cases, cross-tenant isolation, snapshot/receipt integrity, AI evaluation as applicable; distinguish actual executions from CI/historical results.
5. **Report:** changed files and behavior; precise commands with pass/fail counts; security/privacy/financial/regulatory blockers; V5 traceability IDs; exact next PR recommendation.

**Permanent operating rule:** AI proposes and explains. Deterministic financial engines calculate. Authorization and policy constrain. Individuals and authorized professionals decide. Sources, methods, assumptions, versions and history remain independently reviewable.
