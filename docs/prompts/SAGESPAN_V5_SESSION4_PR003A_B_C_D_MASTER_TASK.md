# Claude Code — SageSpan V5 Session 4: PR-003 Production Foundation (Post–Session 3)

**Primary implementation sequence:** PR-003A → PR-003B → PR-003C → PR-003D, **one independently reviewed PR at a time**. You are the senior fintech data architect, PostgreSQL/Supabase security engineer, full-stack developer and privacy engineer. You may design all four subphases, but implement **only PR-003A** in this session after inspecting the repository and current branch.

## Current status to reverify

PR-001 (#5), V5 (#7, including PERS-002 #6), PR-002 (#9, migration `0007_coverage_and_reproducibility.sql`) are merged. At 2026-11-06 the last inspected `master` was `52997912dba0` with CI run `42207031870` passing. Latest user-provided Session 3 report notes 119 Python, 47 contracts, 104 web passing/2 skipped, 16 Playwright and seven SQL harness files. **Never mistake pgTAP PostgreSQL shims for real Supabase JWT/RLS.** Recheck live state and do not overwrite user changes.

Read `CLAUDE.md`, V5 Source of Truth, requirements traceability, feature/status, release gate and SQL privacy/security docs. Review `apps/web/src/auth/actor.ts` (production actor currently null), personal demo state architecture, existing firm `app` schema, PR-001/002 SQL and tests, existing workspace contracts, AI evidence resolver, reviewed financial check receipt contracts.

## Step 0 — Read-only security architecture

1. Map exact current tables, RPCs, RLS, grants and `SECURITY DEFINER` functions. Record schema diagram and entity-scope model. Identify cross-domain paths between PERSONAL, HOUSEHOLD and FIRM. Do not model consumer as a firm-of-one.
2. Define a future **trusted actor** resolved exclusively by real Supabase Auth/JWT server context; no demo cookie/user-provided `workspace_id`, `org_id` or model-supplied role may create access rights.
3. Review PR-002 latest-run tie-breaking, frozen snapshot assumptions vs current authority, and permitted review with limitations. Add targeted cross-tier regression tickets; don't rewrite protected code as part of a new account migration without reason.
4. Produce a precise PR split, migration list, column-level permissions and negative-test matrix before implementation.

## PR-003A — Identity and schema (implement ONLY this bounded slice)

- Add additive, forward-only SQL migrations for app identity mapping, person/household workspaces, memberships and foundational typed personal record tables with appropriate tenant keys, FKs, indexes, checks and minimal grants. Preserve existing organization/firm tables and workflow/RMD migration series `0001`…`0007` unchanged.
- Build authenticated server session/actor resolution with explicit DEMO vs PRODUCTION adapters. Demo cookies may be used only for synthetic demo and not recognized by production policies. Prefer fail-closed behavior when Supabase credentials are absent.
- Define versioned TS/Zod contracts shared by DB and app; avoid parallel models of roles that silently diverge.
- Include full read/write authorization tests for identities, memberships, tenant isolation and attempted direct workflow column mutations. Some acceptance tests will remain pending real Supabase stack in PR-003D; label honestly.
- Do not connect actual user data to the new tables or enable real account signup before the security and privacy gates pass.

## PR-003B — Authorization and consent (design only here)

- Server-side membership checks, purpose-scoped domain grants, invitation acceptance/expiry/revocation, collaborator limits, consumer-to-firm sharing only with specific explicit grant, non-disclosing cross-tenant `NOT_FOUND`.
- Real JWT/PostgREST/RLS role tests and row/table/function grant inventory. Test two unrelated firms, two consumers, a shared household with private domain, authorized firm-client share, revoked/expired and wrong-purpose grants.

## PR-003C — Private storage and persistence (design only here)

- Production store adapter to Supabase, transactional revisions, idempotent mutations, trusted calculator receipt registration and audit events. Demo file store remains isolated.
- Private storage buckets, source-byte hashing by trusted service, file scanning/validation, storage access policy, retention/deletion, signed URL scope, backups and replay.

## PR-003D — Real-stack validation (design only here)

- Run Supabase local `supabase start`, `supabase db reset`, `supabase test db` against safe local environment; actual Auth/JWT/PostgREST RPC, private storage, RLS/privilege, grant revocation, service-role bypass abuse, CI repeatability and clean replay.
- Preserve PR-001/002 shims and regression tests as additional—not sole—coverage. Record exact command outputs, versions and results. Test backups and restore. Do not label security release G3 passed until acceptance evidence and privacy/vendor/legal procedures are completed.

## Boundaries

- Never alter applied migrations. Never authorize by `app.workflow_fn` sentinel alone. Do not create client-verified receipts. No finance in React or AI-generated dollar values. No live LLM processing of financial documents. Do not expand to regulated advice, trading or transfers.
- Keep the firm assurance flow unchanged. Keep `REVIEWED_WITH_LIMITATIONS` distinct from mathematically verified coverage. All future current authorization checks must honor revoked consent even when old snapshot remains immutable.
- Preserve synthetic demo, AI-E01–AI-E28, personal guided intake and scenario functionality, and all unit/build/e2e tests.

## Required completion report

1. Baseline SHA, branch, PR/CI state. 2. Data model/permission diagram. 3. Exact forward-only migration and file list. 4. Security positive/negative tests and their real/shim status. 5. Precise PR-003B/C/D remainder, G3 blockers and any conflicts with AI/UI branches. 6. No merge or deployment without explicit founder instruction.
