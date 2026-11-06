# Roadmap

Priorities follow the V3 founder documents. Everything below P0 is a hypothesis
to validate with firms, not a commitment.

## P0 (this milestone) — shipped in the vertical slice

* Explicit synthetic CSV/JSON import contract with column and entity mapping
* Typed facts, ownership, beneficiaries, four evidence states, conflict detection
* Fail-closed freeze gate, immutable hashed snapshots, new-revision semantics
* Separate Python/FastAPI RMD engine with versioned rules and receipts
* Discrepancy classification including NOT_COMPARABLE, MISSING_EVIDENCE, UNSUPPORTED_CHECK
* Review queue, dispositions, approval with attestation and separation of duties
* Review evidence packet (JSON/HTML/CSV) with limitations and audit trail
* Supabase schema, RLS, workflow functions and pgTAP tests (written; execution pending)

## P0 completion items (before any design-partner sandbox)

1. Run `supabase test db` and fix anything it finds; wire the Supabase store
   adapter and session resolution; retire the file store for `/app/*`.
2. Object storage for source documents with malware scanning and hashed paths.
3. Member invitation and role management with audited changes.
4. PDF rendering for packets if a reliable server-side renderer is adopted.
5. Map at least two real (permitted, privacy-safe) planning-export formats
   onto the import contract; publish a vendor feasibility matrix.

## P1

* Narrow 2026 federal ordinary-income base tax: publish only after independent
  benchmarking (PolicyEngine-US / Tax-Calculator) and table re-verification;
  keep `not_supported[]` visible in every result.
* Rule-publication workflow: draft → reviewed → approved → published, with
  source URI, checksum, approver identity, and effective dating.
* Book-wide impact preview: when a rule set changes, list possibly affected
  households (fixture-based event first, no live regulatory feed).
* Beneficiary evidence flags (missing designation, stale designation, trust
  beneficiary) as review findings.
* Queue/worker for long-running jobs (interface exists in `app/jobs.py`).
* Deferred first-year RMD valuation from stored prior-prior balances in the
  import contract.

## P2

* Vetted commercial connectors only where contracts and permissions exist.
* Read-only MCP endpoints if a firm's workflow justifies them (not a
  differentiator on its own).
* Additional independently validated checks (joint-life table, employer plans,
  inherited-account rules) one at a time with golden tests.
* Limited client-readable view of approved material.

## Deferred (not planned for the assurance wedge)

B2C planner, full plan creation, autonomous advice or execution, 43-state tax,
Monte Carlo and longevity prediction.

## Commercial validation gates (hypotheses)

15–25 buyer interviews across ≥5 firms; 5 structured pilot candidates; ≥2
written paid pilot commitments by day 90 if legally and security ready; two
real export formats mapped; zero cross-tenant leaks in tests; 100 % RMD golden
coverage; measured false-positive and review-time rates.
