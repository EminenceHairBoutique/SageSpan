# Implementation status — where `master` is right now

**Maintained by the integration coordinator only** (`docs/project/SESSION_OPERATING_MODEL.md` §6). One page; updated on every merge to `master`. Per-capability detail lives in `docs/product/FEATURE_STATUS_MATRIX.md`; per-PR evidence in `docs/requirements/SAGESPAN_V5_TRACEABILITY.md`; decisions in `docs/DECISIONS.md`. Everything here is dated evidence — recheck Git and CI before acting on it.

## Snapshot

| Item | Value |
|---|---|
| **Date** | 2026-11-06 (evening, America/New_York) |
| **`master` head** | `f645858` — "Merge pull request #18" (AI-SEC-001). Previous: `5494be3` (#16), CI run 42318504861 5/5 green; #18 head `ff11706` CI run 42319415139 5/5 green |
| **Merged today, in order** | #10 PR-003a/b/c + DATA-001 (#12) + DATA-002 (#15) → #13 AI-CORE-001 → #16 AI-CORE-002a → #18 AI-SEC-001 (after #14 UI-000 docs, #17 UI-001a earlier in the day) |
| **Open PRs** | the docs/status PR that adds this file (merges next) |
| **Closed unmerged** | #8 (superseded; its one-line e2e retry is in `master` via `4c97476`) |
| **Applied migrations** | `0001`–`0009`; **next free: `0010`** — allocate in `supabase/migrations/REGISTRY.md` only |
| **Branches fully contained in `master`** (safe to delete from GitHub; this session cannot delete branches) | `feat/pr-002-coverage`, `feat/v5-dual-market`, `claude/brave-gates-2b1262`, `feat/pr-003-identity`, `feat/data-001-store-adapter`, `feat/ai-core-001-runtime`, `feat/ai-core-002a-hosted-adapter`, `fix/ai-sec-001-narrative-grounding`, `claude/frosty-kowalevski-1c3f29` (remote already gone) |
| **Branches whose patches are in `master` but whose commits are not ancestors** (squash/cherry-pick ancestry; safe to delete after a tree compare) | `ci/e2e-job-and-pg15`, `fix/web-coverage-label-and-dialog`, `fix/e2e-evidence-export-keepalive-reset`, `feat/pers-002-intake`, `claude/nice-kapitsa-6ae656` |
| **Branch with unique content not yet in `master`** | `feat/data-002-personal-runs` — only the founder's docs commit `032c61d` "Plans", which the docs/status PR installs properly (then the branch is fully contained) |
| **Founder local checkout** | `C:\Users\chinx\OneDrive\Documents\GitHub\SageSpan` was on `feat/pr-003-identity` @ `a269d0b`, clean, at the start of this session; three `.claude/worktrees/*` for the UI/PR-002 sessions. Sync instructions: reconciliation report §8 |

## Release gates (evidence-based)

| Gate | State | Evidence / blocker |
|---|---|---|
| G0 synthetic demo | **Passing, continuously** | full suites on every PR; Playwright 20/20 on `master` |
| G1 security/trust remediation | **Code merged; CI-tested; real-stack-verified in CI** | PR-001 (0005/0006) + PR-003 (0008) + DATA-002 (0009); `realstack` job (disposable local Supabase, genuine pgTAP + JWT/PostgREST/RLS harness). Not a deployed project |
| G2 approval/coverage correctness | **Code merged; CI-tested; real-stack-verified in CI** | PR-002 (0007), #11 fixtures. Open regression item: TS/SQL equal-timestamp latest-attempt tie-break |
| G3 real-data technical/consent controls | **OPEN** | DATA-003 firm store, private storage with trusted hashing, consent/member UI, deployed-project validation (PR-003D), backup/restore, vendor DPA, legal consent |
| G4 professional + legal sign-off | **OPEN** | FIN-VERIFY-001 (no named reviewer yet), REG-001 (perimeter unresolved); PLAN-001 engine does not exist |
| G5 controlled pilots | **NOT STARTED** | — |

## Per-track status and next package

| Track | On `master` now | Next package (smallest reviewable PR) | Owner session |
|---|---|---|---|
| Integration | #10/#13/#16/#18 merged; semantic fixes; status docs reconciled; operating model adopted | Merge the docs PR; delete contained branches (founder); set branch protection on `master` (founder: require the five CI checks, 1 review, no force-push) | Coordinator |
| AI | AI-000/001 + AI-CORE-001 runtime + AI-CORE-002a adapter (disabled) + AI-SEC-001 narrative grounding (#18) | **AI-CORE-002b**: founder confirms vendor (Anthropic Messages API recorded as assumption) and pins a model id; run the opt-in live benchmark locally on synthetic fixtures with the five gates; `diffReports` review; then async `reauthorize()` interface for production RLS + durable budgets + AI persistence (allocate `0010`?) | AI session |
| UI/UX | UI-000 docs, UI-001a tokens/primitives/chips, `ABSTAINED` chip | **UI-001b** shells/navigation (Personal 4-group nav + mobile bottom nav, console rail active state, marketing responsive nav, skeletons) then **UI-001c** axe + visual baseline + contrast in CI; `/app/personal` restyle only via handoff from Data | UI session |
| Data/security | PR-003a/b/c identity + consent RLS, DATA-001 records store, DATA-002 snapshots/runs/decisions atomic RPC, realstack CI | **DATA-003a** firm-side Supabase store (`HouseholdBundle` over 0002–0007 + workflow functions) → **003b** private document storage with server-side hashing → **003c** member/consent UI on `/app`; replace render-time `refreshBaseline` on GET with an explicit recompute action + stale/recomputing state | Data session |
| Financial modelling | RMD rules (published), `personal.cashflow_baseline@2026.1`, `personal.debt_amortization@2026.1`, `personal.cashflow_scenario@2026.1`; income-tax rules DRAFT | **PLAN-001 / SCENARIO-001** gross-basis deterministic annual projection with hand-computed goldens, versioned assumptions ADR, `UNSUPPORTED`/`INFEASIBLE` states; no SS/tax/Roth/Monte Carlo; FIN-VERIFY-001 reviewer request | Finance session |

## Open regression items carried (not blockers for merging, blockers for the gates named)

1. TS vs SQL equal-timestamp latest-attempt tie-break (G2 hardening) — shared total order + cross-tier fixture.
2. Frozen calculation policy vs *current* authorisation/revoked consent at action time — 0008 RLS + per-call re-authorisation cover reads; add an explicit test matrix (G3).
3. `/app/personal` owner GET performs snapshot/run writes via `refreshBaseline` (bounded by hash no-op and ERROR back-off) — replace with explicit action (Data, DATA-003 era).
4. `appSaveRecordAction` = two atomic steps (`mutate`, then `refreshBaseline`), not one transaction — stale receipts are prevented by snapshot-bound runs (a changed input makes a new CURRENT snapshot with no run), but a failed refresh leaves "no current baseline"; needs a visible stale/recomputing state (Data + UI).
5. `runToolLoop.reauthorize()` is synchronous and `Store`-based — production needs an async, RLS-scoped resolver before any live run on production data (AI, with Data seam).
6. `HostedProvider` token ceiling and per-scope rate limit are per-process — durable quotas before multi-instance deployment (AI).
7. `master` branch protection — reported unprotected by the independent audit; not verifiable with this session's token; founder action.
8. `REVIEWED_WITH_LIMITATIONS` vs verified visual distinction and the "Verified (not required)" label — UI-003b.
