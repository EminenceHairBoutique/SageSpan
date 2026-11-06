# Security design and limits

This is a description of the design and of what this synthetic build
implements. It is not a certification, an audit, or legal advice.

## Threat model (prototype scope)

| Threat | Control in this build |
|---|---|
| Tenant A reads or changes tenant B data | Server-side tenant scoping on every read/mutation (tested); SQL composite FKs and forced RLS on every table (written, not yet executed) |
| Client forges `org_id` or role | Actor resolved from the server session only; calculation service reads tenant from a server-set header and rejects `org_id` in bodies (tested) |
| UI-only approval | Approval is a domain function requiring approver role, rationale, attestation, no open discrepancies, and separation of duties; denials are audited (tested); SQL `record_review` repeats the checks and records `auth.uid()` as reviewer |
| Silent edits to frozen evidence | Snapshots are immutable; later changes create a new revision (tested); SQL triggers refuse snapshot/review/check-run/audit mutation |
| Tampered audit history | Per-organisation SHA-256 hash chain with a verifier shown in the console (tested) |
| Malicious import files | Only the documented CSV/JSON contract; size/row/column limits; strict RFC 4180 parser; Zod validation; unsupported files rejected before any state is written (tested) |
| Spreadsheet formula injection in exports | Cells beginning with `= + - @` or tab/CR are neutralised (tested) |
| PII or financial values in logs | Audit events store digests and identifier-level summaries; validation errors return field paths, not values |
| Browser framing / sniffing | `X-Frame-Options: DENY`, `nosniff`, strict referrer policy, no `X-Powered-By` |
| Secrets in the browser | Service token and any service-role key are server-only; `NEXT_PUBLIC_*` is limited to the Supabase URL/anon key and brand strings |

## What is deliberately not claimed

* No SOC 2, ISO 27001, SEC, FINRA or "exam-proof" status.
* No zero-data-retention or no-training guarantees for any AI vendor. The
  prototype was developed with Claude Fable 5.1, whose documented terms require
  30-day retention; only synthetic data was used.
* No encryption-at-rest, backup, retention or incident-response guarantees
  beyond what a signed agreement would state.
* No vendor integrations: vendor labels on imports are metadata.

## Verification status of security tests (as of this build)

| Test | Status |
|---|---|
| Web domain: cross-tenant reads/mutations return not-found | Passing (vitest) |
| Web domain: forged approval by VIEWER/ANALYST/ADMIN rejected | Passing (vitest) |
| Web domain: separation of duties denial audited | Passing (vitest) |
| Web domain: snapshot immutability, new revision | Passing (vitest) |
| Web domain: service unavailable → visible error, no local math | Passing (vitest) |
| Calculation service: token required, tenant header required, body `org_id` rejected | Passing (pytest) |
| Browser: forged API approval as viewer → 403; Northline cannot open Patel; full Patel flow against the real engine | Passing (Playwright, 4 scenarios, 2026-11-05) |
| SQL: RLS tenant isolation, role/workflow, immutability, constraints | **Written, not executed** (Docker/Supabase stack unavailable on the build machine). Parsed with `pglast` for syntax only. |

Never mark the SQL tests as passed until `supabase test db` has run.

## Release gates (from the founder documents)

1. Prototype (this build): synthetic data only, no production secrets, unit and
   integration tests, this threat-model note.
2. Design-partner sandbox: firm-approved synthetic/anonymised data, signed
   permission, security review, documented use limitations.
3. Real-client pilot: counsel perimeter memo, DPA, security risk assessment,
   validated calculations, incident-response and access-control tests, review
   protocol, approved sub-processors, executed RLS tests, object storage with
   malware scanning.
4. Public release: independent model validation, legal terms, security posture,
   regulated communications review, billing controls, operational runbook.

## Known limitations of the prototype

* The demo store is a JSON file; it is not concurrent-safe and is reset by
  design. It exists to exercise the workflow, not to hold real records.
* Uploaded file bytes are hashed but not stored.
* Demo reviewers are simulated; `actor_type = SIMULATED_REVIEWER` is recorded
  on every review and packet.
* PDF rendering is not bundled; the HTML packet is print-ready.
* The P1 tax module is a DRAFT and is not exposed.
