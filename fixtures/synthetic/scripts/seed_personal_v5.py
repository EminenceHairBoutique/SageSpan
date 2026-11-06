"""Add the V5 workspace model and the synthetic Castillo personal workspace to seed.json.

Idempotent: re-running rewrites the V5 collections from
fixtures/synthetic/personal/castillo_clarity_request.json so the engine fixture
and the demo seed can never drift apart. Firm records are untouched.

Usage: python fixtures/synthetic/scripts/seed_personal_v5.py
"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SEED = ROOT / "seed.json"
REQ = ROOT / "personal" / "castillo_clarity_request.json"

WS = "ws_castillo_personal"
PR = "pr_castillo"
CREATED = "2026-11-01T12:00:00Z"
LIABILITY_KIND = {"liab_castillo_card": "CREDIT_CARD", "liab_castillo_car": "AUTO_LOAN"}
ACCOUNT_KIND = {"cash_castillo_checking": "CHECKING", "cash_castillo_savings": "SAVINGS"}
GOAL_KIND = {"goal_castillo_reserve": "EMERGENCY_RESERVE", "goal_castillo_move": "MOVE"}


def main() -> None:
    seed = json.loads(SEED.read_text(encoding="utf-8"))
    req = json.loads(REQ.read_text(encoding="utf-8"))
    seed["state_version"] = "sagespan.demo-state.v2"

    seed["principals"] = [
        {"id": PR, "display_name": "Maya Castillo", "simulated": True},
        {"id": "pr_castillo_partner", "display_name": "Sam Rivera", "simulated": True},
    ]
    orgs = {o["id"]: o["name"] for o in seed["organizations"]}
    seed["workspaces"] = [
        {"id": WS, "kind": "PERSONAL", "label": "Maya's finances", "owner_principal_id": PR, "firm_org_id": None, "created_at": CREATED},
        *[{"id": f"ws_{o['slug']}", "kind": "FIRM", "label": orgs[o["id"]], "owner_principal_id": None, "firm_org_id": o["id"], "created_at": CREATED} for o in seed["organizations"]],
    ]
    seed["workspace_memberships"] = [
        {"id": "wm_castillo_owner", "workspace_id": WS, "principal_id": PR, "role": "OWNER", "domains": [], "status": "ACTIVE", "created_at": CREATED},
        # Invited household participant with a narrow grant: can see shared goals only. Not yet accepted.
        {"id": "wm_castillo_partner", "workspace_id": WS, "principal_id": "pr_castillo_partner", "role": "PARTICIPANT", "domains": ["SAVINGS_GOALS"], "status": "INVITED", "created_at": CREATED},
    ]
    seed["consent_grants"] = []

    seed["personal_profiles"] = [
        {
            "workspace_id": WS,
            "principal_id": PR,
            "household_size": 1,
            "situation": "Freelance designer with a part-time hourly job; income varies month to month.",
            "top_concern": "Months when contract work is slow and the card balance creeps up.",
            "cash_floor": req["policy"]["cash_floor"],
            "buffer_target_months": req["policy"]["buffer_target_months"],
            "extra_debt_payment_monthly": "250.00",
            "notification_mode": "NORMAL",
            "updated_at": CREATED,
        }
    ]
    seed["cash_accounts"] = [
        {
            "id": f"{a['account_ref']}_r1",
            "account_ref": a["account_ref"],
            "workspace_id": WS,
            "label": a["label"],
            "kind": ACCOUNT_KIND[a["account_ref"]],
            "balance": a["balance"],
            "currency": a["currency"],
            "balance_as_of": a["balance_as_of"],
            "liquid": a["liquid"],
            "data_state": a["data_state"],
            "revision": 1,
            "supersedes_id": None,
            "superseded": False,
            "created_at": CREATED,
        }
        for a in req["cash_accounts"]
    ]
    seed["income_streams"] = [
        {
            "id": s["stream_ref"],
            "workspace_id": WS,
            "label": s["label"],
            "kind": s["kind"],
            "cadence": s["cadence"],
            "reliability": s["reliability"],
            "observed_monthly_amounts": s["observed_monthly_amounts"],
            "observed_from": "2026-05",
            "observed_to": "2026-10",
            "expected_amount": s.get("expected_amount"),
            "next_expected_date": s.get("next_expected_date"),
            "data_state": s["data_state"],
        }
        for s in req["income_streams"]
    ]
    seed["recurring_obligations"] = [
        {
            "id": o["obligation_ref"],
            "workspace_id": WS,
            "label": o["label"],
            "category": o["category"],
            "amount": o["amount"],
            "cadence": o["cadence"],
            "next_due_date": o["next_due_date"],
            "essential": o["essential"],
            "liability_id": o.get("liability_ref"),
            "data_state": o.get("data_state", "USER_REPORTED"),
        }
        for o in req["obligations"]
    ]
    seed["variable_spending"] = [
        {
            "id": f"vsp_castillo_{v['category'].lower().replace(' ', '_')}",
            "workspace_id": WS,
            "category": v["category"],
            "observed_monthly_amounts": v["observed_monthly_amounts"],
            "essential": v["essential"],
            "transfers_excluded": True,
            "data_state": v.get("data_state", "USER_REPORTED"),
        }
        for v in req["variable_spending"]
    ]
    seed["liabilities"] = [
        {
            "id": x["liability_ref"],
            "workspace_id": WS,
            "label": x["label"],
            "kind": LIABILITY_KIND[x["liability_ref"]],
            "balance": x["balance"],
            "balance_as_of": req["as_of_date"],
            "apr_percent": x["apr_percent"],
            "minimum_payment": x["minimum_payment"],
            "rate_type": x["rate_type"],
            "promo_apr_percent": x.get("promo_apr_percent"),
            "promo_apr_expires": x.get("promo_apr_expires"),
            "due_day_of_month": x.get("due_day_of_month"),
            "data_state": x.get("data_state", "USER_REPORTED"),
        }
        for x in req["liabilities"]
    ]
    seed["savings_goals"] = [
        {
            "id": g["goal_ref"],
            "workspace_id": WS,
            "label": g["label"],
            "kind": GOAL_KIND[g["goal_ref"]],
            "target_amount": g["target_amount"],
            "saved_amount": g["saved_amount"],
            "target_date": g.get("target_date"),
            "monthly_contribution": g.get("monthly_contribution"),
            "funded_from_account_id": "cash_castillo_savings" if g["goal_ref"] == "goal_castillo_reserve" else None,
        }
        for g in req["goals"]
    ]
    seed["retirement_intakes"] = [
        {
            "workspace_id": WS,
            "current_age": 34,
            "target_retirement_age": 65,
            "annual_retirement_spending": None,
            "retirement_assets_total": "18400.00",
            "retirement_assets_as_of": "2026-09-30",
            "annual_contributions": None,
            "expected_pension_annual": None,
            "social_security_estimate_annual": None,
            "social_security_estimate_source": None,
            "life_span_range": None,
            "states": {
                "current_age": "USER_REPORTED",
                "target_retirement_age": "ASSUMED",
                "annual_retirement_spending": "MISSING",
                "retirement_assets_total": "STALE",
                "annual_contributions": "MISSING",
                "expected_pension_annual": "MISSING",
                "social_security_estimate_annual": "MISSING",
                "life_span_range": "MISSING",
            },
            "updated_at": CREATED,
        }
    ]
    seed["personal_snapshots"] = []
    seed["personal_calc_runs"] = []
    seed["user_decisions"] = []
    seed["ai_runs"] = []
    seed["ai_feedback"] = []

    # The committed seed uses CRLF and is byte-preserved by .gitattributes (fixtures/** -text); keep it that way.
    text = json.dumps(seed, indent=2, ensure_ascii=False) + "\n"
    SEED.write_bytes(text.replace("\n", "\r\n").encode("utf-8"))
    print(f"updated {SEED}: V5 workspaces + Castillo personal workspace written")


if __name__ == "__main__":
    main()
