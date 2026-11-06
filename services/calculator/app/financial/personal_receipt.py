"""Receipts for the Personal engines (same binding rules as receipt.py)."""
from __future__ import annotations

from datetime import datetime, timezone

from .. import ENGINE_NAME, ENGINE_VERSION
from ..schemas import OrgContext, Receipt, RuleSetRef
from ..schemas_personal import DebtPathsRequest, DebtPathsResponse, PersonalClarityRequest, PersonalClarityResponse, PersonalScenarioRequest, PersonalScenarioResponse
from .canonical import canonical_hash
from .cashflow import CASHFLOW_LIMITATIONS, compute_clarity
from .debt import DEBT_LIMITATIONS, compute_debt_paths
from .methods import PERSONAL_CASHFLOW_BASELINE, PERSONAL_CASHFLOW_SCENARIO, PERSONAL_DEBT_AMORTISATION
from .scenario import SCENARIO_LIMITATIONS, compute_scenario


def _receipt(request_payload: dict, result_core: dict, method_refs: list[RuleSetRef], org_id: str, inputs_used: dict, formula: str, limitations: tuple[str, ...], now: datetime | None) -> Receipt:
    req_hash = canonical_hash(request_payload)
    run_hash = canonical_hash({
        "request_hash": req_hash,
        "engine": {"name": ENGINE_NAME, "version": ENGINE_VERSION},
        "rule_sets": [{"id": r.rule_set_id, "version": r.version, "checksum": r.checksum} for r in method_refs],
        "result": result_core,
    })
    return Receipt(
        receipt_version="sagespan.receipt.v1",
        engine_name=ENGINE_NAME,
        engine_version=ENGINE_VERSION,
        request_hash=req_hash,
        run_hash=run_hash,
        computed_at=now or datetime.now(timezone.utc),
        org_context=OrgContext(org_id=org_id),
        snapshot_ref=None,
        rule_sets=method_refs,
        inputs_used=inputs_used,
        formula=formula,
        limitations=list(limitations),
    )


def run_personal_clarity(req: PersonalClarityRequest, org_id: str, now: datetime | None = None) -> PersonalClarityResponse:
    c = compute_clarity(req)
    method_refs = [RuleSetRef(**PERSONAL_CASHFLOW_BASELINE.ref())]
    result_core = {
        "result_status": c.result_status,
        "income": c.income.model_dump(mode="json"),
        "commitments": c.commitments.model_dump(mode="json"),
        "margin": c.margin.model_dump(mode="json"),
        "cash": c.cash.model_dump(mode="json"),
        "debt": c.debt.model_dump(mode="json"),
        "outlook": {k: v for k, v in c.outlook.model_dump(mode="json").items() if k != "points"},
        "flags": [f.model_dump(mode="json") for f in c.flags],
    }
    inputs_used = dict(c.inputs_used)
    inputs_used["workspace_ref"] = req.workspace_ref
    inputs_used["input_hash"] = req.input_hash
    receipt = _receipt(
        req.model_dump(mode="json"),
        result_core,
        method_refs,
        org_id,
        inputs_used,
        "margin = median(income) - essential - discretionary; buffer_months = liquid / essential; outlook = daily(cash + income_on_dates - obligations_on_dates - discretionary/30)",
        CASHFLOW_LIMITATIONS,
        now,
    )
    return PersonalClarityResponse(
        check_type="PERSONAL_CLARITY",
        result_status=c.result_status,  # type: ignore[arg-type]
        as_of_date=req.as_of_date,
        income=c.income,
        commitments=c.commitments,
        margin=c.margin,
        cash=c.cash,
        debt=c.debt,
        outlook=c.outlook,
        goals=c.goals,
        flags=c.flags,
        data_quality=c.data_quality,
        receipt=receipt,
    )


def run_debt_paths(req: DebtPathsRequest, org_id: str, now: datetime | None = None) -> DebtPathsResponse:
    guard, results, assumptions, flags, status = compute_debt_paths(req)
    method_refs = [RuleSetRef(**PERSONAL_DEBT_AMORTISATION.ref())]
    result_core = {
        "result_status": status,
        "liquidity_guard": guard.model_dump(mode="json"),
        "results": [{k: v for k, v in r.model_dump(mode="json").items() if k != "first_year"} for r in results],
    }
    receipt = _receipt(
        req.model_dump(mode="json"),
        result_core,
        method_refs,
        org_id,
        {"as_of_date": req.as_of_date, "liabilities": len(req.liabilities), "monthly_debt_budget": str(req.monthly_debt_budget) if req.monthly_debt_budget is not None else None, "extra_monthly_payment": str(req.extra_monthly_payment) if req.extra_monthly_payment is not None else None, "strategies": [r.strategy for r in results], "workspace_ref": req.workspace_ref, "input_hash": req.input_hash},
        "monthly: interest = round(balance * APR/100/12); pay minimums; extra = budget - minimums -> strategy target",
        DEBT_LIMITATIONS,
        now,
    )
    return DebtPathsResponse(
        check_type="DEBT_PATHS",
        result_status=status,  # type: ignore[arg-type]
        as_of_date=req.as_of_date,
        liquidity_guard=guard,
        results=results,
        assumptions=assumptions,
        flags=flags,
        receipt=receipt,
    )


def run_personal_scenario(req: PersonalScenarioRequest, org_id: str, now: datetime | None = None) -> PersonalScenarioResponse:
    c = compute_scenario(req)
    method_refs = [RuleSetRef(**PERSONAL_CASHFLOW_SCENARIO.ref()), RuleSetRef(**PERSONAL_CASHFLOW_BASELINE.ref())]
    result_core = {
        "result_status": c.result_status,
        "infeasible_reason": c.infeasible_reason,
        "scenario": req.scenario.model_dump(mode="json"),
        "baseline_metrics": c.baseline.model_dump(mode="json"),
        "scenario_metrics": c.scenario.model_dump(mode="json"),
        "delta": c.delta.model_dump(mode="json"),
        "interruption": c.interruption.model_dump(mode="json") if c.interruption else None,
        "goal_changes": [g.model_dump(mode="json") for g in c.goal_changes],
        "new_flags": [f.model_dump(mode="json") for f in c.new_flags],
        "resolved_flag_codes": c.resolved_flag_codes,
    }
    inputs_used = dict(c.inputs_used)
    inputs_used["workspace_ref"] = req.workspace_ref
    inputs_used["input_hash"] = req.input_hash
    receipt = _receipt(
        req.model_dump(mode="json"),
        result_core,
        method_refs,
        org_id,
        inputs_used,
        "scenario = baseline(inputs with one stated change); delta = scenario - baseline; runway = cash_above_floor / monthly_shortfall",
        SCENARIO_LIMITATIONS,
        now,
    )
    return PersonalScenarioResponse(
        check_type="PERSONAL_SCENARIO",
        result_status=c.result_status,  # type: ignore[arg-type]
        infeasible_reason=c.infeasible_reason,
        as_of_date=req.baseline.as_of_date,
        scenario=req.scenario,
        baseline_metrics=c.baseline,
        scenario_metrics=c.scenario,
        delta=c.delta,
        interruption=c.interruption,
        goal_changes=c.goal_changes,
        new_flags=c.new_flags,
        resolved_flag_codes=c.resolved_flag_codes,
        assumptions=c.assumptions,
        receipt=receipt,
    )
