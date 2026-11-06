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
