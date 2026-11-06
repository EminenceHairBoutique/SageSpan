from __future__ import annotations

from datetime import date
from decimal import Decimal

from app.financial.checks import classify, effective_tolerance
from app.financial.rmd import assess
from app.schemas import ImportedComparison, Tolerance
from tests.conftest import patel_payload, patel_request

BAL = Decimal("640000.00")
AS_OF = date(2025, 12, 31)


def _imp(**kw) -> ImportedComparison:
    base = dict(import_value_ref="ipv", amount="24000.00", currency="USD", tax_year=2026, calculation_scope="SINGLE_ACCOUNT_ANNUAL_RMD", balance_basis="ACTUAL_PRIOR_YEAR_END")
    base.update(kw)
    return ImportedComparison.model_validate(base)


def _classify(imp, req=None, tol=None):
    req = req or patel_request()
    return classify(assess(req), imp, 2026, tol, BAL, AS_OF)


def test_missing_evidence_when_no_import():
    d = _classify(None)
    assert d.classification == "MISSING_EVIDENCE" and d.comparable is False


def test_within_tolerance():
    d = _classify(_imp(amount="25098.50"))
    assert d.classification == "WITHIN_TOLERANCE" and d.comparable
    assert d.difference == Decimal("-0.46")
    assert d.tolerance_applied == Decimal("25.10")  # max(1.00, 0.1% of 25098.04)


def test_source_conflict_when_declared_balance_differs_same_date():
    d = _classify(_imp(declared_inputs={"balance": "612000.00", "balance_as_of": "2025-12-31", "factor": "25.5"}))
    assert d.classification == "SOURCE_CONFLICT"
    assert d.difference == Decimal("1098.04")
    assert "custodian statement governs" in d.next_step


def test_stale_input_when_declared_balance_is_older():
    d = _classify(_imp(declared_inputs={"balance": "612000.00", "balance_as_of": "2025-11-30", "factor": "25.5"}))
    assert d.classification == "STALE_INPUT"
    assert "not by itself an error" in d.explanation


def test_rule_disagreement_when_inputs_match_but_factor_differs():
    d = _classify(_imp(amount="24150.94", declared_inputs={"balance": "640000.00", "balance_as_of": "2025-12-31", "factor": "26.5"}))
    assert d.classification == "RULE_DISAGREEMENT"


def test_methodology_difference():
    d = _classify(_imp(amount="25000.00", declared_inputs={"balance": "640000.00", "balance_as_of": "2025-12-31", "factor": "25.5", "method": "MONTHLY_SCHEDULE_SUM"}))
    assert d.classification == "METHODOLOGY_DIFFERENCE"


def test_missing_evidence_when_import_has_no_declared_inputs():
    d = _classify(_imp(amount="24000.00"))
    assert d.classification == "MISSING_EVIDENCE" and d.comparable
    assert "cannot yet be attributed" in d.explanation


def test_rule_disagreement_when_normalised_and_still_different():
    d = _classify(_imp(amount="24000.00", declared_inputs={"balance": "640000.00", "balance_as_of": "2025-12-31", "factor": "25.5", "method": "DIRECT_DIVISION"}))
    assert d.classification == "RULE_DISAGREEMENT"


def test_not_comparable_when_assumptions_differ_materially():
    assert _classify(_imp(balance_basis="PROJECTED")).classification == "NOT_COMPARABLE"
    assert _classify(_imp(calculation_scope="AGGREGATE_ALL_IRAS")).classification == "NOT_COMPARABLE"
    assert _classify(_imp(tax_year=2025)).classification == "NOT_COMPARABLE"
    assert _classify(_imp(currency="EUR")).classification == "NOT_COMPARABLE"
    assert _classify(_imp(assumptions={"balance_basis": "projected"})).classification == "NOT_COMPARABLE"


def test_unsupported_check_when_engine_cannot_compute():
    req = patel_request(account={**patel_payload()["account"], "is_inherited": True})
    d = _classify(_imp(), req=req)
    assert d.classification == "UNSUPPORTED_CHECK" and d.comparable is False
    assert "INHERITED_ACCOUNT_UNSUPPORTED" in d.explanation


def test_tolerance_is_clamped_to_documented_bounds():
    t = effective_tolerance(Tolerance(absolute=Decimal("1000"), relative=Decimal("0.5")))
    assert t.absolute == Decimal("25.00") and t.relative == Decimal("0.01")
    t2 = effective_tolerance(Tolerance(absolute=Decimal("0.50"), relative=Decimal("0")))
    assert t2.absolute == Decimal("0.50") and t2.relative == Decimal("0")
    d = _classify(_imp(amount="25098.84"), tol=Tolerance(absolute=Decimal("0.50"), relative=Decimal("0")))
    assert d.classification != "WITHIN_TOLERANCE"
