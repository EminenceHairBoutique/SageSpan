"""Compare an independently computed RMD with an imported plan value.

Principle: a mismatch is not labelled an error until source inputs and
methodology are normalised. Classification order is documented in
docs/FINANCIAL_METHODOLOGY.md and tested in tests/test_checks.py.
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal

from ..schemas import Discrepancy, ImportedComparison, Tolerance
from .money import round_cents
from .rmd import Assessment
from .rules import RMD_COMPARISON_TOLERANCE

_DEFAULT_ABS = Decimal(RMD_COMPARISON_TOLERANCE.parameters["absolute_usd"])
_DEFAULT_REL = Decimal(RMD_COMPARISON_TOLERANCE.parameters["relative"])
_MAX_ABS = Decimal(RMD_COMPARISON_TOLERANCE.parameters["max_absolute_usd"])
_MAX_REL = Decimal(RMD_COMPARISON_TOLERANCE.parameters["max_relative"])


def effective_tolerance(tol: Tolerance | None) -> Tolerance:
    """Clamp a requested tolerance to the documented bounds (firms may tighten, not loosen)."""
    if tol is None:
        return Tolerance(absolute=_DEFAULT_ABS, relative=_DEFAULT_REL)
    return Tolerance(absolute=min(max(tol.absolute, Decimal("0")), _MAX_ABS), relative=min(max(tol.relative, Decimal("0")), _MAX_REL))


def classify(
    assessment: Assessment,
    imported: ImportedComparison | None,
    tax_year: int,
    tolerance: Tolerance | None,
    prior_year_end_balance: Decimal | None,
    prior_year_end_as_of: date | None,
) -> Discrepancy:
    tol = effective_tolerance(tolerance)
    computed = assessment.annual_rmd

    if imported is None:
        return Discrepancy(
            classification="MISSING_EVIDENCE", comparable=False, computed_amount=computed,
            explanation="No imported plan value was supplied for this account and tax year, so there is nothing to compare against.",
            next_step="Import the planning tool's RMD figure (with its declared inputs) to enable a comparison.",
        )

    base = dict(
        import_value_ref=imported.import_value_ref,
        imported_amount=round_cents(imported.amount),
        computed_amount=computed,
        tolerance_absolute=tol.absolute,
        tolerance_relative=tol.relative,
    )

    if assessment.eligibility.status != "SUPPORTED" or computed is None:
        codes = "; ".join(r.code for r in assessment.eligibility.reasons)
        return Discrepancy(
            classification="UNSUPPORTED_CHECK", comparable=False,
            explanation=f"The independent check returned {assessment.eligibility.status}; the imported amount cannot be compared. Reasons: {codes}",
            next_step="Resolve the listed reasons (missing inputs or an unsupported rule situation) before relying on either figure.",
            **base,
        )

    if imported.tax_year != tax_year:
        return Discrepancy(classification="NOT_COMPARABLE", comparable=False, explanation=f"Imported value is for tax year {imported.tax_year}; the check is for {tax_year}.", next_step="Import the plan value for the same tax year.", **base)
    if imported.currency != "USD":
        return Discrepancy(classification="NOT_COMPARABLE", comparable=False, explanation="Imported value is not in USD.", next_step="Import a USD figure.", **base)
    if imported.calculation_scope in ("AGGREGATE_ALL_IRAS", "OTHER"):
        return Discrepancy(
            classification="NOT_COMPARABLE", comparable=False,
            explanation=f"Imported value scope is {imported.calculation_scope}; the independent check is a single-account annual RMD. Aggregated or other-scope figures cannot be compared one-to-one.",
            next_step="Import the single-account figure or document the aggregation method.", **base,
        )
    if imported.balance_basis == "PROJECTED" or imported.assumptions.get("balance_basis", "").upper() == "PROJECTED":
        return Discrepancy(
            classification="NOT_COMPARABLE", comparable=False,
            explanation="Imported value was computed on a projected balance rather than the actual prior year-end balance; the assumptions differ materially.",
            next_step="Re-run the plan on the actual 31 December balance or document the projection basis.", **base,
        )

    decl = imported.declared_inputs
    diff = round_cents(computed - imported.amount)
    applied = max(tol.absolute, round_cents(tol.relative * computed))
    within = abs(diff) <= applied
    base.update(difference=diff, tolerance_applied=applied)

    if within:
        return Discrepancy(
            classification="WITHIN_TOLERANCE", comparable=True,
            explanation=f"Computed {computed} vs imported {round_cents(imported.amount)}; |difference| {abs(diff)} is within the applied tolerance {applied}.",
            next_step="No action required on the amount; record the comparison in the evidence packet.", **base,
        )

    if decl is not None and decl.balance is not None and prior_year_end_balance is not None and round_cents(decl.balance) != round_cents(prior_year_end_balance):
        if decl.balance_as_of is not None and prior_year_end_as_of is not None and decl.balance_as_of < prior_year_end_as_of:
            return Discrepancy(
                classification="STALE_INPUT", comparable=True,
                explanation=f"The plan computed from a balance of {round_cents(decl.balance)} as of {decl.balance_as_of.isoformat()}, which is older than the confirmed {prior_year_end_as_of.isoformat()} balance of {round_cents(prior_year_end_balance)}. A different as-of date is not by itself an error.",
                next_step="Refresh the plan with the confirmed year-end balance and re-import.", **base,
            )
        return Discrepancy(
            classification="SOURCE_CONFLICT", comparable=True,
            explanation=f"The plan's declared input balance {round_cents(decl.balance)} differs from the confirmed prior year-end balance {round_cents(prior_year_end_balance)} used by the independent check. The amount difference is attributable to the input, not to the rule.",
            next_step="Resolve the balance at the source level (custodian statement governs) and re-run the plan with the confirmed balance.", **base,
        )

    if decl is not None and decl.factor is not None and assessment.factor is not None and decl.factor != assessment.factor:
        return Discrepancy(
            classification="RULE_DISAGREEMENT", comparable=True,
            explanation=f"Inputs match but the plan applied divisor {decl.factor} where the Uniform Lifetime Table gives {assessment.factor} for the owner's attained age. The rule application differs.",
            next_step="Check the table/age used by the planning tool; confirm which table governs.", **base,
        )

    if decl is not None and decl.method and decl.method.upper() not in ("DIRECT_DIVISION", "BALANCE_DIVIDED_BY_FACTOR"):
        return Discrepancy(
            classification="METHODOLOGY_DIFFERENCE", comparable=True,
            explanation=f"The plan declares method '{decl.method}', which differs from direct division of the year-end balance by the table factor.",
            next_step="Document the plan's methodology; if intentional, record an exception with rationale.", **base,
        )

    if decl is None or (decl.balance is None and decl.factor is None):
        return Discrepancy(
            classification="MISSING_EVIDENCE", comparable=True,
            explanation=f"Computed {computed} differs from imported {round_cents(imported.amount)} by {diff}, but the import carries no declared inputs, so the difference cannot yet be attributed to a source, rule or method.",
            next_step="Obtain the plan's input balance, table and factor, then re-classify.", **base,
        )

    return Discrepancy(
        classification="RULE_DISAGREEMENT", comparable=True,
        explanation=f"Inputs and method are normalised, yet computed {computed} differs from imported {round_cents(imported.amount)} by {diff} (beyond tolerance {applied}).",
        next_step="Escalate to review: the rule application in the planning tool disagrees with the independent check.", **base,
    )
