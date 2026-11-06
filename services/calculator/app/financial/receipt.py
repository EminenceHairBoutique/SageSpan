"""Deterministic run receipts.

A receipt binds: canonical request hash, engine identity, the exact rule set
versions/checksums, inputs used, the formula and the result. `run_hash` is
deterministic (excludes computed_at) so a packet can be re-verified by
re-running the same inputs on the same engine version.
"""
from __future__ import annotations

from datetime import datetime, timezone

from .. import ENGINE_NAME, ENGINE_VERSION
from ..schemas import OrgContext, Receipt, RmdCheckRequest, RmdCheckResponse, RuleSetRef
from .canonical import canonical_hash
from .checks import classify
from .rmd import RMD_LIMITATIONS, assess
from .rules import RMD_RULE_SETS


def request_hash(req: RmdCheckRequest) -> str:
    return canonical_hash(req.model_dump(mode="json"))


def run_rmd_check(req: RmdCheckRequest, org_id: str, now: datetime | None = None) -> RmdCheckResponse:
    assessment = assess(req)
    bal = req.account.prior_year_end_balance
    discrepancy = classify(assessment, req.imported_comparison, req.tax_year, req.tolerance, bal.amount if bal else None, bal.as_of_date if bal else None)
    if req.imported_comparison is None and assessment.eligibility.status != "SUPPORTED":
        discrepancy = None  # nothing to compare and nothing computed

    status_map = {"SUPPORTED": "PASS", "NOT_REQUIRED": "NOT_REQUIRED", "UNSUPPORTED": "UNSUPPORTED", "INDETERMINATE": "INDETERMINATE"}
    result_status = status_map[assessment.eligibility.status]
    rule_refs = [RuleSetRef(**r.ref()) for r in RMD_RULE_SETS]
    all_published = all(r.status == "PUBLISHED" for r in rule_refs)
    if assessment.eligibility.status in ("SUPPORTED", "NOT_REQUIRED"):
        coverage_status = "SUPPORTED_VERIFIED" if all_published else "SUPPORTED_UNVALIDATED"
    else:
        coverage_status = assessment.eligibility.status  # UNSUPPORTED | INDETERMINATE
    unsupported_reasons = list(assessment.eligibility.reasons) if assessment.eligibility.status in ("UNSUPPORTED", "INDETERMINATE") else []
    req_hash = request_hash(req)

    result_core = {
        "coverage_status": coverage_status,
        "eligibility": assessment.eligibility.model_dump(mode="json"),
        "annual_rmd": str(assessment.annual_rmd) if assessment.annual_rmd is not None else None,
        "events": [e.model_dump(mode="json") for e in assessment.events],
        "discrepancy": discrepancy.model_dump(mode="json") if discrepancy else None,
    }
    run_hash = canonical_hash({
        "request_hash": req_hash,
        "engine": {"name": ENGINE_NAME, "version": ENGINE_VERSION},
        "rule_sets": [{"id": r.rule_set_id, "version": r.version, "checksum": r.checksum} for r in rule_refs],
        "result": result_core,
    })
    receipt = Receipt(
        receipt_version="sagespan.receipt.v1",
        engine_name=ENGINE_NAME,
        engine_version=ENGINE_VERSION,
        request_hash=req_hash,
        run_hash=run_hash,
        computed_at=now or datetime.now(timezone.utc),
        org_context=OrgContext(org_id=org_id),
        snapshot_ref=req.snapshot_ref,
        rule_sets=rule_refs,
        inputs_used=assessment.inputs_used,
        formula=assessment.formula,
        limitations=list(RMD_LIMITATIONS),
    )
    return RmdCheckResponse(
        check_type="RMD_ANNUAL",
        result_status=result_status,  # type: ignore[arg-type]
        coverage_status=coverage_status,  # type: ignore[arg-type]
        tax_year=req.tax_year,
        eligibility=assessment.eligibility,
        unsupported_reasons=unsupported_reasons,
        annual_rmd=assessment.annual_rmd,
        events=assessment.events,
        discrepancy=discrepancy,
        receipt=receipt,
    )
