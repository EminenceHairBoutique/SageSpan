"""Server-to-server authorisation and tenant context.

The calculation service is never called from a browser. The web application's
server runtime authenticates the end user, resolves their organisation, and
calls this service with:

  Authorization: Bearer <CALC_SERVICE_TOKEN>
  X-SageSpan-Org-Id: <org id resolved server-side>

`org_id` is read ONLY from that header. Request bodies that include `org_id`
are rejected by the strict schemas (422).
"""
from __future__ import annotations

import hmac
import re
from dataclasses import dataclass

from fastapi import Header, HTTPException, Request

_ORG_ID_RE = re.compile(r"^[A-Za-z0-9_\-:.]{1,128}$")


@dataclass(frozen=True)
class OrgContext:
    org_id: str


def require_service_auth(
    request: Request,
    authorization: str | None = Header(default=None),
    x_sagespan_org_id: str | None = Header(default=None, alias="X-SageSpan-Org-Id"),
) -> OrgContext:
    settings = request.app.state.settings
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail={"code": "UNAUTHENTICATED", "message": "Missing bearer service token."})
    presented = authorization.split(" ", 1)[1].strip()
    if not hmac.compare_digest(presented.encode(), settings.service_token.encode()):
        raise HTTPException(status_code=401, detail={"code": "UNAUTHENTICATED", "message": "Invalid service token."})
    if not x_sagespan_org_id or not _ORG_ID_RE.match(x_sagespan_org_id):
        raise HTTPException(status_code=400, detail={"code": "MISSING_ORG_CONTEXT", "message": "X-SageSpan-Org-Id header (server-resolved tenant) is required."})
    return OrgContext(org_id=x_sagespan_org_id)
