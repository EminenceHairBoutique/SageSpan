"""Golden and property tests for the Personal cash-flow baseline engine.

Golden values below were derived by hand from the synthetic Castillo fixture
(fixtures/synthetic/personal/castillo_clarity_request.json). Any change in these
numbers is a methodology change and must bump personal.cashflow_baseline.
"""
from __future__ import annotations

import copy
import json
from datetime import date
from decimal import Decimal
from pathlib import Path

import pytest

from app.financial.cashflow import add_months, classify_income, median, monthly_equivalent, occurrences
from app.financial.personal_receipt import run_personal_clarity
from app.schemas_personal import PersonalClarityRequest

FIXTURE = Path(__file__).resolve().parents[3] / "fixtures" / "synthetic" / "personal" / "castillo_clarity_request.json"


def castillo_payload(**overrides) -> dict:
    payload = json.loads(FIXTURE.read_text(encoding="utf-8"))
    for k, v in overrides.items():
        payload[k] = v
    return copy.deepcopy(payload)


def run(payload: dict):
    return run_personal_clarity(PersonalClarityRequest.model_validate(payload), org_id="ws_castillo_personal")


# ---------------------------------------------------------------- primitives
def test_median_even_and_odd():
    assert median([Decimal("3"), Decimal("1"), Decimal("2")]) == Decimal("2")
    assert median([Decimal("4"), Decimal("1"), Decimal("3"), Decimal("2")]) == Decimal("2.5")
    assert median([]) is None


def test_monthly_equivalent_conventions():
    assert monthly_equivalent(Decimal("120"), "ANNUAL") == Decimal("10")
    assert monthly_equivalent(Decimal("300"), "QUARTERLY") == Decimal("100")
    assert monthly_equivalent(Decimal("600"), "BIWEEKLY") == Decimal("1300")
    assert monthly_equivalent(Decimal("100"), "WEEKLY") == Decimal("1300") / Decimal("3")
    assert monthly_equivalent(Decimal("999"), "ONE_TIME") == Decimal("0")


def test_add_months_clamps_to_month_end():
    assert add_months(date(2026, 1, 31), 1) == date(2026, 2, 28)
    assert add_months(date(2028, 1, 31), 1) == date(2028, 2, 29)
    assert add_months(date(2026, 11, 30), 3) == date(2027, 2, 28)
    assert add_months(date(2026, 11, 1), 12) == date(2027, 11, 1)


def test_occurrences_biweekly_rolls_forward_without_drift():
    got = list(occurrences(date(2026, 10, 10), "BIWEEKLY", date(2026, 11, 1), date(2026, 12, 31)))
    assert got == [date(2026, 11, 7), date(2026, 11, 21), date(2026, 12, 5), date(2026, 12, 19)]


def test_occurrences_monthly_and_annual_and_one_time():
    assert list(occurrences(date(2026, 11, 12), "MONTHLY", date(2026, 11, 1), date(2027, 1, 30))) == [date(2026, 11, 12), date(2026, 12, 12), date(2027, 1, 12)]
    assert list(occurrences(date(2027, 1, 15), "ANNUAL", date(2026, 11, 1), date(2027, 1, 30))) == [date(2027, 1, 15)]
    assert list(occurrences(date(2027, 3, 1), "ONE_TIME", date(2026, 11, 1), date(2027, 1, 30))) == []


def test_classify_income_thresholds():
    assert classify_income(Decimal("95"), Decimal("105"), Decimal("100"), 6) == "REGULAR"
    assert classify_income(Decimal("80"), Decimal("110"), Decimal("100"), 6) == "VARIABLE"
    assert classify_income(Decimal("50"), Decimal("150"), Decimal("100"), 6) == "IRREGULAR"
    assert classify_income(Decimal("50"), Decimal("150"), Decimal("100"), 2) == "UNKNOWN"


# ---------------------------------------------------------------- Castillo golden
def test_castillo_golden_baseline():
    r = run(castillo_payload())
    assert r.check_type == "PERSONAL_CLARITY"
    assert r.result_status == "COMPUTED"
    # income: monthly totals 4280, 5870, 4000, 6380, 4640, 5300 -> median 4970, low 4000, high 6380
    assert r.income.observed_months == 6
    assert r.income.typical_monthly == Decimal("4970.00")
    assert r.income.low_monthly == Decimal("4000.00")
    assert r.income.high_monthly == Decimal("6380.00")
    assert r.income.spread_ratio == Decimal("0.4789")
    assert r.income.classification == "IRREGULAR"
    # commitments: essential obligations 1450+185+142+65+310+145+240/12 = 2317; essential variable 550 + 157.5
    assert r.commitments.monthly_essential == Decimal("3024.50")
    assert r.commitments.monthly_discretionary_typical == Decimal("442.00")
    assert r.commitments.monthly_debt_minimums == Decimal("455.00")
    assert r.commitments.essential_items == 9 and r.commitments.discretionary_items == 4
    # margin
    assert r.margin.typical == Decimal("1503.50")
    assert r.margin.low == Decimal("533.50")
    assert r.margin.essential_only_low == Decimal("975.50")
    # cash
    assert r.cash.liquid_total == Decimal("3650.00")
    assert r.cash.cash_floor == Decimal("1500.00")
    assert r.cash.above_floor == Decimal("2150.00")
    assert r.cash.essential_buffer_months == Decimal("1.21")
    assert r.cash.buffer_gap_amount == Decimal("2399.00")
    # debt
    assert r.debt.total_balance == Decimal("16120.00")
    assert r.debt.highest_apr_ref == "liab_castillo_card"
    assert r.debt.balance_weighted_apr_percent == Decimal("12.31")
    # goals: reserve remaining 4500 / 200 -> 23 months; move 2600/150 -> 18 months, Nov 2026 + 18 = May 2028 > Jun 2027
    goals = {g.goal_ref: g for g in r.goals}
    assert goals["goal_castillo_reserve"].months_to_target_at_contribution == 23
    assert goals["goal_castillo_move"].months_to_target_at_contribution == 18
    assert goals["goal_castillo_move"].on_track_for_target_date is False
    codes = {f.code for f in r.flags}
    assert {"IRREGULAR_INCOME", "HIGH_APR_DEBT", "VARIABLE_RATE_DEBT", "BUFFER_BELOW_TARGET"} <= codes
    assert "CASH_BELOW_FLOOR" not in codes and "BUFFER_BELOW_ONE_MONTH" not in codes
    # receipt cites the methodology set, not an RMD rule set
    assert [rs.rule_set_id for rs in r.receipt.rule_sets] == ["personal.cashflow_baseline"]
    assert r.receipt.rule_sets[0].status == "PUBLISHED"
    assert r.receipt.engine_name == "sagespan-calculator"
    assert len(r.receipt.request_hash) == 64 and len(r.receipt.run_hash) == 64


def test_castillo_outlook_is_dated_and_conservative():
    r = run(castillo_payload())
    o = r.outlook
    assert o.horizon_days == 90
    assert o.start_cash == Decimal("3650.00")
    # rent is due on the as-of date itself
    first = o.points[0]
    assert first.date == date(2026, 11, 1)
    assert any(e.ref == "obl_castillo_rent" and e.amount == Decimal("-1450.00") for e in first.events)
    # irregular contract stream contributes its OWN lowest month (2800), not the household total
    nov15 = next(p for p in o.points if p.date == date(2026, 11, 15))
    assert any(e.ref == "inc_castillo_contract" and e.amount == Decimal("2800.00") for e in nov15.events)
    # biweekly part-time income appears every 14 days from Nov 7
    pt_dates = [p.date for p in o.points if any(e.ref == "inc_castillo_parttime" for e in p.events)]
    assert pt_dates[:3] == [date(2026, 11, 7), date(2026, 11, 21), date(2026, 12, 5)]
    # the annual renters insurance falls inside the 90-day window exactly once
    assert sum(1 for p in o.points for e in p.events if e.ref == "obl_castillo_renters_insurance") == 1
    assert o.lowest_projected_cash <= o.start_cash
    assert o.points[-1].date == date(2027, 1, 30)
    assert o.lowest_projected_cash >= Decimal("1500.00")  # Castillo stays above the floor on these inputs
    assert o.floor_breach_dates == []


def test_lower_cash_triggers_floor_breach_and_buffer_flags():
    payload = castillo_payload()
    payload["cash_accounts"][0]["balance"] = "900.00"
    payload["cash_accounts"][1]["balance"] = "400.00"
    r = run(payload)
    codes = {f.code for f in r.flags}
    assert "CASH_BELOW_FLOOR" in codes
    assert "BUFFER_BELOW_ONE_MONTH" in codes
    assert r.outlook.first_floor_breach_date == date(2026, 11, 1)


def test_stale_balance_is_flagged_and_marked_in_data_quality():
    payload = castillo_payload()
    payload["cash_accounts"][1]["balance_as_of"] = "2026-08-01"
    r = run(payload)
    assert any(f.code == "STALE_BALANCE" and f.refs == ["cash_castillo_savings"] for f in r.flags)
    assert next(d for d in r.data_quality if d.ref == "cash_castillo_savings").state == "STALE"


def test_missing_income_or_expenses_returns_insufficient_data_not_a_guess():
    payload = castillo_payload(income_streams=[])
    r = run(payload)
    assert r.result_status == "INSUFFICIENT_DATA"
    assert r.income.typical_monthly is None and r.margin.typical is None
    payload = castillo_payload(obligations=[], variable_spending=[])
    r = run(payload)
    assert r.result_status == "INSUFFICIENT_DATA"
    assert any(f.code == "MISSING_EXPENSE_DATA" for f in r.flags)
    assert r.cash.essential_buffer_months is None


def test_bill_collision_detected_when_essentials_cluster():
    payload = castillo_payload()
    # move five essentials to the same week so the window exceeds a quarter of monthly essentials (3024.50 / 4 = 756.13)
    for o in payload["obligations"]:
        if o["obligation_ref"] in ("obl_castillo_utilities", "obl_castillo_car_insurance", "obl_castillo_phone", "obl_castillo_car_loan_min", "obl_castillo_card_min"):
            o["next_due_date"] = "2026-11-19"
    r = run(payload)
    cols = r.outlook.collisions
    assert cols, "expected a collision window"
    assert cols[0].total_due == Decimal("847.00")
    assert set(cols[0].refs) == {"obl_castillo_utilities", "obl_castillo_car_insurance", "obl_castillo_phone", "obl_castillo_car_loan_min", "obl_castillo_card_min"}
    assert any(f.code == "BILL_COLLISION" for f in r.flags)


def test_short_history_flagged_and_unknown_classification():
    payload = castillo_payload()
    for s in payload["income_streams"]:
        s["observed_monthly_amounts"] = s["observed_monthly_amounts"][-2:]
        s["reliability"] = "UNKNOWN"
    r = run(payload)
    assert r.income.observed_months == 2
    assert r.income.classification == "UNKNOWN"
    assert any(f.code == "SHORT_INCOME_HISTORY" for f in r.flags)


def test_determinism_same_inputs_same_run_hash():
    a = run(castillo_payload())
    b = run(castillo_payload())
    assert a.receipt.request_hash == b.receipt.request_hash
    assert a.receipt.run_hash == b.receipt.run_hash


def test_body_level_org_or_workspace_id_rejected_by_schema():
    payload = castillo_payload()
    payload["org_id"] = "org_x"
    with pytest.raises(Exception):
        PersonalClarityRequest.model_validate(payload)
    payload = castillo_payload()
    payload["workspace_id"] = "ws_x"
    with pytest.raises(Exception):
        PersonalClarityRequest.model_validate(payload)
