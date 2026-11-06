"""Export the OpenAPI document to packages/contracts/openapi/calculator.openapi.json."""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
os.environ.setdefault("CALC_DEMO_MODE", "1")

from app.main import app  # noqa: E402

out = ROOT.parent.parent / "packages" / "contracts" / "openapi" / "calculator.openapi.json"
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps(app.openapi(), indent=2, sort_keys=True) + "\n", encoding="utf-8")
print(f"wrote {out}")
