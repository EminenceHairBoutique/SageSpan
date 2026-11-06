"""Golden tests for personal.cashflow_scenario@2026.1 (PERS-002c).

All figures derive by hand from the Castillo fixture. Baseline goldens
(typical income 4,970.00; essentials 3,024.50; discretionary 442.00; margin
1,503.50; liquid 3,650.00; floor 1,500.00) are established in
test_personal_clarity.py. Any change here is a methodology change and must bump
personal.cashflow_scenario.
"""
from __future__ import annotations

import json
from decimal import Decimal
from pathlib import Path

import pytest
from pydantic import ValidationError

from app.financial.personal_receipt import run_personal_clarity, run_personal_scenario
from app.schemas_personal import (
    PersonalClarityRequest,
    PersonalScenarioRequest,
    ScenarioSpec,
)
from tests.test_personal_clarity import castillo_payload

FIXTURE_DIR = Path(__file__).resolve().parents[3] / "fixtures" / "synthetic" / "personal"


def scenario_payload(scenario: dict, **baseline_overrides) -> dict:
    return {
        "schema_version": "sagespan.personal-scenario.v1",
        "baseline": castillo_payload(**baseline_overrides),
        "scenario": scenario,
        "workspace_ref": "ws_castillo_personal",
    }


def run(scenario: dict, **baseline_overrides):
    return run_personal_scenario(PersonalScenarioRequest.model_validate(scenario_payload(scenario, **baseline_overrides)), org_id="ws_castillo_personal")


# ---------------------------------------------------------------- spec validation
def test_spec_rejects_fields_that_do_not_belong_to_the_kind():
    with pytest.raises(ValidationError):
        ScenarioSpec.model_validate({"kind": "SPENDING_CHANGE", "monthly_amount": "-100", "stream_ref": "x"})
    with pytest.raises(ValidationError):
        ScenarioSpec.model_validate({"kind": "INCOME_INTERRUPTION", "stream_ref": "x"})  # months missing
    with pytest.raises(ValidationError):
        ScenarioSpec.model_validate({"kind": "INCOME_INTERRUPTION", "stream_ref": "x", "months": 13})
    with pytest.raises(ValidationError):
        ScenarioSpec.model_validate({"kind": "SAVINGS_CHANGE", "monthly_amount": "-50"})
    with pytest.raises(ValidationError):
        ScenarioSpec.model_validate({"kind": "SPENDING_CHANGE", "monthly_amount": "0"})
    assert ScenarioSpec.model_validate({"kind": "SAVINGS_CHANGE", "monthly_amount": "50"}).destination == "LIQUID"


def test_request_forbids_tenant_claims_in_body():
    body = scenario_payload({"kind": "SPENDING_CHANGE", "monthly_amount": "-50"})
    body["org_id"] = "org_other"
    with pytest.raises(ValidationError):
        PersonalScenarioRequest.model_validate(body)


# ---------------------------------------------------------------- baseline parity
def test_baseline_metrics_match_the_clarity_engine():
    r = run({"kind": "SPENDING_CHANGE", "monthly_amount": "-50.00"})
    c = run_personal_clarity(PersonalClarityRequest.model_validate(castillo_payload()), org_id="ws_castillo_personal")
    assert r.baseline_metrics.margin_typical == c.margin.typical == Decimal("1503.50")
    assert r.baseline_metrics.lowest_projected_cash == c.outlook.lowest_projected_cash == Decimal("1756.60")
    assert r.baseline_metrics.end_projected_cash == c.outlook.end_projected_cash
    assert r.baseline_metrics.essential_buffer_months == Decimal("1.21")


# ---------------------------------------------------------------- income interruption (golden)
def test_one_month_contract_interruption_golden():
    r = run({"kind": "INCOME_INTERRUPTION", "stream_ref": "inc_castillo_contract", "months": 1})
    assert r.result_status == "COMPUTED" and r.check_type == "PERSONAL_SCENARIO"
    i = r.interruption
    assert i is not None
    # remaining stream: part-time median 1,200.00; 1,200 - 3,024.50 - 442.00 = -2,266.50
    assert r.scenario_metrics.income_typical_monthly == Decimal("1200.00")
    assert r.scenario_metrics.margin_typical == i.margin_typical_during == Decimal("-2266.50")
    assert i.margin_essential_only_during == Decimal("-1824.50")
    # runway = 2,150.00 above floor / 2,266.50 = 0.9486 -> 0.95
    assert i.cash_above_floor == Decimal("2150.00")
    assert i.runway_months_typical_spending == Decimal("0.95")
    assert i.runway_months_essentials_only == Decimal("1.18")
    assert i.cash_above_floor_covers_interruption is False
    assert i.stream_typical_monthly == Decimal("3750.00") and i.income_forgone_typical == Decimal("3750.00")
    # the Nov 15 payment (lowest observed month 2,800 for an IRREGULAR stream) is skipped in the horizon
    assert i.payments_skipped_in_horizon == 1 and i.amount_skipped_in_horizon == Decimal("2800.00")
    assert str(i.start_date) == "2026-11-01" and str(i.end_date) == "2026-12-01" and i.horizon_covers_interruption is True
    assert r.delta.margin_typical == Decimal("-3770.00")
    assert r.delta.end_projected_cash == Decimal("-2800.00")
    codes = {f.code for f in r.new_flags}
    assert {"FLOOR_BREACH_PROJECTED", "RUNWAY_SHORTER_THAN_INTERRUPTION"} <= codes
    assert r.receipt.rule_sets[0].rule_set_id == "personal.cashflow_scenario"
    assert r.receipt.rule_sets[1].rule_set_id == "personal.cashflow_baseline"


def test_six_month_interruption_exceeds_horizon_and_is_disclosed():
    r = run({"kind": "INCOME_INTERRUPTION", "stream_ref": "inc_castillo_contract", "months": 6, "start_date": "2026-12-01"})
    i = r.interruption
    assert i is not None
    assert str(i.end_date) == "2027-06-01" and i.horizon_covers_interruption is False
    assert i.payments_skipped_in_horizon == 2 and i.amount_skipped_in_horizon == Decimal("5600.00")
    assert i.income_forgone_typical == Decimal("22500.00")
    # margins during are the same monthly figures regardless of the window length
    assert i.margin_typical_during == Decimal("-2266.50") and i.runway_months_typical_spending == Decimal("0.95")


def test_interrupting_the_only_stream_gives_zero_income_not_null():
    base = castillo_payload()
    base["income_streams"] = [base["income_streams"][1]]  # part-time only
    r = run_personal_scenario(
        PersonalScenarioRequest.model_validate({"schema_version": "sagespan.personal-scenario.v1", "baseline": base, "scenario": {"kind": "INCOME_INTERRUPTION", "stream_ref": "inc_castillo_parttime", "months": 2}}),
        org_id="ws",
    )
    assert r.scenario_metrics.income_typical_monthly == Decimal("0.00")
    assert r.scenario_metrics.margin_typical == Decimal("-3466.50")  # -(3,024.50 + 442.00)
    assert r.interruption is not None and r.interruption.runway_months_typical_spending == Decimal("0.62")  # 2,150 / 3,466.50


def test_unknown_stream_is_infeasible_not_guessed():
    r = run({"kind": "INCOME_INTERRUPTION", "stream_ref": "inc_nobody", "months": 3})
    assert r.result_status == "INFEASIBLE" and r.interruption is None
    assert r.delta.margin_typical == Decimal("0.00")


# ---------------------------------------------------------------- spending change
def test_spending_reduction_raises_margin_by_exactly_the_amount():
    r = run({"kind": "SPENDING_CHANGE", "monthly_amount": "-150.00"})
    assert r.result_status == "COMPUTED"
    assert r.delta.margin_typical == Decimal("150.00") and r.delta.margin_low == Decimal("150.00")
    assert r.delta.monthly_discretionary_typical == Decimal("-150.00")
    assert r.scenario_metrics.margin_typical == Decimal("1653.50")
    # dated effect: 150/30 per day; the baseline low point is day 5 (Nov 6) -> +30.00 by then
    assert r.delta.lowest_projected_cash == Decimal("30.00")
    assert r.delta.end_projected_cash == Decimal("455.00")  # 91 days x 5.00


def test_spending_increase_is_allowed_and_lowers_margin():
    r = run({"kind": "SPENDING_CHANGE", "monthly_amount": "300.00"})
    assert r.delta.margin_typical == Decimal("-300.00")
    assert r.scenario_metrics.margin_low == Decimal("233.50")


def test_spending_reduction_larger_than_discretionary_is_infeasible():
    r = run({"kind": "SPENDING_CHANGE", "monthly_amount": "-900.00"})
    assert r.result_status == "INFEASIBLE"
    assert "$442.00" in (r.infeasible_reason or "")
    assert r.scenario_metrics == r.baseline_metrics


# ---------------------------------------------------------------- savings change
def test_liquid_savings_change_lowers_margin_but_not_dated_cash_and_moves_goal():
    r = run({"kind": "SAVINGS_CHANGE", "monthly_amount": "200.00", "goal_ref": "goal_castillo_reserve"})
    assert r.result_status == "COMPUTED"
    assert r.delta.margin_typical == Decimal("-200.00")
    assert r.delta.lowest_projected_cash == Decimal("0.00") and r.delta.end_projected_cash == Decimal("0.00")
    assert len(r.goal_changes) == 1
    g = r.goal_changes[0]
    # remaining 4,500 at 200/month = 23 months; at 400/month = 12 months (ceil 11.25)
    assert (g.baseline_months_to_target, g.scenario_months_to_target) == (23, 12)


def test_illiquid_savings_change_leaves_liquid_cash_monthly():
    r = run({"kind": "SAVINGS_CHANGE", "monthly_amount": "200.00", "destination": "ILLIQUID"})
    assert r.delta.margin_typical == Decimal("-200.00")
    # Nov 1 transfer lands on day 0, before the baseline low point on Nov 6 -> lowest falls by 200 + 5 days x 200/30
    assert r.delta.lowest_projected_cash == Decimal("-240.00")
    assert r.delta.end_projected_cash < Decimal("-600.00")


def test_savings_change_with_unknown_goal_is_infeasible():
    r = run({"kind": "SAVINGS_CHANGE", "monthly_amount": "100.00", "goal_ref": "goal_none"})
    assert r.result_status == "INFEASIBLE"


# ---------------------------------------------------------------- receipt binding
def test_receipt_hashes_bind_scenario_and_baseline():
    a = run({"kind": "SPENDING_CHANGE", "monthly_amount": "-100.00"})
    b = run({"kind": "SPENDING_CHANGE", "monthly_amount": "-101.00"})
    assert a.receipt.request_hash != b.receipt.request_hash and a.receipt.run_hash != b.receipt.run_hash
    again = run({"kind": "SPENDING_CHANGE", "monthly_amount": "-100.00"})
    assert again.receipt.request_hash == a.receipt.request_hash and again.receipt.run_hash == a.receipt.run_hash
    assert any("not advice" in lim.lower() for lim in a.receipt.limitations)


def test_golden_fixture_matches_engine():
    req = json.loads((FIXTURE_DIR / "castillo_scenario_interruption_request.json").read_text(encoding="utf-8"))
    expected = json.loads((FIXTURE_DIR / "castillo_scenario_interruption_expected_response.json").read_text(encoding="utf-8"))
    r = run_personal_scenario(PersonalScenarioRequest.model_validate(req), org_id="ws_castillo_personal")
    got = r.model_dump(mode="json")
    for k in ("result_status", "baseline_metrics", "scenario_metrics", "delta", "interruption", "new_flags", "assumptions"):
        assert got[k] == expected[k], k
    assert got["receipt"]["request_hash"] == expected["receipt"]["request_hash"]
    assert got["receipt"]["run_hash"] == expected["receipt"]["run_hash"]
