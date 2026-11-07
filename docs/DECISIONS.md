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

## PR-002 approval and coverage decisions (merged #9 on 2026-11-06; S-06 outcome confirmed by the founder 2026-11-06)

| Decision | Rationale / record |
|---|---|
| **A snapshot whose accounts are all UNSUPPORTED or INDETERMINATE may be approved by an authorised professional, but the approval is typed `REVIEWED_WITH_LIMITATIONS` and is never labelled a verified check. No hard `COVERAGE_INSUFFICIENT` refusal.** Founder confirmed on 2026-11-06 when asked whether to refuse instead ("keep as merged"). | Audit S-06 remediation asked for a typed outcome and coverage-derived packet scope, not a refusal. A professional acknowledging that accounts sit outside the engine's supported scope is a legitimate, auditable review act; a refusal would leave every household with one unsupported account unable to close a review at all. The outcome is derived server-side (`approvalReadiness`, `app.record_review`), carries `coverage_summary`, cannot be upgraded by UPDATE, and the packet title/scope list the accounts outside supported scope. Reversing this needs a new decision row, a migration (0009+) and updated SQL 007 E4 / web S-06 / Okafor e2e expectations. Record: #9, #11, `CLAUDE.md` §5b |
| (PR-002) Only the latest attempt per (account, check type) on a snapshot is evaluated for CHECK_COMPLETE and approval; earlier attempts stay as audited history (`latestCheckRuns`, `app.latest_check_runs`). ERROR → PASS recovers; PASS → ERROR refuses `CHECK_FAILED_LATEST` | A transient calculator outage must not force a new revision (N-02), and a stale success must never carry over a later failure |
| (PR-002) Calculator requests are built solely from the frozen `sagespan.snapshot.v2` payload; the firm policy at freeze is recorded with `policy_sha256` as the policy version and pinned by the three-tier fixture `case_policy_record.json` (Python reference, TypeScript, SQL 006/007) | S-07: a receipt's `request_hash` must be reproducible from the snapshot alone; live policy or label edits after freeze cannot move it |

## AI-CORE decisions (2026-11-06; synthetic mode; `feat/ai-core-001-runtime`, `feat/ai-core-002a-hosted-adapter`)

| Decision | Status | Rationale |
|---|---|---|
| AI runtime is a bounded two-turn tool loop with server-enforced budgets, per-call re-authorisation and digest-only traces (ADR-AI-001, `docs/architecture/AI_CORE_RUNTIME_ADR.md`) | Implemented (synthetic) | Model → tool → model is what the demos now run; the 28 AI-E cases are unchanged; `APPROVED`/`VERIFIED` remain impossible |
| Default demo provider is the deterministic two-turn mock | Implemented | `diffReports`-identical to the one-pass mock; exercises the loop offline |
| **First hosted vendor port targets the Anthropic Messages API** | **Engineering assumption awaiting founder confirmation** | Already the stack's AI vendor; vendor-neutral `LiveProviderPort` keeps a swap to one file. Confirming or changing this decides AI-CORE-002b. Does not authorise real data (G3) |
| Hosted adapter is disabled unless key + pinned model + `SAGESPAN_AI_HOSTED_SYNTHETIC_ACK` + `SAGESPAN_DEMO_MODE=1`; ceilings fail closed to an ERROR run | Implemented | A silent fallback to a different model or vendor changes data-handling terms; that is a privacy event, not a fallback |
| No default model id is baked into code | Implemented | Model ids change; the operator pins the exact id and the run records what actually served |
| Fine-tuning, private serving and any live benchmark claim are deferred to AI-CORE-004/005/006 gates | Open | `docs/ai/AI_EVALUATION_PLAN.md` FT-0…FT-5 govern |

## Baseline reconciliation decisions (2026-11-06 evening; `master` after #10 → #13 → #16)

| Decision | Status | Rationale |
|---|---|---|
| Merge order #10 (PR-003/DATA-001/DATA-002) → #13 (AI-CORE-001) → #16 (AI-CORE-002a), each with a **merge commit** after a green CI run on the updated head | Done | Matches both track sessions' recommendation; preserves per-PR history; squashing would hide the real-stack evidence attached to the data commits |
| `RecordForms.tsx` conflict: keep the UI-001a `ConfirmDialog` and route it through the injectable `retire` action | Done | The dialog is a design decision (D-series) and the injection is a data decision (same form for demo and production); both survive, and `/app/personal` gains the confirmation |
| `ABSTAINED` renders as a neutral chip ("Model abstained — no draft"), never conflict or verified tone | Done | Abstention asserts nothing; styling it as failure would push users toward a draft, styling it as success would imply a finding |
| The hosted adapter (#16) is merged **disabled by default**; merging does not pick a vendor, pin a model or authorise any live run | Done | Code presence ≠ enablement; the five gates and `docs/DECISIONS.md` AI-CORE rows still govern. Vendor and model id remain founder decisions (AI-CORE-002b) |
| Founder Session-3 package installed at the destinations its README names; package `docs/CLAUDE.md` kept only in `docs/history`; `.ai-core-staging/` git-ignored | Done | A subdirectory `CLAUDE.md` is auto-loaded by Claude Code and would re-introduce stale status; the staging folder is a transfer mechanism, not source |
| Root `CLAUDE.md` carries one dated "Current state" paragraph and the status vocabulary; per-branch notes move to session reports | Done | Eight stacked notes contradicted each other after merging; one paragraph is what the next session needs |
| **Working mode: one Claude Project as knowledge base; one integration coordinator session owning `master`; at most two concurrent feature sessions (AI · UI/UX · Data/security · Financial modelling) in separate worktrees with file ownership by track; central migration-number registry; every session starts from Git/PR/CI state with a `SESSION_CONTRACT.md` and ends with a PR, evidence, file inventory and handoff report** (`docs/project/SESSION_OPERATING_MODEL.md`) | **Founder decision, 2026-11-06 evening** — supersedes the coordinator's earlier single-session recommendation | Keeps parallel development; moves collision cost to one place. Today's reconciliation produced two semantic conflicts and four shared-doc collisions that this model prevents by ownership and append-only shared files |
| AI-SEC-001: the report narrative (summary, memo, questions, model limitations) is grounded by the same amount and pass-claim rules as findings; a failing field is withheld (`REDACT_TEXT`), never rendered; the report is not rejected wholesale | Implemented (#18) | Independent audit P0 confirmed by source inspection; field-level redaction keeps the validated findings for the reviewer and preserves the AI-E15 contract (invented amount → finding rejected, report survives) |
| Founder-supplied independent audit bundle (2026-11-06) preserved verbatim under `docs/audits/2026-11-06-independent-audit/` with a reconciliation note; each code finding re-verified and tracked in `IMPLEMENTATION_STATUS.md` | Done | Audits are dated evidence; verification status belongs with the live status file, not inside the audit text |
| Duplicates re-introduced by #20/#21 (`docs/CLAUDE.md`, root `README_START_HERE.md`, `.ai-core-staging/AI_EVALUATION_PLAN.md`, `docs/ai/…MASTER_PROMPT_UPDATED.md`) removed; each is already preserved (`docs/history/CLAUDE_V5.3_SESSION3_DRAFT_2026-11-06.md`, `docs/history/SESSION3_PACKAGE_README_START_HERE_2026-11-06.md`, `docs/ai/AI_EVALUATION_PLAN.md` byte-identical, `docs/ai/SAGESPAN_AI_CORE_FABLE_5_1_MASTER_PROMPT.md` = edition 1.1 plus a reconciliation note) (2026-11-06, founder-approved) | Done | Restores the earlier decision above and traceability row "no stray staging artefact or subdirectory `CLAUDE.md`"; a `docs/CLAUDE.md` is auto-loaded by Claude Code and its status predates sessions 4–7 |
| **Hosted model for synthetic development: Anthropic Messages API, model `claude-sonnet-5-5`, pinned via `SAGESPAN_AI_HOSTED_MODEL`** (2026-11-06, founder; first live benchmark passed on the founder's machine after #22) | Decided — synthetic data only | Covers local benchmarks and evaluations on synthetic fixtures with a capped, short-lived dev key held only in the founder's shell. It is **not** a production or real-data vendor decision: that needs G3 (vendor review, DPA, retention terms, consent) and a new row. The model stays swappable behind the provider port; any model change replays AI-E/AI-C/AI-H/AI-N and a `diffReports` review before use |

## AI-CORE-002b decisions (2026-11-06 evening; founder answered in the AI session; synthetic mode)

| Decision | Status | Rationale |
|---|---|---|
| **First hosted vendor: Anthropic Messages API; model `claude-sonnet-5-5`** — confirmed to the AI session on 2026-11-06 (same decision as the row recorded by #23 above; the first live benchmark on the founder's machine after #22 passed, so the id is verified by a served run) | Founder decision — synthetic data only | Already the stack's AI vendor; `LiveProviderPort` keeps the adapter swappable. Real data remains gate G3 (vendor DPA, retention, incident runbook). No default id is baked into code; every run records the model the vendor actually served |
| `reauthorize()` is async-capable; production personal grounding goes through `PersonalRepository.bundle()` (Data seam), never a direct table read from `ai/**` | Implemented (AI-CORE-002b) | The database decides what exists under RLS; the AI layer re-asks before every tool execution and before RECORD |
| AI runs for PRODUCTION workspaces are **not persisted** until the AI track's migration exists; `runPersonalUnderstandForRepository()` returns `persisted:false` with a note instead of pushing into a view that would drop the record | Implemented (AI-CORE-002b) | Silent drops are worse than honest non-persistence; the migration number comes from `supabase/migrations/REGISTRY.md` |
| Per-workspace quotas are `ai-quota-v1` policy + `AiQuotaStore` interface; the shipped store is per-process and says so; a store failure fails the run closed | Implemented (AI-CORE-002b) | Quotas follow the data scope (workspace / household), not the person; durability is a store property and needs the same migration |
