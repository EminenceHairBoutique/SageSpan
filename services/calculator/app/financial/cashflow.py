"""Deterministic personal cash-flow baseline (PERS-001 engine).

Methodology: ``personal.cashflow_baseline@2026.1`` (see methods.py). Everything
here is descriptive arithmetic on the supplied inputs. The engine never decides
what the user should do; the web tier's decision policy consumes these numbers,
and the user decides.

Conventions (all documented in the methodology set and FINANCIAL_METHODOLOGY.md):

* Income "typical" is the median of observed monthly totals, "low" the minimum.
* Obligations are normalised to a month by cadence (weekly 52/12, biweekly 26/12,
  quarterly 1/3, annual 1/12, one-time 0).
* Essential commitments = essential obligations (normalised) + typical essential
  variable spending. Discretionary = typical non-essential variable spending +
  non-essential obligations.
* The outlook is a day-by-day projection: start from liquid cash, add expected
  income on its dates (conservative: low observed month for IRREGULAR streams),
  subtract obligations on their due dates per cadence, and spread typical
  discretionary spending evenly per day over 30 days.
* Rounding happens once, at output (ROUND_HALF_UP to cents).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, timedelta
from decimal import Decimal
from typing import Iterable

from ..schemas_personal import (
    CashSummary,
    Collision,
    CommitmentSummary,
    DataQualityItem,
    DebtSummary,
    Flag,
    GoalSummary,
    IncomeSummary,
    IncomeStreamInput,
    MarginSummary,
    ObligationInput,
    Outlook,
    OutlookEvent,
    OutlookPoint,
    PersonalClarityRequest,
    Reliability,
)
from .money import ZERO, format_usd, round_cents

MONTHS_PER_YEAR = Decimal("12")
CADENCE_PER_YEAR: dict[str, Decimal] = {
    "WEEKLY": Decimal("52"),
    "BIWEEKLY": Decimal("26"),
    "MONTHLY": Decimal("12"),
    "QUARTERLY": Decimal("4"),
    "ANNUAL": Decimal("1"),
    "ONE_TIME": Decimal("0"),
}
CADENCE_DAYS: dict[str, int] = {"WEEKLY": 7, "BIWEEKLY": 14}
STALE_AFTER_DAYS = 45
MIN_MONTHS_FOR_PATTERN = 3
REGULAR_MAX_SPREAD = Decimal("0.10")
VARIABLE_MAX_SPREAD = Decimal("0.35")
COLLISION_WINDOW_DAYS = 7
DISCRETIONARY_SPREAD_DAYS = Decimal("30")
FOUR_DP = Decimal("0.0001")

CASHFLOW_LIMITATIONS = (
    "Descriptive baseline on user-reported inputs; inputs are not verified against statements by this engine.",
    "Not advice: the engine computes margins, buffers and dated projections only. Decisions belong to the user.",
    "The outlook models dated commitments and a flat discretionary spend; it does not forecast behaviour, interest, taxes, pending items or new income.",
    "No investment returns, tax, benefits eligibility, insurance or credit effects are modelled.",
)


# ----------------------------------------------------------------- helpers
def monthly_equivalent(amount: Decimal, cadence: str) -> Decimal:
    return amount * CADENCE_PER_YEAR[cadence] / MONTHS_PER_YEAR


def median(values: list[Decimal]) -> Decimal | None:
    if not values:
        return None
    s = sorted(values)
    n = len(s)
    mid = n // 2
    if n % 2 == 1:
        return s[mid]
    return (s[mid - 1] + s[mid]) / Decimal("2")


def classify_income(low: Decimal | None, high: Decimal | None, typical: Decimal | None, months: int) -> Reliability:
    if typical is None or low is None or high is None or months < MIN_MONTHS_FOR_PATTERN or typical <= ZERO:
        return "UNKNOWN"
    spread = (high - low) / typical
    if spread <= REGULAR_MAX_SPREAD:
        return "REGULAR"
    if spread <= VARIABLE_MAX_SPREAD:
        return "VARIABLE"
    return "IRREGULAR"


def add_months(d: date, months: int) -> date:
    """Calendar month arithmetic clamped to the last valid day (Jan 31 + 1 month -> Feb 28/29)."""
    y = d.year + (d.month - 1 + months) // 12
    m = (d.month - 1 + months) % 12 + 1
    last = [31, 29 if _leap(y) else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]
    return date(y, m, min(d.day, last))


def _leap(y: int) -> bool:
    return y % 4 == 0 and (y % 100 != 0 or y % 400 == 0)


def occurrences(first: date, cadence: str, start: date, end: date) -> Iterable[date]:
    """Dates on which a recurring item falls within [start, end], given its next occurrence `first` (which may be before start)."""
    if cadence == "ONE_TIME":
        if start <= first <= end:
            yield first
        return
    if cadence in CADENCE_DAYS:
        step = CADENCE_DAYS[cadence]
        d = first
        # roll forward to the window without iterating one by one from the distant past
        if d < start:
            n = ((start - d).days + step - 1) // step
            d = d + timedelta(days=n * step)
        while d <= end:
            yield d
            d += timedelta(days=step)
        return
    step_months = {"MONTHLY": 1, "QUARTERLY": 3, "ANNUAL": 12}[cadence]
    i = 0
    d = first
    while d <= end:
        if d >= start:
            yield d
        i += 1
        d = add_months(first, i * step_months)


def income_per_payment(stream: IncomeStreamInput) -> Decimal | None:
    """Expected amount per payment date for the outlook, from the stream's OWN observed months.

    Conservative by design: an IRREGULAR stream (declared, or classified from its
    own history) contributes its lowest observed month; otherwise the stated
    expected amount, else its median month scaled to the cadence.
    """
    if stream.cadence == "ONE_TIME":
        return stream.expected_amount
    per_year = CADENCE_PER_YEAR[stream.cadence]
    if per_year == ZERO:
        return None
    own = stream.observed_monthly_amounts
    own_typical = median(own)
    own_low = min(own) if own else None
    own_high = max(own) if own else None
    irregular = stream.reliability == "IRREGULAR" or classify_income(own_low, own_high, own_typical, len(own)) == "IRREGULAR"
    if irregular and own_low is not None:
        return own_low * MONTHS_PER_YEAR / per_year
    if stream.expected_amount is not None:
        return stream.expected_amount
    if own_typical is not None:
        return own_typical * MONTHS_PER_YEAR / per_year
    return None


# ----------------------------------------------------------------- engine
@dataclass
class ClarityComputation:
    income: IncomeSummary
    commitments: CommitmentSummary
    margin: MarginSummary
    cash: CashSummary
    debt: DebtSummary
    outlook: Outlook
    goals: list[GoalSummary]
    flags: list[Flag]
    data_quality: list[DataQualityItem]
    result_status: str
    inputs_used: dict = field(default_factory=dict)


def compute_clarity(req: PersonalClarityRequest, income_blackouts: dict[str, tuple[date, date]] | None = None) -> ClarityComputation:  # noqa: C901 - deliberately linear and explicit
    """`income_blackouts` maps stream_ref -> [start, end) during which that stream pays nothing (scenario engine only)."""
    blackouts = income_blackouts or {}
    flags: list[Flag] = []
    dq: list[DataQualityItem] = []
    as_of = req.as_of_date

    # --- data quality: carried states plus derived staleness
    for a in req.cash_accounts:
        state = a.data_state
        if (as_of - a.balance_as_of).days > STALE_AFTER_DAYS and state not in ("MISSING", "CONFLICTING"):
            state = "STALE"
            flags.append(Flag(code="STALE_BALANCE", severity="MEDIUM", message=f"Balance for {a.label or a.account_ref} is dated {a.balance_as_of.isoformat()}, more than {STALE_AFTER_DAYS} days before {as_of.isoformat()}.", refs=[a.account_ref]))
        dq.append(DataQualityItem(ref=a.account_ref, state=state))
    for s in req.income_streams:
        dq.append(DataQualityItem(ref=s.stream_ref, state=s.data_state))
    for o in req.obligations:
        dq.append(DataQualityItem(ref=o.obligation_ref, state=o.data_state))
    for liab in req.liabilities:
        dq.append(DataQualityItem(ref=liab.liability_ref, state=liab.data_state))

    # --- income statistics across streams (sum per observed month index, aligned from the most recent month)
    stream_series = [s.observed_monthly_amounts for s in req.income_streams if s.observed_monthly_amounts]
    observed_months = max((len(x) for x in stream_series), default=0)
    monthly_totals: list[Decimal] = []
    for i in range(observed_months):
        total = ZERO
        for series in stream_series:
            # align on the most recent month: index from the end
            idx = len(series) - observed_months + i
            if idx >= 0:
                total += series[idx]
        monthly_totals.append(total)
    typical = median(monthly_totals)
    low = min(monthly_totals) if monthly_totals else None
    high = max(monthly_totals) if monthly_totals else None
    spread = ((high - low) / typical).quantize(FOUR_DP) if (typical and typical > ZERO and high is not None and low is not None) else None
    classification = classify_income(low, high, typical, observed_months)
    if observed_months and observed_months < MIN_MONTHS_FOR_PATTERN:
        flags.append(Flag(code="SHORT_INCOME_HISTORY", severity="LOW", message=f"Only {observed_months} observed month(s) of income; patterns need at least {MIN_MONTHS_FOR_PATTERN}.", refs=[s.stream_ref for s in req.income_streams]))
    if classification == "IRREGULAR":
        flags.append(Flag(code="IRREGULAR_INCOME", severity="MEDIUM", message="Observed monthly income varies widely; the outlook uses each irregular stream's lowest observed month.", refs=[s.stream_ref for s in req.income_streams]))
    income = IncomeSummary(
        observed_months=observed_months,
        typical_monthly=round_cents(typical) if typical is not None else None,
        low_monthly=round_cents(low) if low is not None else None,
        high_monthly=round_cents(high) if high is not None else None,
        spread_ratio=spread,
        classification=classification,
    )

    # --- commitments
    essential_obl = sum((monthly_equivalent(o.amount, o.cadence) for o in req.obligations if o.essential), ZERO)
    discretionary_obl = sum((monthly_equivalent(o.amount, o.cadence) for o in req.obligations if not o.essential), ZERO)
    essential_var = sum(((median(v.observed_monthly_amounts) or ZERO) for v in req.variable_spending if v.essential), ZERO)
    discretionary_var = sum(((median(v.observed_monthly_amounts) or ZERO) for v in req.variable_spending if not v.essential), ZERO)
    debt_minimums = sum((liab.minimum_payment for liab in req.liabilities), ZERO)
    monthly_essential = essential_obl + essential_var
    monthly_discretionary = discretionary_obl + discretionary_var
    commitments = CommitmentSummary(
        monthly_essential=round_cents(monthly_essential),
        monthly_discretionary_typical=round_cents(monthly_discretionary),
        monthly_debt_minimums=round_cents(debt_minimums),
        essential_items=sum(1 for o in req.obligations if o.essential) + sum(1 for v in req.variable_spending if v.essential),
        discretionary_items=sum(1 for o in req.obligations if not o.essential) + sum(1 for v in req.variable_spending if not v.essential),
    )
    if not req.obligations and not req.variable_spending:
        flags.append(Flag(code="MISSING_EXPENSE_DATA", severity="HIGH", message="No obligations or spending were supplied; margin and buffer cannot be interpreted.", refs=[]))

    # --- margin
    margin = MarginSummary(
        typical=round_cents(typical - monthly_essential - monthly_discretionary) if typical is not None else None,
        low=round_cents(low - monthly_essential - monthly_discretionary) if low is not None else None,
        essential_only_low=round_cents(low - monthly_essential) if low is not None else None,
    )
    if margin.low is not None and margin.low < ZERO:
        flags.append(Flag(code="NEGATIVE_MARGIN_LOW_MONTH", severity="HIGH", message="In a low-income month, commitments plus typical discretionary spending exceed income.", refs=[]))
    elif margin.typical is not None and margin.typical < ZERO:
        flags.append(Flag(code="NEGATIVE_MARGIN_TYPICAL", severity="HIGH", message="Typical monthly commitments and spending exceed typical income.", refs=[]))

    # --- cash
    liquid_total = sum((a.balance for a in req.cash_accounts if a.liquid), ZERO)
    floor = req.policy.cash_floor
    buffer_months = (liquid_total / monthly_essential).quantize(Decimal("0.01")) if monthly_essential > ZERO else None
    target = req.policy.buffer_target_months
    gap = None
    if target is not None and monthly_essential > ZERO:
        gap = round_cents(max(ZERO, target * monthly_essential - liquid_total))
    cash = CashSummary(
        liquid_total=round_cents(liquid_total),
        cash_floor=round_cents(floor),
        above_floor=round_cents(liquid_total - floor),
        essential_buffer_months=buffer_months,
        buffer_target_months=target,
        buffer_gap_amount=gap,
    )
    if liquid_total < floor:
        flags.append(Flag(code="CASH_BELOW_FLOOR", severity="HIGH", message="Liquid cash is already below the cash floor you chose.", refs=[a.account_ref for a in req.cash_accounts if a.liquid]))
    if buffer_months is not None and buffer_months < Decimal("1"):
        flags.append(Flag(code="BUFFER_BELOW_ONE_MONTH", severity="HIGH", message="Liquid cash covers less than one month of essential commitments.", refs=[]))
    elif target is not None and gap is not None and gap > ZERO:
        flags.append(Flag(code="BUFFER_BELOW_TARGET", severity="MEDIUM", message=f"Liquid cash is {format_usd(gap)} below your {target}-month essential buffer target.", refs=[]))
    if not req.cash_accounts:
        flags.append(Flag(code="MISSING_CASH_BALANCES", severity="HIGH", message="No cash balances were supplied; buffer and outlook start from zero.", refs=[]))

    # --- debt
    total_balance = sum((liab.balance for liab in req.liabilities), ZERO)
    highest = max(req.liabilities, key=lambda liab: liab.apr_percent, default=None)
    weighted = (sum((liab.balance * liab.apr_percent for liab in req.liabilities), ZERO) / total_balance).quantize(Decimal("0.01")) if total_balance > ZERO else None
    debt = DebtSummary(
        liability_count=len(req.liabilities),
        total_balance=round_cents(total_balance),
        total_minimums=round_cents(debt_minimums),
        highest_apr_percent=highest.apr_percent if highest else None,
        highest_apr_ref=highest.liability_ref if highest else None,
        balance_weighted_apr_percent=weighted,
    )
    for liab in req.liabilities:
        if liab.apr_percent >= Decimal("20"):
            flags.append(Flag(code="HIGH_APR_DEBT", severity="MEDIUM", message=f"{liab.label or liab.liability_ref} carries a {liab.apr_percent}% APR.", refs=[liab.liability_ref]))
        if liab.rate_type == "VARIABLE":
            flags.append(Flag(code="VARIABLE_RATE_DEBT", severity="LOW", message=f"{liab.label or liab.liability_ref} has a variable rate; projections hold it constant.", refs=[liab.liability_ref]))
        if liab.promo_apr_expires is not None and ZERO <= Decimal((liab.promo_apr_expires - as_of).days) <= Decimal(req.horizon_days):
            flags.append(Flag(code="PROMO_APR_EXPIRING", severity="MEDIUM", message=f"The promotional rate on {liab.label or liab.liability_ref} expires {liab.promo_apr_expires.isoformat()}.", refs=[liab.liability_ref]))

    # --- outlook
    end = as_of + timedelta(days=req.horizon_days)
    events_by_day: dict[date, list[OutlookEvent]] = {}

    def push(d: date, ev: OutlookEvent) -> None:
        events_by_day.setdefault(d, []).append(ev)

    for s in req.income_streams:
        amt = income_per_payment(s)
        if amt is None or s.next_expected_date is None:
            if s.cadence != "ONE_TIME" and s.next_expected_date is None:
                flags.append(Flag(code="INCOME_DATE_UNKNOWN", severity="LOW", message=f"No next expected date for {s.label or s.stream_ref}; it is excluded from the dated outlook.", refs=[s.stream_ref]))
            continue
        window = blackouts.get(s.stream_ref)
        for d in occurrences(s.next_expected_date, s.cadence, as_of, end):
            if window is not None and window[0] <= d < window[1]:
                continue
            push(d, OutlookEvent(date=d, ref=s.stream_ref, kind="INCOME", amount=round_cents(amt)))
    for o in req.obligations:
        for d in occurrences(o.next_due_date, o.cadence, as_of, end):
            push(d, OutlookEvent(date=d, ref=o.obligation_ref, kind="OBLIGATION", amount=-round_cents(o.amount), essential=o.essential))
    daily_discretionary = monthly_discretionary / DISCRETIONARY_SPREAD_DAYS

    running = liquid_total
    lowest = running
    lowest_date = as_of
    breaches: list[date] = []
    points: list[OutlookPoint] = []
    d = as_of
    while d <= end:
        day_events = events_by_day.get(d, [])
        for ev in day_events:
            running += ev.amount
        running -= daily_discretionary
        if day_events or d == end:
            points.append(OutlookPoint(date=d, projected_cash=round_cents(running), events=day_events))
        if running < lowest:
            lowest, lowest_date = running, d
        if running < floor and (day_events or d == end):
            breaches.append(d)
        d += timedelta(days=1)

    # collisions: essential obligations whose due dates fall within a rolling window
    ess_events = sorted(((dd, ev) for dd, evs in events_by_day.items() for ev in evs if ev.kind == "OBLIGATION" and ev.essential), key=lambda t: t[0])
    collisions: list[Collision] = []
    i = 0
    while i < len(ess_events):
        start_d, _ = ess_events[i]
        window = [ev for dd, ev in ess_events if start_d <= dd <= start_d + timedelta(days=COLLISION_WINDOW_DAYS - 1)]
        if len(window) >= 2:
            total_due = -sum((ev.amount for ev in window), ZERO)
            # a collision matters when the window's total exceeds a quarter of monthly essentials
            if monthly_essential > ZERO and total_due > monthly_essential / Decimal("4"):
                collisions.append(Collision(window_start=start_d, window_end=start_d + timedelta(days=COLLISION_WINDOW_DAYS - 1), total_due=round_cents(total_due), refs=[ev.ref for ev in window]))
                i += len(window)
                continue
        i += 1
    if breaches:
        flags.append(Flag(code="FLOOR_BREACH_PROJECTED", severity="HIGH", message=f"The dated outlook drops below your cash floor on {breaches[0].isoformat()}.", refs=[]))
    # One flag per distinct set of colliding bills. A monthly pair (e.g. rent on the 1st and a loan on the 5th)
    # collides every month; repeating the same warning for each month is noise, so it is grouped.
    # The full list of windows stays available in outlook.collisions.
    grouped: dict[tuple[str, ...], list[Collision]] = {}
    for c in collisions:
        grouped.setdefault(tuple(sorted(c.refs)), []).append(c)
    for refs, group in list(grouped.items())[:3]:
        first = group[0]
        if len(group) == 1:
            msg = f"{len(first.refs)} essential payments totalling {format_usd(first.total_due)} fall between {first.window_start.isoformat()} and {first.window_end.isoformat()}."
        else:
            msg = (
                f"{len(first.refs)} essential payments totalling {format_usd(first.total_due)} land in the same week "
                f"{len(group)} times in the next {req.horizon_days} days, next between {first.window_start.isoformat()} and {first.window_end.isoformat()}."
            )
        flags.append(Flag(code="BILL_COLLISION", severity="MEDIUM", message=msg, refs=list(first.refs)))

    outlook = Outlook(
        horizon_days=req.horizon_days,
        start_cash=round_cents(liquid_total),
        lowest_projected_cash=round_cents(lowest),
        lowest_projected_date=lowest_date,
        end_projected_cash=round_cents(running),
        floor_breach_dates=breaches,
        first_floor_breach_date=breaches[0] if breaches else None,
        collisions=collisions,
        points=points,
    )

    # --- goals
    goals: list[GoalSummary] = []
    for g in req.goals:
        remaining = max(ZERO, g.target_amount - g.saved_amount)
        months = None
        on_track = None
        if g.monthly_contribution and g.monthly_contribution > ZERO and remaining > ZERO:
            q = remaining / g.monthly_contribution
            months = int(q) + (1 if q != q.to_integral_value() else 0)  # ceil (Decimal // truncates, so do it explicitly)
            if g.target_date is not None:
                on_track = add_months(as_of, months) <= g.target_date
        elif remaining == ZERO:
            months = 0
            on_track = True
        goals.append(GoalSummary(goal_ref=g.goal_ref, label=g.label, target_amount=round_cents(g.target_amount), saved_amount=round_cents(g.saved_amount), remaining_amount=round_cents(remaining), months_to_target_at_contribution=months, on_track_for_target_date=on_track))

    insufficient = observed_months == 0 or (not req.obligations and not req.variable_spending) or not req.cash_accounts
    result_status = "INSUFFICIENT_DATA" if insufficient else "COMPUTED"

    inputs_used = {
        "as_of_date": as_of,
        "horizon_days": req.horizon_days,
        "cash_floor": str(floor),
        "buffer_target_months": str(target) if target is not None else None,
        "cash_accounts": len(req.cash_accounts),
        "income_streams": len(req.income_streams),
        "observed_months": observed_months,
        "obligations": len(req.obligations),
        "variable_spending_categories": len(req.variable_spending),
        "liabilities": len(req.liabilities),
        "goals": len(req.goals),
    }
    return ClarityComputation(income=income, commitments=commitments, margin=margin, cash=cash, debt=debt, outlook=outlook, goals=goals, flags=flags, data_quality=dq, result_status=result_status, inputs_used=inputs_used)
