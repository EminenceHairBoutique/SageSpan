# SageSpan — Session operating model (founder decision, 2026-11-06)

**Status:** adopted by the founder on 2026-11-06 (evening), replacing the "single session" default recorded earlier the same day. This file, not any chat transcript, is the rule set every Claude Code session follows. `docs/architecture/PARALLEL_SESSIONS_AND_DATA_BOUNDARY.md` remains the detailed seam description between the data and AI tracks; this document generalises it to all tracks.

## 1. The model in one table

| Environment | Purpose | Writes to the repo? |
|---|---|---|
| **One Claude Project** ("SageSpan") | Product direction, founder decisions, governing specifications, architecture, release gates, the audit bundle, session reports | No — knowledge only. Anything a session must obey is **also committed under `docs/`** |
| **Integration coordinator session** | Owns `master`: reconciles branches, merges PRs in dependency order, runs cross-track tests, maintains the status files and the migration registry, writes the handoff for the next sessions | Yes — merges, status docs, `CLAUDE.md`, `.github/workflows/ci.yml`, `supabase/migrations/REGISTRY.md` |
| **AI session** | AI contracts, orchestration/runtime, provider adapters, evaluations, AI persistence | Yes — its own branch/PR only |
| **UI/UX session** | Design tokens, navigation and shells, page experience, accessibility and visual regression | Yes — its own branch/PR only |
| **Data/security session** | Identity, repositories, Supabase migrations, RLS, private storage, consent | Yes — its own branch/PR only |
| **Financial modelling session** | Deterministic engines in `services/calculator`, method specifications, golden tests, rule registry | Yes — its own branch/PR only |

**Concurrency limit:** the coordinator plus **at most two** feature sessions at a time. Two feature sessions may run together only if their ownership rows below do not overlap. Never two sessions on the same package.

**Why not one session:** today's reconciliation found two semantic conflicts (a `ConfirmDialog` × injectable action; a status-chip map × a new enum value) and four shared-doc collisions that no single session would have produced — but a single session would also have serialised ~3 days of parallel work. The model above keeps the parallelism and moves the collision cost to one place (the coordinator), where it is cheap.

## 2. File ownership (edit freely in your own row; everything else is read-only for you)

| Track | Owns | Shared, append-only (see §3) | Never touches |
|---|---|---|---|
| **Integration coordinator** | `CLAUDE.md`, `.github/workflows/**`, `docs/project/**`, `docs/engineering/V5_SESSION_*_REPORT*.md` (reconciliation reports), `supabase/migrations/REGISTRY.md`, `docs/product/FEATURE_STATUS_MATRIX.md` (final say), `docs/DECISIONS.md` (final say) | — | Feature code, except conflict resolution recorded in a report |
| **AI** | `apps/web/src/ai/**`, `packages/contracts/src/ai/**`, `docs/ai/**`, `apps/web/src/ui/ai/**`, AI persistence migration(s) allocated in the registry, `apps/web/e2e/*ai*.spec.ts` | `packages/contracts/src/index.ts` (add export lines), `docs/requirements/SAGESPAN_V5_TRACEABILITY.md` (own lettered section), `FEATURE_STATUS_MATRIX.md` (own rows), `docs/SECURITY_AND_LIMITS.md` (own rows), `.env.example` (own block) | `apps/web/src/auth/**`, `apps/web/src/domain/**` (consume `PersonalRepository.bundle()` / `HouseholdBundle`; never fork), RLS on personal/firm tables, `ui/primitives.tsx`, `ui/status/*` (request a chip from UI instead) |
| **UI/UX** | `apps/web/src/ui/**` except `ui/ai/**`, `apps/web/src/app/**/layout.tsx`, `apps/web/src/app/(marketing)/**`, `apps/web/src/app/demo/**` presentation, `apps/web/src/styles/**`, `apps/web/scripts/design/**`, `docs/design/**`, screenshot baselines, axe/visual e2e specs | same shared files, own rows/sections | Server actions, `domain/**`, `auth/**`, contracts, migrations, calculator, any amount formatting that changes a financial string |
| **Data/security** | `supabase/migrations/*` (allocated numbers only), `supabase/tests/**`, `supabase/realstack/**`, `apps/web/src/auth/**`, `apps/web/src/domain/**` (excluding `domain/ai/**`), `apps/web/src/server/**`, `apps/web/src/app/app/**` (production routes; UI session may restyle via a handoff), `apps/web/src/ui/Production*.tsx`, `ui/SignInForm.tsx`, CI `realstack` job body (coordinator reviews) | same shared files, own rows/sections | `apps/web/src/ai/**`, `docs/ai/**`, calculator engines |
| **Financial modelling** | `services/calculator/**`, `fixtures/synthetic/**` (regenerate hashes), `packages/contracts/src/{personal,coverage,...}.ts` engine request/response mirrors, `docs/finance/**`, `docs/FINANCIAL_METHODOLOGY.md`, `docs/RULE_VERIFICATION_LOG.md`, generated `0006_seed_rule_sets.sql` via its generator | same shared files, own rows/sections | `apps/web/src/ai/**`, `auth/**`, RLS, UI |

When a task genuinely needs a file outside your row: **stop and hand it to the owner** (write the request in your PR description and the handoff report); the coordinator can also do a small cross-track edit and record it. Do not "just fix it".

## 3. Shared files: append-only, own section

`CLAUDE.md` (Current-state paragraph: coordinator only), `docs/requirements/SAGESPAN_V5_TRACEABILITY.md` (new lettered section per PR, never edit another PR's section), `docs/product/FEATURE_STATUS_MATRIX.md` (own rows), `docs/SECURITY_AND_LIMITS.md` (own rows), `docs/DECISIONS.md` (append a row, never rewrite one), `packages/contracts/src/index.ts` (add export lines at the end of the relevant block, never reorder), `.env.example` (own commented block). The later-merging PR resolves any collision by keeping both sides.

## 4. Migration numbers: central registry

`supabase/migrations/REGISTRY.md` is the only place a migration number is allocated. Rule: **ask the coordinator for a number before creating the SQL file**; the coordinator records `number → track → branch → purpose → status` and the number is burned even if the branch is abandoned. Applied `0001`–`0009` are immutable (forward-only). Never renumber. Never two open PRs with the same number.

## 5. Session protocol (mandatory)

**Start — before any edit**
1. `git fetch origin --prune`; `git status --porcelain=v1`; `git branch --show-current`; `git log -5 --oneline`; open PRs and their heads (`gh api repos/EminenceHairBoutique/SageSpan/pulls?state=open`); latest `master` CI run.
2. If the checkout is dirty or may be the founder's working tree: **do not stash/reset/clean/force-checkout it**. Work in a **separate Git worktree** (`git worktree add ../SageSpan-<track> -b <branch> origin/master` on the founder's PC; a fresh clone in a cloud sandbox).
3. Read `docs/project/IMPLEMENTATION_STATUS.md` (where `master` is), `CLAUDE.md`, the controlling V5 docs, and your track's own docs. Treat every dated report as evidence of *then*, not now.
4. Write `SESSION_CONTRACT.md` in your worktree root (git-ignored) from `docs/project/SESSION_CONTRACT_TEMPLATE.md`: owner track, branch, base SHA, touched paths (must be inside your ownership row), dependency PRs, migration number if any (from the registry), acceptance criteria, non-goals.

**During**
5. One branch, one PR, bounded diff. Positive **and** negative tests. Synthetic data only. No direct push to `master`, no force-push, no deleting branches, no editing applied migrations.
6. Keep a short execution log in the contract file; note any file you needed outside your row and did *not* touch.

**Finish — the handoff**
7. Run and report exactly: typecheck, lint, contracts Vitest, web Vitest (calculator up), pytest (locked), SQL shim harness when SQL changed, `next build`, Playwright; say which were not run and why. Distinguish shim from CI `realstack`; never call either "deployed".
8. Open the PR with: what/why, files changed (inventory), tests with counts and GitHub Actions run URLs, security/financial/regulatory implications, traceability section letter, non-goals, and **the next smallest PR** for your track.
9. Write the handoff report from `docs/project/SESSION_HANDOFF_TEMPLATE.md` into `docs/engineering/` (and the Project). The coordinator — not the feature session — updates `IMPLEMENTATION_STATUS.md`, `CLAUDE.md` and merges.

## 6. Coordinator duties per merge

1. Merge in dependency order with **merge commits** after a green CI run on the *updated* head (feature branch with `master` merged in).
2. Resolve conflicts with a recorded rationale (report + `docs/DECISIONS.md` row when a product/design choice is involved).
3. Run the full suite on the integrated tree, not just the PR's.
4. Update `docs/project/IMPLEMENTATION_STATUS.md`, the `CLAUDE.md` Current-state paragraph, `FEATURE_STATUS_MATRIX.md` rows the PR moved, and the migration registry.
5. Write the handoff for the next sessions: integrated SHA, frozen ownership, open items each track inherits.

## 7. What this does not change

The engineering invariants in `CLAUDE.md` §2–§4 and §8, the release gates G0–G5, synthetic-only data, and the rule that the repository — code, migrations, tests, CI — is the only truth about implementation status.
