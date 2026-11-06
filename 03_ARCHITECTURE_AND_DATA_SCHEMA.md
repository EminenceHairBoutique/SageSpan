# V3 Engineering Architecture, Data Model, Security and API

## Stack decision
For a new repository: Next.js App Router, React, strict TypeScript, Tailwind, accessible component library, Vitest, Playwright, PostgreSQL/Supabase Auth with RLS, Vercel frontend deployment. Why: easy server-rendered public marketing pages and typed full-stack app, minimal deployment complexity. For an existing Vite/React/Supabase project: preserve it unless measured constraints justify migration. Never claim a migration is required for quantitative quality. Keep heavy simulations and document OCR off synchronous Vercel handlers. Under the founder decision, build a separately runnable **Python/FastAPI calculation and verification service from day one**, starting with the scoped RMD rule and Python tests. Add a queue and distributed workers for heavier tasks when needed. Do not duplicate authoritative financial math in React or Next.js.

## Bounded system
```text
Browser (Public / Firm Console / Restricted Demo)
  -> authenticated server endpoints with tenant-scoped authz
  -> Supabase Postgres with RLS, append-only event tables and object storage
  -> Import adapters: manual + explicit CSV/JSON schema (P0); vendor connectors later
  -> Fact resolver / typed verification / conflict detector
  -> Snapshot service (immutable content-hashed snapshot, fail-closed)
  -> Python/FastAPI independent financial checks (versioned deterministic functions; no LLM math)
  -> Run receipt + discrepancy report + human review state machine
  -> synthetic evidence packet export
Python/FastAPI is an approved initial service; future: async tax and simulation workers; approved OCR; monitored rule-publishing workflow; MCP read-only tools.
```

## Core relational schema (minimum viable)
`organizations(id,name,created_at)`
`profiles(user_id,display_name)`
`memberships(id,org_id,user_id,role,status)` roles ADMIN, COMPLIANCE, ADVISOR, ANALYST, VIEWER. Ownership/role resolution must take server session, never client-input-only org_id.
`households(id,org_id,label,status,created_at)`
`persons(id,org_id,household_id,display_name,birth_date_nullable,...)`
`accounts(id,org_id,household_id,account_type,tax_character,currency,opened_at_nullable)`
`account_ownership(id,org_id,account_id,person_id,ownership_type,percentage,effective_from,effective_to)`; constraint ownership percentages reconcile for supported categories and time slices; don't assume joint ownership implies equal economic percentages in all jurisdictions.
`beneficiary_designations(id,org_id,account_id,beneficiary_person_id_nullable,beneficiary_label_nullable,share_percentage,designation_type,effective_from,effective_to,source_fact_id_nullable)`; separate contingent and primary designations. Avoid assuming this data is dispositive of legal title.
`source_documents(id,org_id,household_id,source_kind,source_vendor_nullable,filename,sha256,storage_path_nullable,uploaded_at,source_as_of,parser_version)`
`source_locations(id,org_id,document_id,page_number_nullable,row_number_nullable,text_span_nullable)`
`facts(id,org_id,household_id,subject_type,subject_id,field_key,value_kind,value_number_nullable,value_text_nullable,value_date_nullable,value_bool_nullable,value_currency_nullable,unit_nullable,as_of_date,effective_from_nullable,effective_to_nullable,source_document_id_nullable,source_location_id_nullable,verification_status,created_at)`; enforce exactly one active typed value based on value_kind, numeric ranges, currency, and appropriate foreign keys. Avoid unconstrained JSON as the authoritative typed fact model.
`fact_conflicts(id,org_id,household_id,fact_group_key,materiality,status,reason,resolution_note_nullable,resolved_by_nullable,resolved_at_nullable)`
`conflict_fact_links(org_id,conflict_id,fact_id)`
`rule_sets(id,code,jurisdiction,tax_year,effective_from,effective_to,version,source_url,source_retrieved_at,checksum,status)`; never allow an unapproved draft rule into a released verification run.
`rule_parameters(id,rule_set_id,parameter_key,value_decimal_nullable,value_string_nullable,value_date_nullable,unit,source_locator)`
`assumption_sets(id,org_id,household_id,version,created_by,created_at,methodology_id_nullable)`
`assumptions(id,org_id,assumption_set_id,key,value_kind,value_decimal_nullable,value_text_nullable,unit,source_fact_id_nullable)`
`plan_imports(id,org_id,household_id,source_document_id_nullable,source_vendor,format_version,imported_at,parser_version,import_status)`
`imported_plan_values(id,org_id,import_id,metric_key,period_start_nullable,period_end_nullable,value_decimal,currency,methodology_label_nullable,source_location_id_nullable)`
`snapshots(id,org_id,household_id,revision,content_sha256,rule_set_id,assumption_set_id,created_by,created_at,status,canonical_payload_reference)`
`check_runs(id,org_id,snapshot_id,engine_version,rule_set_version,check_type,inputs_sha256,outputs_sha256,executed_at,run_status,unsupported_reasons_json,calculation_result_json)`
`discrepancies(id,org_id,check_run_id,imported_plan_value_id_nullable,category,severity,comparison_status,materiality_basis,delta_amount_nullable,description,status)`
`reviews(id,org_id,snapshot_id,reviewer_user_id,decision,rationale,conflict_attestation,reviewed_at)`
`evidence_packets(id,org_id,snapshot_id,review_id,generated_by,generated_at,sha256,packet_status,storage_path)`
`audit_events(id,org_id,actor_user_id_nullable,actor_type,event_type,entity_type,entity_id,created_at,previous_event_hash_nullable,event_hash,payload_digest,request_id)`

## RLS and authorization invariants
- All tenant-bound tables include `org_id`, with foreign keys and triggers/constraints preventing cross-org references; never rely only on client query filtering.
- RLS policies must gate reads/writes through authenticated `membership` and allowed action, with separate service-account maintenance paths. Client-provided organization IDs are checked against authenticated memberships.
- Tests: unauthorized/anon denied; Org A cannot read/update/export Org B; analyst cannot approve; viewer cannot edit; org admin cannot forge another user's review; forged account ownership reference rejected.
- `audit_events`, approved snapshots, completed check runs and approved packets are insert-only for ordinary application roles. DB privilege/triggers enforce immutability; separate retention/legal hold and approved redaction policy.
- No raw financial facts, source excerpts, authentication tokens or large client document content in ordinary application logs. Use event metadata/digests.

## Snapshot consistency
Canonicalize inputs in deterministic order and type serialization. Hash each source and canonical snapshot using SHA-256. Snapshot references rule_set version, assumptions, document hashes, ownership graph and evaluated value rows; record engine code commit hash. All evaluations are reproducible from an archive of *permitted* rule/config data. No prior output silently changes on later rule updates. A rule change creates a new impact analysis or run, not a rewrite of past results.

## Conflict and comparison semantics
- Source mismatch: multiple claimed account balances for same account and as-of time.
- Freshness: plan asset balance as-of date differs from statement as-of date; do not assume values must match across different dates.
- Rule: supported RMD law or tax rule mismatch for specified period.
- Methodology: different forward return assumptions, inflation, tax characterization, timing of cash flows; mark `NOT_COMPARABLE` until harmonized.
- Insufficient evidence: missing beneficiary age, account type or prior-year balance => `INDETERMINATE` (not failure).
- Scoping: vendor outputs may be summarized, rounded, unavailable or legally non-exportable; never claim universal certification of imported plans.
- Threshold: define user-facing absolute and relative comparison tolerances by check type, with review/validation; don't equate tolerance to legal exemption.

## API endpoints (illustrative)
`POST /api/imports` — upload permitted sample CSV/JSON + schema validation; return import record and mapping issues.
`GET /api/households/:id/facts` — fact provenance and conflict status.
`POST /api/households/:id/facts/confirm` — authorized fact confirmation; audit event.
`POST /api/households/:id/snapshots` — freeze only if material conflicts resolved and required facts complete; immutable.
`POST /api/snapshots/:id/checks/rmd` — validated deterministic check from frozen snapshot; idempotency key.
`GET /api/snapshots/:id/receipts/:runId` — source/rule/engine links and comparison status.
`POST /api/snapshots/:id/review` — authorized review status change; reason and conflict handling.
`POST /api/snapshots/:id/evidence-packet` — generate/download only according to policy and authorized identity.
`GET /api/organizations/:id/impact-preview?rule_set=...` — future authorized preview, no unsupported live feed in MVP.

Return typed `status` values and `unsupported_reasons[]` rather than guessed results. Use explicit error codes, request IDs, and sanitized logs.

## Fable coding conventions
Create `/apps/web/src/domain`, `/apps/web/src/import`, `/apps/web/src/provenance`, `/apps/web/src/auth`, `/apps/web/src/ui`, plus `/services/calculator/app` for authoritative Python financial rules and `/packages/contracts` for shared types; do not mix quantitative logic into React components. Keep a living `CLAUDE.md`, `docs/FINANCIAL_METHODOLOGY.md`, `.env.example`, migrations and tests. Use synthetic fixtures and no production-data ingestion in public demo.


## Founder-approved numerical service boundary (V3)
- Python/FastAPI is the **authoritative** calculation and rules-verification service for new development; Next.js renders results and performs firm workflow operations, not retirement math.
- Build `POST /v1/checks/rmd` accepting a server-authorized frozen-snapshot reference (or tightly controlled synthetic input in a test harness), returning typed verdict, calculation receipt, rule citations, engine/rules versions and unsupported reasons.
- Never trust a caller-provided org_id as authorization. Use a service-authenticated principal plus tenant-scoped lookup.
- Use Python `Decimal`, explicit cents rounding, `pytest`, independent golden fixtures and OpenAPI/consumer-contract tests.
- For development, run Next.js and FastAPI as two local processes or with Docker Compose; no need for cloud accounts or paid services. If service is down, show an honest error; do not silently invent calculation output.
- Queue/workers are planned for high-volume rule-change monitoring and future simulation workloads, not necessary to run the initial RMD check.
