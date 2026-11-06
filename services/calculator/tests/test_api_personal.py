from __future__ import annotations

from tests.conftest import AUTH
from tests.test_personal_clarity import castillo_payload

WS_AUTH = {"Authorization": "Bearer demo-local-token", "X-SageSpan-Org-Id": "ws_castillo_personal"}


def test_personal_clarity_requires_service_token_and_tenant_header(client):
    assert client.post("/v1/personal/clarity", json=castillo_payload()).status_code == 401
    r = client.post("/v1/personal/clarity", json=castillo_payload(), headers={"Authorization": "Bearer demo-local-token"})
    assert r.status_code == 400 and r.json()["error"]["code"] == "MISSING_ORG_CONTEXT"


def test_personal_clarity_rejects_body_tenant_claims_without_echoing_values(client):
    body = castillo_payload()
    body["org_id"] = "org_other"
    r = client.post("/v1/personal/clarity", json=body, headers=WS_AUTH)
    assert r.status_code == 422
    assert "2150" not in r.text and "4820" not in r.text


def test_personal_clarity_returns_receipted_baseline(client):
    r = client.post("/v1/personal/clarity", json=castillo_payload(), headers=WS_AUTH)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["check_type"] == "PERSONAL_CLARITY" and body["result_status"] == "COMPUTED"
    assert body["margin"]["typical"] == "1503.50"
    assert body["cash"]["essential_buffer_months"] == "1.21"
    assert body["receipt"]["org_context"]["org_id"] == "ws_castillo_personal"
    assert body["receipt"]["rule_sets"][0]["rule_set_id"] == "personal.cashflow_baseline"
    assert any("not advice" in lim.lower() for lim in body["receipt"]["limitations"])


def test_debt_paths_endpoint(client):
    body = {
        "schema_version": "sagespan.debt-paths.v1",
        "as_of_date": "2026-11-01",
        "liabilities": castillo_payload()["liabilities"],
        "monthly_debt_budget": "705.00",
        "policy": {"cash_floor": "1500.00"},
        "liquid_cash": "3650.00",
        "strategies": ["AVALANCHE", "SNOWBALL"],
    }
    r = client.post("/v1/personal/debt-paths", json=body, headers=WS_AUTH)
    assert r.status_code == 200, r.text
    out = r.json()
    assert out["check_type"] == "DEBT_PATHS" and out["result_status"] == "COMPUTED"
    assert [x["strategy"] for x in out["results"]] == ["AVALANCHE", "SNOWBALL"]
    assert out["results"][0]["interest_saved_vs_minimums"] is not None
    assert out["receipt"]["rule_sets"][0]["rule_set_id"] == "personal.debt_amortization"


def test_methods_registry_is_separate_from_regulatory_rule_sets(client):
    methods = {m["rule_set_id"] for m in client.get("/v1/methods", headers=AUTH).json()["method_sets"]}
    rules = {r["rule_set_id"] for r in client.get("/v1/rules", headers=AUTH).json()["rule_sets"]}
    assert methods == {"personal.cashflow_baseline", "personal.debt_amortization", "personal.cashflow_scenario"}
    assert not (methods & rules), "methodology sets must not leak into the regulatory registry that seeds migration 0006"
    assert client.get("/v1/methods").status_code == 401


def test_personal_scenario_endpoint_income_interruption(client):
    body = {
        "schema_version": "sagespan.personal-scenario.v1",
        "baseline": castillo_payload(),
        "scenario": {"kind": "INCOME_INTERRUPTION", "stream_ref": "inc_castillo_contract", "months": 1},
        "workspace_ref": "ws_castillo_personal",
    }
    assert client.post("/v1/personal/scenario", json=body).status_code == 401
    r = client.post("/v1/personal/scenario", json=body, headers=WS_AUTH)
    assert r.status_code == 200, r.text
    out = r.json()
    assert out["check_type"] == "PERSONAL_SCENARIO" and out["result_status"] == "COMPUTED"
    assert out["scenario_metrics"]["margin_typical"] == "-2266.50"
    assert out["interruption"]["runway_months_typical_spending"] == "0.95"
    assert out["receipt"]["rule_sets"][0]["rule_set_id"] == "personal.cashflow_scenario"


def test_personal_scenario_endpoint_rejects_mismatched_spec_fields(client):
    body = {
        "schema_version": "sagespan.personal-scenario.v1",
        "baseline": castillo_payload(),
        "scenario": {"kind": "SPENDING_CHANGE", "monthly_amount": "-100.00", "months": 3},
    }
    r = client.post("/v1/personal/scenario", json=body, headers=WS_AUTH)
    assert r.status_code == 422 and "2150" not in r.text


def test_methods_lists_scenario_set(client):
    r = client.get("/v1/methods", headers=AUTH)
    ids = {m["rule_set_id"] for m in r.json()["method_sets"]}
    assert "personal.cashflow_scenario" in ids
