"""Run the repository's SQL migrations and pgTAP-style tests on a real Postgres.

Local (no Docker): spawns a throwaway Postgres 16 cluster (needs initdb on PATH).
CI:                 PGHOST/PGPORT/PGUSER/PGDATABASE (a postgres:16 service with trust auth),
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
PG_BIN = pathlib.Path(shutil.which("initdb") or os.environ.get("SAGESPAN_PG_BIN", "/usr/lib/postgresql/16/bin") + "/initdb").parent
PORT = int(os.environ.get("SAGESPAN_TEST_PG_PORT", "54331"))


class Cluster:
    def __init__(self) -> None:
        self.dir = pathlib.Path(tempfile.mkdtemp(prefix="sagespan-sql-"))
        self.data = self.dir / "data"
        self.runner: list[str] = []
        self.locale = ""

    def __enter__(self) -> "Cluster":
        if hasattr(os, "geteuid") and os.geteuid() == 0:
            subprocess.run(["chown", "-R", "nobody", str(self.dir)], check=True)
            self.runner = ["runuser", "-u", "nobody", "--"]
        # No pipes: on Windows the postmaster would inherit a captured stdout and the launcher would block forever.
        quiet = {"stdin": subprocess.DEVNULL, "stdout": subprocess.DEVNULL, "stderr": subprocess.DEVNULL}
        # A non-"C" default collation (Supabase uses en_US.UTF-8) is what exposes implicit-collation
        # mismatches such as information_schema identifiers vs. text literals; an initdb without a
        # locale would silently hide them. Fall back to the plain cluster if the locale is absent.
        locale = os.environ.get("SAGESPAN_TEST_PG_LOCALE", "C.UTF-8")
        base = [*self.runner, str(PG_BIN / "initdb"), "-D", str(self.data), "-A", "trust", "-U", "postgres", "--no-sync"]
        if locale and subprocess.run([*base, f"--locale={locale}"], **quiet).returncode == 0:
            self.locale = locale
        else:
            shutil.rmtree(self.data, ignore_errors=True)
            subprocess.run(base, check=True, **quiet)
            self.locale = "(initdb default)"
        if os.name == "nt":
            # Windows: loopback TCP (no Unix-socket directory semantics to rely on).
            opts = f"-p {PORT} -c listen_addresses=127.0.0.1"
            self.dsn = f"host=127.0.0.1 port={PORT} user=postgres dbname=postgres"
        else:
            opts = f"-p {PORT} -k {self.dir} -c listen_addresses=''"
            self.dsn = f"host={self.dir} port={PORT} user=postgres dbname=postgres"
        subprocess.run([*self.runner, str(PG_BIN / "pg_ctl"), "-D", str(self.data), "-o", opts, "-l", str(self.dir / "log"), "start", "-w", "-t", "60"], check=True, timeout=120, **quiet)
        time.sleep(0.5)
        return self

    def __exit__(self, *exc: object) -> None:
        subprocess.run([*self.runner, str(PG_BIN / "pg_ctl"), "-D", str(self.data), "stop", "-m", "immediate"], check=False, timeout=60, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        shutil.rmtree(self.dir, ignore_errors=True)


def psql(dsn: str, sql: str, label: str) -> tuple[bool, str]:
    """Execute a SQL script; uses the psql binary when present, otherwise psycopg (same ON_ERROR_STOP semantics)."""
    if shutil.which("psql"):
        proc = subprocess.run(
            ["psql", dsn, "-v", "ON_ERROR_STOP=1", "-q", "-X", "-f", "-"],
            input=sql, text=True, capture_output=True,
        )
        out = (proc.stdout + proc.stderr).strip()
        return proc.returncode == 0, out
    try:
        import psycopg  # type: ignore[import-not-found]
    except ModuleNotFoundError:
        return False, "neither the psql binary nor the psycopg package is available"
    try:
        with psycopg.connect(dsn, autocommit=True) as conn:
            with conn.cursor() as cur:
                cur.execute(sql)
                notes: list[str] = []
                # drain any result sets (plan/finish/select lines) for diagnostics
                while True:
                    try:
                        rows = cur.fetchall()
                        notes.extend(str(r[0]) for r in rows if r)
                    except psycopg.ProgrammingError:
                        pass
                    if not cur.nextset():
                        break
        return True, chr(10).join(notes)
    except psycopg.Error as exc:  # type: ignore[attr-defined]
        return False, f"{label}: {exc.__class__.__name__}: {exc}"


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
        # CI: libpq keyword DSN built from PG* variables (trust auth on the CI service;
        # if a password is ever needed, libpq reads PGPASSWORD itself).
        dsn = " ".join(f"{k}={os.environ[e]}" for k, e in (("host", "PGHOST"), ("port", "PGPORT"), ("user", "PGUSER"), ("dbname", "PGDATABASE")) if os.environ.get(e))
    cluster = None
    if not dsn:
        cluster = Cluster().__enter__()
        dsn = cluster.dsn
        print(f"embedded cluster locale: {cluster.locale}")
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
            text = preprocess(t, use_shim)
            ok, out = psql(dsn, text, t.name)
            if ok and use_shim:
                # Real pgTAP fails a file whose plan(n) disagrees with the tests run; the shim's plan() is a no-op,
                # so enforce the same contract here (every shim assertion prints exactly one "ok - ..." row).
                planned = re.search(r"^select plan\((\d+)\);", text, flags=re.M)
                ran = len(re.findall(r"^\s*ok - ", out, flags=re.M))
                if planned and int(planned.group(1)) != ran:
                    ok, out = False, f"plan mismatch: planned {planned.group(1)} tests but ran {ran}"
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
