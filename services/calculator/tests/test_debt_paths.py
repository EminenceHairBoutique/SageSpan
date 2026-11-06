"""Golden and property tests for the debt payoff path engine."""
from __future__ import annotations

from datetime import date
from decimal import Decimal

from app.financial.personal_receipt import run_debt_paths
from app.schemas_personal import DebtPathsRequest


def req(**overrides) -> DebtPathsRequest:
    base = {
        "schema_version": "sagespan.debt-paths.v1",
        "as_of_date": "2026-11-01",
        "liabilities": [
            {"liability_ref": "liab_card", "label": "Card", "balance": "4820.00", "apr_percent": "24.99", "minimum_payment": "145.00", "rate_type": "VARIABLE"},
            {"liability_ref": "liab_car", "label": "Car", "balance": "11300.00", "apr_percent": "6.90", "minimum_payment": "310.00", "rate_type": "FIXED"},
        ],
        "monthly_debt_budget": "705.00",
        "policy": {"cash_floor": "1500.00"},
        "liquid_cash": "3650.00",
        "strategies": ["MINIMUMS_ONLY", "AVALANCHE", "SNOWBALL", "HYBRID"],
    }
    for k, v in overrides.items():
        if v is None:
            base.pop(k, None)
        else:
            base[k] = v
    return DebtPathsRequest.model_validate(base)


def test_single_liability_hand_computed_three_months():
    # 300 at 12% APR (1%/month), minimum 100, budget 110:
    # m1: interest 3.00 -> 303.00, pay 110 -> 193.00
    # m2: interest 1.93 -> 194.93, pay 110 -> 84.93
    # m3: interest 0.85 -> 85.78, pay 85.78 -> 0
    r = run_debt_paths(
        req(liabilities=[{"liability_ref": "l1", "balance": "300.00", "apr_percent": "12", "minimum_payment": "100.00"}], monthly_debt_budget="110.00", strategies=["AVALANCHE"]),
        org_id="ws",
    )
    res = {x.strategy: x for x in r.results}
    av = res["AVALANCHE"]
    assert av.feasible and av.months_to_payoff == 3
    assert av.total_interest == Decimal("5.78")
    assert av.total_paid == Decimal("305.78")
    assert av.payoff_date == date(2027, 2, 1)
    assert [row.closing_total_balance for row in av.first_year] == [Decimal("193.00"), Decimal("84.93"), Decimal("0.00")]
    assert r.result_status == "COMPUTED"
    assert [rs.rule_set_id for rs in r.receipt.rule_sets] == ["personal.debt_amortization"]


def test_strategy_properties_on_castillo_debts():
    r = run_debt_paths(req(), org_id="ws")
    res = {x.strategy: x for x in r.results}
    assert set(res) == {"MINIMUMS_ONLY", "AVALANCHE", "SNOWBALL", "HYBRID"}
    assert all(x.feasible for x in res.values())
    # avalanche never pays more interest than snowball under the same budget; minimums-only pays the most
    assert res["AVALANCHE"].total_interest <= res["SNOWBALL"].total_interest
    assert res["MINIMUMS_ONLY"].total_interest >= res["SNOWBALL"].total_interest
    assert res["AVALANCHE"].months_to_payoff <= res["MINIMUMS_ONLY"].months_to_payoff
    assert res["AVALANCHE"].interest_saved_vs_minimums == res["MINIMUMS_ONLY"].total_interest - res["AVALANCHE"].total_interest
    assert res["AVALANCHE"].payoff_order[0].liability_ref == "liab_card"  # highest APR first
    assert res["SNOWBALL"].payoff_order[0].liability_ref == "liab_card"  # also the smaller balance here
    assert r.liquidity_guard.extra_per_month == Decimal("250.00")
    assert r.liquidity_guard.floor_respected is True and r.liquidity_guard.budget_covers_minimums is True
    assert any("variable rate held constant" in a for a in r.assumptions)
    # every month row conserves money: opening + interest - payment = closing
    for x in res.values():
        for row in x.first_year:
            assert row.opening_total_balance + row.interest - row.payment == row.closing_total_balance


def test_budget_below_minimums_is_infeasible_never_skips_a_minimum():
    r = run_debt_paths(req(monthly_debt_budget="300.00"), org_id="ws")
    assert r.result_status == "INFEASIBLE"
    assert all(not x.feasible and x.infeasible_reason == "BUDGET_BELOW_MINIMUMS" for x in r.results)
    assert any(f.code == "BUDGET_BELOW_MINIMUMS" for f in r.flags)


def test_cash_below_floor_is_flagged_but_arithmetic_still_runs():
    r = run_debt_paths(req(liquid_cash="900.00"), org_id="ws")
    assert r.liquidity_guard.floor_respected is False
    assert any(f.code == "CASH_BELOW_FLOOR" for f in r.flags)
    assert r.result_status == "COMPUTED"


def test_promo_apr_applies_until_expiry_then_standard():
    liab = [{"liability_ref": "promo", "balance": "1000.00", "apr_percent": "24.00", "minimum_payment": "25.00", "rate_type": "PROMOTIONAL", "promo_apr_percent": "0", "promo_apr_expires": "2027-01-01"}]
    r = run_debt_paths(req(liabilities=liab, monthly_debt_budget="25.00", strategies=["MINIMUMS_ONLY"]), org_id="ws")
    rows = r.results[0].first_year
    assert rows[0].interest == Decimal("0.00") and rows[1].interest == Decimal("0.00")  # Nov, Dec at 0%
    assert rows[2].interest > Decimal("0.00")  # Jan at 24%
    assert any("promotional APR until 2027-01-01" in a for a in r.assumptions)


def test_hybrid_targets_small_balances_first():
    liab = [
        {"liability_ref": "small_low_apr", "balance": "600.00", "apr_percent": "5", "minimum_payment": "25.00"},
        {"liability_ref": "big_high_apr", "balance": "5000.00", "apr_percent": "25", "minimum_payment": "100.00"},
    ]
    r = run_debt_paths(req(liabilities=liab, monthly_debt_budget="400.00", strategies=["HYBRID", "AVALANCHE"]), org_id="ws")
    res = {x.strategy: x for x in r.results}
    assert res["HYBRID"].payoff_order[0].liability_ref == "small_low_apr"
    assert res["AVALANCHE"].payoff_order[0].liability_ref == "big_high_apr"
    assert res["AVALANCHE"].total_interest <= res["HYBRID"].total_interest


def test_not_paid_off_within_horizon_is_reported_not_hidden():
    liab = [{"liability_ref": "forever", "balance": "10000.00", "apr_percent": "30", "minimum_payment": "250.00"}]
    r = run_debt_paths(req(liabilities=liab, monthly_debt_budget="250.00", strategies=["MINIMUMS_ONLY"], max_months=12), org_id="ws")
    x = r.results[0]
    assert x.feasible is False and x.infeasible_reason == "NOT_PAID_OFF_WITHIN_MAX_MONTHS"
    assert x.total_interest > Decimal("0")


def test_extra_monthly_payment_is_equivalent_to_minimums_plus_extra():
    a = run_debt_paths(req(), org_id="ws")  # budget 705 = minimums 455 + 250
    b = run_debt_paths(req(monthly_debt_budget=None, extra_monthly_payment="250.00"), org_id="ws")
    assert a.liquidity_guard.extra_per_month == b.liquidity_guard.extra_per_month == Decimal("250.00")
    ra = {x.strategy: x.total_interest for x in a.results}
    rb = {x.strategy: x.total_interest for x in b.results}
    assert ra == rb


def test_exactly_one_budget_input_required():
    import pytest

    with pytest.raises(Exception):
        req(monthly_debt_budget=None)
    with pytest.raises(Exception):
        req(extra_monthly_payment="10.00")


def test_cash_accounts_are_totalled_by_the_engine():
    accounts = [
        {"account_ref": "c1", "balance": "2150.00", "balance_as_of": "2026-11-01", "liquid": True},
        {"account_ref": "s1", "balance": "1500.00", "balance_as_of": "2026-10-31", "liquid": True},
        {"account_ref": "ira", "balance": "18400.00", "balance_as_of": "2026-09-30", "liquid": False},
    ]
    r = run_debt_paths(req(liquid_cash=None, cash_accounts=accounts), org_id="ws")
    assert r.liquidity_guard.liquid_cash == Decimal("3650.00")  # the retirement account is excluded
