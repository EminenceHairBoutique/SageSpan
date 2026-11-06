# SAGESPAN — CLAUDE CODE MASTER PROMPT
## Unified B2C + B2B Pivot, AI Financial Decisions, Retirement Planning and Independent Assurance

**Version:** 4.0 | **Founder-approved product direction:** 2026-11-05  
**Use:** Paste this entire prompt into Claude Code at the root of the SageSpan repository.  
**Companion specification:** `SageSpan_Dual_Market_Master_Blueprint_2026-11-05.md` (place a copy in `docs/product/` first if possible).  
**Execution rule:** Make real, tested progress in an appropriately scoped first pull request. Do **not** try to implement the entire roadmap as one unreviewable commit.

---

# ROLE AND MISSION

You are acting as SageSpan's founding CTO, lead product architect, AI systems designer, financial-modeling engineer and security-minded full-stack developer. Your assignment is to evolve the existing application into **one coherent platform serving BOTH individual consumers/households (B2C) AND financial advisors/RIA firms/compliance teams (B2B)**.

SageSpan is **not exclusively B2B**, and it is **not exclusively B2C**. There is no founder instruction to eliminate the other audience. Preserve working consumer features if the current repo has already pivoted toward B2C; preserve the previous firm assurance, calculation and audit infrastructure where it still exists. The two audiences share a trusted financial intelligence foundation but have different UX, permissions, commercial roles and legal boundaries.

## Founder mission (binding product intent)

> SageSpan should materially reduce the anxiety, pressure, uncertainty and cognitive work of managing money and preparing for retirement. It should help individuals and households make strong, realistic, pattern-based decisions about cash flow, spending, budgets, debt, savings, investments and retirement choices. It should identify meaningful problems early, propose feasible solutions, explain the trade-offs in plain language and make next actions feel manageable. It should also help advisors build, challenge, review, document and monitor financial plans.

**Do not interpret “strong decisions” as license for an unconstrained AI to perform financial transactions, make unvalidated predictions or issue regulated personal investment recommendations before legal authorization.** SageSpan should be decisive when evidence is solid and candid when evidence is insufficient. The model proposes and explains; deterministic engines calculate; policy gates check feasibility; the consumer or authorized professional owns the decision; the system retains evidence and change history.

## Product pillars

1. **SageSpan Personal:** day-to-day money clarity, spending and cash-flow patterns, budgeting, savings, debt, priorities and actionable next steps.
2. **SageSpan Retirement Studio:** long-horizon planning, retirement readiness, deterministic projections, scenario comparisons and supported strategy analysis for both B2C and B2B.
3. **SageSpan Advisor & Assurance:** client discovery, plan import and reconciliation, independent rules/checks, evidence-linked AI review, discrepancy queues, adviser workflow and CCO-governed approval.
4. **Shared AI Decision Intelligence:** guided intake, missing-data questions, grounded insights, action ranking, scenario proposal, transparent explanations and consented monitoring.

Do not create separate duplicated backends for each audience. Build a common, authorization-aware domain with distinct personal, household and firm workspaces.

---

# STEP 0 — MANDATORY REPOSITORY DISCOVERY BEFORE CODING

Read, in this order if present:

1. `CLAUDE.md`, `SAGESPAN_MASTER_SOURCE_OF_TRUTH.md` and current project instructions.
2. `docs/audits/REPOSITORY_AUDIT_2026-11-05_v2.md`, `NEXT_PROMPT_PR-001.md`, `SageSpan_PR-001_Reviewed_Prompt_v3.md` (search likely `docs/` paths; report missing documents without inventing them).
3. `SageSpan_Dual_Market_Master_Blueprint_2026-11-05.md` (this specification), plus `SageSpan_AI_Planning_Blueprint_and_Claude_Prompt.md` if available.
4. Current Next.js routes, shared contracts, Python/FastAPI engines, Supabase migrations, SQL/RLS policies, tests, fixtures, CI and any newer B2C code.
5. Current Git status, branch, HEAD, remotes, open PRs and actual uncommitted changes.

**The old audit covered commit `1151c1e` on 2026-11-05. It is a dated baseline, not proof that the current tree is still at that commit.** Prior reports described a synthetic B2B assurance console, whereas the founder now reports that Claude has developed consumer-facing functionality. Inspect the real tree. Document what actually exists and what is missing before proposing changes.

Do not reset, delete, rewrite, or casually replace work in progress. Do not force-push. Do not automatically merge PRs. Do not commit `.env`, API keys, private financial records or huge caches. Preserve tests and published schemas unless an explicit versioned migration is required.

Start your answer with a compact **Current State Delta**:

| Area | Already exists | Missing / problematic | Planned disposition |
|---|---|---|---|
| Personal experience | inspect | inspect | preserve/extend |
| Retirement planning | inspect | inspect | preserve/extend |
| Firm assurance | inspect | inspect | preserve/restore |
| Security | inspect | inspect | harden |
| Data and AI | inspect | inspect | scope |

If current tree includes only B2C, explain precisely where/how the B2B firm assurance functionality will be reintroduced or reconnected without overwriting consumer code. If it includes only B2B, specify the first consumer vertical slice.

---

# NON-NEGOTIABLE ARCHITECTURE AND SECURITY

Maintain the current core unless direct inspection establishes compelling reasons to change it:

- Next.js + React + TypeScript for the app/marketing UX.
- `packages/contracts` Zod schemas for authoritative API/domain types.
- Python/FastAPI **deterministic** financial computation services (RMD as the existing narrow module, additional engines only after tests).
- Supabase/PostgreSQL with tenant isolation and row-level access controls, after trust-boundary hardening.
- Frozen input snapshots, effective-dated rule sets, calculation receipts, structured coverage states, evidence references and human approval workflows.
- An explicit demo/synthetic mode completely separated from live data and production credentials.

**Do not connect real client accounts, expose a production authentication backend or accept sensitive financial documents until the P0 security issues from the v2 audit are fixed and independently tested.** In particular:

- **PR-001:** close cross-tenant workflow authorization holes, forged audit events, unsafe direct mutations, unverified calculator receipts, freeze-hash defects, forkable SQL audit chains, mutable discrepancy dispositions and inconsistent approver policies. Follow the _reviewed v3 PR-001 handoff_ if available; do not reintroduce unsafe `SECURITY DEFINER` RPCs or trust custom Postgres session flags alone.
- **PR-002:** distinguish supported/unsupported/indeterminate calculation coverage, derive requests entirely from frozen snapshots, and allow ERROR → later PASS recovery using correctly scoped latest runs.
- **PR-003:** authentic production identity, real JWT/PostgREST/RLS testing, workspace grants, persistent data and secure source document storage.

Security work may proceed on its own branch while the dual-market experience is developed in **isolated synthetic mode**. Avoid migrating a broken trust boundary simply to demonstrate the consumer workflow. Never call an unverified rule result “approved,” “independently certified,” or “SEC-compliant.”

### Tenant and workspace authority

Model a user as a **principal** who may own a personal workspace, join a household workspace, belong to a firm workspace, and—when they explicitly authorize it—share selected records with a firm. Distinct workspaces are not interchangeable organizations.

Required principles:

- A firm does not gain access to a user's private budget, accounts, debts or retirement data merely because that user also works with an advisor.
- Household participants have scoped permissions; membership is not permission to see every sensitive record.
- Sharing consent specifies resources, purpose, recipient, expiry, revocation and applicable retention exceptions.
- Every read and write is verified server-side against principal, workspace, record and permitted purpose.
- Cross-workspace/shared-client views use explicit grants rather than assuming a firm owns the individual's data.
- Admin privileges do not silently bypass professional approval or alter immutable source evidence.

Before writing schema changes, inventory existing `org_id`, `household_id`, `facts`, `snapshots`, `memberships` and review models. Propose adapters/migrations instead of duplicating existing domain tables.

---

# PRODUCT AND EXPERIENCE REQUIREMENTS

## 1. The consumer promise: “Tell me what matters and what to do next”

Build **SageSpan Personal** to be useful with manual data entry first. Data aggregation can come later.

Required journey:

`Welcome → Choose personal or household → Guided discovery → Verify key inputs → Financial clarity baseline → Top 3 next steps → Explore alternatives → User decision → Follow-up/monitoring`

Initial intake includes (when relevant):

- household composition, income sources and their reliability;
- cash/account balances and **as-of dates**;
- bills/recurring costs and when they become due;
- flexible and essential spending;
- debts, APRs, minimums, promotional terms and due dates;
- short-term cash buffer and emergency-reserve preferences;
- goals (including retirement), planned large expenses and decision preferences;
- missing/unknown/conflicting items, with the ability to defer nonessential inputs.

Every material fact is `USER_REPORTED`, `EVIDENCE_VERIFIED`, `ASSUMED`, `MISSING`, `STALE` or `CONFLICTING`, or is translated into the repository's existing equivalent states. Never silently change assumption into fact.

First dashboard should answer: **Where am I? What is urgent? What are my best next three actions? What could change the recommendation?**

Core sections: Overview / Next Steps, Cash Flow, Spending & Budget, Savings & Debt, Goals, Retirement, Scenarios, AI Copilot and Privacy/Sharing. Mobile-first consumer flow; no shame-based spending scores, guilt-inducing notifications, artificial urgency or excessively technical jargon.

## 2. Pattern-based intelligence: actual decision support, not generic chatbot answers

Implement a transparent four-stage pipeline:

1. **Evidence and normalization:** clean and reconcile inputs, coverage, as-of dates, transfers vs spending, refunds, recurring obligations, seasonality and irregular income. Identify insufficiency and stale data.
2. **Deterministic analysis:** calculate budget margin, cash buffer/runway, bill-timing risk, high-APR debt scenarios, savings capacity and—in a later validated module—retirement projections.
3. **Candidate generation and policy ranking:** propose several feasible actions and reject those violating hard constraints (required payments, user-defined liquidity floor, impossible cash timing, missing critical input, advice authority). Rank the survivors by expected user benefit, downside risk, reversibility, complexity, time to benefit and user goals. Prefer low-regret, reversible choices when uncertainty is high.
4. **AI explanation and feedback:** convert validated findings into clear action cards, ask only critical follow-up questions, explain tradeoffs and learn stated preferences without rewriting facts.

Prioritize evidence-backed outcomes over token generation. Display default maximum **three** recommendations: `Do this now`, `Consider next`, and `Revisit later`, or similarly clear priorities. Each card must show:

- the pattern/data that triggered it and observation window;
- a specific feasible action;
- quantified impact **only when produced by a supported calculator**;
- constraints/tradeoffs and an unfavorable-case interpretation;
- confidence as **input coverage/limitations**, not invented “97% AI confidence”;
- an explanation of why the action outranked alternatives;
- required user approval and whether professional review is needed;
- re-check trigger or expiry and a Dismiss/Edit/Done action.

Examples to implement with synthetic fixtures:

- irregular income + annual expenses → dynamic monthly reserve and seasonal cash planning;
- high-APR debt vs short emergency buffer → compare extra payment against preserving liquidity;
- two large bills in the same week → identify a potential shortfall and what must be confirmed;
- high subscription or merchant recurrence **without** mistaking transfers/refunds for expenses;
- earlier vs later retirement given validated annual cash-flow assumptions;
- missing statement and a conflicting RMD balance → request source evidence rather than fabricate a result.

**Do not implement a black-box LLM ranker that invents objective scores, projected dollars or guarantees.** Use testable, versioned rules for feasibility and ranking. Pattern inference must distinguish observations from forecasts. The model cannot issue bank transfers, trades, approvals or unlicensed personal securities recommendations.

## 3. Retirement Studio — the shared planning flagship

Develop an accessible household retirement intake, a `Plan Readiness` status based on actual verified/missing inputs, and a scenario-definition workflow. Use the **existing RMD engine only where applicable**.

For the first functional retirement planner, propose and implement a **bounded deterministic annual cash-flow model**, with explicit annual timing conventions, assumptions, fees/inflation handling, age and target retirement dates, annual savings/contributions, spending, income and withdrawal depletion rules. Produce stable versioned outputs, traceable formulas, golden tests and sensitivity cases. Label it a **simplified illustration, not comprehensive after-tax advice**.

Examples of scenarios:

- Retire at 65 versus 67;
- increase savings by $200/month;
- reduce planned spending by $300/month;
- compare base, lower-return and higher-expense assumptions;
- model a one-year earnings interruption;
- compare emergency-reserve targets to retirement contributions under the liquidity policy.

**Do not** claim that Social Security optimization, tax-aware withdrawal/Roth conversions, Monte Carlo success probabilities, Medicare, state taxes, required minimum distributions beyond supported scope or personalized allocation advice are complete until each has its own audited deterministic module, source register and golden/benchmark cases.

The LLM can suggest a scenario for user confirmation. Only the financial engine computes outcomes. Record snapshot hash, scenario inputs, engine version, calculation run, assumptions, warnings and model limitations.

## 4. SageSpan Advisor & Assurance — preserve and elevate the B2B side

Provide a firm workspace with:

- authorized client onboarding and explicit client-to-firm data grants;
- permitted plan export/document ingestion and source-to-fact reconciliation;
- versioned independent financial checks, currently RMD and future validated rules;
- AI plan review for missing evidence, conflicting facts, unsupported checks, stale inputs and action questions;
- advisor planning/scenario studio using the **same deterministic engines** as the consumer studio;
- exception review queue, assignments, dispositions, role-authorized approvals, evidence packet and audit history;
- professional policy settings and coverage reports that never misstate one passing check as approval of an entire financial plan;
- a restricted, user-consented client portal for published advisor communications.

The buyer may be a firm's owner/COO; the CCO is a review champion; advisors use the workflow. Maintain a product story for both revenue paths instead of replacing the firm pathway with a consumer-only landing page.

## 5. AI Plan Review and AI Copilot

Build toward a genuine AI-powered review feature rather than a decorative chat interface.

Tasks allowed for AI in initial synthetic mode: ask relevant questions, summarize supported calculations, flag source conflicts, suggest evidence requests, propose feasible scenario inputs, draft consumer-friendly explanations and professional reviewer notes.

Required backend mechanism:

`Auth / workspace scope → snapshot and evidence resolver → typed read-only tools → configured LLM/provider adapter → schema validation → ID/citation/calculation verification → policy gate → DRAFT suggestion → explicit user/reviewer decision`

Suggested contracts: `AiReviewRequest`, `AiFinding`, `AiReviewReport`, `AiRunRecord`, `FinancialDecisionProposal`, `ScenarioRequest`, `ScenarioResult`, `UserDecision`.

For the first demonstration, provide a deterministic mock provider and optional server-side live-model adapter (if configured). All fixtures synthetic. No provider key in client bundle. All content from documents is untrusted and must never become instructions for tool execution. Every source citation must resolve to the selected authorized snapshot/workspace. Never manufacture a dollar amount or treat model output as a verified source.

A successful **Analyze Plan** experience offers:

- Evidence-backed findings and missing data;
- Supported calculation results with the actual rule/model provenance;
- Clear unsupported/indeterminate states;
- Recommended follow-up questions and bounded actions;
- Editable consumer summary or advisor draft memo;
- Accept / Edit / Dismiss / Request Evidence;
- History of model/version, cited inputs, changes and user decisions.

**Runtime note:** Claude Code builds SageSpan; it is not the runtime LLM simply because Claude Code developed it. Use a model-provider API via a server-side, configurable adapter with privacy, consent, model-version, rate limits and cost controls.

---

# PRIVACY, REGULATORY AND DECISION-AUTHORITY GATES

Make the first deliverables synthetic or manual-only and educational. Before live financial data, require production authentication, real cross-tenant negative tests, consent, private storage, provider contracts, access revocation, security monitoring, backup/restore and incident response. Connected bank/investment data must be opt-in and read-only by default.

Differentiate the output authority explicitly:

- **Tier 0:** education and general explanations;
- **Tier 1:** low-risk budgeting and financial organization suggestions with user confirmation;
- **Tier 2:** material household scenarios and choices, with validated calculation and possible professional referral;
- **Tier 3:** individualized securities or other regulated advice — **disabled** until counsel establishes the correct regulatory framework, registrations/affiliations, disclosures, supervision and recordkeeping;
- **Tier 4:** transactions and money movement — **out of scope** initially.

SEC/Investor.gov describes investment advisers as persons/firms providing securities investment advice as a business for compensation. Do not assume that putting an AI behind a disclaimer avoids registration. Ask counsel to evaluate state/federal adviser, privacy, unfair-practice, consumer-finance, tax/insurance and recordkeeping obligations. For B2B, assess the obligations of the actual advisory firm without claiming that SageSpan automatically achieves SEC compliance.

Consumer-data portability requirements are evolving, and the CFPB indicates that the compliance dates of its Personal Financial Data Rights Rule were stayed in October 2025. Do not hardcode a guessed legal date. Apply the NIST GenAI AI RMF profile as voluntary risk-management guidance. Cite legal claims only to real maintained sources.

No misleading claims about regulatory approval, SOC 2, security audits, adviser licensing, native integrations, independently signed financial rules, guaranteed investment results or production readiness.

---

# REQUIRED SITE INFORMATION ARCHITECTURE

Public navigation (adapt to existing brand/components):

`Personal | Retirement Planning | For Advisors & Firms | How It Works | Security & Trust | Pricing | Sign In`

Hero:

- Headline should convey calm, practical financial clarity and realistic planning, **not** guaranteed wealth, financial certainty or autonomous fiduciary advice.
- Personal CTA: **Plan My Finances**.
- Professional CTA: **Explore for Firms**.
- Explain both audience paths in copy and product pages.

Consumer workspace: `Overview`, `Next Steps`, `Cash Flow`, `Spending`, `Savings & Debt`, `Goals`, `Retirement`, `Scenarios`, `AI Assistant`, `Privacy`.

Firm workspace: `Review Queue`, `Clients`, `Imports & Evidence`, `Checks`, `Planning Studio`, `AI Plan Review`, `Reviews & Approvals`, `Firm Settings`.

Use existing design tokens. Do not replace the design system gratuitously. Prioritize a polished, responsive consumer mobile experience and precise professional desktop review experience. Make synthetic/demo banners explicit and persistent.

---

# IMPLEMENTATION SEQUENCE — SMALL, REVIEWABLE PRs

## Track A: no compromise on trust

- **PR-001:** execute the reviewed trust-boundary hardening prompt; no production Supabase wiring before it passes.
- **PR-002:** correct approval/coverage semantics, frozen snapshot reproducibility, and latest-run retry logic.
- **PR-003:** production-shaped Supabase Auth, workspace grants, RLS and private storage, demonstrated with real-stack negative tests.

If one of these is already merged, verify its tests and move to the next. Do not create duplicate PRs or overwrite newer fixes.

## Track B: demonstrate both product paths in synthetic mode

- **DUAL-000 — Product specification and documentation:** place the master blueprint in `docs/product/SAGESPAN_DUAL_MARKET_V4.md`; update `CLAUDE.md`, source-of-truth docs and feature matrix to show B2C **and** B2B, with current vs proposed implementation states. Record a short architecture decision note preserving shared engines and distinct workspaces.
- **DUAL-001 — Dual-entry navigation/workspace shells:** reuse the current site and route conventions. Add only missing B2C or B2B paths; ensure both are discoverable and coherent, with explicit synthetic notices. No new production auth or cross-workspace data access.
- **PERS-001 — Personal Clarity synthetic vertical slice:** guided manual-entry intake, data-quality states, deterministic baseline metrics and a prioritized decision card. Use synthetic fixtures; do not wire real bank accounts.
- **PERS-002 — Budget/debt/cash-flow patterns:** implement tested scenario functions, feasible-action constraints, clear limitations and user choices. No live money movement.
- **AI-000/AI-001 — Synthetic grounded plan review:** schema/fixtures/model mock and then an `Analyze Plan` panel with citations, valid states and feedback. Do not let AI write authoritative facts or approvals.
- **PLAN-001 — Bounded retirement cash-flow engine:** separately reviewed numerical specification, verified test cases, reproducible results, scenario comparisons; label omissions.

**Parallelism:** Product/docs/UI scaffolding can proceed while security fixes are underway, but do not connect to exposed RPCs, live auth/data or a production model using sensitive client records. Keep branches and file ownership separate to avoid migration collisions.

---

# YOUR FIRST IMPLEMENTATION SESSION (REQUIRED DELIVERY)

**Do not attempt all milestones in one turn.** In the first session, deliver `DUAL-000` plus a focused `DUAL-001` (if the branch is safe), and write the approved technical plan for `PERS-001`. If the current repository already implements these, verify behavior and instead deliver the smallest missing consumer/firm connection with tests. Security findings remain visibly tracked.

1. Inspect the tree/changes and prepare a **truthful current-state delta**.
2. Identify the minimum migrations and API contract changes needed for personal/household/firm workspaces, but **do not execute high-risk migrations in the dual-entry UI PR**.
3. Write `docs/product/SAGESPAN_DUAL_MARKET_V4.md`, `docs/product/FEATURE_STATUS_MATRIX.md`, and `docs/architecture/DUAL_WORKSPACE_ADR.md` (or matching repo conventions).
4. Update `CLAUDE.md` and the master-source document without deleting historical rationale, marking any previous “B2B-only” or “B2C-only” rule **superseded by founder decision, dated 2026-11-05**.
5. Build the missing audience entry points and workspace navigation using the existing components, with synthetic/no-data placeholders where functionality is not implemented. Make nonfunctional CTAs honest or route to appropriate demo/about information; do not create fake interactive controls.
6. Add one synthetic personal financial profile (irregular income, two debts, recurring bills, goal) and one professional RMD review profile using or extending existing fixtures. No real PII.
7. Add smoke tests proving both audience paths are discoverable and the firm workspace isn't accidentally replaced by personal navigation. Verify mobile display/accessibility basics and the demo-mode warning.
8. Run lint, typecheck, unit tests, build, and browser/e2e checks where possible. Report actual commands, counts, failures and exclusions. Do not invent green CI.
9. Give a concise, actionable `PERS-001` build plan with target contracts, file changes, user flow, scenario examples, tests, data assumptions and estimated dependencies. Do not make up calendar estimates.
10. Finish with a PR-ready change summary, explicit unresolved PR-001/002/003 risks, and the next best small PR.

### Acceptance criteria for first session

- B2C and B2B are both stated as active target markets in authoritative docs and public navigation.
- Existing functioning features are not removed just to implement the pivot.
- No production identity/secrets/financial data connected, and no changes to security-sensitive workflow RPCs on a UI branch.
- User-facing claims distinguish working features from proposed capabilities.
- Existing synthetic RMD workflow still functions to the extent it functioned before the change.
- One consumer and one firm synthetic journey are identifiable and testable.
- New and existing tests run with honest, recorded results.

### Acceptance criteria for subsequent Personal Clarity / AI PRs

- Calculated dollars come from versioned deterministic code, never invented by LLM.
- Candidate recommendations are rejected if they violate liquidity/required-payment constraints.
- An accepted suggestion has attributable inputs, rule version, alternatives, tradeoffs and explicit decision owner.
- Stale/missing/conflicting financial inputs suppress overconfident outputs.
- A finding's evidence IDs always resolve to permitted workspace documents/facts.
- Prompt injection in uploaded text cannot trigger unallowlisted tool calls.
- Cross-workspace and cross-tenant unauthorized access fails in appropriate automated tests.
- Unsupported financial rule coverage never gets a “verified” or “approved” label.
- The AI cannot approve, transact, edit a source fact or impersonate a professional.
- Consumer private records never appear in unrelated firm workspaces.
- User feedback does not silently rewrite historical evidence.
- Manual-data mode remains usable without a connected account or paid LLM.

---

# REQUIRED FINAL REPORT FORMAT

Return in Markdown:

1. **Repository reality check**: actual branch/commit, feature inventory, current B2C/B2B state and uncommitted changes preserved.
2. **Files changed**: paths and purpose, with explicit migrations/not-migrations.
3. **Architecture decisions**: workspaces/consent, deterministic math vs AI, security gates, how existing B2B infrastructure is preserved.
4. **What now works**: link/route/function evidence, not just screenshots or marketing copy.
5. **Tests actually run**: commands, results and environment limitations; note tests not run.
6. **Known risks**: PR-001/002/003 blockers, legal adviser-registration gate, consumer consent, prototype limitations.
7. **Next PR**: exact scope, DoD, relevant tests and why it is next.

Use simple, legible code and meaningful tests. Prefer fewer reliable features over many attractive but misleading features. **Build one reliable intelligence-and-assurance platform for people and professionals.**

---

# REFERENCES (FOR ENGINEERING RESEARCH, NOT AS LICENSE TO CLAIM COMPLIANCE)

- Product: `SageSpan_Dual_Market_Master_Blueprint_2026-11-05.md` (this initiative).
- Audit: `REPOSITORY_AUDIT_2026-11-05_v2.md` and reviewed `SageSpan_PR-001_Reviewed_Prompt_v3.md`.
- Investor.gov, investment advisers: https://www.investor.gov/introduction-investing/getting-started/working-investment-professional/investment-advisers
- SEC robo-adviser guidance: https://www.sec.gov/newsroom/press-releases/2017-52
- CFPB consumer financial well-being: https://www.consumerfinance.gov/consumer-tools/educator-tool/financial-well-being-resources/
- CFPB Personal Financial Data Rights: https://www.consumerfinance.gov/compliance/compliance-resources/other-applicable-requirements/personal-financial-data-rights/
- NIST GenAI Risk Management Profile: https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence
