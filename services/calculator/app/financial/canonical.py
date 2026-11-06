"""Canonical JSON serialisation and SHA-256 hashing.

Used for request hashes, snapshot hashes, rule-set checksums and run hashes.
The canonical form is: UTF-8, sorted keys, no whitespace, Decimals rendered as
strings (never floats), dates as ISO-8601.
"""
from __future__ import annotations

import hashlib
import json
from datetime import date, datetime
from decimal import Decimal
from typing import Any


def _default(obj: Any) -> Any:
    if isinstance(obj, Decimal):
        return str(obj)
    if isinstance(obj, (date, datetime)):
        return obj.isoformat()
    raise TypeError(f"Object of type {type(obj).__name__} is not canonically serialisable")


def canonical_json(payload: Any) -> str:
    return json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False, default=_default)


def sha256_hex(data: str | bytes) -> str:
    if isinstance(data, str):
        data = data.encode("utf-8")
    return hashlib.sha256(data).hexdigest()


def canonical_hash(payload: Any) -> str:
    return sha256_hex(canonical_json(payload))
