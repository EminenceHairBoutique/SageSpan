# AI-CORE-002b — live benchmark runbook, review protocol, and the production seams it prepares

**Status (2026-11-06 evening, after #22/#23/#26):** the **first live run has happened and passed** — on the founder's machine, synthetic Patel + Alvarez fixtures, `claude-sonnet-5-5` on the Anthropic Messages API, every run `DRAFT_READY` with 0 denied tools, 0 rejected findings and 0 validation issues (review #1: `docs/ai/AI_LIVE_BENCHMARK_REVIEW_2026-11-06.md`). The vendor and model are founder decisions recorded in `docs/DECISIONS.md`; the model id is verified by a served run (the record's `provider_descriptor.model` matched the pinned id). CI and the build sandbox hold **no key** and never run the live test. Review #1 found that **content could not be reviewed**: the report stored categories only and `diffReports` keys on ids the live model does not reuse (`F1`…`F8`). This branch folds in #26 (`alignReports`, content capture) and adds the committed baselines so **review #2** can read a live draft against the mock. Everything here is synthetic-only; real data is gate G3.

## 1. What 002b adds

| Piece | Where | Purpose |
|---|---|---|
| Committed baselines | `apps/web/src/ai/evals/baselines/*.json`, `evals/baselines.ts`, `__tests__/ai-baselines.test.ts` | The validated report the two-turn mock produces for three frozen cases (Patel PASS, Patel UNSUPPORTED, Castillo). A test pins the mock to them; the live benchmark aligns a live model against the same files |
| `alignReports()` (from #26, AI-H14) | `evals/regression.ts` | Pairs findings by the **evidence they cite** (fact / document / check-run ids), best-first, preferring the same category; lists `reference_only` (possible coverage gaps) and `candidate_only` (new observations). A reading aid, never a score. `diffReports` stays for same-provider regressions (mock vs mock) |
| Live benchmark writes JSON **and** Markdown with content | `__tests__/ai-hosted.live.test.ts` → `apps/web/.ai-bench/<ts>-hosted.{json,md}` (git-ignored) | Per case: run summary, **validated content** (summary, memo, questions, limitations, every finding's title/explanation/refs/amounts), id-keyed diff, evidence-based alignment, invariant violations; vendor errors carry their reason (never "0 tokens") |
| Async-capable `reauthorize()` | `runtime/tool-loop.ts` | The runtime awaits the resolver before every tool execution and before RECORD |
| `GroundingResolver`, `PersonalBundleSource`, `personalRepositoryResolver()`, `personalContextFromBundle()` | `evidence-resolver.ts` | Production personal grounding through the Data track's `PersonalRepository.bundle()` (RLS decides); demo and RLS backends share one interface |
| `runPersonalUnderstandForRepository()` | `review-orchestrator.ts` | Repository-backed personal run; persists only where `ai_runs` persist (demo); returns `persisted:false` + note for PRODUCTION |
| `ai-quota-v1` contract, `AiQuotaStore`, `InMemoryAiQuotaStore` | `packages/contracts/src/ai/quota.ts`, `apps/web/src/ai/quota/store.ts` | Per-workspace/household policy and reservation; the hosted provider reserves before any vendor call and fails closed when the store cannot answer |
| `run_id` on `ProviderInput` | `provider.ts`, `runtime/tool-loop.ts` | Lets a provider tie quota reservations and request ids to one run |

Tests: AI-C17…C21 (resolver), AI-Q01…Q06 (quota), AI-B (baselines), AI-H14 (alignment, from #26) — all offline. #22's AI-H11…H13 (`tool_choice` auto, vendor error reason, hosted wall clock) are preserved.

## 2. Preconditions for a live run (review #2 onwards)

1. `master` (or this branch) checked out locally with `npm ci`; the calculator is **not** needed (the live test uses in-memory fixtures with receipted runs already attached).
2. The five gates exported in the shell that runs the test — never written to a file in the repo:
   ```
   export SAGESPAN_AI_PROVIDER=hosted
   export SAGESPAN_AI_HOSTED_API_KEY=<your key>
   export SAGESPAN_AI_HOSTED_MODEL=claude-sonnet-5-5        # founder-pinned; verified by the served model on run #1
   export SAGESPAN_AI_HOSTED_SYNTHETIC_ACK=I_UNDERSTAND_SYNTHETIC_ONLY
   export SAGESPAN_DEMO_MODE=1
   ```
   Optional: `SAGESPAN_AI_HOSTED_TOOL_CHOICE` (`auto` default — `claude-sonnet-5-5` rejects a forced `tool_choice` with HTTP 400, #22), `_TIMEOUT_MS` (default 50 s; run #1 needed > 15 s per completion), `_RUN_WALL_CLOCK_MS` (default 110 s), `_MAX_TOKENS`, `_PROCESS_TOKEN_CEILING`, `_RUNS_PER_SCOPE_PER_HOUR`, `_TOKENS_PER_SCOPE_PER_HOUR`.
3. Expect to spend tokens: three cases × up to two turns (run #1 used ~15k vendor-reported tokens per case); the report records the vendor-reported total. Expect 1–3 minutes per case.

## 3. Run

```
cd apps/web
npx vitest run src/ai/__tests__/ai-hosted.live.test.ts
ls .ai-bench/            # <timestamp>-hosted.json and .md
```

If the test is **skipped**, a gate is missing — `resolveProvider(process.env).note` names it. If it **fails**, read the assertion: an invariant violation (a `VERIFIED` evidence status, an amount citing a run the finding does not reference, the key in a record, a non-draft report status) is a runtime bug and must be filed as such, not reviewed away; a vendor error is reported with the vendor's bounded reason (e.g. the HTTP 400 that forced `tool_choice` produced on run #1).

## 4. Review protocol (what a human does with `.ai-bench/<ts>-hosted.md`)

Review #1 established the two rules of this section: **ids cannot be compared** (the live model names findings `F1`…`F8`), so read the **alignment** table, not the diff; and **categories are not content**, so read the captured findings.

**Step 1 — Runs table.** For each case row:

| Column | Read it as | Acceptable | Investigate |
|---|---|---|---|
| Status | the runtime's outcome | `DRAFT_READY`, `ABSTAINED` | `REJECTED` (what did the validator refuse?), `ERROR` (vendor reason in the case section) |
| Turns / Tools | did the model ask for evidence before drafting? | 2 turns; the case's read tool among those requested (run #1: the live model also read `read_facts` / `read_evidence` in the firm case — allowed, in scope) | 1 turn with findings and no tool; or `get_check_runs` in a **personal** scope (run #1 did this — in scope and empty, but check what the model then wrote) |
| Denied | tool requests the runtime refused | 0 | any `FORBIDDEN_TOOL_CALL`, `TOOL_ARGS_INVALID`, `UNKNOWN_TOOL_CALL` — record the attempted tool |
| Accepted / Rejected | findings that survived validation | mostly accepted | `AMOUNT_WITHOUT_TOOL_BACKING`, `UNRESOLVED_*`, `FORGED_LOCATOR`, `UNSUPPORTED_PROMOTED_TO_PASS`, `REDACT_TEXT` — each a grounding failure of the model, caught |
| Baseline pairs | baseline findings with an evidence-matched live counterpart | all material baseline findings paired, `same_category = yes` | a pair with **no** in Same category (same evidence, different reading) |
| Baseline-only (gaps) | mock findings no live finding cites the same evidence for | none, or only INFO/EDUCATION items with a reason | a missing `CHECK_DISCREPANCY`, `UNSUPPORTED_CHECK`, `CONFLICTING_FACTS` — the case's point was missed |
| Live-only (new) | live findings citing evidence the mock did not | fine if grounded and useful | invented categories, duplicates, speculation, audit-register items in a personal scope |

**Step 2 — Content, per case.** Read each live finding's title, explanation, refs and amounts:
- Firm (Patel PASS): are the mock's balance and custodian conflicts present? Is the discrepancy described with the **engine's** figures only (25098.04 / 24000.00 / 1098.04 from the cited run)? Does any text imply approval, verification or advice?
- Firm (Patel UNSUPPORTED): does the draft say there is **no verified check** and route to a human, without describing the account as covered?
- Personal (Castillo): is the register consumer-facing (where you stand, buffer, irregular income, debt trade-off, education) rather than audit-style? Run #1 produced `MISSING_EVIDENCE`, `UNSUPPORTED_CHECK` and a `CHECK_DISCREPANCY` with **no education item** — what does a personal "discrepancy" refer to, given the workspace has receipted baseline runs and no plan-vs-engine checks? Does any text promise an outcome?
- All: `Limitations` must still carry the server lines (AI-drafted; amounts copied from receipts; scope).

**Step 3 — Record.** In `docs/ai/AI_EVAL_MATRIX.md` (live-run table): date, served model id (JSON `served_by`), vendor-reported tokens, per-case status, pairs / gaps / new counts, the content answers above, and the decision — **`KEEP MOCK DEFAULT` / `ALLOW HOSTED IN DEVELOPER SESSIONS` / `REWORK ADAPTER`** — with reasons. If the review is done by a Claude Code session for the founder, say so: it is not an independent validation and the status vocabulary does not change. A difference from the baseline is a difference from the deterministic mock, **not** a quality score; Suites C–F in `AI_EVALUATION_PLAN.md` define what a quality claim would need (≥ 50 withheld scenario groups, expert adjudication, denominators).

## 5. What a live run can and cannot change

- It cannot enable hosted mode anywhere: the default stays the mock; hosted needs the five gates per process.
- It cannot reach real data: `SAGESPAN_DEMO_MODE=1` is a gate; production `/app/personal` AI runs are not persisted (`persisted:false`) and the production AI entry point is not wired to a UI (UI-track request when the time comes).
- It can surface adapter bugs (structured-output mapping, tool_result replay) → fix under AI-H tests. Run #1 did exactly that: forced `tool_choice` → HTTP 400 and a 15 s timeout too short for the model, both fixed in #22 (AI-H11…H13).
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
| Live benchmark run #1 | **Done on the founder's machine (synthetic)**; invariants pass; content not reviewed; not accepted for promotion (`docs/ai/AI_LIVE_BENCHMARK_REVIEW_2026-11-06.md`) |
| Live benchmark review #2 (content, with alignment + baselines) | `PROPOSED` — rerun on this branch or on `master` after merge |
| Durable quota / AI-run persistence | `PROPOSED` — design above; migration number not yet requested |
| Firm-side production grounding | `BLOCKED` on DATA-003a |
