"""The SQL rule registry seed must be generated from the Python registry (same checksums)."""
from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

from app.financial.rules import ALL_RULE_SETS, RMD_RULE_SETS

ROOT = Path(__file__).resolve().parents[1]
SEED = ROOT.parent.parent / "supabase" / "migrations" / "0006_seed_rule_sets.sql"


def test_seed_migration_matches_registry():
    assert SEED.exists(), "run python scripts/export_rule_sets_sql.py"
    proc = subprocess.run([sys.executable, str(ROOT / "scripts" / "export_rule_sets_sql.py"), "--check"], capture_output=True, text=True, cwd=str(ROOT))
    assert proc.returncode == 0, proc.stdout + proc.stderr


def test_seed_carries_every_published_rmd_rule_set_with_its_checksum():
    text = SEED.read_text(encoding="utf-8")
    for r in RMD_RULE_SETS:
        assert r.status == "PUBLISHED"
        assert re.search(rf"'{re.escape(r.rule_set_id)}'.*'{re.escape(r.version)}'.*'{r.checksum}', 'PUBLISHED'", text), r.rule_set_id
    draft = [r for r in ALL_RULE_SETS if r.status == "DRAFT"]
    for r in draft:
        assert f"'{r.checksum}', 'DRAFT', null" in text, "draft rule sets are seeded unapproved"
