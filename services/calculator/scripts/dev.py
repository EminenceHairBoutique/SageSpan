"""Cross-platform local launcher for the calculation service (synthetic-data demo).

Usage (from services/calculator, with the virtualenv active):
    python scripts/dev.py              # port 8010, auto-reload
    python scripts/dev.py --port 8011  # other port
    python scripts/dev.py --no-reload

Sets CALC_DEMO_MODE=1 for this process only (unless CALC_DEMO_MODE or
CALC_SERVICE_TOKEN is already set), so it behaves the same in PowerShell,
cmd.exe, bash and zsh. Never use this launcher in production.
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

SERVICE_ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the SageSpan calculator locally (demo mode).")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8010)
    parser.add_argument("--no-reload", action="store_true")
    args = parser.parse_args()

    if not os.environ.get("CALC_SERVICE_TOKEN", "").strip():
        os.environ.setdefault("CALC_DEMO_MODE", "1")

    os.chdir(SERVICE_ROOT)
    if str(SERVICE_ROOT) not in sys.path:
        sys.path.insert(0, str(SERVICE_ROOT))

    try:
        import uvicorn
    except ModuleNotFoundError:
        sys.exit("uvicorn is not installed in this interpreter. Activate the service virtualenv "
                 "(.venv) and run: python -m pip install -r requirements.txt")

    uvicorn.run(
        "app.main:app",
        host=args.host,
        port=args.port,
        reload=not args.no_reload,
        reload_dirs=[str(SERVICE_ROOT / "app")] if not args.no_reload else None,
    )


if __name__ == "__main__":
    main()
