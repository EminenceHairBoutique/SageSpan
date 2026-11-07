# Deliverable 3 — SageSpan V5 A–G Milestone Reconciliation and Acceptance Checklist

> **Reconciliation note (2026-11-06 evening, integration coordinator session):** this bundle is the founder-supplied independent audit (prepared outside the repository from the GitHub API at ~18:57 ET, `master` @ `e0d2f63`). It is preserved verbatim as dated evidence. Its "current state" rows predate the merges done the same evening (#10 PR-003/DATA-001/DATA-002 → #13 AI-CORE-001 → #16 AI-CORE-002a, then #18 AI-SEC-001). Each code-level finding was re-verified against the source and its disposition is recorded in `docs/engineering/V5_SESSION_7_BASELINE_RECONCILIATION_REPORT.md` §4 (P0 AI-SEC-001 **confirmed and fixed in #18**; P1 two-step save/refresh **confirmed, partly mitigated by snapshot-bound runs**; P1 render-time refresh **confirmed**; P1 synchronous `reauthorize()` **confirmed**; P1 in-process hosted budgets **confirmed**; P1 unprotected `master` **reported, not verifiable with the session token**). The operating model in `04_CLAUDE_CODE_NEXT_PROMPTS.md` §A was adopted by the founder and is codified in `docs/project/SESSION_OPERATING_MODEL.md`; its INT-001 prompt was executed by this session; the remaining prompts are superseded by the post-merge versions in the reconciliation report §7.

**As of:** November 6, 2026. Status vocabulary: **MERGED** = in `master`; **BRANCH-IMPLEMENTED** = source code exists on an open/stacked branch; **SYNTHETIC COMPLETE** = tested only on synthetic fixtures; **PARTIAL** = meaningful subset implemented; **NOT STARTED** = no implementation found; **BLOCKED** = prerequisite unmet; **NEEDS VERIFICATION** = claimed result exists in a historical report but not independently re-run in the final integrated tree.

## A. Baseline reconciliation

**Status: SUBSTANTIALLY COMPLETE historically; MUST REPEAT at each integration.**

- [x] Inventory remote branches and all PRs: 14 branches, 17 PRs as checked via GitHub API.
- [x] Verify PR-001 integration: PR #5 merged, with `0005`/`0006` on master.
- [x] Confirm PR-002 (#9) and policy hash follow-up (#11) merged; `0007` on master.
- [x] Inspect master’s code vs open feature branches and check current PR statuses.
- [x] Check main CI: 42311019916 four jobs green.
- [x] Confirm E2E ECONNRESET fix from closed PR #8 exists in main; do not duplicate.
- [x] Verify real Supabase CI evidence exists on PR #10 and #15.
- [ ] On each developer machine, inspect `git status --porcelain=v1`, current branch, untracked docs, local commits; **cannot verify local uncommitted state through GitHub**.
- [ ] Produce a reproducible green CI run on the conflict-resolved combination of PR #10 and the latest UI-001a `master`.
- [ ] Rewrite master status matrix/readmes to distinguish current integrated state from branch-only work.

**Acceptance:** signed integration reconciliation report listing SHA, PR bases/heads, clean tree without overwriting unrelated work, all tests and exact new scope. `git diff`, `git merge-base` and SHA evidence must be attached.

## B. PR-001 residuals and real-stack security

**Status: CORE MERGED; PARTIAL real-stack verification on PR #10; PRODUCTION G3 OPEN.**

- [x] PR-001 S-01…S-05 / N-01/N-03/N-04/N-05 hardening (#5 merged).
- [x] Typed workflow, audit chain, explicit grants/SECURITY DEFINER inventory, receipt and snapshot controls in migrations 0005–0006.
- [x] Real GoTrue JWT + PostgREST + RLS test flow available and green on PR #10 (251 pgTAP + 50 harness assertions) and DATA-002 child (310 + 59 + 4 integration assertions).
- [ ] Integrate latest realstack workflow into `master` and require it on PRs touching migrations/auth/store.
- [ ] Re-audit denial/absence paths under genuinely deployed Supabase project configuration (not only disposable CI).
- [ ] Private storage bucket, trusted upload/byte hashing, signed retrieval, malware/content boundary, document registration and per-domain grants.
- [ ] Member-invitation/accept/revoke and consent purpose/expiry/revoke UI, visibility and audit.
- [ ] External legal/vendor processing consent, data retention/deletion/export, backup/restore, breach response and security monitoring.
- [ ] Firm-side durable records/writes and separate-of-duty verified with real actors (DATA-003).

**Acceptance:** multi-actor realstack and deployed staging negative tests; denied cross-tenant file access, stale sessions, forged org/workspace inputs, direct SQL writes, consent expiry/revocation and private document retrieval, all audited.

## C. PR-002 financial coverage / freeze / retry semantics

**Status: MERGED IN MASTER, AND REAL-STACK TESTED ON OPEN PR #10 FAMILY; no duplicate development required.**

- [x] PR #9 `0007_coverage_and_reproducibility.sql`: `sagespan.snapshot.v2`; frozen policy, vendor label and account classification.
- [x] Frozen-only deterministic `buildRmdRequest()`; changing live policy does not silently change the request hash.
- [x] Latest-attempt-per-account semantics: ERROR → PASS recoverable; PASS → ERROR cannot rely on stale PASS.
- [x] Typed coverage outcomes (`SUPPORTED_CHECK_VERIFIED`, `REVIEWED_WITH_LIMITATIONS`, `APPROVED_WITH_EXCEPTIONS`). The professional may approve with documented limitations, not mislabel as verified.
- [x] PR #11 adds policy hash fixture and v2 canonical cases.
- [x] Shim/Postgres15 CI has passed; 0007 is included in 9-migration realstack runs on PR #15.
- [ ] Confirm identical behavior after PR #10 integrated to current master and seeded upgrade path for old v1 snapshots.

**Acceptance:** test supported/unsupported/mixed coverage, ERROR-retry sequences, frozen payload vs mutated live record, v1 refusal, cross-language canonical hashes. Preserve previous decision semantics unless the founder explicitly changes them.

## D. DUAL-000 / DUAL-001 shared B2C+B2B platform

**Status: SYNTHETIC COMPLETE for original planned shells/routing; production PARTIAL.**

- [x] Dual-entry site (`/personal` and `/firms`), shared contracts and distinct B2C/B2B demo navigation.
- [x] Personal/Household/Firm workspace model and explicit domain share scopes in TS.
- [x] Personal demo manual-entry, guided intake, dated/retired records and data states.
- [x] Advisor console with separately scoped households, reviewer roles and approval workflow.
- [x] PR #10 implements real consumer principal/workspace/consent RLS and user JWT (branch-only).
- [x] PR #12 provides production PersonalRepository (merged into #10); PR #15 provides calculated personal records (same branch).
- [ ] Integrate PR #10; implement firm-side production UI/repository, member-management/consent experience and private files.
- [ ] Validate end-to-end personal-user → household-domain share → advisor scoped access → revoke flow and stale-access denial.

**Acceptance:** users never inherit firm data or vice versa; demo and production are visually and technically isolated; current grants are visible and revocable; no server route uses a client-provided actor as authority.

## E. AI-000 / AI-001, plus AI-CORE-001/002a

**Status: AI-000/001 MERGED (offline mocked); AI-CORE-001 BRANCH-IMPLEMENTED; hosted adapter DRAFT; live evaluation NOT STARTED.**

- [x] Versioned AI schemas, role/rule constrained draft-only report and feedback.
- [x] 28 labeled AI-E cases, two personal cases, evidence resolver, allowlisted read tools, output validator, mock drafts.
- [x] #13 bounded tool loop (17 AI-C tests, 2-turn mock, runtime digest trace), but not merged.
- [x] #16 Anthropic transport skeleton + 10 AI-H offline tests on draft PR.
- [ ] Fix `result-validator.ts` top-level narrative money/authority grounding gap.
- [ ] Merge #13 only after conflict-resolved real-data seam is understood; tests in combined tree.
- [ ] Retarget #16, obtain founder vendor/model decision, run synthetic live benchmark, assess price/latency/quality/refusal against frozen fixtures.
- [ ] Implement persistent production AI runs, async RLS reauthorization, external provider consent, durable budgets and model-version rollback.
- [ ] Knowledge registry/RAG, governed datasets, fine-tune/self-host trials only when evaluations justify it.

**Acceptance:** 100% blocked unauthorized scopes/actions in adversarial suite; no unsupported number or approval in **any** visible output field; all tool results untrusted; model cannot silently bypass human decisions.

## F. PERS-001 / PERS-002 cash flow, debt, goals, decision queue

**Status: SYNTHETIC COMPLETE for specified implementation, with limited production persistence branch-built; broader goal optimization PARTIAL.**

- [x] Deterministic, receipted cash-flow baseline (median/low income, expenses, margin, buffer, dated outlook, collision flags).
- [x] Debt scenarios: minimums, avalanche/snowball/hybrid, cash floor, cited outputs.
- [x] Cash-flow what-ifs: spending, savings liquid/illiquid, income interruption, explicit INFEASIBLE.
- [x] Manual record add/edit/retire, audit revisions, missing/assumed/stale states.
- [x] User goal records and constrained feasibility-first policy with ≤3 primary next steps; user can acknowledge/snooze/disagree.
- [x] PR #15 production personal snapshots, runs and decisions plus atomic single RPC (`0009`), realstack tested on child branch.
- [ ] Treat every saved-record edit and later recomputation as separate transactions; solve stale-run label/race correctly.
- [ ] Implement richer goal funding optimizations, temporal consistency, shortfall trade-offs, 1–12 month projections and actual connected-data ingestion only with independent test specifications.
- [ ] Obtain qualified financial methodology review of published model outputs before using terms like professionally verified.

**Acceptance:** input completeness, financial precision, no impossible savings above available liquidity, clean error-state UI, qualified projections and reproducible receipts.

## G. PR-003 / DATA-001 / SCENARIO-001, then AI-002–005 / imports / export

**Status: PR-003/DATA-001/002 BRANCH-IMPLEMENTED & CONFLICTING WITH MASTER; SCENARIO-001 NOT IMPLEMENTED; rest PARTIAL/PROPOSED.**

- [x] PR #10 has migration 0008, real Supabase identity, explicit consent model and GoTrue/JWT/RLS CI.
- [x] #12 merged into #10: personal Supabase repository and production personal screen.
- [x] #15 merged into #10: migration 0009 computed runs, snapshots, atomic apply and 5-job CI.
- [ ] Resolve #10 `mergeable_state: dirty` with UI-001a `master`, run all five CI jobs and merge.
- [ ] Build firm-side DATA-003, consent/member interface, private document storage and evidence registration.
- [ ] Build SCENARIO-001/PLAN-001 independently with deterministic annual engine and approved method version. Current UI is only readiness gate.
- [ ] Add model/knowledge data store, AI live adapter benchmark, governance, consented AI monitoring; no model training yet.
- [ ] Verified import format maps (two named source formats), source-byte proof, professional PDF evidence packet plus hash manifest and review history.
- [ ] Resolve FIN-VERIFY-001, REG-001, G3–G5 before true real-data or regulated-service launch.

**Acceptance:** production actors have least privilege; sampled consumers/advisors cannot see unrelated data; supported annual model compares saved scenarios deterministically with receipts; export is human-reviewable and cryptographically self-consistent, without being represented as a certification.

## Consolidated next action checklist

- [ ] P0: Back up / preserve all uncommitted local files; fetch all refs without modifying founder's active checkout.
- [ ] P0: Integrate PR #10 (`0008`, `0009`, UI-001a) without overwriting feature work; five CI jobs green.
- [ ] P0: Protect `master` with required review + CI, prevent force pushes.
- [ ] P0: Add complete narrative grounding checks before a live AI provider is used.
- [ ] P1: Merge AI-CORE-001 (#13) with PR-003-compatible async auth contracts and separate production/AI persistence plan.
- [ ] P1: Rebase/retarget #16; founder confirms hosted vendor/model, first synthetic live benchmark performed and reviewed.
- [ ] P1: UI-001b navigation/shells, UI-001c accessibility/contrast CI, UI-003b verified-status vocabulary.
- [ ] P1: DATA-003 firm store + private docs/member consent, user-data gate audit, source hash verification.
- [ ] P1: SCENARIO-001 annual gross-basis retirement engine and independent review.
- [ ] P2: Two verified import formats, professional PDF packet, operational exports, pilot and model telemetry.
- [ ] P2: Clean historical status docs and archive branches only after tree comparison/PR confirmation.

## Links to verify completion

- https://github.com/EminenceHairBoutique/SageSpan/pull/10
- https://github.com/EminenceHairBoutique/SageSpan/pull/13
- https://github.com/EminenceHairBoutique/SageSpan/pull/16
- https://github.com/EminenceHairBoutique/SageSpan/pull/17
- https://github.com/EminenceHairBoutique/SageSpan/actions/runs/42311019916
- https://github.com/EminenceHairBoutique/SageSpan/actions/runs/42241527406

**Evidence rule:** Check boxes here denote observed scoped implementation, not production clearance. When a subsequent merge completes, document SHA + test run + actor/reviewer who verified it; do not simply flip a label based on a Claude report.
