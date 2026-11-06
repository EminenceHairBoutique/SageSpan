# SageSpan Repository Audit and Next-Build Backlog — v2 (verified)

**Audit date:** November 5, 2026 (America/New_York); v2 re-verification completed the same evening against the working tree at `C:\Users\chinx\OneDrive\Documents\GitHub\SageSpan`.
**Repository:** https://github.com/EminenceHairBoutique/SageSpan (public)
**Branch / HEAD:** `master` / `1151c1e` (4 commits). Three unmerged PRs (#2, #3, #4) exist that v1 did not see.
**Inputs:** v1 audit (`SageSpan_Repository_Audit_2026-11-05.md`), the local working tree, GitHub API/Actions, IRS Pub. 590-B and 26 CFR §1.401(a)(9)-9 (via Cornell LII).
**Scope:** Static review plus **executed negative probes** against the real SQL migrations on PostgreSQL 16 and against the TypeScript domain tier. Not a penetration test, not a professional financial-model validation, not a security certification.

## What changed from v1

v1's architecture and product conclusions stand. v2 **confirms every P0 code finding by executing it** (v1 inferred them from reading), corrects four factual statements, and adds five findings v1 missed — two of them (N-01, N-03) go to the heart of the "tamper-evident evidence" promise.

| # | v1 said | v2 finding | Effect |
|---|---|---|---|
| 1 | S-01/S-02 cross-tenant exposure "depends on execution role and RLS behavior; do not infer exploitability" | **Confirmed on the harness:** a user with *no membership* in Org C moved an Org C household's status and appended a forged `SYSTEM`/`APPROVAL_RECORDED` event to Org C's audit chain, knowing only UUIDs. `supabase/config.toml` exposes schema `app` over PostgREST (`schemas = ["public", "app"]`), so both functions are reachable as `/rest/v1/rpc/...` by any authenticated user the moment Supabase is connected. | Severity language upgraded to **confirmed, latent** (not reachable today only because the web app is not wired to Supabase). Blocks any Supabase wiring (backlog item 3). |
| 2 | pytest "63 passed, 1 failed", failure "likely environment/dependency drift" | Reproduced both ways. FastAPI 0.162.0 / Pydantic 2.14.3: **64 passed**. FastAPI 0.128.2 / Pydantic 2.13.5: **63 passed, 1 failed** — Pydantic < 2.14 emits a `pattern` attribute on `Decimal` fields; the committed OpenAPI was exported from a newer Pydantic. | Confirmed as dependency drift, root cause identified. Fix is a lockfile, not code. |
| 3 | Local git changes "correspond to line endings, not material source-code changes" | 13 of 17 modified files differ only by CRLF (38 tracked files are CRLF in the working tree; no `.gitattributes`). **Four files carry real, uncommitted edits** (`README.md`, `docs/ARCHITECTURE.md`, `services/calculator/README.md`, `package.json` `dev:calc`) plus an untracked `services/calculator/scripts/dev.py` — a cross-platform launcher that sets `CALC_DEMO_MODE` for PowerShell/cmd/bash. | Commit them. Add `.gitattributes`; mark `fixtures/synthetic/**` as `-text` or the seeded SHA-256 source hashes break on a Windows checkout (today they survive only because those files happen to be LF on disk). |
| 4 | "Four SQL suites / 45 assertions were executed according to the project log" | Executed here: migrations apply cleanly; **4/4 files, 45 assertions pass** on PostgreSQL 16.15 with the repo's Supabase/pgTAP shims. | Independently reproduced (still shims, not real Supabase Auth/PostgREST). |
| 5 | Uniform Lifetime Table "checked against a secondary source" | All **49 factors (ages 72–120+)** in `rules.py` match 26 CFR §1.401(a)(9)-9(c) as served by Cornell LII (eCFR itself errored), and the two worked examples in Pub. 590-B (2025) (age 73 → 26.5; age 75 in 2026 → 24.6). | Regulation-text match, still an agent check. The qualified-reviewer gate remains open; update `docs/RULE_VERIFICATION_LOG.md`. |
| 6 | — | PRs #2 (coverage chip wording + dialog nesting), #3 (remove `Dashboard Examples/` third-party screenshots), #4 (Playwright CI job; pin DB job to Postgres 15 because `config.toml` pins `db.major_version = 15`) opened after HEAD; each has a green CI run; none merged. | Review/merge #2 and #4; #3 is a founder decision (files stay in history without a rewrite). |
| 7 | — | New findings **N-01 … N-05** below. | Added to PR-001 scope. |

## Executive decision (unchanged)

Keep the B2B **independent retirement-plan assurance** focus and the Next.js + shared contracts + independent Python calculation service architecture. The first saleable product is a **CCO-led, evidence-backed review of a bounded retirement-planning check**. The bottleneck is production trust boundaries and a real input workflow, not more calculators or dashboards.

**Release status:** working synthetic vertical slice; **not fit for live client data**; **not safe to connect to a Supabase project until PR-001 lands** (S-01/S-02 confirmed). Do not claim SOC 2, SEC certification, professional attestation, native vendor integrations or production security.

## Architecture and implemented modules (verified)

- `apps/web` — Next.js 16 / React 19; marketing routes; `/demo/app` synthetic console behind cookie personas (`SIMULATED_REVIEWER`); `/app` production gate (`getProductionActor()` always returns `null`); server actions; import mapping/reconciliation; freeze gate; review/approval; evidence export (JSON/HTML/CSV). Store: file-backed JSON under `apps/web/.demo-state/`.
- `packages/contracts` — Zod schemas, workflow transitions, role permission matrix, money/canonical/hash utilities, committed calculator OpenAPI snapshot.
- `services/calculator` — FastAPI, `Decimal` RMD engine, typed `UNSUPPORTED`/`INDETERMINATE`/`NOT_REQUIRED`, deferred-first-year events, receipts with request/run hashes, versioned rule sets with checksums; 2026 federal ordinary-income **draft** rule set is `DRAFT` and not exposed as a check.
- `supabase` — 4 migrations (928 lines): tenant-scoped schema with composite `(org_id, id)` FKs, RLS, SECURITY DEFINER workflow functions, immutability triggers; 4 SQL test files; shims for `auth.uid()`/pgTAP. **Not connected to the web app.** `config.toml` exposes `app` over the API.
- `fixtures/synthetic` — Patel, Okafor, Bauer, Reyes; seeded SHA-256 hashes match fixture bytes (verified for the Patel statement and by the web test suite for all).
- `.github/workflows/ci.yml` — calculator, web (lint/typecheck/unit/build) and Postgres 16 SQL jobs; run 8 on `1151c1e` green. PR #4 adds a Playwright job.
- 183 tracked files; no `LICENSE`; repository public and contains internal planning/pricing documents.

## Verification performed (v2)

Environment: Linux x64 VM on the audit machine; Python 3.12.16 (uv venv); Node 22.23.4; `npm install` against the committed lockfile; PostgreSQL 16.15 (embedded-postgres build) with the repo's own `run_sql_tests.py` (its `psql` shell-out satisfied by a small psycopg stand-in — no `psql` binary in the VM).

| Check | Command | Result |
|---|---|---|
| Python tests, current resolution | `pytest` (fastapi 0.162.0, pydantic 2.14.3, pydantic-core 2.50.4) | **64 passed** |
| Python tests, v1's resolution | `pytest` (fastapi 0.128.2, pydantic 2.13.5, pydantic-core 2.46.5) | **63 passed, 1 failed** (`test_openapi_contract_matches_committed_document`: `pattern` only in live schema on every `Decimal` field) |
| Python lint/type | `ruff check` (defaults) / `mypy --strict app` | ruff clean with repo config; `--isolated` ruff: 118 findings (style); mypy --strict: 30 errors, 25 in `financial/checks.py` (`Discrepancy(**dict)` typing). Not configured in CI; informational. |
| TS typecheck / lint | `npm run typecheck`, `npm run lint` (all workspaces) | clean |
| TS unit tests | `vitest run` contracts; `vitest run` web with calculator up | contracts **15 passed**; web **24 passed** (23 passed + 2 skipped without the service). Harness note: Vitest crashed with a bus error loading Tailwind/PostCSS native bindings in this VM; run with CSS processing disabled — a sandbox limitation, not a repo defect. |
| SQL suite | `python supabase/tests/run_sql_tests.py` on PG 16.15 | migrations applied; **PASS 001–004, 45 assertions** |
| `next build`, Playwright | — | **Not run here.** CI run 8 covers build; PR #4's own CI run covers Playwright (4 scenarios). |
| Negative probes | 15 SQL probes + 6 TS probes (below) | 13 SQL probes confirm findings; 2 denied (good). All 6 TS probes confirm. |

### Probe results (each probe attempts something that must be denied; "SUCCEEDED" = finding confirmed)

| Probe | Tier | Attempt | Result |
|---|---|---|---|
| S-01a | SQL | `VIEWER` calls `app.transition_household(hh, 'APPROVED')` on a `REVIEWED` household — no review row, no attestation, no SoD | **SUCCEEDED** |
| S-01b | SQL | `ADMIN` of Org D (no membership in Org C) moves an Org C household to `READY_TO_FREEZE` | **SUCCEEDED — cross-tenant write** |
| S-01c | SQL | `ANALYST` `update app.households set workflow_status = 'EXPORTED'` | **SUCCEEDED** (full-column UPDATE grant + `households_update` policy) |
| S-02 | SQL | Org D user calls `app.append_audit(orgC, 'APPROVAL_RECORDED', …, 'SYSTEM')` | **SUCCEEDED — forged cross-tenant SYSTEM event, hash-chained** |
| S-03 | SQL | `app.freeze_snapshot(hh, '{"facts":[]}', '000…0')` — hash is not `sha256(payload)` | **SUCCEEDED** (format check only) |
| S-05a | SQL | `ANALYST` `update app.facts set verification_status = 'FACT_CONFIRMED'` on a plan-tool value | **SUCCEEDED** |
| S-05b | SQL | `ANALYST` un-supersedes a superseded fact | **SUCCEEDED** |
| S-05c | SQL | `ANALYST` inserts a fabricated `check_runs` row with no engine receipt | **SUCCEEDED** |
| S-05d | SQL | `ANALYST` inserts a new fact already `FACT_CONFIRMED` with no source | denied (`facts_confirmed_has_source`) ✔ |
| S-05e | SQL | `ANALYST` registers a "CUSTODIAN_STATEMENT" with a self-declared SHA-256 and no bytes | **SUCCEEDED** |
| S-06 | SQL | `COMPLIANCE` approves a snapshot whose only run is `UNSUPPORTED` | **SUCCEEDED** |
| N-01 | SQL | `ADVISOR` rewrites `classification`, `delta_amount` and `disposition` of a dispositioned discrepancy | **SUCCEEDED** |
| N-02 | SQL | approve after one `ERROR` run and one later `PASS` run on the same snapshot | denied with `CHECK_REQUIRED` — **permanent block confirmed** |
| N-03 | SQL | 12 `append_audit` calls in one transaction, then count events sharing a predecessor | **FORKED:** 6–10 extra successor links per run; 6 sequential statements in one transaction produced 3–4 chain heads |
| N-04 | SQL | privilege inventory | `PUBLIC` holds EXECUTE on every `app` SECURITY DEFINER function (Postgres default); `anon` lacks `USAGE` on schema `app`, so not reachable today. All functions owned by `postgres`. |
| S-04 | TS | mocked receipt with wrong `request_hash` | run stored, `CHECK_COMPLETE`, **APPROVED**, packet exported with `request_hash_verified: false` buried in it |
| S-06 | TS | only run `UNSUPPORTED` | **APPROVED**, packet `scope.check_types = ["RMD_ANNUAL"]` |
| S-07 | TS | change live `org.policies.tolerance` after freeze | `buildRmdRequest` output (and therefore `request_hash`) **changes** for the same frozen snapshot |
| N-01 | TS | `dispositionDiscrepancy` after `APPROVED` | **overwrites** the disposition |
| N-02 | TS | service down once, then up | household stays `FROZEN` after the failed run; after a successful rerun and review, approval throws `CHECK_REQUIRED` forever |
| N-05 | TS | firm policy `approver_roles = ['ADVISOR']`, advisor approves | TS refuses (`ROLE_PERMISSIONS` has no `review.approve` for ADVISOR); SQL `record_review` would allow it — **the two tiers disagree** |

Probe sources are committed for reuse: `supabase/tests/probes/900_audit_probes.sql` (+ `run_probe.py`) and `apps/web/src/domain/__probes__/audit-probes.probe.ts`. They assert today's unsafe behaviour; PR-001 inverts them into regression tests.

## P0: Code-level findings and remediation

### S-01 — Uncontrolled workflow transition function [CRITICAL, confirmed, latent]

**Files:** `supabase/migrations/0004_workflow_functions.sql` (`app.transition_household`), `0003_rls.sql` (`grant … update on app.households`, `households_update`), `supabase/config.toml` (`schemas = ["public","app"]`).

`transition_household` is SECURITY DEFINER, granted to `authenticated`, and checks only the transition matrix — never the caller's membership, org or role. Direct `UPDATE` on `households` is granted on all columns to four roles. Probes S-01a/b/c.

**Fix:** `revoke execute on function app.transition_household, app.append_audit, app.assert_role from public, authenticated` (internal callers keep working: SECURITY DEFINER runs as owner). Restrict `households` UPDATE to a column list (`label`, `assignee_user_id`, `status`, …) and add a trigger that rejects `workflow_status`/`current_revision` changes outside the workflow functions (e.g. a `set_config('app.workflow_fn','1', true)` sentinel set inside them). Decide whether `app` should be API-exposed at all; if it stays exposed, every exposed function derives `org_id` from the entity and calls `assert_role`. Regression tests: viewer/analyst/non-member/anon × transition/UPDATE/RPC.

### S-02 — Audit injection [CRITICAL, confirmed, latent]

**File:** `0004_workflow_functions.sql` (`app.append_audit`).

Caller-supplied `org`, `event_type`, `actor_type` and summary; granted to `authenticated`; no membership check. Probe S-02 forged a `SYSTEM` `APPROVAL_RECORDED` event into another tenant's chain. The hash chain proves order, not authorisation. See also N-03 (the chain itself forks).

**Fix:** internal-only (revoke); `actor_type` derived (`USER` when `auth.uid()` is set, `SYSTEM` only from service paths); constrain `event_type` to an enum/allow-list; membership asserted when `auth.uid()` is present. Tests: forged `APPROVAL_RECORDED`, cross-org append, `SYSTEM` from a user session.

### S-03 — SQL freeze gate weaker than the TypeScript gate [HIGH, confirmed, latent]

**Files:** `0004_workflow_functions.sql` (`freeze_snapshot`), `apps/web/src/domain/freeze.ts`.

SQL checks state, open conflicts and hash *format*; the payload and digest are caller-supplied and never recomputed (probe S-03). Required-fact completeness lives only in TS.

**Fix:** implement `app.canonical_json(jsonb)` byte-compatible with `packages/contracts/src/canonical.ts` and `services/calculator/app/financial/canonical.py` (recursive, keys sorted `COLLATE "C"`, no whitespace), prove it with a three-tier fixture (same payload → identical SHA-256 in Python, TS and SQL), then recompute and compare in `freeze_snapshot`; verify every fact id in the payload is active, non-superseded, `FACT_CONFIRMED`/`FACT_ASSUMED` and belongs to the household; port the `REQUIRED_FACT_KEYS_RMD` completeness check. Mutation tests: missing fact, superseded fact, foreign fact, stale balance, wrong hash.

### S-04 — Mismatched calculator receipt advances the workflow [CRITICAL, confirmed, active in demo tier]

**Files:** `apps/web/src/provenance/calc-client.ts` (`requestHashVerified`), `apps/web/src/domain/checks.ts` (`runRmdChecks`), `apps/web/src/domain/review.ts` (`approveReview`).

Hash equality is a boolean that nothing enforces. TS probe: wrong `request_hash` → `CHECK_COMPLETE` → `APPROVED` → packet exported.

**Fix:** throw `RECEIPT_INTEGRITY_ERROR` in `runRmdChecks` before storing a result; persist the run as `ERROR` with no amount and a `CHECK_RUN_FAILED` event; approval requires, for the **latest run per account**: `request_hash_verified === true`, `response.receipt.snapshot_ref.input_hash === snapshot.content_sha256`, every receipt rule set `PUBLISHED` with a checksum matching the registry (`GET /v1/rules`), and known `engine_name`. Mirror in SQL via `app.record_check_run(...)` (see S-05). Tests: tampered request/run hash, foreign snapshot ref, unknown rule-set checksum, missing receipt.

### S-05 — Direct check insertion, fact promotion, self-declared documents [HIGH, confirmed, latent]

**File:** `0003_rls.sql`.

Confirmed: analyst inserts fabricated `check_runs` (S-05c); promotes a plan-tool fact to `FACT_CONFIRMED` by UPDATE (S-05a); un-supersedes facts (S-05b); registers a "custodian statement" with an invented hash and no bytes (S-05e). The `facts_confirmed_has_source` constraint correctly blocked S-05d but only requires *some* source, not primary evidence or a confirmation step.

**Fix:** revoke `UPDATE` on `facts` and `INSERT` on `check_runs`/`source_documents` from `authenticated`; add SECURITY DEFINER `app.confirm_fact(fact, rationale, evidence_ref)` (ADVISOR/COMPLIANCE), `app.record_check_run(snapshot, request, response)` (validates as in S-04), and a service-role-only document registration path that computes the SHA-256 from the stored bytes. Trigger: `superseded` may only go `false → true`; `verification_status` may only change inside functions. Positive/negative RLS tests with realistic JWT claims.

### S-06 — Approval accepts insufficient coverage [HIGH, confirmed in both tiers]

**Files:** `checks.ts`, `review.ts`, `0004_workflow_functions.sql` (`record_review`).

A snapshot whose only run is `UNSUPPORTED`, `INDETERMINATE` or `NOT_REQUIRED` satisfies "a run exists and none is `ERROR`" and is approved; the packet's `scope.check_types` still reads `RMD_ANNUAL`.

**Fix:** record a typed review outcome on the review and the packet — `SUPPORTED_CHECK_VERIFIED` (all latest runs `PASS`, receipts verified), `REVIEWED_WITH_LIMITATIONS` (any non-result run), `APPROVED_WITH_EXCEPTIONS` (documented exceptions present) — and derive packet title/scope from it. Per-account coverage rows in the packet. Tests: all-UNSUPPORTED household (Bauer/Reyes fixtures), mixed coverage, PASS-only.

### S-07 — Check request not derived solely from the frozen snapshot [MEDIUM, confirmed]

**File:** `checks.ts` (`buildRmdRequest`).

Reads `b.accounts` (account type fallback), `b.household.source_tool_label` and **live `org.policies.tolerance`** at run time. TS probe: changing firm tolerance after freeze changes the request hash of an already-frozen snapshot, so receipts are not reproducible from the snapshot alone.

**Fix:** freeze tolerance, account metadata (type, label), ownership, `source_tool_label` and comparison metadata into `SnapshotPayload`; build requests only from the payload; test that mutating live state after freeze leaves the request hash unchanged.

### S-08 — Demo form and state are not an operational CRM [MEDIUM, as v1]

`pilotInterestAction` writes real contact fields into the file-backed demo store (`apps/web/.demo-state/state.json`): not concurrent-safe, no access control, retention, privacy notice or anti-abuse. Acceptable only in controlled development. Fix as v1; additionally gate the public form off unless a protected backend exists.

### S-09 — Operational gaps [MEDIUM, as v1, two additions]

Demo mode defaults on (`SAGESPAN_DEMO_MODE ?? "1"`); `env.calcServiceToken` falls back to `demo-local-token` even in production builds; headers lack CSP/HSTS; Python dependencies are open lower bounds (`fastapi>=0.115`, `pydantic>=2.9`) with no lockfile — the exact cause of the v1 test failure; `supabase/config.toml` pins Postgres 15 while CI tests 16 (PR #4 aligns CI to 15); ruff/mypy are not run in CI and `mypy --strict` currently reports 30 errors.

**Fix:** fail-closed env validation (`NODE_ENV=production` + no `CALC_SERVICE_TOKEN` → refuse to start); `uv lock`/`pip-compile` with hashes, `requires-python = ">=3.12,<3.14"`, CI installs from the lock and regenerates/compares OpenAPI from the pinned environment; add ruff + mypy to CI once `checks.py` typing is fixed; CSP/HSTS at deploy; SAST/dependency/secret scanning; backup/restore test.

### S-10 — Evidence packet presentation vs cryptographic attestation [MEDIUM, as v1]

`packet.sha256` covers the canonical JSON only; HTML/CSV renderings are unhashed; source bytes are referenced by hash but not retained. Fix as v1 (manifest with per-artifact hashes, immutable source object ids, verifier instructions); no "signed" claims until a signature exists.

### N-01 — Dispositions and discrepancy amounts are mutable after approval [HIGH, new, both tiers]

**Files:** `0003_rls.sql` (`discrepancies_disposition`), `review.ts` (`dispositionDiscrepancy`), `0002_core_tables.sql` (no immutability trigger on `discrepancies`).

An ADVISOR/COMPLIANCE user can rewrite `classification`, `delta_amount`, `computed_amount` and the disposition note on a dispositioned discrepancy, including after the household is `APPROVED`/`EXPORTED`. The exported packet is immutable, but the live record the packet claims to summarise is not, and a re-export would silently differ.

**Fix:** make dispositions write-once through `app.disposition_discrepancy(...)`; trigger rejects changes to `classification`/amounts and any change once the run's snapshot is approved; TS mirrors (reject if already dispositioned or household past `REVIEWED`); re-disposition creates a new row with rationale. Tests both tiers.

### N-02 — One transient service failure permanently blocks approval [MEDIUM, new, both tiers]

`approveReview` and `record_review` fail with `CHECK_REQUIRED` if *any* run on the snapshot is `ERROR`, even after a later `PASS`. Recovery today requires a new snapshot revision just because the calculator was briefly down.

**Fix:** evaluate the **latest run per account**; keep failed runs as history; expose "superseded by" on the run. Test: ERROR then PASS → approvable; PASS then ERROR → blocked.

### N-03 — Audit hash chain forks inside a transaction [HIGH, new, SQL tier]

**File:** `0004_workflow_functions.sql` (`append_audit`).

The predecessor is chosen by `order by created_at desc, id desc`; `created_at = now()` is constant for a transaction, so ties resolve by random UUID and several events claim the same predecessor. Probe: 12 appends in one transaction → 6–10 duplicate predecessor links; even 6 sequential statements produced 3–4 chain heads. Test 003 only checks that each `previous_event_hash` exists, so this passes CI. Any multi-step function (freeze → transition → audit, or the TS tier's multi-account check runs once ported) will fork the chain the product advertises as tamper-evident. The TS tier is linear (array order) and unaffected.

**Fix:** per-org monotonic `seq` from an `app.audit_chain_heads(org_id, last_seq, last_hash)` row updated under the existing advisory lock; chain by `seq`, include `seq` in the hashed core; `unique (org_id, seq)` and `unique (org_id, previous_event_hash)`; verifier walks by `seq`. Test: N appends in one transaction → exactly one head, N-1 links.

### N-04 — PUBLIC EXECUTE on SECURITY DEFINER functions [LOW, new, hygiene]

Postgres grants `EXECUTE` to `PUBLIC` on creation; all twelve `app` SECURITY DEFINER functions carry it. `anon` is saved only by lacking `USAGE` on schema `app`. Fix: `revoke execute on all functions in schema app from public; alter default privileges in schema app revoke execute on functions from public;` then grant explicitly.

### N-05 — Approver policy semantics differ between tiers [MEDIUM, new]

TS `ROLE_PERMISSIONS` gives `review.approve` to `COMPLIANCE` only, so an `ADVISOR` can never approve even when `org.policies.approver_roles` names ADVISOR (and `updatePolicy` lets a CCO configure exactly that). SQL `record_review` honours `approver_roles` and would let the advisor approve. One tier is wrong, and the settings UI can create a configuration the demo cannot honour.

**Fix:** one rule in `packages/contracts`: capability (`review.approve`) ∪ firm policy (`approver_roles`) → both tiers evaluate the same function/matrix; decide whether ADVISOR approval is a product option at all (v3 docs say CCO approves; advisor reviews). Same fixture matrix run against TS and SQL.

## Financial-methodology review

**Strengths (verified):** `Decimal` arithmetic with `ROUND_HALF_UP` to cents; eligibility gating returns typed non-results for inherited accounts, deceased owners, Roth, employer plans, rollover add-backs, non-USD, missing birth date/alive status/type/inherited flag/beneficiary evidence, balance as-of mismatch, and the joint-table case (spouse sole primary beneficiary > 10 years younger → `UNSUPPORTED`, Table II not implemented); first distribution year, required beginning date and deferred first-year RMD modelled as separate `ObligationEvent`s valued on the prior-prior-year balance; SECURE 2.0 applicable-age bands (70½ / 72 / 73 / 75) with sources. Golden case `640,000 / 25.5 = 25,098.04` passes; imported `24,000` → `1,098.04` discrepancy.

**Rule table status:** `UNIFORM_LIFETIME_TABLE_2022` (ages 72–120+) matches 26 CFR §1.401(a)(9)(c) exactly (49/49) and Pub. 590-B (2025) examples. **This is still an agent check.** `docs/RULE_VERIFICATION_LOG.md` must record this regulation-text comparison (date, URLs) and keep the status "not yet verified by a qualified reviewer"; the `SUPPORTED_VERIFIED` coverage label must keep meaning "internal golden-test coverage of a published rule set" (PR #2 fixes the chip wording). Commission a named CPA/EA/CFP® sign-off before any external "verified" language.

**Financial UX gap (unchanged):** surface `UNSUPPORTED` / `INDETERMINATE` / `NOT_COMPARABLE` per account with reason, evidence needed and owner; never render such a row as verified (S-06). Keep the P1 draft tax rule set `DRAFT` and unexposed until independently benchmarked (PolicyEngine-US / Tax-Calculator) and the 65+/senior deduction figures are verified.

**Prioritised domain expansion after P0:** rule-change workflow and book-wide impact preview; beneficiary-designation freshness; missing/stale 12/31 balances; prior-year RMD monitoring; Table II once reviewed. No 43-state tax, Monte Carlo, autonomous advice or trading.

## Product and UX recommendations (unchanged from v1)

Ideal buyer: firm owner/CEO/COO (economic), CCO (champion), advisors (evidence). Sell faster, auditable review. Sequence: CCO Review Queue → Source-to-Fact Reconciliation → Calculation Comparison → Approval Workspace (never show hash mismatch or unsupported coverage as success) → Evidence Bundle. AI features only after provenance works; no LLM-generated amounts or auto-approval; isolate untrusted document text; log model version and reviewer edits.

## Prioritised engineering backlog with acceptance tests

| Order | Work package | Definition of done |
|---|---|---|
| 1 | **PR-001 Trust boundary hardening** (S-01, S-02, S-03, S-04, S-05, N-01, N-03, N-04, N-05, OpenAPI pin) | All 21 probes above invert to *denied/consistent* and run in CI; cross-tenant, role-forgery, fabricated run/audit/document, fake-hash and out-of-order tests pass on PG and, where available, real Supabase |
| 2 | **PR-002 Approval and coverage semantics** (S-06, S-07, N-02) | Typed review outcomes; packet scope derived from coverage; latest-run-per-account; request built solely from snapshot; negative fixtures for all-UNSUPPORTED and mixed coverage |
| 3 | Auth + persistent tenant store | Supabase Auth sessions, active membership, server-derived roles, Supabase store adapter replacing the file store, org scoping and revocation proven; **blocked until 1 lands** |
| 4 | End-to-end real-stack CI | `supabase start`, migrations, real JWT/RLS, PostgREST/RPC routes, Playwright (PR #4), locked Python + Node installs |
| 5 | Secure source document storage | Private tenant buckets; server-computed digests; immutable/versioned sources; upload validation/scanning; retention and restore test |
| 6 | Two permissioned import formats | Real permitted exports mapped to the contract; success/error matrix; provenance coverage; unsupported-field handling |
| 7 | Evidence PDF + verifier | Manifest with per-artifact hashes; independent verifier script; stable server-side rendering |
| 8 | CCO dashboard and metrics | Exception queue, coverage, review latency, false positives, manual-mapping load |
| 9 | Professional rule verification | Named reviewer sign-off in `RULE_VERIFICATION_LOG.md`; independent benchmark fixtures; rule publish/rollback history |
| 10 | Design-partner security package | Counsel-approved scope, DPA, retention/IR, access reviews, subprocessors, role matrix |

## 30/60/90-day decision gates (unchanged, with one addition)

Days 0–30 also includes: merge PR #2/#4, decide PR #3 (history rewrite or not), add `.gitattributes`, commit the dev-launcher edits, make the repository private while internal documents live in it, add a LICENSE decision. Pricing remains the illustrative hypothesis ($750/mo incl. 100 households + $3.50; $500/mo pilot ≤ 50).

**Minimum performance evidence:** zero unauthorised cross-tenant actions in real-stack tests; all 21 audit probes denied; malformed/unsupported inputs fail closed; 100% seeded material discrepancies detected in supported scenarios; a linear audit chain under concurrent appends; full receipt replay from snapshot alone; no unverified calculator output approvable.

## Business, compliance and governance (unchanged)

Rule 206(4)-7 (compliance programs/CCO), Rule 204-2 (books and records), Regulation S-P (safeguards/incident response) frame the product's role; SageSpan supports a firm's workflow and claims no automatic fulfilment. Specialist counsel before client data. Sources: https://www.sec.gov/rules-regulations/2003/12/compliance-programs-investment-companies-investment-advisers ; https://www.sec.gov/newsroom/press-releases/2024-58 .

The repository is public with internal planning/pricing documents and no LICENSE; consider making it private now. Exclude `.git`, `node_modules`, `.next`, `.venv`, `.demo-state`, Playwright artifacts and `.archive` from future ZIPs.

## Suggested first implementation PRs

**PR-001 Trust boundary hardening** — scope in the backlog row above; full prompt in `docs/audits/NEXT_PROMPT_PR-001.md`.
**PR-002 Approval and coverage semantics** — S-06, S-07, N-02.
**PR-003 Production-shaped integration** — Supabase Auth + RLS + PostgREST + store adapter; strict demo/production separation; rate limits; real-stack e2e before any pilot.
**PR-004 Import feasibility spike** — two permitted export samples from consenting firms; map, log unsupported fields, quantify mapping rate; no implied vendor integrations.

## Overall verdict

The foundation is worth keeping, and v2 found no arithmetic defect. It did confirm, by execution, that the current SQL trust boundary would let any authenticated user alter any tenant's workflow and audit trail the day Supabase is connected, that the demo tier approves unverified receipts and unsupported checks, and that the audit chain forks under ordinary multi-step transactions. Fix those first (PR-001/PR-002), then wire authentication and persistence, then solve real imports and test whether CCOs will pay.

## Sources

- IRS Publication 590-B (2025): https://www.irs.gov/publications/p590b
- 26 CFR §1.401(a)(9)-9 (Cornell LII mirror): https://www.law.cornell.edu/cfr/text/26/1.401(a)(9)-9
- Supabase RLS guide (views/SECURITY DEFINER/bypass notes): https://supabase.com/docs/guides/database/postgres/row-level-security
- GitHub Actions for the repository: https://github.com/EminenceHairBoutique/SageSpan/actions
- SEC compliance-programs rule and Reg S-P release as cited above.
