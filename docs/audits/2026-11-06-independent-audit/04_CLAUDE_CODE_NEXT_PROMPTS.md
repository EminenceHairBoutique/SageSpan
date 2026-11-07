# Deliverable 4 — SageSpan Claude Code / Fable 5.1 Next-Session Prompts & Session Architecture

> **Reconciliation note (2026-11-06 evening, integration coordinator session):** this bundle is the founder-supplied independent audit (prepared outside the repository from the GitHub API at ~18:57 ET, `master` @ `e0d2f63`). It is preserved verbatim as dated evidence. Its "current state" rows predate the merges done the same evening (#10 PR-003/DATA-001/DATA-002 → #13 AI-CORE-001 → #16 AI-CORE-002a, then #18 AI-SEC-001). Each code-level finding was re-verified against the source and its disposition is recorded in `docs/engineering/V5_SESSION_7_BASELINE_RECONCILIATION_REPORT.md` §4 (P0 AI-SEC-001 **confirmed and fixed in #18**; P1 two-step save/refresh **confirmed, partly mitigated by snapshot-bound runs**; P1 render-time refresh **confirmed**; P1 synchronous `reauthorize()` **confirmed**; P1 in-process hosted budgets **confirmed**; P1 unprotected `master` **reported, not verifiable with the session token**). The operating model in `04_CLAUDE_CODE_NEXT_PROMPTS.md` §A was adopted by the founder and is codified in `docs/project/SESSION_OPERATING_MODEL.md`; its INT-001 prompt was executed by this session; the remaining prompts are superseded by the post-merge versions in the reconciliation report §7.

**Date:** November 6, 2026. **For:** Claude Code using the founder's preferred Fable 5.1 workflow. **Read first:** `00_MASTER_REPOSITORY_AUDIT.md`, `03_MILESTONE_STATUS_AND_ACCEPTANCE_CHECKLIST.md`, and the current repository `CLAUDE.md` / controlling V5 product spec. A checked-out repo and CI outcome always supersede stale session reports.

## A. Should the founder merge all Claude sessions into one?

**No.** Use **one Claude Project** as the durable product/strategy context, with **one master source-of-truth document and one active integration coordinator**, and keep **separate, short-lived Claude Code sessions/worktrees for scoped development**. Never combine all concurrent feature tracks into one giant session. The Project is for the same requirements, architecture, decisions and acceptance contract; Code sessions are for implementation, testing and PRs.

### Recommended operating model

```text
Claude Project / source of truth (V5 spec + founder decisions + current STATUS + ADRs)
   |
   +-- CODE SESSION A: Integration/Security -- owns PR #10, data boundary, CI conflicts
   |       - priority NOW, may update shared status/CI/migrations under coordinator authority
   |
   +-- CODE SESSION B: AI runtime -- owns apps/web/src/ai/**,
   |       packages/contracts/src/ai/**, docs/ai/**; PR #13 then #16
   |       - do NOT edit 0008/0009 or PR #10 auth/store without an integration handoff
   |
   +-- CODE SESSION C: UI -- owns frontend shells, navigation and visual tests
           - may work on synthetic routes while PR #10 resolves;
             hold production auth/consent files until integration

Later, separate bounded sessions: DATA-003/secure document ingestion and PLAN-001 engine.
```

**Maximum suggested concurrent writers:** two independent feature sessions + one integrator, and fewer if touching the same package. One person/branch owns each hot file group. There should be no separate 'Claude session' claiming to own the same `CLAUDE.md`, `.github/workflows/ci.yml`, migration number or shared primitives simultaneously. Reserve migration IDs centrally; `0008` and `0009` already exist on PR #10. Older report language saying 'AI owns 0010+' is a coordination note, not permission to collide with future DATA-003 migrations; document the exact next IDs before anyone creates SQL files.

### Session protocol (mandatory)

1. **Before editing:** `git fetch origin --prune`, `git status --porcelain=v1`, `git branch --show-current`, `git log -5 --oneline`, `git diff --stat`, GitHub PR statuses and SHA. Enumerate untracked docs. If the active worktree is dirty or may belong to the founder, **do not stash/reset/delete it**, do not force checkout; create a separate named worktree/clone and preserve it.
2. **Write one `SESSION_CONTRACT.md`** in the session's *own isolated workspace* with owner, touched paths, dependency PR, current HEAD SHA, minimal acceptance criteria, non-goals, migration reservation and branch name. Keep a short execution log.
3. **Work in a task branch and use PRs**. Never push directly to `master`, delete historical branches or force-push shared branches. Make each PR reviewable (prefer bounded diffs), include audit/abuse tests with positive and negative cases.
4. **At handoff:** commit and push only intended changes, attach GitHub Action run URLs, test counts and known skips, clearly label 'synthetic-only' vs real stack, report downstream conflicts and decisions. Do not declare G3/G4 passed without specific evidence.
5. **Integration coordinator** updates one `docs/project/IMPLEMENTATION_STATUS.md` after each verified merge; other tracks submit status suggestions but should not simultaneously rewrite shared global status files.

---

## B. Prompt 1 — RUN FIRST: INT-001 / PR #10 conflict reconciliation and DATA-002 integration

Copy the block below into **a new isolated Claude Code session** whose sole purpose is integration. Do not hand this to the AI/UI session.

```text
You are the lead integration engineer for SageSpan V5. You have the SageSpan repository, controlling V5 docs, CLAUDE.md, the November 6 independent audit and the latest GitHub PR state. Use the founder's preferred Claude Code Fable 5.1 workflow. Your assignment is INT-001: reconcile and safely integrate PR #10 (PR-003 + DATA-001 + DATA-002) with current master.

INITIAL AUDIT SNAPSHOT (REVERIFY BEFORE YOU CHANGE ANYTHING):
- Repo: EminenceHairBoutique/SageSpan, default branch master.
- Last independently observed master: e0d2f63722ec7659076a5d9c789d2fb58d9aab13; PR #17 UI-001a is merged and master CI green.
- PR #10 branch feat/pr-003-identity head a269d0b7aec4e67b2481f573a1553880295ac690, mergeable_state=dirty; it includes PR #12 DATA-001 and #15 DATA-002 after #15 merged into its head branch.
- Supabase migrations 0008 and 0009 are already claimed by PR #10; #9 0007 is merged in master.
- PR #13 AI runtime is separate and open; PR #16 hosted adapter is stacked on it and a draft. Do NOT merge them during this task.
- PR #8 was closed without direct merge but maxRetries:2 in assurance-flow.spec.ts is already in master. No duplicate fix.

MANDATORY SAFETY:
1. Inspect current Git state of every checkout you will touch; preserve all founder uncommitted/untracked files and local-only commits. Use a named isolated Git worktree or clean clone. NO git reset --hard, checkout -f, clean -fd, forced push, deleting files or reverting unrelated PRs.
2. Fetch origin and verify exact PR base/head and latest master before beginning. If GitHub changes while you work, stop and reconcile; do not overwrite another concurrent session's head.
3. Document likely overlap between PR #10 changes and UI-001a, but do not invent conflict details until Git shows the conflict markers. Preserve accepted design tokens, status chips, forms and all data migrations.
4. Keep synthetic-only G3 restrictions; do not enable real users or PII.

TASKS:
A. Create/refresh a compact baseline inventory: branch names, SHAs, PR #10 diff and files, migration sequence, worktree state, known CI checks. Compare the PR #10 head against master and verify previously merged #12/#15 are present.
B. Safely merge latest origin/master into an isolated integration working branch whose changes can be proposed back to PR #10 (or update the PR #10 branch by ordinary fast-forward after testing and explicit review; never force push). Resolve actual conflicts file-by-file with a recorded rationale.
C. Reconcile the UI-001a primitives and production `/app/personal`, `/app/sign-in`, selector and server actions. Validate import paths, styles, error boundaries, headings, focus, responsive 390px and credential/session handling without adding unrelated design features.
D. Confirm migration 0008 and 0009 integrity and N-04 grant inventory. Check real JWT RLS, stranger, revoked/grant-expired, partial domain, write denial, forged workspace id, concurrent create/retire and snapshot/run immutability. Preserve app.apply_personal_changes single-transaction guarantee.
E. Audit appSaveRecordAction: it calls repo.mutate before refreshBaseline separately. Explicitly distinguish mutation atomicity from total operation atomicity. Add a stale/recompute failure contract and regression test so newly edited records never appear to have receipts from an old snapshot. Inspect /app/personal render-time refresh and propose a bounded idempotent replacement rather than blindly writing on GET.
F. Confirm all fixed PR-001/002 tests are intact and no closed #8 code is duplicated.
G. Run all available suites: typecheck, lint, contracts/web Vitest, locked calculator pytest, OpenAPI/rule-set generated drift checks, Next build, full Playwright, shim SQL tests where feasible. Push to an integration PR and ensure GitHub Actions runs ALL FIVE jobs (calculator/web/database/e2e/realstack) green at the reconciled SHA.
H. After merge approval, ensure master CI contains realstack (and that it still runs), record branch/commit/test evidence, update status docs from historic to current, but do not claim deployed Supabase production validation. If master branch protection is not configured, advise specific required checks and review rules.

NON-GOALS: No retirement projection engine, no AI vendor call, no AI code rewrite, no firm DATA-003, no bank integration, no production PII, no CSS redesign beyond conflict compatibility.

OUTPUT:
1. `INT_001_INTEGRATION_REPORT.md`: before/after SHA graph, each conflict/hunk and choice, which PRs are merged or branch-only, all tests and exact Actions links, unresolved risks.
2. A small PR with only reconciliation fixes, tests and necessary documentation. No direct master push.
3. An updated V5 gate table with G0–G5 strictly evidence-based.
4. A short next handoff for AI-CORE-001 and UI-001b owners with exact integration SHA and frozen file ownership.

STOP/GATE: Do not call this complete unless PR #10 is mergeable, all required CI checks including realstack are green for the final reconciled head, and no local work was lost. If actual GitHub permissions block merge, leave an honest reviewed PR and report the blocker rather than saying it merged.
```

---

## C. Prompt 2 — AI-INT-001 / PR #13 and #16, after integration handoff

```text
You are SageSpan's AI systems lead. Work in a dedicated AI-only worktree. Read current master, PR #13 and #16, docs/ai/AI_EVALUATION_PLAN.md, AI_EVAL_MATRIX.md, AI_CORE_ARCHITECTURE.md, AI_CORE_THREAT_MODEL.md, and the November 6 independent AI audit. Do not begin until the INT-001 integrator provides the latest tested master SHA and real-data boundary contract.

GOAL: integrate AI-CORE-001 bounded tool-loop into the verified application without weakening authorization, then prepare the synthetic-only hosted provider PR for benchmark. Make each step a small reviewable PR.

1. Verify PR #13's current diff and mergeability against new master. Reconcile carefully; retain all 28 AI-E tests, 17 AI-C tests, evidence references, immutable drafts and the two-turn mock. No switch to hosted mode by default.
2. Fix AI-SEC-001: apps/web/src/ai/result-validator.ts currently validates money and claims within findings, but not summary, draft_memo and questions. Make one exhaustive server-side verification pass over all rendered model text. Add adversarial cases for invented currency in each field, false PASS/verified/approved assertions, fake citations and mismatched amounts. Support a deterministic REJECT or redaction policy with explicit issue codes. Do not let a shallow regex become a substitute for validated typed receipt references.
3. Identify and specify a safe async reauthorize/retrieve interface for real Supabase actor/workspace scope. The demo Store and synchronous reauthorize() from #13 are not production RLS. For current PR, preserve demo behavior; production integration must either be implemented with real JWT/RLS tests or remain explicitly disabled.
4. Confirm forbidden tool execution remains impossible, every tool result is untrusted, budgets enforced before execution, model output never approves or verifies, revocation mid-run aborts without writing an authoritative draft, and snapshot version changes invalidate the run.
5. Run full applicable test suite; verify relevant CI. Produce a concise diffReports baseline on frozen synthetic cases. Only then merge #13 through a reviewed PR.
6. After parent merges, retarget draft #16 to master. Confirm (do not assume) whether the first hosted vendor is Anthropic; model ID remains pinned by explicit founder decision, API key must remain local/server-only and never in CI/logs/repo.
7. Run AI-H offline tests and optionally the synthetic-only live test WITH explicit founder-provided key in a permitted developer environment; measure exact version, statuses, case-level diffs, tokens, latency and estimated USD cost. Do not promote live mode based on scripted mock tests alone. Keep G3 closed for real data. Note that in-memory token ceilings/rate limits are not multi-instance enforcement.

OUTPUT: AI integration PR, a coverage-added evaluation matrix, current `AI_CORE_FEATURE_STATUS.md`, P0 narrative test evidence, explicit unresolved production data/vendor constraints, live benchmark decision record if actually run. NON-GOALS: no self-hosted LLM training, no real user data, no automatic approvals, no migrations except an expressly allocated migration ID, and no editing UI or PR #10 branches simultaneously.
```

---

## D. Prompt 3 — UI-001b/001c dual-market design system and accessibility

```text
You are the SageSpan product design engineer. Work only in a dedicated UI worktree. Read UI-000 design audit, information architecture, design system spec, screen improvement plan, accessibility plan, UI-001 roadmap, PR #17 UI-001a and the independent UI summary. Verify PR #17 is already in master before editing. Use the current master SHA from the integrator; DO NOT refactor financial/AI/domain behavior.

GOAL: build UI-001b shells/navigation and UI-001c accessibility/visual regression in two bounded PRs. Professional, modern, calm, exact, accessible, mobile-first and B2B task-efficient. Keep existing receipt/citation/approval semantics and all synthetic banners.

UI-001b:
- Implement shared BrandLockup, SyntheticBanner, TopBar, SideRail/RailNav, a four-item Personal mobile BottomNav + More destination, compact advisor console rail, responsive marketing navigation, correctly active states and breadcrumbs. Keep comfortable Personal density and compact advisor density via CSS tokens.
- Add route-specific loading skeletons and clear empty/offline/blocked/insufficient states. Do not call the calculator or write to DB merely for page render.
- Fix visible nav clipping at 320/390/768/1440, no hidden sign-in or pricing links, actual focusable skip-link target.
- Before touching /app production auth/selector/consent, check with the PR #10 integrator and obtain an approved file-ownership handoff. Otherwise keep all changes under marketing and synthetic UI.

UI-001c:
- Implement a component gallery, @axe-core/playwright smoke checks and screenshot snapshots on representative real app pages, not only isolated components.
- Run contrast script as required CI; check keyboard focus, dialog escape/return focus, forms, status semantics, tables, reduced-motion and text zoom/320px reflow.
- Adopt DataTable/other UI-001a primitives where safe; do not alter finance amount strings or change false 'verified' copy without a documented taxonomy decision.

Follow-on UI-002/003 separately: Personal financial clarity and next-step UX; Firm triage, source evidence, approval clarity and trust vocabulary. Explicitly fix misleading 'Verified (not required)' label in a dedicated test-backed UI-003b.

ACCEPTANCE: baseline Playwright and Vitest green, zero critical/serious axe results on targeted routes (record exceptions), screenshot diffs approved, mobile reachable, no hard-coded authoritative finance math, no contract/permission changes. OUTPUT: two small PRs and before/after visual QA report with 320/390/768/1440 captures.
```

---

## E. Prompt 4 — DATA-003 and G3 security perimeter (after #10 merges)

```text
You are SageSpan's lead security/data engineer. Begin only after PR #10 (+ DATA-001/002) has merged and all five CI jobs pass on master. Use an independent branch and an expressly reserved migration number; no AI track may claim the same migration.

GOAL: production firm-side store (DATA-003), real scoped household reads/writes, private Supabase Storage with trusted byte hashing + registration, and member/consent management based on existing 0008 RPCs. The result stays synthetic-data-only until separate legal/ops G3 signoff.

Rules: signed-in user JWT for ordinary operations; no browser service-role key, no user-supplied org/workspace acting as authority. One trusted upload pipeline computes SHA-256 from actual received bytes, binds private object to tenant/workspace/document, controls MIME/size/malware risk, and registers immutable document metadata only after verification. Ensure deletion/expiry/revocation cannot leave download access. Every ADMIN/CCO/ADVISOR/VIEWER/OWNER/PARTICIPANT path must have both positive and negative RLS tests. Reconcile source-document and audit-chain transaction behavior. Do not weaken any 0005–0009 privileges. Add member invite/accept/revoke and purpose-limited consent expiry/revoke UX only after matching SQL tests. Include backup/restore, incident, retention, breach and key-rotation runbooks for deployed staging; no actual production customer import.

OUTPUT: bounded PRs DATA-003a (firm repo), DATA-003b (private storage), DATA-003c (consent UI); realstack tests with forbidden paths, threat model update, privacy/operational gate table, exact CI links. G3 remains open until independent deployed security/vendor/legal checks pass.
```

---

## F. Prompt 5 — SCENARIO-001 / PLAN-001 retirement engine (separate finance session)

```text
You are SageSpan's independent quantitative finance engineer. Implement only the first bounded annual retirement cash-flow illustration, not a regulated personalized recommendation system. Read V5 master source of truth §4, financial methodology, current calculator registry/contracts, retirement readiness intake and all relevant test goldens. Work from a clean branch once upstream data models stabilize. Do not modify Auth/RLS/AI/UI in this PR except typed contracts and a narrow demo consumption adapter.

Define a deterministic versioned Python Decimal annual projection method for a specified horizon, starting assets/as-of, nominal return assumption, inflation, fees, annual contributions, retirement age, annual gross spending and withdrawal ordering. Explicitly distinguish today's dollars vs nominal dollars; define timing conventions (start/end-year), compounding, rounding, missing inputs, overflow/negative/zero constraints and infeasible status. Avoid modeling SSA, tax, Roth, Medicare or Monte Carlo as facts; show clearly which have not been implemented. The first release is a gross-basis scenario illustration only.

Write hand-computed golden examples for accumulation, decumulation, early/late retirement, return shocks, zero growth, inflation, depleted assets, contribution changes, edge ages and cross-language receipt hash, including mutation and snapshot-bound replay tests. No financial computation in React or LLM. Add a compare-two-scenarios contract where both results cite their own engine runs and assumptions; no confident-looking trajectory with required inputs MISSING/CONFLICTING. Obtain named qualified reviewer signoff and counsel/marketing copy review before changing the release gate. Retire the 'no projection engine' placeholder only after tests and release approval.

OUTPUT: exact assumptions ADR, schema version, Python engine and golden tests, API schema+receipt, narrow TS contracts, UI demo adapter if in scope, FULL tests, FIN-VERIFY-001 signoff request and limitations card. Explicitly leave tax/SSA/Roth/Monte Carlo disabled.
```

---

## G. Suggested Claude Project instructions (compact evergreen core)

Paste this into your **Claude Project's project instructions**, not into a Code session transcript. It is the operating policy, not a build order:

```text
SageSpan V5 is one dual-market AI-native financial clarity and assurance platform: SageSpan Personal/Household (B2C) and SageSpan Advisor & Assurance (B2B), with a Retirement Studio shared across them. The five-stage lifecycle is Discover → Diagnose → Develop/Design → Review/Decide → Monitor.

Authority: latest explicit founder decisions and docs/product/SAGESPAN_V5_MASTER_SOURCE_OF_TRUTH.md define product scope; current committed code/PRs/CI determine what is actually implemented; CLAUDE.md defines repo operations. Historic reports never override current Git state. Preserve stricter legal, security, source integrity and financial correctness constraints. Treat every source report as dated evidence, not a completion certificate.

Technical spine: Next.js apps/web, Zod/TypeScript packages/contracts, Python FastAPI/Decimal services/calculator, Postgres/Supabase app schema, forward-only migrations, synthetic fixtures and audited receipts. Never add a second authoritative calculator or use LLM-generated financial math. Keep finance inputs, missingness, consent, record versions, receipt hashes, human approvals and data scopes explicit. Personal data never becomes firm data through membership alone.

AI may explain/compare/propose drafts from in-scope read-only tools, but may not verify facts, invent model quantities or citations, approve plans, change policy/consent, place trades, pay bills, or publish Tier 3 regulated advice. All user-visible narratives, including executive summaries and memos, must be grounded and validated. Models and source documents are untrusted. The system is synthetic-only until real-data G3 and qualified financial/legal G4 gates pass.

Working protocol: start every Claude Code session by inspecting Git status/branches/PRs and preserving founder files. One isolated worktree/branch per scope; reserve shared files and migration IDs centrally. Do not push to master, force-push, auto-merge, delete history or claim successful tests not run. Require evidence, explicit non-goals, positive and negative tests, CI URLs and a clear PR handoff. Current work includes PR-003/DATA-001/002 integration, AI-CORE runtime/hosted benchmark, UI-001 shells/accessibility, private storage, DATA-003 and PLAN-001. Verify live PR status before acting; these labels may age.
```

**Suggested sequencing in the founder's actual Claude workflows:** create one new **Claude Code session A** using Prompt B now. Keep the current Claude Project with the concise instructions in G and upload the audit bundle. When A produces an integrated SHA, start sessions B (AI) and C (UI) in separate worktrees; do not combine them into the A transcript. Use prompts E and F as later projects after prerequisite merges.
