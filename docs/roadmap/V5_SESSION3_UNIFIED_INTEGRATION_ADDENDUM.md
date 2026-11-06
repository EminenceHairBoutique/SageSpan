# SageSpan V5 — Unified Integration Addendum: Session 3 and Current Development Priorities

**Issued:** November 6, 2026  
**Purpose:** Update earlier V5 Blueprint, Claude Project Instructions, repository `CLAUDE.md`, engineering execution checklist, AI-CORE, AI Evaluation Plan, and UI/UX briefing **without replacing the existing source documents or overwriting working code**.  
**Source:** User-supplied `Pasted text(2).txt` — Session 3 Evaluation & Next Development Priorities, and connected GitHub verification on the same date.  
**Verified GitHub:** `EminenceHairBoutique/SageSpan`, `master` commit `52997912dba0b2d7188d29f73bc6df7253a00369` (documentation commit after functional `4da268f`); newest successful master CI `42207031870` at that head. Check again before using this as a coding authority.

## 1. Corrections that supersede earlier advice

Older SageSpan handoffs from Session 1 described PR-001 unmerged, the V5 feature branch not on `master`, PR-002 unstarted and `master` browser CI failing. **Those claims are outdated** in the current repository. The current verified state is:

| Delivery | Current status | Evidence |
|---|---|---|
| PR-001 trust-boundary hardening | **MERGED** | PR #5, merge `662d48a` |
| PERS-002 user record CRUD, first-run intake and what-if scenarios | **INTEGRATED** | PR #6 merged into V5 feature branch, then V5 PR #7 merged into `master` |
| V5 dual market B2C + B2B and mock AI foundation | **MERGED** | PR #7, merge `604a630` |
| PR-002 S-06/S-07/N-02, coverage+snapshot+retries | **MERGED** | PR #9, merge `4da268f`, SQL migration `0007_coverage_and_reproducibility.sql` |
| GitHub Actions `master` | **GREEN AS OF INSPECTION** | latest observed run `42207031870` on `52997912d` (all four required jobs green); preceding `42204127139` on `4da268f` also green |
| Historical evidence-export ECONNRESET | Earlier failed, current master green; **do not presume an unmerged fix PR was deployed** | PR #8 is CLOSED/NOT MERGED; recheck if symptom recurs instead of treating it as active release blocker without evidence |
| PR-003 real Supabase Auth/RLS/store/storage | **NOT IMPLEMENTED** | production `apps/web/src/auth/actor.ts` returns null; `FileStore` synthetic demo |
| Live AI model integration | **NOT IMPLEMENTED** | mock/scripted model provider only |
| Annual retirement projections | **NOT IMPLEMENTED** | readiness/intake page only |
| Real customer financial data / aggregators | **NOT ENABLED** | G3 not passed |
| Independent financial and legal signoff | **NOT DEMONSTRATED** | FIN-VERIFY-001, REG-001 open |

**CI result for Session 3:** 119 Python tests; 47 TypeScript contracts; 104 passing web tests with 2 skips; 16 Playwright tests; seven SQL test files on PostgreSQL + Supabase/pgTAP shims. These run totals are evidence from the reported/CI records, **not** proof of real Supabase Auth, JWT, PostgREST, Storage, policy validation or financial expert signoff. Record these categories distinctly. No one should derive release permission from raw test counts.

## 2. Program goal statuses — source-of-truth updates

### B2C Personal / Household
**Implemented as synthetic code:** consumer dashboard, a guided fresh workspace intake, add/edit/retire for accounts/income/obligations/spending categories/liabilities/goals, dated cash-flow outlook, debt comparison, scenario adjustments, constraints-first next steps, saved user decisions, learning modules, a readiness gate and mock AI financial explanations.

**Outstanding:** PR-003 production persistence; transaction-level ingestion, merchant/category normalization, duplicate/transfer/refund reconciliation, recurring-spend detection (PERS-003); budget and goals engine (PERS-004); debt affordability across cash-flow scenarios and dynamic promotional APRs; behavior-aware action planner (PERS-005); collaborative consent (PERS-006); connected accounts after G3; investment/net-worth education; user-controlled monitoring.

### B2C+B2B Retirement Studio
**Implemented:** intake/readiness and professional status landing. **Not implemented:** a complete year-by-year projection engine. Start PLAN-001 with a disclosed gross-basis deterministic model; independently test its assumptions before publishing future retirement amounts. Defer Social Security claiming, tax/Roth, Medicare, complex distributions and Monte Carlo to validated separate modules.

### B2B Assurance
**Implemented in synthetic tier:** evidence import → source reconciliation → frozen snapshot → deterministic RMD check → human review/approval → evidence packet, with PR-001 and PR-002 SQL integrity improvements. **Open:** real authenticated firm/CCO accounts, durable private source bytes, identity-bound consent, import adapters for supported real exports, named financial review, secure firm onboarding, real-stack privilege/tenant testing and operational audit.

### SageSpan Intelligence
**Implemented:** scoped evidence context, read-only tool dispatcher, mock/scripted providers, versioned AI results, invalid-citation/amount/status rejection, AI-E01…AI-E28. **Open:** genuine bounded model-tool-model iteration, live provider on synthetic data, retrieved and reviewed financial knowledge, formal evaluation plan/human scoring, customer data processor review, calibrated scenario-ranking, optional self-hosted and later fine-tuned model evaluation.

### UI/UX
**Implemented:** basic dual-market navigation and navy/teal theme. **Open:** professional design-system execution, consumer regrouping into Home / My Money / My Plan / Guidance, visualized source/assumption/uncertainty, efficient advisor workflow, mobile/keyboard/accessible interactions, clear differentiation of verified results vs `REVIEWED_WITH_LIMITATIONS`.

## 3. Critical engineering findings carried forward

The following are not new PR-002 blocker findings unless tests demonstrate current failure. They require regression and documentation:

1. **Canonical latest-attempt ordering:** TypeScript and SQL can disagree on identical timestamps if one relies on insertion order and the other UUID ordering. Define a persistent monotonically increasing attempt sequence or a single deterministic total order and test both tiers on identical fixtures, including concurrent inserts. Ensure AI's evidence resolver and packet generator use the same interpretation.
2. **Freeze the calculation assumptions, enforce current authorization:** Snapshot inputs/tolerance policy must remain immutable for receipt replay; roles, consent revocation and permitted approvers must be checked *at the time of a new action*. Distinguish historic calculation policy from live access policy explicitly in ADR/tests.
3. **Approved review with limitations ≠ verified coverage:** The UI, evidence packet, API and AI review must show `REVIEWED_WITH_LIMITATIONS` prominently, even if a human signed a bounded review. Never style this as an unqualified green verification.
4. **Debt affordability:** Amortization success does not prove household affordability; verify extra payments against current and dated future cash buffers, essential bills, income uncertainty, user floor and existing commitments. Separate same-budget strategy ordering from “minimums versus paying more” comparisons. Promotional APR order and expiration need independent golden cases.
5. **Money/date provenance:** Need explicit planning as-of anchor, freshness and snapshot replay, not a silently inferred old date. Unsupported/unknown data remain non-results, not zero or green.
6. **No production readiness from SQL shims:** Required real Supabase Auth/JWT/PostgREST/Storage/RLS adversarial test matrix must pass. No file-backed demo actor may authorize production financial access.

## 4. New priority stack and parallel development constraints

| Sequence | Work package | Scope and release conditions |
|---|---|---|
| 0 | Baseline check | Verify `master` and CI; update feature matrix + `CLAUDE.md` historical status, not regenerate old failures |
| 1 | **PR-003A** | Identity, personal/household/firm schema, trusted server session, forward-only SQL migration |
| 2 | **PR-003B** | RLS, memberships, grant purpose/expiry/revocation and denial tests |
| 3 | **PR-003C** | Persistent domain repositories, private storage, server-computed document hashes, event/audit provenance |
| 4 | **PR-003D** | Actual Supabase stack from clean migrations, JWT/PostgREST/Storage adversarial tests, backup/restore |
| 5 | PERS-003/004 | Transaction reconciliation, categorized budgeting, goal pacing, recurring detection on synthetic data first |
| 6 | FIN/PLAN | Debt feasibility and projection model benchmark with a qualified review; PLAN-001 annual retirement |
| 7 | AI-CORE-000/001 | New `AI_EVALUATION_PLAN.md`, multi-turn tool loop with synthetic tests, no authority mutation |
| 8 | AI-CORE-002 onward | Hosted model synthetic benchmarking, knowledge retrieval, compare open-weight models, governed fine-tune experiment only if evidence justifies |
| 9 | UI-000…005 | Separate design branch; preserve contracts and receipt/status semantics; can start now in parallel |
| 10 | Controlled beta/GA | Explicit G3 real-data, G4 financial/legal, G5 pilot and operational signoffs |

**Scheduling:** PR-003A/B is the top critical path. UI-000/001 and AI-CORE-000 plus mock-only AI-CORE-001 can safely progress in separate branches against synthetic data. Do not combine DB migrations, production auth, live AI, and UI redesign in one PR. Coordinate conflicts in shared Zod contracts, actor resolution, AI evidence resolver and UI components.

## 5. Exact changes to authoritative existing files

### `CLAUDE.md` (repo root)
- Keep V5 B2C+B2B and existing engineering invariants.
- Replace the outdated “PR-002 remains outstanding” implementation status with **PR-002 merged** and migration 0007, distinguishing merged code from real-stack security validation.
- Record latest `master` SHA/CI as dated evidence only; require every coding session to recheck Git.
- Add `docs/ai/AI_EVALUATION_PLAN.md` to the reference hierarchy; its existence should not be implied until actually copied into GitHub.
- Add canonical retry tie-break, snapshot policy vs live permissions, and review-with-limitations display to regression concerns.

### `docs/product/SAGESPAN_V5_MASTER_SOURCE_OF_TRUTH.md`
- **Do not rewrite the V5 product vision.** Append a dated implementation-status addendum or point to this document to avoid mistaking roadmap goals for completed capabilities.
- Update B2C PERS-002 and PR-002 as delivered only in synthetic/code tiers.
- Preserve G3/G4 release gates and financial/regulatory constraints. Retirement projections, live AI, bank aggregation remain unimplemented.

### `docs/requirements/SAGESPAN_V5_TRACEABILITY.md`
- Set PR-002 S-06/S-07/N-02 to **implemented + CI-tested on shim**; keep real Supabase validation open. Trace tests and migration 0007 by file path.
- Add follow-up IDs for canonical latest-attempt ordering, limited approval labeling and current auth vs frozen calculation assumptions.

### `docs/roadmap/*`
- Replace “reconcile V5 unmerged branch / restore failing CI” as current top task with PR-003A/B/C/D. Preserve old audit history as dated observations, not current blockers.
- Move PERS-002 from “build next” to “integrated”; move PERS-003/004/005 and PLAN-001 into next product milestones.

### `docs/ai/*`
- Preserve existing `AI_EVAL_MATRIX.md` as **current offline case inventory** and put the new `AI_EVALUATION_PLAN.md` next to it for full live-model/fine-tuning validation.
- The AI-CORE master prompt must reference the new plan, PR-002's merged semantics, PR-003 as a hard dependency for real data, and an explicit no-external-financial-records-before-vendor-permission instruction.

### `docs/design/*`
- Keep premium navy/teal design and consumer/firm separation. Add explicit `REVIEWED_WITH_LIMITATIONS` and live data completeness/consent state UI. Incorporate new first-run intake and scenarios already working; do **not** schedule them as brand-new screens.
- Group consumer nav; give professional reviewer source/coverage details and explicit authorization/approval stages.

### Claude Project Instructions and Knowledge
- Keep the full V5 product governance in Project Instructions; update the **current status paragraph** but avoid stuffing multi-thousand-word code prompts into persistent instructions.
- Upload the new `AI_EVALUATION_PLAN.md` and this addendum into Claude Project Knowledge alongside existing AI, design, finance and security docs.
- Claude Code reads **repo-local** source documents; knowledge uploads alone are not guaranteed to appear in its working tree.

## 6. Acceptance and non-negotiable release boundaries

Do not enable real data because `master` is green: PR-003 must prove real-stack tenancy, current permission enforcement, consent/revocation, privacy and source-byte provenance. Do not make assurance/compliance claims without independently evaluated model and qualified professional signoff. The true value is transparent, realistic financial decisions; a successful mock-AI or synthetic simulation is not proof that SageSpan can safely advise or manage money.

**Founder decision recommended:** Approve PR-003A/B/C/D as the primary engineering program, with synthetic AI-CORE and UI-000/001 in isolated parallel branches. Keep personalized securities recommendations and money movement disabled until separate legal approvals and product decisions.

## 7. Live verification references

- PR #5: https://github.com/EminenceHairBoutique/SageSpan/pull/5
- PR #6: https://github.com/EminenceHairBoutique/SageSpan/pull/6
- PR #7: https://github.com/EminenceHairBoutique/SageSpan/pull/7
- PR #9: https://github.com/EminenceHairBoutique/SageSpan/pull/9
- Latest observed successful CI: https://github.com/EminenceHairBoutique/SageSpan/actions/runs/42207031870
- Prior successful functional master CI: https://github.com/EminenceHairBoutique/SageSpan/actions/runs/42204127139
- `AI_EVAL_MATRIX.md`: https://github.com/EminenceHairBoutique/SageSpan/blob/master/docs/ai/AI_EVAL_MATRIX.md

**Status:** This addendum is a dated integration instruction. It does not itself change the remote repository, perform Supabase testing, or authorize real customer financial data.
