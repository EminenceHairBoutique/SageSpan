"""Three-tier canonical JSON parity: Python is the reference; expected.json is shared with the
TypeScript (packages/contracts) and SQL (supabase/tests/006_canonical_json.test.sql) tests."""
from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

from app.financial.canonical import canonical_hash, canonical_json

ROOT = Path(__file__).resolve().parents[1]
FIXTURES = ROOT.parent.parent / "fixtures" / "synthetic" / "canonical"
SQL_TEST = ROOT.parent.parent / "supabase" / "tests" / "006_canonical_json.test.sql"


def _cases() -> list[Path]:
    cases = sorted(FIXTURES.glob("case_*.json"))
    assert len(cases) >= 3
    return cases


def test_expected_hashes_match_python_reference():
    expected = json.loads((FIXTURES / "expected.json").read_text(encoding="utf-8"))
    for case in _cases():
        payload = json.loads(case.read_text(encoding="utf-8"))
        assert expected[case.name] == canonical_hash(payload), case.name
        assert re.fullmatch(r"[0-9a-f]{64}", expected[case.name])


def test_canonical_form_is_sorted_compact_and_escaped():
    payload = json.loads((FIXTURES / "case_strings.json").read_text(encoding="utf-8"))
    text = canonical_json(payload)
    assert text.startswith('{"1digit":')  # digits < uppercase < underscore < lowercase (byte order)
    assert '"Zcapital"' in text and text.index('"Zcapital"') < text.index('"_underscore"') < text.index('"key with spaces"')
    assert "\\u0007" in text and "\\u0001" in text  # control characters escaped as \u00XX
    assert "\x7f" in text  # DEL is not escaped (matches JSON.stringify and Postgres)
    assert "é" in text and "🧾" in text  # non-ASCII emitted raw (ensure_ascii=False)
    # Compact and idempotent: re-serialising the parsed text reproduces it byte for byte.
    assert chr(10) not in text
    assert text == json.dumps(json.loads(text), sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def test_sql_fixture_test_is_in_sync_with_fixtures():
    assert SQL_TEST.exists(), "run python scripts/export_canonical_sql_test.py"
    proc = subprocess.run([sys.executable, str(ROOT / "scripts" / "export_canonical_sql_test.py"), "--check"], capture_output=True, text=True, cwd=str(ROOT))
    assert proc.returncode == 0, proc.stdout + proc.stderr
    text = SQL_TEST.read_text(encoding="utf-8")
    expected = json.loads((FIXTURES / "expected.json").read_text(encoding="utf-8"))
    for case in _cases():
        assert expected[case.name] in text, f"{case.name} digest not embedded in the SQL test"
