# Installing the merged SageSpan V5 CLAUDE.md

This package includes:

- `CLAUDE.md` — the recommended **new repository-root** Claude Code instructions, merged with the user's existing V3 engineering record and V5 project vision.
- `docs/history/CLAUDE_V3_ENGINEERING_RECORD_2026-11-05.md` — an **unchanged copy** of the original uploaded CLAUDE.md for detailed milestone history, command notes, test counts and original architecture decisions.

## Do this in your local SageSpan repository

1. Make sure you are working in the correct repository and check `git status`. Do not overwrite uncommitted work.
2. Back up the existing root `CLAUDE.md` before replacing it.
3. Copy this package's `CLAUDE.md` to the root of SageSpan.
4. Copy `docs/history/CLAUDE_V3_ENGINEERING_RECORD_2026-11-05.md` to the same relative path in the repository. This preserves the exact original content.
5. Ensure the V5 files exist at:
   - `docs/product/SAGESPAN_V5_MASTER_SOURCE_OF_TRUTH.md`
   - `docs/engineering/SAGESPAN_V5_ENGINEERING_PROMPT.md`
   - `docs/requirements/SAGESPAN_V5_TRACEABILITY.md`
6. Review `git diff` before committing. A documentation-only commit such as `docs: merge V5 dual-market direction into Claude instructions` is appropriate.
7. Ask Claude Code for **repository reconciliation first**, not an automatic full-platform implementation.

## What changed in the new root document

- Replaces V3's B2B-only positioning with B2C + B2B.
- Keeps Next.js, Zod, Supabase, `services/calculator`, financial-methodology, RLS, audit, test and CI conventions.
- Explicitly distinguishes the historical PR-001 branch from merged/deployed production state.
- Preserves real Supabase validation and PR-002 as release blockers unless new code verifies otherwise.
- Adds V5 AI orchestration, 28 evaluations, consumer decision rights, scoped household consent and financial/regulatory release gates.
- Flags `app.workflow_fn` as a coordination sentinel, not an independent security control.

These files are produced from the materials provided in this conversation; no GitHub changes or tests were executed as part of this document merge.
