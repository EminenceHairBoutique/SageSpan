# V5 Session 3 — PR-002: coverage correctness and reproducibility (S-06 / S-07 / N-02)

**Date:** 2026-11-06. **Branch:** `feat/pr-002-coverage` (from `master` @ `604a630`, which contains PR-001 #5 and V5 session 1 + PERS-002 #7). **Scope delivered:** the three findings PR-001 deferred, on both tiers (TypeScript domain + PostgreSQL migration 0007), with the AI evidence resolver aligned to the same rule. **Not touched:** migrations 0001–0006, the personal (B2C) engines, AI provider. **Synthetic data only.**

## 1. What changed

### S-07 — calculator requests come from the frozen snapshot alone
- Snapshot payload **v2** (`sagespan.snapshot.v2`, `packages/contracts/src/domain.ts`): adds `policy` (tolerance, separation of duties, nonmaterial-exception setting, approver roles sorted in byte order, and `policy_sha256` = sha256(canonical_json(core)) as the recorded policy version), `household.source_tool_label` and `accounts[{id, account_type, tax_character}]`.
- `buildRmdRequest(snapshot, accountId)` (`apps/web/src/domain/checks.ts`) now takes only the snapshot: tolerance, vendor label and account classification are read from the payload; accounts to check come from the payload too. A v1 payload is refused (`SNAPSHOT_VERSION_UNSUPPORTED`).
- SQL (`0007` §2–§4): `app.policy_record(jsonb)`, `app.build_snapshot_payload` emits v2, `app.freeze_snapshot` verifies the policy record, vendor label and account list against the organisation's own rows and refuses v1.
- Proven: editing live tolerance, the household label and an account label after freeze leaves the frozen payload, the request and its hash unchanged; a new freeze records a different `policy_sha256`.

### N-02 — the latest attempt per (account, check type) governs
- `latestCheckRuns(runs, snapshotId)` and `coverageSummary(snapshot, runs, discrepancies)` (`packages/contracts/src/coverage.ts`): latest by `executed_at` (insertion order on ties); earlier attempts are listed as `superseded_run_ids` and never evaluated. Accounts come from the payload, so an unchecked account is `NOT_RUN`, not silently out of scope.
- `runRmdChecks` advances to CHECK_COMPLETE only when every payload account's latest attempt is a verified non-ERROR run. `approveReview` uses the same summary: ERROR → PASS recovers; PASS → ERROR refuses with `CHECK_FAILED_LATEST`; open discrepancies are evaluated on latest runs only.
- SQL (`0007` §5–§7): `app.latest_check_runs(uuid)`, `app.coverage_summary(uuid)`; `record_check_run` stamps `executed_at = clock_timestamp()` (the column default `now()` is transaction-constant, which made same-transaction retries tie) and applies the same CHECK_COMPLETE rule; `record_review` refuses `CHECK_REQUIRED` / `CHECK_FAILED_LATEST` from the latest attempts.
- The AI evidence resolver's `is_latest_for_account` now uses the shared helper on the current snapshot (previously its own rule across all snapshots).
- The workflow state machine was **not** extended with a CHECK_COMPLETE → FROZEN edge; a failed retry after a success does not rewind the status, approval simply refuses.

### S-06 — typed coverage outcome; unsupported-only is never "verified"
- `REVIEW_OUTCOMES`: `SUPPORTED_CHECK_VERIFIED` (every account PASS/NOT_REQUIRED with verified receipts, no documented exceptions, no dispositioned material difference), `APPROVED_WITH_EXCEPTIONS` (all verified but relying on documented exceptions and/or dispositioned real differences), `REVIEWED_WITH_LIMITATIONS` (any account UNSUPPORTED or INDETERMINATE). Precedence: limitations > exceptions > verified. Derived server-side by `approvalReadiness`; the approver never chooses it.
- `Review.coverage_outcome` + `coverage_summary` (TS and SQL: enum `app.review_outcome`, two nullable columns, check constraint tying them to `decision = 'APPROVED'`; no `UPDATE` privilege, so the label cannot be upgraded).
- Evidence packet v2 (`sagespan.evidence-packet.v2`): `title` from `packetTitle(summary, outcome)` ("… — reviewed with limitations (no supported checks: all N accounts outside supported scope)" etc.), a `coverage` block with per-account rows, `scope.accounts[].coverage`, `scope.policy_at_freeze`, `check_runs[].latest_attempt`, two added limitation sentences; HTML gains a "Coverage outcome" section.
- UI: `CoveragePanel` (checks page + review page) shows the latest attempt per account, earlier attempts kept, and "If approved now: …" / "Approval blocked: …"; review history and the Reviews & approvals list show the outcome chip; earlier attempts on the checks page are marked as history.

### Kept
- S-04 guard: any non-ERROR run on the snapshot without a verified receipt still refuses approval (TS and SQL), independent of the latest-attempt rule.
- N-04 discipline: 0007 ends with revoke-all + explicit grants; the inventory assertion in 005 and 007 lists the three new read-only entry points.
- Demo state → **v4** (older files reseed; synthetic). Audit probes file annotated: S-06/S-07/N-02 probes are now expected to fail (finding fixed).

## 2. Verification (executed in this session)

| Suite | Command | Result |
|---|---|---|
| SQL harness (embedded **PostgreSQL 16**, Supabase/pgTAP shims) | `SAGESPAN_PG_BIN=/usr/lib/postgresql/16/bin SAGESPAN_TEST_PG_PORT=55432 python supabase/tests/run_sql_tests.py` | **7/7 files**: 001–006 unchanged + `007_coverage_and_reproducibility.test.sql` (43 assertions) |
| Calculator | `uv run --locked pytest` | **119 passed** (unchanged; no engine change) |
| Contracts | `npx vitest run` | **47 passed** (+3 coverage helpers) |
| Web | `npx vitest run` (calculator up) | **104 passed, 2 skipped** (+10 in `pr-002-coverage.test.ts`) |
| Typecheck / lint | `npm run typecheck`, `npm run lint` | 0 errors, 0 warnings |
| Build | `npm run build --workspace apps/web` | ok |
| Playwright | `npx playwright test` (real dev server + real calculator) | **16 passed** (15 existing incl. updated Patel flow + `pr-002-coverage.spec.ts` Okafor) |

Not run: real Supabase Auth/JWT/PostgREST/RLS (never run on any branch). CI's `database` job runs the same harness on postgres:15.

Test-helper change: `tests.calc_request` (SQL) now names the household's real account id instead of `'ira'`, because N-02 evaluates attempts per payload account. Two existing TS assertions were updated for intentional behaviour changes (payload version string; packet title now derives from coverage).

## 3. Traceability
S-06, S-07, N-02 → implemented (see `docs/requirements/SAGESPAN_V5_TRACEABILITY.md` §F); S-04, N-01, N-04, N-05 preserved; G2 ("verified coverage semantics") technically satisfied on the shim stack, **not** on the real stack. AI-E20 ("ERROR followed by PASS") now rests on the shared latest-attempt rule.

## 4. Known limits
- Real-stack validation (G1/G2 on Supabase) still pending — PR-003.
- Payload v1 snapshots in any pre-0007 database would need a re-freeze; none exist in the demo seed.
- The browser cannot stage a mid-flow calculator failure deterministically, so ERROR→PASS retry is proven in the TS and SQL suites, not e2e.
- `packetTitle` strings are English-only and part of the packet contract (v2).

## 5. Next PR (recommended)
**PR-003 — production-shaped identity and storage** (§17.4): Supabase Auth actor resolution, store adapter, private document storage with server-computed hashes, and the first real Supabase RPC/JWT/RLS test run covering two firms, two consumers and a limited household grant. That run is what turns PR-001/PR-002's shim evidence into G1/G2 passes. Alternative B2C step: PERS-003 household invitations and consent-grant UI on the existing model (still synthetic).
