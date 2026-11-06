# Architecture

SageSpan (provisional brand) is a monorepo with three runtime parts and one
shared contract package.

```
apps/web/                Next.js 16 App Router, React 19, strict TypeScript, Tailwind 4
services/calculator/     FastAPI, Decimal rules, versioned rule registry, pytest
packages/contracts/      Zod mirrors of the service contract, enums, workflow, permissions, pricing
supabase/                Postgres schema, RLS, SECURITY DEFINER workflow functions, pgTAP tests
fixtures/synthetic/      Fictional households, source documents, import samples, engine fixtures
docs/                    This folder
```

## Request flow (synthetic demo mode)

```
Browser ──> Next.js server components / server actions / route handlers
              │  actor = demo persona cookie (SIMULATED_REVIEWER) → {user_id, org_id, role}
              │  every read is tenant-scoped; every mutation re-checks role + state
              ├─> src/domain/*            workflow services (reconcile, freeze, checks, review, evidence)
              ├─> src/domain/store.ts     file-backed JSON store seeded from fixtures/synthetic/seed.json
              └─> src/provenance/calc-client.ts
                        │  Authorization: Bearer <CALC_SERVICE_TOKEN>
                        │  X-SageSpan-Org-Id: <org resolved on the server>
                        ▼
                  services/calculator  POST /v1/checks/rmd  →  typed result + receipt
```

The browser never talks to the calculation service and never supplies an
organisation id. The service rejects bodies containing `org_id` (strict schemas).

## Web application layout (`apps/web/src`)

| Folder | Responsibility |
|---|---|
| `app/(marketing)` | Public pages: home, product, security, pricing, demo tour |
| `app/demo/app` | Synthetic console: review queue, household overview, imports, checks, review, evidence, settings |
| `app/app` | Production namespace; shows an honest "not configured" gate |
| `app/api` | Route handlers: sample downloads, packet downloads, tenant-scoped facts, review endpoint |
| `auth/` | Actor resolution (demo personas now; Supabase session later), `Actor` type |
| `domain/` | Store, queries, reconciliation, freeze gate and snapshots, checks, review, evidence, audit |
| `import/` | Strict CSV parser, CSV→contract mapper, upload validation, injection-safe CSV export |
| `provenance/` | Calculation-service client with hash verification; byte hashing |
| `server/actions.ts` | `"use server"` entry points; each resolves the actor and calls the domain |
| `ui/` | Primitives, console shell, marketing components, receipt dialog, forms |

No React component computes retirement math. Numbers shown in the console are
either typed facts (with a fact receipt) or engine outputs (with a run receipt).

## Data model

The demo store, the Zod/TypeScript domain types and the SQL schema share one
shape (snake_case columns). Entities: organizations, profiles, memberships,
households, persons, accounts, account_ownership, beneficiary_designations,
source_documents, source_locations, facts, fact_conflicts (+ links),
assumption_sets, assumptions, plan_imports, imported_plan_values, snapshots,
check_runs, discrepancies, reviews, review_comments, evidence_packets,
audit_events, rule_sets, rule_parameters.

Key invariants:

* every tenant-bound row carries `org_id`; SQL uses composite `(org_id, id)`
  foreign keys so cross-organisation references are impossible;
* facts are typed (exactly one value column matches `value_kind`), effective
  and as-of dated, and revisioned (`supersedes_fact_id`, `superseded`);
* snapshots are canonical JSON, SHA-256 hashed, one FROZEN per household; later
  changes create a new revision;
* audit events are append-only and hash-chained per organisation
  (`previous_event_hash`, `event_hash`, `payload_digest`);
* approvals carry the authenticated reviewer identity, role, rationale and a
  conflict attestation.

## Workflow state machine

`IMPORT_DRAFT → MAPPED → RECONCILIATION_PENDING → BLOCKED | READY_TO_FREEZE → FROZEN → CHECK_COMPLETE → REVIEW_PENDING → REVIEWED → APPROVED → EXPORTED`

Defined once in `packages/contracts/src/workflow.ts` and mirrored in
`app.can_transition()` in SQL. A new import opens a new revision (`→ IMPORT_DRAFT`);
resolving a conflict after freeze re-opens `RECONCILIATION_PENDING`. Frozen
snapshots, check runs, reviews and packets are never edited.

## Trust boundaries (PR-001, 2026-11-05)

* `src/domain/workflow.ts` is the only writer of `workflow_status`, `current_revision` and dispositions
  (TypeScript equivalent of the SQL sentinel `app.workflow_fn`).
* `src/domain/checks.ts` `verifyReceipt()` accepts a calculation response only when the re-derived
  `request_hash` matches, the engine is `sagespan-calculator`, the receipt's `snapshot_ref` is the frozen
  snapshot, and every cited rule set is PUBLISHED in the registry (`GET /v1/rules`) with the same checksum.
  Anything else is an ERROR run with `RECEIPT_INTEGRITY_ERROR` and a `CHECK_RUN_FAILED` audit event.
* `approveReview` requires `request_hash_verified === true` on every non-ERROR run and uses the shared
  `approvalDecision()` matrix from `packages/contracts`.
* `src/config/env.ts` is fail-closed in production (`NODE_ENV=production` and `SAGESPAN_DEMO_MODE` not
  `1`); `src/instrumentation.ts` runs the check at server start.
* Snapshot payload ordering is byte order (`byteCompare`), matching `app.canonical_json` /
  `app.build_snapshot_payload` (`collate "C"`) and Python `sorted()`; shared fixtures in
  `fixtures/synthetic/canonical` are hashed by all three tiers.
* SQL entry points (`supabase/migrations/0005_trust_boundaries.sql`): `freeze_snapshot`, `resolve_conflict`,
  `document_exception`, `confirm_fact`, `record_check_run`, `disposition_discrepancy`, `record_review`,
  `set_reconciliation_status`, `send_to_review`, `build_snapshot_payload`, `verify_audit_chain`. Everything
  else in schema `app` is internal; see `supabase/README.md`.

## Calculation service

* `app/schemas.py` strict Pydantic contracts; `app/financial/rules.py` versioned
  rule registry with checksums; `app/financial/rmd.py` eligibility and RMD;
  `app/financial/checks.py` discrepancy classification; `app/financial/receipt.py`
  deterministic receipts; `app/financial/tax2026.py` DRAFT P1 module;
  `app/jobs.py` queue interface (inline runner now; worker later).
* OpenAPI is exported to `packages/contracts/openapi/calculator.openapi.json`;
  `tests/test_api.py` fails on drift.
* Long-running work (rule-impact previews, bulk re-checks) is designed to run
  on a worker behind a queue, not in Vercel request handlers.
* Environment: `pyproject.toml` requires Python 3.12–3.13 and `uv.lock` pins every package;
  CI installs with `uv sync --locked`. `scripts/export_rule_sets_sql.py` and
  `scripts/export_canonical_sql_test.py` generate `supabase/migrations/0006_seed_rule_sets.sql` and
  `supabase/tests/006_canonical_json.test.sql`; tests fail on drift (`--check`).

## Production path and what still requires configuration

Shipped: SQL migrations, RLS, workflow functions, pgTAP tests, env template,
Supabase client dependencies.

Not implemented in this build:

1. A Supabase-backed store adapter implementing the same domain functions
   against Postgres (the demo store is a file). The domain layer is written
   against a `DataState` shape identical to the schema, so the adapter is a
   query-layer change, not a workflow rewrite.
2. Session resolution in `src/auth/actor.ts` (Supabase Auth → membership → role).
3. Object storage for uploaded documents (only hashes are kept in the demo).
4. Running `supabase test db` on the real local stack before deployment (the SQL tests execute on plain
   PostgreSQL via `supabase/tests/run_sql_tests.py`: 6 files, 117 assertions locally on 18.6 and in CI on 15).
5. The server-side document path (store bytes, hash, register `source_documents` with the service role);
   since PR-001 `authenticated` cannot register documents (planned as PR-003).
6. PR-002: S-06 coverage-aware approval, S-07 request derived solely from the frozen snapshot, N-02 transient
   ERROR runs no longer blocking approval permanently.

Until those are done, `/app/*` renders a gate page rather than pretending to
authenticate.

## Local development

```bash
# terminal 1: calculation service (Python 3.12 or 3.13; `pip install uv` once)
cd services/calculator
uv sync --locked --extra dev     # creates/updates .venv from uv.lock
uv run python scripts/dev.py     # demo mode on port 8010, any shell

# terminal 2: web
npm install
cp .env.example apps/web/.env.local   # PowerShell: Copy-Item .env.example apps\web\.env.local
npm run dev:web          # http://localhost:3000
```

Tests: `npm run test:calc`, `npm test`, `npm run typecheck`, `npm run lint`,
`npm run build`, `npm run test:e2e` (starts both servers).
