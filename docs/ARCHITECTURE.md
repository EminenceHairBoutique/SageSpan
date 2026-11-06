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
4. Running `supabase test db` (needs Docker) to execute the RLS tests.

Until those are done, `/app/*` renders a gate page rather than pretending to
authenticate.

## Local development

```bash
# terminal 1: calculation service
cd services/calculator && python -m venv .venv && .venv\Scripts\activate && pip install -r requirements.txt
set CALC_DEMO_MODE=1 && uvicorn app.main:app --port 8010 --reload

# terminal 2: web
npm install
copy .env.example apps\web\.env.local
npm run dev:web          # http://localhost:3000
```

Tests: `npm run test:calc`, `npm test`, `npm run typecheck`, `npm run lint`,
`npm run build`, `npm run test:e2e` (starts both servers).
