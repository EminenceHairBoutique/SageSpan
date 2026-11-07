# SageSpan V5 — Requirements Traceability and Non-Regression Matrix

**Status:** Documentation-level reconciliation, November 5, 2026. This matrix records where prior requirements are preserved in V5. It does **not** prove that the code implements them or that corresponding tests passed. The historical v2 audit used `master` / `1151c1e`; current code must be re-examined before assigning status.

**Artifact keys:** **V5-B** = `SageSpan_V5_Unified_Master_Blueprint.md`; **V5-C** = `SageSpan_V5_Claude_Code_Master_Engineering_Prompt.md`. **V4-B/V4-C** = preceding dual-market documents; **AI** = `SageSpan_AI_Planning_Blueprint_and_Claude_Prompt.md`; **P3** = `SageSpan_PR-001_Reviewed_Prompt_v3.md`; **A2** = `REPOSITORY_AUDIT_2026-11-05_v2.md`; **V3** = previous SageSpan context pack.

**Controlling principle:** V5 changes the target customers to B2C + B2B. It does not cancel B2B evidence/assurance design or any P0 security finding. Financial and AI features absent from the repository remain **requirements, not delivered features**.

## A. Founder direction and product design

| Requirement | Origin | V5 blueprint | V5 Code directive / owner | Completion evidence |
|---|---|---|---|---|
| Dual B2C + B2B, no deletion of either path | Founder, V4-B/C | §§1–2, 16 | DUAL-000/001 | Both routes and synthetic flows tested |
| Three pillars: Personal, Retirement, Professional Assurance | V4-B | §§1–6 | DUAL-000/001 | Feature status matrix and navigation |
| Five-stage Discover → Diagnose → Develop/Design → Review/Decide → Monitor | AI, V3, V4-B | §8 | Product lifecycle and AI annex | Stage-specific flows and states |
| Consumer manual-entry-first and calm next-three-actions UX | Founder, V4-B/C | §§3, 7, 20 | PERS-001/002 | Scenario usability and accessible mobile tests |
| Recurring/cash-flow patterns with missingness and freshness | V4-B/C | §§3, 5, 20 | PERS-001/002 | Duplicate/seasonal/irregular income evaluation |
| Debts, budget, savings, buffer constraints | V4-B/C | §§3–5, 19–20 | PERS-002 | Feasible options, minimum payments tests |
| Investment education now, personalized recommendations gated | Founder, V4-B | §§3.5, 20.2, 21.2 | REG-001 | Counsel release determination |
| Shared planning, separate workspaces and permissions | V4-B/C | §§2, 9, 21.1 | DUAL ADR / PR-003 | Grants, expiry and isolation tests |
| Professional CCO queue / evidence packet / bounded review | V3, A2, V4-B | §§6, 17, 22 | ASSURANCE-001 | Review flow and validated export manifest |
| Pricing, GTM as hypotheses, not promised revenue | V3, V4-B | §§12–14, 22 | Interview/price experiment | Recorded interviews, buyer evidence |
| Provisional brand/trademark review | V3 | §§14, 16 | Founder/counsel | Clearance record |

## B. Security, authorization, audit and provenance

| Requirement / finding | Origin | V5 blueprint | V5 Code directive / owner | Completion evidence |
|---|---|---|---|---|
| S-01 cross-tenant workflow and direct UPDATE restrictions | A2, P3 | §§17.1–17.2 | PR-001 Annex A | Denied foreign/viewer/analyst actions and valid paths |
| S-02 fake audit event/actor rejection | A2, P3 | §§17.1–17.2 | PR-001 Annex A | Foreign `SYSTEM` event denied |
| S-03 frozen snapshot integrity, required facts, cross-tier canonical JSON | A2, P3 | §§17.1–17.2 | PR-001 Annex A | Wrong hash/foreign/superseded/missing fact denied; parity fixtures |
| S-04 mismatched receipts fail closed | A2, P3 | §§17.1–17.2 | PR-001 Annex A | Tainted run ERROR, never approved |
| S-05a/b fact confirmation/supersession through trusted revision | A2, P3 | §17.2 | PR-001 Annex A | Update denied, explicit authorized revision passes |
| S-05c completed check run authentic, not client fabricated | A2, P3 | §§17.1–17.4 | PR-001/003 | Authenticated backend-only persisted run |
| S-05d source-less confirmed fact continues denied | A2, P3 | §17.2 | PR-001 Annex A | Existing negative probe stays denied |
| S-05e document hash derives from stored bytes | A2, P3 | §§17.2, 17.4 | PR-001 gate / PR-003 wiring | No client registration; digest object test |
| N-01 immutable post-approval amounts/dispositions | A2, P3 | §17.2 | PR-001 Annex A | Mutation denied; new revision supported |
| N-03 chain sequence and concurrency, historic fork treatment | A2, P3 | §§17.2, 17.5 | PR-001 Annex A | One head, 20 same-tx and concurrent appends |
| N-04 PUBLIC EXECUTE inventory/definer search_path/RLS helpers | A2, P3 | §§17.2, 17.5 | PR-001 Annex A | Explicit grants and real RPC/positive RLS tests |
| N-05 COMPLIANCE-only final approval default and SoD | A2, P3 | §17.2 | PR-001 Annex A | TS/SQL/settings policy agree |
| S-06 supported vs limited outcome/published packet scope | A2, P3 | §17.3 | PR-002 — **implemented** (`feat/pr-002-coverage`) | Unsupported-only never verified — SQL 007 E4, web `pr-002-coverage`, e2e Okafor |
| S-07 frozen snapshot-only calculation inputs and policy version | A2, P3 | §17.3 | PR-002 — **implemented** (payload v2, migration 0007) | Live settings mutation leaves hash constant — SQL 007 E1, web `pr-002-coverage` S-07 |
| N-02 latest scoped attempt, ERROR→PASS/PASS→ERROR | A2, P3 | §17.3 | PR-002 — **implemented** (`app.latest_check_runs`, `latestCheckRuns`) | Recovery/no stale success — SQL 007 E2/E3, web `pr-002-coverage` N-02 |
| S-08 unsafe demo leads/state local file use | A2 | §§16.2, 17.2 | PR-003 / operations | Production store not a demo file |
| S-09 env/dependency/config hardening | A2, P3 | §§17.2, 17.5 | PR-001/OPS | Fail-closed prod, locked dependencies |
| S-10 independent packet artifact manifest and hashes | A2 | §17.4 | PR-003/ASSURANCE-001 | Independent verifier and per-file digest |
| No custom GUC as sole security barrier | P3 | §17.2 | PR-001 Annex A | Threat tests show server-authoritative privilege |
| No `current_user` as caller identity in definer | P3 | §17.2 | PR-001 Annex A | Actor derived from trusted session path |
| RLS helpers remain functional after revoke | P3 | §17.2 | PR-001 Annex A | Valid tenant SELECT/write tests |
| Rollback-aware durable failure telemetry | P3 | §17.2 | PR-001 Annex A | Rejected transaction and separate event test |
| Trusted calculator invocation vs matching hash only | P3 | §§17.1, 17.4 | PR-001/003 | Forged matching-hash JSON cannot persist as verified |
| OpenAPI strict version lock/drift test | A2, P3 | §17.2 | PR-001 Annex A | Locked CI and identical schema |
| Real Supabase/JWT/PostgREST RLS, not only shims | P3, A2 | §§17.4–17.5 | PR-003 | Authenticated 2-tenant and sharing tests |
| Personal/household/firm consent, expiry/revoke, privacy | Founder, V4-B | §§9, 17.4, 21.1 | PR-003/DATA | Scope+revocation and least-privilege tests |

## C. AI planning, assistant, evidence and governance

| Requirement | Origin | V5 blueprint | V5 Code directive / owner | Completion evidence |
|---|---|---|---|---|
| Separate Planning and Assurance Intelligence | AI | §§1, 6, 18 | AI-000 onward | Both user journeys |
| Server-owned AiReviewOrchestrator and allowlisted tools | AI | §§18.1–18.2 | AI-000/001 Annex B | Typed dispatcher, no mutation tools |
| `read_facts`, `read_evidence`, `get_check_runs` | AI | §18.1 | AI-000/001 Annex B | Auth and retrieval tests |
| `propose_scenario`, `run_supported_projection` only with validated engine | AI | §§18.1, 19 | AI-003 | No invented scenario result |
| Zod schema `AiReviewReport`, source links and draft statuses | AI | §18.2 | AI-000 Annex B | Invalid schema/status rejected |
| Server validates org/workspace/source/calc references | AI | §§18.2–18.3 | AI-001 | 100% accepted citations valid |
| Prompt injection/untrusted PDF/CSV/source text | AI, V3 | §§18.3–18.4 | AI-000/001 | Injection and exfiltration tests |
| Second-order injection through tool results; tenant ids smuggled through tool args; revoked consent mid-run; snapshot drift between turns; tool/turn budgets enforced before dispatch | AI-CORE | `docs/ai/AI_CORE_THREAT_MODEL.md` T2, T4, T6, T7, T12 | AI-CORE-001 | AI-C03–C08, C11, C12 |
| AI cannot approve, verify fact, move money or alter policies | AI, founder | §§18.1–18.3, 20.2 | AI-001 onward | No mutation/approval path exposed |
| Human reviewer Accept/Edit/Dismiss/Request Evidence with version history | AI | §§18.2, 18.4 | AI-001 | Feedback separate from model record |
| Offline deterministic mock provider | AI | §§18.1, 18.4 | AI-000 | Runs without provider/network |
| At least 20 labeled synthetic cases, V5 raises to 28 | AI | §18.4 | AI-000/001 | E01–E28 labeled regression results |
| Model version/prompt/eval/replay, per-firm switch, rollback | AI | §§18.3, 21.3 | AI governance | Regression and off-switch tests |
| AI-002 source extraction benchmark and reviewer confirmation | AI | §18.5 | AI-002 | Exact-match + no truth promotion |
| AI-003 scenario orchestration and source-backed amounts | AI | §§18.5, 19 | AI-003 | Tool citations and deterministic rerun |
| AI-004 draft memos with human publication | AI | §18.5 | AI-004 | No unsupported number or auto-publish |
| AI-005 drift/change monitoring and safe notifications | AI | §18.5 | AI-005 | Consent/noise/opt-out tests |
| Provider data minimization, retention and cost guardrails | AI, V3 | §§18.3, 21 | AI governance | Privacy review, no secrets in logs |
| Consumer “financial stress reduction” without clinical claims | Founder, V4 | §§3, 7, 20 | PERS | Content/usability validation |

## D. Financial methodology, scope, compliance and release

| Requirement | Origin | V5 blueprint | V5 Code directive / owner | Completion evidence |
|---|---|---|---|---|
| Existing 2026 RMD sample, decimal math, reason-code coverage | V3, A2 | §19.2 | Finance engine | Golden and negative fixtures |
| 49 Uniform factors compared, still no qualified sign-off | A2 | §19.2 | FIN-VERIFY-001 | Review log accurately attributed |
| `DRAFT` 2026 federal ordinary-income rules not exposed as checked | A2 | §19.2 | Tax research | Independent benchmark before publish |
| Monthly margin/cash forecast accounting rules and missingness | V4 | §§3, 19.3 | PERS | Timing/transfer/seasonal goldens |
| Debt payoff interest/APR, fees and minimums | V4 | §§3, 19.3 | PERS | Rounding and liquidity tests |
| Gross-basis annual retirement scenario, event order and no-tax labeling | AI, V4 | §§4, 19.3 | SCENARIO-001 | Replay golden and property tests |
| SSA/tax/Roth/Monte Carlo separate validated future gates | AI, V4 | §§4, 19.3–19.4 | Later calculators | Reviewer signoff and uncertainty disclosure |
| Rule-set version, effective date, published/DRAFT and rollback | V3, AI | §§17, 19.4 | FIN-VERIFY | Source+test+reviewer registry |
| Legal B2C registered-advice perimeter and feature matrix | V4 | §§10, 21.2, 22 | REG-001 | Counsel feature decision and controls |
| Rule 206(4)-7, Rule 204-2 and Reg S-P context not automatic certification | V3, V4 | §§10, 21.2 | Counsel | Correct public and contractual claims |
| NIST GenAI / OWASP as governance guidance, not certification | AI, V3, V4 | §21.3 | AI governance | Risk register, evaluation and remediation |
| No SOC 2, zero-retention, bank integration or advisor licensing false claims | All | §§10, 21.4 | Marketing gate | Claims register with dated evidence |
| Staged synthetic → technical → professional/legal → commercial release | AI, P3, V4 | §22 | G0–G5 owners | Signed exit criteria, recorded tests |

## Required interpretation

This matrix is **traceability, not a certification**. It does not mean every possible line of historical documentation was repeated verbatim; it preserves requirements material to safety, correctness, product scope and implementation, with explicit release gating. If a newly inspected repository implementation or professional review contradicts a row, capture it as a tracked decision with evidence, version and owner; never silently mark it complete. The V5 Claude Code prompt contains the operative engineering instructions for implementation, testing and honest reporting.

## E. V5 session 1 evidence (2026-11-06, `feat/v5-dual-market`)

| Requirement | Evidence in tree | Suite |
|---|---|---|
| DUAL-000 docs | `docs/product/FEATURE_STATUS_MATRIX.md`, `docs/architecture/DUAL_WORKSPACE_ADR.md`, `docs/ai/AI_EVAL_MATRIX.md`, `docs/legal/FEATURE_RELEASE_GATES.md`, `docs/finance/RULE_VERIFICATION_AND_MODEL_REGISTRY.md` | — |
| DUAL-001 dual entry + shells | `apps/web/src/ui/marketing/SiteNav.tsx`, `app/(marketing)/{personal,retirement,firms,how-it-works}`, `app/demo/personal/*`, `ui/console/ConsoleShell.tsx` | `e2e/dual-market.spec.ts` (both paths, firm nav intact, mobile) |
| PERS-001 manual intake + baseline + next steps | `services/calculator/app/financial/cashflow.py`, `packages/contracts/src/decision-policy.ts`, `apps/web/src/domain/personal/*` | `test_personal_clarity.py` (22), `v5-contracts.test.ts`, `personal.test.ts` (11), e2e |
| PERS-002 (first slice) debt/budget scenario cards | `app/financial/debt.py`, `/demo/personal/scenarios` | `test_debt_paths.py` (9), e2e |
| Shared planning, separate workspaces and permissions | `packages/contracts/src/workspace.ts` (`actorCanReadDomain`), `auth/personal-actor.ts`, `domain/personal/queries.ts` | `v5-contracts.test.ts`, `personal.test.ts`, AI-E11/E12/E25 |
| AI-000 contracts, mock, 28 cases | `packages/contracts/src/ai/*`, `apps/web/src/ai/{provider,evals}` | `ai-evals.test.ts` (30) |
| AI-001 orchestrator, read-only tools, validator, draft persistence, feedback | `apps/web/src/ai/{evidence-resolver,tools,result-validator,review-orchestrator}.ts`, `domain/ai/feedback.ts` | `ai-evals.test.ts`, e2e firm + personal |
| AI-CORE-001 bounded tool loop: budgets before dispatch, strict tool args, de-dup, per-call + pre-record re-authorisation, untrusted tool results, abstention, runtime trace; live-provider port (types only) | `apps/web/src/ai/runtime/tool-loop.ts`, `ai/provider.ts` (`MockToolLoopProvider`, `continue()`), `ai/tools.ts`, `ai/providers/port.ts`, `packages/contracts/src/ai/runtime.ts` | `ai-core-toolloop.test.ts` AI-C01…C16 (17), `ai-runtime-contracts.test.ts` (4); AI-E01…E28 unchanged |
| AI-CORE-002a hosted adapter skeleton: enablement gates, Anthropic Messages port, structured output via forced tool, tool_result replay as untrusted data, typed failures, token ceiling and per-scope run limit that fail closed, served-model recording, no secret in records | `apps/web/src/ai/providers/{hosted-config,anthropic-messages,hosted-provider}.ts`, `ai/provider.ts` (`resolveProvider`) | `ai-core-hosted.test.ts` AI-H01…H10 (10); `ai-hosted.live.test.ts` opt-in (skipped without gates) |
| AI-SEC-001 narrative grounding: the summary, draft memo, questions and model limitations obey the same amount and pass-claim rules as findings; a failing field is withheld (`REDACT_TEXT`), never rendered, and the run status is never promoted | `apps/web/src/ai/result-validator.ts` (narrative sweep after finding validation), `packages/contracts/src/ai/review.ts` (`REDACT_TEXT` disposition) | `ai-sec-001-narrative.test.ts` AI-N01…N08 (8); AI-E/AI-C/AI-H unchanged |
| Trusted calculator invocation vs matching hash (personal analogue of S-04) | `domain/personal/runs.ts` `verifyPersonalReceipt` | `personal.test.ts` |
| Investment education now, recommendations gated | `/demo/personal/learn`, `ENABLED_TIERS = [0,1,2]` | `v5-contracts.test.ts` |
| Consumer "stress reduction" without clinical claims | copy review across `/demo/personal/*` and marketing | manual |
| S-01–S-10 / N-01–N-05 | untouched; migrations 0001–0006 unchanged (`--check` green) | SQL suites **not rerun** this session |

## F. PR-002 evidence (2026-11-06, `feat/pr-002-coverage`)

| Requirement | Evidence in tree | Suite |
|---|---|---|
| S-06 typed outcome; unsupported-only never verified; packet title/scope from coverage | `packages/contracts/src/coverage.ts` (`coverageSummary`, `approvalReadiness`, `packetTitle`), `domain/review.ts`, `domain/evidence.ts` (packet v2), `ui/console/CoveragePanel.tsx`, migration 0007 §1, §5, §7 | SQL 007 E4–E6; web `pr-002-coverage.test.ts`; contracts `v5-contracts.test.ts`; e2e `pr-002-coverage.spec.ts`, `assurance-flow.spec.ts` |
| S-07 snapshot payload v2 (policy + `policy_sha256`, vendor label, account classification); request from payload only; freeze verifies against org rows | `domain/freeze.ts` (`policyRecord`, `buildSnapshotPayload`), `domain/checks.ts` (`buildRmdRequest(snapshot, accountId)`), migration 0007 §2–§4 | SQL 007 E1 (5 negative + 5 positive incl. fixture-pinned `policy_sha256`); web `pr-002-coverage.test.ts` S-07; three-tier canonical fixtures `case_policy_record.json`, `case_snapshot_v2.json` (pytest `test_canonical_fixtures.py`, contracts `trust-boundaries.test.ts`, SQL 006) |
| N-02 latest attempt per (account, check type); history kept; CHECK_COMPLETE only when every payload account's latest attempt is clean | `latestCheckRuns`, `domain/checks.ts`, `ai/evidence-resolver.ts` (same rule), migration 0007 §5–§7 (`clock_timestamp()` on runs) | SQL 007 E2/E3/E6; web `pr-002-coverage.test.ts` N-02 |
| S-04 guard preserved (any non-ERROR unverified run refuses approval) | `approveReview`, `record_review` | SQL 005 HH5 (unchanged); web `trust-boundaries` |
| N-04 inventory after 0007 (`policy_record`, `latest_check_runs`, `coverage_summary` added) | migration 0007 §8 | SQL 005 + 007 inventory assertions |
| Demo state v4 (payload v2 snapshots, review outcomes) | `DEMO_STATE_VERSION`, `seed.json` | web suites |
| Not done | real Supabase Auth/JWT/PostgREST/RLS run of 0007; professional sign-off | — |

## G. PR-003a/b evidence (2026-11-06, `feat/pr-003-identity`)

| Requirement (V5 §17.4, §21.1) | Evidence in tree | Suite |
|---|---|---|
| Principal = `auth.users`; identity derived from `auth.uid()` only; selectors never authority (S-01) | migration 0008 §2, §7 (`require_principal`), `apps/web/src/auth/identity.ts` (`resolveIdentity` ignores unconfirmed `org_id`/`workspace_id`), `supabase-server.ts` (`auth.getUser()`, never `getSession()`) | SQL 008 (strangers, `my_workspace_access` empty row); web `identity.test.ts` selector cases; realstack §3, §5 |
| Firm membership never reaches a consumer workspace; only an ACTIVE, unexpired grant to the person or the firm does | `app.can_read_workspace_domain`, RLS on the six record tables + profile, `workspaces_select` | SQL 008 Dee before/after grant, F2 sees nothing; realstack §4 |
| Shared household with limited permissions (one domain) | `invite_participant(domains[])`, membership `domains`, `can_read_workspace_domain` | SQL 008 Ben SAVINGS_GOALS-only; realstack §3 |
| Expiration and revocation honoured immediately; revoked grant kept as versioned history | `consent_grants.expires_at/revoked_at/version`, `revoke_consent`, `consent_grants_guard` (scope immutable, no un-revoke) | SQL 008 expired grant inert, revoke → 0 rows, version 2; realstack §4 |
| Memberships/grants mutate only through entry points (privilege first, sentinel second) | 0008 §6, §8 (`authenticated` SELECT only) | SQL 008 direct insert/update 42501; realstack §2 |
| Owner-only writes; participants/grantees read-only; no DELETE for end users | RLS insert/update policies, no DELETE grant | SQL 008; realstack §3 |
| Per-workspace append-only event log, linear and hash-linked (S-04 analogue) | `workspace_events`, `workspace_append_event`, immutability trigger | SQL 008 chain assertions; realstack §6 |
| N-04 inventory after 0008 | 0008 §8; tests 005/007/008 | SQL inventory assertions (3 files) |
| Real GoTrue JWT / PostgREST / RLS run with two firms, consumers, shared household, firm grant, expiry/revocation | `supabase/realstack/run.mjs`, CI job `realstack` (also runs real pgTAP via `supabase test db`) | **Green on PR #10 run 3 (`fa2669b`): pgTAP 251/251, harness 50/50.** CI only (no Docker in the sandbox) |
| Honest production state: no demo data behind a login; store adapter absent and said so | `/app`, `ui/ProductionHome.tsx`, `ProductionGate.tsx` | e2e `pr-003-identity.spec.ts` |
| Latent pgTAP defect fixed | tests 002/003/005 `plan()` corrected (20→23, 10→11, 58→71); `run_sql_tests.py` enforces plan == tests run | SQL harness 8/8 (negative control verified) |
| Not done | Supabase store adapter (DATA-001), private storage/document registration, member-management UI, vector search (none exists), professional sign-off | — |

## H. DATA-001 evidence (2026-11-06, `feat/data-001-store-adapter`)

| Requirement | Evidence in tree | Suite |
|---|---|---|
| One domain path for demo and production personal records (no second validator, no second ownership rule) | `domain/personal/repository.ts` (`PersonalRepository`: Demo = file store, Production = Supabase); `supabase-repository.ts` runs the unchanged `records.ts` / `mutations.ts` against a view loaded under the user's session | web `supabase-repository.test.ts` (12: diff plan, id remap, FK order, zero-row refusal, partial-write error); existing `personal.test.ts` unchanged |
| Production writes land only through RLS as the signed-in user; no service-role key in the app | `supabase-server.ts` (anon key + session), `app-personal-actions.ts`, `SupabasePersonalRepository.persist` verifies one row per write | realstack vitest `supabase-repository.realstack.test.ts` (3: owner CRUD round-trip, SAVINGS_GOALS-only participant, stranger NOT_FOUND) — **CI only** |
| Exact money round-trip, no arithmetic in the web tier | `SELECTS.*::text` casts; `normalizeMoney` on read; no sums anywhere in `/app/personal` | unit tests (row mapping) |
| Honest state: production shows records only; no computed figures without receipted runs | `/app/personal` banner; `PersonalRepository.supportsRuns = false` for production | e2e `data-001-personal.spec.ts` |
| Production "Start fresh" via the 0008 entry point (`create_personal_workspace`) | `/app/personal/start`, `appStartFreshAction` | realstack harness §2 (RPC path); e2e gate when unconfigured |
| Non-atomic multi-row writes over PostgREST are disclosed, not hidden | `DATA_PARTIAL_WRITE` names what landed; atomic RPC planned for DATA-002 | unit test |
| Parallel-session coordination (AI-CORE track) | `docs/architecture/PARALLEL_SESSIONS_AND_DATA_BOUNDARY.md`: ownership, seams (`PersonalRepository.bundle()` is the AI tools' data source), migration-number reservation | — |

## I. DATA-002 evidence (2026-11-06, `feat/data-002-personal-runs`)

| Requirement | Evidence in tree | Suite |
|---|---|---|
| One atomic, server-authorised write path for all personal tables; no direct INSERT/UPDATE privilege for end users (S-02) | 0009 §4 `apply_personal_changes` (owner re-derived, workspace/actor columns forced, table+column allow-lists, zero-row update raises), §6 revokes | SQL 009 (forged columns overwritten, allow-lists, rollback of a half-applied plan, N-04 "no direct write privilege"); realstack harness §2/§4b; realstack vitest |
| Snapshots immutable except CURRENT→SUPERSEDED; one CURRENT per workspace; runs and decisions append-only (S-04 analogue) | 0009 §1 triggers + partial unique index; column allow-list for updates = `status` only | SQL 009; realstack vitest (supersede + revision 2 in one call) |
| A stored "successful" run is verified, engine-attributed and receipted; an ERROR run carries no amounts (S-05) | `personal_calc_runs_success_shape` CHECK; web `verifyPersonalReceipt` unchanged | SQL 009 (three refusals + accepted ERROR), realstack vitest (DB refuses an unverified success through the repository) |
| Computed results readable only with access to every record domain they span | `app.can_read_personal_runs`; RLS on snapshots/runs/decisions | SQL 009 (participant, stranger, 3-of-4-domain grant refused, 4-of-4 allowed, RETIREMENT separate); realstack vitest participant isolation |
| Same engines/policy for demo and production; no arithmetic in the web tier | `runs.ts` over `PersonalDataSource`; `/app/personal` renders receipted figures via `Money`/`Stat` | web `personal.test.ts` unchanged (28), `supabase-repository.test.ts` (14), Playwright 20/20 |
| Workspace event per logical change incl. snapshots, runs, decisions, retirement | 0009 §3 allow-list widened; RPC appends events | SQL 009 `results_eq` on the event log |


## J. Baseline reconciliation evidence (2026-11-06 evening, `master` after #10 → #13 → #16)

Scope: no new product behaviour. Three open PRs merged in dependency order with merge commits; two semantic merge fixes; founder Session-3 planning package installed; status documents reconciled. Suites below were executed on the integrated tree (byte-identical to `master` after #16) in the Linux build sandbox; real-stack evidence is the CI `realstack` job on each PR head.

| Requirement | Evidence in tree | Suite |
|---|---|---|
| Merged branches keep every invariant S-01–S-10 / N-01–N-05 and the AI-E/AI-C/AI-H cases green together, not only on their own branches | `master` @ post-#16; `49a79ab` (#10 head), `93724d0` (#13 head), `14bf17e` (#16 head) | typecheck + lint clean; pytest 119; contracts Vitest 53; web Vitest 244 passed / 5 skipped (opt-in realstack repository test, opt-in live-vendor benchmark); SQL shim 9/9 files on embedded PostgreSQL 16; `next build` clean; Playwright 20/20; CI (calculator, web, database, e2e, realstack) green on all three PR heads |
| Retire confirmation (UI-001a D-series, "retire never deletes") also protects the production `/app/personal` path, not only the demo | `apps/web/src/ui/personal/RecordForms.tsx`: `ConfirmDialog.onConfirm` calls the injectable `retire` action (demo default `retireRecordAction`, production `appRetireRecordAction`) | Playwright `pers-002-intake.spec.ts` (dialog), `data-001-personal.spec.ts`; typecheck |
| Every AI run outcome has an honest UI state; `ABSTAINED` (no draft, nothing asserted) is neither a draft nor an error | `apps/web/src/ui/status/ai.tsx` `AI_RUN_STATUS_CHIP.ABSTAINED` (neutral tone); `AiReviewPanel.tsx` abstention copy | `status-chips.test.tsx` (exhaustive over `AiRunStatus`), `ai-core-toolloop.test.ts` AI-C abstention cases |
| Founder planning documents are preserved and dated; no stale status is presented as current; no stray staging artefact or subdirectory `CLAUDE.md` is committed | `docs/prompts/*`, `docs/roadmap/V5_SESSION3_UNIFIED_INTEGRATION_ADDENDUM.md`, `docs/design/V5_SESSION3_UI_UX_DESIGN_ADDENDUM.md`, `docs/project/*`, `docs/ai/SAGESPAN_AI_CORE_FABLE_5_1_MASTER_PROMPT.md` (1.1), `docs/history/*2026-11-06.md`, `.gitignore` (`.ai-core-staging/`) | Reconciliation note at the top of each; `git grep -l "ai-core-staging"`; no `docs/CLAUDE.md` |
| One current-state paragraph and one status vocabulary in the root `CLAUDE.md`; delivery order shows done vs open per package | `CLAUDE.md` header + §6 | Review |

Open regression items carried forward (not closed by this section): TS/SQL equal-timestamp latest-attempt tie-break (PR-002 follow-up); frozen calculation policy vs *current* authorisation and revoked consent at action time (PR-003 follow-up, partly covered by 0008 RLS + per-call re-authorisation in the AI runtime); `REVIEWED_WITH_LIMITATIONS` visual distinction through UI-003.

## K. AI-CORE-002b evidence (2026-11-06 evening, `feat/ai-core-002b-benchmark-prep`)

Scope: benchmark preparation and the production seams the AI runtime needs before any live run on production data. No migration, no calculator change, no UI change, no live vendor call. Founder decisions recorded: vendor confirmed (Anthropic Messages API), model pinned (`claude-sonnet-5-5`, not verified) — `docs/DECISIONS.md`.

| Requirement | Evidence in tree | Suite |
|---|---|---|
| Per-call re-authorisation works against an ASYNC, RLS-shaped source of truth (S-01, consent revocation at action time; IMPLEMENTATION_STATUS open item 5) | `runtime/tool-loop.ts` awaits `reauthorize()`; `evidence-resolver.ts` `GroundingResolver`, `PersonalBundleSource`, `personalRepositoryResolver()`, `personalContextFromBundle()`; `review-orchestrator.ts` `runPersonalUnderstandForRepository()` | `ai-core-002b-resolver-quota.test.ts` AI-C17 (awaited before tool + before RECORD; result ≡ sync path), AI-C18 (revoked mid-run → NotFound, no tool, no continuation, nothing persisted), AI-C19 (new CURRENT snapshot → `CONTEXT_CHANGED`), AI-C21 (resolver error ends the run) |
| No silent drop of AI run records on a backend without an AI-run table | `runPersonalUnderstandForRepository()` persists only for `mode === "DEMO"`; PRODUCTION returns `persisted:false` + note naming the registry | AI-C20 |
| Per-workspace quotas are policy decided before any vendor call; store failure fails closed (IMPLEMENTATION_STATUS open item 6, design) | `packages/contracts/src/ai/quota.ts` (`ai-quota-v1`), `apps/web/src/ai/quota/store.ts` (`AiQuotaStore`, `InMemoryAiQuotaStore` PER_PROCESS, `UnavailableAiQuotaStore`), `HostedProvider` reserve/settle keyed by `run_id`; `ProviderInput.run_id` stamped by the runtime | AI-Q01…Q06 (strict contracts; reserve/settle/window; runs then tokens exhausted; closed failure without a vendor call; no key in records); AI-H07/H08 unchanged |
| Deterministic baselines for `diffReports`; a live model is compared to the same files the mock meets | `apps/web/src/ai/evals/baselines/{patel-firm-pass,patel-firm-unsupported,castillo-personal}.mock-toolloop.json`, `evals/baselines.ts`; `ai-hosted.live.test.ts` writes JSON + Markdown to git-ignored `.ai-bench/` | `ai-baselines.test.ts` AI-B (mock ≡ baseline; no approval/verified in baselines); live test skipped without gates (NOT RUN) |
| Review protocol and durable-persistence design are written before any live run | `docs/ai/AI_CORE_002B_LIVE_BENCHMARK_REVIEW.md` §§2–6 (runbook, review table, decision vocabulary, table sketch for `ai_runs` / `ai_feedback` / `ai_quota_usage` with SECURITY DEFINER entry points and grant audit) | Review |
| AI-E01…E28, AI-C01…C16, AI-H01…H10, AI-N01…N08 unchanged | same files | web Vitest (see session report counts) |
