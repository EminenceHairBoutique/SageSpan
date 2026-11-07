# SageSpan V5 — Independent Repository Audit and Integration Roadmap

> **Reconciliation note (2026-11-06 evening, integration coordinator session):** this bundle is the founder-supplied independent audit (prepared outside the repository from the GitHub API at ~18:57 ET, `master` @ `e0d2f63`). It is preserved verbatim as dated evidence. Its "current state" rows predate the merges done the same evening (#10 PR-003/DATA-001/DATA-002 → #13 AI-CORE-001 → #16 AI-CORE-002a, then #18 AI-SEC-001). Each code-level finding was re-verified against the source and its disposition is recorded in `docs/engineering/V5_SESSION_7_BASELINE_RECONCILIATION_REPORT.md` §4 (P0 AI-SEC-001 **confirmed and fixed in #18**; P1 two-step save/refresh **confirmed, partly mitigated by snapshot-bound runs**; P1 render-time refresh **confirmed**; P1 synchronous `reauthorize()` **confirmed**; P1 in-process hosted budgets **confirmed**; P1 unprotected `master` **reported, not verifiable with the session token**). The operating model in `04_CLAUDE_CODE_NEXT_PROMPTS.md` §A was adopted by the founder and is codified in `docs/project/SESSION_OPERATING_MODEL.md`; its INT-001 prompt was executed by this session; the remaining prompts are superseded by the post-merge versions in the reconciliation report §7.

**Audit cut-off:** November 6, 2026 (current GitHub snapshot, approximately 18:57 New York time)  
**Repository:** https://github.com/EminenceHairBoutique/SageSpan  
**Default branch:** `master` @ `e0d2f63722ec7659076a5d9c789d2fb58d9aab13`  
**Evidence reviewed:** all 17 PRs, all 14 remote branches, recursive default-branch tree (586 entries; 463 files), the main and selected feature-branch source code, CI history/jobs, and five supplied Claude report files.  
**Access limitation:** this is a source/PR/CI evidence audit via the GitHub connector, not a fresh local build or live deployed penetration test. The sandbox cannot resolve GitHub for cloning; all test-pass claims cite observed GitHub Actions or Claude's supplied reports. Screenshots are indexed in the repository but were not independently pixel-reviewed in this environment. No production system, customer account, database or model service was accessed.  
**Release classification:** SYNTHETIC / NOT PRODUCTION READY.

## 1. Executive verdict

SageSpan is a technically meaningful dual-market financial clarity and assurance platform, not an empty mockup. Its strongest foundations are the deterministic Python calculator, shared typed contracts, bounded financial decision policy, B2B import/reconcile/freeze/check/review/approval/evidence demo, B2C manual records/debt/cash-flow demos, separated human approvals, and evidence-based AI draft validation. The significant remaining distance is *integrated real-data reliability, secure production operations, annual retirement modeling, and independently verified financial/regulatory scope*. Do not equate a green synthetic CI check or an unmerged branch with a launch-ready product.

**Next action:** resolve the current PR #10 conflict with `master`, test the combination of UI-001a and PR-003/DATA-001/DATA-002, bring the `realstack` job into `master`, then merge and test PR #13 AI runtime and the stacked draft PR #16. Do not start new broad rewrites in the meantime.

## 2. GitHub facts verified

- Repository is publicly visible (`private=false`) and has default branch `master`.
- `master` HEAD `e0d2f637` includes UI-001a via PR #17. GitHub Actions run **42311019916** passed **calculator, database, web and e2e**: https://github.com/EminenceHairBoutique/SageSpan/actions/runs/42311019916.
- `master` currently has **7 migrations** (`0001`–`0007`); its production actor `getProductionActor()` returns `null`, and `/app` renders `ProductionGate`. The old `FileStore` is explicitly synthetic and uses local files; it is unsuitable as real production durable storage.
- There are **17 PRs**: **13 merged**, **3 open** (#10, #13, #16), **1 closed unmerged** (#8). PR #16 is a draft.
- PR #10 head `a269d0b` is reported by GitHub as **mergeable=false, mergeable_state=dirty** against current master. Exact conflict hunks require Git checkout to resolve; do not invent a file-level diagnosis from metadata.
- PR #13 head `e4256aa` is currently mergeable (`mergeable_state=clean`). PR #16 head `2ec28fa` is clean relative to its *parent branch* #13; it must not be treated as already integrated into master.
- PR #12 DATA-001 and PR #15 DATA-002 were merged into **the PR #10 branch**, not into `master`. PR #15 branch and PR #10 head carry the `0009` personal computed-layer migration and production personal screens.
- GitHub lists `master` as **unprotected**. Set branch rules before using the repo for a production-sensitive service.
- PR #8 was closed without a merge, but the `page.request.get(..., {maxRetries: 2})` fix is **already in master** (it was carried by another branch); no duplicate PR is required.
- `docs/legal/FEATURE_RELEASE_GATES.md`, `supabase/README.md`, `README.md` and the V5 feature matrix contain **dated branch-specific or historical statuses**; the live PR graph is more current. Correct these documents in a dedicated status/docs step.

## 3. All 17 pull requests — reconciliation

| # | Purpose | GitHub status on audit cut-off | Integration implication |
|---|---|---|---|
| 1 | CI + Postgres SQL/RLS shim test runner | Merged into master | Existing test infrastructure |
| 2 | Coverage-status labeling and dialog portal | Merged | Do not repeat |
| 3 | Remove third-party product screenshots | Merged | Images may remain in Git history; do not claim history sanitized |
| 4 | Add Playwright CI, Postgres 15 | Merged | Master CI contains these jobs |
| 5 | PR-001 S-01–S-05/N controls | Merged | Preserve hardening |
| 6 | PERS-002 record intake + what-if | Merged into dual-market feature branch | Integrated through #7 |
| 7 | V5 dual-market app, engines, AI mock | Merged into master | Primary dual-market foundation |
| 8 | E2E ECONNRESET regression fix | Closed without merger | Exact fix exists in master; no rework |
| 9 | PR-002 coverage, frozen request v2 and retry | Merged into master | Migrations `0007` and semantics active |
| 10 | PR-003 identity + real Supabase test | **OPEN — DIRTY/CONFLICTING** | Top priority; now also includes #12 and #15 |
| 11 | PR-002 policy hash and canonical fixtures | Merged into master | Preserve canonical hashes |
| 12 | DATA-001 personal Supabase adapter | Merged into #10 branch | Not independent master release |
| 13 | AI-CORE-001 bounded tool loop | **OPEN — CLEAN** | Integrate after data branch reconciliation |
| 14 | UI-000 UI/UX audit/docs | Merged into master | Design system reference |
| 15 | DATA-002 personal snapshots/runs/atomic RPC | Merged into #10 branch | CI tested, not yet default branch |
| 16 | AI-CORE-002a Anthropic adapter skeleton | **OPEN DRAFT** against #13 | Offline only; no live benchmark |
| 17 | UI-001a design tokens/primitives | Merged into master | Latest default-branch UI changes |

Reference: https://github.com/EminenceHairBoutique/SageSpan/pulls?q=is%3Apr

## 4. All 14 remote branches — disposition

| Branch | Live disposition | Recommended handling |
|---|---|---|
| `master` | Default integration branch, latest UI-001a | Protect; test after integrating #10 |
| `feat/pr-003-identity` | Active PR #10, conflicting, includes DATA-001 and DATA-002 | Preserve, reconcile and merge |
| `feat/ai-core-001-runtime` | Active PR #13, clean, runtime | Preserve, merge only after integration tests |
| `feat/ai-core-002a-hosted-adapter` | Draft PR #16 stacked on #13 | Keep draft until vendor benchmark and parent merge |
| `feat/data-001-store-adapter` | Historical child, #12 merged into #10 | Archive/delete only after #10 verified |
| `feat/data-002-personal-runs` | Historical child, #15 merged into #10 | Archive/delete only after #10 verified |
| `feat/pers-002-intake` | Feature integrated via #6/#7, historical divergent Git ancestry | Verify then archive |
| `feat/pr-002-coverage` | Fully behind master | Archive after retention check |
| `feat/v5-dual-market` | Fully behind master | Archive after retention check |
| `ci/e2e-job-and-pg15` | Historical PR #4; divergent ancestry | Compare code before deletion; already integrated logically |
| `claude/brave-gates-2b1262` | PR #11, fully behind master | Archive after verification |
| `claude/nice-kapitsa-6ae656` | PR #14 history, small divergence in docs | Preserve any accepted design-v1.1 record then archive |
| `fix/e2e-evidence-export-keepalive-reset` | PR #8 closed without merge; patch present in master | Do not merge duplicate; can archive |
| `fix/web-coverage-label-and-dialog` | PR #2 history, divergent ancestry | Compare then archive |

**Caveat:** A branch may report one or more commits “ahead” merely because of squash/cherry-pick ancestry even when its feature is already present. Compare actual trees and PR merge provenance before deleting branches. Do not force-push, reset or alter the founder's uncommitted files.

## 5. Architecture and implementation by subsystem

### Frontend / product

- Next.js App Router + strict TypeScript, shared `packages/contracts` Zod contracts, Tailwind and modular UI components.
- Marketing: public landing, `/personal`, `/retirement`, `/firms`, `/how-it-works`, `/security`, `/pricing`, `/demo`.
- B2C synthetic: `/demo/personal`, manual records/intake, cash flow, spending, savings/debt, goals, retirement readiness, scenarios, AI assistant, education, privacy.
- B2B synthetic: `/demo/app` and household routes, import/reconcile/freeze, check/receipt, review/approval, JSON/HTML/CSV packet.
- Production: `/app` is gated in master. PR #10 adds Supabase sign-in, session resolution, production Personal workspace, `/app/personal` and append-only computed results; it does not provide production B2B workflows.
- UI-000 (PR #14) produced an extensive visual audit and design spec; UI-001a (PR #17) implemented shared tokens, accessible focus, status chips, dialogs and some primitives. Remaining shells, navigation, adoption and WCAG automation are separate milestones.

### Deterministic finance

- Python/FastAPI service with Decimal arithmetic, published versioned rule-set registry, request hashes, receipt schemas and golden cases.
- RMD assurance: scoped 2026 living-owner traditional IRA case. Special cases are explicitly UNSUPPORTED instead of extrapolated.
- Personal: `personal.cashflow_baseline@2026.1`, `personal.debt_amortization@2026.1`, bounded cash-flow what-if `personal.cashflow_scenario@2026.1`, provenance/cash-floor checks, data quality and a deterministic decision policy with a maximum of three primary actions.
- Goal **records** and policy suggestions exist; a complete goal-funding allocation/optimizer should not be marked complete.
- Retirement Studio **readiness intake** exists; the annual PLAN-001/SCENARIO-001 engine, Social Security/tax/Roth/Monte Carlo modules do not.
- Engineering tests are not external professional financial-rule validation. FIN-VERIFY-001 remains open.

### Data/security

- Master has RLS/workflow migrations `0001`–`0007`; immutable snapshots, workflow-owned columns and receipts and per-account coverage controls.
- PR #10 adds `0008` identity/consent/personal tables, actor resolution through server-verified Supabase Auth and user JWT, PostgREST under RLS, purpose-limited revocable permissions and event log. The realstack CI harness exercises stranger/participant/grantee refusal and revocation.
- DATA-002 adds `0009`, calculated snapshots/runs/decisions, verification shape constraints and `apply_personal_changes` atomic database RPC.
- This is **not** deployed project validation. Remaining: firm `DATA-003`, private source document bytes/trusted registration, consent/member UI, deployed key/backup/rate/incident operations, actual consent/vendor contracts.

### AI

- Master AI-000/001: offline mock, evidence resolver, allowlisted reads, output validator, 28 labeled AI-E cases + two personal cases and human feedback.
- PR #13 AI-CORE-001: bounded 2-turn+ runtime, tool result continuation, per-call reauthorization, strict args, budgets, digest-based traces, abstention, 17 AI-C tests.
- PR #16 AI-CORE-002a: Anthropic Messages adapter behind multiple synthetic-only environment gates; 10 offline AI-H tests, **no live call or model-quality evidence**.
- No persistent production AI run store, production reauthorization integration, cross-instance metering, DPA, live evaluated model, proprietary trained weights, fine-tune or self-hosted inference.

## 6. Important code-level findings (verified by source inspection)

**P0 / AI grounded narrative:** `apps/web/src/ai/result-validator.ts` checks `MONEY_IN_TEXT` within each individual finding's title/explanation/next action, but `summary`, `draft_memo` and `questions` are subsequently copied into the report after length and injection checks rather than the same amount/evidence validation. A forged amount in a top-level memo may pass a validator designed to protect findings. The broader “no invented amount” marketing claim is unsafe until the entire rendered narrative is checked. Add adversarial cases with `$999,999.00` in each non-finding field, an unsupported PASS/approved assertion, a false citation, and a mismatched figure; expect REJECT or deterministic removal with a logged issue. Test both mock-scripted and hosted-structured output.

**P0 / real-data security:** No full private storage, trusted document registration, firm repository or deployed environment hardening. No genuine consumer data or hosted-model real data until G3 requirements are evidenced.

**P1 / cross-RPC atomicity:** In `apps/web/src/server/app-personal-actions.ts` (PR #10), `appSaveRecordAction` calls `await repo.mutate(...)` and then `await refreshBaseline(repo, {force:true})`. DATA-002's RPC guarantees that *one mutate* is atomic; it does **not** make both operations or the outbound calculator call one transaction. If refresh fails, the edited records may remain committed; label any previous computed result by old snapshot and visibly mark it stale. Prefer outbox/job + idempotent completion or another explicitly versioned computation protocol.

**P1 / render side effects:** `/app/personal` in PR #10 initiates `refreshBaseline(repo)` during server page rendering for owners; it can result in reads plus calculation and writes on GET. Use an explicit refresh action or idempotent server-side orchestration triggered by changes; bound work, dedupe and use a fresh/stale/recomputing status. Test concurrent reloads, calculator outage and session expiry.

**P1 / model tool-loop production seam:** PR #13 `runToolLoop` takes a *synchronous* `reauthorize()` and `runPersonalUnderstand`/`runFirmAnalyzePlan` read/persist a synchronous `Store`. Production Supabase/identity are asynchronous; the AI-only branch cannot merely be flipped to production. Build an async resolver/repository interface with real RLS under the caller's JWT, event-version checking and production `ai_runs` append-only rows before enabling it.

**P1 / model budget durability:** PR #16 `HostedProvider` uses in-process `tokensSpent` and `runsByScope: Map`. These are reasonable synthetic-test safety brakes but not global enforcement across serverless instances or process restarts. Before scaling, enforce persistent per-actor/workspace/model quotas, spend limits, reservation and reconciliation, vendor timeouts, alerts and fail-closed policy.

**P1 / branch governance:** GitHub identifies unprotected master; no recorded human review was returned for open #10/#13/#16. Require PR review, checks, no force-push, protected main, scoped token permissions and secret/dependency scanning appropriate for a public codebase.

**P1 / status documentation:** README/supabase README/legal release gates still report historical no-realstack/no-PR-002 states. Record master SHA, open PRs and gate results in a current `docs/project/IMPLEMENTATION_STATUS.md`, and update docs on merge, not separately from tested code.

**P2 / CI reproducibility:** Master workflow lacks `realstack` (exists on #10); UI contrast is a local script rather than mandatory CI; `supabase/setup-cli@v1` with `version: latest` on feature branch is not reproducibly pinned. Pin versions after compatibility review; add automated axe/visual baseline, nightly matrix, test artifact retention and one full integration pipeline.

**P2 / UI trust vocabulary:** PR #17 deliberately defers unified “Verified (not required)” / PASS labels to UI-003b; this is potentially misleading. Keep arithmetic PASS, source verification and professional approval visibly distinct.

**P2 / public repo hygiene:** Some former third-party screenshot blobs remain in Git history according to PR #3; review licensing, secrets and fixture content before expanding contributors/marketing. This is not evidence of a leaked secret.

## 7. Test evidence and what it does not prove

| Source/revision | Observed evidence | Boundaries |
|---|---|---|
| Main `e0d2f637`, Actions 42311019916 | Calculator, web, database, E2E all green | No `realstack` in master CI |
| PR #10 `fa2669b`, Actions 42209646148 | pgTAP 251/251, GoTrue/JWT/PostgREST harness 50/50 | Disposable local CI Supabase, not deployed |
| PR #15 Actions 42241527406 and 42243091909 | 5 green jobs; pgTAP 310/310, JWT harness 59/59, repository realstack 4/4 on 42241527406 | Tested child PR revision, not the final master merge |
| PR #13 Actions 42239336974 | Calculator/web/database/E2E green; supplied report cites 51 contracts / 122 web / 119 Python / 16 E2E in earlier session | Offline mock runtime; no deployed RLS integration |
| PR #16 Actions 42241633011 | Overall run successful per listing; supplied report cites 53 contract / 133 web, 1 skipped / 7 scoped E2E | Adapter mocked; live benchmark skipped |
| PR #17 Actions 42245036273, and main after merge | Green; supplied PR body reports contrast 31/31 and local 193 web tests post-reconciliation | UI-001a, not whole-site accessibility certification |

An intermittent `ECONNRESET` had already been investigated and fixed with a narrow Playwright request retry; the patch exists in master. Avoid blanket retries or rewriting application logic for that resolved symptom.

## 8. Recommended integration and feature order

1. **INT-001 / PR #10 conflict and regression:** clean isolated checkout, preserve untracked local files, merge latest master into PR #10, resolve conflicts without erasing UI-001a or migrations 0008/0009, run all tests including realstack, document changed acceptance criteria, merge to master. Update status/readmes after merge.
2. **SEC-001 / private personal-data readiness:** require review of SECURITY DEFINER/RLS scope, privilege inventories, consent/member actions, secure session refresh, trusted document storage, audit/event integrity, backup and incident procedures. Finish firm-side `DATA-003` separately. Do not mark G3 passed just because PR #10 is merged.
3. **AI-INT-001:** align PR #13 to new master; address the narrative validator weakness; verify `AI-E01…E28`, `AI-C01…C16`, real JWT/data revocation, no unauthorized data; merge mock tool-loop runtime only.
4. **AI-CORE-002b:** resolve founder vendor/model/data-processing decisions, retarget #16 to master, run live benchmark **only on allowed synthetic fixtures**, review structured-output correctness, cost, quality, hallucination and citations. Leave live mode default-off. Move limits to durable storage before shared production deployment.
5. **UI-001b/001c and UI-002/003:** navigation/shells/density/mobile, accessible status language, axe + visual testing, full page adoption and real sign-in flows. Avoid changing financial calculations in UI PRs.
6. **PLAN-001 / SCENARIO-001:** independent annual retirement model, typed input completeness, deterministic Decimal engine, versioned assumptions, separately signed-off golden cases, unsupported statuses, audited comparisons; no taxes/SSA/Monte Carlo invented until separately released.
7. **IMPORT-001 / EXPORT-001:** two genuine documented third-party file maps (fixtures with rights), line/row evidence references, secure source-byte registration, PDF packet with manifest/hash verification, retention/export/deletion plan.
8. **OPS / G4 / G5:** operational observability, rate limits, model/version rollbacks, deployment staging, qualified financial-methodology sign-off, counsel feature perimeter, accessibility and controlled pilot with outcome metrics.

## 9. Release gates

- **G0 synthetic:** credible and repeatable; ongoing regression gate.
- **G1 trust remediation:** code merged; further integrated validation required; do not assert all deployment controls complete.
- **G2 coverage/reproducibility:** implemented in master; must be retested in latest realstack combination.
- **G3 real data:** **OPEN** (not enough identity + private storage + deployed ops + legal/vendor consent).
- **G4 financial/professional:** **OPEN** (FIN-VERIFY-001 and REG-001).
- **G5 controlled launch:** **NOT STARTED**.

## 10. Operating model for Claude Code

Use **one Claude Project** for the product source-of-truth, decisions and high-level context, but **multiple short-lived, isolated Claude Code sessions** for distinct development work. Keep a single integrator/coordinator session, and at most two scoped feature sessions with disjoint file ownership. Each session gets its own Git worktree, short contract, tests and draft PR. Avoid one giant never-ending session or multiple sessions writing `CLAUDE.md`, `.github/workflows/ci.yml`, migrations or shared UI primitives simultaneously. Reserve migration numbers centrally: `0009` belongs to DATA-002; historical AI-track plans mentioned `0010+`, but any new AI or DATA-003 migration needs an explicit unique allocation. Share decisions through committed ADR/STATUS files, not chat history alone. See `04_CLAUDE_CODE_NEXT_PROMPTS.md`.

## 11. Source references

- Master: https://github.com/EminenceHairBoutique/SageSpan/tree/master
- PR #10: https://github.com/EminenceHairBoutique/SageSpan/pull/10
- PR #13: https://github.com/EminenceHairBoutique/SageSpan/pull/13
- PR #16: https://github.com/EminenceHairBoutique/SageSpan/pull/16
- PR #17: https://github.com/EminenceHairBoutique/SageSpan/pull/17
- CI latest: https://github.com/EminenceHairBoutique/SageSpan/actions/runs/42311019916
- Realstack for DATA-002: https://github.com/EminenceHairBoutique/SageSpan/actions/runs/42241527406
- UI design: `docs/design/UI_000_DESIGN_AUDIT.md`, `UI_001_DESIGN_SYSTEM_SPEC.md`, `UI_000_IMPLEMENTATION_ROADMAP.md`
- AI evaluations: `docs/ai/AI_EVAL_MATRIX.md`, `docs/ai/AI_EVALUATION_PLAN.md` and (branch #13) `docs/ai/AI_CORE_FEATURE_STATUS.md`
- User-provided Claude files: CI_E2E_ECONNRESET_AND_BRANCH_RECONCILIATION, V5_SESSION_4_PR_003_REPORT, V5_SESSION_5_AI_CORE_001_REPORT, V5_SESSION_6_AI_CORE_002A_REPORT, V5_SESSION_6_DATA_002_REPORT (all dated 2026-11-06).
