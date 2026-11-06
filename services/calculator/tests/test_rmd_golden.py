from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest

from app.financial.rmd import applicable_age_for, assess, first_distribution_year, required_beginning_date
from tests.conftest import patel_payload, patel_request


def test_patel_golden_640000_over_25_5_is_25098_04(patel):
    a = assess(patel)
    assert a.eligibility.status == "SUPPORTED"
    assert a.factor == Decimal("25.5")
    assert a.annual_rmd == Decimal("25098.04")
    assert a.eligibility.owner_age_in_tax_year == 74
    assert a.eligibility.applicable_age == "73"
    assert a.eligibility.first_distribution_year == 2025
    assert a.eligibility.required_beginning_date == date(2026, 4, 1)
    annual = [e for e in a.events if e.event_type == "ANNUAL_RMD"][0]
    assert annual.amount == Decimal("25098.04")
    assert annual.deadline == date(2026, 12, 31)
    assert annual.table_id == "rmd.uniform_lifetime_table@2022.1"
    assert "640000.00 / 25.5" in (a.formula or "")


def test_rounding_is_half_up_to_cents():
    # 640000 / 25.5 = 25098.0392... -> 25098.04 ; 100000 / 25.5 = 3921.5686 -> 3921.57
    req = patel_request(account={**patel_payload()["account"], "prior_year_end_balance": {"amount": "100000.00", "currency": "USD", "as_of_date": "2025-12-31"}})
    assert assess(req).annual_rmd == Decimal("3921.57")
    # exact half-cent rounds up: 25.5 * 0.005 = 0.1275 -> balance 0.1275 / 25.5 = 0.005 -> 0.01
    req2 = patel_request(account={**patel_payload()["account"], "prior_year_end_balance": {"amount": "0.1275", "currency": "USD", "as_of_date": "2025-12-31"}})
    assert assess(req2).annual_rmd == Decimal("0.01")


def test_rmd_monotonic_in_balance_for_fixed_factor():
    previous = Decimal("-1")
    for balance in range(50_000, 2_000_001, 37_500):
        req = patel_request(account={**patel_payload()["account"], "prior_year_end_balance": {"amount": f"{balance}.00", "currency": "USD", "as_of_date": "2025-12-31"}})
        amount = assess(req).annual_rmd
        assert amount is not None and amount > previous
        previous = amount


def test_mismatched_as_of_date_is_indeterminate_not_an_error(patel):
    req = patel_request(account={**patel_payload()["account"], "prior_year_end_balance": {"amount": "640000.00", "currency": "USD", "as_of_date": "2025-11-30"}})
    a = assess(req)
    assert a.eligibility.status == "INDETERMINATE"
    codes = {r.code for r in a.eligibility.reasons}
    assert codes == {"BALANCE_AS_OF_MISMATCH"}
    assert a.annual_rmd is None
    assert "not evidence of an error" in a.eligibility.reasons[0].message


def test_sole_spouse_beneficiary_more_than_10_years_younger_is_unsupported():
    bens = [{"person_ref": "sp", "relationship": "SPOUSE", "designation_type": "PRIMARY", "share_percent": "100", "birth_date": "1965-01-01", "sole_primary_entire_year": True}]
    a = assess(patel_request(beneficiaries=bens))
    assert a.eligibility.status == "UNSUPPORTED"
    assert "JOINT_LIFE_TABLE_REQUIRED_NOT_IMPLEMENTED" in {r.code for r in a.eligibility.reasons}
    assert a.annual_rmd is None


def test_spouse_exactly_10_years_younger_uses_uniform_table():
    bens = [{"person_ref": "sp", "relationship": "SPOUSE", "designation_type": "PRIMARY", "share_percent": "100", "birth_date": "1962-03-14", "sole_primary_entire_year": True}]
    a = assess(patel_request(beneficiaries=bens))
    assert a.eligibility.status == "SUPPORTED"
    assert a.annual_rmd == Decimal("25098.04")


def test_spouse_not_sole_beneficiary_uses_uniform_table_even_if_much_younger():
    bens = [
        {"person_ref": "sp", "relationship": "SPOUSE", "designation_type": "PRIMARY", "share_percent": "50", "birth_date": "1970-01-01", "sole_primary_entire_year": False},
        {"person_ref": "kid", "relationship": "NON_SPOUSE_INDIVIDUAL", "designation_type": "PRIMARY", "share_percent": "50", "birth_date": "1985-01-01", "sole_primary_entire_year": False},
    ]
    a = assess(patel_request(beneficiaries=bens))
    assert a.eligibility.status == "SUPPORTED"


def test_sole_beneficiary_status_unknown_is_indeterminate():
    bens = [{"person_ref": "sp", "relationship": "SPOUSE", "designation_type": "PRIMARY", "share_percent": "100", "birth_date": "1970-01-01", "sole_primary_entire_year": None}]
    a = assess(patel_request(beneficiaries=bens))
    assert a.eligibility.status == "INDETERMINATE"
    assert "MISSING_SOLE_BENEFICIARY_STATUS" in {r.code for r in a.eligibility.reasons}


def test_missing_beneficiary_designation_is_indeterminate():
    a = assess(patel_request(beneficiaries=None))
    assert a.eligibility.status == "INDETERMINATE"
    assert "MISSING_BENEFICIARY_DESIGNATION" in {r.code for r in a.eligibility.reasons}


def test_inherited_ira_is_unsupported():
    a = assess(patel_request(account={**patel_payload()["account"], "is_inherited": True}))
    assert a.eligibility.status == "UNSUPPORTED"
    assert "INHERITED_ACCOUNT_UNSUPPORTED" in {r.code for r in a.eligibility.reasons}
    assert a.annual_rmd is None


def test_missing_material_balance_is_indeterminate():
    acct = {k: v for k, v in patel_payload()["account"].items() if k != "prior_year_end_balance"}
    a = assess(patel_request(account=acct))
    assert a.eligibility.status == "INDETERMINATE"
    assert "MISSING_PRIOR_YEAR_END_BALANCE" in {r.code for r in a.eligibility.reasons}


def test_missing_birth_date_and_flags_are_indeterminate():
    a = assess(patel_request(owner={"person_ref": "p", "birth_date": None, "is_alive": None}, account={"account_ref": "a", "account_type": None, "is_inherited": None, "prior_year_end_balance": {"amount": "1.00", "currency": "USD", "as_of_date": "2025-12-31"}}))
    codes = {r.code for r in a.eligibility.reasons}
    assert a.eligibility.status == "INDETERMINATE"
    assert {"MISSING_BIRTH_DATE", "MISSING_OWNER_ALIVE_STATUS", "MISSING_ACCOUNT_TYPE", "MISSING_INHERITED_FLAG"} <= codes


@pytest.mark.parametrize("account_type,code", [("ROTH_IRA", "ROTH_IRA_NO_LIFETIME_RMD"), ("EMPLOYER_401K", "ACCOUNT_TYPE_UNSUPPORTED")])
def test_unsupported_account_types(account_type, code):
    a = assess(patel_request(account={**patel_payload()["account"], "account_type": account_type}))
    assert a.eligibility.status == "UNSUPPORTED"
    assert code in {r.code for r in a.eligibility.reasons}


def test_deceased_owner_is_unsupported():
    a = assess(patel_request(owner={"person_ref": "p", "birth_date": "1952-03-14", "is_alive": False}))
    assert a.eligibility.status == "UNSUPPORTED"


def test_not_yet_required_for_owner_below_applicable_age():
    a = assess(patel_request(owner={"person_ref": "p", "birth_date": "1960-05-05", "is_alive": True}))
    assert a.eligibility.status == "NOT_REQUIRED"
    assert a.eligibility.applicable_age == "75"
    assert a.eligibility.first_distribution_year == 2035
    assert a.annual_rmd is None


def test_deferred_first_rmd_is_separate_event_from_annual():
    acct = {**patel_payload()["account"], "prior_prior_year_end_balance": {"amount": "610000.00", "currency": "USD", "as_of_date": "2024-12-31"}}
    a = assess(patel_request(account=acct, first_rmd_election={"deferred_first_rmd_to_april_1": True, "first_rmd_satisfied_in_first_year": False}))
    assert a.eligibility.status == "SUPPORTED"
    by_type = {e.event_type: e for e in a.events}
    annual, deferred = by_type["ANNUAL_RMD"], by_type["DEFERRED_FIRST_YEAR_RMD"]
    assert annual.distribution_year == 2026 and annual.deadline == date(2026, 12, 31) and annual.amount == Decimal("25098.04")
    assert deferred.distribution_year == 2025 and deferred.deadline == date(2026, 4, 1)
    assert deferred.status == "COMPUTED" and deferred.amount == Decimal("23018.87")  # 610000 / 26.5
    assert deferred.factor == Decimal("26.5") and deferred.owner_age == 73
    assert annual.amount != deferred.amount
    assert a.annual_rmd == Decimal("25098.04")  # the annual figure never absorbs the deferred one


def test_deferred_first_rmd_without_basis_balance_is_indeterminate_event():
    a = assess(patel_request(first_rmd_election={"deferred_first_rmd_to_april_1": True, "first_rmd_satisfied_in_first_year": False}))
    deferred = [e for e in a.events if e.event_type == "DEFERRED_FIRST_YEAR_RMD"][0]
    assert deferred.status == "INDETERMINATE"
    assert "MISSING_FIRST_YEAR_BASIS_BALANCE" in {r.code for r in deferred.reasons}
    assert a.annual_rmd == Decimal("25098.04")


def test_first_year_election_not_recorded_flags_separate_event():
    a = assess(patel_request(first_rmd_election=None))
    deferred = [e for e in a.events if e.event_type == "DEFERRED_FIRST_YEAR_RMD"][0]
    assert deferred.status == "INDETERMINATE"
    assert "FIRST_YEAR_ELECTION_NOT_RECORDED" in {r.code for r in deferred.reasons}


def test_first_distribution_year_deadline_is_april_1_following_year():
    # Born 1953 -> turns 73 in 2026 -> first distribution year 2026, deadline 2027-04-01.
    a = assess(patel_request(owner={"person_ref": "p", "birth_date": "1953-02-02", "is_alive": True}))
    annual = [e for e in a.events if e.event_type == "ANNUAL_RMD"][0]
    assert annual.deadline == date(2027, 4, 1)
    assert "FIRST_DISTRIBUTION_YEAR" in {r.code for r in annual.reasons}
    assert len(a.events) == 1


@pytest.mark.parametrize(
    "birth,label,fdy",
    [
        (date(1949, 6, 30), "70.5", 2019),
        (date(1949, 7, 1), "72", 2021),
        (date(1950, 12, 31), "72", 2022),
        (date(1951, 1, 1), "73", 2024),
        (date(1952, 3, 14), "73", 2025),
        (date(1959, 12, 31), "73", 2032),
        (date(1960, 1, 1), "75", 2035),
    ],
)
def test_applicable_age_bands(birth, label, fdy):
    assert applicable_age_for(birth).label == label
    assert first_distribution_year(birth) == fdy
    assert required_beginning_date(birth) == date(fdy + 1, 4, 1)
