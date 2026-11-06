"""Asynchronous job interface (future rule-impact analysis, bulk re-checks).

Initial RMD checks are synchronous and fast. Long-running work must NOT run in
Vercel request handlers; it belongs on a worker behind a queue. This module
defines the interface now so the web app and service can adopt a queue later
without changing call sites.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Callable, Literal, Protocol

JobStatus = Literal["QUEUED", "RUNNING", "SUCCEEDED", "FAILED"]


@dataclass
class JobHandle:
    job_id: str
    job_type: str
    status: JobStatus
    submitted_at: datetime
    result: Any | None = None
    error: str | None = None
    org_id: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


class JobRunner(Protocol):
    def submit(self, job_type: str, payload: dict[str, Any], org_id: str) -> JobHandle: ...
    def get(self, job_id: str, org_id: str) -> JobHandle | None: ...


class InlineJobRunner:
    """Executes jobs synchronously in-process. Suitable for tests and local demos only."""

    def __init__(self, handlers: dict[str, Callable[[dict[str, Any], str], Any]]):
        self._handlers = handlers
        self._jobs: dict[str, JobHandle] = {}

    def submit(self, job_type: str, payload: dict[str, Any], org_id: str) -> JobHandle:
        handle = JobHandle(job_id=str(uuid.uuid4()), job_type=job_type, status="QUEUED", submitted_at=datetime.now(timezone.utc), org_id=org_id)
        self._jobs[handle.job_id] = handle
        handler = self._handlers.get(job_type)
        if handler is None:
            handle.status, handle.error = "FAILED", f"no handler for job type {job_type}"
            return handle
        handle.status = "RUNNING"
        try:
            handle.result = handler(payload, org_id)
            handle.status = "SUCCEEDED"
        except Exception as exc:  # noqa: BLE001 - surfaced to caller
            handle.status, handle.error = "FAILED", str(exc)
        return handle

    def get(self, job_id: str, org_id: str) -> JobHandle | None:
        job = self._jobs.get(job_id)
        if job is None or job.org_id != org_id:
            return None  # tenant-scoped: never leak another org's job
        return job
