# SageSpan V5 — Session 3 Unified Integration and AI Evaluation Package

**Prepared:** November 6, 2026. This package integrates the user's Session 3 assessment with the existing V5 and AI-CORE plans. No remote GitHub files were modified in creating this package.

## Key changes in one minute

- PR-001 (#5), V5 dual-market (#7), PERS-002 (#6 via V5), and PR-002 (#9) are now **merged/integrated**. Migration 0007 exists. The inspected `master` head was `52997912dba0`; latest inspected master CI run `42207031870` **succeeded**.
- The older “V5 unmerged / PR-002 outstanding / failing CI” instructions are **outdated**. PR #8 is closed but not merged; do not claim it fixed the earlier ECONNRESET in `master` without analyzing actual commits.
- **PR-003A/B/C/D** (Supabase Auth, workspace schema, consent/RLS, trusted storage/persistence, real-stack tests) is the current production engineering priority. No real customer data yet.
- Existing AI is **mock/scripted**, with 28 named offline evaluation cases + 2 consumer cases. The new evaluation plan specifies proper real model benchmarking, fine-tuning gates and dataset governance.
- Guided first-run intake and what-if scenarios are **already implemented in the synthetic tier**; work next on transaction/spending intelligence, budgeting and verified retirement projections.

## Files and exact destination

| Package file | Destination / action |
|---|---|
| `docs/ai/AI_EVALUATION_PLAN.md` | **Add as new file** `SageSpan/docs/ai/AI_EVALUATION_PLAN.md`; keep `AI_EVAL_MATRIX.md` beside it |
| `docs/ai/SAGESPAN_AI_CORE_FABLE_5_1_MASTER_PROMPT_UPDATED.md` | Review then replace earlier `docs/ai/SAGESPAN_AI_CORE_FABLE_5_1_MASTER_PROMPT.md` with its full contents (rename after backing up existing) |
| `docs/prompts/SAGESPAN_AI_CORE_FABLE_5_1_FIRST_SESSION_UPDATED.md` | Use as **Claude Code task** when developing AI-CORE-000/001 on synthetic-data branch |
| `docs/prompts/SAGESPAN_V5_SESSION4_PR003A_B_C_D_MASTER_TASK.md` | Use as **Claude Code priority task** for PR-003A; plan later subphases, don't implement all at once |
| `docs/roadmap/V5_SESSION3_UNIFIED_INTEGRATION_ADDENDUM.md` | Add under `docs/roadmap`; use to update dated status in V5 source truth, traceability, checklist and root CLAUDE.md |
| `docs/design/V5_SESSION3_UI_UX_DESIGN_ADDENDUM.md` | Add under `docs/design` beside existing UI/UX master brief |
| `docs/project/CLAUDE_PROJECT_INSTRUCTIONS_V5_SESSION3_UPDATED.md` | Paste this *full replacement instruction text* into the Claude **Project Instructions** tab after comparing with custom local additions; upload supporting docs into Project Knowledge |
| `README_START_HERE.md` | Read before changing anything; note this is a specification/documentation package, not code |

## Root CLAUDE.md, V5 Source of Truth and requirements

Their full existing content is in the repository, not repeated here. **Do not overwrite them blindly.** Use `V5_SESSION3_UNIFIED_INTEGRATION_ADDENDUM.md` to update the implementation-status paragraphs while retaining repository-specific commands, security invariants, product specs, traceability and historical reports. A status addendum is safer than fabricating or reconstructing a purportedly identical master document.

Recommended merge:

1. Check `git status`, `git log -5 --oneline`, current open PRs and CI. Do not overwrite uncommitted files.
2. Copy files into folders above on a documentation-only branch. Update older dated status language in root `CLAUDE.md`, V5 docs and checklist; preserve the original files in Git history. No force-push and no applied migration changes.
3. Run appropriate documentation/link checks; inspect `git diff --check` and review changes. Commit documentation separately from executable AI/SQL changes.
4. Paste the revised Project Instructions into Claude Project. Upload `AI_EVALUATION_PLAN.md`, the V5 addendum and updated AI master as project knowledge. Project Knowledge is not a substitute for repository-local files in Claude Code.
5. **Claude Code priority:** `SAGESPAN_V5_SESSION4_PR003A_B_C_D_MASTER_TASK.md` (starts with PR-003A only). AI-CORE first session and UI-000 can happen on separate branches with synthetic-only data.

## Evidence guardrails

A green CI job means certain tests passed, **not** that: real Supabase Auth/JWT/PostgREST/Storage/RLS works; a language model is financially reliable; private financial data can be collected; or SageSpan can make regulated personalized investment recommendations. All those require separate gates and named review.

The standalone `AI_EVALUATION_PLAN.md` was created in this package because earlier folder diagrams listed it as a **future file**, not one that previously existed in GitHub. It is ready to add to `docs/ai/`.
