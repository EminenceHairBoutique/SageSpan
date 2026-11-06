# V5 Session 4 — PR-003a/b/c: consumer identity schema, Supabase session resolution, real-stack verification job

**Date:** 2026-11-06. **Branch:** `feat/pr-003-identity` (from `feat/pr-002-coverage` @ `c76ac11`; stacked on PR #9 so it builds on migration 0007). **Scope delivered:** the identity half of V5 §17.4 — principals, PERSONAL/HOUSEHOLD workspaces, memberships, purpose-limited consent grants and domain-scoped RLS (0008); production session resolution in the web tier; `/app` sign-in/out with an honest "store not wired" state; a real-stack CI job. **Not delivered (deliberately):** the Supabase store adapter for domain reads/writes (DATA-001), private document storage and trusted registration, member-management UI. **Synthetic data only; no real stack was run in this session.**

## 1. What changed

### PR-003a — migration `0008_workspaces_and_consent.sql` + `tests/008_*` (74 assertions)
- **Identity tables** mirroring `packages/contracts/src/workspace.ts`: `app.principals` (same uuid as `auth.users`), `app.workspaces` (PERSONAL/HOUSEHOLD owned by a principal; FIRM ↔ `organizations` 1:1 by constraint), `app.workspace_memberships` (OWNER/PARTICIPANT/VIEWER, `domains app.share_domain[]`, ACTIVE/INVITED/REVOKED), `app.consent_grants` (exactly one grantee: principal **or** org; `domains`, `purpose`, `expires_at`, `revoked_at`, `version`).
- **Personal record tables** (profile, cash accounts, income streams, liabilities, recurring obligations, variable spending, savings goals, append-only `personal_record_revisions`) with one share domain per table: CASH_FLOW (cash, income, obligations, profile), SPENDING, DEBT, SAVINGS_GOALS.
- **Authorisation**: `app.can_read_workspace_domain(ws, domain)` = ACTIVE OWNER, or ACTIVE member whose `domains` include it, or an ACTIVE unexpired grant covering it to the caller or to a firm the caller is an ACTIVE member of. Reads use it; **writes are OWNER-only**; no DELETE grant for end users. Firm membership on its own reaches nothing. `app.my_workspace_access(ws)` returns the derived scope for the web tier and **no row at all** for a stranger (S-01 non-disclosure; fixed during the session after the first test run exposed the label/kind of an unrelated workspace through the SECURITY DEFINER path).
- **Entry points** (SECURITY DEFINER, actor from `auth.uid()`): `require_principal`, `create_personal_workspace` (production "Start fresh"), `invite_participant` (HOUSEHOLD only, explicit domains, invitee must be a principal), `accept_invitation` (invitee only), `revoke_membership` (owner or self; owner cannot be revoked), `grant_consent` (owner only; never to self; future expiry), `revoke_consent` (owner only; keeps the row, bumps `version`). Each appends to a **per-workspace hashed event log** (`workspace_events`, `workspace_append_event`, advisory-locked, immutable).
- **Privilege, then sentinel**: `authenticated` holds SELECT only on memberships and grants (the boundary); the guard triggers behind `app.workspace_fn` are coordination for the definer path, documented as such (CLAUDE.md §4.3 stance). Grants' scope is immutable once issued (revoke-and-regrant), and a revoked grant cannot be un-revoked.
- **RLS mode**: ENABLE, explicitly *no* FORCE — the first draft used FORCE and would have broken every definer entry point on Supabase (where `postgres` is not a superuser); 0005 §0 already records the rule.
- **N-04**: 0008 ends with revoke-all + the complete explicit inventory; tests 005/007/008 assert the exact list (`require_principal` and the six consumer entry points plus the three read-only helpers added; internal `workspace_append_event` and guards not executable).

### PR-003b — web identity (`apps/web/src/auth/*`, `/app`)
- `identity.ts` — `resolveIdentity(client, selectors)` over a narrow `IdentityClient`. Firm actor: ACTIVE `app.memberships` with a role the contracts know, `mode: "PRODUCTION"`, `actor_type: "USER"`. Personal actor: from `my_workspace_access` with `via = MEMBERSHIP` and ACTIVE status; INVITED confers nothing; `via = CONSENT_GRANT` is reported as read-only scope (`granted[]`), **never** as an actor. Unknown roles/domains are dropped. Selector cookies (`sagespan_org`, `sagespan_workspace`) choose among rows the database already returned and are ignored otherwise. "Signed in with no memberships" is a valid empty identity — no demo fallback.
- `supabase-server.ts` — `@supabase/ssr` cookie client with the **anon key** and the user's session; `auth.getUser()` (server-verified) never `getSession()`; PostgREST reads of the `app` schema under RLS; adapter to `IdentityClient`. The app reads **no service-role key** anywhere.
- `actor.ts` — `getProductionIdentity()` / `getProductionActor()` replace the stub. Demo actors unchanged.
- `server/auth-actions.ts` — password sign-in (one generic failure message; sign-up stays disabled in `config.toml`), sign-out (clears selectors), `selectOrgAction` / `selectWorkspaceAction` validated against the resolved identity. `/app/auth/callback` exchanges PKCE codes and only redirects within `/app/*`.
- `/app`, `/app/sign-in`, `/app/[...rest]` — unconfigured → `ProductionGate` (text updated); configured and signed out → sign-in (with safe `next`); signed in → `ProductionHome`, which lists exactly what RLS resolved (firms, workspaces with domains, consent-shared scopes) and says plainly that the production store adapter is not implemented, so no plan, record or review is shown or editable.

### PR-003c — real-stack evidence (`supabase/realstack/run.mjs`, CI job `realstack`)
- Node harness with `@supabase/supabase-js`: creates **synthetic** users through GoTrue admin (random passwords never stored), signs them in for real JWTs, then asserts over PostgREST: Ana creates P and H via RPC; Ben is a stranger (zero rows, empty `my_workspace_access`), registers, cannot self-invite (P0002), is invited for SAVINGS_GOALS only, INVITED sees nothing, accepts, reads the goal but not cash accounts nor P, cannot insert (42501) or update (0 rows); Dee (firm advisor) sees nothing until Ana grants F1 CASH_FLOW+DEBT, then reads cash accounts but not goals, cannot revoke or widen, and loses access the moment Ana revokes (grant kept as version 2); anon key alone reads nothing and cannot execute the entry point; direct membership/grant inserts and record deletes are 42501; the H event log is linear and hash-linked; grantees never see the log. Cleanup deletes the users and the org.
- CI job: `supabase/setup-cli` → `supabase start` → `db reset` → `supabase test db` on the eight test files (**genuine pgTAP**, plan counts enforced) → harness → `supabase stop`.
- **Cannot run in this build sandbox** (no Docker daemon; GitHub release downloads blocked, so no CLI/PostgREST binaries). The job's first execution is on the PR-003 pull request. Until it is green, nothing is real-stack validated, and the first run may surface CLI/pgTAP incompatibilities (e.g. `\ir` include resolution or `SET ROLE` semantics under the CLI's test runner) that need a follow-up commit.

### Fixed along the way
- **Latent pgTAP defect**: tests 002/003/005 declared `plan(20/10/58)` but run 23/11/71 assertions. The shim's `plan()` ignored the count, so neither the local harness nor the CI `database` job noticed; genuine pgTAP would fail each file. Counts corrected; `run_sql_tests.py` now enforces `plan == tests run` under the shim (verified by a deliberate mismatch → FAIL, then restored).

## 2. Suites actually executed in this session (Linux sandbox, Node 22, Python from `uv.lock`, embedded PostgreSQL 16)

| Suite | Command | Result |
|---|---|---|
| SQL harness (shim) | `SAGESPAN_PG_BIN=/usr/lib/postgresql/16/bin SAGESPAN_TEST_PG_PORT=55432 python3 supabase/tests/run_sql_tests.py` | 8 migrations applied; **8/8 files PASS** (001 12, 002 23, 003 11, 004 8, 005 71, 006 9, 007 43, 008 74 = 251 assertions) |
| Typecheck | `npm run typecheck` | clean (contracts + web) |
| Lint | `npm run lint` | clean |
| Build | `npm run build --workspace apps/web` | compiled; 47 routes (adds `/app/sign-in`, `/app/auth/callback`) |
| Contracts Vitest | `npm run test --workspace packages/contracts` | 47 passed |
| Web Vitest (calculator up) | `npm run test --workspace apps/web` | **115 passed** (105 + 10 `auth/__tests__/identity.test.ts`) |
| Playwright | `npx playwright test` (installed Chrome, locked Python) | **18 passed** (16 + 2 `pr-003-identity.spec.ts`) |
| Calculator pytest / OpenAPI / generated SQL | not re-run (no calculator change in this PR; last run session 3: 99 passed) | — |
| Real Supabase stack | **not run** (impossible here) | CI `realstack` job |

## 3. Security notes and residual risks
- The schema's RLS and entry points are proven on plain PostgreSQL only. **Real-stack status is whatever the `realstack` job reports**; treat a red first run as expected engineering, not as a regression to hide.
- `my_workspace_access`, `can_read_workspace_domain`, `is_workspace_*` are SECURITY DEFINER and therefore bypass RLS internally; each filters on `auth.uid()` itself. Any future helper of this kind must do the same (the stranger-disclosure found in the first 008 run is the pattern to test for).
- Grantee access to a consumer workspace is *scope*, not an actor: PostgREST reads under RLS honour it today, but the web tier will only use it once the store adapter exists. Nothing in the UI reads personal records in production yet.
- Session cookies set by `@supabase/ssr` inside Server Components are swallowed (read-only cookie jar); token refresh happens on the next mutable request. No middleware/proxy was added; if session refresh latency becomes an issue, add Next's `proxy.ts` refresh pattern in a later PR.
- Password sign-in only; MFA, magic links (callback exists), OAuth, rate limiting at the edge, and account lifecycle are not configured. `enable_signup = false` means accounts come from an administrator or the harness.
- No real PII: harness e-mails use the reserved `.test` TLD; passwords are random and discarded.

## 4. Traceability
S-01 (non-disclosing cross-tenant), S-02 (direct mutation refused by privilege), S-04 analogue (immutable workspace events), N-04 (inventory re-asserted), V5 §17.4 real-stack test matrix (two firms, unrelated consumers, shared household with limited permissions, firm-client grant, expiration, revocation — forbidden retrieval via API and RPC; no vector search exists yet), §21.1 consent model. See `docs/requirements/SAGESPAN_V5_TRACEABILITY.md` §G.

## 5. Recommended next PR — DATA-001: Supabase store adapter (bounded)
1. `apps/web/src/domain/store.ts`: a `SupabaseStore` implementing the same `Store` reads for the **personal** workspace first (records, profile, revisions) through PostgREST as the signed-in user — no service role — with `resolveIdentity()` supplying the `WorkspaceActor`. Firm-side reads second.
2. Personal snapshots / calc runs / decisions / AI runs tables (0009), still synthetic-only; receipts verified exactly as the file store does.
3. Member-management and consent UI on `/app` backed by the 0008 entry points (RPC), with the e2e suite extended to run against the real stack in CI only.
4. Gate: `realstack` green on this PR first.
