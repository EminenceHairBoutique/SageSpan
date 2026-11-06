# CLAUDE CODE / FABLE 5.1 — SAGESPAN V3 MASTER BUILD KICKOFF

You are the founding CTO, principal engineer, quantitative validation specialist, product designer, fintech security architect and advisor-workflow designer for an independent retirement plan assurance platform.

Model requested: Claude Fable 5.1 (`claude-fable-5-1`). **SageSpan** is the provisional working brand, pending formal trademark clearance (including possible SAGE software-brand overlap) and domain verification. Keep brand text, colors, logos and metadata configurable. The former Plumbline codename is retired for active development. Do not purchase significant branding, publish marketing externally or claim trademark rights without authorization.

**The task is to implement a working product vertical slice in the current repository, not merely write a plan, diagram or attractive landing page.** You may create and edit files, install reasonable dependencies, run linters/tests/builds and iterate on errors. Do not delete unrelated work, perform destructive git operations, expose secrets, deploy publicly, access real customer documents, or create third-party paid services without permission. **Model privacy:** Anthropic documents a 30-day retention requirement for Fable 5.1 and no default zero-data-retention eligibility absent express authorization. Never paste/upload real client financial data, confidential contracts or PII into Claude Code for this build; synthetic development data only.

# A. Read and reconcile context
1. Inspect current repository and project structure, package manifests, configuration, existing tests, routes and `CLAUDE.md` before creating a parallel app.
2. Read `00_START_HERE.md`, `01_FOUNDER_DECISIONS_AND_POSITIONING.md`, `02_PRODUCT_AND_FIVE_STAGE_MAPPING.md`, `03_ARCHITECTURE_AND_DATA_SCHEMA.md`, `04_FINANCIAL_RULES_AND_TEST_STRATEGY.md`, `05_COMPLIANCE_PRIVACY_AI_SECURITY.md`, `07_SOURCES_AND_CLAIM_REGISTER.md`, and `09_PRICING_GTM_90_DAY_GATES.md` if available. V3 supersedes older consumer-adviser and Plumbline specifications. If only `SAGESPAN_MASTER_SOURCE_OF_TRUTH.md` is present, use it as the canonical single-source spec.
3. The founder-selected **target** architecture is Next.js App Router + React/strict TypeScript/Tailwind; Supabase PostgreSQL/Auth/RLS; **separate Python/FastAPI calculation/verification service**; Vercel for the web; future queue/workers outside Vercel. In an established Vite codebase, preserve its data and working code and plan a safe incremental migration to Next.js; do not destroy a productive repo. For greenfield, start directly in the approved stack. Use Lucide, Zod, accessible components, Vitest, Playwright, `pytest`, decimal-safe math and OpenAPI contracts.
4. State up to seven implementation steps and begin immediately. Batch independent repository and document inspections where supported. Share concise milestone notes. Do not stop after architecture or UI-only implementation.
5. If missing external keys, use a DEMONSTRATION MODE with isolated synthetic fixtures; still implement executable local workflows and tests. Do not pretend demo login is production authentication or demo reviews are professional approval.

# A2. Founder decisions and repo layout
The adopted build direction is **Next.js + Supabase + separate Python/FastAPI from day one**, not a choice for the assistant to relitigate on each turn. Do not place tax calculations inside client-side React or long-running Vercel handlers. Separate computation and workflow.

Recommended monorepo layout (adapt to existing repo non-destructively):
```
apps/web/                  # Next.js marketing + tenant-aware RIA console
services/calculator/       # FastAPI, Decimal financial rules, pytest
packages/contracts/        # OpenAPI-derived schemas / shared API contracts
supabase/migrations/       # normalized tenant-scoped schema + RLS
supabase/tests/            # cross-tenant / unauthorized approval tests
fixtures/synthetic/       # fictional Patel/Okafor input, sources, plan exports
docs/                     # decisions, methods, architecture, privacy, gates
```
Run frontend and Python service locally via clear README scripts; a Compose file may help but must not become a requirement when unavailable. A queue is not necessary for initial RMD, but add an interface suitable for future asynchronous rule-impact jobs.

**Proposed pricing model, not approved public offer:** standard $750/month firm minimum with 100 active monitored households and $3.50/month per additional active monitored household; limited $500/month design-partner pilot up to 50 households. Firm-wide authorized access rather than per-seat pricing. H=500 gives $2,150/month. 'Active monitored household' excludes archive, duplicate and prospect-only entries. Do not build real billing yet.

**Validation gates:** 15–25 discovery interviews, 5 structured pilot candidates, at least 2 paid written commitments by day 90 if legally/security ready, two legally accessible real planning-export formats, zero cross-tenant leaks in tests and RMD golden accuracy. Track efficacy and false-positive/review-time costs. These are hypotheses, not guaranteed outcomes.

# B. Product definition and audience
Build a premium SaaS application for U.S. RIAs that independently reviews a retirement plan created in a planning tool and preserves a documented supervision record.

Primary personas: **Chief Compliance Officer** (champion and review policy), **managing partner/CEO/COO** (economic buyer and sponsor), Lead Advisor/Planning Director (planning owner), Analyst/Paraplanner, Org Admin and restricted Reviewer. Initial ICP is U.S. independent RIAs with approximately 5–50 advisors; validate actual procurement roles.

Core job: import a permitted plan export and source statement(s) -> reconcile facts -> freeze supported snapshot -> independently check a supported rule -> triage material differences -> authorized human review -> export evidence packet.

**Do not build another generic full financial planning app.** Do not prioritize consumer onboarding, trading, brokerage connections, automated portfolio management, a broad Social Security calculator, universal estate/tax coverage or unvalidated Monte Carlo. Preserve the five original retirement lifecycle stages as future bounded expansion modules, not P0 scope.

Make 'independent checking without switching planning tools' a clearly labeled market **hypothesis**, not a claimed monopoly or unique technical breakthrough. Conquest already advertises verifiable, headless financial planning and MCP; Income Lab has a Verify button, and Wealth.com markets traceability and compliance-oriented workflows.

# C. Visual system and marketing
Design polished enterprise fintech UX with a cool off-white canvas, deep navy ink, teal for confirmed facts, amber/orange for needs attention and slate-blue for assumptions. Use **Schibsted Grotesk** for headings and **Public Sans** for body if licensing/network permits; fall back to equivalent available system fonts rather than blocking. Colors and state meaning must be redundant with labels and icons for accessibility.

Implement public routes:
- `/` — premium marketing homepage with credible narrative, sample traceable check receipt, three jobs to be done, five-step workflow, explicit 'What we do not do', pilot interest form (local demo only if no live endpoint), FAQ and footer.
- `/product` — fact reconciliation, independent verification, review trail, limits.
- `/security` — factual security *design approach*, no unsupported SOC 2, ZDR, signed audit, SEC or bank-grade compliance claims.
- `/demo` — interactive synthetic product tour.
- `/pricing` — show **proposed, illustrative, not-yet-offered** firm pricing: $750/month including 100 active monitored households, $3.50/month for each additional active monitored household, and limited $500/month paid pilot up to 50 households. Use the exact formula `750 + 3.50 * max(0, H - 100)` for standard pricing. No live payments, fake subscriptions or automatic pilot enrollment.

Use 'SageSpan' as the clearly provisional, configurable brand in private prototype and design assets. All CTAs must work (navigate, open form, or clearly indicate gated demo). No fake testimonials, customer totals, logos, partnership claims or vendor integrations.

# D. Product screens — build REAL workflows
Authenticated/isolated app routes (demo may use a distinct `/demo/app` namespace without privileged session):
1. `/app/reviews` — organization-scoped household review queue with filters for blocked/pending/reviewed and owner/assignee.
2. `/app/households/[id]` — household overview, confirmed/assumed/unverified/conflicting facts, source links, ownership and as-of dates.
3. `/app/households/[id]/imports` — supported CSV/JSON upload and explicit field mapping; separate synthetic fixtures from any real upload.
4. `/app/households/[id]/checks` — rule-specific independent check, conditional RMD calculations, source/reference citation, comparable external number and discrepancy classification.
5. `/app/households/[id]/review` — conflict resolution, freeze status, review queue, authorized comments and approval workflow.
6. `/app/households/[id]/evidence` — structured evidence packet preview and downloadable JSON/HTML or PDF only if reliable rendering is available; include limitations and provenance.
7. `/app/settings` — org/team role demo and rule-set version status; any enterprise security settings not implemented marked unavailable.

All primary buttons, filters, details, confirmations and exports must behave correctly. Avoid UI-only 'approve' actions that cannot be backed by authorization and an audit event. A real authenticated user must be required to approve in production mode; in synthetic demo display 'simulated reviewer'.

# E. Core scenario: Patel RMD and data conflict
Seed a fictitious Patel household with:
- One IRA owner who is age **74 during tax year 2026**, exact fictional birth date recorded.
- Traditional IRA, owner-held, not inherited, owner alive.
- Prior December 31 **2025** balance `$640,000.00`, verified as-of date and synthetic source statement.
- Spouse beneficiary conditions consistent with IRS Uniform Lifetime Table eligibility; explicitly record and display them.
- 2026 Uniform Lifetime Table factor **25.5**, from IRS Publication 590-B.
- Independent calculated annual RMD: `$25,098.04` (`$640,000 / 25.5` rounded to cents).
- Separate synthetic imported plan value (e.g. `$24,000.00`) to exercise discrepancy detection, labeled illustrative.
- An additional conflict variant with a mismatched account balance that **prevents snapshot freeze** until reconciled.

The RMD check must not use factor 25.5 automatically for an inherited IRA, for an owner whose spouse is the sole beneficiary and more than 10 years younger, or whenever necessary account/type/age/balance/timing inputs are missing. Return a typed `UNSUPPORTED` / `INDETERMINATE` state instead.

Represent a deferred first RMD (April 1 following year turning 73) and current-year Dec 31 obligation as potentially separate events. Do not conflate them in the amount or deadlines. Do not claim RMD computation covers all IRS exceptions.

Create a second fictional household with inconsistent facts (e.g. `Okafor`) and a third without enough source evidence. Financial numbers for these are plainly synthetic and may not claim independent validation.

# F. Import normalization and evidence quality
Create a documented JSON/CSV sample import contract with:
- `org_id` derived from authenticated context, never trusted from incoming unvalidated row;
- household/source identification, vendor label as free-text metadata (not a functional integration);
- owner/account id, typed facts, currency, unit, source location, as-of date, tax year;
- optionally imported check amount, assumptions and calculation scope.

Separate:
`FACT_CONFIRMED`, `FACT_ASSUMED`, `NEEDS_CONFIRMATION`, `FACT_CONFLICT`.

When matching facts, account for as-of dates; mismatched dates are NOT automatically proof a plan is wrong. Classify results as SOURCE_CONFLICT, STALE_INPUT, RULE_DISAGREEMENT, METHODOLOGY_DIFFERENCE, MISSING_EVIDENCE, UNSUPPORTED_CHECK, WITHIN_TOLERANCE or NOT_COMPARABLE. Do not label a mismatch an error until source and methodology are normalized.

Require source provenance, uploaded source hash and explicit schema version. Fake/OCR-extracted confidence scores are not allowed. Import only explicitly supported samples. Unsupported vendor formats must result in actionable explanation, not silent random parsing.

# G. Financial calculation and verification core
Create the authoritative **Python/FastAPI financial verification service from day one**, independently runnable and tested with `pytest`, `Decimal`, documented OpenAPI schema, and a versioned financial rule registry. The Next.js app must never independently compute authoritative tax/RMD outputs, only render verified service receipts. Suggested Python modules:
- `services/calculator/app/financial/rmd.py`: typed eligibility assessment; effective-year factor lookup; 2026 eligible-owner traditional IRA RMD; decimal-safe money rounding; unsupported reasons.
- `services/calculator/app/financial/rules.py`: approved effective-dated rule sets, source links, version and checksums; keep draft and published distinct.
- `services/calculator/app/financial/checks.py`: compare computed amount with imported amount when comparable and detect discrepancy by configurable, documented tolerance.
- `services/calculator/app/financial/receipt.py`: deterministic snapshot and run receipts, version and provenance.
- `services/calculator/app/financial/tax2026.py` (P1, only after RMD P0 passes): narrowly scoped federal ordinary income progressive tax calculation with explicit input type, supported statuses (single and MFJ), 2026 bracket/standard deduction tables from IRS Rev. Proc. 2025-32, and a `not_supported[]` list. Do not label as complete federal tax or compute on unhandled credits, SS taxation, AMT, NIIT, QBI, special deductions, etc.

Use `POST /v1/checks/rmd` as the calculation API, server-authorized and tenant-scoped; do not trust unverified client `org_id`. Add Python/OpenAPI contract tests and handle service unavailability honestly. Long work belongs on a separate queue/worker, not Vercel request handlers.

No AI hallucinated calculations, no unvalidated stochastic fan charts, no '81% success' demo stat. AI features may be represented as future connectors with explicit nonfunctional status, not fake operating intelligence.

# H. Relational data + Row Level Security
Generate normalized Supabase SQL migrations for:
`Organization`, `Membership`, `Household`, `Person`, `Account`, `AccountOwnership`, `BeneficiaryDesignation`, `SourceDocument`, `SourceLocation`, `Fact` with typed columns and as-of/effective dates, `FactConflict`, `RuleSet`, `RuleParameter`, `AssumptionSet`, `Assumption`, `PlanImport`, `ImportedPlanValue`, `FrozenSnapshot`, `CheckRun`, `Discrepancy`, `Review`, `EvidencePacket`, `AuditEvent`.

Write real policies and tests proving tenant isolation, role permissions and cross-org FK constraints. All normal business tables must be tenant scoped and all policies server-authoritative. Never use unrestricted service-role keys in browser. Protected review and freeze actions should run as trusted server-side transactions, validating both role and state transition.

`AccountOwnership` allows more than one owner and effective dating; do not assume equal 50/50 community-property shares. `BeneficiaryDesignation` must support primary and contingent types separately.

Implement input versions and immutable, content-hashed snapshots (SHA-256 canonical input payload), versioned approved rule sets, calculation run hash, actor timestamps and append-only auditable workflow events. When resolving conflict, create a new input revision, not a mutation of an immutable frozen snapshot.

# I. State machine / policy
Model:
`IMPORT_DRAFT -> MAPPED -> RECONCILIATION_PENDING -> BLOCKED or READY_TO_FREEZE -> FROZEN -> CHECK_COMPLETE -> REVIEW_PENDING -> REVIEWED -> APPROVED -> EXPORTED`.

Block snapshot freeze if **material required facts** conflict or are missing. If a nonmaterial conflict is allowed by firm policy, require an explicit recorded documented exception and proper authorization; never silently bypass. Separate arithmetic check PASS from advisor/compliance APPROVED. For approvals, record actual authenticated reviewer identity, role, timestamps, rationale and conflict attestation. Enforce separation of duties if configured by firm policy.

Generate a packet with source hashes, source citations, mapped facts, snapshot version/hash, calculation inputs, rule source/version, engine version, comparison classification, reviewer action and limitations. Call it 'review evidence packet' — not 'SEC-certified exam packet'.

# J. Security requirements and tests
- No live client documents during build; all examples synthetic.
- Zod or equivalent validation on server; file size/type protections; safe CSV parsing and formula-injection-safe export.
- Server-verified auth and org permissions, RLS, database-level referential and append-only controls.
- Sanitized audit logs and access events without raw client PII.
- No false claims about encryption, vendor contracts, security certifications, retention guarantees or AI training policies.
- Do not log keys or upload data to external AI providers without explicitly configured credentials and data-processing approval.
- Test two separate authenticated organizations; Org A must never access B's households, documents, reports, approval state or exports.
- No production use if these tests or the financial golden cases fail.

# K. UX trust and accessibility
Use a visible synthetic-data banner. Display evidence state with both color and text, not color alone. Each calculated number is clickable to open a receipt with input, source date, governing rule/version and formula.

The strongest demo moment: a visible conflict keeps 'Freeze snapshot' disabled; clicking explains exactly which two source facts disagree, source dates, and how to resolve or document the exception. After authorized resolution, freeze, run RMD, inspect difference, review and export the packet.

Handle missing data, unsupported checks, imported vendor fields missing assumptions, error states, and no-client conditions elegantly. Never fill tables with unexplained fake amounts or pretend demo data are connected accounts.

# L. Testing and quality acceptance
Set up `pytest` numerical tests and OpenAPI contract checks, Vitest for TypeScript logic, SQL RLS/integration tests and Playwright browser tests as available.

Minimum tests:
1. Patel $640,000 / 25.5 -> $25,098.04.
2. RMD amount monotonically rises with balance for fixed factor.
3. Different source-as-of dates => needs reconciliation, not automatically mathematical mismatch.
4. Sole-beneficiary younger-spouse exception => unsupported if joint table not implemented.
5. Inherited IRA => unsupported.
6. 2025 first RMD deferred to 2026 => separate obligation event from 2026 annual RMD.
7. Missing material balance => snapshot cannot freeze.
8. A frozen snapshot is immutable; later facts create new revision.
9. Role without review permission cannot approve, even if UI request forged.
10. Tenant A cannot read or mutate tenant B's data.
11. Discrepancy NOT_COMPARABLE when assumptions differ materially.
12. Downloaded evidence report contains correct metadata and limitation notice.
13. Public nav, demo import, conflict block, resolution, RMD check, review and export work in browser.
14. Python `pytest` / RMD golden fixtures pass; Next.js `npm run typecheck`, lint, unit tests and production build pass; fix failures if possible.
15. Python-service contract returns exact receipt metadata and service errors fail visibly rather than falling back to invented client-side math.
16. The standard pricing illustrative calculator yields $750 at 100 active households, $2,150 at 500, and $3,900 at 1,000.

# M. Definition of done for first milestone
Ship a locally runnable vertical slice with:
- beautiful responsive public website + functional navigation;
- demoable independent plan assurance app;
- synthetic import fixture and documented schema;
- tenant-aware model/migrations/RLS test coverage;
- fact conflict + freeze gating;
- independently runnable Python/FastAPI deterministic RMD engine, `pytest` golden cases, OpenAPI/typed contract and exact traceable receipt;
- discrepancy classifications including unsupported/not-comparable;
- review and authorization state tracking;
- downloadable synthetic evidence packet;
- financial and cross-tenant tests;
- README, `.env.example`, `CLAUDE.md`, `docs/ARCHITECTURE.md`, `docs/FINANCIAL_METHODOLOGY.md`, `docs/SECURITY_AND_LIMITS.md`, `docs/ROADMAP.md`.

If production Supabase keys are absent, implement credible local demo data path and SQL migrations/test harness; describe exactly what still requires configuration, and never mark untested RLS as proved. Do not widen scope to 43-state taxes or Monte Carlo at the cost of this vertical slice.

# N. Implementation and reporting standards
- Make a small, defensible architecture plan, then write files and execute tests.
- Preserve working code and user assets.
- Use stable typed components and tested financial algorithms rather than synthetic screenshot dashboards.
- Record decisions and implementation status in `CLAUDE.md` after every major milestone.
- Do not create unverified external integrations or call hypothetical vendor APIs.
- Expose blockers honestly without inventing successes.
- End with a list of real routes/features, specific Python and TypeScript test results, limitations, unresolved approvals, and one next action. Never mark an RLS test as passed if Supabase or its local test harness was not run.

# BEGIN NOW
First inspect existing repository files and context documents in independent parallel reads where supported. Select the non-destructive implementation path, create the initial plan, then **implement and verify** the end-to-end Patel conflict-to-review-to-evidence flow. Do not end after designing only the UI. Record the **V3 founder decisions** in `CLAUDE.md`, avoid reintroducing the legacy consumer planner, and make the complete financial boundary and pricing hypothesis visible in documentation.
