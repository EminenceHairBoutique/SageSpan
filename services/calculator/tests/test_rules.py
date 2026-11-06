from __future__ import annotations

import re
from decimal import Decimal

from app.financial.rules import ALL_RULE_SETS, UNIFORM_LIFETIME_TABLE_2022, get_rule_set, published_rule_sets, uniform_lifetime_factor

HEX64 = re.compile(r"^[0-9a-f]{64}$")


def test_uniform_table_values_and_monotonicity():
    assert uniform_lifetime_factor(72) == Decimal("27.4")
    assert uniform_lifetime_factor(73) == Decimal("26.5")
    assert uniform_lifetime_factor(74) == Decimal("25.5")
    assert uniform_lifetime_factor(75) == Decimal("24.6")
    assert uniform_lifetime_factor(80) == Decimal("20.2")
    assert uniform_lifetime_factor(90) == Decimal("12.2")
    assert uniform_lifetime_factor(100) == Decimal("6.4")
    assert uniform_lifetime_factor(120) == Decimal("2.0")
    assert uniform_lifetime_factor(135) == Decimal("2.0")
    assert uniform_lifetime_factor(71) is None
    ages = sorted(UNIFORM_LIFETIME_TABLE_2022)
    assert ages == list(range(72, 121))
    for a, b in zip(ages, ages[1:]):
        assert UNIFORM_LIFETIME_TABLE_2022[a] > UNIFORM_LIFETIME_TABLE_2022[b]


def test_checksums_are_stable_sha256_and_unique():
    sums = [r.checksum for r in ALL_RULE_SETS]
    assert all(HEX64.match(s) for s in sums)
    assert len(set(sums)) == len(sums)
    assert get_rule_set("rmd.uniform_lifetime_table").checksum == get_rule_set("rmd.uniform_lifetime_table").checksum


def test_published_and_draft_are_distinct():
    pub = {r.rule_set_id for r in published_rule_sets()}
    assert "rmd.uniform_lifetime_table" in pub
    assert "tax.federal_ordinary_income" not in pub
    assert get_rule_set("tax.federal_ordinary_income").status == "DRAFT"


def test_rule_sets_cite_sources():
    for r in ALL_RULE_SETS:
        if r.rule_set_id != "rmd.comparison_tolerance":
            assert r.sources, r.rule_set_id
            assert all(s.citation for s in r.sources)


def test_effective_dating():
    assert get_rule_set("rmd.uniform_lifetime_table").is_effective_for_year(2026)
    assert not get_rule_set("rmd.uniform_lifetime_table").is_effective_for_year(2021)
    assert get_rule_set("tax.federal_ordinary_income").is_effective_for_year(2026)
    assert not get_rule_set("tax.federal_ordinary_income").is_effective_for_year(2027)
