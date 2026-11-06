"""Run the repository's SQL migrations and pgTAP-style tests on a real Postgres.

Local (no Docker): spawns a throwaway Postgres 16 cluster (needs initdb on PATH).
CI:                 PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE (a postgres:16 service),
                    or SAGESPAN_TEST_DSN for any other reachable server.

Steps: apply shim_supabase.sql (roles, auth.users, auth.uid) -> migrations in
order -> shim_pgtap.sql (unless the real pgtap extension is available) -> each
tests/*.test.sql via psql with ON_ERROR_STOP, inlining `\\ir` includes and
dropping the `create extension pgtap` line when the shim is in use.

Every test file runs inside its own transaction and rolls back, as pgTAP
intends, so the order of files does not matter.
"""

from __future__ import annotations

import os
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile
import time

HERE = pathlib.Path(__file__).resolve().parent
MIGRATIONS = sorted((HERE.parent / "migrations").glob("*.sql"))
TESTS = sorted(HERE.glob("*.test.sql"))
PG_BIN = pathlib.Path(shutil.which("initdb") or "/usr/lib/postgresql/16/bin/initdb").parent
PORT = int(os.environ.get("SAGESPAN_TEST_PG_PORT", "54331"))


class Cluster:
    def __init__(self) -> None:
        self.dir = pathlib.Path(tempfile.mkdtemp(prefix="sagespan-sql-"))
        self.data = self.dir / "data"
        self.runner: list[str] = []

    def __enter__(self) -> "Cluster":
        if os.geteuid() == 0:
            subprocess.run(["chown", "-R", "nobody", str(self.dir)], check=True)
            self.runner = ["runuser", "-u", "nobody", "--"]
        subprocess.run([*self.runner, str(PG_BIN / "initdb"), "-D", str(self.data), "-A", "trust", "-U", "postgres", "--no-sync"], check=True, capture_output=True)
        subprocess.run([*self.runner, str(PG_BIN / "pg_ctl"), "-D", str(self.data), "-o", f"-p {PORT} -k {self.dir} -c listen_addresses=''", "-l", str(self.dir / "log"), "start", "-w"], check=True, capture_output=True)
        time.sleep(0.5)
        self.dsn = f"host={self.dir} port={PORT} user=postgres dbname=postgres"
        return self

    def __exit__(self, *exc: object) -> None:
        subprocess.run([*self.runner, str(PG_BIN / "pg_ctl"), "-D", str(self.data), "stop", "-m", "immediate"], check=False, capture_output=True)
        shutil.rmtree(self.dir, ignore_errors=True)


def psql(dsn: str, sql: str, label: str) -> tuple[bool, str]:
    proc = subprocess.run(
        ["psql", dsn, "-v", "ON_ERROR_STOP=1", "-q", "-X", "-f", "-"],
        input=sql, text=True, capture_output=True,
    )
    out = (proc.stdout + proc.stderr).strip()
    return proc.returncode == 0, out


def has_pgtap(dsn: str) -> bool:
    ok, out = psql(dsn, "select 'PGTAP_' || count(*) from pg_available_extensions where name = 'pgtap';", "pgtap?")
    return ok and "PGTAP_1" in out


def preprocess(test: pathlib.Path, use_shim: bool) -> str:
    text = test.read_text()
    # inline \ir includes (psql -f - cannot resolve relative includes from stdin)
    def inline(m: re.Match[str]) -> str:
        return (test.parent / m.group(1)).read_text()
    text = re.sub(r"^\\ir\s+(\S+)\s*$", inline, text, flags=re.M)
    if use_shim:
        text = re.sub(r"^create extension if not exists pgtap[^;]*;\s*$", "set search_path = extensions, app, public;", text, flags=re.M)
    return text


def main() -> int:
    dsn = os.environ.get("SAGESPAN_TEST_DSN")
    if not dsn and os.environ.get("PGHOST"):
        # CI: libpq keyword DSN; the password travels in PGPASSWORD (read by psql),
        # never embedded in a connection URI.
        dsn = " ".join(f"{k}={os.environ[e]}" for k, e in (("host", "PGHOST"), ("port", "PGPORT"), ("user", "PGUSER"), ("dbname", "PGDATABASE")) if os.environ.get(e))
    cluster = None
    if not dsn:
        cluster = Cluster().__enter__()
        dsn = cluster.dsn
    try:
        ok, out = psql(dsn, (HERE / "shim_supabase.sql").read_text(), "shim")
        if not ok:
            print(out); return 2
        for m in MIGRATIONS:
            ok, out = psql(dsn, m.read_text(), m.name)
            print(f"{'applied' if ok else 'FAILED '} {m.name}")
            if not ok:
                print(out); return 2
        use_shim = not has_pgtap(dsn)
        if use_shim:
            ok, out = psql(dsn, (HERE / "shim_pgtap.sql").read_text(), "pgtap shim")
            if not ok:
                print(out); return 2
            print("pgtap: using shim (extension not available)")
        else:
            print("pgtap: real extension")
        failed = 0
        for t in TESTS:
            ok, out = psql(dsn, preprocess(t, use_shim), t.name)
            print(f"{'PASS' if ok else 'FAIL'} {t.name}")
            if not ok:
                failed += 1
                print("    " + "\n    ".join(out.splitlines()[-12:]))
        print(f"{len(TESTS) - failed}/{len(TESTS)} SQL test files passed")
        return 1 if failed else 0
    finally:
        if cluster:
            cluster.__exit__(None, None, None)


if __name__ == "__main__":
    sys.exit(main())
