"""Deterministic personal what-if scenarios (PERS-002c engine).

Methodology: ``personal.cashflow_scenario@2026.1`` (see methods.py), layered on
``personal.cashflow_baseline@2026.1``. A scenario is one explicit, bounded change
applied to a copy of the baseline request; both are computed by the same
baseline engine, and the response reports the two side by side plus the delta.

Supported kinds (one per request, so every delta has a single cause):

* ``SPENDING_CHANGE`` - a signed change to typical monthly discretionary spending
  (negative = spend less). Modelled as one extra discretionary category. A
  reduction larger than current typical discretionary spending is INFEASIBLE
  rather than silently capped.
* ``SAVINGS_CHANGE`` - an additional fixed monthly amount set aside, optionally
  added to one goal's contribution. Margins fall by the amount either way. For
  ``destination=LIQUID`` (money stays in checking/savings) the dated outlook is
  unchanged; for ``ILLIQUID`` (e.g. retirement or a locked account) the amount
  leaves liquid cash monthly from ``start_date``.
* ``INCOME_INTERRUPTION`` - one income stream pays nothing for 1-12 months from
  ``start_date``. Margins "during" are recomputed without that stream; the
  outlook skips its payment dates inside the window; runway is cash above the
  user's floor divided by the monthly shortfall.

Nothing here recommends a change. The decision policy in the web tier may cite
these receipted numbers; the user decides.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal

from ..schemas_personal import (
    Flag,
    GoalChange,
    IncomeInterruptionResult,
    ObligationInput,
    PersonalClarityRequest,
    PersonalScenarioRequest,
    ScenarioDelta,
    ScenarioMetrics,
    VariableSpendingInput,
)
from .cashflow import ClarityComputation, add_months, compute_clarity, median
from .money import ZERO, format_usd, round_cents

SCENARIO_LIMITATIONS = (
    "Illustrative what-if on user-reported inputs: one stated change, everything else held at the baseline. Not a forecast and not advice.",
    "The dated outlook covers the baseline horizon only; effects after the horizon are reported as monthly figures, not dated cash.",
    "Income interruption models the loss of one stream's payments only; it does not model benefits, severance, taxes, new income or spending the household would cut in response.",
    "No investment returns, tax, benefits eligibility, insurance or credit effects are modelled.",
)

SCENARIO_SPENDING_REF = "scenario:spending_change"
SCENARIO_SAVINGS_REF = "scenario:savings_change"
TWO_DP = Decimal("0.01")


@dataclass
class ScenarioComputation:
    result_status: str
    infeasible_reason: str | None
    baseline: ScenarioMetrics
    scenario: ScenarioMetrics
    delta: ScenarioDelta
    interruption: IncomeInterruptionResult | None
    goal_changes: list[GoalChange]
    new_flags: list[Flag]
    resolved_flag_codes: list[str]
    assumptions: list[str]
    inputs_used: dict


def _metrics(c: ClarityComputation, margin_override: tuple[Decimal | None, Decimal | None] | None = None) -> ScenarioMetrics:
    typical, low = (c.margin.typical, c.margin.low) if margin_override is None else margin_override
    return ScenarioMetrics(
        income_typical_monthly=c.income.typical_monthly,
        income_low_monthly=c.income.low_monthly,
        monthly_essential=c.commitments.monthly_essential,
        monthly_discretionary_typical=c.commitments.monthly_discretionary_typical,
        margin_typical=typical,
        margin_low=low,
        margin_essential_only_low=c.margin.essential_only_low,
        liquid_total=c.cash.liquid_total,
        essential_buffer_months=c.cash.essential_buffer_months,
        lowest_projected_cash=c.outlook.lowest_projected_cash,
        lowest_projected_date=c.outlook.lowest_projected_date,
        end_projected_cash=c.outlook.end_projected_cash,
        first_floor_breach_date=c.outlook.first_floor_breach_date,
    )


def _diff(a: Decimal | None, b: Decimal | None) -> Decimal | None:
    return None if a is None or b is None else round_cents(b - a)


def _delta(base: ScenarioMetrics, scen: ScenarioMetrics) -> ScenarioDelta:
    return ScenarioDelta(
        margin_typical=_diff(base.margin_typical, scen.margin_typical),
        margin_low=_diff(base.margin_low, scen.margin_low),
        monthly_discretionary_typical=_diff(base.monthly_discretionary_typical, scen.monthly_discretionary_typical),
        lowest_projected_cash=_diff(base.lowest_projected_cash, scen.lowest_projected_cash),
        end_projected_cash=_diff(base.end_projected_cash, scen.end_projected_cash),
    )


def _flag_key(f: Flag) -> tuple[str, tuple[str, ...]]:
    return (f.code, tuple(sorted(f.refs)))


def _runway(above_floor: Decimal, monthly_net: Decimal | None) -> Decimal | None:
    """Months until cash reaches the floor at a constant monthly shortfall; None when there is no shortfall."""
    if monthly_net is None or monthly_net >= ZERO:
        return None
    if above_floor <= ZERO:
        return Decimal("0.00")
    return (above_floor / -monthly_net).quantize(TWO_DP)


def compute_scenario(req: PersonalScenarioRequest) -> ScenarioComputation:
    base_req = req.baseline
    as_of = base_req.as_of_date
    base = compute_clarity(base_req)
    base_metrics = _metrics(base)
    sc = req.scenario
    assumptions: list[str] = ["Everything not named by the scenario is held at the baseline inputs."]
    goal_changes = []
    interruption: IncomeInterruptionResult | None = None
    infeasible: str | None = None
    scen_req = base_req.model_copy(deep=True)
    blackouts: dict[str, tuple[date, date]] = {}
    margin_override: tuple[Decimal | None, Decimal | None] | None = None
    keep_baseline_outlook = False

    if sc.kind == "SPENDING_CHANGE":
        amount = sc.monthly_amount
        if amount < ZERO and -amount > base.commitments.monthly_discretionary_typical:
            infeasible = (
                f"A reduction of {format_usd(-amount)} is larger than typical monthly discretionary spending "
                f"({format_usd(base.commitments.monthly_discretionary_typical)}). Essential commitments are not reduced by this scenario."
            )
        scen_req.variable_spending = [*scen_req.variable_spending, VariableSpendingInput(category=SCENARIO_SPENDING_REF, observed_monthly_amounts=[amount], essential=False, data_state="ASSUMED")]
        assumptions.append(f"Typical monthly discretionary spending changes by {format_usd(amount)}, spread evenly across each month.")

    elif sc.kind == "SAVINGS_CHANGE":
        amount = sc.monthly_amount
        start = sc.start_date or as_of
        if sc.goal_ref is not None:
            known = {g.goal_ref for g in base_req.goals}
            if sc.goal_ref not in known:
                infeasible = "The scenario names a goal that is not in the baseline."
            else:
                scen_req.goals = [
                    g.model_copy(update={"monthly_contribution": (g.monthly_contribution or ZERO) + amount}) if g.goal_ref == sc.goal_ref else g for g in scen_req.goals
                ]
        if sc.destination == "ILLIQUID":
            scen_req.obligations = [
                *scen_req.obligations,
                ObligationInput(obligation_ref=SCENARIO_SAVINGS_REF, label="Scenario: added monthly saving", category="SAVINGS_TRANSFER", amount=amount, cadence="MONTHLY", next_due_date=start, essential=False, data_state="ASSUMED"),
            ]
            assumptions.append(f"{format_usd(amount)} a month leaves liquid cash from {start.isoformat()} (ILLIQUID destination).")
        else:
            # Money set aside in checking/savings is still liquid cash: margins fall, dated cash does not.
            keep_baseline_outlook = True
            margin_override = (
                round_cents(base.margin.typical - amount) if base.margin.typical is not None else None,
                round_cents(base.margin.low - amount) if base.margin.low is not None else None,
            )
            assumptions.append(f"{format_usd(amount)} a month is set aside but stays in liquid accounts, so the dated cash outlook is unchanged; unallocated margin falls by that amount.")

    elif sc.kind == "INCOME_INTERRUPTION":
        stream = next((s for s in base_req.income_streams if s.stream_ref == sc.stream_ref), None)
        start = sc.start_date or as_of
        end = add_months(start, sc.months)
        if stream is None:
            infeasible = "The scenario names an income stream that is not in the baseline."
        else:
            blackouts[stream.stream_ref] = (start, end)
            assumptions.append(f"{stream.label or stream.stream_ref} pays nothing from {start.isoformat()} until {end.isoformat()} ({sc.months} month(s)); other streams continue as observed.")

    if infeasible is not None:
        return ScenarioComputation(
            result_status="INFEASIBLE",
            infeasible_reason=infeasible,
            baseline=base_metrics,
            scenario=base_metrics,
            delta=_delta(base_metrics, base_metrics),
            interruption=None,
            goal_changes=[],
            new_flags=[],
            resolved_flag_codes=[],
            assumptions=assumptions,
            inputs_used={"as_of_date": as_of, "scenario_kind": sc.kind},
        )

    if sc.kind == "INCOME_INTERRUPTION":
        stream = next(s for s in base_req.income_streams if s.stream_ref == sc.stream_ref)
        window = blackouts[stream.stream_ref]
        # Dated outlook: full baseline inputs, the stream's payment dates inside the window skipped.
        outlook_run = compute_clarity(scen_req, income_blackouts=blackouts)
        # Monthly figures "during": the same inputs without the stream (zero income if it was the only one).
        during_req: PersonalClarityRequest = scen_req.model_copy(update={"income_streams": [s for s in scen_req.income_streams if s.stream_ref != sc.stream_ref]})
        during = compute_clarity(during_req)
        essential = base.commitments.monthly_essential
        discretionary = base.commitments.monthly_discretionary_typical
        during_typical = during.income.typical_monthly if during.income.typical_monthly is not None else Decimal("0.00")
        during_low = during.income.low_monthly if during.income.low_monthly is not None else Decimal("0.00")
        margin_typical_during = round_cents(during_typical - essential - discretionary)
        margin_low_during = round_cents(during_low - essential - discretionary)
        margin_essential_only_during = round_cents(during_typical - essential)
        scen_metrics = _metrics(outlook_run).model_copy(
            update={
                "income_typical_monthly": during_typical,
                "income_low_monthly": during_low,
                "margin_typical": margin_typical_during,
                "margin_low": margin_low_during,
                "margin_essential_only_low": round_cents(during_low - essential),
            }
        )
        own_typical = median(stream.observed_monthly_amounts)
        skipped = [ev for p in base.outlook.points for ev in p.events if ev.kind == "INCOME" and ev.ref == stream.stream_ref and window[0] <= ev.date < window[1]]
        above_floor = base.cash.above_floor
        runway_typical = _runway(above_floor, margin_typical_during)
        interruption = IncomeInterruptionResult(
            stream_ref=stream.stream_ref,
            start_date=window[0],
            end_date=window[1],
            months=sc.months,
            stream_typical_monthly=round_cents(own_typical) if own_typical is not None else None,
            income_forgone_typical=round_cents(own_typical * sc.months) if own_typical is not None else None,
            payments_skipped_in_horizon=len(skipped),
            amount_skipped_in_horizon=round_cents(sum((ev.amount for ev in skipped), ZERO)),
            cash_above_floor=above_floor,
            margin_typical_during=margin_typical_during,
            margin_essential_only_during=margin_essential_only_during,
            runway_months_typical_spending=runway_typical,
            runway_months_essentials_only=_runway(above_floor, margin_essential_only_during),
            cash_above_floor_covers_interruption=(runway_typical is None) or runway_typical >= Decimal(sc.months),
            horizon_covers_interruption=window[1] <= as_of + timedelta(days=base_req.horizon_days),
        )
        scen_flags = outlook_run.flags
        scen_goals = outlook_run.goals
    else:
        run_ = compute_clarity(scen_req)
        if keep_baseline_outlook:
            scen_metrics = _metrics(base, margin_override)
        else:
            scen_metrics = _metrics(run_)
        scen_flags = run_.flags
        scen_goals = run_.goals

    base_goals = {g.goal_ref: g for g in base.goals}
    for g in scen_goals:
        b = base_goals.get(g.goal_ref)
        if b is None:
            continue
        if (b.months_to_target_at_contribution, b.on_track_for_target_date) != (g.months_to_target_at_contribution, g.on_track_for_target_date):
            goal_changes.append(GoalChange(goal_ref=g.goal_ref, label=g.label, baseline_months_to_target=b.months_to_target_at_contribution, scenario_months_to_target=g.months_to_target_at_contribution, baseline_on_track=b.on_track_for_target_date, scenario_on_track=g.on_track_for_target_date))

    base_keys = {_flag_key(f) for f in base.flags}
    scen_keys = {_flag_key(f) for f in scen_flags}
    new_flags = [f for f in scen_flags if _flag_key(f) not in base_keys]
    resolved = sorted({f.code for f in base.flags if _flag_key(f) not in scen_keys})
    if sc.kind == "INCOME_INTERRUPTION" and interruption is not None and interruption.runway_months_typical_spending is not None and interruption.runway_months_typical_spending < Decimal(sc.months):
        new_flags.append(Flag(code="RUNWAY_SHORTER_THAN_INTERRUPTION", severity="HIGH", message=f"At typical spending, cash above your floor would last about {interruption.runway_months_typical_spending} month(s), shorter than the {sc.months}-month interruption.", refs=[interruption.stream_ref]))

    result_status = "INSUFFICIENT_DATA" if base.result_status == "INSUFFICIENT_DATA" else "COMPUTED"
    inputs_used = {
        "as_of_date": as_of,
        "horizon_days": base_req.horizon_days,
        "scenario_kind": sc.kind,
        "baseline_inputs": base.inputs_used,
    }
    return ScenarioComputation(
        result_status=result_status,
        infeasible_reason=None,
        baseline=base_metrics,
        scenario=scen_metrics,
        delta=_delta(base_metrics, scen_metrics),
        interruption=interruption,
        goal_changes=goal_changes,
        new_flags=new_flags,
        resolved_flag_codes=resolved,
        assumptions=assumptions,
        inputs_used=inputs_used,
    )
