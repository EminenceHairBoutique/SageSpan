from __future__ import annotations

import json
from pathlib import Path

from tests.conftest import AUTH, patel_payload

CONTRACT_PATH = Path(__file__).resolve().parents[3] / "packages" / "contracts" / "openapi" / "calculator.openapi.json"


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok" and body["demo_mode"] is True and body["engine_name"] == "sagespan-calculator"


def test_check_requires_service_token(client):
    r = client.post("/v1/checks/rmd", json=patel_payload())
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "UNAUTHENTICATED"
    r = client.post("/v1/checks/rmd", json=patel_payload(), headers={"Authorization": "Bearer wrong", "X-SageSpan-Org-Id": "org_a"})
    assert r.status_code == 401


def test_check_requires_server_resolved_org_header(client):
    r = client.post("/v1/checks/rmd", json=patel_payload(), headers={"Authorization": "Bearer demo-local-token"})
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "MISSING_ORG_CONTEXT"


def test_body_org_id_is_rejected_not_trusted(client):
    body = patel_payload()
    body["org_id"] = "org_someone_else"
    r = client.post("/v1/checks/rmd", json=body, headers=AUTH)
    assert r.status_code == 422
    err = r.json()["error"]
    assert err["code"] == "VALIDATION_ERROR"
    assert any("org_id" in d["loc"] for d in err["details"])
    # the error never echoes the submitted values
    assert "640000" not in r.text


def test_patel_check_returns_exact_receipt(client):
    r = client.post("/v1/checks/rmd", json=patel_payload(), headers=AUTH)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["check_type"] == "RMD_ANNUAL"
    assert body["result_status"] == "PASS"
    assert body["coverage_status"] == "SUPPORTED_VERIFIED"
    assert body["unsupported_reasons"] == []
    assert body["annual_rmd"] == "25098.04"
    assert body["eligibility"]["owner_age_in_tax_year"] == 74
    assert body["receipt"]["org_context"]["org_id"] == "org_harborpoint"
    assert body["receipt"]["engine_version"] == "0.1.0"
    assert body["receipt"]["rule_sets"][0]["rule_set_id"] == "rmd.uniform_lifetime_table"
    assert body["receipt"]["rule_sets"][0]["version"] == "2022.1"
    assert body["discrepancy"]["classification"] == "SOURCE_CONFLICT"
    assert body["discrepancy"]["imported_amount"] == "24000.00"
    assert body["discrepancy"]["difference"] == "1098.04"
    assert len(body["receipt"]["run_hash"]) == 64


def test_rules_endpoint_lists_published_and_draft_distinctly(client):
    r = client.get("/v1/rules", headers=AUTH)
    assert r.status_code == 200
    sets = {x["rule_set_id"]: x for x in r.json()["rule_sets"]}
    assert sets["rmd.uniform_lifetime_table"]["status"] == "PUBLISHED"
    assert sets["tax.federal_ordinary_income"]["status"] == "DRAFT"
    assert client.get("/v1/rules/nope", headers=AUTH).status_code == 404
    assert client.get("/v1/rules").status_code == 401


def _structural_diff(live, committed, path="$", out=None):
    """Path-level differences between two JSON documents (order-sensitive for lists)."""
    out = [] if out is None else out
    if isinstance(live, dict) and isinstance(committed, dict):
        for key in sorted(set(live) | set(committed)):
            if key not in live:
                out.append(f"{path}.{key}: only in committed")
            elif key not in committed:
                out.append(f"{path}.{key}: only in live")
            else:
                _structural_diff(live[key], committed[key], f"{path}.{key}", out)
    elif isinstance(live, list) and isinstance(committed, list):
        if len(live) != len(committed):
            out.append(f"{path}: list length live={len(live)} committed={len(committed)}")
        for i, (a, b) in enumerate(zip(live, committed)):
            _structural_diff(a, b, f"{path}[{i}]", out)
    elif live != committed:
        out.append(f"{path}: live={json.dumps(live)[:80]} committed={json.dumps(committed)[:80]}")
    return out


def test_openapi_contract_matches_committed_document(client):
    assert CONTRACT_PATH.exists(), f"missing {CONTRACT_PATH}; run python scripts/export_openapi.py"
    committed = json.loads(CONTRACT_PATH.read_text(encoding="utf-8"))
    live = client.get("/openapi.json").json()
    differences = _structural_diff(live, committed)
    assert not differences, "OpenAPI drift (run python scripts/export_openapi.py and review):\n" + "\n".join(differences[:40])
    assert "/v1/checks/rmd" in live["paths"]
    schema = live["components"]["schemas"]["RmdCheckRequest"]
    assert schema.get("additionalProperties") is False
    assert "org_id" not in schema["properties"]
