# ADR-V5-001 — Dual-market workspaces on one trusted foundation

**Status:** Accepted (founder decision 2026-11-05: SageSpan is B2C **and** B2B). Implemented in synthetic mode on `feat/v5-dual-market`.
**Owner:** founder / engineering. **Review date:** before PR-003 schema work.

## Decision

1. **One codebase, one calculation service, two workspaces.** The firm assurance console (`/demo/app`) and the new Personal workspace (`/demo/personal`) share `packages/contracts`, the Python calculation service and the demo store. They do **not** share routes, actors, navigation or authority.
2. **Tenancy model.** A *principal* may own a `PERSONAL` workspace, join a `HOUSEHOLD` workspace with per-domain grants, and belong to a `FIRM` workspace. A `FIRM` workspace maps 1:1 onto the historical `organizations` row (`firm_org_id`); all existing `org_id`-scoped tables, RLS and workflow functions are untouched. Consumer records carry `workspace_id` instead.
3. **No implicit cross-boundary access.** Firm membership never reaches a personal workspace; household membership never reaches undeclared domains. Any crossing requires an ACTIVE, unexpired `ConsentGrant` naming resources (domains), purpose, grantee, expiry and retention note; `actorCanReadDomain()` is the single predicate and is unit-tested.
4. **Separate demo identities.** The firm persona cookie (`sagespan_demo_persona`) and the personal principal cookie (`sagespan_demo_principal`) are independent; switching a firm persona cannot change who the personal workspace belongs to. Production identity (Supabase Auth, PR-003) replaces only the cookie lookup; the `WorkspaceActor` shape stays.
5. **Deterministic math stays in the calculation service.** New Personal engines (`personal.cashflow_baseline`, `personal.debt_amortization`) live beside the RMD engine; the web tier builds requests from a dated personal snapshot, re-derives the request hash, requires the trusted engine name and PUBLISHED method sets, and stores ERROR runs without amounts on any failure (mirror of S-04).
6. **Methodology sets vs regulatory rule sets.** Consumer calculation conventions are registered in `app/financial/methods.py` (`METHODOLOGY_SETS`), **separate** from `ALL_RULE_SETS`, because `ALL_RULE_SETS` generates the applied, forward-only migration `0006_seed_rule_sets.sql`. Method sets will be seeded by a new migration when the personal engines are persisted to Postgres. `/v1/methods` exposes them; `/v1/rules` is unchanged.
7. **Decision policy is code in contracts, not an LLM.** `decision-policy.v1` evaluates engine outputs: hard constraints reject, explicit weights rank, at most three primary actions, tiers 3–4 disabled. It performs no arithmetic on amounts.
8. **AI is a server-owned orchestrator over an evidence resolver.** Both audiences use the same orchestrator, validator and tool allowlist; only the resolver differs (`resolveFirmContext` vs `resolvePersonalContext`), each authorising with the existing checks and loading nothing outside the scope.
9. **Demo state versioning.** `DataState.state_version` is `sagespan.demo-state.v3` (v2 added the V5 collections; v3, PERS-002, adds `personal_record_revisions` and the `retired` flag on personal records); an older file is reseeded (synthetic only). Firm collections are unchanged; new collections are additive.

## Alternatives considered

- *Model consumers as a firm of one (`organizations` row per person).* Rejected: it would silently inherit firm roles/permissions, make a client's private data a firm asset, and complicate RLS. V5 §9 forbids merging consumer accounts into firm access by default.
- *Compute consumer baselines in TypeScript for speed.* Rejected: violates "no authoritative financial math in React/Next"; receipts and cross-tier reproducibility would be lost.
- *Add consumer method sets to `ALL_RULE_SETS`.* Rejected: would modify applied migration 0006 (forward-only policy) and mix methodology with effective-dated regulation.
- *Let the mock provider set evidence status.* Rejected: the validator sets `TOOL_BACKED`/`UNVERIFIED`/`HYPOTHESIS`; a model-asserted status is never trusted.

## Consequences

- Both audiences are visible from the public site and both demo paths run end to end on synthetic data without production identity.
- Proposed schema for production (not executed on this branch): `principals`, `workspaces`, `workspace_memberships`, `consent_grants`, personal record tables, `personal_snapshots`, `personal_calc_runs`, `user_decisions`, `ai_runs`, `ai_feedback`, each with `workspace_id` RLS and trusted write paths. Firm tables keep `org_id`. Adapter, not duplication, for `facts`/`households`.
- Migration path: PR-003 introduces the tables above as new forward-only migrations with RLS and real-stack tests (two firms, two unrelated consumers, a household with limited permissions, a firm-client grant, expiry and revocation).
- Rollback: the Personal routes, contracts and engines are additive; removing them leaves the firm console exactly as before. The `state_version` bump reseeds synthetic demo state only.

## Open decisions (founder / counsel)

- Whether SageSpan registers as an investment adviser, partners with one, or confines consumer outputs to education and budgeting decision support (REG-001).
- Legal privacy/ownership model for household sharing and client-to-firm grants, including retention exceptions.
- Which retirement modules receive independent professional verification first (FIN-VERIFY-001).
