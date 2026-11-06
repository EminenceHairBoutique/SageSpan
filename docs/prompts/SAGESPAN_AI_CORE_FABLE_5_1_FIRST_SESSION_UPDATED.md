# Claude Code / Fable 5.1 — SageSpan Intelligence First Session (Post-Session 3)

**Use:** Copy/paste into Claude Code at the SageSpan repository root with your preferred available high-capability coding model (Fable 5.1 if your Claude environment offers it). This prompt is an *implementation task*, not a permanent Project Instruction.

## Current baseline (must reverify)

At the last verified GitHub check on 2026-11-06: `master` at `52997912dba0`, latest GitHub Actions run `42207031870` succeeded; PR-001 (#5), PERS-002 guided intake and scenarios (#6 via #7), V5 dual market (#7), PR-002 (#9) are merged. SQL migrations `0001`…`0007` exist. PR-003 production Supabase identity, tenancy, consent, storage and real-stack tests remain OPEN. **Do not repeat outdated Session 1 claims that PR-002 or V5 are unmerged.** Confirm all facts at the live repository before changing code.

You are SageSpan's senior AI/ML architect, full-stack fin-tech engineer, financial domain reviewer and AI security lead. Your mission is to build **SageSpan Intelligence**, a proprietary, model-independent financial reasoning system that can later host and, if justified by benchmarks, fine-tune a licensed open-weight model. The platform serves B2C Personal/Household and B2B RIA/Advisor Assurance without collapsing their permission boundaries.

### Required reading

1. Root `CLAUDE.md` and current Git/CI state.
2. `docs/product/SAGESPAN_V5_MASTER_SOURCE_OF_TRUTH.md`, `docs/requirements/SAGESPAN_V5_TRACEABILITY.md` and `docs/legal/FEATURE_RELEASE_GATES.md`.
3. `docs/ai/AI_EVAL_MATRIX.md` **and** `docs/ai/AI_EVALUATION_PLAN.md` (supplied file if not in repo).
4. `docs/ai/SAGESPAN_AI_CORE_FABLE_5_1_MASTER_PROMPT.md` (use updated edition 1.1 from this package).
5. Current `apps/web/src/ai/provider.ts`, `review-orchestrator.ts`, `tools.ts`, `evidence-resolver.ts`, `result-validator.ts`; shared Zod contracts; Python/FastAPI calculations; PERS-002 scenario sources and PR-002 coverage semantics.

### Step 0 — Reconcile current code and dependencies (no code changes yet)

- Run `git status`, inspect active branch, recent commits, CI/PRs and local edits. Never discard user changes or silently merge.
- Confirm PR-002 outcomes and snapshot-only request behavior (`S-06`, `S-07`, `N-02`). Identify identical-timestamp latest-run ordering differences and the distinction between historical frozen policy and currently valid authorization.
- Inventory existing 28 AI eval cases, 30 total offline cases and tests, plus PERS-002 intake/scenario UI. Do not rebuild completed features.
- Check real Supabase status; report it separately from PostgreSQL-shim tests. Do not use real customer data, bank accounts, documents or unapproved providers.
- Produce an architecture, threat model, control-plane inventory, benchmark plan and exact *smallest* PR scope.

### Step 1 — Implement AI-CORE-001 (only if safe), mock-first

Build a bounded **two-step model → tool → model** flow that upgrades the one-pass provider abstraction:

1. Resolve actor/workspace scope and purpose server-side; restrict personal vs firm access.
2. Ask scripted/mock model for an authorized read-only or approved deterministic scenario tool call.
3. Validate type, arguments, tool name, budget, timeout and **fresh current consent/membership** before calling.
4. Dispatch through an allowlist with no arbitrary URL, SQL, write, approve, trade or transfer capability; use frozen versioned deterministic calculations for money.
5. Provide tool result as untrusted content to a subsequent model completion while preventing instruction/role escalation.
6. Validate final report against exact current authorized evidence locators, receipt amounts, status limitations, output schema and policy. The only AI-result statuses are draft/rejected/error, never professional-approved.
7. Record reproducible run metadata: actor/workspace/snapshot, provider/model/prompt/tool/calculator versions, tool args/results digests, denial details, token/cost budgets, validated vs rejected citations, and sanitized error state.

Do not wire a live vendor or touch production financial data, PR-003 SQL, professional approval implementation or live investment recommendations in this PR.

### Step 2 — Tests, evaluations and signoff

- Preserve AI-E01…AI-E28 and two consumer baseline tests. Implement mock tool-loop tests for successful second turn, injection, forbidden tool, budget exhausted, cross-firm and private workspace attack, revoked access between turns, forged citations, altered receipts, erroneous latest-run reuse, `REVIEWED_WITH_LIMITATIONS` mislabeling and unsupported retirement projections.
- Produce the benchmark manifest/schema and human-evaluation protocol specified in `AI_EVALUATION_PLAN.md`. You may write synthetic fixtures; do not call a real model or run GPU fine-tuning here.
- Run applicable Python, contracts/web unit tests, build, lint, typecheck, SQL/Playwright when available and report exact result counts; mark unavailable tools and real Supabase tests **NOT RUN**.
- Update feature matrix, AI eval plan (only factual progress), requirements traceability and ADR; document one next recommended PR.

### Required final report

Return: baseline commit/CI; architecture and threat model; exact changed files; new tests and results; a security invariant matrix; new/reused interfaces; mock tool-loop trace; G3/G4 blockers; and recommended next PR. **Do not merge or deploy** without explicit instruction.

**Priority:** PR-003A/B/C/D remains top priority for **real production data**; AI-CORE-001 may progress safely in an isolated synthetic branch. Never claim validated financial advice or successful live model quality solely from passing mock tests.
