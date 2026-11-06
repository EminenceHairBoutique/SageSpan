"""Decimal-safe money helpers.

Rounding policy: ROUND_HALF_UP to cents, applied once at the end of a
calculation (never on intermediate values). Documented in
docs/FINANCIAL_METHODOLOGY.md.
"""
from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal, InvalidOperation, getcontext

getcontext().prec = 34

CENT = Decimal("0.01")
ZERO = Decimal("0")


def to_decimal(value: str | int | float | Decimal) -> Decimal:
    """Convert to Decimal without binary-float contamination.

    Floats are converted via their shortest repr string so that 0.1 -> Decimal('0.1').
    """
    if isinstance(value, Decimal):
        return value
    if isinstance(value, float):
        return Decimal(repr(value))
    try:
        return Decimal(str(value))
    except InvalidOperation as exc:  # pragma: no cover - defensive
        raise ValueError(f"not a decimal value: {value!r}") from exc


def round_cents(value: Decimal) -> Decimal:
    """Round to cents using ROUND_HALF_UP (banker's rounding is NOT used)."""
    return value.quantize(CENT, rounding=ROUND_HALF_UP)


def money_str(value: Decimal) -> str:
    return f"{round_cents(value):.2f}"


def is_positive(value: Decimal) -> bool:
    return value > ZERO


def format_usd(value: Decimal) -> str:
    """Display form for human-readable messages, e.g. Decimal('2399') -> '$2,399.00'.

    Messages only. Structured response fields stay plain decimal strings.
    """
    q = round_cents(value)
    sign = "-" if q < 0 else ""
    return f"{sign}${abs(q):,.2f}"
