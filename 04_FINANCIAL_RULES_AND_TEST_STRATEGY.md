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
