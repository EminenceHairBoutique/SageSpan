"""Run one audit probe file against a throwaway PostgreSQL 16 cluster (or SAGESPAN_TEST_DSN).

Usage: python supabase/tests/probes/run_probe.py supabase/tests/probes/900_audit_probes.sql

Applies shim_supabase.sql, the migrations and shim_pgtap.sql exactly as run_sql_tests.py
does, inlines `\\ir 000_helpers.sql`, runs the probe inside its own transaction (the file
ends with ROLLBACK) and prints the PROBE lines. A probe that reports "SUCCEEDED (finding
confirmed)" means the unsafe action went through; PR-001 must turn each one into a denial.
"""
from __future__ import annotations

import os
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
import run_sql_tests as r  # noqa: E402

probe = pathlib.Path(sys.argv[1])
dsn = os.environ.get("SAGESPAN_TEST_DSN")
cluster = None
if not dsn:
    cluster = r.Cluster().__enter__()
    dsn = cluster.dsn
try:
    for f in [r.HERE / "shim_supabase.sql", *r.MIGRATIONS, r.HERE / "shim_pgtap.sql"]:
        ok, out = r.psql(dsn, f.read_text(), f.name)
        if not ok:
            print("FAILED", f.name, out)
            sys.exit(2)
    text = probe.read_text().replace("\\ir 000_helpers.sql", (r.HERE / "000_helpers.sql").read_text())
    ok, out = r.psql(dsn, text, probe.name)
    for line in out.splitlines():
        if line.startswith("PROBE") or "ERROR" in line or not ok:
            print(line)
    sys.exit(0 if ok else 1)
finally:
    if cluster:
        cluster.__exit__(None, None, None)
