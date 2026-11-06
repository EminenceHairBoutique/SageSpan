"""Versioned *methodology* sets for the consumer (Personal) engines.

These are deliberately kept in a registry that is separate from
``ALL_RULE_SETS`` in ``rules.py``:

* ``ALL_RULE_SETS`` holds effective-dated **regulatory** rule sets (IRS tables,
  statutory ages, tolerances) and is the source for the generated, forward-only
  database seed ``supabase/migrations/0006_seed_rule_sets.sql``. Adding entries
  there would require editing an applied migration, which the repository
  conventions forbid.
* ``METHODOLOGY_SETS`` holds the documented calculation conventions of the
  deterministic personal-finance engines (cash-flow baseline, debt
  amortisation). They are versioned, checksummed and cited in receipts exactly
  like rule sets, so a result can be replayed and compared later. When the
  personal engines are persisted to Postgres (PR-003 / DATA-001) they will be
  seeded by a *new* forward-only migration; nothing here touches 0001-0006.

Status vocabulary is the same as ``rules.py`` (``PUBLISHED`` | ``DRAFT``), with
one honest caveat recorded in every set's limitations: "PUBLISHED" means the
convention is fixed and covered by internal golden tests. It is **not** a
statement that a named qualified financial professional has signed it off; see
``docs/finance/RULE_VERIFICATION_AND_MODEL_REGISTRY.md``.
"""
from __future__ import annotations

from datetime import date

from .rules import RuleSet, RuleSource

CFPB_WELLBEING = RuleSource(
    title="CFPB, Financial well-being resources",
    citation="Four elements of financial well-being: control over day-to-day finances, capacity to absorb a shock, on track to meet goals, freedom to make choices (design reference only)",
    url="https://www.consumerfinance.gov/consumer-tools/educator-tool/financial-well-being-resources/",
)

INTERNAL_METHOD_NOTE = "Convention fixed by SageSpan V5 §19.3 and covered by internal golden tests only; no named qualified financial reviewer has signed it off."

PERSONAL_CASHFLOW_BASELINE = RuleSet(
    rule_set_id="personal.cashflow_baseline",
    version="2026.1",
    status="PUBLISHED",
    effective_from=date(2026, 1, 1),
    effective_to=None,
    description=(
        "Manual-entry monthly cash-flow baseline: typical (median) and low (minimum) observed monthly income, essential vs "
        "discretionary commitments normalised to a month, monthly margin, liquid cash versus the user's own cash floor, "
        "essential-expense buffer months, and a day-by-day 30/60/90-day cash outlook built from dated obligations and expected income."
    ),
    sources=(CFPB_WELLBEING,),
    parameters={
        "income_typical_statistic": "MEDIAN_OF_OBSERVED_MONTHS",
        "income_low_statistic": "MINIMUM_OF_OBSERVED_MONTHS",
        "income_classification": {"regular_max_spread_ratio": "0.10", "variable_max_spread_ratio": "0.35"},
        "spread_ratio_formula": "(max - min) / median",
        "minimum_observed_months_for_pattern": 3,
        "stale_after_days": 45,
        "monthly_normalisation": {"WEEKLY": "52/12", "BIWEEKLY": "26/12", "MONTHLY": "1", "QUARTERLY": "1/3", "ANNUAL": "1/12", "ONE_TIME": "0"},
        "discretionary_outlook_spreading": "TYPICAL_MONTHLY_AMOUNT_SPREAD_EVENLY_PER_DAY_OVER_30_DAYS",
        "irregular_income_outlook_amount": "LOW_OBSERVED_MONTH_WHEN_RELIABILITY_IS_IRREGULAR_ELSE_EXPECTED_OR_MEDIAN",
        "buffer_months_formula": "liquid_cash / monthly_essential_commitments",
        "collision_window_days": 7,
        "rounding": "ROUND_HALF_UP_TO_CENTS_AT_OUTPUT",
    },
    limitations=(
        INTERNAL_METHOD_NOTE,
        "Observed amounts are user-reported or consented records as supplied; the engine does not verify them against statements.",
        "The outlook is a deterministic projection of dated commitments, not a forecast of spending behaviour, and ignores interest, taxes and pending transactions.",
        "No investment returns, tax effects, benefits eligibility or credit-score effects are modelled.",
    ),
)

PERSONAL_DEBT_AMORTISATION = RuleSet(
    rule_set_id="personal.debt_amortization",
    version="2026.1",
    status="PUBLISHED",
    effective_from=date(2026, 1, 1),
    effective_to=None,
    description=(
        "Monthly amortisation of a set of liabilities under MINIMUMS_ONLY, AVALANCHE (highest APR first), SNOWBALL (smallest "
        "balance first) and HYBRID (any balance under the hybrid threshold first, then highest APR) with a fixed total monthly "
        "debt budget. Interest accrues monthly at APR/12 on the opening balance and is rounded to cents each month."
    ),
    sources=(),
    parameters={
        "compounding": "MONTHLY",
        "periodic_rate": "APR_PERCENT / 100 / 12",
        "interest_rounding": "ROUND_HALF_UP_TO_CENTS_EACH_MONTH",
        "payment_order_within_month": "INTEREST_THEN_PRINCIPAL",
        "minimum_payment_rule": "MIN(stated_minimum, opening_balance + interest)",
        "extra_payment_rule": "budget - sum(minimums of open liabilities), directed to the strategy target; surplus rolls to the next target in the same month",
        "promo_apr_rule": "promo_apr applies to months strictly before promo_apr_expires; standard apr thereafter",
        "variable_rate_rule": "held constant at the stated APR and flagged as an assumption",
        "hybrid_small_balance_threshold_usd": "1000.00",
        "max_months": 600,
    },
    limitations=(
        INTERNAL_METHOD_NOTE,
        "Lender-specific daily-balance methods, grace periods, fees, late charges, rate changes and payment-date effects are not modelled.",
        "Comparisons are illustrations on the stated inputs; they are not a recommendation to refinance, consolidate or skip any required payment.",
    ),
)

METHODOLOGY_SETS: tuple[RuleSet, ...] = (PERSONAL_CASHFLOW_BASELINE, PERSONAL_DEBT_AMORTISATION)


def get_method(method_id: str) -> RuleSet | None:
    for m in METHODOLOGY_SETS:
        if m.rule_set_id == method_id:
            return m
    return None
