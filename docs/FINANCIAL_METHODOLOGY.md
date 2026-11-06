# Financial methodology

Status: prototype, synthetic data only. This document describes exactly what the
calculation service computes, from which sources, and what it refuses to compute.
It is not tax or legal advice and has not been reviewed by a CPA or counsel.

## Service boundary

* All retirement arithmetic lives in `services/calculator` (Python, FastAPI).
  The web application never computes authoritative financial outputs; it builds
  a request strictly from a frozen snapshot, calls `POST /v1/checks/rmd`, verifies
  the returned `request_hash`, and renders the receipt.
* All arithmetic uses `decimal.Decimal` with precision 34. Money is rounded once,
  at the end, to cents with `ROUND_HALF_UP`. Floats never enter the computation.
* Every run returns a receipt: engine name and version, canonical request hash,
  deterministic run hash, rule-set ids, versions, checksums and sources, the
  inputs used, the formula, and the limitations.

## P0: lifetime RMD for an owner-held traditional-family IRA

### Supported scope (`SUPPORTED_VERIFIED` when all cited rule sets are PUBLISHED)

| Condition | Requirement |
|---|---|
| Account type | `TRADITIONAL_IRA`, `SEP_IRA` or `SIMPLE_IRA` |
| Ownership | one living owner; not inherited |
| Distribution year | tax year ≥ 2022 (Uniform Lifetime Table effective 2022-01-01) |
| Balance | prior year-end balance, as of exactly 31 December of the year before the tax year, in USD |
| Beneficiaries | designation recorded; if the spouse is the sole primary beneficiary for the entire year, the spouse's birth date is required |
| Joint table | if the sole-primary spouse is more than 10 years younger (attained ages in the tax year), the Joint Life and Last Survivor table governs and the check returns `UNSUPPORTED` |

### Formula

```
annual RMD = prior year-end balance / Uniform Lifetime Table factor(attained age in tax year)
rounded ROUND_HALF_UP to cents
```

Golden case (synthetic Patel household): `640000.00 / 25.5 = 25098.039215… → $25,098.04`
(owner born 1952-03-14, attained age 74 in 2026, factor 25.5).

### Rule sets (`services/calculator/app/financial/rules.py`)

| Rule set | Version | Status | Sources |
|---|---|---|---|
| `rmd.uniform_lifetime_table` | 2022.1 | PUBLISHED | IRS Pub 590-B Appendix B Table III; Treas. Reg. 1.401(a)(9)-9 (T.D. 9930) |
| `rmd.applicable_age` | 2023.1 | PUBLISHED | SECURE 2.0 Act §107; IRC 401(a)(9)(C)(v); Pub 590-B |
| `rmd.required_beginning_date` | 2023.1 | PUBLISHED | IRC 401(a)(9)(C); Pub 590-B |
| `rmd.spouse_joint_table_eligibility` | 2022.1 | PUBLISHED | Pub 590-B; Treas. Reg. 1.401(a)(9)-9 (Table II not implemented) |
| `rmd.comparison_tolerance` | 1.0 | PUBLISHED | firm policy parameter, bounded |
| `tax.federal_ordinary_income` | 2026.0-draft | DRAFT | Rev. Proc. 2025-32 (not exposed by any endpoint) |

Each rule set has a SHA-256 checksum over its canonical content. Receipts cite
the checksum used, so a later table edit is detectable.

### Applicable age bands (SECURE 2.0 §107)

| Born | Applicable age | First distribution year |
|---|---|---|
| before 1949-07-01 | 70½ | year of the 70½ birthday |
| 1949-07-01 to 1950-12-31 | 72 | birth year + 72 |
| 1951-01-01 to 1959-12-31 | 73 | birth year + 73 |
| 1960-01-01 or later | 75 | birth year + 75 |

### Obligation events are kept separate

* The tax-year RMD is an `ANNUAL_RMD` event. Its deadline is 31 December of the
  tax year, or 1 April of the following year when the tax year is the first
  distribution year.
* When the tax year is the year after the first distribution year, a separate
  `DEFERRED_FIRST_YEAR_RMD` event is reported: `COMPUTED` from the balance as of
  31 December two years before (factor for attained age − 1), `INDETERMINATE` when
  that balance or the election is not recorded, or `REPORTED_SATISFIED_UNVERIFIED`
  when the facts say the first-year amount was taken in the first year. The
  engine never adds the two amounts together and never verifies distributions
  actually taken.

### Typed non-results

| Status | When |
|---|---|
| `NOT_REQUIRED` | owner is below the applicable age in the tax year |
| `UNSUPPORTED` | inherited account; deceased owner; Roth IRA; employer plan; non-USD; rollover add-backs; sole-primary spouse more than 10 years younger |
| `INDETERMINATE` | missing birth date, living status, account type, inherited flag, year-end balance, beneficiary designation, sole-beneficiary status or spouse birth date; balance as-of date is not the required year-end |

A balance as of a different date is reported as `BALANCE_AS_OF_MISMATCH` with
text that says it is not evidence of an error.

## Comparison with an imported plan value

The comparison runs only when the independent check is `SUPPORTED`, in this order:

1. No imported value → `MISSING_EVIDENCE` (not comparable).
2. Different tax year, non-USD, aggregate/other scope, or projected balance basis → `NOT_COMPARABLE`.
3. `|computed − imported| ≤ max(absolute, relative × computed)` → `WITHIN_TOLERANCE`.
4. Declared input balance differs from the confirmed year-end balance → `STALE_INPUT` if its as-of date is older, otherwise `SOURCE_CONFLICT`.
5. Declared factor differs from the table factor → `RULE_DISAGREEMENT`.
6. Declared method other than direct division → `METHODOLOGY_DIFFERENCE`.
7. No declared inputs at all → `MISSING_EVIDENCE` (comparable, but not attributable yet).
8. Otherwise → `RULE_DISAGREEMENT`.

Default tolerance is $1.00 absolute or 0.1 % relative, whichever is larger; a
firm may tighten it, and requests above $25.00 / 1 % are clamped to those bounds.
Tolerance is a review convenience, not a legal exemption.

## Fact reconciliation (web tier, non-authoritative)

* Facts from custodian statements, custodian profiles and beneficiary forms are
  `FACT_CONFIRMED`; facts from planning-tool exports are `NEEDS_CONFIRMATION`
  until corroborated by a primary source; explicitly recorded assumptions are
  `FACT_ASSUMED` and must carry a written basis.
* Static facts (birth date, account type, inherited flag, beneficiary status)
  conflict whenever two sources disagree. Time-varying facts (balances) conflict
  only for the same as-of date; different dates are recorded as a freshness note.
* Material conflicts must be resolved toward primary evidence (a COMPLIANCE user
  may override with rationale). Nonmaterial conflicts may be carried by a
  documented exception when firm policy allows.
* Snapshot freeze is fail-closed: open conflicts or missing required material
  facts block it. The snapshot is canonical JSON, sorted keys, SHA-256 hashed.

## P1 draft: 2026 federal ordinary-income base tax

`services/calculator/app/financial/tax2026.py` implements
`base_tax_on_taxable_ordinary_income` for SINGLE and MARRIED_FILING_JOINTLY with
the 2026 standard deduction ($16,100 / $32,200) and bracket tables transcribed
from Rev. Proc. 2025-32. It is a DRAFT rule set: not exposed by any endpoint,
covered by hand-computed unit tests only, and its `not_supported` list names
capital-gain rates, Social Security taxation, AMT, NIIT, QBI, the additional
senior deduction, itemized deductions, credits, phase-outs and state tax. Before
publication the tables must be re-verified against the IRB and benchmarked
against an independent implementation (PolicyEngine-US or Tax-Calculator).

## Test evidence

* `services/calculator/tests` (pytest): golden Patel case, rounding, monotonicity,
  as-of mismatch, younger-spouse joint-table refusal, inherited refusal, missing
  inputs, applicable-age bands, deferred first-year separation, classification
  matrix, tolerance clamping, receipt determinism, API auth/tenant header,
  OpenAPI drift.
* `packages/contracts/test` (vitest): Zod mirror validates the engine's actual
  output; canonical hashing agrees byte-for-byte with Python.
* `apps/web/src/domain/__tests__` (vitest): end-to-end workflow with a mocked
  engine, and a live integration test that re-derives the engine's request hash.

Verified means internal golden-test coverage. No external CPA attestation exists.

## Personal engines (V5, `personal.*` methodology sets)

**Cash-flow baseline (`personal.cashflow_baseline@2026.1`).** Inputs are user-reported and dated. Income "typical" = median of observed monthly totals (streams aligned on the most recent month), "low" = minimum, classification REGULAR/VARIABLE/IRREGULAR by spread ratio (high − low)/typical ≤ 0.10 / ≤ 0.35 / otherwise, UNKNOWN below 3 observed months. Obligations normalise to a month by cadence (weekly 52/12, biweekly 26/12, quarterly 1/3, annual 1/12, one-time 0). Essential = essential obligations + median essential variable spending; discretionary = the rest. Margin typical/low/essential-only-low as stated. Buffer months = liquid cash / monthly essential (2 dp). Outlook: daily projection from liquid cash, income on expected dates (an IRREGULAR stream contributes its own lowest observed month), obligations on due dates per cadence, typical discretionary spread evenly over 30 days; lowest point, floor breaches and 7-day essential-bill collisions exceeding a quarter of monthly essentials are reported. Balances older than 45 days are STALE. Rounding ROUND_HALF_UP to cents at output only. Not advice; inputs are not verified.

**Debt payoff paths (`personal.debt_amortization@2026.1`).** Monthly: interest = round(opening balance × APR/100/12) to cents; pay min(stated minimum, balance) on every open liability; extra = budget − minimums (or the stated extra) to the strategy target (AVALANCHE highest APR, SNOWBALL smallest balance, HYBRID balances ≤ $1,000 first then highest APR), surplus rolling to the next target in the same month. Promotional APR applies to months strictly before its expiry; variable rates are held constant and flagged. Budget below minimums → INFEASIBLE; not paid off within `max_months` → reported, never hidden. Illustration only; no refinancing or consolidation recommendation.

**What-if scenarios (`personal.cashflow_scenario@2026.1`).** Exactly one bounded change is applied to a copy of the baseline request; baseline and scenario are both computed by `personal.cashflow_baseline@2026.1` and reported side by side with the delta (scenario − baseline). SPENDING_CHANGE: a signed monthly amount added as one non-essential variable category (so it flows through margin and the per-day outlook spread); a reduction larger than typical discretionary spending is INFEASIBLE, never capped, because essentials are not reduced by a what-if. SAVINGS_CHANGE: a positive monthly amount; margins fall by that amount; with destination LIQUID the dated outlook is unchanged (the money stays liquid), with ILLIQUID a monthly non-essential obligation leaves liquid cash from the start date; an optional goal's contribution rises by the amount and its months-to-target is compared. INCOME_INTERRUPTION: one stream pays nothing in [start, start + months) using calendar-month arithmetic; the dated outlook skips that stream's payment dates in the window; "during" figures use the remaining streams' typical and low income; runway = cash above the user's floor ÷ monthly shortfall (2 dp) at typical spending and at essentials only; `horizon_covers_interruption` is false when the window outlasts the outlook. New and resolved flags are listed by comparing flag code + refs. Illustration only: everything not named is held constant; no benefits, severance, taxes or behavioural response are modelled.
