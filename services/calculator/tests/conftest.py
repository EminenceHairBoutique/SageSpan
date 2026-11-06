from __future__ import annotations

import copy
import os
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
os.environ.setdefault("CALC_DEMO_MODE", "1")

from app.schemas import RmdCheckRequest  # noqa: E402

# Fictional Patel household (synthetic). Owner age 74 in tax year 2026.
PATEL_BASE: dict = {
    "schema_version": "sagespan.rmd-check.v1",
    "tax_year": 2026,
    "owner": {"person_ref": "person_patel_rajesh", "birth_date": "1952-03-14", "is_alive": True},
    "account": {
        "account_ref": "acct_patel_trad_ira",
        "account_type": "TRADITIONAL_IRA",
        "is_inherited": False,
        "prior_year_end_balance": {"amount": "640000.00", "currency": "USD", "as_of_date": "2025-12-31"},
    },
    "beneficiaries": [
        {
            "person_ref": "person_patel_meera",
            "relationship": "SPOUSE",
            "designation_type": "PRIMARY",
            "share_percent": "100",
            "birth_date": "1955-07-02",
            "sole_primary_entire_year": True,
        },
        {
            "person_ref": "person_patel_anika",
            "relationship": "NON_SPOUSE_INDIVIDUAL",
            "designation_type": "CONTINGENT",
            "share_percent": "100",
            "birth_date": "1981-10-09",
            "sole_primary_entire_year": None,
        },
    ],
    "first_rmd_election": {"deferred_first_rmd_to_april_1": False, "first_rmd_satisfied_in_first_year": True},
    "imported_comparison": {
        "import_value_ref": "ipv_patel_plan_2026_rmd",
        "amount": "24000.00",
        "currency": "USD",
        "tax_year": 2026,
        "vendor_label": "Planning tool export (synthetic)",
        "calculation_scope": "SINGLE_ACCOUNT_ANNUAL_RMD",
        "balance_basis": "ACTUAL_PRIOR_YEAR_END",
        "declared_inputs": {"balance": "612000.00", "balance_as_of": "2025-12-31", "factor": "25.5", "table": "UNIFORM_LIFETIME", "method": "DIRECT_DIVISION"},
        "assumptions": {},
    },
    "snapshot_ref": {"snapshot_id": "snap_patel_r2", "revision": 2, "input_hash": "0" * 64},
}


def patel_payload(**overrides) -> dict:
    payload = copy.deepcopy(PATEL_BASE)
    for key, value in overrides.items():
        if value is None:
            payload.pop(key, None)
        else:
            payload[key] = value
    return payload


def patel_request(**overrides) -> RmdCheckRequest:
    return RmdCheckRequest.model_validate(patel_payload(**overrides))


@pytest.fixture
def patel() -> RmdCheckRequest:
    return patel_request()


@pytest.fixture
def client():
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as c:
        yield c


AUTH = {"Authorization": "Bearer demo-local-token", "X-SageSpan-Org-Id": "org_harborpoint"}
