"""Service configuration from environment variables.

CALC_SERVICE_TOKEN  shared secret presented by the trusted web server runtime.
CALC_DEMO_MODE      "1" enables a fixed local token (demo-local-token) when no
                    CALC_SERVICE_TOKEN is set. Never enable in production.
"""
from __future__ import annotations

import os
from dataclasses import dataclass

DEMO_TOKEN = "demo-local-token"


@dataclass(frozen=True)
class Settings:
    service_token: str
    demo_mode: bool


def load_settings() -> Settings:
    token = os.environ.get("CALC_SERVICE_TOKEN", "").strip()
    demo = os.environ.get("CALC_DEMO_MODE", "").strip() == "1"
    if not token:
        if demo:
            return Settings(service_token=DEMO_TOKEN, demo_mode=True)
        raise RuntimeError("CALC_SERVICE_TOKEN is not set. Set it, or set CALC_DEMO_MODE=1 for a local synthetic-data demo.")
    return Settings(service_token=token, demo_mode=demo)
