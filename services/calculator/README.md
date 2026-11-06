# SageSpan calculation & verification service

Independent, deterministic, `Decimal`-safe retirement rule checks. P0: lifetime
RMD for living owners of non-inherited traditional-family IRAs (Uniform Lifetime
Table). Every run returns a traceable receipt citing the exact rule set versions
and checksums used.

## Run locally

```bash
cd services/calculator
python -m venv .venv                      # first time only
# PowerShell: .\.venv\Scripts\Activate.ps1   |   POSIX: source .venv/bin/activate
python -m pip install -r requirements.txt
python scripts/dev.py                     # sets CALC_DEMO_MODE=1 for this process; port 8010, reload
```

Running uvicorn directly needs the variable set in your shell's syntax:
PowerShell `$env:CALC_DEMO_MODE = "1"`, cmd.exe `set CALC_DEMO_MODE=1`,
bash `export CALC_DEMO_MODE=1`. (In PowerShell, `set X=1` does not set an
environment variable.)

OpenAPI UI: http://127.0.0.1:8010/docs

## Test

```bash
python -m pytest -q
```

## Contract

The committed OpenAPI document lives at `packages/contracts/openapi/calculator.openapi.json`.
Regenerate with `python scripts/export_openapi.py`; `tests/test_api.py` fails if the
committed document drifts from the running application.

## Security model

* Server-to-server only. `Authorization: Bearer <CALC_SERVICE_TOKEN>` is required.
* Tenant context comes only from `X-SageSpan-Org-Id`, set by the trusted web server
  after authenticating the user. Bodies containing `org_id` are rejected (422).
* No request payloads are logged or stored. Validation errors return field paths only.
* `CALC_DEMO_MODE=1` uses a fixed local token and is for synthetic-data demos only.

## V5 Personal engines (2026-11-06)

| Endpoint | Method set | What it does |
|---|---|---|
| `POST /v1/personal/clarity` | `personal.cashflow_baseline@2026.1` | Median/low observed income, essential vs discretionary commitments, margin, liquid cash vs the user's floor, buffer months, dated 30/60/90-day outlook with bill collisions, flags, data quality. Returns `INSUFFICIENT_DATA` rather than guessing. |
| `POST /v1/personal/debt-paths` | `personal.debt_amortization@2026.1` | Minimums-only / avalanche / snowball / hybrid amortisation on identical inputs under a budget or an extra monthly amount; liquidity guard against the cash floor. |
| `GET /v1/methods` | — | Methodology registry (separate from `/v1/rules`; not seeded into Postgres yet, see ADR-V5-001 §6). |

All three use the same bearer token and `X-SageSpan-Org-Id` header (the web tier passes the workspace id). Receipts cite method sets exactly like rule sets. Conventions are documented in `app/financial/methods.py` and `docs/finance/RULE_VERIFICATION_AND_MODEL_REGISTRY.md`; goldens in `tests/test_personal_clarity.py` and `tests/test_debt_paths.py`. These are descriptive engines: not advice, and not a verification of the user's inputs.
