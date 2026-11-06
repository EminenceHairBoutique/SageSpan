"""Deterministic debt payoff path comparison (PERS-002 engine, first slice).

Methodology ``personal.debt_amortization@2026.1`` (methods.py). Monthly
amortisation on identical inputs under several ordering strategies, with a fixed
total monthly debt budget. The engine reports the arithmetic; it never picks a
strategy for the user and never allows a payment that skips a stated minimum.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from ..schemas_personal import DebtPathsRequest, Flag, LiabilityInput, LiquidityGuard, MonthRow, PayoffEvent, Strategy, StrategyResult
from .cashflow import add_months
from .money import ZERO, round_cents

HYBRID_SMALL_BALANCE = Decimal("1000.00")
HUNDRED = Decimal("100")
TWELVE = Decimal("12")

DEBT_LIMITATIONS = (
    "Illustrative amortisation on the stated balances, APRs and minimums; not a recommendation to refinance, consolidate or change any payment.",
    "Interest accrues monthly at APR/12 on the opening balance and is rounded to cents each month; lender daily-balance methods, fees, grace periods and rate changes are not modelled.",
    "Variable rates are held constant; promotional rates apply until their stated expiry.",
    "Required minimum payments are always paid in full before any extra payment is directed anywhere.",
)


@dataclass
class _Open:
    ref: str
    balance: Decimal
    apr: Decimal
    promo_apr: Decimal | None
    promo_expires: date | None
    minimum: Decimal


def periodic_rate(liab: _Open, month_start: date) -> Decimal:
    apr = liab.apr
    if liab.promo_apr is not None and liab.promo_expires is not None and month_start < liab.promo_expires:
        apr = liab.promo_apr
    return apr / HUNDRED / TWELVE


def order_targets(opens: list[_Open], strategy: Strategy) -> list[_Open]:
    if strategy == "AVALANCHE":
        return sorted(opens, key=lambda o: (-o.apr, o.balance, o.ref))
    if strategy == "SNOWBALL":
        return sorted(opens, key=lambda o: (o.balance, -o.apr, o.ref))
    if strategy == "HYBRID":
        small = sorted([o for o in opens if o.balance <= HYBRID_SMALL_BALANCE], key=lambda o: (o.balance, o.ref))
        rest = sorted([o for o in opens if o.balance > HYBRID_SMALL_BALANCE], key=lambda o: (-o.apr, o.balance, o.ref))
        return small + rest
    return sorted(opens, key=lambda o: o.ref)  # MINIMUMS_ONLY: order is irrelevant


def simulate(liabilities: list[LiabilityInput], budget: Decimal, strategy: Strategy, as_of: date, max_months: int) -> StrategyResult:
    opens = [_Open(ref=x.liability_ref, balance=x.balance, apr=x.apr_percent, promo_apr=x.promo_apr_percent, promo_expires=x.promo_apr_expires, minimum=x.minimum_payment) for x in liabilities if x.balance > ZERO]
    total_minimums = sum((o.minimum for o in opens), ZERO)
    total_interest = ZERO
    total_paid = ZERO
    payoff: list[PayoffEvent] = []
    rows: list[MonthRow] = []
    if budget < total_minimums:
        return StrategyResult(strategy=strategy, feasible=False, infeasible_reason="BUDGET_BELOW_MINIMUMS", total_interest=ZERO, total_paid=ZERO)
    month = 0
    while opens and month < max_months:
        month += 1
        month_start = add_months(as_of, month - 1)
        opening_total = sum((o.balance for o in opens), ZERO)
        month_interest = ZERO
        month_payment = ZERO
        # 1) accrue interest
        for o in opens:
            interest = round_cents(o.balance * periodic_rate(o, month_start))
            o.balance += interest
            month_interest += interest
        # 2) minimums (capped at what is owed)
        available = budget
        for o in opens:
            pay = min(o.minimum, o.balance)
            o.balance -= pay
            available -= pay
            month_payment += pay
        # 3) extra toward targets in strategy order, rolling surplus forward
        if strategy != "MINIMUMS_ONLY":
            for target in order_targets(opens, strategy):
                if available <= ZERO:
                    break
                pay = min(available, target.balance)
                target.balance -= pay
                available -= pay
                month_payment += pay
        total_interest += month_interest
        total_paid += month_payment
        closed = [o for o in opens if o.balance <= ZERO]
        for o in sorted(closed, key=lambda o: o.ref):
            payoff.append(PayoffEvent(liability_ref=o.ref, month_index=month, payoff_date=add_months(as_of, month)))
        opens = [o for o in opens if o.balance > ZERO]
        if month <= 12:
            rows.append(MonthRow(month_index=month, month_start=month_start, opening_total_balance=round_cents(opening_total), interest=round_cents(month_interest), payment=round_cents(month_payment), closing_total_balance=round_cents(sum((o.balance for o in opens), ZERO))))
    if opens:
        return StrategyResult(strategy=strategy, feasible=False, infeasible_reason="NOT_PAID_OFF_WITHIN_MAX_MONTHS", months_to_payoff=None, total_interest=round_cents(total_interest), total_paid=round_cents(total_paid), payoff_order=payoff, first_year=rows)
    return StrategyResult(strategy=strategy, feasible=True, months_to_payoff=month, payoff_date=add_months(as_of, month), total_interest=round_cents(total_interest), total_paid=round_cents(total_paid), payoff_order=payoff, first_year=rows)


def compute_debt_paths(req: DebtPathsRequest) -> tuple[LiquidityGuard, list[StrategyResult], list[str], list[Flag], str]:
    total_minimums = sum((x.minimum_payment for x in req.liabilities if x.balance > ZERO), ZERO)
    budget = req.monthly_debt_budget if req.monthly_debt_budget is not None else total_minimums + (req.extra_monthly_payment or ZERO)
    liquid_cash = req.liquid_cash if req.liquid_cash is not None else sum((a.balance for a in req.cash_accounts if a.liquid), ZERO)
    headroom = liquid_cash - req.policy.cash_floor
    guard = LiquidityGuard(
        liquid_cash=round_cents(liquid_cash),
        cash_floor=round_cents(req.policy.cash_floor),
        headroom=round_cents(headroom),
        floor_respected=headroom >= ZERO,
        budget_covers_minimums=budget >= total_minimums,
        total_minimums=round_cents(total_minimums),
        extra_per_month=round_cents(max(ZERO, budget - total_minimums)),
    )
    strategies: list[Strategy] = list(dict.fromkeys(["MINIMUMS_ONLY", *req.strategies]))  # baseline always computed first, deduplicated
    results = [simulate(req.liabilities, budget, s, req.as_of_date, req.max_months) for s in strategies]
    baseline = results[0]
    for r in results[1:]:
        if r.feasible and baseline.feasible:
            r.interest_saved_vs_minimums = round_cents(baseline.total_interest - r.total_interest)
            r.months_saved_vs_minimums = (baseline.months_to_payoff or 0) - (r.months_to_payoff or 0)
    if "MINIMUMS_ONLY" not in req.strategies:
        results = results[1:] if len(results) > 1 else results
    assumptions = [
        "Balances, APRs and minimum payments are as reported on the as-of date; no new charges are added.",
        "The monthly debt budget is held constant for the whole horizon.",
    ]
    flags: list[Flag] = []
    if not guard.budget_covers_minimums:
        flags.append(Flag(code="BUDGET_BELOW_MINIMUMS", severity="HIGH", message="The stated monthly budget does not cover the required minimum payments. No strategy is feasible on these inputs.", refs=[x.liability_ref for x in req.liabilities]))
    if not guard.floor_respected:
        flags.append(Flag(code="CASH_BELOW_FLOOR", severity="HIGH", message="Liquid cash is below your cash floor; extra debt payments from savings would breach it.", refs=[]))
    for x in req.liabilities:
        if x.rate_type == "VARIABLE":
            assumptions.append(f"{x.label or x.liability_ref}: variable rate held constant at {x.apr_percent}%.")
        if x.promo_apr_percent is not None and x.promo_apr_expires is not None:
            assumptions.append(f"{x.label or x.liability_ref}: {x.promo_apr_percent}% promotional APR until {x.promo_apr_expires.isoformat()}, then {x.apr_percent}%.")
    status = "COMPUTED" if any(r.feasible for r in results) else "INFEASIBLE"
    return guard, results, assumptions, flags, status
