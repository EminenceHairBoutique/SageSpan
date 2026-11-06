"""Cross-platform local launcher for the calculation service (synthetic-data demo).

Usage (from the repo root or services/calculator; any `python` works):
    npm run dev:calc                   # from the repo root
    python scripts/dev.py              # port $CALC_PORT or 8010, auto-reload
    python scripts/dev.py --port 8765  # other port
    python scripts/dev.py --no-reload

If the current interpreter is not the service's .venv, the launcher re-runs
itself with .venv's Python (created by `uv sync --locked --extra dev`), so a
global Python 3.14 on PATH can no longer start the service with the wrong
dependencies.

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
VENV_PYTHON = SERVICE_ROOT / ".venv" / ("Scripts/python.exe" if os.name == "nt" else "bin/python")


def ensure_venv_interpreter() -> None:
    """Re-exec under .venv's interpreter when launched with some other Python."""
    if not VENV_PYTHON.exists():
        sys.exit("services/calculator/.venv not found. Create it with:\n"
                 "  python -m uv sync --locked --extra dev --python 3.13")
    try:
        same = Path(sys.executable).resolve() == VENV_PYTHON.resolve()
    except OSError:
        same = False
    if not same and os.environ.get("SAGESPAN_DEV_REEXEC") != "1":
        import subprocess
        env = dict(os.environ, SAGESPAN_DEV_REEXEC="1")
        raise SystemExit(subprocess.call([str(VENV_PYTHON), str(Path(__file__).resolve()), *sys.argv[1:]], env=env))


def main() -> None:
    ensure_venv_interpreter()
    parser = argparse.ArgumentParser(description="Run the SageSpan calculator locally (demo mode).")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=int(os.environ.get("CALC_PORT", "8010")))
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
        sys.exit("uvicorn is not installed in .venv. Rebuild it with: "
                 "python -m uv sync --locked --extra dev --python 3.13")

    uvicorn.run(
        "app.main:app",
        host=args.host,
        port=args.port,
        reload=not args.no_reload,
        reload_dirs=[str(SERVICE_ROOT / "app")] if not args.no_reload else None,
    )


if __name__ == "__main__":
    main()
