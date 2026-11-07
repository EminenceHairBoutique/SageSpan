# Parallel sessions: file ownership, integration seams and the data boundary (DATA-001 ↔ AI-CORE)

**Status:** working agreement, 2026-11-06. Two Claude sessions build SageSpan concurrently on the same repository: the **data/identity track** (PR-003 → DATA-001 → DATA-002) and the **SageSpan Intelligence track** (AI-CORE-000/001 per `SAGESPAN_AI_CORE_FABLE_5_1_FIRST_SESSION.md`). This note is how they stay out of each other's files and plug into each other's seams. It changes only by a commit that both tracks can see.

## 1. Branches and merge order
- Each track works on its own branch from `master`, opens its own PR, and **never edits the other track's branch**. Rebase or merge `master` forward; do not merge the other track's unmerged branch into yours.
- Both tracks avoid rewriting shared files wholesale. Shared files are edited **append-only, in their own section** (see §3), so conflicts are trivially resolvable by keeping both sides.
- Known shared-file conflict as of this note: `CLAUDE.md` between `feat/pr-003-identity` (#10) and `claude/brave-gates-2b1262` (#11). Resolution rule: **keep both status notes; the later-merged PR resolves.**
- Migration numbers: `0008` = PR-003a (merged with #10). **Data track reserves `0009` (DATA-002: personal snapshots / calc runs / decisions). The AI track takes `0010+` for AI run / feedback persistence.** Never renumber; never edit an applied migration.

## 2. File ownership
| Track | Owns (edit freely) | Touches only via an issue/comment to the other track |
|---|---|---|
| Data / identity | `supabase/migrations/0009*`, `supabase/tests/009*`, `supabase/realstack/**`, `apps/web/src/auth/**`, `apps/web/src/domain/store.ts`, `apps/web/src/domain/personal/{repository,supabase-repository}.ts`, `apps/web/src/server/{auth-actions,app-personal-actions,personal-form}.ts`, `apps/web/src/app/app/**`, `apps/web/src/ui/Production*.tsx`, `apps/web/src/ui/SignInForm.tsx`, `.github/workflows/ci.yml` `realstack` job | `apps/web/src/ai/**`, `packages/contracts/src/ai/**`, `docs/ai/**` |
| AI-CORE | `apps/web/src/ai/**`, `packages/contracts/src/ai/**`, `docs/ai/**`, `supabase/migrations/0010+` for AI tables, AI evaluation fixtures | `apps/web/src/domain/**` (consume, don't fork), `apps/web/src/auth/**`, RLS policies on personal/firm tables |
| Shared, append-only | `CLAUDE.md` status notes, `docs/requirements/SAGESPAN_V5_TRACEABILITY.md` (new lettered section per PR), `docs/product/FEATURE_STATUS_MATRIX.md` (own rows), `docs/SECURITY_AND_LIMITS.md` (own rows), `packages/contracts/src/index.ts` (add export lines; never reorder) | — |

Domain functions in `apps/web/src/domain/personal/*` and the firm domain are **shared read-mostly**: either track may call them; changes to their signatures need a heads-up in the PR description because both tracks depend on them.

## 3. The seams the AI track should consume (not re-implement)
1. **Identity** — `apps/web/src/auth/actor.ts`: `getProductionIdentity()`, `getProductionActor()` (firm), `getProductionPersonalActor()` (personal). Demo counterparts: `getDemoActor()`, `getPersonalActor()`. These are the only sources of an `Actor` / `WorkspaceActor`; the AI runtime's step 1 ("authenticate and authorize the user and permitted workspace") is a call here, not new code.
2. **Personal data** — `apps/web/src/domain/personal/repository.ts`: `demoPersonalRepository()` / `productionPersonalRepository()` → `PersonalRepository` with `bundle(): Promise<PersonalBundle>` and `mutate(fn)`. **AI tools read a `PersonalBundle`**; they never query Supabase or the file store directly. In production the bundle is exactly what RLS (0008) returned for that user, so cross-workspace leakage is a database property, not a per-tool check.
3. **Firm data** — unchanged for now: `getStore().read()` + `src/domain/queries.ts` (demo). The Supabase store for the firm side is DATA-002/003; when it lands it will present the same `HouseholdBundle` shape.
4. **Deterministic math** — `src/provenance/calc-client.ts` and the `services/calculator` endpoints; `run_supported_projection` must keep refusing unpublished method sets (`/v1/methods`).
5. **What the AI track should expect in DATA-002** — `personal_snapshots`, `personal_calc_runs`, `user_decisions` tables (0009) and `PersonalRepository.supportsRuns = true` for production; until then, production `PersonalBundle.runs/snapshots/decisions` are empty and `supportsRuns` is false. Design AI-CORE-001 so "no receipted run available" is a first-class, non-fabricating state (it already is in the 28 evals).
6. **AI run persistence** — the AI track owns the table(s) and should key them by `workspace_id` with RLS mirroring 0008 (`app.is_workspace_member(workspace_id)` for reads; writes only through a SECURITY DEFINER entry point that re-derives `auth.uid()`). Reuse `app.workspace_append_event` for the audit line rather than inventing a second log.

## 4. Non-negotiables both tracks keep
- No service-role key in `apps/web`. Server actions use the user's session; privileged steps are SECURITY DEFINER functions with explicit `EXECUTE` grants and the N-04 inventory updated in `supabase/tests/005/007/008` (and `009+`).
- Every new function/table: RLS enabled (not FORCE), `revoke … from public, anon, authenticated, service_role` then explicit grants, sentinel settings never a boundary.
- Real-stack evidence comes from the CI `realstack` job only; neither track reports real-Supabase validation from a shim run.
- Synthetic data only; no live model vendor on identifiable data; AI never sets VERIFIED/APPROVED or writes facts.

## 5. Prompts here vs. Claude Code on your machine
Both are Claude Code. This cloud session runs in Anthropic's Linux sandbox against a clone of the repo with push access, has the Project knowledge docs available, can bridge files to your Windows checkout, but has **no Docker** (so no local `supabase start`) and an allow-listed network. Claude Code on your PC runs in your working tree with your toolchain (and Docker if installed, which would allow a local real-stack run), but does not see Project knowledge unless the docs are on disk — which is why the controlling docs live under `docs/`. Either way the guardrails are the repo's `CLAUDE.md`; the Project instructions only add context in this surface.
