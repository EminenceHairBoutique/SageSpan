# Security design and limits

This is a description of the design and of what this synthetic build
implements. It is not a certification, an audit, or legal advice. Nothing here
claims production readiness; the real Supabase stack has not been run.

## Threat model (prototype scope)

| Threat | Control in this build |
|---|---|
| Tenant A reads or changes tenant B data | Server-side tenant scoping on every read/mutation (tested); SQL composite FKs and RLS on every table, executed on plain Postgres with shims (117 assertions), not yet on the real Supabase stack |
| Client forges `org_id` or role | Actor resolved from the server session only; calculation service reads tenant from a server-set header and rejects `org_id` in bodies (tested) |
| Workflow fields written outside a workflow function (S-01) | `authenticated` holds UPDATE only on `label, status, assignee_user_id, source_tool_label`; a trigger refuses `workflow_status` / `current_revision` changes unless the transaction-local sentinel `app.workflow_fn` is set by a SECURITY DEFINER workflow function; `app.transition_household` is not executable by `authenticated` (tested, SQL 005) |
| Forged or cross-tenant audit events (S-02) | `app.append_audit` is executable by `service_role` only; workflow functions call it internally; `actor_type` is derived (USER when `auth.uid()` is set, SYSTEM only for a privileged session), `event_type` is allow-listed, every event carries `seq` in its hashed core and the chain is serialised per organisation through `app.audit_chain_heads` under an advisory lock (tested, SQL 003/005) |
| Freeze with a payload that does not match the hash or the stored facts (S-03) | `app.freeze_snapshot` recomputes `sha256(app.canonical_json(payload))`, checks the household identity, revision and tax year, requires every cited fact to exist, be active, be confirmed/assumed and carry the same value, and requires every RMD-required fact to be present; `app.canonical_json` is byte-compatible with the TypeScript and Python canonicalisers (shared fixtures, tested in all three tiers) |
| Tampered or foreign calculation receipt (S-04) | The web tier re-derives `request_hash`, requires engine `sagespan-calculator`, requires the receipt's `snapshot_ref` to match the frozen snapshot and every cited rule set to be PUBLISHED with the same checksum in the registry; failures are recorded as ERROR runs with `RECEIPT_INTEGRITY_ERROR` plus a `CHECK_RUN_FAILED` audit event and never advance the workflow. `app.record_check_run` repeats the checks in SQL against the seeded rule-set registry (migration 0006). Approval refuses any non-ERROR run whose receipt is not verified (`CHECK_RECEIPT_UNVERIFIED`) |
| Direct check insertion, fact promotion, self-declared documents (S-05) | `authenticated` cannot INSERT `check_runs`, INSERT/UPDATE `discrepancies`, UPDATE `facts` or INSERT `source_documents`; facts change only through `app.confirm_fact` (COMPLIANCE/ADVISOR, rationale and evidence reference required) and the resolution functions; a trigger makes `superseded` one-way and `verification_status` sentinel-only |
| Rewritten dispositions or discrepancy amounts (N-01) | Discrepancy amounts/classification are immutable; a disposition is write-once (`ALREADY_DISPOSITIONED`) and refused once the household is APPROVED/EXPORTED, in SQL (trigger + function) and TypeScript |
| Production deployed with demo defaults (N-03 web) | With `NODE_ENV=production` and `SAGESPAN_DEMO_MODE` not exactly `1`, `apps/web/src/config/env.ts` refuses the demo token/URL; `instrumentation.ts` runs the check at server start |
| PUBLIC EXECUTE on SECURITY DEFINER functions (N-04) | Every function in schema `app` is revoked from PUBLIC/anon/authenticated/service_role and re-granted explicitly; the SQL suite asserts the exact list executable by `authenticated` |
| Approval matrix differs between tiers (N-05) | `approvalDecision()` in `packages/contracts` (capability COMPLIANCE/ADVISOR × firm policy `approver_roles`) drives the UI, the domain tier and the SQL `record_review` policy check (`NOT_AN_APPROVER`) |
| UI-only approval | Approval is a domain function requiring approver role, rationale, attestation, no open discrepancies, verified receipts and separation of duties; denials are audited (tested); SQL `record_review` repeats the checks and records `auth.uid()` as reviewer |
| Silent edits to frozen evidence | Snapshots are immutable; later changes create a new revision (tested); SQL triggers refuse snapshot/review/check-run/audit mutation |
| Tampered audit history | Per-organisation SHA-256 hash chain with `seq`, verified by `app.verify_audit_chain` and in the console (tested) |
| Malicious import files | Only the documented CSV/JSON contract; size/row/column limits; strict RFC 4180 parser; Zod validation; unsupported files rejected before any state is written (tested) |
| Spreadsheet formula injection in exports | Cells beginning with `= + - @` or tab/CR are neutralised (tested) |
| PII or financial values in logs | Audit events store digests and identifier-level summaries; validation errors return field paths, not values |
| Browser framing / sniffing | `X-Frame-Options: DENY`, `nosniff`, strict referrer policy, no `X-Powered-By` |
| Secrets in the browser | Service token and any service-role key are server-only; `NEXT_PUBLIC_*` is limited to the Supabase URL/anon key and brand strings |
| Dependency drift in the calculator | `services/calculator/uv.lock` pins the environment (Pydantic 2.14.3, FastAPI 0.162.0, Python 3.12–3.13); CI installs with `uv sync --locked`; the OpenAPI drift test is generated from that environment |

## Trust boundaries (PR-001, 2026-11-05)

Findings are numbered as in `docs/audits/REPOSITORY_AUDIT_2026-11-05_v2.md`.
Each row lists the layer that enforces the invariant and the test that would
fail if it regressed. "—" means the layer is not the control for that row.

| Finding | Postgres privilege | RLS | Trigger | Function check | TypeScript check | Tests |
|---|---|---|---|---|---|---|
| S-01 workflow transitions | `transition_household` not executable by `authenticated`; column-level UPDATE grant on `households` | `households_update` scoped to membership | `households_workflow_guard` (sentinel) | `set_reconciliation_status`, `send_to_review` assert role and membership on entry | `domain/workflow.ts` is the only writer of `workflow_status` | SQL 005 S-01a–c; web `trust-boundaries` "sentinel equivalent" |
| S-02 audit injection | `append_audit` executable by `service_role` only | — | `audit_events` immutability; `unique (org_id, seq)`, `unique (org_id, previous_event_hash)` | derived `actor_type`, event-type allow-list, `assert_member`, advisory lock, `verify_audit_chain` | `appendAudit` is internal to `src/domain` | SQL 003, 005 S-02 |
| S-03 freeze gate | — | snapshot insert through definer function only | snapshot immutability | hash recompute, identity, fact existence/status/value, required facts | `freezeSnapshot` + byte-order `buildSnapshotPayload` | SQL 005 S-03; SQL 006 (canonical fixtures); contracts `trust-boundaries`; web `trust-boundaries` S-03 |
| S-04 receipts | `check_runs` INSERT and `discrepancies` INSERT/UPDATE revoked from `authenticated` | — | `rule_sets_checksum_guard` | `record_check_run` integrity checks → ERROR run + `CHECK_RUN_FAILED`; `record_review` `CHECK_RECEIPT_UNVERIFIED` | `verifyReceipt`, `runRmdChecks`, `approveReview` | SQL 005 S-04; web `trust-boundaries` S-04 (5 mutations + registry down + unverified approval) |
| S-05a–e facts, checks, documents | `facts` UPDATE, `check_runs` INSERT, `source_documents` INSERT revoked from `authenticated` | write policies dropped | `facts_guard_update` | `confirm_fact` role, rationale, evidence reference | `confirmFact` role check | SQL 005 S-05a–e |
| N-01 dispositions | `discrepancies` UPDATE revoked | — | `discrepancies_guard` (immutable amounts, write-once disposition, sentinel) | `disposition_discrepancy` refuses `ALREADY_DISPOSITIONED` and APPROVED/EXPORTED | `dispositionDiscrepancy`, `recordDisposition` | SQL 005 N-01; web `trust-boundaries` N-01 |
| N-03 audit chain forks | — | — | `unique (org_id, previous_event_hash)` | `audit_chain_heads` + advisory lock + `seq` | — | SQL 003 (`verify_audit_chain` intact), 005 |
| N-03 (web) demo defaults | — | — | — | — | `env.ts` fail-closed, `instrumentation.ts` | web `trust-boundaries` N-03 |
| N-04 privileges | revoke-all then explicit grants, re-asserted at the end of 0005 | — | — | — | — | SQL 005 N-04 inventory; `supabase/tests/probes/advisor_equivalent.sql` |
| N-05 approval matrix | — | — | — | `record_review` policy check (`NOT_AN_APPROVER`, 42501) | `approvalDecision` / `canApprove` (UI + domain) | contracts `trust-boundaries`; web `trust-boundaries` N-05; SQL 005 N-05 |

PR-002 (migration `0007_coverage_and_reproducibility.sql`, branch
`feat/pr-002-coverage`, merged as #9) closes the three findings PR-001 left open:

| Finding | Privileges | Function / trigger | Web tier | Tests |
|---|---|---|---|---|
| S-06 coverage ≠ approval | `reviews` gains `coverage_outcome` (enum `app.review_outcome`) + `coverage_summary`; check constraint ties them to `decision = 'APPROVED'` | `record_review` derives the outcome from `app.coverage_summary()`; the approver cannot supply it | `approveReview` records `approvalReadiness(coverageSummary(...))`; packet title/scope from `packetTitle` | SQL 007 E4/E5/E6; web `pr-002-coverage` S-06; contracts coverage helpers; e2e Okafor |
| S-07 snapshot-only requests | — | `build_snapshot_payload` emits v2 (policy record with `policy_sha256`, vendor label, account classification); `freeze_snapshot` verifies all three against the organisation's rows and refuses v1 | `buildRmdRequest(snapshot, accountId)` reads only the payload; `policyRecord()` hashes the policy at freeze | SQL 007 E1 (live policy/label edit after freeze leaves the frozen payload and hash unchanged; `policy_sha256` pinned to the shared fixture digest); web `pr-002-coverage` S-07; three-tier canonical fixtures `case_policy_record.json` and `case_snapshot_v2.json` (pytest, contracts, SQL 006) |
| N-02 latest attempt | — | `app.latest_check_runs()`; `record_check_run` stamps `clock_timestamp()` and advances to CHECK_COMPLETE only when every payload account's latest attempt is clean; `record_review` refuses `CHECK_FAILED_LATEST` | `latestCheckRuns()` shared by approval, packet, UI and the AI evidence resolver | SQL 007 E2 (ERROR→PASS approvable), E3 (PASS→ERROR refused); web `pr-002-coverage` N-02 |

The S-04 guard that refuses approval when any non-ERROR run lacks a verified
receipt is kept unchanged on both tiers. The state machine has no
CHECK_COMPLETE → FROZEN edge, so a failed retry after a success does not rewind
the workflow status; approval evaluates the same latest attempts and refuses.

## What is deliberately not claimed

* No SOC 2, ISO 27001, SEC, FINRA or "exam-proof" status.
* No zero-data-retention or no-training guarantees for any AI vendor. The
  prototype was developed with Claude Fable 5.1, whose documented terms require
  30-day retention; only synthetic data was used.
* No encryption-at-rest, backup, retention or incident-response guarantees
  beyond what a signed agreement would state.
* No vendor integrations: vendor labels on imports are metadata.
* RLS is **not** described as production-proven: the policies and functions
  have been executed on plain PostgreSQL with Supabase shims, never on the
  real Supabase stack (`supabase start` needs Docker, which was not available).

## Verification status of security tests (as of this build)

| Test | Status |
|---|---|
| Web domain: cross-tenant reads/mutations return not-found | Passing (vitest) |
| Web domain: forged approval by VIEWER/ANALYST/ADMIN rejected | Passing (vitest) |
| Web domain: separation of duties denial audited | Passing (vitest) |
| Web domain: snapshot immutability, new revision | Passing (vitest) |
| Web domain: service unavailable → visible error, no local math | Passing (vitest) |
| Web domain: receipt integrity (wrong hash, wrong snapshot, unknown engine, unpublished rule set, no rule sets, registry down), unverified-receipt approval refused, write-once dispositions, approval matrix, fail-closed env, byte-order payloads | Passing (vitest, `src/domain/__tests__/trust-boundaries.test.ts`, 20 tests, 2026-11-05) |
| Contracts: approval matrix for all roles × policies; canonical fixtures hash identically to Python and SQL | Passing (vitest, `test/trust-boundaries.test.ts`) |
| Calculation service: token required, tenant header required, body `org_id` rejected; OpenAPI drift; rule-set seed and canonical SQL test generated from the locked environment | Passing (pytest, 69 tests, Python 3.13.3 from `uv.lock`) |
| Browser: forged API approval as viewer → 403; Northline cannot open Patel; full Patel flow against the real engine | Passing (Playwright, 4 scenarios) |
| SQL: tenant isolation, roles/workflow, immutability/chain, constraints, trust boundaries (58 assertions), canonical JSON parity (9) | **Executed 2026-11-05 on PostgreSQL 18.6** (embedded, no Docker) via `supabase/tests/run_sql_tests.py` with the Supabase/pgTAP shims: 6 migrations applied, 6/6 test files, 117 assertions. The same runner is the CI `database` job (`postgres:15`). `supabase test db` on the real stack has **not** been run. |

| SQL (PR-002, PR-003a): coverage/reproducibility (43), workspaces and consent (74) | Executed 2026-11-06 on embedded PostgreSQL 16 via the runner: 8 migrations applied, 8/8 files. The runner now also fails a file whose `plan(n)` disagrees with the assertions run (real pgTAP behaviour); three pre-existing mismatches were corrected. |
| Web: production identity resolution (firm actor from ACTIVE memberships only; personal actor from `my_workspace_access`; selectors ignored unless confirmed; grants = read-only scope, never an actor; unknown roles/domains dropped) | Passing (vitest, `src/auth/__tests__/identity.test.ts`, 10 tests, mocked post-RLS client) |
| Browser: every `/app/*` route gates without Supabase configuration; the auth callback refuses foreign redirect targets | Passing (Playwright, `pr-003-identity.spec.ts`) |
| DATA-001 repository: diff/remap plan over the real domain functions, FK order, zero-row refusal, partial-write disclosure; mocked PostgREST filters and `::text` casts | Passing (vitest, `supabase-repository.test.ts`, 12) |
| DATA-001/002 against the real stack: owner CRUD round-trip, snapshot/run/decision/retirement round-trip, supersede, DB refusal of an unverified success, one-domain participant isolation, stranger NOT_FOUND, direct insert 42501 | **CI `realstack` job vitest step only** (`supabase-repository.realstack.test.ts`, 4 tests, skipped without env) |
| DATA-002: atomic `apply_personal_changes` (forged workspace/actor columns overwritten, allow-lists, mid-plan rollback), S-05 run-shape CHECK, one-CURRENT snapshot, read scope for computed results, no direct write privilege on personal tables | Passing (SQL 009, 50 assertions, shim PostgreSQL 16 with pgTAP-equivalent record comparison) |
| Real stack: `supabase test db` (genuine pgTAP) + `supabase/realstack/run.mjs` (real GoTrue JWTs, PostgREST, RLS: two firms, three consumers, shared household limited to one domain, firm grant, expiry, revocation, refused direct writes, anon key alone) | **Executed in CI (`realstack` job) on PR #10, run 3 (`fa2669b`): pgTAP 8 files, 251/251 assertions, PASS; harness 50/50.** Not runnable in the build sandbox. Runs 1–2 found and fixed an implicit-collation bug in three test files and a deprecated auth setting (`docs/engineering/V5_SESSION_4_PR_003_REPORT.md` §2a). |

The shim run proves the policies and functions on plain Postgres; the real-stack run (`supabase test db` plus `supabase/realstack/run.mjs`) is the evidence that counts and is now part of CI. It proves the RLS/entry-point behaviour on a disposable local Supabase stack; it says nothing about a deployed project's configuration (keys, network, backups, Security Advisor, rate limits), about any store adapter (none exists), or about vector search (none exists). "Real-stack validated" below means exactly this CI evidence.

## Release gates (from the founder documents)

1. Prototype (this build): synthetic data only, no production secrets, unit and
   integration tests, this threat-model note.
2. Design-partner sandbox: firm-approved synthetic/anonymised data, signed
   permission, security review, documented use limitations.
3. Real-client pilot: counsel perimeter memo, DPA, security risk assessment,
   validated calculations, incident-response and access-control tests, review
   protocol, approved sub-processors, executed RLS tests on the real stack,
   object storage with malware scanning.
4. Public release: independent model validation, legal terms, security posture,
   regulated communications review, billing controls, operational runbook.

## Known limitations of the prototype

* The demo store is a JSON file; it is not concurrent-safe and is reset by
  design. It exists to exercise the workflow, not to hold real records.
* Uploaded file bytes are hashed but not stored. After PR-001 only
  `service_role` may register a `source_documents` row, so the server-side
  path that stores bytes, hashes them and registers the row still has to be
  built (planned as PR-003); until then documents arrive only through fixtures.
* Shims versus Supabase: the SQL suite runs with `tests/shim_supabase.sql`
  (roles, `auth.uid()` from `request.jwt.claims`) and `tests/shim_pgtap.sql`.
  Differences from the hosted platform that matter: migrations run as the
  superuser `postgres` here, whereas Supabase applies them as `postgres`
  without superuser; `service_role` is created with `BYPASSRLS` by the shim as
  on Supabase; `anon` is granted nothing in schema `app`. Tables use `enable`
  rather than `force row level security` since 0005, so the table owner
  (`postgres`, which runs the SECURITY DEFINER workflow functions) is not
  subject to the policies while `authenticated`/`anon` are. Re-check both
  points on the real stack.
* Supabase Security Advisor: the hosted advisor could not be run. The local
  equivalent (`supabase/tests/probes/advisor_equivalent.sql`) reports no
  table without RLS or policies, no SECURITY DEFINER function with a mutable
  `search_path`, no function executable by PUBLIC or `anon`, no `anon` table
  privileges, no `security_definer` views and no extensions in `public`. It
  does flag the performance lint `auth_rls_initplan` on nine insert/update
  policies from migration 0003 that call `auth.uid()` per row; that is a
  performance item, left for a later migration.
* Canonical ordering: keys are ordered by UTF-16 code unit in TypeScript, by
  code point in Python and by UTF-8 byte in SQL (`collate "C"`). These agree
  for every key in use (ASCII); a key containing characters outside the Basic
  Multilingual Plane could order differently and must not be introduced.
* `mypy` is not run in CI (typing cleanup of `Discrepancy(**dict)` in
  `app/financial/checks.py` is pending); `ruff` status is recorded in the
  PR-001 description.
* Demo reviewers are simulated; `actor_type = SIMULATED_REVIEWER` is recorded
  on every review and packet.
* PDF rendering is not bundled; the HTML packet is print-ready.
* The P1 tax module is a DRAFT and is not exposed.

## AI runtime limits (AI track; appended 2026-11-06, AI-CORE-002b)

* `reauthorize()` in the AI tool loop is awaited before every tool execution and
  before the run is recorded; in the demo it re-reads the file store, in
  production it is `PersonalRepository.bundle()` under the user's own RLS
  session (DATA-001/002). A revoked membership ends the run with the
  repository's non-disclosing NotFound and nothing is recorded; a new CURRENT
  snapshot between turns rejects the run (`CONTEXT_CHANGED`). Firm-side
  production grounding does not exist yet (needs DATA-003a).
* AI run records for PRODUCTION workspaces are **not persisted**: there is no
  AI-run table (the AI track's future migration, number from the registry).
  `runPersonalUnderstandForRepository()` returns `persisted:false` with a note
  rather than writing into a repository view that would drop the record.
* Hosted-provider quotas (`ai-quota-v1`) are enforced by a per-process store:
  two web instances do not share counters, so the effective limit is per
  instance until the durable store (same migration) exists. A store failure
  fails the run closed; it never admits a vendor call without a decision.
* No live vendor call has been made from this repository or its CI; the live
  benchmark is opt-in with five gates and writes to a git-ignored folder.
