# CLAUDE.md — SageSpan V3 engineering record

Read this first. It records founder decisions, implementation status and the
conventions later sessions must keep. The founder documents `00_START_HERE.md`
through `10_CHANGELOG_V1_V2_V3.md` (and `SAGESPAN_MASTER_SOURCE_OF_TRUTH.md`)
are canonical for product, buyer, pricing and compliance language.

## V3 founder decisions (adopted; do not relitigate per turn)

1. **Brand:** SageSpan is a provisional working name pending trademark/domain
   clearance. All brand strings live in `apps/web/src/config/brand.ts`.
2. **Product:** B2B independent retirement plan assurance for U.S. RIAs. Not a
   planner, robo-advisor, trading tool or consumer app. The five-stage lifecycle
   is a long-term map, not P0 scope.
3. **Buyer:** RIA firms of ~5–50 advisors; CCO champion, owner/CEO/COO economic
   buyer, lead advisor adoption. Hypotheses to validate in interviews.
4. **Architecture:** Next.js App Router + strict TypeScript + Tailwind on Vercel;
   Supabase Postgres/Auth/RLS; a **separate Python/FastAPI calculation service
   from day one**; queue/workers later. No retirement math in React/Next; no
   long work in Vercel request handlers.
5. **Pricing hypothesis (illustrative, not offered):** `750 + 3.50 × max(0, H − 100)`
   USD/month; limited $500/month pilot up to 50 households; firm-wide access,
   no per-seat fee; no billing in the prototype.

Hard rules: synthetic data only; mathematical PASS ≠ professional approval;
"review evidence packet", never "SEC-certified"; no SOC 2 / ZDR / certification
claims; vendor names on imports are metadata, not integrations; never invent
numbers when the calculation service is unavailable.

## Implementation status (milestone 1 — vertical slice, 2026-11-05)

### Shipped

* **Monorepo** (npm workspaces): `apps/web`, `packages/contracts`, `services/calculator`, `supabase`, `fixtures/synthetic`, `docs`.
* **Calculation service** (`services/calculator`): `POST /v1/checks/rmd`, `GET /v1/rules`, `GET /health`; Decimal arithmetic; versioned rule sets with SHA-256 checksums (Uniform Lifetime Table 2022.1, applicable age 2023.1, required beginning date 2023.1, joint-table eligibility 2022.1, comparison tolerance 1.0; DRAFT 2026 ordinary-income tax, unexposed); typed `PASS | NOT_REQUIRED | UNSUPPORTED | INDETERMINATE` with reasons; separate obligation events for the deferred first-year RMD; discrepancy classification (8 classes); deterministic receipts; bearer token + server-set `X-SageSpan-Org-Id`; bodies with `org_id` rejected; OpenAPI exported to `packages/contracts/openapi/calculator.openapi.json` with a drift test.
* **Contracts** (`packages/contracts`): Zod mirrors of the service contract, import contract `sagespan.import.v1` (JSON + CSV columns), enums, fact field registry with materiality, workflow state machine, role permissions, pricing hypothesis, BigInt money helpers, canonical JSON/SHA-256 byte-compatible with Python.
* **Web console** (`/demo/app`, synthetic, simulated reviewer personas): review queue with filters/sort; household overview with four evidence states, fact receipts, ownership/beneficiaries, source hashes, fail-closed freeze gate with blockers and how-to-resolve; imports (upload → CSV column mapping → entity mapping → reconcile; unsupported files rejected with reasons); checks (run against the service, receipts for every number, obligation events, discrepancy classification, visible service errors); review (conflict resolution creating fact revisions, COMPLIANCE-only nonmaterial exceptions, dispositions, comments, review and approval with attestation and separation of duties); evidence (packet preview, JSON/HTML/CSV export, export log, audit-chain integrity); settings (roles, policy editing, rule-set versions from the service, unavailable enterprise settings, hash-chained audit trail, demo reset).
* **Marketing**: `/`, `/product`, `/security`, `/pricing` (calculator, illustrative), `/demo` (tour); pilot-interest form stored locally; `/app/*` production gate.
* **Supabase**: migrations `0001`–`0004` (types, tenant-scoped tables with composite FKs, forced RLS, SECURITY DEFINER workflow functions, immutability triggers, hash-chained `append_audit`) and pgTAP tests `001`–`004`.
* **Fixtures**: Patel (material balance conflict + nonmaterial label conflict, imported $24,000.00), Okafor (DOB conflict; younger-spouse → UNSUPPORTED), Reyes-Lindqvist (plan-only, missing evidence, 2025-09-30 balance), Bauer (second tenant, Northline).
* **Docs**: README, `.env.example`, `docs/ARCHITECTURE.md`, `docs/FINANCIAL_METHODOLOGY.md`, `docs/SECURITY_AND_LIMITS.md`, `docs/ROADMAP.md`, `docs/DECISIONS.md`, `supabase/README.md`, `fixtures/synthetic/README.md`.

### Test results at milestone 1 (see the log below for exact runs)

* Python `pytest`: 64 passed (engine golden cases, classification, receipts, rules, tax draft, jobs, API, OpenAPI drift).
* `packages/contracts` Vitest: 15 passed; `tsc` clean.
* `apps/web` Vitest: 24 passed (includes live-service integration when the service is running); `tsc` clean; ESLint 0 problems; `next build` succeeds.
* Playwright: 4 scenarios (public nav + pricing calculator, unsupported import rejection, Patel conflict → resolution → exception → freeze → RMD check → forged-approval 403 → disposition → review → approval → packet export, cross-tenant 404).
* SQL: all nine files parse with `pglast`; **pgTAP tests not executed** (Docker not running on the build machine).

### Not done / requires configuration

* Supabase store adapter and session resolution (`apps/web/src/auth/actor.ts`, `src/domain/store.ts`); `/app/*` shows a gate.
* Executing `supabase test db`; object storage for uploads; member management; PDF rendering; real export-format mapping (two formats is a 90-day gate).
* P1 tax module stays DRAFT until benchmarked.

## Repository collision (2026-11-05) — resolved: `services/calculator` kept

A second, independent implementation appeared in the working tree during the
milestone-1 build (files dated 18:47–19:14, created by a parallel process, not
by the session that wrote this file). The founder chose to keep
`services/calculator` and the schema-`app` migration series. The parallel files
were moved, not deleted, to the git-ignored folder
`.archive/parallel-implementation-2026-11-05/`, which can be removed once nothing
in it is needed. For the record, they were:

| Parallel file(s) | Overlaps with | Difference |
|---|---|---|
| `services/calc/` (`sagespan_calc`, port 8081, uv/ruff/mypy) | `services/calculator/` (this build, port 8010, wired to the web app) | Two calculation services; only `services/calculator` is called by `apps/web` and covered by the contract/e2e tests |
| `supabase/migrations/0001_schema.sql`, `0002_rls.sql` (public schema; roles owner/cco/reviewer/analyst/viewer) | `0001_types.sql` … `0004_workflow_functions.sql` (schema `app`; roles per `03_ARCHITECTURE_AND_DATA_SCHEMA.md`) | Two migration series in one directory; `supabase db reset` would apply all six in lexical order |
| `supabase/tests/test_rls.py` (throwaway Postgres 16 cluster via `initdb`) | `supabase/tests/*.test.sql` (pgTAP) | Written against the parallel schema |
| `Makefile` | `package.json` scripts | References `services/calc`, `e2e/smoke.mjs` (does not exist) |

`apps/web/AGENTS.md` is auto-generated by `next dev` (Next 16) and is safe to commit.

`supabase/migrations` again holds a single series (`0001_types` … `0004_workflow_functions`),
so `supabase db reset` / `supabase test db` can be run once Docker is available.

## Conventions for future sessions

* Retirement math only in `services/calculator`; the web tier renders receipts and verifies `request_hash`.
* Every mutation goes through `src/domain/*` with an `Actor` resolved on the server; never trust client `org_id`; tenant misses are "not found".
* Resolving anything after a freeze creates a new revision; never edit snapshots, check runs, reviews, packets or audit events.
* Keep `packages/contracts/src/enums.ts`, `workflow.ts` and `supabase/migrations/0001_types.sql` / `app.can_transition()` in sync.
* Regenerate the OpenAPI file with `python scripts/export_openapi.py` whenever the service contract changes; `tests/test_api.py` enforces it.
* Fixture hashes: run `python fixtures/synthetic/scripts/compute_hashes.py` after editing synthetic source files.
* Synthetic data only. No real client documents, PII or secrets in this repository or in Claude Code sessions.
* On this Windows setup the Bash tool truncates long commands; write files with the Write tool and keep shell commands short.

## Milestone log

### 2026-11-05 — Milestone 1: vertical slice

* Repository was empty (design reference images only); built greenfield in the approved stack.
* Engine golden case verified: `640000.00 / 25.5 = 25098.039215… → 25098.04`; Patel request hash `7e51cc1e…` and run hash `797be471…` recorded in `fixtures/synthetic/calc`.
* Finding fixed during build: an approval denied inside a rolled-back transaction lost its `APPROVAL_DENIED` audit event; denials are now written in a separate committed write (`attemptApproval`).
* Finding fixed during build: server components passed function props to a client form (RSC violation); success messages now travel in action results.
* Docker was not running, so Supabase migrations/tests are syntax-checked only (`pglast`).
* Final verification: pytest 64/64; contracts Vitest 15/15; web Vitest 24/24 (live-service integration included); `tsc` clean in both packages; ESLint 0 problems; `next build` clean (no warnings); Playwright 4/4.
* The founder committed the tree twice during the session ("First Commit", "Pt 2"); later fixes in this session are uncommitted modifications. A parallel implementation (see the collision notice) remains untracked.
