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
