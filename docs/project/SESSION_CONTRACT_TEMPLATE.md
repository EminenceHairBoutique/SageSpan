# SESSION_CONTRACT.md — template (copy to your worktree root; it is git-ignored)

> One contract per Claude Code session. Fill it in **before the first edit**; keep the log current; paste the final state into your handoff report. Fields in `<>` are mandatory.

- **Track:** <Integration coordinator | AI | UI/UX | Data/security | Financial modelling>
- **Session surface:** <Claude Code on founder PC (worktree path) | cloud sandbox clone>
- **Branch:** `<feat|fix|docs>/<track>-<slug>` from `origin/master` @ `<SHA>` (`git log -1 --oneline` at start)
- **Open PRs at start:** <#n head SHA → base, …> (from `gh api repos/EminenceHairBoutique/SageSpan/pulls?state=open`)
- **Latest master CI:** <run id / conclusion>
- **Founder working tree:** <clean | dirty — left untouched, worked in a separate worktree>
- **Touched paths (must be inside my ownership row in `docs/project/SESSION_OPERATING_MODEL.md` §2):**
  - `<path>`
- **Shared files I will append to (own section/rows only):** <TRACEABILITY §<letter>, FEATURE_STATUS_MATRIX rows, SECURITY_AND_LIMITS rows, .env.example block, contracts index exports>
- **Files I need but do not own (→ handoff request, not edited):** <none | path → owner → why>
- **Migration number:** <none | NNNN allocated in `supabase/migrations/REGISTRY.md` by the coordinator on <date>>
- **Dependency PRs / SHAs:** <none | #n must merge first because …>
- **Acceptance criteria (testable):**
  1. <…>
- **Non-goals:** <explicit list — what this session will not touch even if tempting>
- **Data mode:** synthetic only (G3 not passed). <Any live vendor/key? default NO>

## Execution log (short, dated)
- <HH:MM> <what was done / decided / discovered>

## Finish checklist
- [ ] typecheck · lint · contracts Vitest · web Vitest (calculator up) · pytest (locked) · SQL shim (if SQL changed) · `next build` · Playwright — counts recorded; not-run suites named with the reason
- [ ] PR opened against `master` with files inventory, test counts, Actions run URLs, traceability section letter, non-goals, next smallest PR
- [ ] Handoff report written from `docs/project/SESSION_HANDOFF_TEMPLATE.md` into `docs/engineering/` and saved to the Project
- [ ] Nothing pushed to `master`; no force-push; no branch deleted; no applied migration edited
