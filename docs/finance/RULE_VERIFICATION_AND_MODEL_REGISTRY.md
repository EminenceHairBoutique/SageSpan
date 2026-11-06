# Rule verification and model registry (V5 §19.4)

Companion to `docs/RULE_VERIFICATION_LOG.md` (parameter-level claim register, unchanged). This registry lists every rule set and methodology set the calculation service exposes, its lifecycle status, what evidence exists, and who has signed it off. **No row has a named qualified reviewer signature yet.** "PUBLISHED" means the convention or table is fixed, checksummed and covered by internal golden tests; it is not an external attestation.

## Regulatory rule sets (`/v1/rules`, seeded into `app.rule_sets` by migration 0006)

| Rule set | Version | Status | Effective | Sources | Internal evidence | Qualified reviewer sign-off |
|---|---|---|---|---|---|---|
| `rmd.uniform_lifetime_table` | 2022.1 | PUBLISHED | 2022-01-01 → | Pub. 590-B App. B Table III; 26 CFR §1.401(a)(9)-9 | 49 factors matched to regulation text (agent check, see log); Patel golden 640,000 / 25.5 = 25,098.04 | **None** |
| `rmd.applicable_age` | 2023.1 | PUBLISHED | 2023-01-01 → | SECURE 2.0 §107; IRC 401(a)(9) | boundary tests by birth year | **None** |
| `rmd.required_beginning_date` | 2023.1 | PUBLISHED | 2023-01-01 → | IRC 401(a)(9); Pub. 590-B | first-year/deferred event tests | **None** |
| `rmd.spouse_joint_table_eligibility` | 2022.1 | PUBLISHED | 2022-01-01 → | Pub. 590-B; 26 CFR §1.401(a)(9)-9 | Okafor case returns UNSUPPORTED (Table II not implemented) | **None** |
| `rmd.comparison_tolerance` | 1.0 | PUBLISHED | 2024-01-01 → | — (product convention) | classification tests | n/a (convention) |
| `tax.federal_ordinary_income` | 2026.0-draft | **DRAFT** | 2026 | Rev. Proc. 2025-32 | bracket values matched to IRS release (agent) | **None — stays DRAFT; not exposed by a published endpoint** |

## Methodology sets (`/v1/methods`, V5; **not yet seeded in Postgres** — see ADR-V5-001 §6)

| Method set | Version | Status | Scope | Conventions | Internal evidence | Qualified reviewer sign-off |
|---|---|---|---|---|---|---|
| `personal.cashflow_baseline` | 2026.1 | PUBLISHED (internal golden only) | Manual-entry monthly baseline and dated 30/60/90-day outlook | median/min income; cadence normalisation (52/12, 26/12, 1/3, 1/12); 45-day staleness; irregular streams use their own low month; discretionary spread over 30 days; collision window 7 days; ROUND_HALF_UP at output | 22 pytest cases incl. hand-derived Castillo golden (typical 4,970.00; essentials 3,024.50; margin 1,503.50; buffer 1.21 months; gap 2,399.00) | **None** |
| `personal.debt_amortization` | 2026.1 | PUBLISHED (internal golden only) | Payoff ordering comparison under fixed budget | APR/12 monthly on opening balance, interest rounded to cents monthly; minimums first; extra to strategy target; promo APR until expiry; variable held constant; hybrid threshold $1,000 | 9 pytest cases incl. hand-computed 3-month case (5.78 interest, 305.78 paid); avalanche ≤ snowball ≤ minimums interest property | **None** |
| `personal.cashflow_scenario` | 2026.1 | PUBLISHED (internal golden only) | One bounded what-if on the cash-flow baseline (depends on `personal.cashflow_baseline@2026.1`) | one change per scenario; spending change = extra non-essential category with signed typical amount, reduction > typical discretionary → INFEASIBLE; savings change LIQUID lowers margins only, ILLIQUID adds a monthly non-essential obligation; income interruption = [start, start+months) calendar window, outlook skips the stream's payment dates, margin "during" = remaining streams' typical income − essential − discretionary, runway = cash above floor / monthly shortfall (2 dp) | 16 pytest cases incl. hand-derived Castillo golden (contract stream out 1 month: margin during −2,266.50; essentials-only −1,824.50; runway 0.95 / 1.18 months; 2,800.00 skipped in horizon), committed fixture `castillo_scenario_interruption_*.json` with request/run hash parity | **None** |

## Engines not yet registered (proposed)

| Engine | Milestone | Required before PUBLISHED |
|---|---|---|
| Gross-basis annual retirement projection | PLAN-001 / SCENARIO-001 | numerical spec reviewed, event ordering documented, nominal vs real dollars, golden + property tests, omissions card, named reviewer |
| Social Security claiming | later | current SSA rules, benefit-estimate inputs, reviewer |
| Tax-aware withdrawals / Roth conversions | later | `tax.federal_ordinary_income` published first; state tax scope; reviewer |
| Monte Carlo | later | distribution assumptions, correlations, seed, convergence tests, calibration, reviewer |

## Change control

A change to any row above is a version bump with: source register update, golden/negative cases, `--check` generators green (`export_rule_sets_sql.py`, `export_canonical_sql_test.py`, `export_openapi.py`), OpenAPI drift test green, and a dated entry here naming the author and (when it exists) the reviewer. Prior results stay replayable with their historical versions; a rule upgrade never rewrites an old receipt or packet.
