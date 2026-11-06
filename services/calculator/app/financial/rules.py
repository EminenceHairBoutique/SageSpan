"""Versioned, effective-dated financial rule registry.

Every rule set carries: identifier, semantic version, lifecycle status
(PUBLISHED | DRAFT), effective window, primary sources, parameters and a
SHA-256 checksum of its canonical content. Receipts cite the exact rule set
versions and checksums used in a run, so a packet can be re-verified later.

DRAFT rule sets are never used by published endpoints.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal
from typing import Any, Literal

from .canonical import canonical_hash

RuleStatus = Literal["PUBLISHED", "DRAFT"]


@dataclass(frozen=True)
class RuleSource:
    title: str
    citation: str
    url: str | None = None

    def as_dict(self) -> dict[str, Any]:
        return {"title": self.title, "citation": self.citation, "url": self.url}


@dataclass(frozen=True)
class RuleSet:
    rule_set_id: str
    version: str
    status: RuleStatus
    effective_from: date
    effective_to: date | None
    description: str
    sources: tuple[RuleSource, ...]
    parameters: dict[str, Any] = field(default_factory=dict)
    limitations: tuple[str, ...] = ()

    @property
    def checksum(self) -> str:
        return canonical_hash(
            {
                "rule_set_id": self.rule_set_id,
                "version": self.version,
                "effective_from": self.effective_from,
                "effective_to": self.effective_to,
                "parameters": self.parameters,
                "sources": [s.as_dict() for s in self.sources],
            }
        )

    def ref(self) -> dict[str, Any]:
        return {
            "rule_set_id": self.rule_set_id,
            "version": self.version,
            "status": self.status,
            "checksum": self.checksum,
            "effective_from": self.effective_from,
            "effective_to": self.effective_to,
            "sources": [s.as_dict() for s in self.sources],
        }

    def is_effective_for_year(self, tax_year: int) -> bool:
        start = date(tax_year, 1, 1)
        if self.effective_from > start:
            return False
        if self.effective_to is not None and self.effective_to < start:
            return False
        return True


# ---------------------------------------------------------------------------
# IRS Uniform Lifetime Table (Pub 590-B, Appendix B, Table III), for
# distribution calendar years beginning on or after 1 January 2022
# (Treas. Reg. 1.401(a)(9)-9(c), T.D. 9930).
# ---------------------------------------------------------------------------
UNIFORM_LIFETIME_TABLE_2022: dict[int, Decimal] = {
    72: Decimal("27.4"), 73: Decimal("26.5"), 74: Decimal("25.5"), 75: Decimal("24.6"),
    76: Decimal("23.7"), 77: Decimal("22.9"), 78: Decimal("22.0"), 79: Decimal("21.1"),
    80: Decimal("20.2"), 81: Decimal("19.4"), 82: Decimal("18.5"), 83: Decimal("17.7"),
    84: Decimal("16.8"), 85: Decimal("16.0"), 86: Decimal("15.2"), 87: Decimal("14.4"),
    88: Decimal("13.7"), 89: Decimal("12.9"), 90: Decimal("12.2"), 91: Decimal("11.5"),
    92: Decimal("10.8"), 93: Decimal("10.1"), 94: Decimal("9.5"), 95: Decimal("8.9"),
    96: Decimal("8.4"), 97: Decimal("7.8"), 98: Decimal("7.3"), 99: Decimal("6.8"),
    100: Decimal("6.4"), 101: Decimal("6.0"), 102: Decimal("5.6"), 103: Decimal("5.2"),
    104: Decimal("4.9"), 105: Decimal("4.6"), 106: Decimal("4.3"), 107: Decimal("4.1"),
    108: Decimal("3.9"), 109: Decimal("3.7"), 110: Decimal("3.5"), 111: Decimal("3.4"),
    112: Decimal("3.3"), 113: Decimal("3.1"), 114: Decimal("3.0"), 115: Decimal("2.9"),
    116: Decimal("2.8"), 117: Decimal("2.7"), 118: Decimal("2.5"), 119: Decimal("2.3"),
    120: Decimal("2.0"),
}
UNIFORM_TABLE_MAX_AGE = 120

PUB_590B = RuleSource(
    title="IRS Publication 590-B, Distributions from Individual Retirement Arrangements (IRAs)",
    citation="Appendix B, Table III (Uniform Lifetime); 'When Must You Withdraw Assets? (Required Minimum Distributions)'",
    url="https://www.irs.gov/publications/p590b",
)
REG_LIFE_EXPECTANCY = RuleSource(
    title="Treasury Regulation 1.401(a)(9)-9",
    citation="Life expectancy and distribution period tables (T.D. 9930), effective for distribution calendar years beginning on or after January 1, 2022",
    url="https://www.ecfr.gov/current/title-26/section-1.401(a)(9)-9",
)
SECURE_2 = RuleSource(
    title="SECURE 2.0 Act of 2022 (Pub. L. 117-328, Div. T), section 107",
    citation="Increase in age for required beginning date for mandatory distributions; IRC 401(a)(9)(C)(v)",
    url="https://www.congress.gov/bill/117th-congress/house-bill/2617",
)
IRC_401A9 = RuleSource(
    title="Internal Revenue Code section 401(a)(9)",
    citation="Required distributions; required beginning date (401(a)(9)(C)); section 408(a)(6) applies these rules to IRAs",
    url="https://www.law.cornell.edu/uscode/text/26/401",
)
REV_PROC_2025_32 = RuleSource(
    title="IRS Rev. Proc. 2025-32",
    citation="Tax year 2026 inflation adjustments: ordinary income rate tables and standard deduction",
    url="https://www.irs.gov/pub/irs-drop/rp-25-32.pdf",
)

RMD_UNIFORM_LIFETIME_TABLE = RuleSet(
    rule_set_id="rmd.uniform_lifetime_table",
    version="2022.1",
    status="PUBLISHED",
    effective_from=date(2022, 1, 1),
    effective_to=None,
    description="Uniform Lifetime Table (Table III) distribution periods by owner age attained in the distribution year.",
    sources=(PUB_590B, REG_LIFE_EXPECTANCY),
    parameters={"table": {str(k): str(v) for k, v in UNIFORM_LIFETIME_TABLE_2022.items()}, "max_age": UNIFORM_TABLE_MAX_AGE},
    limitations=(
        "Applies only when the owner is alive, the account is not inherited, and the Joint Life and Last Survivor table is not required.",
    ),
)

RMD_APPLICABLE_AGE = RuleSet(
    rule_set_id="rmd.applicable_age",
    version="2023.1",
    status="PUBLISHED",
    effective_from=date(2023, 1, 1),
    effective_to=None,
    description="Applicable age for lifetime RMDs by owner birth date (SECURE 2.0 section 107).",
    sources=(SECURE_2, IRC_401A9, PUB_590B),
    parameters={
        "bands": [
            {"born_before": "1949-07-01", "applicable_age": "70.5"},
            {"born_from": "1949-07-01", "born_to": "1950-12-31", "applicable_age": "72"},
            {"born_from": "1951-01-01", "born_to": "1959-12-31", "applicable_age": "73"},
            {"born_from": "1960-01-01", "applicable_age": "75"},
        ]
    },
)

RMD_REQUIRED_BEGINNING_DATE = RuleSet(
    rule_set_id="rmd.required_beginning_date",
    version="2023.1",
    status="PUBLISHED",
    effective_from=date(2023, 1, 1),
    effective_to=None,
    description="First-year RMD may be deferred to April 1 of the year following the year the owner attains the applicable age; each later year's RMD is due December 31 of that year. The deferred first-year RMD and the second-year RMD are separate obligations.",
    sources=(IRC_401A9, PUB_590B),
    parameters={"first_year_deadline": "APRIL_1_FOLLOWING_YEAR", "subsequent_deadline": "DECEMBER_31_SAME_YEAR"},
)

RMD_SPOUSE_JOINT_TABLE_ELIGIBILITY = RuleSet(
    rule_set_id="rmd.spouse_joint_table_eligibility",
    version="2022.1",
    status="PUBLISHED",
    effective_from=date(2022, 1, 1),
    effective_to=None,
    description="If the owner's spouse is the sole primary beneficiary for the entire distribution year and is more than 10 years younger, the Joint Life and Last Survivor Expectancy Table (Table II) applies instead of Table III. Table II is NOT implemented; such cases return UNSUPPORTED.",
    sources=(PUB_590B, REG_LIFE_EXPECTANCY),
    parameters={"spouse_age_gap_years_threshold": "10", "joint_table_implemented": False},
    limitations=("Joint Life and Last Survivor table lookups are not implemented in this engine version.",),
)

RMD_COMPARISON_TOLERANCE = RuleSet(
    rule_set_id="rmd.comparison_tolerance",
    version="1.0",
    status="PUBLISHED",
    effective_from=date(2024, 1, 1),
    effective_to=None,
    description="Default tolerance for comparing an independently computed RMD with an imported plan value: within tolerance when |difference| <= max(absolute, relative * computed). Firms may tighten but not loosen beyond documented bounds.",
    sources=(),
    parameters={"absolute_usd": "1.00", "relative": "0.001", "max_absolute_usd": "25.00", "max_relative": "0.01"},
)

TAX_FEDERAL_ORDINARY_2026 = RuleSet(
    rule_set_id="tax.federal_ordinary_income",
    version="2026.0-draft",
    status="DRAFT",
    effective_from=date(2026, 1, 1),
    effective_to=date(2026, 12, 31),
    description="Narrow federal ordinary-income progressive tax on taxable ordinary income for SINGLE and MARRIED_FILING_JOINTLY using 2026 rate tables and standard deduction. DRAFT: table values must be re-verified against Rev. Proc. 2025-32 before publication.",
    sources=(REV_PROC_2025_32,),
    parameters={
        "standard_deduction": {"SINGLE": "16100", "MARRIED_FILING_JOINTLY": "32200"},
        "brackets": {
            "SINGLE": [["12400", "0.10"], ["50400", "0.12"], ["105700", "0.22"], ["201775", "0.24"], ["256225", "0.32"], ["640600", "0.35"], [None, "0.37"]],
            "MARRIED_FILING_JOINTLY": [["24800", "0.10"], ["100800", "0.12"], ["211400", "0.22"], ["403550", "0.24"], ["512450", "0.32"], ["768700", "0.35"], [None, "0.37"]],
        },
    },
    limitations=(
        "Ordinary income only. Not supported: capital gains/qualified dividend rates, Social Security benefit taxation, AMT, NIIT, QBI deduction, additional senior deduction, itemized deductions, credits, phase-outs, state tax.",
    ),
)

ALL_RULE_SETS: tuple[RuleSet, ...] = (
    RMD_UNIFORM_LIFETIME_TABLE,
    RMD_APPLICABLE_AGE,
    RMD_REQUIRED_BEGINNING_DATE,
    RMD_SPOUSE_JOINT_TABLE_ELIGIBILITY,
    RMD_COMPARISON_TOLERANCE,
    TAX_FEDERAL_ORDINARY_2026,
)

RMD_RULE_SETS: tuple[RuleSet, ...] = (
    RMD_UNIFORM_LIFETIME_TABLE,
    RMD_APPLICABLE_AGE,
    RMD_REQUIRED_BEGINNING_DATE,
    RMD_SPOUSE_JOINT_TABLE_ELIGIBILITY,
    RMD_COMPARISON_TOLERANCE,
)


def published_rule_sets() -> list[RuleSet]:
    return [r for r in ALL_RULE_SETS if r.status == "PUBLISHED"]


def get_rule_set(rule_set_id: str, version: str | None = None) -> RuleSet | None:
    for r in ALL_RULE_SETS:
        if r.rule_set_id == rule_set_id and (version is None or r.version == version):
            return r
    return None


def uniform_lifetime_factor(age: int) -> Decimal | None:
    """Return the Table III distribution period for an attained age, or None if below table range."""
    if age < min(UNIFORM_LIFETIME_TABLE_2022):
        return None
    if age >= UNIFORM_TABLE_MAX_AGE:
        return UNIFORM_LIFETIME_TABLE_2022[UNIFORM_TABLE_MAX_AGE]
    return UNIFORM_LIFETIME_TABLE_2022[age]
