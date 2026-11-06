from __future__ import annotations

from app.jobs import InlineJobRunner


def test_inline_runner_executes_and_scopes_jobs_by_org():
    runner = InlineJobRunner({"echo": lambda payload, org: {"org": org, **payload}})
    h = runner.submit("echo", {"x": 1}, org_id="org_a")
    assert h.status == "SUCCEEDED" and h.result == {"org": "org_a", "x": 1}
    assert runner.get(h.job_id, "org_a") is h
    assert runner.get(h.job_id, "org_b") is None  # cross-tenant lookup never leaks


def test_inline_runner_reports_failures_without_raising():
    runner = InlineJobRunner({"boom": lambda p, o: 1 / 0})
    h = runner.submit("boom", {}, org_id="org_a")
    assert h.status == "FAILED" and "division" in (h.error or "")
    assert runner.submit("missing", {}, org_id="org_a").status == "FAILED"
