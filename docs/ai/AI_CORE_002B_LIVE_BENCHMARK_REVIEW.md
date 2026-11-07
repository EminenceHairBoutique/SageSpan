# AI-CORE-002b — live benchmark runbook, review protocol, and the production seams it prepares

**Status (2026-11-06 evening):** preparation complete on `feat/ai-core-002b-benchmark-prep`; **no live run has been executed in-repo** (no key exists in CI or in the build sandbox, by design). The founder confirmed the vendor (Anthropic Messages API) and pinned `claude-sonnet-5-5` (`docs/DECISIONS.md`); the pinned string must be verified against the vendor's current model list before it is exported. Everything here is synthetic-only; real data is gate G3.

## 1. What 002b adds

| Piece | Where | Purpose |
|---|---|---|
| Committed `diffReports` baselines | `apps/web/src/ai/evals/baselines/*.json`, `evals/baselines.ts`, `__tests__/ai-baselines.test.ts` | The validated report the two-turn mock produces for three frozen cases (Patel PASS, Patel UNSUPPORTED, Castillo). A test pins the mock to them; the live benchmark diffs a live model against the same files |
| Live benchmark writes JSON **and** Markdown | `__tests__/ai-hosted.live.test.ts` → `apps/web/.ai-bench/<ts>-hosted.{json,md}` (git-ignored) | One table a reviewer can read; invariants asserted, quality not |
| Async-capable `reauthorize()` | `runtime/tool-loop.ts` | The runtime awaits the resolver before every tool execution and before RECORD |
| `GroundingResolver`, `PersonalBundleSource`, `personalRepositoryResolver()`, `personalContextFromBundle()` | `evidence-resolver.ts` | Production personal grounding through the Data track's `PersonalRepository.bundle()` (RLS decides); demo and RLS backends share one interface |
| `runPersonalUnderstandForRepository()` | `review-orchestrator.ts` | Repository-backed personal run; persists only where `ai_runs` persist (demo); returns `persisted:false` + note for PRODUCTION |
| `ai-quota-v1` contract, `AiQuotaStore`, `InMemoryAiQuotaStore` | `packages/contracts/src/ai/quota.ts`, `apps/web/src/ai/quota/store.ts` | Per-workspace/household policy and reservation; the hosted provider reserves before any vendor call and fails closed when the store cannot answer |
| `run_id` on `ProviderInput` | `provider.ts`, `runtime/tool-loop.ts` | Lets a provider tie quota reservations and request ids to one run |

Tests: AI-C17…C21 (resolver), AI-Q01…Q06 (quota), AI-B (baselines) — all offline.

## 2. Preconditions for the founder's first live run

1. `master` (or this branch) checked out locally with `npm ci`; the calculator is **not** needed (the live test uses in-memory fixtures with receipted runs already attached).
2. The five gates exported in the shell that runs the test — never written to a file in the repo:
   ```
   export SAGESPAN_AI_PROVIDER=hosted
   export SAGESPAN_AI_HOSTED_API_KEY=<your key>
   export SAGESPAN_AI_HOSTED_MODEL=claude-sonnet-5-5        # verify the exact id in the Console first
   export SAGESPAN_AI_HOSTED_SYNTHETIC_ACK=I_UNDERSTAND_SYNTHETIC_ONLY
   export SAGESPAN_DEMO_MODE=1
   ```
   Optional ceilings: `SAGESPAN_AI_HOSTED_MAX_TOKENS`, `_TIMEOUT_MS`, `_PROCESS_TOKEN_CEILING`, `_RUNS_PER_SCOPE_PER_HOUR`, `_TOKENS_PER_SCOPE_PER_HOUR`.
3. Expect to spend tokens: three cases × up to two turns; the report records the total the vendor reported.

## 3. Run

```
cd apps/web
npx vitest run src/ai/__tests__/ai-hosted.live.test.ts
ls .ai-bench/            # <timestamp>-hosted.json and .md
```

If the test is **skipped**, a gate is missing — `resolveProvider(process.env).note` names it. If it **fails**, read the assertion: an invariant violation (a `VERIFIED` evidence status, an amount citing a run the finding does not reference, the key in a record, a non-draft report status) is a runtime bug and must be filed as such, not reviewed away.

## 4. Review protocol (what a human does with `.ai-bench/<ts>-hosted.md`)

For each case row:

| Column | Read it as | Acceptable | Investigate |
|---|---|---|---|
| Status | the runtime's outcome | `DRAFT_READY`, `ABSTAINED` | `REJECTED` (what did the validator refuse?), `ERROR` (vendor failure kind in issue codes) |
| Turns / Tools | did the model ask for evidence before drafting? | 2 turns with the case's read tool (`get_check_runs` / `read_personal_baseline`) | 1 turn with findings and no tool (drafted from the prompt alone), or denied tools |
| Denied | tool requests the runtime refused | 0 | any `FORBIDDEN_TOOL_CALL`, `TOOL_ARGS_INVALID`, `UNKNOWN_TOOL_CALL` in issue codes — record the attempted tool |
| Accepted / Rejected | findings that survived validation | mostly accepted | `AMOUNT_WITHOUT_TOOL_BACKING`, `UNRESOLVED_*`, `FORGED_LOCATOR`, `UNSUPPORTED_PROMOTED_TO_PASS` — each is a grounding failure of the model, caught |
| Added vs baseline | findings the live model made that the mock does not | fine if grounded and useful | invented categories, duplicates, speculation |
| Removed vs baseline | mock findings the live model missed | acceptable only with a reason | a missed `CHECK_DISCREPANCY` or `UNSUPPORTED_CHECK` is a miss on the case's point |
| Changed vs baseline | same `finding_id` with different fields | wording changes | changes in `check_run_refs`, `cited_amounts`, `severity`, `category` |

Then record in `docs/ai/AI_EVAL_MATRIX.md` (AI-CORE-002b entry): date, served model id (from the JSON `served_by`), total tokens, per-case status, the `diff_vs_baseline` summary, the reviewer's decision — **`KEEP MOCK DEFAULT` / `ALLOW HOSTED IN DEVELOPER SESSIONS` / `REWORK ADAPTER`** — and the reasons. A diff against the baseline is a difference from the deterministic mock, **not** a quality score; Suites C–F in `AI_EVALUATION_PLAN.md` define what a quality claim would need (≥ 50 withheld scenario groups, expert adjudication, denominators).

## 5. What a live run can and cannot change

- It cannot enable hosted mode anywhere: the default stays the mock; hosted needs the five gates per process.
- It cannot reach real data: `SAGESPAN_DEMO_MODE=1` is a gate; production `/app/personal` AI runs are not persisted (`persisted:false`) and the production AI entry point is not wired to a UI (UI-track request when the time comes).
- It can surface adapter bugs (structured-output mapping, tool_result replay) → fix under AI-H tests.
- It can inform the founder decision on whether a hosted model is worth AI-CORE-003 (knowledge) work before AI-CORE-004 (benchmark corpus).

## 6. Production seams this PR prepares (design only — no SQL in this PR)

### 6.1 Personal grounding under RLS (ready)
`personalRepositoryResolver(productionPersonalRepository())` gives the runtime an async resolver whose every call is a PostgREST read under the user's JWT (DATA-001/002). The runtime's `CONTEXT_CHANGED` check uses `snapshot_id` + `content_sha256` of the CURRENT personal snapshot, which DATA-002 persists. Firm-side production grounding waits for **DATA-003a** (`HouseholdBundle` production repository); the AI track will add `firmRepositoryResolver()` against that seam, not against tables.

### 6.2 AI run and feedback persistence (needs a migration number)
Proposed table set for the AI track's migration (request the number from `supabase/migrations/REGISTRY.md` when the SQL file is created — not in this PR):

| Table | Key columns | Rules |
|---|---|---|
| `app.ai_runs` | `id`, `scope_kind`, `workspace_id` (nullable), `org_id`/`household_id` (nullable), `snapshot_id`, `snapshot_sha256`, `analysis_kind`, `requested_by principal`, `provider`, `model`, `mode`, `prompt_version`, `run_status`, `report jsonb` (validated `ai-review-v1`), `validation_issues jsonb`, `runtime jsonb` (`ai-runtime-v1` trace — digests only), `raw_output_sha256`, `estimated_tokens`, `created_at` | append-only (no UPDATE/DELETE grants); RLS mirrors 0008 for personal scopes and 0003 for firm scopes; writes only through `app.record_ai_run(jsonb)` SECURITY DEFINER with `search_path` pinned, which re-derives the scope from the caller's principal and refuses a model-supplied scope |
| `app.ai_feedback` | `id`, `ai_run_id`, `finding_id`, `actor_principal_id`, `actor_role`, `action`, `edited_text`, `rationale`, `version`, `created_at` | append-only; `version` monotonic per (`ai_run_id`, `finding_id`); same RLS as the run |
| `app.ai_quota_usage` | `scope_key`, `reservation_id`, `started_at`, `tokens` (nullable until settled), `policy_sha256` | `app.ai_quota_reserve(scope, policy jsonb)` and `app.ai_quota_settle(reservation_id, tokens)` SECURITY DEFINER; reserve decides inside one transaction (`SELECT … FOR UPDATE` on the scope's window) so two instances cannot both admit the last run; no direct table grants |

Each ends with the grant audit (`PUBLIC`, `anon`, `authenticated`, `service_role`) and a `supabase/tests/NNNN_*.test.sql`; the `realstack` job then proves the RLS and the entry points. The TypeScript side is already shaped for it: `AiRunRecord` (immutable), `AiFeedback` (append-only), `AiQuotaStore` (reserve/settle) — a `SupabaseAiQuotaStore` and an `ai_runs` repository implement the existing interfaces.

### 6.3 Not prepared here
Rate limiting per *principal* (quotas follow the data scope by design); cost in USD (vendor pricing must be looked up and versioned); self-hosted adapter (AI-CORE-005).

## 7. Classification

| Capability | Status |
|---|---|
| Async resolver + repository-backed personal run | `IMPLEMENTED_SYNTHETIC`, `CI_TESTED` (AI-C17…C21) |
| `ai-quota-v1` + in-process store + hosted wiring | `IMPLEMENTED_SYNTHETIC`, `CI_TESTED` (AI-Q01…Q06) |
| Committed baselines + pinning test | `CI_TESTED` (AI-B) |
| Live benchmark run and review | `PROPOSED` — awaits the founder's local run |
| Durable quota / AI-run persistence | `PROPOSED` — design above; migration number not yet requested |
| Firm-side production grounding | `BLOCKED` on DATA-003a |
