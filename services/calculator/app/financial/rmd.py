"""Required Minimum Distribution (RMD) engine - P0 scope.

Supported: lifetime RMD for a living owner of a non-inherited traditional,
SEP or SIMPLE IRA for a distribution calendar year >= 2022, using the Uniform
Lifetime Table (Table III).

Returns typed UNSUPPORTED / INDETERMINATE assessments instead of guessing
whenever an exception may apply or an input is missing. This module does not
claim to cover every IRS exception; see docs/FINANCIAL_METHODOLOGY.md.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal

from ..schemas import Eligibility, ObligationEvent, Reason, RmdCheckRequest
from .money import money_str, round_cents
from .rules import RMD_UNIFORM_LIFETIME_TABLE, uniform_lifetime_factor

UNIFORM_TABLE_ID = f"{RMD_UNIFORM_LIFETIME_TABLE.rule_set_id}@{RMD_UNIFORM_LIFETIME_TABLE.version}"
SUPPORTED_ACCOUNT_TYPES = {"TRADITIONAL_IRA", "SEP_IRA", "SIMPLE_IRA"}


@dataclass
class ApplicableAge:
    label: str            # "70.5" | "72" | "73" | "75"
    whole_years: int      # 70, 72, 73, 75
    half_year: bool       # True only for the legacy 70 1/2 rule


def applicable_age_for(birth_date: date) -> ApplicableAge:
    """SECURE 2.0 section 107 bands (rule set rmd.applicable_age@2023.1)."""
    if birth_date < date(1949, 7, 1):
        return ApplicableAge("70.5", 70, True)
    if birth_date <= date(1950, 12, 31):
        return ApplicableAge("72", 72, False)
    if birth_date <= date(1959, 12, 31):
        return ApplicableAge("73", 73, False)
    return ApplicableAge("75", 75, False)


def first_distribution_year(birth_date: date) -> int:
    """Calendar year in which the owner attains the applicable age."""
    aa = applicable_age_for(birth_date)
    if aa.half_year:
        # 70 1/2 = six calendar months after the 70th birthday.
        y, m = birth_date.year + 70, birth_date.month + 6
        if m > 12:
            y, m = y + 1, m - 12
        return y
    return birth_date.year + aa.whole_years


def required_beginning_date(birth_date: date) -> date:
    return date(first_distribution_year(birth_date) + 1, 4, 1)


def attained_age(birth_date: date, year: int) -> int:
    return year - birth_date.year


def _spouse_more_than_10_years_younger(owner_birth: date, spouse_birth: date, tax_year: int) -> bool:
    """IRS applies the Joint table when the spouse is more than 10 years younger, measured by attained ages in the distribution year."""
    return attained_age(owner_birth, tax_year) - attained_age(spouse_birth, tax_year) > 10


@dataclass
class Assessment:
    eligibility: Eligibility
    factor: Decimal | None = None
    annual_rmd: Decimal | None = None
    events: list[ObligationEvent] = field(default_factory=list)
    formula: str | None = None
    inputs_used: dict = field(default_factory=dict)


def _reason(code: str, message: str, rule_ref: str | None = None) -> Reason:
    return Reason(code=code, message=message, rule_ref=rule_ref)


def assess(req: RmdCheckRequest) -> Assessment:
    """Assess eligibility and, when supported, compute the RMD obligations for the tax year."""
    unsupported: list[Reason] = []
    indeterminate: list[Reason] = []
    owner, acct = req.owner, req.account
    ty = req.tax_year

    # ---- Hard unsupported conditions ---------------------------------------
    if acct.is_inherited is True:
        unsupported.append(_reason("INHERITED_ACCOUNT_UNSUPPORTED", "Inherited accounts use beneficiary distribution rules (10-year rule, eligible designated beneficiary life expectancy, etc.) that this engine does not implement.", "rmd.uniform_lifetime_table"))
    if owner.is_alive is False:
        unsupported.append(_reason("DECEASED_OWNER_UNSUPPORTED", "Year-of-death and post-death distribution rules are not implemented.", "rmd.uniform_lifetime_table"))
    if acct.account_type is not None and acct.account_type not in SUPPORTED_ACCOUNT_TYPES:
        if acct.account_type == "ROTH_IRA":
            unsupported.append(_reason("ROTH_IRA_NO_LIFETIME_RMD", "Roth IRA owners have no lifetime RMD; this check covers traditional-family IRAs only and does not assert a Roth result.", "rmd.uniform_lifetime_table"))
        else:
            unsupported.append(_reason("ACCOUNT_TYPE_UNSUPPORTED", f"Account type {acct.account_type} is outside P0 scope (employer plans have still-working and plan-specific rules).", "rmd.uniform_lifetime_table"))
    if acct.outstanding_rollover_adjustment is not None and acct.outstanding_rollover_adjustment != Decimal("0"):
        unsupported.append(_reason("ROLLOVER_ADJUSTMENT_UNSUPPORTED", "Outstanding rollover / recharacterization add-backs are not implemented.", "rmd.uniform_lifetime_table"))
    if acct.prior_year_end_balance is not None and acct.prior_year_end_balance.currency != "USD":
        unsupported.append(_reason("NON_USD_UNSUPPORTED", "Only USD balances are supported.", None))

    # ---- Missing inputs -> INDETERMINATE -----------------------------------
    if owner.birth_date is None:
        indeterminate.append(_reason("MISSING_BIRTH_DATE", "Owner birth date is required to determine the applicable age and table factor.", "rmd.applicable_age"))
    if owner.is_alive is None:
        indeterminate.append(_reason("MISSING_OWNER_ALIVE_STATUS", "Owner living status must be recorded (confirmed or an explicit documented assumption).", None))
    if acct.account_type is None:
        indeterminate.append(_reason("MISSING_ACCOUNT_TYPE", "Account type is required.", None))
    if acct.is_inherited is None:
        indeterminate.append(_reason("MISSING_INHERITED_FLAG", "Whether the account is inherited must be recorded.", None))
    expected_as_of = date(ty - 1, 12, 31)
    if acct.prior_year_end_balance is None:
        indeterminate.append(_reason("MISSING_PRIOR_YEAR_END_BALANCE", f"Prior year-end balance as of {expected_as_of.isoformat()} is required.", "rmd.uniform_lifetime_table"))
    elif acct.prior_year_end_balance.as_of_date != expected_as_of:
        indeterminate.append(_reason("BALANCE_AS_OF_MISMATCH", f"The balance provided is as of {acct.prior_year_end_balance.as_of_date.isoformat()}, but the {ty} RMD must use the balance as of {expected_as_of.isoformat()}. A different as-of date is not evidence of an error; reconcile the correct year-end value.", "rmd.uniform_lifetime_table"))
    if req.beneficiaries is None:
        indeterminate.append(_reason("MISSING_BENEFICIARY_DESIGNATION", "Beneficiary designation is required to rule out the Joint Life and Last Survivor table (spouse sole beneficiary more than 10 years younger).", "rmd.spouse_joint_table_eligibility"))

    # ---- Spouse / joint table check ----------------------------------------
    table_id = UNIFORM_TABLE_ID
    if req.beneficiaries is not None and owner.birth_date is not None:
        primaries = [b for b in req.beneficiaries if b.designation_type == "PRIMARY"]
        for sp in [b for b in primaries if b.relationship == "SPOUSE"]:
            sole = sp.sole_primary_entire_year
            if sole is None:
                indeterminate.append(_reason("MISSING_SOLE_BENEFICIARY_STATUS", "Whether the spouse was the sole primary beneficiary for the entire year must be recorded.", "rmd.spouse_joint_table_eligibility"))
                continue
            if sole:
                if sp.birth_date is None:
                    indeterminate.append(_reason("MISSING_SPOUSE_BIRTH_DATE", "Spouse birth date is required when the spouse is the sole primary beneficiary.", "rmd.spouse_joint_table_eligibility"))
                elif _spouse_more_than_10_years_younger(owner.birth_date, sp.birth_date, ty):
                    unsupported.append(_reason("JOINT_LIFE_TABLE_REQUIRED_NOT_IMPLEMENTED", "The spouse is the sole primary beneficiary and more than 10 years younger, so the Joint Life and Last Survivor Expectancy Table (Table II) governs. Table II is not implemented; the Uniform Lifetime factor must not be used.", "rmd.spouse_joint_table_eligibility"))

    # ---- Decide status ------------------------------------------------------
    if unsupported:
        elig = Eligibility(status="UNSUPPORTED", reasons=unsupported + indeterminate)
        return Assessment(eligibility=_fill_ages(elig, owner.birth_date, ty))
    if indeterminate:
        elig = Eligibility(status="INDETERMINATE", reasons=indeterminate)
        return Assessment(eligibility=_fill_ages(elig, owner.birth_date, ty))

    assert owner.birth_date is not None and acct.prior_year_end_balance is not None
    aa = applicable_age_for(owner.birth_date)
    fdy = first_distribution_year(owner.birth_date)
    rbd = required_beginning_date(owner.birth_date)
    age = attained_age(owner.birth_date, ty)

    if ty < fdy:
        elig = Eligibility(status="NOT_REQUIRED", applicable_age=aa.label, owner_age_in_tax_year=age, first_distribution_year=fdy, required_beginning_date=rbd, table_id=None,
                           reasons=[_reason("BELOW_APPLICABLE_AGE", f"Owner attains the applicable age ({aa.label}) in {fdy}; no lifetime RMD is required for {ty}.", "rmd.applicable_age")])
        return Assessment(eligibility=elig)

    factor = uniform_lifetime_factor(age)
    if factor is None:
        elig = Eligibility(status="UNSUPPORTED", applicable_age=aa.label, owner_age_in_tax_year=age, first_distribution_year=fdy, required_beginning_date=rbd,
                           reasons=[_reason("AGE_BELOW_TABLE_RANGE", f"Attained age {age} is below the implemented Uniform Lifetime Table range.", "rmd.uniform_lifetime_table")])
        return Assessment(eligibility=elig)

    balance = acct.prior_year_end_balance.amount
    raw = balance / factor
    annual = round_cents(raw)
    formula = f"{money_str(balance)} / {factor} = {raw:.6f} -> {money_str(annual)} (ROUND_HALF_UP to cents)"

    events: list[ObligationEvent] = []
    annual_deadline = date(ty, 12, 31) if ty > fdy else date(ty + 1, 4, 1)
    annual_reasons: list[Reason] = []
    if ty == fdy:
        annual_reasons.append(_reason("FIRST_DISTRIBUTION_YEAR", f"{ty} is the owner's first distribution year; this RMD may be deferred until the required beginning date {rbd.isoformat()}. If deferred, the {ty + 1} RMD is still due 31 December {ty + 1}.", "rmd.required_beginning_date"))
    events.append(ObligationEvent(event_type="ANNUAL_RMD", distribution_year=ty, deadline=annual_deadline, status="COMPUTED", amount=annual, basis_balance=balance, basis_as_of=acct.prior_year_end_balance.as_of_date, owner_age=age, factor=factor, table_id=table_id, formula=formula, reasons=annual_reasons))

    # Deferred first-year obligation (separate event) when ty == fdy + 1.
    if ty == fdy + 1:
        el = req.first_rmd_election
        deferred = el.deferred_first_rmd_to_april_1 if el else None
        satisfied = el.first_rmd_satisfied_in_first_year if el else None
        prior_age = age - 1
        prior_factor = uniform_lifetime_factor(prior_age)
        deadline = date(ty, 4, 1)
        if satisfied is True and not deferred:
            events.append(ObligationEvent(event_type="DEFERRED_FIRST_YEAR_RMD", distribution_year=fdy, deadline=deadline, status="REPORTED_SATISFIED_UNVERIFIED", owner_age=prior_age,
                                          reasons=[_reason("FIRST_RMD_REPORTED_TAKEN", f"The {fdy} first-year RMD is recorded as satisfied during {fdy}. This engine does not verify distributions taken.", "rmd.required_beginning_date")]))
        elif deferred is True:
            pp = acct.prior_prior_year_end_balance
            if pp is None or pp.as_of_date != date(fdy - 1, 12, 31) or prior_factor is None:
                events.append(ObligationEvent(event_type="DEFERRED_FIRST_YEAR_RMD", distribution_year=fdy, deadline=deadline, status="INDETERMINATE", owner_age=prior_age, factor=prior_factor, table_id=table_id,
                                              reasons=[_reason("MISSING_FIRST_YEAR_BASIS_BALANCE", f"The deferred {fdy} RMD is a separate obligation due {deadline.isoformat()} and must be valued on the balance as of {date(fdy - 1, 12, 31).isoformat()}, which was not provided.", "rmd.required_beginning_date")]))
            else:
                raw1 = pp.amount / prior_factor
                amt1 = round_cents(raw1)
                events.append(ObligationEvent(event_type="DEFERRED_FIRST_YEAR_RMD", distribution_year=fdy, deadline=deadline, status="COMPUTED", amount=amt1, basis_balance=pp.amount, basis_as_of=pp.as_of_date, owner_age=prior_age, factor=prior_factor, table_id=table_id,
                                              formula=f"{money_str(pp.amount)} / {prior_factor} = {raw1:.6f} -> {money_str(amt1)} (ROUND_HALF_UP to cents)",
                                              reasons=[_reason("DEFERRED_FIRST_YEAR_SEPARATE_OBLIGATION", f"The {fdy} first-year RMD was deferred and is due {deadline.isoformat()}; it is separate from, and additional to, the {ty} RMD due {date(ty, 12, 31).isoformat()}.", "rmd.required_beginning_date")]))
        else:
            events.append(ObligationEvent(event_type="DEFERRED_FIRST_YEAR_RMD", distribution_year=fdy, deadline=deadline, status="INDETERMINATE", owner_age=prior_age,
                                          reasons=[_reason("FIRST_YEAR_ELECTION_NOT_RECORDED", f"{fdy} was the first distribution year. Record whether the first-year RMD was taken in {fdy} or deferred to {deadline.isoformat()}; if deferred, it is a separate obligation from the {ty} RMD.", "rmd.required_beginning_date")]))

    elig = Eligibility(status="SUPPORTED", applicable_age=aa.label, owner_age_in_tax_year=age, first_distribution_year=fdy, required_beginning_date=rbd, table_id=table_id, reasons=[])
    inputs_used = {
        "tax_year": ty,
        "owner_birth_date": owner.birth_date.isoformat(),
        "owner_age_in_tax_year": age,
        "account_type": acct.account_type,
        "is_inherited": acct.is_inherited,
        "prior_year_end_balance": money_str(balance),
        "prior_year_end_balance_as_of": acct.prior_year_end_balance.as_of_date.isoformat(),
        "table_id": table_id,
        "factor": str(factor),
        "beneficiary_count": len(req.beneficiaries or []),
    }
    return Assessment(eligibility=elig, factor=factor, annual_rmd=annual, events=events, formula=formula, inputs_used=inputs_used)


def _fill_ages(elig: Eligibility, birth_date: date | None, ty: int) -> Eligibility:
    if birth_date is None:
        return elig
    aa = applicable_age_for(birth_date)
    return elig.model_copy(update={
        "applicable_age": aa.label,
        "owner_age_in_tax_year": attained_age(birth_date, ty),
        "first_distribution_year": first_distribution_year(birth_date),
        "required_beginning_date": required_beginning_date(birth_date),
    })


RMD_LIMITATIONS: tuple[str, ...] = (
    "Covers lifetime RMDs for living owners of non-inherited traditional, SEP and SIMPLE IRAs using the Uniform Lifetime Table only.",
    "Joint Life and Last Survivor table (spouse sole beneficiary more than 10 years younger) is not implemented; such cases are reported UNSUPPORTED.",
    "Inherited accounts, year-of-death rules, employer plans, Roth conversions, QCD offsets, aggregation across multiple IRAs and rollover add-backs are out of scope.",
    "The engine does not verify distributions actually taken, withholding or penalties; it computes the required amount from frozen inputs.",
    "SUPPORTED_VERIFIED denotes internal golden-test coverage of a published rule set; no external CPA or legal attestation has been obtained.",
    "This is an independent arithmetic check for professional review, not tax advice.",
)
