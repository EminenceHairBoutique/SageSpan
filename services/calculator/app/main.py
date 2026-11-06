"""FastAPI application for the SageSpan calculation & verification service."""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from . import ENGINE_NAME, ENGINE_VERSION
from .auth import OrgContext, require_service_auth
from .config import load_settings
from .financial.methods import METHODOLOGY_SETS
from .financial.personal_receipt import run_debt_paths, run_personal_clarity
from .financial.receipt import run_rmd_check
from .financial.rules import ALL_RULE_SETS, get_rule_set
from .schemas import ErrorResponse, HealthResponse, RmdCheckRequest, RmdCheckResponse, RuleSetListResponse, RuleSetRef
from .schemas_personal import DebtPathsRequest, DebtPathsResponse, MethodSetListResponse, PersonalClarityRequest, PersonalClarityResponse

log = logging.getLogger("sagespan.calculator")

DESCRIPTION = """
Deterministic, Decimal-safe financial engines with versioned rule/methodology
sets and traceable receipts.

* Assurance (B2B): lifetime RMD check for living owners of non-inherited
  traditional-family IRAs using the Uniform Lifetime Table.
* Personal (B2C, V5): descriptive cash-flow baseline and illustrative debt
  payoff path comparison on user-reported inputs. Descriptive arithmetic only;
  never advice, never a verification of the inputs.

Tenant context is supplied by the trusted web server via `X-SageSpan-Org-Id`;
request bodies never carry `org_id`. No client data is retained by this service.
"""


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.settings = load_settings()
    if app.state.settings.demo_mode:
        log.warning("CALC_DEMO_MODE=1: using the fixed local demo token. Synthetic data only.")
    yield


app = FastAPI(
    title="SageSpan Calculation & Verification Service",
    version=ENGINE_VERSION,
    description=DESCRIPTION,
    lifespan=lifespan,
    openapi_tags=[
        {"name": "checks", "description": "Independent rule checks returning traceable receipts."},
        {"name": "rules", "description": "Versioned, effective-dated rule registry."},
        {"name": "personal", "description": "Personal (B2C) deterministic engines: cash-flow baseline and debt payoff paths. Descriptive, receipted, not advice."},
        {"name": "system", "description": "Health and version."},
    ],
)


@app.exception_handler(HTTPException)
async def http_exc_handler(_: Request, exc: HTTPException):
    detail = exc.detail if isinstance(exc.detail, dict) else {"code": "HTTP_ERROR", "message": str(exc.detail)}
    return JSONResponse(status_code=exc.status_code, content={"error": detail})


@app.exception_handler(RequestValidationError)
async def validation_exc_handler(_: Request, exc: RequestValidationError):
    # Never echo request bodies back (they may contain client facts); return field paths only.
    details = [{"loc": [str(p) for p in e.get("loc", [])], "type": e.get("type"), "msg": e.get("msg")} for e in exc.errors()]
    return JSONResponse(status_code=422, content={"error": {"code": "VALIDATION_ERROR", "message": "Request did not match the contract.", "details": details}})


# Every declared error response carries an explicit description so the OpenAPI
# document does not depend on the interpreter's HTTP status phrase table
# (Python 3.13 renamed 422 from "Unprocessable Entity" to "Unprocessable Content").
ERROR_RESPONSES = {
    400: {"model": ErrorResponse, "description": "Missing server-resolved tenant header"},
    401: {"model": ErrorResponse, "description": "Missing or invalid service token"},
    404: {"model": ErrorResponse, "description": "Unknown rule set"},
    422: {"model": ErrorResponse, "description": "Request did not match the contract (field paths only; submitted values are never echoed)"},
}


@app.get("/health", response_model=HealthResponse, tags=["system"])
async def health(request: Request) -> HealthResponse:
    return HealthResponse(status="ok", engine_name=ENGINE_NAME, engine_version=ENGINE_VERSION, demo_mode=request.app.state.settings.demo_mode)


@app.get("/v1/rules", response_model=RuleSetListResponse, tags=["rules"], responses={401: ERROR_RESPONSES[401]})
async def list_rules(_: OrgContext = Depends(require_service_auth)) -> RuleSetListResponse:
    return RuleSetListResponse(rule_sets=[RuleSetRef(**r.ref()) for r in ALL_RULE_SETS], engine_name=ENGINE_NAME, engine_version=ENGINE_VERSION)


@app.get("/v1/rules/{rule_set_id}", response_model=RuleSetRef, tags=["rules"], responses={401: ERROR_RESPONSES[401], 404: ERROR_RESPONSES[404]})
async def get_rule(rule_set_id: str, _: OrgContext = Depends(require_service_auth)) -> RuleSetRef:
    rs = get_rule_set(rule_set_id)
    if rs is None:
        raise HTTPException(status_code=404, detail={"code": "RULE_SET_NOT_FOUND", "message": "Unknown rule set."})
    return RuleSetRef(**rs.ref())


@app.post(
    "/v1/checks/rmd",
    response_model=RmdCheckResponse,
    tags=["checks"],
    responses={400: ERROR_RESPONSES[400], 401: ERROR_RESPONSES[401], 422: ERROR_RESPONSES[422]},
)
async def check_rmd(body: RmdCheckRequest, ctx: OrgContext = Depends(require_service_auth)) -> RmdCheckResponse:
    """Independent RMD check for one account and tax year.

    Returns PASS with the computed amount and obligation events, or a typed
    NOT_REQUIRED / UNSUPPORTED / INDETERMINATE status with reasons. When an
    imported plan value is supplied, includes a discrepancy classification.
    """
    return run_rmd_check(body, org_id=ctx.org_id)


@app.get("/v1/methods", response_model=MethodSetListResponse, tags=["personal"], responses={401: ERROR_RESPONSES[401]})
async def list_methods(_: OrgContext = Depends(require_service_auth)) -> MethodSetListResponse:
    """Versioned methodology sets used by the Personal engines (separate registry from regulatory rule sets)."""
    return MethodSetListResponse(method_sets=[RuleSetRef(**m.ref()) for m in METHODOLOGY_SETS], engine_name=ENGINE_NAME, engine_version=ENGINE_VERSION)


@app.post(
    "/v1/personal/clarity",
    response_model=PersonalClarityResponse,
    tags=["personal"],
    responses={400: ERROR_RESPONSES[400], 401: ERROR_RESPONSES[401], 422: ERROR_RESPONSES[422]},
)
async def personal_clarity(body: PersonalClarityRequest, ctx: OrgContext = Depends(require_service_auth)) -> PersonalClarityResponse:
    """Personal cash-flow baseline: income statistics, commitments, margin, buffer, dated 30/60/90-day outlook, flags and data quality.

    Descriptive arithmetic on user-reported inputs with a receipt citing
    `personal.cashflow_baseline`. INSUFFICIENT_DATA is returned, not a guess,
    when income, expenses or cash balances are absent.
    """
    return run_personal_clarity(body, org_id=ctx.org_id)


@app.post(
    "/v1/personal/debt-paths",
    response_model=DebtPathsResponse,
    tags=["personal"],
    responses={400: ERROR_RESPONSES[400], 401: ERROR_RESPONSES[401], 422: ERROR_RESPONSES[422]},
)
async def personal_debt_paths(body: DebtPathsRequest, ctx: OrgContext = Depends(require_service_auth)) -> DebtPathsResponse:
    """Compare debt payoff orderings (minimums only, avalanche, snowball, hybrid) on identical inputs under a fixed monthly budget and the user's cash floor."""
    return run_debt_paths(body, org_id=ctx.org_id)
