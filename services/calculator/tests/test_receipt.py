from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from app import ENGINE_NAME, ENGINE_VERSION
from app.financial.canonical import canonical_json
from app.financial.receipt import request_hash, run_rmd_check
from tests.conftest import patel_payload, patel_request

HEX64 = re.compile(r"^[0-9a-f]{64}$")


def test_receipt_is_deterministic_across_runs_and_timestamps(patel):
    t0 = datetime(2026, 11, 5, 12, 0, tzinfo=timezone.utc)
    r1 = run_rmd_check(patel, "org_a", now=t0)
    r2 = run_rmd_check(patel_request(), "org_a", now=t0 + timedelta(days=3))
    assert r1.receipt.run_hash == r2.receipt.run_hash
    assert r1.receipt.request_hash == r2.receipt.request_hash
    assert r1.receipt.computed_at != r2.receipt.computed_at
    assert HEX64.match(r1.receipt.run_hash) and HEX64.match(r1.receipt.request_hash)


def test_request_hash_changes_with_inputs():
    a = request_hash(patel_request())
    b = request_hash(patel_request(account={**patel_payload()["account"], "prior_year_end_balance": {"amount": "640000.01", "currency": "USD", "as_of_date": "2025-12-31"}}))
    assert a != b


def test_receipt_metadata_is_exact(patel):
    r = run_rmd_check(patel, "org_harborpoint")
    rc = r.receipt
    assert rc.receipt_version == "sagespan.receipt.v1"
    assert rc.engine_name == ENGINE_NAME and rc.engine_version == ENGINE_VERSION
    assert rc.org_context.org_id == "org_harborpoint"
    assert rc.snapshot_ref is not None and rc.snapshot_ref.snapshot_id == "snap_patel_r2"
    ids = [x.rule_set_id for x in rc.rule_sets]
    assert ids == ["rmd.uniform_lifetime_table", "rmd.applicable_age", "rmd.required_beginning_date", "rmd.spouse_joint_table_eligibility", "rmd.comparison_tolerance"]
    assert all(HEX64.match(x.checksum) for x in rc.rule_sets)
    assert all(x.status == "PUBLISHED" for x in rc.rule_sets)
    assert rc.inputs_used["factor"] == "25.5" and rc.inputs_used["prior_year_end_balance"] == "640000.00"
    assert rc.formula and rc.formula.startswith("640000.00 / 25.5")
    assert any("not tax advice" in s for s in rc.limitations)
    assert r.result_status == "PASS" and r.annual_rmd == Decimal("25098.04")
    assert r.discrepancy is not None and r.discrepancy.classification == "SOURCE_CONFLICT"


def test_unsupported_run_has_no_amount_and_no_discrepancy_without_import():
    req = patel_request(account={**patel_payload()["account"], "is_inherited": True}, imported_comparison=None)
    r = run_rmd_check(req, "org_a")
    assert r.result_status == "UNSUPPORTED" and r.annual_rmd is None and r.discrepancy is None
    assert r.coverage_status == "UNSUPPORTED"
    assert [x.code for x in r.unsupported_reasons] == ["INHERITED_ACCOUNT_UNSUPPORTED"]


def test_indeterminate_coverage_status_and_reasons():
    acct = {k: v for k, v in patel_payload()["account"].items() if k != "prior_year_end_balance"}
    r = run_rmd_check(patel_request(account=acct), "org_a")
    assert r.result_status == "INDETERMINATE" and r.coverage_status == "INDETERMINATE"
    assert "MISSING_PRIOR_YEAR_END_BALANCE" in {x.code for x in r.unsupported_reasons}


def test_canonical_json_never_emits_floats():
    s = canonical_json({"a": Decimal("0.10"), "b": [Decimal("1")], "c": "x"})
    assert s == '{"a":"0.10","b":["1"],"c":"x"}'


def test_response_serialises_decimals_as_strings(patel):
    payload = run_rmd_check(patel, "org_a").model_dump(mode="json")
    assert payload["annual_rmd"] == "25098.04"
    assert isinstance(payload["events"][0]["factor"], str)
