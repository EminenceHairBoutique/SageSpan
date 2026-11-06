# SageSpan — CLAUDE.md (V5 Unified, Post-Session 3)

> **Repository-root instructions for Claude Code.** Version: **V5.3**, refreshed **2026-11-06**. These are persistent engineering rules, **not** a one-shot implementation prompt. Read before editing. Keep this file compact enough to remain useful, while consulting the full reference files for precise requirements.
>
> **Historical verification snapshot, not a permanent current-state claim:** GitHub `master` was `52997912dba0b2d7188d29f73bc6df7253a00369` when this update was prepared; the latest confirmed successful `master` Actions run was **42207031870**. Before **every** session, recheck the live branch, open PRs, commits, CI, source code, and migrations. Do not declare a previously recorded test to have been rerun.

## 1. Mission and founder-approved product direction

SageSpan is **one dual-market, AI-native financial intelligence and independent plan-assurance platform**. It serves the lifecycle **Discover → Diagnose → Develop/Design → Review/Decide → Monitor** and maintains three related product pillars:

1. **SageSpan Personal / Household (B2C):** financial visibility, bank/cash accounts, income and bills, budgeting, debt, savings and goals, spending behavior, cash-flow forecasting, feasible next actions, collaborative household management, and educational investing insights. The user retains decision authority.
2. **SageSpan Retirement Studio (B2C and B2B):** intake/readiness, independently verified annual financial projection engines, assumption-aware scenarios and comparisons. Social Security, taxes, Roth conversions, Medicare, Monte Carlo and optimized withdrawal strategies each require separately verified engines before being represented as supported.
3. **SageSpan Advisor & Assurance (B2B):** RIA/advisor/CCO workflows for source intake, reconciliation, frozen snapshots, deterministic independent checks, source-grounded AI draft analysis, coverage-aware review, human approvals, exception management, and auditable evidence packets.

The older V3 “B2B only / not a consumer app” restriction is **superseded**. Preserve its working assurance product, rigor, methodology and safeguards. SageSpan is a **provisional brand** until trademark clearance. Commercial pricing figures are **unvalidated hypotheses**, not public offers or billing entitlements.

The platform must make financial decisions clearer without inventing confidence, guaranteeing results or pretending that a computed `PASS`, an AI explanation and an authorized professional approval mean the same thing.

## 2. Source-of-truth precedence and required references

Inspect these **actual repository files** before proposing related changes:

- `CLAUDE.md` — this operational instruction file; it does not replace the complete V5 blueprint.
- `docs/product/SAGESPAN_V5_MASTER_SOURCE_OF_TRUTH.md` — controlling V5 vision, market segments, product scope, calculation architecture, AI policy and release gates.
- `docs/engineering/SAGESPAN_V5_ENGINEERING_PROMPT.md` — detailed reference implementation requirements. **Reference, not permission to implement everything at once.**
- `docs/requirements/SAGESPAN_V5_TRACEABILITY.md` — S-01–S-10, N-01–N-05, AI, finance, consent and release-gate requirements.
- `docs/product/FEATURE_STATUS_MATRIX.md` — product status, but some dated rows may lag newer merge results. Compare to code and CI.
- `docs/legal/FEATURE_RELEASE_GATES.md` — G0–G5 and legal/product release controls.
- `docs/finance/RULE_VERIFICATION_AND_MODEL_REGISTRY.md`, `docs/RULE_VERIFICATION_LOG.md` — versioned financial methods, status and professional validation.
- `docs/ai/AI_EVAL_MATRIX.md` — 28 labeled offline AI cases AI-E01…AI-E28 (plus consumer cases in current tests).
- `docs/ai/SAGESPAN_AI_CORE_FABLE_5_1_MASTER_PROMPT.md` — architecture/reference for the custom AI runtime and later specialization, **not** a full automatic task directive.
- `docs/ai/AI_EVALUATION_PLAN.md` — **new plan to add to the repo** if absent; live-model comparisons, tool-state testing, safety benchmarks, dataset rights and future LoRA/QLoRA qualification. Do not assume it exists until confirmed.
- `docs/design/03_SageSpan_Claude_Code_UI_UX_Master_Prompt.md` — design brief, subject to existing user workflows and data validity.
- `docs/roadmap/02_SageSpan_Build_to_Launch_Execution_Checklist.md` — long-term plan; older project-status claims must be reconciled with current `master`.
- `docs/history/CLAUDE_V3_ENGINEERING_RECORD_2026-11-05.md` and `CLAUDE_old.md` (if present) — historical engineering records; never restore superseded V3-only positioning.

**Authority hierarchy:** Explicit latest founder decisions → V5 product, financial security and regulatory invariants → approved ADRs and scoped PR acceptance criteria → repository code/CI as evidence of implementation. A dated document is not proof that a capability is currently live. If two sources disagree, note the conflict and recommend a change record; never silently choose the more permissive security or financial interpretation.

Use **one source-of-truth status vocabulary**: `PROPOSED`, `IMPLEMENTED_SYNTHETIC`, `CI_TESTED`, `INDEPENDENTLY_VALIDATED`, `REAL_STACK_VERIFIED`, `RELEASED`, `BLOCKED` and `UNKNOWN`. A mock provider, prefilled persona or green shim database test is **not** real-customer readiness.

## 3. Verified post–Session 3 state (dated snapshot)

**Merged into `master`:**

| PR / milestone | Verified repository evidence | Remaining qualification |
|---|---|---|
| PR-001 Trust Boundaries | **PR #5 merged**; migrations `0005_trust_boundaries.sql`, `0006_seed_rule_sets.sql`; receipt, privilege, audit-chain, source-fact controls | **Not** demonstrated against full real Supabase Auth/JWT/PostgREST/RLS/Storage |
| V5 Dual Market | **PR #7 merged**: consumer workspace, B2C calculation engines, decision policy, offline AI; professional console retained | Synthetic/demo only |
| PERS-002 | **PR #6 integrated via V5**: add/edit/retire records, Start Fresh onboarding, cash-flow scenario comparisons | Synthetic file-backed demo only |
| PR-002 Approval Correctness | **PR #9 merged**, migration `0007_coverage_and_reproducibility.sql` | Real-stack auth security testing outstanding; tie ordering and labeling to validate |
| Latest inspected `master` | Commit `52997912dba0`, successful CI run `42207031870` | CI success ≠ launch authorization |

**Session 3 reported/CI evidence:** 119 Python tests, 47 contract tests, 104 passing web tests (2 skipped) and 16 Playwright browser scenarios; SQL suite passed 7 files on PostgreSQL shim test infrastructure. Numbers are **historical run outcomes, not current test evidence** and are not evidence of real Supabase security. Check actual logs and rerun relevant suites for any new change.

**PR #8 was closed unmerged.** Do not claim that its proposed E2E keepalive change was deployed merely because the later CI run was green. Diagnose new failures from current evidence instead of relying on stale history.

**Implemented in synthetic demonstration:** 11+ personal workspace routes, guided onboarding, dated cash-flow baseline, verified receipt checks, manual account/income/obligation/debt/goal records, debt payoff scenarios, spending change and income-interruption scenarios, deterministic next-three-actions policy, education, retirement readiness, AI mock reviews with evidence and feedback, firm assurance flow, tiered data-state labels.

**Not established:** real customer sign-in or persistence, read-only bank aggregation, transaction ingestion/reconciliation, production household/firm grants, privately retained source bytes, independent professional model validation, full annual retirement projections, live LLM accuracy, regulated recommendations, automated money movement. The production `/app` actor remains gated until verified otherwise.

### Immediate engineering priorities, not all at once

1. **PR-003A:** actual Supabase Auth and additive personal/household/firm workspace schema, server-resolved identity.
2. **PR-003B:** domain-scoped membership, invitations, purpose/expiry/revocable consent, RLS and limited RPC permissions.
3. **PR-003C:** secure tenant-backed persistence, trusted document bytes, storage, provenance and durable audit history.
4. **PR-003D:** real Supabase Auth/JWT/PostgREST/Storage/RLS negative and positive tests from a clean migration replay.
5. In isolated synthetic branches: PERS-003 transactions/recurring spending, PERS-004 budgets, PERS-005 feasibility-aware decisions, PLAN-001 annual retirement engine, AI-CORE-000/001 evaluated tool orchestration, UI-000/001 design audit/tokens.

**Dated PR-002 follow-ups:** synchronize latest-attempt ordering between TS and SQL with a canonical sequence/tie-breaker; document frozen calculation policies versus current authorization and consent; ensure `REVIEWED_WITH_LIMITATIONS` with a human `APPROVED` decision is never displayed as verified unsupported checks.

## 4. Repository architecture — preserve working foundations

- **Web:** `apps/web` — Next.js App Router, React, strict TypeScript, Tailwind, server actions and server-resolved actors.
- **Contracts:** `packages/contracts` — Zod, typed financial/AI/consent/workflow contracts, canonical JSON, hashes, status/permission rules.
- **Calculation service:** `services/calculator` — **single authoritative Python/FastAPI calculator using Decimal** and versioned method/rule registry; no parallel `services/calc` implementation. Expensive calculations do not run in Vercel request handlers.
- **Data and security:** `supabase` — PostgreSQL `app` schema, forward-only migrations, RLS, RPC privileges, signed/session-authenticated identity (production implementation remains PR-003).
- **AI control plane:** `apps/web/src/ai/{provider,review-orchestrator,evidence-resolver,tools,result-validator}.ts`, prompts, tests and `packages/contracts` AI records; preserve existing mock/scripted provider and benchmark cases.
- **Synthetic fixtures:** `fixtures/synthetic` — known personas and canonical fixture hashes; these are not customer records.
- **Historical frozen data:** snapshots, calculation receipts, check runs, reviewer decisions, provenance, packets and audit events are versioned/immutable. Corrections create new revisions or events.

Do not create competing finance implementations in client JS, SQL or another calculator service. Do not casually rename/remove existing routes, API contracts, test fixtures, migrations or export formats.

## 5. Financial truth, decision policy and reproducibility

**Absolute rule:** LLMs propose, explain and ask questions; versioned **deterministic** financial engines calculate; authenticated user/professional makes consequential decisions. Financial methods must be documented, golden-tested, independently reviewable and have explicit supported scope.

- All dollar amounts and projected effects must derive from a trusted versioned receipt or clearly marked user-reported value. Do not invent APRs, balances, returns, probabilities, dates, citations or projections. If an engine is unavailable, respond `UNAVAILABLE`/`ERROR` with next-step guidance, not a guessed figure.
- Preserve 3-tier canonicalization parity (SQL, TypeScript, Python), frozen input hashes, calculator method identity, rule status/checksum, actor/workspace scope, exact rounding and reproducible source identities. **A matching hash alone is not proof of the caller or calculator's authenticity.**
- **PR-002 S-06:** per-account and per-check status must preserve `PASS`, `NOT_REQUIRED`, `UNSUPPORTED`, `INDETERMINATE`, `ERROR`; review outcomes such as `SUPPORTED_CHECK_VERIFIED`, `APPROVED_WITH_EXCEPTIONS`, `REVIEWED_WITH_LIMITATIONS` must correctly describe actual supported scope. A human `APPROVED` decision does **not** turn unsupported checks into verified results.
- **PR-002 S-07:** calculation requests come **only** from immutable, versioned frozen snapshot inputs, including financial policy assumptions and applicable account classifications; dynamic permissions are checked separately at time of action.
- **PR-002 N-02:** latest-attempt semantics govern current verification; preserve past ERROR runs in immutable history, recover on later valid PASS, block when latest attempt is ERROR. Define consistent tie ordering across SQL and TS.
- **Debt accuracy:** distinguish standard vs active promotional APR when ordering strategies; compare minimum-only baseline with extra-payment strategies honestly; verify affordability against the **projected household cash-flow timeline** and reserve floor, not only amortization payoff or today's cash. Define `CASHFLOW_FEASIBLE`, `AMORTIZATION_FEASIBLE`, `UNKNOWN` separately.
- **Temporal accuracy:** anchor cash-flow/scenarios on explicit as-of dates and source freshness; missing is not zero, historical/future-date inputs must be surfaced.
- **Decision intelligence:** `Evidence → Patterns → Constraints → Feasible alternatives → Ranked explanations → User choice → Monitoring`. Show assumption sensitivities, alternative paths, downsides, reversibility, cost and missing facts. A recommendation is not automatically useful just because it has a score.
- **Retirement projections:** readiness UI exists; the annual engine and regulated advanced methods do **not**. Implement PLAN-001 as a versioned gross-basis annual ledger with explicit exclusions before claiming projections. Do not imply it covers Social Security, tax/Roth, Medicare or Monte Carlo before supported and signed off.

## 6. SageSpan Intelligence — proprietary AI architecture and future fine-tuned model

The goal is to **own the financial intelligence system**, model-independent runtime and evaluation pipeline. It is **not** to train a foundation model from scratch.

- **Existing AI-000/001:** `MockDeterministicProvider` and `ScriptedProvider`, evidence resolver, allowlisted read-only tools, source/citation validator and 28 labeled offline AI evaluation cases. These demonstrate **control-plane behavior**, not live LLM planning accuracy.
- **AI-CORE-000:** document model-agnostic runtime, threat model, evaluation plan, provider contracts, workspace-policy matrix, data-flow diagrams, human approval boundary and cost/latency budgets.
- **AI-CORE-001:** bounded **multi-step tool loop**, not a single model output followed by tools. Server authenticates and authorizes → retrieves minimal grounding → validates provider tool request and arguments → dispatches only allowlisted tools → returns signed/verified deterministic tool result as a subsequent model observation → validates final evidence-linked draft → records append-only audit/feedback. Enforce loop steps, token, time and cost budgets and circuit breaker.
- **AI-CORE-002+** (version labels should follow the current AI master when updated): guarded live-model adapter against **synthetic** cases; document retrieval with source/effective date; real financial scenario integration only after method validation; expert-reviewed head-to-head model comparisons; eventually evaluate private open-weight inference and LoRA/QLoRA adapters.
- **No provider or model is automatically trusted.** Model output is untrusted input. Validate schemas, evidence locations, source currency/scope, amounts, dated method versions, statuses, hallucinated IDs, forged “PASS” and approval claims, and untrusted documents with prompt-injection instructions.
- **No forbidden tools:** AI may not grant consent, alter verified facts, modify audit chains, approve checks/reviews, trade securities, move money, send irreversible communications or perform regulated personalized recommendations without separate legal/supervisory gates.
- **Training data governance:** public and licensed sources only within rights, strictly synthetic or approved expert-created private examples for initial tuning; consent, provenance, confidentiality, splits, quality review, contamination prevention and deletion policies. **Real client records are never training data by default.**
- **Evaluation:** always run `AI-E01…AI-E28` offline regressions; add stateful tool-loop, financial numeric consistency, cross-tenant attacks, prompt-injection and live-model false-positive/missing-information benchmarks. Expert-defined baseline and predetermined promotion thresholds required; no “tuned model better” claim without measurements.
- **Use Claude Code's selected development model (e.g. Fable 5.1) only as the developer.** The shipped runtime must have a replaceable provider abstraction and support eventual commercially permitted open-weight models; no assumption a proprietary hosted model can be fine-tuned or self-hosted.

## 7. Security, privacy, consent and audit invariants

Preserve historical findings S-01–S-10/N-01–N-05 and their regression probes. Do not weaken PR-001/PR-002 to advance a new feature.

1. **Actor, tenant and purpose:** server resolves authenticated actor and live memberships; every select/mutation/tool/AI context checks workspace, org, resource domain, purpose, expiry and revocation. IDs/cookies or client-supplied `org_id` never grant authority. Firm membership never implies permission to personal accounts.
2. **Defense in depth:** PostgreSQL RLS, scoped functions, explicit grants, trusted server checks, foreign keys and triggers. All `SECURITY DEFINER` functions use controlled `search_path`, minimal grants and test privilege inventories; revoke `PUBLIC`/`anon`/`authenticated` where unnecessary. `app.workflow_fn` is a coordination marker, never an independent trust barrier.
3. **Audit and receipts:** trusted derived actor, allowlisted event types, immutable sequence-numbered linear hash chain, concurrent append protection. Audit hash chains do not cryptographically attest actor identity by themselves; data bytes and output artifacts require authenticated provenance. Handle rolled-back denial events via durable authorized mechanism.
4. **Immutable evidence:** frozen snapshots/revisions, supported checks, dispositions and source hashes are not edited in place. Trusted server computes SHA-256 from privately retained uploaded bytes; evidence packet manifest should hash each exported artifact and identify underlying versions.
5. **Consumer versus firm privacy:** `PERSONAL`, `HOUSEHOLD`, `FIRM` are distinct. Sharing requires granular resource/purpose-scoped, expiring, revocable grants; reject cross-domain access, log access, preserve legally required records, and test revocation during active jobs.
6. **Real-stack validation:** PostgreSQL shim/pgTAP tests are necessary but not sufficient. Before real financial records, test against actual local/staging Supabase Auth/JWT/PostgREST/Storage/RLS with at least two unrelated consumers, two unrelated firms, one shared household, limited firm grant, expired/revoked grant, anon, ordinary authenticated and service role. All unauthorized operations must fail closed with non-disclosing errors.
7. **Infrastructure controls:** separation of dev/staging/prod; service-only secrets; CSP/HSTS, upload scanning, rate limiting, CSRF/SSRF safeguards, retries/idempotency, encrypted backups and restore drills, incident response and privacy-safe logs. No PII, credentials or real bank statements in Git, fixtures, development prompts or third-party AI requests before gated review.

## 8. Release and regulatory gates

| Gate | What must be proven | Status at 2026-11-06 baseline |
|---|---|---|
| G0 | Controlled, honest synthetic B2C/B2B demonstration | Implemented and CI-tested (scoped) |
| G1 | PR-001 control remediation + real-stack trust review | PR-001 merged; **real-stack pending** |
| G2 | PR-002 coverage/reproducibility/latest-attempt correctness | PR-002 merged; continue cross-tier regression |
| G3 | Production Auth, RLS, private storage, consent, data retention, operational security | **PR-003 outstanding** |
| G4 | Financial methodology signoff + legal regulatory perimeter for enabled functions | Outstanding |
| G5 | Measured design-partner pilots, support and release acceptance | Outstanding |

Investment-adviser, SEC/state registration, fiduciary, records/safeguards, privacy and consumer-finance obligations are counsel decisions tied to **features and business model**. Personalized securities/tax/insurance advice (Tier 3) stays disabled until cleared; financial execution/money movement (Tier 4) stays out of scope. Never claim “SEC-certified”, certified fiduciary, SOC 2, zero data retention, zero risk or that SageSpan's AI replaces a registered adviser/CPA. RIA workflows do not certify a firm's compliance.

## 9. UX/UI design and product conventions

- Preserve **premium, modern, sleek, calm, accessible** SageSpan art direction: refined navy `#0B1F3A`, teal `#0E7C72`, light neutral canvas `#F5F7FA`; cohesive spacing, typographic hierarchy, strong focus and touch targets.
- Consumer primary groups: **Home / My Money / My Plan / Guidance** with a simple first-run intake and 3 action-focused recommendations. Professional: review queue, clients, sources/imports, checks, AI drafts, approvals and firm settings. Shared design tokens, distinct information density.
- Show **data quality, source, as-of date, version, confidence/limitation, unsupported status and financial impact** next to claims. A mock AI response must be marked mock. A review with limitations must never appear as full independent verification.
- WCAG 2.2 AA target, keyboard and screen reader, chart tables/alternatives, mobile responsiveness, reduced-motion, meaningful empty/loading/error/consent states. Preserve routes and existing flows; UI refactoring must not change underlying math or permissions.
- Keep styling/visual PRs isolated from SQL migrations and financial engines. Never redesign from scratch without explicit architectural decision and reviewed migration plan.

## 10. Code-change workflow, branching and verification commands

**Before code:**

1. Run `git status --short`, `git branch --show-current`, `git log -5 --oneline`, inspect remote branch and PR status, current CI, migrations, feature matrix and target files. Preserve user/uncommitted changes; no force push or destructive cleanup.
2. Define a single **PR-sized scope**: exact user benefit, existing behavior, affected files, release gates, threats, non-goals, measurable acceptance cases. Flag dependencies; do not execute the entire roadmap in one session.
3. Follow the workstream: PR-003A/B/C/D for production; AI-CORE-000/001 on **synthetic** branch; PERS/PLAN/UI in coordinated isolated branches with explicit file ownership.
4. Add **forward-only SQL migrations** starting after current `0007` (next number determined by inspection). Do not rewrite applied `0001`–`0007`. Inspect and reassert privileges for every new/altered function; test tenant/actor/consent negatives.
5. Keep calculator rule/method registry and generated OpenAPI in sync: from `services/calculator`, `python scripts/export_openapi.py` as appropriate; use `uv lock`, `uv sync --locked --extra dev`, generated SQL/canonical fixture `--check` scripts. Regenerate fixture SHA-256 only if synthetic source bytes intentionally change (see `fixtures/synthetic/scripts/compute_hashes.py`); honor `.gitattributes` LF/binary rules.
6. For relevant scopes, run and report individually: locked Python `uv run --locked python -m pytest`, `npm run typecheck`, `npm run lint`, Vitest in contracts and web, `npm run build --workspace apps/web`, `npm run test:e2e --workspace apps/web`, `python supabase/tests/run_sql_tests.py`. Real-stack checks: `supabase start`, `supabase db reset`, `supabase test db`, plus JWT/PostgREST/Storage API adversarial calls when isolated local stack and credentials permit.
7. For AI changes, run the 28-case offline evaluation regression and new workflow-specific tests; record candidate model/prompt versions, provider mode, run fixture IDs and failure rates. For financial changes, run golden/negative tests and restore typed missing/unsupported/error handling.
8. Label checks `PASS`, `FAIL`, `SKIPPED`, `NOT_RUN`, `BLOCKED`, with exact counts/commands/environment. Never report test execution or professional signoff from intuition or historical documentation.

**Every PR report must include:** branch/base/HEAD, files changed, architecture and threat implications, data migrations and rollback/forward strategy, positive/negative tests and exact outcomes, open blockers, traceability IDs, release gate impact, and next small PR. Do not merge/deploy/live-activate without authorization.

## 11. Roadmap control and founder approval boundaries

- **Priority 1:** PR-003 secure identity, persistence, consent, RLS and real-stack testing.
- **Priority 2:** synthetic PERS-003/004 and PLAN-001 verified financial usefulness; UI audit/implementation independently.
- **Priority 3:** SageSpan Intelligence runtime and evaluation; live provider only with synthetic data until consent/vendor gates; future fine-tune when benchmark supports it.
- **Priority 4:** connected financial accounts, firm pilot integrations, subscriptions, monitoring and advanced regulated models after their specific gates.
- Require founder signoff for **legal/regulatory scope, vendor sharing of real data, training-use rights, major retained data policies, pricing commitments, security-risk acceptance, destructive migrations**. Do not repeatedly seek approval for routine scoped coding decisions.

### Permanent operating standard

> **AI proposes and explains. Verified deterministic financial engines calculate. Server policy, consent and authorization constrain. People and authorized professionals decide. Evidence, assumptions, financial methods and history remain independently reviewable.**
