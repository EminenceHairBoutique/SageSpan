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
