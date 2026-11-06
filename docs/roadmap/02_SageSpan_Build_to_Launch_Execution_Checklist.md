# SageSpan — Build-to-Launch Master Execution Checklist
**Current reference:** 2026-11-06; `master` = `662d48a`; `feat/v5-dual-market` = `daa8f3b`; preserve V5 B2C+B2B requirements.  
**Symbols:** `[ ]` not independently accepted; `[x]` previously delivered/reported, but rerun/verify when noted.  
**Release sequence:** L0 synthetic demo → L1 safe design-partner demo → L2 controlled real-data beta → L3 bounded general availability → L4 regulated/advanced modules.  
**Principle:** Do not begin live financial-data collection until real identity, RLS, legal perimeter, provider contracts and operational security are accepted. Do not deploy the full program as one PR.

## Quick-start: the exact next developer session

- [ ] **Protect local changes:** In SageSpan root run `git status --short`, `git branch -vv`, `git fetch origin --prune`, `git log --oneline --graph --all -20`; capture results in the PR description. **Do not discard working-tree changes** or run force push.
- [ ] **Confirm remote facts:** `master` includes merged PR-001; `feat/v5-dual-market` exists remotely; note 13 ahead/1 behind at audit. If facts changed, update the plan.
- [ ] **Investigate latest master E2E failure:** Open https://github.com/EminenceHairBoutique/SageSpan/actions/runs/42174852606 and download `playwright-report` artifact; inspect trace `assurance-flow-Patel-.../trace.zip`; look for Next server crashes or request cancellation. Reproduce with Linux/CI environment if possible. Check `apps/web/src/app/api/households/[id]/evidence/[packetId]/route.ts`, `apps/web/e2e/assurance-flow.spec.ts:129`, export memory/timeout and stdout. Fix underlying cause rather than increasing retry count blindly.
- [ ] **Reconcile branch ancestry safely:** On a clean `feat/v5-dual-market`, merge `origin/master` (or another reviewed method that preserves shared history). Resolve conflicts without reverting PR-001. Push normal updates. Avoid rebasing a shared published branch unless coordinated.
- [ ] **Open a draft PR** from V5 to master. GitHub CI currently triggers on `pull_request`, but **not** feature-branch pushes. Use `gh pr create --draft --base master --head feat/v5-dual-market --title 'V5: dual-market synthetic foundation'` if GitHub CLI is configured. Include feature matrix, test commands, known limitations, screenshot checklist and release gates.
- [ ] **Restore all-green CI:** Python, typecheck, lint, contract/web unit tests, SQL harness, Playwright 11 scenarios, generator drift checks. CI artifacts retained for failures, with reproducible root cause and fix. Do not bypass tests to merge.
- [ ] **Hold merge:** Require code review of changes affecting authorization, financial computations, data-state semantics, AI validation and tenant boundaries; verify no sensitive documents or keys in Git history.

**Definition of done for Integration-001:** V5 branch reconciled with current master; full CI green on PR; evidence export reliable; no regressions in old firm flow; no code accidentally lost; all implementation claims matched to inspected code.

## Epic SEC-001 — Close PR-002 (P0, before real firm plan approvals)

Owner: backend and security engineering. Files: `apps/web/src/domain/checks.ts`, `review.ts`, `freeze.ts`, `packages/contracts/src/*`, new forward-only `supabase/migrations/0007_*`, `supabase/tests/007_*`, fixture/probes and documentation.

- [ ] **S-06 coverage semantics:** Define matrix by account, check type, rule applicability, `PASS`, `NOT_REQUIRED`, `UNSUPPORTED`, `INDETERMINATE`, `ERROR`. `NOT_REQUIRED` means the supported rule genuinely does not apply, not “verified”; unsupported and indeterminate may never be silently promoted to supported coverage. Clarify whether approval can proceed with explicit qualified exception versus is blocked by policy; packet must expose uncovered scope. Mirror SQL and TS decisions.
- [ ] **S-07 reproducibility:** Freeze *every* calculation-relevant input, including versioned tolerance policy, scope metadata and rule selection. Derive check requests exclusively from frozen snapshot bytes. No live-firm-policy reads during replay. Canonicalization parity and mutation-after-freeze tests.
- [ ] **N-02 latest-run semantics:** Latest attempt per `(snapshot, account, check kind)` governs present status; historical ERROR retained but a later valid PASS can clear that operational blocker. A later ERROR must override old PASS for current review. Stable ordering with sequence/IDs; test tied timestamps.
- [ ] **Approval matrix:** Two-person oversight where required, separation of duties, role-policy parity in SQL and TS, no direct database column bypass. Keep `app.workflow_fn` internal coordination only—not a security authorization token.
- [ ] **Packet limitation text:** Include each supported/unsupported account and rule, inputs and version, latest run, reviewer exceptions and no-certification disclaimer. Verify export hash binding to all advertised content or independently attest formats.
- [ ] **Regression:** Add positive and negative cases for missing source, unsupported-only household, joint-life-table need, inherited IRA, actual NOT_REQUIRED, ERROR→PASS and PASS→ERROR, policy changed after freeze, and forgery attempts. Verify no historical S-01…S-05/N-01/N-03/N-04/N-05 regression.
- [ ] **Run:** Python golden, TS unit, SQL pgTAP harness, real Supabase later, Playwright Patel flow and packet export.

**Definition of done:** Unsupported scope is never implicitly approved; every check request can replay from an immutable snapshot; latest-run logic converges across tiers; evidence packet accurately describes exactly what was and was not verified.

## Epic SEC-002 / PR-003 — Real identity, database and privacy controls (P0, G1–G3)

- [ ] **Threat model and data classification:** Financial, PII, credentials, uploaded documents and AI prompts. List every trust boundary and whether each service receives full data, pseudonymized excerpts or no data. Include RIA export/retention rights and incident response.
- [ ] **Production Supabase project + separate environments:** Isolated dev/staging/prod, IaC/config as code, generated secrets in secret manager, encryption, network restrictions, auditable migrations, source control with zero plaintext secrets. Keep synthetic demo isolated from production.
- [ ] **Real-stack acceptance:** Run `supabase start`, `supabase db reset`, `supabase test db`, actual Auth/JWT/PostgREST tests using ordinary authenticated users, app schema exposure, SECURITY DEFINER and RLS policies; make CI environment reproduce supported Supabase major-version behavior, not rely only on shims. Conduct negative adversarial probes for every cross-tenant access path.
- [ ] **Authentication:** Magic link/passkeys or approved MFA; session lifecycle, CSRF boundaries, device/session revocation, recovery, secure cookies, expired tokens, rate limiting. `getPersonalActor` demo cookie must not be used to authorize production access.
- [ ] **Workspace schema:** `principals`, `workspaces` (PERSONAL/HOUSEHOLD/FIRM), memberships, granular domain permissions, invitation expiry, re-verification, household/legal ownership transitions and firm-client grants; retain existing firm `org_id` security model for historical tables. Use new forward-only migrations.
- [ ] **Consent and revocation:** Consent object describes exact resource domains, purpose, grantor/grantee, effective/expiry, user-visible access ledger, revoke action, service-side immediate denial, propagation to caching/AI/background jobs; test “revoked while active job runs.” Distinguish deletion from records a regulated firm must retain.
- [ ] **Document bytes and provenance:** Private object storage, time-limited upload URLs, size/type allowlist, malware and MIME validation, compute hash from server-received bytes, record source provenance and trusted location; no caller-supplied digest as authoritative. File metadata alone does not constitute verified evidence.
- [ ] **Server-only financial store:** Replace `.demo-state` read-modify-write with transactional database repositories, optimistically checked revisions, idempotency keys, append-only events, audit actors derived from authenticated sessions. Enforce org/workspace scope at SQL and API layer.
- [ ] **Trusted calculator invocation:** Only server/service principals can record results; authenticated service-to-service request signing or equivalent verified boundary, request/canonical hash plus authenticity of producer, replay protections; limit outbound network and log sanitized error states.
- [ ] **Secrets, abuse, infrastructure:** Bot/abuse control, request limits, upload quotas, safe parsing, CSP and standard headers, dependency/supply-chain scanning, backup encryption, restore drills and disaster recovery.
- [ ] **Privacy lifecycle:** Clear data inventory, purpose limitation, delete/export UI, retention schedules, access request workflow, vendor-subprocessor record, DPAs and AI-training exclusions where contractually available; minimal sensitive logging and redaction.
- [ ] **Penetration test:** External or independent application security assessment before paid production launch, with findings closed or risk-accepted by named owner.

**Definition of done:** A consumer and a firm can each sign in securely; multiple unrelated users/firms are isolated by **actual** RLS/JWT/PostgREST tests; grants have exact scope and revocation; uploaded bytes and calculation runs have authenticated provenance; backups and incident processes demonstrably work.

## Epic DATA-001 — First-run Personal onboarding (P1; synthetic before G3)

- [ ] **Start fresh wizard:** Welcome → choose individual/household → objectives and basic context → accounts and balances → income (at least 3 observed months where available) → obligations → variable spending → debts → goals → review assumptions → baseline. Allow skipping, saving draft, resume, and “I don't know.”
- [ ] **Forms:** Add/edit/retire account, income stream, recurring bill, variable category, liability, goals; accessible inline validation, date and currency, evidence state, auto-save only with clear feedback, version history and undo where safe.
- [ ] **Profile preferences:** cash floor, target buffer, debt-extra cap, reporting cadence/quiet mode, risk/timeline preferences without regulated claims. Represent absent values as MISSING, not 0.
- [ ] **Trace and provenance:** Per-field timestamp/source/owner; revisions append-only; recompute creates a new snapshot; show stale/assumed/incomplete provenance prominently but calmly.
- [ ] **Empty and error states:** Brand-new workspace builds from zero; expired input or calc-service error does not show silently stale or invented amounts; clear retry path. Demo never solicits real private data.
- [ ] **Tests:** Zod schema boundary cases; negative amounts/dates, malformed decimals, future timestamps, duplicate accounts, foreign actor, revoked membership, concurrent edits, E2E fresh workspace from empty to receipted baseline.

**Definition of done:** A new synthetic workspace can complete a user-controlled intake and see credible, receipted baseline/priority cards without dependence on the Castillo seed; malformed/missing data cannot fabricate confidence.

## Epic FIN-001 — Harden cash-flow, debt and recommendation methodology (P1)

- [ ] **Explicit planning date:** Remove silent `2026-01-01` fallback. Choose/confirm `as_of_date`; assess each input's staleness and future-date mismatch; preserve exact canonical inputs in immutable snapshot for replay. Test contradictory timestamps, timezone crossings and late-arriving data.
- [ ] **Cash-flow model:** Document income cadence transformations, irregular/seasonal income thresholds, essential vs optional classification, bill collisions, future one-offs, income interruptions, reserve floor and projected liquidity. Contrast median vs minimum vs percentile with adequate sample size; unknowns are visible.
- [ ] **Debt strategy semantics:** Test promotional APR changes in *target ordering* and interest accrual; compare minimums-vs-extra separately from same-budget ordering; model required minimum variations, fees, daily accrual limitation and interest capitalization when relevant. No “guaranteed savings” language.
- [ ] **Cross-engine affordability:** Debt extra-payment recommendations must be tested against the dated cash-flow projection and chosen minimum floor—not merely current cash balance. Present `AMORTIZATION_FEASIBLE` vs `CASHFLOW_FEASIBLE` vs `UNKNOWN` distinctly.
- [ ] **Scenario engine:** Version `personal.cashflow_scenario@20xx.x` (or documented versioned mode) for spending change, savings contribution, pay change, one-year income interruption and emergency expense. Freeze scenario inputs; compare baseline and variants with identical assumptions; include limitations and adverse-case tests.
- [ ] **Decision policy:** Priorities from constraints before rankings; explicit weights; no commercial/revenue influence; accepted numbers only from engine runs; no Tier-3/4 output. Feed user decisions to monitoring while preserving autonomy. 3 primary cards maximum; user can inspect alternatives and omitted/rejected suggestions.
- [ ] **Model verification:** Independent finance reviewer signs assumptions, calculations, rounding, effective dates, known limitations and source register per method version. Add hand-derived goldens and property/fuzz/cross-language tests. Preserve old receipts on method upgrade.

**Definition of done:** An action labeled “realistic” cannot violate known cash-flow or reserve constraints; equal-budget comparisons are clear; calculators are reproducible and accepted by a named qualified reviewer for stated supported scope.

## Epic DATA-002 — Spending and behavioral intelligence (P1 after data foundation)

- [ ] **Start with manual/CSV transaction intake:** secure upload, preview and map schema; date/amount/currency/account/description, transfer detection, refund/chargeback reversal, merchant aliases, deduplication and user override; original raw data preserved privately with source hash.
- [ ] **Reconciliation engine:** Opening + inflows − outflows = closing with explicit unknown/missing transactions; use account-level and aggregate coverage, no silent double count. Include pending/posted status and within-account transfers.
- [ ] **Category engine:** Human-correctable category tagging, split transactions, recurring bill candidates vs confirmed bills, salary/payday rhythm, seasonal changes, subscription increases. Make confidence / observation count visible.
- [ ] **Pattern quality:** Require minimum sample and stability checks before calling something a pattern. Provide distinct states `OBSERVED`, `HYPOTHESIS`, `NOT_ENOUGH_HISTORY`, `CONFLICTING`; regression fixtures for common data errors.
- [ ] **Decision follow-through:** Compare suggested actions against subsequent observed trends without claiming causality, provide a neutral progress view, fewer interruptions and a digest/quiet-mode preference.
- [ ] **Bank connections only after G3:** Evaluate aggregator vendor/coverage/security/cost, DPAs, consent revocation, connection recovery, sync replay, idempotency, webhook signing and data minimization; integrate read-only before considering any action API.

**Definition of done:** Spending totals reconcile within declared coverage; detected patterns have provenance and sample requirements; consumer can correct a merchant/category; nothing is guessed as verified.

## Epic PLAN-001 — Retirement Studio (P1/P2; one validated slice first)

- [ ] **Define financial specification:** household and spouse birth dates, target ages, retirement spending in today's or nominal dollars, assets by tax treatment (only if modeled), contribution schedule, inflation, returns, fees, income sources, withdrawal timing and one-time events. Explicit event ordering and year boundaries.
- [ ] **Build independent annual cash-flow engine in Python:** age/year ledger with beginning assets, contributions, growth/fees, retirement spending/income, withdrawals, year-end assets and unmet cash needs. Define nominal/real basis and deterministic scenario replay. A *gross-basis first model* must not imply it includes taxes, SSA rules, Medicare, RMD interactions or sequence-of-returns risk.
- [ ] **Scenario comparisons:** Retire earlier/later, different savings, reduced spending, weaker real returns, increased inflation, one-year income interruption. Baseline + A/B comparison with assumption table, confidence limits, and what changes. Same inputs must lead to identical outputs.
- [ ] **Reviewer signoff:** External financial planner/actuary/CPA as appropriate for module and claims; dated benchmark suite and sign-off before enabling results to real users.
- [ ] **Later modules as separate releases:** validated RMD coordination; SSA claiming; tax/estate assumptions; withdrawal order/Roth; Medicare/health costs; Monte Carlo with seeds, correlation/distribution assumptions and calibration. Do **not** market integrated “tax-optimal” recommendations before supported.
- [ ] **B2C and B2B view parity:** Household may opt to share the *particular plan snapshot* with a professional; advisor views provenance, assumptions, calculation version, coverage and review status rather than quietly editing consumer data.

**Definition of done:** A retirement scenario shows a reproducible year-by-year model with declared omissions and reviewer-approved supporting tests; client and advisor can understand why two scenarios differ.

## Epic AI-001 → AI-005 — Reliable planning intelligence (P1/P2)

- [x] **AI-000 baseline:** Source contains mock/scripted provider adapter, versioned output contract, evidence resolver, validator, tool allowlist, and 28 labeled evaluations. The 30-case offline run is **Claude-reported**, not a live-model verification.
- [ ] **Provider release requirements:** Choose one or more deployable providers; require contract/DPA, retention and training position, data residency where relevant, per-workspace/firm opt-in, per-model registry, budgets, timeout/circuit breaker, provider outage mode, zero PII in logs.
- [ ] **Proper bounded tool loop:** Move from single `complete()` plus post-hoc dispatch to explicit validated tool-call turns; feed authorized tool results back to the model under strict budgets; all invocation goes through server allowlist. Tools read only, except safely isolated scenario computation; never grant approve/modify fact/transfer powers.
- [ ] **Live-model eval before release:** Reuse 28 labeled fixtures, add at least 20 new realistic household scenarios (misleading documents, numerical contradictions, year rules, conflicts, impossible recommendations, disallowed advice, consent revocation). Human experts label expected outcomes. Measure citation correctness, fabricated amount rate, unnecessary alarm, unsupported case detection, rejection/abstention, action usefulness, and consistency across model versions.
- [ ] **AI-002 extraction:** Only after secure private document storage; structured confidence and source-location extraction, no automatic fact verification, human reconciliation and prompt injection quarantine.
- [ ] **AI-003 scenario co-pilot:** AI suggests candidate assumptions and questions, deterministic engine executes, policy rules validate, AI explains outcome differences with receipts; user approves any actionable choice.
- [ ] **AI-004 review memo:** Generate editable drafts with citations and versioned reviewer edits; approvals remain in authorized firm workflow, never AI-generated authority.
- [ ] **AI-005 monitoring:** Opt-in change detection and digests, clear quiet hours and notification priorities, consent/revocation, per-run cost/latency and model drift tracking. Avoid stress-inducing false urgency.
- [ ] **Threat model to current OWASP LLM Top 10 2026:** prompt injection, sensitive disclosure, excessive agency, unbounded consumption, information poisoning, RAG isolation and improper output handling. Add negative tests for each implemented attack surface.

**Definition of done:** A real provider passes an expert-reviewed eval suite at pre-agreed thresholds, no fabricated or inaccessible evidence is accepted, every amount and suggestion has correct provenance, and no LLM output grants approval or performs money movement.

## Epic B2B-001 — Firm assurance to paid design-partner beta (P1/P2)

- [ ] **Firm onboarding:** Organization provisioning, invitation/MFA, role and policy matrix, advisor vs CCO separation, account archival, partner offboarding; written tenant isolation test.
- [ ] **Client workflow:** Firm client directory, client-to-firm permission records, import permissions, actual supported formats (at least two well-defined real-world vendor export shapes tested end-to-end), integrity of source bytes, idempotent import jobs, error review and data retention.
- [ ] **Checks:** Complete coverage-aware reviewer queue with stale/unsupported/error outcomes; selective reruns and delta review; versioned rule updates; clear scope boundaries.
- [ ] **Evidence packets:** Attested canonical JSON, independently verified/export-bound HTML/PDF/CSV as promised, reviewer signatures/attestations, secure time-limited sharing, immutable audit trail; download and replay tests.
- [ ] **Operational intelligence:** Review backlog, missing-evidence queue, exceptions aging, workload and export health, no fabricated firm performance metrics.
- [ ] **Pilot proof:** 3–5 recruited firms (planning goal) with appropriately scoped fictional or approved real data; measured reviewer time, discrepancy detection, false alarms, adoption, support cost and willingness to pay. Ensure contractual rights to handle documents and compliance retention.

**Definition of done:** A real authorized adviser/CCO can complete a scoped, reviewable assurance cycle without synthetic personas; no claim of “SEC-certified” or professional approval by SageSpan.

## Epic UX-001 — Premium, accessible dual-market experience (parallel; isolated PRs)

- [ ] **UI-000 current-state inventory:** Route map, component inventory, UX findings, user roles, empty/loading/error/provenance states, screenshot baselines at desktop and 390px mobile. Lock data contracts and URL compatibility.
- [ ] **UI-001 tokens + shell:** Preserve navy/teal heritage; harmonize typography, spacing, surfaces, shadows and restrained status colors. Organize 11 consumer routes into 4 nav groups while preserving paths. Professional console retains distinct dense workflow patterns.
- [ ] **UI-002 consumer core journeys:** Onboarding, overview, 3 next steps, cash-flow timeline, spending pattern evidence, debt/scenario comparison, goals, retirement readiness and AI assistant. Each value has a “why/source/assumption” affordance; no unlabeled chart or unverified forecast.
- [ ] **UI-003 professional review journeys:** Review queue with useful columns/filtering, household evidence timeline, conflict resolution, independent checks, AI findings, approvals and packet export. Strong status differentiation and explicit permission cues.
- [ ] **UI-004 marketing + brand:** Dual-market landing and segment pages, truthful demo CTAs, unvalidated pricing labeled, product limitations and privacy explained. Keep brand provisional until search clearance.
- [ ] **UI-005 polish & accessibility:** WCAG 2.2 AA audit, semantic landmarks and labels, keyboard only, focus, screenreader, reduced motion, color-independent states, 320–1920px layouts, contrast audit, automated axe + manual audit, visual regression and Playwright interaction tests.

**Definition of done:** Users understand status and next action without reading dense explanatory paragraphs; mobile flows work end-to-end; no business logic or permissions changed by the visual PR; design meets documented accessibility and behavior tests.

## Epic OPS-001 — Production operational readiness (P1/P2)

- [ ] **Delivery lifecycle:** protected default branch, CODEOWNERS, PR templates, checks required, deployment previews without private data, staging and production promotion, reproducible build and rollback.
- [ ] **Observability:** Error rate, p50/p95 API and calculator latency, failed jobs, timeouts, receipt rejection, blocked access attempts, failed exports, AI costs, financial model drift, sync/data freshness; privacy-aware logs and alerts.
- [ ] **Job infrastructure:** Queue for imports, extraction, background calculations, report generation; idempotent retries, user-facing progress, cancel, dead-letter queue, expiry, backlog policies and cost budgets.
- [ ] **SRE/data safety:** Backups and restore drills, incident on-call runbook, dependency security updates, secret rotation, DAST/SAST/SCA, vulnerability disclosure, disaster testing and uptime targets established from pilot need.
- [ ] **Accounts and billing:** Service entitlement model (B2C/household/B2B) with no safety-critical explanation paywall; subscriptions, tax/invoice records, cancellations, refunds, usage, metering, customer support; no billing before approved contracts.
- [ ] **Customer experience:** Support/help center, clear service terms, privacy notices, accessible export and deletion requests, onboarding help, product status page and customer notification process.

**Definition of done:** Repeatable release, measurable service, recoverable data, support operations, tested incident and backup procedures, revenue operations tied to actual permitted service scope.

## Epic REG-001 / FIN-VERIFY-001 — Legal and professional release gates (P0 for regulated features)

- [ ] **Founder decision with securities/consumer-finance counsel:** Educational financial wellness vs individualized investment advice vs partner RIA model vs registration. Jurisdiction, compensation, fiduciary status, advertised claims, user terms and supervisory controls. Require written decision per feature/tier.
- [ ] **Advice tier controls:** Tier 0 learning / Tier 1 information / Tier 2 comparison (bounded) / Tier 3 regulated individualized advice **disabled** until permitted / Tier 4 transactions **out of scope**. Independently enforce flags at server and UI.
- [ ] **RIA obligations and vendor contracts:** Counsel to allocate SEC/state advisory obligations, Reg S-P privacy/incident response, marketing rule, books/records, supervisory policies, subprocessor access/retention; never imply SageSpan itself certifies a firm's compliance.
- [ ] **Consumer privacy and financial data law:** Current GLBA/FTC/CFPB/state-law applicability, children's/household issues, data retention and deletion, consent disclosures, incident notice and vendor practices. CFPB Section 1033 compliance dates were stayed 2025-10-29; verify again before bank integration.
- [ ] **Independent finance reviewer:** Name/credentials/signature per published calculation method, historical rule and scenario; supported-scope tests, review cadence and change-control registry.
- [ ] **Enterprise assurance claims:** SOC 2 is a program requiring actual controls and audit—not a theme, badge or repository feature. Define whether and when an independent attestation is commercially needed; do not market one in advance.

**Definition of done:** No public claims contradict build state; legal perimeter is documented and signed; published financial results have named financial-domain signoff; appropriate privacy/vendor processes support every enabled feature.

## Epic GO-TO-MARKET — Validation and commercial milestones

- [ ] **Consumer interviews:** Recruit 10–15 target participants across regular/irregular income, mid-career, pre-retirement and household needs; do not solicit actual credentials or sensitive documents. Observe whether they understand the three next steps and how they change a decision.
- [ ] **Advisor discovery:** Interview 5–10 RIA decision makers, including CCO and owners; measure integration friction, demand for independent assurance, required import formats, retention/document expectations and pricing willingness.
- [ ] **Design-partner pilots:** Begin with fictional or separately approved real datasets, written objectives, acceptance criteria, no exaggerated benefits, documented feedback; monitor setup completion, time-to-first-useful-insight, false positives, user trust and paid conversion.
- [ ] **Brand clearance:** Search USPTO and relevant domains/markets for SageSpan; choose final legal/trade name and visual identity before irreversible promotion.
- [ ] **Pricing experimentation:** Consumer price ranges and firm `$750 + $3.50 × max(0, H−100)` remain *hypotheses*, not locked offers. Test cost to serve, model usage, support load, willingness-to-pay and gross margin by segment.
- [ ] **Launch proof:** Define go/no-go committee or founder check using the gate scorecard below; release staged, narrow features instead of promising an omnibus financial adviser.

## Exit-gate scorecard — required evidence before each claim

| Gate | Meaning | Proof needed | Status at audit |
|---|---|---|---|
| G0 | Synthetic honest demo | Segregated fixtures + unit/e2e + claims honesty | **Feature code present, hosted V5 CI not yet run** |
| G1 | Trust boundaries | PR-001 integrated; real-stack RLS/privilege/actor probes | **Partially: merged, real-stack outstanding** |
| G2 | Approval correctness | PR-002 S-06/S-07/N-02 and regression suite | **Open** |
| G3 | Real financial data | Auth, consent, storage, DPA, logs, retention, incident response, external security review | **Open** |
| G4 | Finance/legal | Qualified model validation and counsel feature perimeter | **Open** |
| G5 | Controlled release | Design-partner measurement, customer support, operational restore, no open high-risk findings | **Open** |
| G6 | Broad GA | Measured reliability, billing/support, retention, privacy controls, rollout/rollback | **Future proposed gate** |

## Instructions for Claude Code — how to execute this checklist

1. Read root `CLAUDE.md`, V5 source of truth, feature matrix, this audit and this checklist. First inspect Git status, currently checked-out branch, migrations, CI results and working-tree changes.
2. Select **one** epic/PR-sized slice. Before edits, state: user value, exact affected files, current behavior, risks, acceptance tests, dependencies and which gates remain closed. Avoid undifferentiated “implement V5” sessions.
3. Do not edit approved historical migrations; add forward-only migration files. Keep security changes separate from presentation-only UI changes.
4. For every new financial behavior, update Python deterministic method, shared Zod/OpenAPI contract, versioned methodology registry, golden/negative tests, source limitations, receipt checks and UI copy together.
5. For every data-affecting change, add negative tests for different personal workspace, different firm org, consent expiry/revocation, repeated requests and failed jobs; require server-side authorization.
6. For every AI change, add labeled eval cases; validate citation IDs/locators/amounts and use a provider stub for offline CI. Never permit authoritative mutations or approval to be triggered by an LLM.
7. Run all relevant checks and paste exact commands/results in PR. Where environment prevents a check, say **NOT RUN** and do not mark acceptance complete.
8. Include screenshots/short recordings for major UX changes, mobile and desktop, with accessibility and keyboard test notes. Validate main flows under Playwright.
9. Update feature status and requirements traceability accurately. Clearly distinguish **built**, **tested**, **validated**, **released**, **available only in mock/demo**.
10. Ask for founder approval at true decisions—business advice perimeter, legal partner/registration, pricing/billing commitments, vendor selection, product copy making regulated claims—not routine implementation choices.

## Suggested immediate Claude Code instruction

> Read the current SageSpan repository and V5 documentation. Confirm the latest branches and PR history. Begin with **Integration-001 only**: reproduce and diagnose `master` run 42174852606's Patel evidence-export `ECONNRESET`, reconcile `feat/v5-dual-market` against merged `master` without losing changes, open a draft PR, and make complete CI green. No production data, no feature expansion, no merge until reviewed. Return the exact root cause, file-level diff, test commands/results, trace links, and which items in this checklist can now be marked verified.

**Related:** `01_SageSpan_V5_Current_State_Audit.md`; `03_SageSpan_Claude_Code_UI_UX_Master_Prompt.md`.
