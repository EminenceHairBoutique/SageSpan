# SAGESPAN — MASTER SOURCE OF TRUTH (V3)
> **SUPERSEDED (2026-11-05 founder decision, recorded 2026-11-06).** This V3 document states a **B2B-only** direction. That market decision is superseded by **SageSpan V5: one platform serving B2C individuals/households AND B2B advisors/RIA firms** — see `docs/product/SAGESPAN_V5_MASTER_SOURCE_OF_TRUTH.md` and `CLAUDE.md`. V3's assurance design, financial-rule framework and security requirements remain in force where V5 preserves them. Kept unchanged below as history.

**Date:** November 5, 2026  
**Project status:** Provisional brand; approved prototype direction, unvalidated market and price hypotheses.  
**How to use:** Upload this **one file** to Claude Project Context. Paste the separate `06_CLAUDE_PROJECT_INSTRUCTIONS.md` into the project Instructions field. To start code implementation, paste `08_FABLE_5_1_BUILD_KICKOFF.md` in Claude Code. Avoid uploading this master and all individual V3 documents together; they duplicate content.

> Scope boundaries: U.S. RIA firm B2B, synthetic data only, independently verified scoped rules, Next.js plus Python/FastAPI, human review, no automatic advice/execution.

## Table of contents

1. 00_START_HERE.md
2. 01_FOUNDER_DECISIONS_AND_POSITIONING.md
3. 02_PRODUCT_AND_FIVE_STAGE_MAPPING.md
4. 03_ARCHITECTURE_AND_DATA_SCHEMA.md
5. 04_FINANCIAL_RULES_AND_TEST_STRATEGY.md
6. 05_COMPLIANCE_PRIVACY_AI_SECURITY.md
7. 07_SOURCES_AND_CLAIM_REGISTER.md
8. 09_PRICING_GTM_90_DAY_GATES.md
9. 10_CHANGELOG_V1_V2_V3.md
10. 06_CLAUDE_PROJECT_INSTRUCTIONS.md
11. 08_FABLE_5_1_BUILD_KICKOFF.md

---



---

# SECTION 1: 00_START_HERE.md


# SageSpan — Unified Framework V3 (Canonical Context Pack)
**Prepared:** 2026-11-05  
**Status:** Founder-selected build direction; brand, pricing and customer demand remain provisional or unvalidated where identified.  
**Scope:** U.S. B2B independent retirement plan assurance and supervisory intelligence.

## What is unified
This V3 pack consolidates: (1) the original AI-native five-stage retirement advisory framework; (2) Claude's *Plumbline Framework Audit, Upgrades and Competitive Research*; (3) the prior Plumbline V2 independent assurance specification and Fable coding prompt; and (4) the subsequent **SageSpan Founder Decision Review** supplied in `Pasted text.txt`.

**V3 is controlling**. Earlier SageSpan consumer-planner instructions and Plumbline V2 instructions should be archived or removed from Claude's active Context to avoid conflicting orders. Older research may remain as history, not as current product requirements.

## Five controlling build decisions
1. **Name:** SageSpan is the provisional working brand, pending substantive trademark/domain clearance. Keep copy and configuration easy to rebrand.
2. **Primary product:** independent retirement plan assurance and review evidence, not a greenfield robo-advisor or plan-builder.
3. **Buyer:** sell to RIA firms, with CCO/compliance leader as champion, managing partner/CEO/COO as economic buyer, and lead advisor as adoption stakeholder. Initial ideal customers: roughly 5–50 advisor RIAs.
4. **Architecture:** for greenfield build, Next.js App Router + strict TypeScript + Tailwind + Supabase/Postgres/Auth/RLS, AND a separately deployable **Python/FastAPI financial calculation and verification service** from the first vertical slice; future async workers when needed. Preserve existing useful code and migrate safely if the repo is already established.
5. **Pricing hypothesis:** $750/month firm minimum includes 100 active monitored households; $3.50/month per additional active monitored household; limited $500/month paid pilot up to 50 households. All unvalidated until firms commit.

## Read / upload order
**If you want one Context upload:** use `SAGESPAN_MASTER_SOURCE_OF_TRUTH.md`. It contains the complete consolidated framework, founder record, technical requirements, instructions and development kickoff. Do **not** upload all the individual files as well unless necessary: duplication may waste context and cause confusion.

**If you prefer modular Context files:** upload `01`–`05` and `07`, then paste `06_CLAUDE_PROJECT_INSTRUCTIONS.md` into Claude Project **Instructions** and paste `08_FABLE_5_1_BUILD_KICKOFF.md` into a Claude Code session. In modular mode, do not also upload the master file.

## First proof of product
Synthetic Patel household → supported CSV/JSON plan export + independent source statement → normalized facts and ownership → visible material balance conflict → freeze blocked → explicit resolution → immutable snapshot → 2026 age-74 owner-held traditional IRA RMD check → difference against synthetic imported $24,000 → authorized review → versioned, limited-scope evidence packet download.

For the specified eligible IRS Uniform Lifetime Table case: `$640,000 / 25.5 = $25,098.04` (annual RMD rounded to cents). Never generalize to inherited IRAs, unusual spouse-beneficiary cases, or unsupported workplace plans.

## Hard restrictions
- Synthetic data only in prototypes and Claude Code. No authentic client financial records, secrets, or confidential contracts in prompts.
- No trading, money movement, discretionary recommendations, automated fiduciary approval, or false vendor integrations.
- Mathematical pass ≠ adviser approval; evidence packet ≠ SEC certification.
- No unsupported statements that SageSpan is registered, SOC 2 certified, ZDR, independent-audit certified, guaranteed accurate, or compatible with all advisor software.
- Fable 5.1 generally requires 30-day retention, with only explicitly authorized exceptions. Verify your organization and vendor terms. 

## Files
- `01_FOUNDER_DECISIONS_AND_POSITIONING.md` — definitive product, buyer and branding choices.
- `02_PRODUCT_AND_FIVE_STAGE_MAPPING.md` — B2B workflow, screens, lifecycle mapping, statuses.
- `03_ARCHITECTURE_AND_DATA_SCHEMA.md` — components, typed facts, permissions, data provenance, contracts.
- `04_FINANCIAL_RULES_AND_TEST_STRATEGY.md` — RMD golden cases, tax v0 boundary, independent tests.
- `05_COMPLIANCE_PRIVACY_AI_SECURITY.md` — legal perimeter, data security, release gates.
- `06_CLAUDE_PROJECT_INSTRUCTIONS.md` — concise permanent project behavior prompt.
- `07_SOURCES_AND_CLAIM_REGISTER.md` — sources, competitors, verified vs hypothesis claims.
- `08_FABLE_5_1_BUILD_KICKOFF.md` — direct implementation assignment for Claude Code.
- `09_PRICING_GTM_90_DAY_GATES.md` — published hypothesis and sales/pilot measures.
- `10_CHANGELOG_V1_V2_V3.md` — explicit reconciliation of decisions.
- `SAGESPAN_MASTER_SOURCE_OF_TRUTH.md` — everything above in one document.

## Authority and uncertainty
The founder decision review selects V3 implementation choices; it does **not** mean any government body, trademark attorney, CPA, security auditor or paying firm has independently approved the product. Dates are as of November 5, 2026. Revalidate externally changing facts before publication, production rule updates or commercial release.


---

# SECTION 2: 01_FOUNDER_DECISIONS_AND_POSITIONING.md


# SageSpan V3 — Founder Decision Record and Market Position
**Effective baseline:** November 5, 2026. **Project:** SageSpan (provisional working name).

## Executive decision matrix
| Item | Adopted build decision | Qualification / exit gate |
|---|---|---|
| Product name | Use SageSpan across internal code and prototypes | Formal federal/state/common-law trademark search, counsel sign-off and domain verification before public launch. Centralized string configuration. |
| Strategic category | B2B independent retirement plan assurance | Wedge hypothesis: firms value a second-opinion check of existing plans; validate evidence and willingness to pay. |
| Go to market | Firm-paid B2B; CCO champion + owner/CEO/COO economic buyer + lead advisor reviewer | Interview procurement roles and budget authority; avoid treating CCO as automatically the purchaser. |
| Stack | Next.js App Router, React, TypeScript, Tailwind, Vercel web; Supabase PostgreSQL/Auth/RLS; separate Python/FastAPI authoritative calculation service; queue/workers later | Preserve functioning repo code; service separation from day one, no heavy compute in request handlers. |
| Pricing | $750/month minimum with first 100 active monitored households; $3.50 for each additional monitored household/month; $500/month pilot up to 50 households | Hypotheses only. Validate price points with interview/pilot outcomes; do not enable live billing in MVP. |

## Mission
**Independent assurance for every retirement plan.** SageSpan checks the traceability of source facts and a defined set of retirement calculations in financial plans produced in other software. It identifies unresolved input conflicts and material differences, documents the review actions of properly authorized human professionals, and creates a reproducible review evidence packet.

**Promise:** what was checked, against which sources and rules, what could not be checked, what differed, and who reviewed it.
**Not the promise:** every plan is correct; an SEC examination is guaranteed to pass; SageSpan replaces fiduciary diligence; or artificial intelligence can independently certify the overall suitability of investment advice.

## Firm buying committee and first ICP
- **CCO / compliance lead:** primary champion; selects oversight policy, review exceptions and evidence requirements.
- **Managing partner / CEO / firm owner:** expected economic sponsor and budget authority.
- **COO / operations director:** implementation and measured return-on-workflow.
- **Lead advisor / planning director:** clinical-equivalent domain reviewer; validates interpretation and practical utility.
- **Paraplanner / analyst:** reconciles facts and prepares draft reviews.
- **IT/security reviewer:** vendor diligence, restricted data flows, procurement gate.

Start with U.S. independent RIAs of approximately **5–50 advisors**, with an established planning software stack and recurring review workload. This is an ICP *hypothesis*. Do not optimize for enterprise banks in the first 90 days.

## Evidence and competitive positioning
Incumbent solutions already offer meaningful planning automation and in some cases verification or headless models. Relevant competitors or adjacent systems: Income Lab/Penny, RightCapital/Iris, Altruist/Hazel, Conquest Planning, Wealth.com, eMoney, MoneyGuide, Holistiplan, and Claude for Financial Advisors. In particular, Conquest has marketed verifiable/headless engine and MCP capabilities; MCP alone is not a unique advantage.

The **specific hypothesis to test** is whether independent cross-tool *source reconciliation + limited rule verification + human supervision record* delivers value without replacing existing planning software. Publicly avoid claims of being first, only, universally compatible, or scientifically/error-proof. Different vendors' return, timing, tax and assumption models may legitimately disagree. Classify `NOT_COMPARABLE` and missing evidence rather than inventing errors.

## Initial MVP value statement
> Import a permitted retirement plan export and supporting source documents; confirm account and household facts; independently reproduce **supported** retirement checks; see why something differs; and record an authorized review with source-linked evidence.

**P0:** explicit synthetic CSV/JSON import; typed facts and ownership; material conflicts block freeze; versioned RMD; imported figure comparison; reviewer queue and evidence export.
**P1:** narrow 2026 federal ordinary-income tax module with independently benchmarked supported scope; rule-publish event and book-wide affected-household preview; beneficiary evidence flags; preliminary vendor import feasibility matrix.
**P2:** vetted commercial connectors, read-only MCP endpoints if justified, additional independently validated tax/benefit checks, rule monitoring, limited client-readable view.
**Deferred:** B2C self-directed/hybrid robo-advisor, full plan creation, autonomous advice/execution, 43-state tax coverage, broad Monte Carlo and longevity prediction.

## Price model: illustrated, not offered
For `H` active monitored households in a firm in a calendar month:
`subscription_monthly(H) = 750 + 3.50 * max(0, H - 100)` (USD), excluding implementation/custom support and any later negotiated terms.

| Active monitored households | Monthly (illustrative) | Annual run-rate (illustrative) |
|---:|---:|---:|
| 50 | $750 | $9,000 |
| 100 | $750 | $9,000 |
| 250 | $1,275 | $15,300 |
| 500 | $2,150 | $25,800 |
| 1,000 | $3,900 | $46,800 |

**Paid pilot:** $500/month for up to 50 households for an explicitly limited period, subject to legal/security readiness and signed pilot scope. No live Stripe integration for the prototype.

**Billing definition:** an *active monitored household* is a distinct family planning unit with an active assurance record in the measurement month; exclude archived, duplicate and prospect-only records. A household should not be charged multiple times merely because it has several persons, accounts or reviews. Final measurement, retention and fair-use rules require contracts.

Test against fixed compliance team license and per-reviewed-plan fees. Protect the firm minimum from drifting into a mandatory seat fee: authorized seats are included in the initial hypothesis, subject to reasonable contractual controls.

## Brand protection
SageSpan is not cleared. Sage's established business-software brand creates a reason for enhanced legal clearance, not a conclusion that SageSpan infringes. The prior codename Plumbline has other fintech uses and is not the public brand. Store brand name, logo assets and page titles in centralized config. No production domain purchase/transfer, advertising campaign, trademark filing or claim of exclusivity without explicit founder action and counsel input.

## Governance
- Human reviewer retains judgment and can reject a mathematically sound result as insufficient, not comparable or unsuitable for the client's circumstances.
- Rules and models require source references, tax-year versioning, benchmark tests and approval records.
- Ingestion of actual identifiable client financial data requires legal, vendor, privacy, security, and calculation-release gates.
- Every marketing statement must be linked to a claim status: verified, conditional, roadmap, or untested.


---

# SECTION 3: 02_PRODUCT_AND_FIVE_STAGE_MAPPING.md


# V3 Product Requirements: Independent Plan Assurance and Supervision
Status: prototype requirements and testable hypotheses, not final specifications.

## Job to be done
An RIA firm wants to review retirement recommendations prepared in existing planning software, discover consequential conflicts between the source documents, plan assumptions, and supported financial rules, and preserve evidence of its review without rebuilding the full client plan elsewhere.

## Initial users
- **Chief Compliance Officer / Compliance Lead:** review policies, exception queue, exports, access, resolution history.
- **Lead Advisor / Planning Director:** import, reconcile, verify, document rationale and dispositions.
- **Paraplanner / Analyst:** uploads, maps facts, prepares draft packets; cannot self-approve where policy requires segregation.
- **Client, later:** restricted view-only summary of already approved material. Never execute transactions.
- **Org Admin:** invite/manage roles, users, policies; not able to bypass audit requirements.

## Initial five-step *assurance* loop
1. **Import:** Accept a synthetic or permitted exported plan, statements and explicitly entered facts. Capture source type, version, page/row and SHA-256 source hash.
2. **Reconcile:** Normalize each fact with unit, value type, owner, effective/as-of dates and source. Detect missing data, conflicting facts and stale dates; require acknowledgement.
3. **Verify:** Freeze a valid immutable input snapshot; calculate supported checks against versioned IRS/SSA rules and the independent engine. Do not overclaim verification coverage.
4. **Review:** Report differences classified as `SOURCE_CONFLICT`, `RULE_DISAGREEMENT`, `METHODOLOGY_DIFFERENCE`, `STALE_INPUT`, `MISSING_EVIDENCE`, `UNSUPPORTED_CHECK`, or `WITHIN_TOLERANCE`; allow reviewer notes and disposition.
5. **Archive:** Generate a reviewed evidence packet with source hashes, extraction confirmation, input snapshot id/hash, rule version, computation version, checks and results, reviews/approvals, timestamps, and explicit exclusions.

## MVP UI screens
1. **Marketing homepage:** Sample receipt and three jobs ('check a plan', 'find a discrepancy', 'document a review'), workflow diagram, limits, pilot interest CTA, no unsupported trust claims.
2. **Firm review queue:** Household, source tool, last update, status, exceptions, assignee; filters and sorting; source permissions.
3. **Household evidence view:** Four source fact states — CONFIRMED, ASSUMED, NEEDS_CONFIRMATION, CONFLICT — with source links and ownership/as-of information; material unresolved conflicts block snapshot freeze.
4. **Check result page:** 2026 age-74 IRA RMD case, reference factor, source balance, account type, relevant exception questions, discrepancy classification, written explanation and traceable run receipt.
5. **Approval and export:** Six possible checkpoints (imported, reconciled, frozen, checked, reviewed, approved/exported); draft vs approved with real identity/authority in authenticated mode; demo statuses synthetic.
6. **Optional scenario page:** Compare supported baseline vs alternatives with documented assumptions; no invented success probabilities or nonvalidated fan charts.

## Data states
`IMPORT_DRAFT -> MAPPED -> RECONCILIATION_PENDING -> BLOCKED|READY_TO_FREEZE -> FROZEN -> CHECK_COMPLETE -> REVIEW_PENDING -> REVIEWED -> APPROVED -> EXPORTED`.
- Resolve a blocking conflict with an explicit evidence-backed change to produce a *new* input revision, or an approved documented exception if firm policy allows; never silently mutate a frozen version.
- Review status and audit history are server authoritative, never merely UI styling.
- Exports correspond to exactly one immutable approved review version; re-exports log a separate event.
- Distinguish mathematical PASS from professional approval; PASS does not mean fit-for-client or compliant.

## Five-stage legacy vision: retained, reordered
| Original long-term advisory stage | V3 assurance role | MVP vs deferred |
|---|---|---|
| 1. Discovery & aggregation | Ingest independent documents, normalize facts, reconcile provenance | **P0:** synthetic CSV/JSON + manual facts; **Later:** secure permitted document/OCR/providers |
| 2. Accumulation modeling | Inspect plan assumptions and independently re-run supported basic formulas | **P1:** defined checks; **Later:** broad stochastic calibration |
| 3. Decumulation & cash flow | Verify IRA RMD and limited tax calculations; compare assumptions | **P0:** RMD; **P1:** scoped federal 2026 tax and annual ledger; **Later:** monthly withdrawal optimizer |
| 4. Predictive monitoring | Ruleset changes & book-wide affected households list | **P1:** fixture-based rule-diff event; **Later:** live ingestion & regulatory feed |
| 5. Estate & longevity | Validate beneficiary facts and exclusions; flag unsupported issues | **P1:** beneficiary schema and evidence flags; **Later:** estate/longevity computations |

## The central demo
Use fictional **Patel** household, a traditional IRA with verified prior-year Dec 31 balance of $640,000 and account owner's age 74 in tax year 2026. Under explicitly verified Uniform Lifetime Table eligibility, factor is 25.5 and computed RMD is **$25,098.04**. Show source, reference table, equation, cents rounding, rule version and run receipt. A conflicting *imported-plan RMD* is a separate synthetic figure and must be clearly labeled. Never imply all RMD rule conditions were inferred from age alone.

## Critical non-goals for MVP
- No 'full financial plan builder' replacing incumbent platforms.
- No portfolio trades, withdrawals, custodian integrations, money movement, or automated recommendation execution.
- No claiming secure, signed, live API integration with Income Lab, Hazel, RightCapital or eMoney unless separately established.
- No auto-approved recommendations, investment performance promises or 'compliance guaranteed' badge.
- No unvalidated Monte Carlo, multi-state tax, Social Security benefit estimator or independent estate-law advice.

## Acceptance criteria
- User can import synthetic plan CSV/JSON, map and confirm facts, expose a conflict, and see freeze disabled until resolved.
- User can inspect a traceable, deterministic RMD check and a failing/unsupported result with explanation.
- Two organizations cannot access each other's households or exports, enforced in DB and integration tests.
- A reviewer with appropriate role can record disposition and approve a valid packet; different role restrictions demonstrably enforced.
- A downloadable synthetic evidence packet includes input/rule/engine versions and exceptions, and clearly states its limitations.


---

# SECTION 4: 03_ARCHITECTURE_AND_DATA_SCHEMA.md


# V3 Engineering Architecture, Data Model, Security and API

## Stack decision
For a new repository: Next.js App Router, React, strict TypeScript, Tailwind, accessible component library, Vitest, Playwright, PostgreSQL/Supabase Auth with RLS, Vercel frontend deployment. Why: easy server-rendered public marketing pages and typed full-stack app, minimal deployment complexity. For an existing Vite/React/Supabase project: preserve it unless measured constraints justify migration. Never claim a migration is required for quantitative quality. Keep heavy simulations and document OCR off synchronous Vercel handlers. Under the founder decision, build a separately runnable **Python/FastAPI calculation and verification service from day one**, starting with the scoped RMD rule and Python tests. Add a queue and distributed workers for heavier tasks when needed. Do not duplicate authoritative financial math in React or Next.js.

## Bounded system
```text
Browser (Public / Firm Console / Restricted Demo)
  -> authenticated server endpoints with tenant-scoped authz
  -> Supabase Postgres with RLS, append-only event tables and object storage
  -> Import adapters: manual + explicit CSV/JSON schema (P0); vendor connectors later
  -> Fact resolver / typed verification / conflict detector
  -> Snapshot service (immutable content-hashed snapshot, fail-closed)
  -> Python/FastAPI independent financial checks (versioned deterministic functions; no LLM math)
  -> Run receipt + discrepancy report + human review state machine
  -> synthetic evidence packet export
Python/FastAPI is an approved initial service; future: async tax and simulation workers; approved OCR; monitored rule-publishing workflow; MCP read-only tools.
```

## Core relational schema (minimum viable)
`organizations(id,name,created_at)`
`profiles(user_id,display_name)`
`memberships(id,org_id,user_id,role,status)` roles ADMIN, COMPLIANCE, ADVISOR, ANALYST, VIEWER. Ownership/role resolution must take server session, never client-input-only org_id.
`households(id,org_id,label,status,created_at)`
`persons(id,org_id,household_id,display_name,birth_date_nullable,...)`
`accounts(id,org_id,household_id,account_type,tax_character,currency,opened_at_nullable)`
`account_ownership(id,org_id,account_id,person_id,ownership_type,percentage,effective_from,effective_to)`; constraint ownership percentages reconcile for supported categories and time slices; don't assume joint ownership implies equal economic percentages in all jurisdictions.
`beneficiary_designations(id,org_id,account_id,beneficiary_person_id_nullable,beneficiary_label_nullable,share_percentage,designation_type,effective_from,effective_to,source_fact_id_nullable)`; separate contingent and primary designations. Avoid assuming this data is dispositive of legal title.
`source_documents(id,org_id,household_id,source_kind,source_vendor_nullable,filename,sha256,storage_path_nullable,uploaded_at,source_as_of,parser_version)`
`source_locations(id,org_id,document_id,page_number_nullable,row_number_nullable,text_span_nullable)`
`facts(id,org_id,household_id,subject_type,subject_id,field_key,value_kind,value_number_nullable,value_text_nullable,value_date_nullable,value_bool_nullable,value_currency_nullable,unit_nullable,as_of_date,effective_from_nullable,effective_to_nullable,source_document_id_nullable,source_location_id_nullable,verification_status,created_at)`; enforce exactly one active typed value based on value_kind, numeric ranges, currency, and appropriate foreign keys. Avoid unconstrained JSON as the authoritative typed fact model.
`fact_conflicts(id,org_id,household_id,fact_group_key,materiality,status,reason,resolution_note_nullable,resolved_by_nullable,resolved_at_nullable)`
`conflict_fact_links(org_id,conflict_id,fact_id)`
`rule_sets(id,code,jurisdiction,tax_year,effective_from,effective_to,version,source_url,source_retrieved_at,checksum,status)`; never allow an unapproved draft rule into a released verification run.
`rule_parameters(id,rule_set_id,parameter_key,value_decimal_nullable,value_string_nullable,value_date_nullable,unit,source_locator)`
`assumption_sets(id,org_id,household_id,version,created_by,created_at,methodology_id_nullable)`
`assumptions(id,org_id,assumption_set_id,key,value_kind,value_decimal_nullable,value_text_nullable,unit,source_fact_id_nullable)`
`plan_imports(id,org_id,household_id,source_document_id_nullable,source_vendor,format_version,imported_at,parser_version,import_status)`
`imported_plan_values(id,org_id,import_id,metric_key,period_start_nullable,period_end_nullable,value_decimal,currency,methodology_label_nullable,source_location_id_nullable)`
`snapshots(id,org_id,household_id,revision,content_sha256,rule_set_id,assumption_set_id,created_by,created_at,status,canonical_payload_reference)`
`check_runs(id,org_id,snapshot_id,engine_version,rule_set_version,check_type,inputs_sha256,outputs_sha256,executed_at,run_status,unsupported_reasons_json,calculation_result_json)`
`discrepancies(id,org_id,check_run_id,imported_plan_value_id_nullable,category,severity,comparison_status,materiality_basis,delta_amount_nullable,description,status)`
`reviews(id,org_id,snapshot_id,reviewer_user_id,decision,rationale,conflict_attestation,reviewed_at)`
`evidence_packets(id,org_id,snapshot_id,review_id,generated_by,generated_at,sha256,packet_status,storage_path)`
`audit_events(id,org_id,actor_user_id_nullable,actor_type,event_type,entity_type,entity_id,created_at,previous_event_hash_nullable,event_hash,payload_digest,request_id)`

## RLS and authorization invariants
- All tenant-bound tables include `org_id`, with foreign keys and triggers/constraints preventing cross-org references; never rely only on client query filtering.
- RLS policies must gate reads/writes through authenticated `membership` and allowed action, with separate service-account maintenance paths. Client-provided organization IDs are checked against authenticated memberships.
- Tests: unauthorized/anon denied; Org A cannot read/update/export Org B; analyst cannot approve; viewer cannot edit; org admin cannot forge another user's review; forged account ownership reference rejected.
- `audit_events`, approved snapshots, completed check runs and approved packets are insert-only for ordinary application roles. DB privilege/triggers enforce immutability; separate retention/legal hold and approved redaction policy.
- No raw financial facts, source excerpts, authentication tokens or large client document content in ordinary application logs. Use event metadata/digests.

## Snapshot consistency
Canonicalize inputs in deterministic order and type serialization. Hash each source and canonical snapshot using SHA-256. Snapshot references rule_set version, assumptions, document hashes, ownership graph and evaluated value rows; record engine code commit hash. All evaluations are reproducible from an archive of *permitted* rule/config data. No prior output silently changes on later rule updates. A rule change creates a new impact analysis or run, not a rewrite of past results.

## Conflict and comparison semantics
- Source mismatch: multiple claimed account balances for same account and as-of time.
- Freshness: plan asset balance as-of date differs from statement as-of date; do not assume values must match across different dates.
- Rule: supported RMD law or tax rule mismatch for specified period.
- Methodology: different forward return assumptions, inflation, tax characterization, timing of cash flows; mark `NOT_COMPARABLE` until harmonized.
- Insufficient evidence: missing beneficiary age, account type or prior-year balance => `INDETERMINATE` (not failure).
- Scoping: vendor outputs may be summarized, rounded, unavailable or legally non-exportable; never claim universal certification of imported plans.
- Threshold: define user-facing absolute and relative comparison tolerances by check type, with review/validation; don't equate tolerance to legal exemption.

## API endpoints (illustrative)
`POST /api/imports` — upload permitted sample CSV/JSON + schema validation; return import record and mapping issues.
`GET /api/households/:id/facts` — fact provenance and conflict status.
`POST /api/households/:id/facts/confirm` — authorized fact confirmation; audit event.
`POST /api/households/:id/snapshots` — freeze only if material conflicts resolved and required facts complete; immutable.
`POST /api/snapshots/:id/checks/rmd` — validated deterministic check from frozen snapshot; idempotency key.
`GET /api/snapshots/:id/receipts/:runId` — source/rule/engine links and comparison status.
`POST /api/snapshots/:id/review` — authorized review status change; reason and conflict handling.
`POST /api/snapshots/:id/evidence-packet` — generate/download only according to policy and authorized identity.
`GET /api/organizations/:id/impact-preview?rule_set=...` — future authorized preview, no unsupported live feed in MVP.

Return typed `status` values and `unsupported_reasons[]` rather than guessed results. Use explicit error codes, request IDs, and sanitized logs.

## Fable coding conventions
Create `/apps/web/src/domain`, `/apps/web/src/import`, `/apps/web/src/provenance`, `/apps/web/src/auth`, `/apps/web/src/ui`, plus `/services/calculator/app` for authoritative Python financial rules and `/packages/contracts` for shared types; do not mix quantitative logic into React components. Keep a living `CLAUDE.md`, `docs/FINANCIAL_METHODOLOGY.md`, `.env.example`, migrations and tests. Use synthetic fixtures and no production-data ingestion in public demo.


## Founder-approved numerical service boundary (V3)
- Python/FastAPI is the **authoritative** calculation and rules-verification service for new development; Next.js renders results and performs firm workflow operations, not retirement math.
- Build `POST /v1/checks/rmd` accepting a server-authorized frozen-snapshot reference (or tightly controlled synthetic input in a test harness), returning typed verdict, calculation receipt, rule citations, engine/rules versions and unsupported reasons.
- Never trust a caller-provided org_id as authorization. Use a service-authenticated principal plus tenant-scoped lookup.
- Use Python `Decimal`, explicit cents rounding, `pytest`, independent golden fixtures and OpenAPI/consumer-contract tests.
- For development, run Next.js and FastAPI as two local processes or with Docker Compose; no need for cloud accounts or paid services. If service is down, show an honest error; do not silently invent calculation output.
- Queue/workers are planned for high-volume rule-change monitoring and future simulation workloads, not necessary to run the initial RMD check.


---

# SECTION 5: 04_FINANCIAL_RULES_AND_TEST_STRATEGY.md


# V3 Financial Rules and Model Validation
Date: 2026-11-05. Product is an *assurance prototype*, not a validated full tax or retirement model.

## Model hierarchy
1. **Document and source fact checks**: provenance, units, ownership, as-of consistency, arithmetic reconciliation.
2. **Deterministic, scoped checks**: one check at a time against approved rule sets (begin with owner IRA RMD).
3. **Reconciliation against imported vendor results**: only when both model coverage and normalization are sufficient; else `NOT_COMPARABLE`.
4. **Tax and cash-flow**: progressively expanded with external benchmarks and professional review.
5. **Stochastic projections and optimization**: deferred. First prove fidelity of a narrow production-relevant rule, then expand.

## First check: 2026 required minimum distribution
Relevant formula for a typical eligible owner-held traditional IRA:
`annual RMD = account value on December 31, 2025 / applicable distribution-period divisor for the owner in 2026`.
Uniform Lifetime Table III divisor for age **74 = 25.5** (IRS Pub 590-B).
Fictional Patel fixture: birthday establishing age 74 in 2026; traditional IRA owned by Patel; prior year Dec 31 balance **$640,000**; owner alive; no spouse sole beneficiary >10 years younger; not an inherited IRA; 2026 RMD year; no separately deferred prior-year RMD confounded with this amount. `640000 / 25.5 = 25098.039215...`, displayed with standard nearest-cent rounding as **$25,098.04**.

### Required eligibility checks
- Owner date of birth and calendar age, tax year, account category and inherited/beneficiary status.
- Prior December 31 balance with provenance; account and currency; adjustments if rules require.
- Spouse sole beneficiary / more-than-10-years-younger condition changes table selection.
- First RMD year / first-year April 1 timing; if the owner reaches 73 in 2025 and delays first RMD, **two separate deadlines** may occur in 2026. Do not collapse or merge them.
- Account-specific RMD aggregation exceptions; traditional IRA distribution and workplace plan rules differ.
- Special rules for inherited IRAs, designated Roth accounts, qualified annuities and certain plan owners, etc. Explicitly excluded from MVP; return `UNSUPPORTED` not a number.
- An annual amount does not establish an exact distribution *deadline*, required tax withholding, or execution suitability without separate rule checks.

### Tests
- Golden Patel arithmetic and full receipt.
- Missing year-end balance -> INDETERMINATE, freeze blocked if material.
- Spouse 11 years younger, sole beneficiary -> do not use 25.5 automatically; UNSUPPORTED until joint table encoded.
- Inherited IRA -> UNSUPPORTED.
- Age/annuity plan mismatch -> UNSUPPORTED.
- Two 2026 deadlines when first RMD delayed -> represent separate events.
- Account with an imported plan RMD of $24,000 (synthetic) -> discrepancy approx $1,098.04; flag rule mismatch only after normalized eligibility, not by assumption.
- Source balance mismatch (2025-12-31 vs 2026-09-30) -> date mismatch, not automatically a financial error.
- Cent rounding and decimal handling.
- Deterministic repeat outputs and version hashes.

## 2026 federal income tax V0: bounded scope
If this engine is added, support a clearly identified subset (e.g. federal ordinary income tax for single/MFJ, specified standard deduction and brackets with no credits, AMT, NIIT, Social Security taxability or state tax unless independently implemented). Never call the restricted arithmetic a complete federal tax computation; label it `base_tax_on_taxable_ordinary_income` and list exclusions. 2026 standard deduction: single $16,100; MFJ $32,200 per IRS. Source tables from Rev. Proc. 2025-32/IRB 2025-45, effective year 2026. Use explicit sample scenarios with hand-calculated progressive-tax brackets, then benchmark the same supported scenarios with independent calculation implementations. All unsupported income and deduction types must produce limitations/indeterminate.

## Independent validation strategy
- **Reference law:** relevant IRS Publication 590-B and FAQ for RMD, IRS Rev. Proc. tables for 2026 tax, SSA official effective-year language for WEP/GPO repeal. A publication or FAQ is not a blanket legal opinion.
- **Independent engines:** PolicyEngine-US and Policy Simulation Library Tax-Calculator are useful candidate cross-checks for supported tax calculations. Neither automatically proves business-correctness nor maps directly to every retirement question. Check licensing, versions, model coverage, and parameter definitions.
- **Golden fixtures:** document hand-worked equations, source URLs and rule dates; add independent CPA review/attestation in beta only when actually obtained.
- **Property testing:** RMD non-negativity; for fixed factor, monotonic in prior-year balance; deterministic hash; integer-cents outputs; rounding tolerance; no cross-year rule leakage.
- **Negative tests:** wrong factor, source conflict, missing owner, unverified rule, mismatched dates, unsupported account type, stale imported values and non-comparable vendor assumptions.
- **Coverage matrix:** every check returns `SUPPORTED_VERIFIED`, `SUPPORTED_UNVALIDATED`, `NOT_COMPARABLE`, `INDETERMINATE`, or `UNSUPPORTED`, with standardized reasons. Do not label anything externally 'verified' until test gate fulfilled.

## Later methodological disagreement taxonomy
- Account/balance facts and effective dates
- Tax law/rule version differences
- Withdrawal and contribution timing
- Investment return assumptions (arithmetic/geometric, nominal/real)
- Longevity horizons, spending and household death/survivor states
- Tax unit and jurisdiction
- Rounded vendor summary vs full underlying ledger
A discrepancy is not evidence of adviser error until comparable definitions, input provenance and methodology are established.

## Simulation communication
Defer until model validation. Future internal `success_fraction` may be exact for test repeatability; client-facing outputs must be qualified and banded when appropriate, with confidence in the underlying distribution and method assumptions. A modeled 80% success is not an 80% real-world guarantee. Differences inside simulation sampling error must be labeled immaterial/within noise, using actual convergence estimates rather than a fixed arbitrary threshold.

## Versioned rules and alerts
`RULES_PUBLISHED` is *not* an automatic untrusted internet event. New IRS/SSA/CMS parameters enter an authenticated draft register, source URI and checksum, reviewed by designated subject-matter owners, signed/approved and then published. Generate book-wide `possibly_affected` previews; only approved rules are eligible for re-runs. Changed statutes are effective-dated; a 2026 update must not silently rewrite an archived 2025 review.

## Verified references
- https://www.irs.gov/publications/p590b
- https://www.irs.gov/retirement-plans/retirement-plan-and-ira-required-minimum-distributions-faqs
- https://www.irs.gov/retirement-plans/plan-participant-employee/retirement-topics-required-minimum-distributions-rmds
- https://www.irs.gov/irb/2025-45_IRB
- https://www.irs.gov/newsroom/working-families-tax-cuts-individuals-and-workers
- https://www.ssa.gov/benefits/retirement/social-security-fairness-act.html
- https://policyengine.github.io/policyengine-us/
- https://www.policyengine.org/us/model/data/validation
- https://www.everycrsreport.com/reports/R49052.html


## V3 implementation ownership and sequencing
The first real calculation belongs in a separately runnable Python/FastAPI service with `Decimal` math, source-versioned rule tables and `pytest` fixtures. A **bounded 2026 federal ordinary-income base-tax calculator** is requested in the founder record, but is a P1 implementation after RMD and independent tests; if implemented, label unsupported credits, SS taxability, AMT, NIIT, capital-gain rates, QBI, state rules, and other exclusions. Do not hardcode legal thresholds without source, effective year and benchmark cases. The Next.js UI must not recompute results independently or pretend an incomplete tax check is complete.


---

# SECTION 6: 05_COMPLIANCE_PRIVACY_AI_SECURITY.md


# V3 Legal, Compliance, Security and AI Governance
Research date: 2026-11-05. U.S. launch hypothesis. Not legal advice, a security assessment, or proof of compliance.

## Regulation is activity-based
A paid B2B checker may be a technology vendor, but do not assume that its business model automatically avoids registration or obligations. The legal analysis turns on actual outputs, who can act on them, whether personalized securities advice is provided, compensation structures, marketing, custody/execution and relationships with regulated firms. Obtain a scoped written counsel review before real-client deployment.

## External regulatory anchors
- SEC fiscal 2027 examination priorities (Oct 23, 2026) emphasize adviser fiduciary duty, conflicts of interest and recommendations, operations, cybersecurity, and emerging technologies. These are priorities, **not product certification criteria**: https://www.sec.gov/newsroom/press-releases/2026-109-sec-announces-fiscal-year-2027-examination-priorities
- SEC Investment Advisers Act books-and-records rule, 17 CFR 275.204-2: relevant firms must preserve specified records in proper formats for applicable periods; vendor product 'packet' alone does not establish full compliance: https://www.law.cornell.edu/cfr/text/17/275.204-2
- SEC 2024 Regulation S-P amendments emphasize incident-response plans, reasonable oversight of service providers and protection of customer information; determine covered-institution and vendor obligations with counsel: https://www.sec.gov/file/regulation-s-p-small-entity-compliance-guide
- FINRA supervision/communications obligations may apply to broker-dealer customers; enterprise configurable retention/control may be required: https://www.finra.org/rules-guidance/notices/24-09
- The 2023 proposed SEC predictive-data-analytics conflicts rule was withdrawn June 2025; do not treat it as enacted law: https://www.sec.gov/rules-regulations/2025/06/s7-12-23

## Human oversight
A system CHECK_PASS means a specific implemented rule or calculation passed tests, not the household plan is appropriate or the client’s best interest has been met. The human advisor or designated compliance reviewer owns suitability/fiduciary judgment and review authority. No automated sign-off, no invented professional endorsement, no trading. An audit record records what was actually reviewed; no retrospective approval claims.

## Model and data governance
- Data minimization: use synthetic inputs in demos, selective source fields rather than full SSN or tax return unless genuinely needed. Do not collect sensitive identifiers for prototype onboarding.
- AI: no LLM as authoritative numerical engine. AI can suggest mapping, draft explanatory text, or summarize discrepancies *only* with typed tool outputs and source links. AI-suggested facts must remain unconfirmed until reviewed.
- Imported vendor outputs, PDFs, CSVs and OCR text are untrusted material. Implement prompt-injection resistance, file type/size validation, malware scanning before real-world uploads, safe parsing, schema validation and sandboxing.
- Tenant security: enforced in DB with RLS and foreign keys; tests using separate authenticated organizations; audit logs for sensitive access; no tenant identifiers trusted from browser alone.
- Real documents: consent, data-processing contracts, deletion/export rights, retention/legal-hold policy, encryption, incident response, key management, MFA, least privilege and vendor assurance required before opening pilots.
- LLM vendor privacy: **never claim** 'zero data retention' or 'will not train on your data' unless every relevant vendor's contractual terms and configuration justify it; no passwords/documents sent to LLM by default. **Model-specific finding:** Anthropic currently documents a 30-day data-retention requirement for Claude Fable 5.1 and says zero data retention is generally unavailable absent express authorization; Anthropic describes limited eligible enterprise exceptions and Enterprise Frontier Safeguards. Verify account-specific terms before any real-data use. Do not send authentic client financial documents or PII through this development model without a separately approved contractual/privacy review. Source: https://platform.claude.com/docs/en/models/fable-5-1/whats-new-fable-5-1
- Security certifications: never claim SOC 2 Type II, ISO certification, bank grade, compliance approved, SEC registered, or examiner certified without evidence.
- Retention: avoid promising 5 years for the vendor universally; regulated customer legal retention and contracts may differ. Ensure export/immutability/portability can support a customer-configured retention policy.

## Evidence packet language
Use: 'Review packet with source references, recorded assumptions, rule-set versions and reviewer actions.'
Avoid as public claims prior to review: 'exam-proof', 'SEC-compliant', 'audited', 'certified', 'no errors', 'guaranteed fiduciary protection'.

## Release gates
**Prototype:** synthetic only, no production secrets or external execution. Required: unit/integration tests, threat-model notes and data classification.
**Design partner sandbox:** firm-approved synthetic/anonymized data only, signed permission, security review and documented use limitations.
**Real-client pilot:** counsel perimeter memo, DPA, security risk assessment and validated supported calculations; incident response and access control tests; review protocol; approved provider subprocessors.
**Public commercial release:** independent model validation, service legal terms and contract, acceptable security posture, regulated communications approved, billing/reporting controls and monitored operational runbook.


## V3 commercial boundaries
SageSpan is provisionally a firm-paid software vendor, **not** a licensed investment advisor merely by naming or labeling. Counsel must assess actual functions and statements before client use. Pricing is a hypothesis, not a compliant sales offer until contracts and buyer scope are ready.


---

# SECTION 7: 07_SOURCES_AND_CLAIM_REGISTER.md


# V3 Sourcebook and Claim Register
Checked 2026-11-05. Public pages are snapshots; prices and features can change. Primary sources preferred; do not treat competitor marketing as independently validated performance.

## Verified primary regulatory/math sources
- SEC FY2027 priorities announced October 23, 2026: https://www.sec.gov/newsroom/press-releases/2026-109-sec-announces-fiscal-year-2027-examination-priorities
- SEC advisers' books and records (rule text via Cornell, verify with eCFR): https://www.law.cornell.edu/cfr/text/17/275.204-2
- SEC Regulation S-P guide: https://www.sec.gov/file/regulation-s-p-small-entity-compliance-guide
- FINRA generative AI guidance: https://www.finra.org/rules-guidance/notices/24-09
- IRS Uniform Lifetime Table (age 74 divisor 25.5): https://www.irs.gov/publications/p590b
- IRS RMD FAQ, dates, exception factors: https://www.irs.gov/retirement-plans/retirement-plan-and-ira-required-minimum-distributions-faqs
- IRS RMD deadlines: https://www.irs.gov/retirement-plans/plan-participant-employee/retirement-topics-required-minimum-distributions-rmds
- IRS 2026 federal brackets, deductions: https://www.irs.gov/irb/2025-45_IRB
- IRS 2026 plain-language tax figures: https://www.irs.gov/newsroom/working-families-tax-cuts-individuals-and-workers
- SSA Social Security Fairness Act WEP/GPO repeal signed Jan 5 2025, effective Jan 2024: https://www.ssa.gov/benefits/retirement/social-security-fairness-act.html

## Competitive sources, direct
- Income Lab Penny Verify/features and price: https://incomelaboratory.com/penny/ and https://incomelaboratory.com/pricing/
- Altruist Hazel Sept 1 planning launch: https://altruist.com/news/altruist-introduces-ai-powered-financial-planning-in-hazel-helping-advisors-build-personalized-financial-plans-in-minutes/
- Vanguard **agreement to acquire** Altruist announced Aug 26 2026, not necessarily completed: https://corporate.vanguard.com/content/corporatesite/us/en/corp/who-we-are/pressroom/press-release-vanguard-announcement-082626.html
- Anthropic Claude for Financial Advisors Sept 14 2026: https://claude.com/blog/claude-for-financial-advisors
- Conquest 2026 MCP and verified engine announcement: https://conquestplanning.com/media/conquest-planning-previews-next-chapter-of-compliance-first-ai-innovation
- Conquest current verifiable engine/enterprise governance: https://conquestplanning.com/platform
- Wealth.com governance and deterministic math claims: https://www.wealth.com/ai-governance/
- Wealth.com combined tax and estate 2026 expansion: https://www.wealth.com/resources/press/wealth-com-launches-tax-planning/
- RightCapital pricing: https://www.rightcapital.com/pricing/
- ProjectionLab pricing: https://projectionlab.com/pricing
- Holistiplan annual/household tier structure: https://www.holistiplan.com/pricing/

## Brand evidence (separate names; do not conflate)
- The **prior PLUMBLINE** codename has existing use by banking/loan servicing software: https://plumbline.fyi/
- A **PLUMBLINE** trademark application (not SageSpan) filed Sep 30, 2026 appears in a third-party registry: https://trademarks.justia.com/501/37/plumbline-50137913.html
- The provisional **SageSpan** name may face issues with established SAGE marks in software/financial business services; no complete live clearance has been performed and no exact clash is established here. Official USPTO search: https://www.uspto.gov/trademarks/search

## Candidate model validation resources
- PolicyEngine US framework: https://policyengine.github.io/policyengine-us/
- PolicyEngine TAXSIM comparison methodology: https://www.policyengine.org/us/model/data/validation
- Tax-Calculator: https://github.com/PSLmodels/Tax-Calculator
- CRS July 30 2026 comparison of open tax models: https://www.everycrsreport.com/reports/R49052.html

## AI/model-specific source
- Fable 5.1 Anthropic model reference: https://platform.claude.com/docs/en/models/fable-5-1/overview
- Fable 5.1 model-specific retention: Anthropic states a 30-day retention requirement and no default zero data retention absent express authorization: https://platform.claude.com/docs/en/models/fable-5-1/whats-new-fable-5-1
- Claude Code selection `/model`, model ID `claude-fable-5-1`: https://support.claude.com/en/articles/11940350-claude-code-model-configuration

## Claim confidence / permitted language
| Candidate claim | Evidence status | Safe phrasing |
|---|---|---|
| Independent verification is an open market gap | HYPOTHESIS | 'We are testing whether firms need independent cross-tool assurance.' |
| Income Lab has verifiable AI math | VENDOR-CONFIRMED | 'Income Lab markets one-click AI response verification.' |
| Conquest has API, verifiable engine and MCP | VENDOR-CONFIRMED | 'Conquest already markets these capabilities.' |
| SageSpan is legally cleared for fintech | NOT CLEARED | 'SageSpan is the provisional working brand; trademark clearance pending.' |
| Household-based price is optimal | UNTESTED | 'Household-based fee with firm minimum is one pricing hypothesis.' |
| Patel 2026 annual IRA RMD $25,098.04 | CONDITIONAL MATH VERIFIED | 'For the specified age-74 Uniform Table IRA assumptions, $640,000 / 25.5 = $25,098.04.' |
| Exam-ready certified review packet | NOT ESTABLISHED | 'Downloadable, traceable review evidence packet; compliance requirements require firm and counsel review.' |
| SOC 2 / ZDR / AI doesn't train | NOT ESTABLISHED FOR OUR PRODUCT | Make no claim until approved contracts and audits exist. |
| Vendor interoperability | NOT ESTABLISHED | 'Sample CSV/JSON import in demo; named vendor connections under evaluation.' |
| Guaranteed retirement outcomes or optimality | UNSUPPORTED | 'Illustrative modeling subject to explicit assumptions and limits.' |


## V3 supplemental primary sources
- SEC FY2027 exam priorities (published October 23, 2026): https://www.sec.gov/newsroom/press-releases/2026-109-sec-announces-fiscal-year-2027-examination-priorities
- IRS Uniform Lifetime Table (2025 Pub 590-B): https://www.irs.gov/publications/p590b
- IRS 2026 inflation adjustments and federal brackets: https://www.irs.gov/irb/2025-45_IRB
- IRS 2026 standard deduction: https://www.irs.gov/newsroom/working-families-tax-cuts-individuals-and-workers
- SSA WEP/GPO repeal applicable to benefits payable after 2023: https://www.ssa.gov/legislation/legis_bulletin_010624.html
- Anthropic Fable 5.1 model and privacy: https://platform.claude.com/docs/en/models/fable-5-1/whats-new-fable-5-1 and https://platform.claude.com/docs/en/manage-claude/api-and-data-retention
- USPTO search and clearance instructions: https://www.uspto.gov/trademarks/search

## V3 naming claims
The founder-proposed name is **SageSpan**, provisionally. Possible conflicts with SAGE software marks must be evaluated by counsel (federal, state and common-law), not decided based on an assistant search. The earlier Plumbline codename also has existing financial-software use. Do not purchase premium branding or assert trademark rights until clearance.


---

# SECTION 8: 09_PRICING_GTM_90_DAY_GATES.md


# SageSpan V3 — Go-to-Market, Pricing, Interviews and 90-Day Gates
**Status:** research/pilot plan, not measured demand or a forecast.

## ICP and buyer discovery
Target 15–25 structured interviews across a minimum of five different firms. Cover CCOs, managing partners or owners, COOs, planning directors and operations reviewers; include advisors who use Income Lab, RightCapital, eMoney, MoneyGuide or similar. Do not assume these firms can export fully normalized data or that one individual controls buying.

Ask: which outputs are produced; which plan and account fields are exportable with contractual permission; how balances/as-of dates are verified; which assumptions are lost in exports; frequency, severity and cost of errors; whether a second opinion would save time or create false alarms; what is actually retained in the compliance file; who owns budget/security approval; how often rules change and how changes are evaluated across a book; pricing willingness to pay; how many active monitored households exist.

## Pricing experiment
**Primary hypothesis:** $750/month/firm including 100 active monitored households + $3.50/month/household above 100. Limited pilots at $500/month covering up to 50 households. Authorized firm seats included in pricing hypothesis. Sales pages should state **Illustrative / proposed pricing, not yet a live offer**.

Competing hypotheses: (1) $500–$1,500 platform minimum + per completed review/run; (2) fixed compliance team license with household cap; (3) implementation/onboarding project fee, supported by observed integration complexity. No AUM fees or advisor seat fees in baseline. Compare alternatives in pilot proposals rather than asserting household pricing wins.

## Exact pricing formula and examples
`revenue_per_firm_per_month = 750 + (3.50 × max(0, active_households - 100))`.
Examples: H=50 => $750 (standard); H=100 => $750; H=250 => $1,275; H=500 => $2,150; H=1,000 => $3,900. Pilot $500 is a separately agreed limited arrangement, not an automated discount applied to the standard formula. Historical 70–95% gross-margin estimates from the first framework are **not validated** and must not enter forecasts as facts.

## Practical commercial sequence
**Days 1–15:** conduct initial interviews, capture 3–5 real (but privacy-safe) export format samples/field maps if permitted; present synthetic demo and obtain preliminary budget owners. Counsel consult; source/coverage registry.
**Days 15–30:** build core typed schema, scoped imports, auth and RLS; repeat interviews with interactive conflict workflow; define benchmark protocols.
**Days 30–45:** RMD verified prototype, receipts, discrepancy class; obtain feedback on false-positive tolerance.
**Days 45–60:** review queue, export packet, prototype book-wide rule update event; map at least two export schemas using only permitted non-sensitive fixtures.
**Days 60–90:** security/legal/tax expert check; select five structured pilot prospects; seek written paid commitments, subject to being ready for a legally and technically permitted pilot.

## Measurement and decision gates (hypotheses)
| Metric | Test threshold | Interpretation |
|---|---|---|
| Buyer discovery | 15–25 interviews | If problem infrequent, narrow ICP/job-to-be-done. |
| Pilot candidates | 5 structured firms | If hard to recruit, revisit channel and value claim. |
| Willingness to pay | At least 2 of 5 sign written paid pilot commitments by day 90, if legal/security ready | If less, investigate pain, pricing, workflow friction; don't claim proof of failure. |
| Import feasibility | At least 2 real vendor/source **formats** demonstrably mapped by legal, privacy-safe test fixtures | Without: limit scope and compatibility claims. |
| Review time | >25% improvement without loss of correctness, versus documented current process, is target | If not met, simplify workflow/avoid unnecessary steps. |
| RMD golden coverage | 100% scoped independent golden and negative tests passing | Release blocker. |
| Tenant data separation | 0 unauthorized cross-org reads/writes/exports in test suite | Release blocker. |
| Conflict gate | 100% material unresolved conflicts block snapshot freeze unless a defined valid authorized exception | Release blocker. |
| Qualified findings | Measure material/false-positive/not-comparable rates | Product value depends on actionable, trusted findings, not total alert count. |
| Review adoption | Named authorized reviewers complete evidence-backed dispositions | If manual duplication is high, redesign. |

## Staffing and budget
Identify accountable founder/CTO, fractional RIA counsel, CPA/tax reviewer, security engineer, domain advisor/CFP design partners and product/UX QA. Obtain quotes and model three cost cases: `legal + accounting validation + engineering + hosting + security + research incentives + insurance + third-party data licensing + contingency`. Do not promise that all roles are zero-cost or that an unstaffed 90-day launch can serve real regulated client data.

## Legal sequence
Prototype (synthetic) → reviewed design-partner sandbox (authorized/anonymized only) → real-data beta after counsel/DPA/controls/independent tests → public release after actual operational security, retention, contract and incident response practices are in force. Do not interpret the 90-day commercial milestone as permission to skip these gates.


---

# SECTION 9: 10_CHANGELOG_V1_V2_V3.md


# SageSpan V3 — Reconciliation and Change Log
**Baseline:** 2026-11-05. Project documents superseded: original AI Retirement Advisory framework (V1); Plumbline assurance research and V2 pack; SageSpan founder decision memo supplied as `Pasted text.txt`.

| Dimension | Original V1 | Interim Plumbline V2 | Canonical SageSpan V3 |
|---|---|---|---|
| Name | SageSpan candidate | Plumbline internal codename | **SageSpan provisional**, trademark review required; Plumbline archived. |
| Product | Five-stage B2C/B2B advisor operating system | B2B independent plan assurance | **B2B assurance first**; five-stage framework is long-term capabilities map. |
| Customer | Individual investors, advisors and institutions | RIA compliance and lead advisor | **RIA firm**; CCO champion, owner/CEO/COO economic buyer, lead advisor adoption. |
| Competitive moat | AI + auditable math + tax optimizer | Cross-tool check + record, API/MCP | Source fidelity + independent scoped calculations + proven interoperability + practical supervisory outcomes **as hypothesis**; MCP alone not differentiator. |
| Pricing | Individual B2C subscription and advisor seat | Household/firm pricing experiment | **$750 minimum with 100 households, +$3.50 over 100, $500 paid pilot up to 50** (unvalidated hypotheses). |
| App stack | Next.js/Vite ambiguous, Python optional | Preserve existing repo; Next.js greenfield; Python later | **Next.js target and Python/FastAPI service from day one**. Preserve useful Vite assets and migrate safely if required. |
| Calculation | Broad stochastic planning and all-year tax optimizations | Scoped RMD with optional limited tax | **Python RMD P0**, bounded 2026 federal ordinary-income tax v0 P1; no fabricated full tax engine. |
| Evidence | Client financial graph, projections and reports | Typed facts, conflict block, hashes, review | Retain V2's normalized schema, immutable snapshots, review states and signed-off human action. |
| Data | Assume open banking/ingestion | Synthetic samples; integrations deferred | **Synthetic samples only** until privacy/vendor/legal gates; at least two verified export-format feasibility tests before broad compatibility promises. |
| Security | Aspirational SOC2/ZDR | No unsupported trust claims | Strict RLS and legal claims controls; Anthropic Fable 5.1 model-specific 30-day default retention with explicitly authorized exceptions only. |
| GTM | Generic B2C/B2B commercialization | 15–25 interviews, five pilots | **Same validation gates** plus defined paid/usage price points and firm buyer committee. |

## Contradictions deliberately resolved
- **Do not** use 'Plumbline' as the product brand, although its audit remains a source document. External Plumbline naming conflicts refer to the **old** name, not evidence of an exact SageSpan conflict.
- **Do not** make Python a someday possibility. V3 explicitly starts a separately runnable FastAPI numerical service while deferring a complex queue/worker deployment until needed.
- **Do not** treat illustrative tax arithmetic as complete 2026 tax compliance. If P1 cannot be completed with benchmark tests, expose it as unsupported and document why.
- **Do not** treat CCO as the only buyer. Firm owner/CEO/COO typically controls economic decision; verify in discovery.
- **Do not** present suggested pricing or 80–90% gross margins as validated. No production payments until authorized.
- **Do not** equate a calculation match with verified overall financial-plan quality or fiduciary approval.
- **Do not** report a live Altruist/Income Lab/RightCapital/eMoney integration merely because a user uploaded a CSV with that vendor name.
- **Do not** imply a finance-sector SaaS product can be called 'SEC-certified' because it exports a review packet.

## Outstanding founder and professional gates
- Authorize trademark search, clear suitable domain, and choose legal entity.
- Conduct actual RIA interviews, decide first source formats, obtain vendor permissions.
- Define scoped compliance requirements with qualified counsel and a professional reviewer.
- Confirm vendors, retention terms, actual production security posture, and expert-validated financial rule library.
- Approve contract, pricing, pilot limits, and policies before live-client beta.

## Current authorized scope
**Proceed with synthetic-data engineering of the end-to-end assurance vertical slice.** External live launch, real-customer ingestion, payments, advice, account actions and audit/compliance warranties are not authorized by this document.


---

# SECTION 10: 06_CLAUDE_PROJECT_INSTRUCTIONS.md


# CLAUDE PROJECT INSTRUCTIONS — SAGESPAN V3 (PASTE INTO PROJECT INSTRUCTIONS)

Act as the founding CTO, financial modeling engineer, fintech security architect, senior product designer, RIA compliance workflow strategist and evidence-led business analyst for **SageSpan**, a **provisional** working brand for an independent retirement plan assurance and supervisory intelligence platform.

**This V3 specification supersedes the original consumer-facing five-stage robo-advisor plan and the intermediate Plumbline V2 build directions.** Interpret any older contradictory instructions through the SageSpan V3 founder decisions. All source documents remain research references, not new conflicting requirements.

## Primary mission
Build a firm-paid B2B system that reviews plans authored in existing financial planning software, not a replacement for that software. Import explicitly supported plan exports and financial evidence, normalize typed household facts, surface source conflicts and missing/dated facts, independently check a narrow set of financial rules, classify differences, require authorized human oversight, and create reproducible review evidence records. The promise is traceable checking **within a disclosed scope**, not that a retirement plan is guaranteed correct or fiduciary-approved.

## Adopted decisions
1. **Working name:** SageSpan, pending federal/state/common-law trademark and domain clearance. Keep brand assets and text configurable; do not assert rights to the name.
2. **Category:** independent retirement plan assurance. The original five-stage advisory lifecycle remains a long-term domain map, not a mandate for consumer robo-advisory launch.
3. **Business model:** U.S. RIA firms first, approximately 5–50 advisors; CCO is a compliance champion, CEO/owner/COO is the expected economic buyer, lead advisor/planning director validates adoption. The buyer must be verified by interviews.
4. **Architecture:** approved greenfield stack is Next.js App Router/React/strict TypeScript/Tailwind on Vercel, Supabase/PostgreSQL/Auth/RLS, and an independent, separately runnable **Python/FastAPI financial calculation service from day one**. Use decimal-safe math, approved effective-dated rules and pytest golden cases. Add queues and workers later when workload justifies them. Preserve useful existing repo code; migration requires safe/non-destructive handling.
5. **Pricing hypothesis:** $750/month/firm including 100 active monitored households, $3.50/month per additional active monitored household; limited paid pilots $500/month up to 50 households. Mark pricing illustrative and unproven until paid commitments; no live billing in synthetic MVP.

## Firm assurance workflow
`IMPORT_DRAFT -> MAPPED -> RECONCILIATION_PENDING -> BLOCKED | READY_TO_FREEZE -> FROZEN -> CHECK_COMPLETE -> REVIEW_PENDING -> REVIEWED -> APPROVED -> EXPORTED`.
- Material source conflicts and missing required facts must block freeze or require a policy-allowed, authorized, documented exception.
- Frozen snapshots are immutable, canonically serialized and SHA-256 hashed, recording source hashes, rule version, assumption version, ownership and engine commit.
- A computation PASS is **not** an adviser/compliance approval; never automatically sign or approve.
- Different methodologies can produce legitimate differences; include `METHODOLOGY_DIFFERENCE`, `NOT_COMPARABLE`, `MISSING_EVIDENCE`, `UNSUPPORTED_CHECK` and `INDETERMINATE` results.
- Exports must identify scope and unsupported checks. 'Review evidence packet' is approved wording; 'SEC-certified' or 'exam-proof' is not.

## First build and golden case
Create an authenticated firm application plus conspicuously labeled synthetic demo. For the fictional Patel IRA owner age 74 in 2026, eligible for the Uniform Lifetime Table, prior-year (2025-12-31) IRA balance $640,000 and factor 25.5, reproduce annual RMD `$25,098.04` in Python with complete source, date, formula, assumptions, rule and run receipt. Compare with a *synthetic external imported* $24,000 and classify the $1,098.04 difference after checking comparability. Add a material balance conflict that prevents freeze and a review trail after authorized resolution.

Do not compute this case using 25.5 when inherited-IRA, younger-spouse sole beneficiary, workplace-plan, missing age/balance or other unsupported conditions invalidate the simple Uniform Table scenario. Represent first-year deferred payment separately if relevant; never assume an annual RMD implies the exact due date without rules.

A 2026 federal **ordinary-income base tax** v0 is a bounded secondary task after RMD. Do not call it complete return calculation; publish the exact supported filing statuses, deductions and exclusions, independently benchmark fixtures, and return `UNSUPPORTED` for unhandled Social Security taxation, credits, AMT, NIIT, capital gains and state taxes.

## Data and security
Use normalized Organization/Membership/Household/Person/Account/AccountOwnership/Beneficiary/SourceDocument/SourceLocation/TypedFact/Conflict/RuleSet/RuleParameter/AssumptionSet/Snapshot/CheckRun/Discrepancy/Review/EvidencePacket/AuditEvent tables. Every tenant-bound row, reference and export must be protected by database row-level security plus server-side permission checks. Analysts cannot approve; reviewers cannot forge identities. Store immutable content digests and append-only audit events. Real document use requires privacy/counsel/security gates.

Imported CSV/PDF/documents can be malicious or misleading. Validate schemas, limit file size and type, sanitize CSV exports, prevent prompt injection, avoid raw personal data in logs, and never trust incoming `org_id` as authority. AI may summarize authoritative tool outputs but never be the calculator, legal source, final supervisor or provider of invented account data.

Fable 5.1 usually requires 30-day data retention unless specifically authorized otherwise; **use synthetic data only in Claude Code** and do not market zero data retention or no training without documented vendor terms. No false claims of registration, SOC 2, guaranteed correctness, universal integrations, money movement, or fiduciary automation.

## Research rigor
Prefer primary sources (IRS/SSA/SEC/FINRA/CMS, official vendor documentation), identify the publication date/effective tax year, separate verified facts from estimates and hypotheses, and maintain a claim register. The SEC FY2027 priorities are not a certification framework; Conquest already advertises headless verifiable math and MCP, and Income Lab already markets financial AI verification. Do not claim 'first in market' without proof.

## Required engineering behavior
Inspect repo and V3 context before writing. Make a concise P0/P1/P2 plan, then implement real working software rather than stopping at mockups. Maintain documented migrations, test fixtures, OpenAPI contracts, Python tests, TypeScript validation, RLS cross-tenant tests, browser smoke tests, README, `CLAUDE.md`, architecture, financial methodology, security limitations, and roadmap. Run lint, typecheck, pytest, unit tests, build, and browser tests when possible. State exact tests that ran; don't invent outcomes or pretend credentials/provider integrations exist.

## Commercial validation and gatekeeping
Work toward 15–25 firm buyer interviews, five structured pilot candidates, and a hypothesis of at least two signed paid pilot commitments by day 90 *if* legal/security readiness permits. Test source importability from at least two actual source formats, review-time improvement, false-positive rate, authorizations and material finding utility. If gates fail, recommend an evidence-led scope/pivot; do not chase features to disguise weak demand.

**The immediate engineering milestone is a functional, traceable, synthetic `import -> reconcile -> freeze -> RMD check -> compare -> human review -> export` vertical slice, with authoritative Python calculations and demonstrably enforced tenant separation.**


---

# SECTION 11: 08_FABLE_5_1_BUILD_KICKOFF.md


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


---

**End of SageSpan V3 canonical source.** Older project instructions are superseded wherever they conflict.
