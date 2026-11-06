"""Fill sha256 and byte_length for every source document in seed.json from the fixture files.

Usage: python fixtures/synthetic/scripts/compute_hashes.py
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SEED = ROOT / "seed.json"


def locate(filename: str) -> Path:
    for folder in ("sources", "imports"):
        p = ROOT / folder / filename
        if p.exists():
            return p
    raise FileNotFoundError(filename)


def main() -> None:
    seed = json.loads(SEED.read_text(encoding="utf-8"))
    for doc in seed["source_documents"]:
        path = locate(doc["filename"])
        data = path.read_bytes()
        doc["sha256"] = hashlib.sha256(data).hexdigest()
        doc["byte_length"] = len(data)
        print(f"{doc['id']:<22} {doc['sha256'][:16]}...  {len(data):>6} bytes  {path.name}")
    SEED.write_text(json.dumps(seed, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"updated {SEED}")


if __name__ == "__main__":
    main()
