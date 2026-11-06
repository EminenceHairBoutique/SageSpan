# Decision record (V3 founder decisions and implementation choices)

Baseline: 2026-11-05. Founder decisions come from `01_FOUNDER_DECISIONS_AND_POSITIONING.md`
and `10_CHANGELOG_V1_V2_V3.md`; implementation choices were made during the
first vertical-slice build and are recorded here so they are not relitigated.

## Founder decisions (adopted, not up for re-decision per turn)

| # | Decision | Qualification |
|---|---|---|
| 1 | Brand: **SageSpan**, provisional | Trademark/domain clearance pending; brand strings centralised in `apps/web/src/config/brand.ts` |
| 2 | Product: B2B independent retirement plan assurance | **Superseded 2026-11-05:** SageSpan is B2C **and** B2B (V5). The assurance product is preserved as one of three pillars; see ADR-V5-001 below |
| 3 | Buyer: U.S. RIAs ~5–50 advisors; CCO champion, owner/CEO/COO economic buyer, lead advisor adoption | ICP and buyer roles are hypotheses to verify in interviews |
| 4 | Stack: Next.js App Router + strict TS + Tailwind; Supabase/Postgres/Auth/RLS; separate Python/FastAPI calculation service from day one; queue/workers later | No retirement math in React/Next; no heavy compute in Vercel handlers |
| 5 | Pricing hypothesis: $750/month incl. 100 active monitored households, $3.50 per additional, $500/month pilot up to 50 | Illustrative, not offered; no billing |

## Implementation decisions

| Decision | Rationale |
|---|---|
| Greenfield monorepo (`apps/web`, `services/calculator`, `packages/contracts`, `supabase`, `fixtures/synthetic`, `docs`) | Repository was empty apart from design references; no migration needed |
| npm workspaces, Next 16.4, React 19, Zod 4, Tailwind 4, Vitest 4, Playwright 1.65, Python 3.12–3.13 (pinned by `services/calculator/uv.lock`; 3.14 dropped in PR-001), FastAPI 0.162, Pydantic 2.14 | Current stable versions at build time; the lockfile makes the calculator environment reproducible |
| Demo mode uses a file-backed JSON store seeded from `fixtures/synthetic/seed.json`, with simulated reviewer personas and a conspicuous banner | No Supabase credentials; an honest local path beats a fake login |
| `/app/*` renders a "production mode not available" gate | Never pretend demo auth is production auth |
| Facts from planning exports are claims (`NEEDS_CONFIRMATION`); statements/profiles/forms are evidence (`FACT_CONFIRMED`) | Mirrors the methodology: a mismatch is not an error until normalised |
| Balances conflict only for the same as-of date; static facts conflict on any disagreement | Freshness is not disagreement |
| Analysts can reconcile, resolve toward primary evidence, freeze and run checks, but cannot manually confirm unevidenced facts or record assumptions; only COMPLIANCE documents nonmaterial exceptions; approval roles are firm policy (default COMPLIANCE) | Segregation per the product requirements |
| Separation of duties = approver is not the person who froze the snapshot or ran the check (policy-configurable) | Documented, testable definition |
| Approval denials are audited in a separate committed write | A denial raised inside a rolled-back transaction would otherwise lose its audit event |
| Receipts carry `coverage_status` (`SUPPORTED_VERIFIED` means internal golden coverage, not external attestation) | Coverage matrix from the financial rules document |
| Comparison tolerance is a published, bounded rule set ($1.00 / 0.1 % default; max $25.00 / 1 %) | Firms can tighten but not loosen beyond bounds |
| P1 tax module implemented as DRAFT with tests, not exposed | Requested but gated on benchmarking |
| Evidence packet formats: JSON, HTML (print-ready), facts CSV; no PDF | No reliable server-side PDF renderer bundled |
| Fonts via Google Fonts `<link>` with system fallbacks, not `next/font` | Build must not depend on network availability |
| (PR-001) Workflow-owned columns move only through SECURITY DEFINER functions that set the transaction-local sentinel `app.workflow_fn`; `authenticated` holds column-level UPDATE on `households` only | Column privileges stop direct writes; the sentinel trigger stops the owner and any future full-column grant; `src/domain/workflow.ts` is the TypeScript equivalent |
| (PR-001) Tables use `enable`, not `force`, row level security | The owner `postgres` runs the definer functions; FORCE would subject it to the policies inside them. `authenticated`/`anon` are never owners; `service_role` has `BYPASSRLS` as on Supabase. Re-check on the real stack |
| (PR-001) Schema `app` stays in `[api] schemas`; internal functions are not executable by `authenticated`; every entry point asserts membership/role on entry | PostgREST RPC is the intended call path; exposure must not widen what a caller can do |
| (PR-001) Every migration ends with `revoke execute on all functions in schema app …` plus explicit grants | New functions were observed with the built-in PUBLIC EXECUTE grant despite altered default privileges; test 005 asserts the inventory |
| (PR-001) `append_audit` is `service_role`-only with a derived `actor_type`, allow-listed `event_type`, per-organisation `seq` and chain heads under an advisory lock | Closes audit injection and chain forks; a fork cannot commit (`unique (org_id, previous_event_hash)`) |
| (PR-001) Receipts are verified before they count: request hash, engine name, snapshot ref, PUBLISHED rule sets with matching checksums (TypeScript and SQL); failures are ERROR runs with `RECEIPT_INTEGRITY_ERROR` and never advance the workflow; approval refuses unverified receipts | PASS must come from the trusted engine for this exact frozen snapshot, or it is not a PASS |
| (PR-001) One approval matrix (`approvalDecision`: capability COMPLIANCE/ADVISOR × firm policy) for UI, domain tier and SQL | The two tiers had disagreed (N-05) |
| (PR-001) Production is fail-closed: `NODE_ENV=production` without `SAGESPAN_DEMO_MODE=1` refuses the demo token/URL at start-up | A deployment can no longer run on demo credentials by accident |
| (PR-001) `source_documents` rows are registered by `service_role` only; the bytes → hash → row path is PR-003 | Self-declared document hashes were accepted before |

## Open founder/professional gates (unchanged)

Trademark search and domain; legal entity; RIA interviews and first source
formats; counsel-defined compliance scope; vendor/retention/security posture;
expert-validated rule library; contract, pricing and pilot approvals before any
live-client beta.


## V5 decisions (2026-11-05 founder decision; implemented in synthetic mode 2026-11-06)

| Decision | Rationale / record |
|---|---|
| One platform, two audiences: Personal/Household (B2C), Retirement Studio (both), Advisor & Assurance (B2B) | Founder decision; `docs/product/SAGESPAN_V5_MASTER_SOURCE_OF_TRUTH.md` |
| Separate PERSONAL / HOUSEHOLD / FIRM workspaces; firm workspace maps 1:1 to `organizations`; cross-boundary access only via revocable `ConsentGrant` | `docs/architecture/DUAL_WORKSPACE_ADR.md` |
| Personal engines live in the calculation service; the web tier never sums or divides money | ADR-V5-001 §5; `extra_monthly_payment` / `cash_accounts` inputs |
| Methodology sets (`/v1/methods`) are a registry separate from regulatory rule sets so migration 0006 stays unchanged | ADR-V5-001 §6 |
| Decision ranking is versioned code (`decision-policy.v1`): constraints first, explicit weights, ≤3 actions, tiers 3–4 disabled | `packages/contracts/src/decision-policy.ts` |
| AI is a server-owned orchestrator over an evidence resolver with allowlisted read-only tools and a validator; model output is never trusted for status, ids or amounts | `apps/web/src/ai/*`, `docs/ai/AI_EVAL_MATRIX.md` |
| No live AI vendor until G3 (consent, DPA); configuration alone yields the mock plus an explicit note | AI-E17 |
| Demo state v2 reseeds older files (synthetic only) | `apps/web/src/domain/store.ts` |
| Consumer pricing recorded only as unvalidated hypotheses ($8–15 personal, $15–30 household) | `CONSUMER_PRICING_HYPOTHESIS` |
