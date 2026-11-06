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
from .financial.receipt import run_rmd_check
from .financial.rules import ALL_RULE_SETS, get_rule_set
from .schemas import ErrorResponse, HealthResponse, RmdCheckRequest, RmdCheckResponse, RuleSetListResponse, RuleSetRef

log = logging.getLogger("sagespan.calculator")

DESCRIPTION = """
Deterministic, Decimal-safe retirement rule checks with versioned rule sets and
traceable receipts. P0 scope: lifetime RMD for living owners of non-inherited
traditional-family IRAs using the Uniform Lifetime Table.

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


@app.get("/health", response_model=HealthResponse, tags=["system"])
async def health(request: Request) -> HealthResponse:
    return HealthResponse(status="ok", engine_name=ENGINE_NAME, engine_version=ENGINE_VERSION, demo_mode=request.app.state.settings.demo_mode)


@app.get("/v1/rules", response_model=RuleSetListResponse, tags=["rules"], responses={401: ERROR_RESPONSES[401]})
async def list_rules(_: OrgContext = Depends(require_service_auth)) -> RuleSetListResponse:
    return RuleSetListResponse(rule_sets=[RuleSetRef(**r.ref()) for r in ALL_RULE_SETS], engine_name=ENGINE_NAME, engine_version=ENGINE_VERSION)


# Every declared error response carries an explicit description so the OpenAPI
# document does not depend on the interpreter's HTTP status phrase table
# (Python 3.13 renamed 422 from "Unprocessable Entity" to "Unprocessable Content").
ERROR_RESPONSES = {
    400: {"model": ErrorResponse, "description": "Missing server-resolved tenant header"},
    401: {"model": ErrorResponse, "description": "Missing or invalid service token"},
    404: {"model": ErrorResponse, "description": "Unknown rule set"},
    422: {"model": ErrorResponse, "description": "Request did not match the contract (field paths only; submitted values are never echoed)"},
}


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
