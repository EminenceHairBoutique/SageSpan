# SAGESPAN
## Unified B2C + B2B AI Financial Wellness, Retirement Planning & Assurance Platform

**Master product scope, value proposition, architecture and implementation blueprint**  
**Version:** 4.0 — founder direction, 5 November 2026  
**Status:** product specification and proposed roadmap; not an assertion that all capabilities are implemented or legally cleared.  
**Audience:** founder, Claude Code, product/design, engineering, financial-domain reviewers, legal/compliance counsel and potential design partners.

> **Mission.** Make personal finance and retirement decisions clearer, calmer and more actionable. Help individuals understand where they stand and what to do next; help professional advisors construct, test, document and monitor better plans; use trustworthy data, transparent calculations and independent assurance rather than AI-generated certainty.

> **Critical founder decision:** SageSpan is **both B2C and B2B**. It must neither remain an RIA-only compliance product nor become a consumer-only budgeting app. The interfaces and authority differ; the underlying financial data foundation, rules, scenario engine, governance and evidence systems are shared.

---

# 1. Executive direction

## 1.1 What SageSpan is

SageSpan is an AI-native **financial decision-support and planning platform** with three interoperable product pillars:

1. **Personal Financial Intelligence (B2C):** cash flow, spending and budgeting, debt and savings strategies, emergency reserves, goal tracking, behavioral-pattern insights, and financial check-ins for individuals and households.
2. **Retirement & Planning Intelligence (B2C and B2B):** structured discovery, retirement readiness, projection and scenario comparison, supported withdrawal and income modeling, and explanations of assumptions, tradeoffs and risks.
3. **Assurance & Professional Oversight (B2B, plus consumer second-opinion views):** source-to-fact reconciliation, deterministic checks, rule and model coverage, discrepancy detection, evidence-linked findings, authorized review and traceable export.

A fourth **shared intelligence layer** powers guided AI intake, grounded explanations, next-action proposals, document extraction (when ready), monitoring and summaries. It does **not** become an unreviewed mathematical authority.

## 1.2 Why this matters

Most consumers do not need another wall of charts. They need answers to: *Can I afford this? What should I prioritize? Am I missing something? What happens if I change my plan? What should I do this week?* Retirement questions add decades of uncertainty. Firms need a defensible answer to *What was reviewed, what did we rely on, what remains uncertain, and who approved it?*

**SageSpan's promise is to reduce decision burden** through a small number of prioritized, comprehensible, reversible actions. It must avoid promising to eliminate anxiety, guarantee an outcome, beat markets or replace regulated professionals.

The CFPB describes financial well-being around control of day-to-day finances, resilience to shocks, progress toward goals and freedom of choice. Use those dimensions as a design/measurement reference, not as a claim that SageSpan already improves them. [R1]

## 1.3 What is already known vs proposed

**Verified from the supplied v2 repository audit (snapshot at commit `1151c1e`):** a Next.js/React synthetic assurance console, shared Zod contracts, separate Python/FastAPI RMD rules, Supabase migration design, evidence and workflow primitives, synthetic fixture households and tests. Critical database and receipt/audit weaknesses were demonstrated in that audit; production auth/persistence and generalized consumer planning were not verified as implemented.

**New founder decision:** direct consumer/household experience and broader daily financial planning are **first-class** product paths alongside the existing firm assurance product.

**Proposed—not existing:** connected bank/credit/investment data, consumer subscriptions, AI decision policy, cash-flow projections, broad tax/investment analysis, continuous monitoring, licensed advisory activity, an end-to-end B2C financial planner and real-money actions.

**Source-of-truth rule:** If Claude Code has added B2C pages since the audit, inspect the current repository and preserve good work; do not overwrite it based on the older commit assumptions.

---

# 2. Audiences and products

| Audience | Primary job | Experience | Allowed authority |
|---|---|---|---|
| Individual consumer | Understand spending, debt, savings and readiness; decide next steps | **SageSpan Personal** | Own/read data; confirm facts; accept/reject suggestions |
| Couple/family household | Align goals, allocate cash, plan retirement together | **SageSpan Household** | Invite participants with granular field-level or domain permissions |
| Self-directed retirement planner | Explore realistic what-if outcomes | **SageSpan Retirement Studio** | Propose and compare simulations; never silently execute transactions |
| Advisor/planner | Discover, model, explain and document client plans | **SageSpan Advisor** | Work on explicitly authorized client scopes; submit draft advice |
| CCO/review lead | Detect unsupported findings, review exceptions and supervise | **SageSpan Assurance** | Policy-driven approval and assurance workflows |
| Firm administrator | Manage seats, firm workspaces, assignments, policies | **SageSpan Firm Admin** | Operational administration; cannot bypass financial review or fabricate evidence |

## 2.1 One platform, distinct journeys

**B2C:** `Create account → choose goals → optional manual or consented data connection → verify facts → financial baseline → 1–3 prioritized actions → compare scenarios → decide → review changes.`

**B2B:** `Invite firm members → onboard client with consent → import permitted data/plan → reconcile and freeze → run supported checks → AI review draft → advisor evaluation → independent compliance review when required → evidence export → monitor.`

**Cross-over:** A consumer may *choose* to grant a particular advisor or firm limited access to selected plans and facts. A firm may invite a client into a restricted portal. Neither path grants a firm silent access to a user's unrelated personal workspace. Revocation, expiration, audit and portability are mandatory before implementing sharing with actual customer data.

## 2.2 Product roles must not be conflated

- A self-directed consumer is not a CCO; show understandable decision support and limitations, not compliance jargon or an “approved financial plan” badge.
- An advisor is not an AI model; professional advice remains attributable to the qualified person or registered entity where required.
- A corporate admin is not automatically a financial reviewer.
- Household collaborators can view or edit only explicitly shared information. Joining a household does not inherently expose all accounts, debts, medical spending or other sensitive records.
- An individual account and a firm-client relationship have independent ownership, authorization and retention rules.

---

# 3. Consumer product: usefulness and detailed features

## 3.1 First-run “Financial Clarity” experience

An optional, nonjudgmental guided interview captures household size, income regularity, account balances, debt obligations, fixed expenses, near-term bills, cash available, goals, retirement horizon, risk capacity/preferences and what worries the user most. Ask only what is needed. Every input is labeled **verified, user-reported, assumed, missing, stale or conflicting** and has an as-of date.

Deliver a plain-language summary:

- **Where I stand:** available cash, monthly margin, obligations, emergency runway and data freshness.
- **What needs attention:** near-term payment risk, expensive debt, savings gaps or information to confirm.
- **My next three steps:** concrete, feasible actions with estimated impact, time horizon, effort, dependencies and tradeoffs.
- **What I don't know yet:** missing information that could change the conclusion.

No shame-based spending scores, dark patterns or pressure-selling. Allow a “quiet mode,” notification cadence controls, pauses, and a simple plan rather than overwhelming alerts.

## 3.2 Cash-flow intelligence

- Income mapping: salary, variable pay, self-employment, benefits, pensions, irregular income.
- Expenses: recurring commitments, discretionary trends, seasonal patterns, annual obligations and cash timing.
- Explainable categorization with user correction, merchant/transfer deduplication, pending-vs-settled awareness and category drift monitoring.
- Monthly cash-flow baseline, 30/60/90-day outlook, bill-calendar collisions and low-cash warning simulations.
- Separate *observed historical pattern* from *projected future estimate*. Display the number of observed periods, seasonality, missing-account coverage and assumptions.
- Sample insight: “With your current reported expenses, the utility payment and loan due the same week may push the projected buffer below your chosen floor. Consider scheduling a review of these two payments.” Never imply a bank can change a due date without confirmation.

## 3.3 Budget and household priorities

- Flexible budgets: zero-based, envelope, goals-based, percentage allocations or a light-touch spending guardrail.
- Editable needs/wants/savings taxonomy; no universal rule forced on atypical households.
- Goal buckets: emergency buffer, moving, education, home, medical, caregiving, travel, retirement.
- “What changes if…” decisions: reduce a category, adjust savings, defer a purchase, change income or pay off a liability.
- Shared household goals with private-account boundaries and explicit consent.
- Forecast affordability conservatively; show buffer requirements rather than binary “you can afford it” claims.

## 3.4 Debt and savings analysis

- Liability inventory: balance, rate/APR, minimum payment, maturity, promotional expiry, variable-rate terms and delinquency state.
- Deterministic comparisons of payoff paths (avalanche vs snowball vs hybrid) using known APRs, fees, payment schedules and user cash floor.
- Emergency reserve suggestions derived from essential expenses, income volatility, available liquid funds and user preferences; not a fixed universal three-month claim.
- Explain interest savings, timing differences, liquidity risks, fees and tax or credit implications where supported.
- Never recommend skipping required payments, misrepresenting applications or risky debt maneuvers to produce superficially higher savings.

## 3.5 Investments: education first, regulated advice later

**Early scope:** portfolio inventory, diversification exposure display, concentration and fee education, tax-advantaged account explanations, general risk and long-horizon planning education. Show actual holdings only from verified or consented data; explain freshness.

**Conditional future scope:** individually tailored security/asset-allocation recommendations, tax-aware portfolio choices, rebalancing advice and managed portfolios. These may constitute regulated investment advice depending on business model, compensation and jurisdiction. Legal counsel must determine registration, fiduciary, conflicts, disclosure, supervision and recordkeeping requirements *before* releasing those features. A “not financial advice” disclaimer alone is not an exemption. [R2, R3]

**Explicitly excluded initially:** brokerage orders, automatic trades, transfer of client funds, auto-enrollment in investments, promises of returns, confident stock picks from an LLM.

## 3.6 Financial wellness and decision burden

The product should be more than data analysis:

- A calm “Today / This Month / Future” layout to separate urgent actions from long-term goals.
- **Priority limit:** default to at most three material actions, with the ability to see more.
- **Why this matters** and **What may change this advice** displayed alongside suggestions.
- **Reversible first:** favor low-risk, reversible, high-value decisions when evidence is incomplete.
- “Done,” “Snooze,” “Not relevant,” “I disagree,” and “Ask why” feedback loops.
- A transparent progress history based on completed actions and plan improvements, not doom scores or guilt.
- Optional perceived-confidence/financial-stress check-ins; do not make clinical claims or diagnose mental health conditions.

---

# 4. Retirement planning: the shared flagship capability

## 4.1 Retirement Plan Builder

Guided input: current age, expected retirement date, household composition, residence/tax jurisdiction, earned income, pensions, Social Security benefit estimates where provided, savings and retirement assets by account type, spending, health-care expectations, insurance, debt, legacy goals, inflation assumptions, life-span ranges and risk tolerance/capacity. Each component gets an evidence, freshness and completeness status.

**Readiness gate:** distinguish a preliminary projection from a validated plan. If material inputs are missing, return a narrower result or questions, not a polished false-confidence report.

## 4.2 Deterministic plan and scenarios

Start with a **labeled, simplified annual cash-flow model** that projects contributions, withdrawals, income, spending, growth/fees and cash balances with explicit timing conventions. It is not a comprehensive after-tax retirement plan. Store a frozen input snapshot, engine version, rule versions and reproducible outputs.

Offer scenario comparisons such as retiring at 63 vs 67, lowering planned spending by $300/month, increasing savings by $200/month, adopting a lower return assumption, or experiencing a one-year income interruption. Show the baseline, delta, assumptions, risks and an actionable interpretation.

Later, only after independent domain validation:

- Social Security claiming strategies using correct benefit inputs and current SSA rules;
- RMDs, beneficiary and account-class eligibility, QCD interactions and distributions;
- Tax-aware withdrawal sequencing and Roth conversion comparisons;
- Healthcare/Medicare cost scenarios and survivor-spouse planning;
- Monte Carlo and sequence-of-return risk with explicitly documented sampling, correlations, fees, inflation, seed, model uncertainty and calibration;
- Estate and longevity coordination as flagged review areas, not substitute legal advice.

**Important:** historical patterns inform assumptions; they do not make future market returns predictable. Use sensitivity analysis and distributions rather than promising outcomes.

## 4.3 Scenario and decision presentation

For every scenario or recommendation show:

1. What the user wants to achieve and their constraints;
2. Inputs and their source/freshness;
3. Calculation method, version and date;
4. Baseline versus proposed alternative;
5. Expected range or deterministic result, with uncertainty appropriately labeled;
6. Costs, drawbacks, potential adverse cases and what would invalidate the conclusion;
7. Next step, decision owner and whether professional review is required.

Never label a result **verified** just because the LLM produced it or an input hash matched.

---

# 5. Pattern-based decisions: how SageSpan becomes genuinely useful

## 5.1 Core decision loop

```
CONSENT & DATA  ->  NORMALIZE & VERIFY  ->  DIAGNOSE
                                             |
       MONITOR  <-  USER DECISION  <-  PRIORITIZE ACTIONS
                                             ^
                   SCENARIO ENGINE + RULES + AI EXPLANATION
```

The system should use recurring observed financial patterns **where enough reliable observations exist**, combine those signals with explicit constraints and validated calculators, then propose sensible decisions. When data is too sparse or stale, it asks targeted questions and lowers the scope of its conclusion.

## 5.2 Decision architecture (four layers)

**Layer A — Evidence.** Authorized source records, currency, balances, transaction classifications, effective dates, ownership, completeness; immutable source references and correction history.

**Layer B — Deterministic analytics.** Trend/budget analysis, bill timing, debt amortization, cash flow, retirement projections and validated financial rules. Calculators own all authoritative dollar amounts.

**Layer C — Policy and ranking.** Evaluate only feasible candidate actions subject to constraints: keep a minimum cash buffer; honor required payments; respect due dates; account for uncertainty; avoid unsuitable investment recommendations; evaluate financial impact, reversibility, complexity, and user preference. Rank suggestions using configurable, testable rules—not an unexplained LLM score.

**Layer D — AI interaction.** Generate questions, summarize patterns, present tradeoffs, request additional calculations through typed tools, explain why an action might help, and collect feedback. No direct writes to verified financial facts, approvals, investments or bank accounts.

## 5.3 Decision tiers / authority

| Tier | Examples | Automation rule |
|---|---|---|
| 0 — Explain | Define RMD; explain category changes | Read-only educational response |
| 1 — Low-risk guidance | Review recurring subscriptions; change a user-owned budget target | User confirmation; reversible and auditable |
| 2 — Material household choices | Debt payoff schedule; retirement timing; major cash reserve shift | Supported scenario with caveats; user decision; specialist referral where relevant |
| 3 — Regulated/high-stakes advice | Personalized securities allocations, complex tax or insurance advice | Disabled until legal authorization, validated model, appropriate review and records |
| 4 — Money movement/execution | Trades, withdrawals, bill payments, transfers | Out of initial product scope; never model-initiated |

## 5.4 Example decision cards (illustrative only)

- **Cash buffer:** “You reported $1,500 in available liquid savings and roughly $2,300 of essential monthly expenses. Your current cash buffer is below one month by this simplified measure. Before increasing long-term investments, compare the impact of building short-term reserves.” *Requires confirmed balances and expense scope; not universal advice.*
- **Debt:** “You reported two debts with differing APRs. A fixed extra payment may reduce interest under the higher-rate-first scenario, but would leave less monthly liquidity. Compare both paths and preserve the minimum buffer you selected.” *Requires confirmed terms; simulated outcomes, not guaranteed.*
- **Retirement:** “A two-year retirement delay changes the contribution and withdrawal schedule. See the calculations and the less favorable return assumption before selecting a target.” *Requires a validated projection model.*

## 5.5 Recommendation object (target contract)

```json
{
  "recommendation_id": "server-generated",
  "workspace_id": "server-derived",
  "scope": "CASH_FLOW",
  "classification": "DECISION_SUPPORT",
  "status": "DRAFT_FOR_USER",
  "title": "Review monthly cash buffer",
  "evidence_refs": ["fact-id", "source-id"],
  "calculation_refs": ["run-id"],
  "prerequisites": ["confirm available liquid savings"],
  "options": ["preserve buffer", "adjust savings schedule"],
  "impact": {"source": "deterministic_tool", "unit": "USD"},
  "tradeoffs": ["slower progress toward another goal"],
  "uncertainty": ["two months of expense data are missing"],
  "action_authority": "USER_CONFIRMATION_REQUIRED",
  "created_by": "AI_ASSISTED",
  "expires_at": "server-owned-date"
}
```

The server validates tenant scope, references, eligibility, allowed recommendation type, math provenance and expiration. The LLM cannot declare a calculation verified, a user eligible for specific advice, or a record approved.

---

# 6. B2B advisor and assurance capabilities

1. **Client onboarding / permissions:** invite or receive a client's explicit access grant, define relationship, workflow role and sharing scope.
2. **Plan ingestion / reconciliation:** import permitted plan exports and statements; map source fields to typed facts; detect duplicates, as-of differences and conflicts; document mapping coverage.
3. **Independent check library:** start with validated scope of RMD checks. Add financial rules only as independently benchmarked and versioned modules.
4. **AI Plan Review:** detect missing evidence, contradictory facts, stale assumptions, unsupported checks and differences; generate evidence-linked follow-up questions and draft reviewer memos.
5. **Advisor planning studio:** use the same validated scenario engine as B2C but with client-specific policy, oversight and approval records.
6. **CCO assurance queue:** assign material exceptions, set review criteria, record dispositions, enforce separation of duties and export bounded evidence packets.
7. **Firm insights:** coverage across client book, unreviewed material findings, upcoming rule-change impacts, reviewer latency and review capacity, without misleading "compliant" scores.
8. **Client handoff:** advisor-approved explanation and tasks in a restricted client portal; no access to internal firm deliberations unless intended.

Maintain the fundamental difference between a **calculation result**, **independent verification**, **reviewed with limitations**, and **professional approval**. The account/household must never be globally marked “approved” simply because one supported RMD calculation passed.

---

# 7. UX/IA and brand

## 7.1 Recommended public website navigation

**Personal** | **Retirement Planning** | **For Advisors & Firms** | **How It Works** | **Security & Trust** | **Pricing** | **Sign In**

The home page should clearly explain both paths with dual CTAs: **Plan My Finances** and **Explore SageSpan for Firms**. Do not imply a real advisor, regulated fiduciary registration, banking connection or verified investment engine exists until it does.

## 7.2 App navigation

| B2C | B2B |
|---|---|
| Overview / My Next Steps | Firm Review Queue |
| Accounts & Cash Flow | Clients & Households |
| Spending & Budget | Imports & Evidence |
| Savings & Debt | Checks & Exceptions |
| Goals & Retirement | Planning Studio |
| AI Financial Copilot | AI Plan Review |
| Scenarios | Reviews & Approvals |
| My Documents / Privacy | Firm Policies / Evidence Exports |

Use one reusable design system with two explicit workspaces. Consumer language is plain and reassuring; professional language is precise and auditable. The mobile consumer flow is a priority; professional bulk-review experiences can optimize for desktop while remaining accessible.

## 7.3 Calm design principles

- Clear status labels: `KNOWN`, `ASSUMED`, `MISSING`, `NEEDS_REVIEW`, `MODELLED`, `ADVISOR_APPROVED`, never a single global “confidence” percentage.
- Results first, details one click away; source and calculation traces always accessible.
- Alerts proportionate to materiality; user selects frequency and may dismiss/snooze noncritical items.
- Never gate necessary safety explanations behind paid tiers.
- Avoid artificial urgency, fear-driven language, peer comparisons and fabricated claims of certainty.
- “What can I do now?” must remain visible even in incomplete-data states.

---

# 8. Five-stage financial life-cycle, now shared by B2C and B2B

| Stage | Consumer value | Advisor/firm value | Required control |
|---|---|---|---|
| 1. Discover | Build a clear picture without data overload | Collect permitted, source-linked client data | Consent, identity, provenance, missingness |
| 2. Diagnose | Understand budget, debts and retirement gaps | Reconcile plan inputs and identify exceptions | Frozen data, deterministic check coverage |
| 3. Design | Compare feasible financial actions and scenarios | Build and compare modeled strategies | Validated calculations, versioned assumptions |
| 4. Decide & Review | Choose and record the next actions | Review suitability and document professional approval | Decision ownership, human oversight, limitations |
| 5. Monitor & Adapt | Watch meaningful changes with calm, actionable check-ins | Detect drift, rule changes and review needs | Audit trail, consented refresh, release gates |

---

# 9. Technical architecture: reuse, don't restart

```
Next.js / React application
  |-- Public marketing: Personal + Firm paths
  |-- Personal / Household workspace
  |-- Advisor / Firm / Compliance workspace
  |
  v
Server-owned identity, scope, consent and policy checks
  |-- Workspace grants / relationship access
  |-- Financial intake + canonical fact store
  |-- Evidence resolver / provenance / frozen snapshots
  |-- Scenario and recommendation policy service
  |-- AI orchestrator (allowlisted typed tools)
  |
  +-- Python / FastAPI deterministic financial engines
  |     RMD (existing) -> cash flow -> debt -> tax/SSA (validated later)
  +-- Model-provider adapter (LLM for language and proposals)
  +-- Supabase / PostgreSQL with RLS and trusted mutations
  +-- Private evidence storage + immutable review history
  +-- Optional regulated data connectors (later, consent only)
```

**Keep:** Next.js, TypeScript/Zod contracts, Python/FastAPI financial calculation service, Supabase/Postgres, frozen snapshots, receipts, hashes, role-based workflows, the synthetic demo and CCO functionality.

**Extend:** the tenancy model so a principal can own a personal workspace, participate in a household, belong to a firm, or collaborate across boundaries only through scoped grants. A consumer “personal workspace” must not be incorrectly modeled as a member of an unrelated firm. Preserve organization-scoped data isolation.

## 9.1 Suggested domain objects (new/proposed)

- `principals`, `workspaces` (`PERSONAL`, `HOUSEHOLD`, `FIRM`), `workspace_memberships`, `relationships`, `consent_grants` (scope, purpose, expiry, revocation);
- `household_profiles`, `financial_accounts`, `liabilities`, `transactions`, `income_streams`, `recurring_obligations`, `goals`;
- `financial_facts`/existing `facts` adapter, `source_documents`, `data_snapshots`, `source_links`;
- `budget_plans`, `cashflow_forecasts`, `scenario_definitions`, `scenario_runs`, `decision_proposals`, `user_decisions`;
- `ai_runs`, `ai_findings`, `ai_feedback`, `review_events`, `audit_chain_heads`;
- existing `check_runs`, `discrepancies`, `rules`, `reviews` adapted without erasing history.

Names are provisional and should be reconciled with current migrations before coding. Don't simultaneously duplicate `facts` or `households` tables; define adapters and migration strategy first.

## 9.2 AI reliability and data lifecycle

1. The server authorizes the principal, workspace, household, purpose and consent.
2. Resolve verified facts and minimal permitted source snippets; treat documents as untrusted input.
3. Choose a constrained task (`explain`, `identify_missing`, `propose_scenario`, `summarize_review`).
4. AI can call allowlisted read-only tools or explicitly create **draft proposals** through a trusted server validator.
5. Financial math goes to deterministic, versioned engines. No model-generated dollar values treated as authoritative.
6. Validate JSON schema, reference IDs, dates, supported calculation coverage and model/tool provenance.
7. Apply a policy gate for advice type, uncertainty, suitability, data completeness and release permissions.
8. Surface options and tradeoffs to the user or authorized advisor; record accept/edit/dismiss feedback.
9. Monitoring checks meaningful changes at consented cadence, never without authorization.

Track model/provider version, prompt and schema version, snapshot hash, evidence IDs, calculator receipts, user decisions, failures, token-cost estimate and model-change evaluations, without unnecessarily retaining raw financial PII in prompts/logs.

## 9.3 Pattern-based intelligence validation

Minimum evaluation suite should include irregular income, cash-flow shortfalls, duplicate transfers, refund/chargeback confusion, seasonal expenses, high APR, variable-rate debt, false-positive subscription detection, stale account balances, debt vs emergency reserve tradeoffs, two-person household conflicts, source prompt injection, unsupported RMD account, benign/ambiguous retirement scenarios, adverse market conditions, and cross-workspace leakage attempts.

Measure **precision and user usefulness**, not just the number of AI insights generated. A finding without reliable evidence becomes an explicit question or hypothesis, not a financial fact.

---

# 10. Security, regulatory scope and safeguards

## 10.1 Existing audit blockers

The uploaded November 5 v2 audit confirmed high-severity problems in the older repository state: cross-tenant workflow mutation; forged audit events; insufficient hash verification at freeze; mismatch receipts being accepted; untrusted data write paths; audit-chain forks; mutable post-approval discrepancies; inconsistent authorization policy. **Do not connect real Supabase/authentication or client records until PR-001 and PR-002 are corrected and independently tested.**

Retain:

- **PR-001:** SQL privileges, trusted workflow and audit calls, immutable data/receipts, canonicalization and dependency locks.
- **PR-002:** unsupported coverage outcomes, snapshot-only request reproducibility and latest-run recovery.
- **PR-003:** real auth, RLS/tenant tests, persistence, private storage and production-shaped deployment.

Technical caveat: custom Postgres session sentinels alone are not security controls; only trusted privileges/functions/authorization are authoritative. A request/response hash does not authenticate the calculator producer; server-owned execution and receipt provenance are required.

## 10.2 B2C advice and registration gate

SageSpan can research and prototype educational and general budgeting tools using synthetic data. **Individualized securities recommendations provided as a business for compensation can trigger investment-adviser regulation**, even if generated by software. Legal counsel must evaluate federal/state registration, fiduciary duty, disclosures, client questionnaires and suitability, supervisory policies, record retention, conflicts, vendor contracts and insurance before regulated advice goes live. SEC robo-adviser guidance identifies special attention to disclosures, sufficient client information and compliance programs. [R2, R3]

Consumer budgeting/debt tools are not a blanket exemption from privacy, unfair/deceptive practice, data security, consumer-finance or other applicable rules. Tax/legal/insurance advice may impose additional professional or regulatory obligations. Label educational general information and individualized recommendations accurately; disclaimers are not a substitute for compliance.

## 10.3 Financial-data consent, privacy and user control

- Manual entry works without bank credentials. Connected data is optional and read-only by default.
- Clearly identify which institution/data categories are imported, purpose, permission, refresh frequency, third parties and retention.
- Support revocation, deletion or retention exceptions, export, correction and audit of access according to legal obligations.
- Keep personal and firm data segregated; cross-workspace sharing is purpose-limited and revocable; firm compliance retention exceptions are clearly communicated.
- Encryption, secret management, access logging, backup/restore, incident response, threat modeling and independent security testing precede live-data launch.
- Consumer financial data portability rules are changing: the CFPB states that compliance dates for its 2024 Personal Financial Data Rights rule were stayed by a court in October 2025. **Do not build legal obligations around an assumed effective deadline; counsel must verify current status before launch.** [R4]
- For applicable registered firms, assess Regulation S-P and customer-information incident-response obligations. [R5]

## 10.4 AI and safety controls

Adopt a risk-register aligned to the NIST AI RMF Generative AI Profile, including prompt injection, unsupported recommendations, unauthorized data access, model drift, inappropriate certainty and misleading automated decisions. [R6]

Additional gates: privacy/data-processing assessment of provider; no secrets in prompts; tenant-scoped retrieval; typed tool calls; explicit model abstention; cost/latency limits; hallucinated reference rejection; human escalation; incident response; model switch/rollback; versioned evaluation set. Sensitive client data must not be uploaded to an unapproved AI provider.

**Never claim:** SageSpan is SEC-approved, SOC 2-certified, a fiduciary, a human financial advisor, independently attested, integrated with a named bank/planning tool, or able to guarantee returns unless separately true and documented.

---

# 11. Delivery strategy and sequencing

## 11.1 Track A — protect what exists

| ID | Delivery | Exit gate |
|---|---|---|
| SEC-001 | PR-001 trust boundaries | All known authorization/forgery paths blocked; actual negative tests and trusted receipts |
| SEC-002 | PR-002 coverage and reproducibility | Unsupported ≠ approved, snapshot-only calculations, retry recovery |
| CORE-003 | Auth, workspace/tenant model, private data storage | Real Supabase/JWT/PostgREST cross-tenant isolation tested |
| CORE-004 | Professional financial rules validation | Signed reviewer records and published rule/test coverage |

## 11.2 Track B — demonstrate B2C + B2B in synthetic mode

| ID | Delivery | Exit gate |
|---|---|---|
| DUAL-000 | Update master project docs and positioning | Two audiences explicitly supported; old B2B-only non-goals revised with rationale |
| DUAL-001 | Dual entry website + workspace shells | Personal and Firm flows, reusable design, no fictional live-data claims |
| PERS-001 | Manual financial intake + baseline + next steps | Real calculations from deterministic code, clear missing data; synthetic fixtures |
| PERS-002 | Budget/debt scenario cards | Assumptions, liquidity guardrails, no asset/trade execution |
| AI-001 | Grounded Analyze Plan for synthetic cases | No fabricated references/amounts, no approval powers |
| PLAN-001 | Bounded annual cash-flow projection | Deterministic, versioned, independently benchmarked model; scope prominently shown |

## 11.3 Later production milestones

- **Data Connect:** permitted read-only data aggregation, private document storage, consent and correction flows.
- **Retirement Studio:** validated projection/scenario models and later specialist reviews of tax/SSA/Roth/distribution calculations.
- **AI Copilot:** first-party financial questions, monitoring, source-linked summaries and decision proposals within the legal release scope.
- **Professional collaboration:** controlled client/advisor invitations, client-friendly publication and firm assurance packets.
- **Marketplace/regulatory extensions:** personalized investment advisory capabilities only after counsel-approved business model, licensing/registration and professional controls.

### Suggested 0–30 / 31–60 / 61–90-day decision gates

**0–30:** merge/review security PRs; release dual-market specification and synthetic website navigation; start B2C customer research and B2B firm interviews; map regulatory advice boundaries with counsel.

**31–60:** functional synthetic Personal Clarity flow, deterministic budget/cash-flow baseline and grounded AI Plan Review; real-stack security testing and one or two permitted import-format spikes.

**61–90:** benchmark consumer use-task completion and comprehension; run CCO review workflow with fictional or legally permitted non-sensitive data; decide whether to prioritize paid consumer pilot, firm design partners, or both. **No live-data deadline overrides a failed security or legal gate.**

All dates are targets/hypotheses, not promises. Launch decisions remain conditional on law, quality, testing and actual user evidence.

---

# 12. Commercial model: hypotheses to test, not committed prices

**Consumers:** explore free educational/manual-entry tools; a paid personal tier for useful planning and monitoring; an optional family tier for shared goals and permissioned collaboration. Candidate pricing tests might compare **$8–15/month personal** and **$15–30/month household**, but these are explicitly unvalidated research hypotheses, not announced prices.

**Firms:** retain the older B2B hypothesis of **$750/month firm minimum including 100 active households + $3.50 per additional active household**, plus a limited $500/month design-partner offer if contracts/legal readiness allow. Test alternatives based on completed reviews, workspace seats, or annual assurance cycles; one firm-client household should not be billed twice solely for using both portals.

**Revenue conduct:** no covert commissions, paid steering, conflicted priority ranking or lead-sale defaults. Disclose any referral or affiliate relationship and obtain the legal review it requires. Consumer recommendation order should not favor SageSpan revenue.

**Validation:** 15–25 firm interviews were proposed in the prior roadmap; additionally recruit structured consumer interviews across income/age/household stages. Test concrete jobs, willingness to pay, review time, decision clarity and financial outcome proxies. No blanket assumption that a free chatbot is a substitute for a licensed advisor.

---

# 13. Measurement and release criteria

| Domain | Proposed measurement | Release or interpretation rule |
|---|---|---|
| Personal data correctness | Source coverage, stale dates, category correction rate | Never silently fill material unknowns |
| Pattern detection | Precision/false alarms of cash-flow and recurring-spend flags | Suppress weak or anxiety-inducing noise |
| Decision usefulness | % suggestions accepted as relevant; action completion | Optimize helpfulness, not engagement addiction |
| Cash-flow engine | Golden fixtures, property tests, rounding/timing tests | All release-gating fixtures pass |
| Retirement scenarios | Independent benchmark cases and sensitivity review | No unsupported probability/after-tax claims |
| AI grounding | All material source IDs resolve to authorized evidence | Zero fabricated references in accepted runs |
| Security | Cross-workspace, cross-firm and role denial tests | Zero known authorization bypasses in release suite |
| Consumer understanding | Can users explain assumptions and tradeoffs? | Redesign if recommendations cause confusion |
| Well-being | Optional self-reported clarity/stress improvement | Never promise clinical or financial improvement |
| Firm assurance | Material findings precision, review time and evidence completeness | Professional reviewer owns dispositions |
| Legal readiness | Counsel-approved feature-by-feature authority matrix | Tier 3 recommendations remain off until cleared |

**Illustrative completion definition for first dual-track demo:** one consumer can enter a fictional income, bills, savings and debt picture, see an explainable financial snapshot and compare a safe action; one advisor can analyze a separate fictional retirement plan, inspect evidence-linked discrepancies and route a review; neither flow crosses a workspace boundary or calls a prototype a regulated advisor.

---

# 14. Governance: decisions for the founder

**Decided now**

1. SageSpan serves B2C individuals/households **and** B2B professionals/firms.
2. The flagship is intelligent, realistic, explainable planning with independent assurance and low-friction user decisions.
3. Existing code and PR-001 security work are preserved and prioritized.
4. AI assists discovery, comparison and interpretation; deterministic services own authoritative math.
5. No automated money movement; no falsely branded legal/regulatory status.

**To validate before commercialization**

1. Whether SageSpan itself will register as an investment adviser, partner with a registered adviser, or limit initial consumer outputs to educational/budgeting decision support.
2. Which consumer data aggregation vendor(s) and provider contracts satisfy privacy/security requirements.
3. The legal privacy/ownership model for household sharing and B2C-to-RIA client collaboration.
4. Which retirement projection modules receive independent professional verification and release priority.
5. Pricing, packaging, customer acquisition and who provides human advisory escalation.
6. Trademark clearance for “SageSpan” before major brand spend.

---

# 15. Sources and assumptions register

**Supplied project materials (repository-derived, as of 2026-11-05):** `REPOSITORY_AUDIT_2026-11-05_v2.md`, `NEXT_PROMPT_PR-001.md`, `SageSpan_PR-001_Reviewed_Prompt_v3.md`, `SageSpan_AI_Planning_Blueprint_and_Claude_Prompt.md`, and archived SageSpan V3 five-stage/positioning references. These support the current architecture, audit findings and original B2B wedge. The dual-market requirements and consumer decision engine are **new founder direction and proposed implementation**, not verified repository features.

**Official public references (checked November 2026):**

- **[R1] CFPB — Financial well-being:** https://www.consumerfinance.gov/consumer-tools/educator-tool/financial-well-being-resources/
- **[R2] SEC / Investor.gov — Investment advisers:** https://www.investor.gov/introduction-investing/getting-started/working-investment-professional/investment-advisers
- **[R3] SEC — Robo-adviser guidance:** https://www.sec.gov/newsroom/press-releases/2017-52
- **[R4] CFPB — Personal Financial Data Rights status (court stay noted):** https://www.consumerfinance.gov/compliance/compliance-resources/other-applicable-requirements/personal-financial-data-rights/
- **[R5] SEC — Regulation S-P customer information amendments:** https://www.sec.gov/newsroom/press-releases/2024-58
- **[R6] NIST — AI RMF Generative AI Profile:** https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence
- **[R7] SEC — Investment Adviser Marketing guidance, hypothetical performance:** https://www.sec.gov/resources-small-businesses/small-business-compliance-guides/investment-adviser-marketing

These are reference and risk flags; a tailored U.S. federal/state legal assessment is required before launching the relevant features.

---

## Closing product principle

**Make a better decision, explain why, show what could go wrong, and preserve the user's control.** The consumer wants less pressure and more clarity. The professional wants better evidence and defensible oversight. SageSpan should deliver both through a coherent platform, not two unrelated apps or an all-knowing AI adviser.
