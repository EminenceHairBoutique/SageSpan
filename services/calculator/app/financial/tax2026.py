"""DRAFT (P1): narrow 2026 federal ordinary-income tax on taxable ordinary income.

Status: DRAFT rule set `tax.federal_ordinary_income@2026.0-draft`. Not exposed by
any published endpoint. Table values are transcribed from IRS Rev. Proc.
2025-32 and must be re-verified before publication. Supports SINGLE and
MARRIED_FILING_JOINTLY with the standard deduction only, and returns an
explicit `not_supported` list. This is NOT a complete federal tax calculation.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal
from typing import Literal

from .money import round_cents
from .rules import TAX_FEDERAL_ORDINARY_2026

FilingStatus = Literal["SINGLE", "MARRIED_FILING_JOINTLY"]

NOT_SUPPORTED: tuple[str, ...] = (
    "capital gains and qualified dividend preferential rates",
    "Social Security benefit taxation",
    "alternative minimum tax (AMT)",
    "net investment income tax (NIIT)",
    "qualified business income (QBI) deduction",
    "additional senior deduction and additional standard deduction for age/blindness",
    "itemized deductions, credits, phase-outs and dependents",
    "state and local taxes",
    "filing statuses other than SINGLE and MARRIED_FILING_JOINTLY",
)


@dataclass(frozen=True)
class BracketLine:
    rate: Decimal
    lower: Decimal
    upper: Decimal | None
    taxable_in_bracket: Decimal
    tax: Decimal


CHECK_TYPE = "base_tax_on_taxable_ordinary_income"


@dataclass
class FederalOrdinaryTaxResult:
    filing_status: FilingStatus
    ordinary_income: Decimal
    standard_deduction: Decimal
    taxable_income: Decimal
    tax: Decimal
    marginal_rate: Decimal
    breakdown: list[BracketLine] = field(default_factory=list)
    check_type: str = CHECK_TYPE
    rule_set_id: str = TAX_FEDERAL_ORDINARY_2026.rule_set_id
    rule_set_version: str = TAX_FEDERAL_ORDINARY_2026.version
    rule_set_status: str = TAX_FEDERAL_ORDINARY_2026.status
    not_supported: tuple[str, ...] = NOT_SUPPORTED


def _brackets(status: FilingStatus) -> list[tuple[Decimal | None, Decimal]]:
    raw = TAX_FEDERAL_ORDINARY_2026.parameters["brackets"][status]
    return [(Decimal(top) if top is not None else None, Decimal(rate)) for top, rate in raw]


def compute_federal_ordinary_tax_2026(ordinary_income: Decimal, filing_status: FilingStatus) -> FederalOrdinaryTaxResult:
    if filing_status not in ("SINGLE", "MARRIED_FILING_JOINTLY"):
        raise ValueError("unsupported filing status")
    if ordinary_income < 0:
        raise ValueError("ordinary income must be non-negative")
    std = Decimal(TAX_FEDERAL_ORDINARY_2026.parameters["standard_deduction"][filing_status])
    taxable = max(Decimal("0"), ordinary_income - std)
    lines: list[BracketLine] = []
    lower = Decimal("0")
    total = Decimal("0")
    marginal = Decimal("0.10")
    for top, rate in _brackets(filing_status):
        if taxable <= lower:
            break
        upper = top
        portion = (min(taxable, upper) if upper is not None else taxable) - lower
        if portion <= 0:
            break
        tax = portion * rate
        lines.append(BracketLine(rate=rate, lower=lower, upper=upper, taxable_in_bracket=portion, tax=round_cents(tax)))
        total += tax
        marginal = rate
        if upper is None:
            break
        lower = upper
    return FederalOrdinaryTaxResult(filing_status=filing_status, ordinary_income=ordinary_income, standard_deduction=std, taxable_income=taxable, tax=round_cents(total), marginal_rate=marginal, breakdown=lines)
