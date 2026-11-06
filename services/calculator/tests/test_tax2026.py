from __future__ import annotations

from decimal import Decimal

import pytest

from app.financial.tax2026 import compute_federal_ordinary_tax_2026


def test_single_60000_ordinary_income_draft_tables():
    r = compute_federal_ordinary_tax_2026(Decimal("60000"), "SINGLE")
    assert r.standard_deduction == Decimal("16100")
    assert r.taxable_income == Decimal("43900")
    # 12400 * 10% + (43900 - 12400) * 12% = 1240 + 3780
    assert r.tax == Decimal("5020.00")
    assert r.marginal_rate == Decimal("0.12")
    assert r.rule_set_status == "DRAFT"
    assert r.check_type == "base_tax_on_taxable_ordinary_income"
    assert r.not_supported and any("Social Security" in s for s in r.not_supported)


def test_mfj_100000_ordinary_income_draft_tables():
    r = compute_federal_ordinary_tax_2026(Decimal("100000"), "MARRIED_FILING_JOINTLY")
    assert r.taxable_income == Decimal("67800")
    assert r.tax == Decimal("7640.00")  # 24800*.10 + 43000*.12


def test_income_below_standard_deduction_is_zero_tax():
    r = compute_federal_ordinary_tax_2026(Decimal("10000"), "SINGLE")
    assert r.taxable_income == Decimal("0") and r.tax == Decimal("0.00") and r.breakdown == []


def test_top_bracket_reached():
    r = compute_federal_ordinary_tax_2026(Decimal("1000000"), "SINGLE")
    assert r.marginal_rate == Decimal("0.37")
    assert r.breakdown[-1].upper is None


def test_rejects_unsupported_status_and_negative_income():
    with pytest.raises(ValueError):
        compute_federal_ordinary_tax_2026(Decimal("1"), "HEAD_OF_HOUSEHOLD")  # type: ignore[arg-type]
    with pytest.raises(ValueError):
        compute_federal_ordinary_tax_2026(Decimal("-1"), "SINGLE")
