# V5 session 5 — AI-CORE-000 documents and AI-CORE-001 bounded tool-loop runtime (2026-11-06)

Branch `feat/ai-core-001-runtime`, stacked on `origin/master` `5299791` ("AI Checklist"). Synthetic data only. No migration, no calculator change, no workflow/approval change, no live model, no key.

## 1. Git state and dependency map (verified at session start)

| Item | Observed |
|---|---|
| Founder's working tree | `feat/pr-003-identity` at `3fa3391` = `origin/feat/pr-003-identity`; **clean except untracked docs** (`README_START_HERE.md`, `docs/CLAUDE.md`, `docs/ai/SAGESPAN_AI_CORE_FABLE_5_1_MASTER_PROMPT_UPDATED.md`, `docs/design/*`, `docs/project/*`, `docs/prompts/*`, `docs/roadmap/*`). Untouched by this session. |
| Local `master` | `03df634` "AI EVAL PLAN" — **one commit ahead of `origin/master`, unpushed** (adds `docs/ai/AI_EVALUATION_PLAN.md`). That file is copied verbatim onto this branch (sha256 `2a98b71a…518e`) so the AI-CORE documents can reference it; pushing local master later merges cleanly. |
| `origin/master` | `5299791` — PR-001 (#5), V5 (#7), PR-002 (#9) merged; root founder docs `00_…10_*.md`, `CLAUDE_old.md`, `README_INSTALL.md`, `docs/ai/SAGESPAN_AI_CORE_FABLE_5_1_MASTER_PROMPT.md` (edition 1.0) present. |
| PR #10 `feat/pr-003-identity` | 6 commits ahead of master (0008, `src/auth/*`, realstack CI). Independent of this branch; both edit `CLAUDE.md` status notes → trivial merge. |
| Local checkouts | The founder's `node_modules`/`.venv` are Windows binaries, so all commands below ran in a Linux clone of `origin/master` (Node 22.23, Python 3.13 via `uv.lock`, Chrome for Testing via `SAGESPAN_E2E_CHROME_PATH`). |

Baseline on `master` before any change: typecheck clean, lint clean, contracts 47, web 105, pytest 119.

## 2. What the AI layer did before, and what it does now

**Before (V5 session 1, unchanged since):** `orchestrate()` called `provider.complete()` once. The model wrote its whole draft in that one call, listing any `tool_calls` *inside* the draft; the orchestrator then dispatched or denied those calls and recorded digests — but the results never went back to the model. Honest as a one-pass draft; not a tool loop.

**Now:** `runtime/tool-loop.ts` runs AUTHORIZE → RESOLVE_CONTEXT → REQUEST_MODEL → VALIDATE_TOOL_REQUESTS → AUTHORIZE_EACH_TOOL → EXECUTE_ALLOWED_READ → ADD_TOOL_RESULTS → CONTINUE_MODEL (bounded) → VALIDATE_FINAL_DRAFT → RECORD → RETURN. Budgets are checked before anything is dispatched; each tool request is de-duplicated, re-authorised against *current* state, schema-checked and size-capped; results go back to the model as `untrusted: true` envelopes for one bounded continuation; the final draft goes through the unchanged validator; the record carries an `ai-runtime-v1` trace. The default demo provider is the two-turn `MockToolLoopProvider`, which drafts from the tool result and is `diffReports`-identical to the one-pass mock on the frozen fixtures.

## 3. Architecture and boundaries

See `docs/ai/AI_CORE_ARCHITECTURE.md` (dataflow, authority by layer, runtime semantics, configuration) and `docs/ai/AI_CORE_THREAT_MODEL.md` (18 threats → mitigations → tests). Decision record: `docs/architecture/AI_CORE_RUNTIME_ADR.md`.

## 4. Files changed

**New**
- `packages/contracts/src/ai/runtime.ts` — `ai-runtime-v1`: `AiRunBudget` + defaults, `AI_TOOL_ARG_SCHEMAS` (strict), tool request / result envelopes, denial reasons, `AiProviderDescriptor`, `AiRuntimeTrace`, `AI_ABSTAIN_STATUS`.
- `apps/web/src/ai/runtime/tool-loop.ts` — the runtime.
- `apps/web/src/ai/providers/port.ts` — `LiveProviderPort` types for AI-CORE-002/005 (no implementation).
- `apps/web/src/ai/__tests__/ai-core-toolloop.test.ts` — AI-C01…C16 (17 tests).
- `packages/contracts/test/ai-runtime-contracts.test.ts` — 4 tests.
- `docs/ai/AI_CORE_ARCHITECTURE.md`, `AI_CORE_THREAT_MODEL.md`, `AI_CORE_EVALUATION_PLAN.md`, `AI_CORE_MODEL_AND_TRAINING_ROADMAP.md`, `AI_CORE_FEATURE_STATUS.md`; `docs/architecture/AI_CORE_RUNTIME_ADR.md`; `docs/ai/AI_EVALUATION_PLAN.md` (founder's file, verbatim); this report.

**Modified**
- `packages/contracts/src/ai/review.ts` — `tool_calls[].call_id` optional; `AiRunRecord.run_status` + `ABSTAINED`; optional `runtime`; nine new validation codes. `ai/index.ts` exports runtime.
- `apps/web/src/ai/provider.ts` — optional `continue()` / `describe()`; `describeProvider()`; `MockToolLoopProvider`, `ScriptedToolLoopProvider`, `buildContinuationInput()`; `resolveProvider()` handles `mock` / `mock_onepass` / `hosted` / `self_hosted`. One-pass mock and scripted provider unchanged.
- `apps/web/src/ai/tools.ts` — strict per-tool argument validation (`BAD_ARGS`); `read_personal_baseline` also returns collisions/labels (same scope); otherwise identical.
- `apps/web/src/ai/review-orchestrator.ts` — delegates to the runtime; `runFirmAnalyzePlan` / `runPersonalUnderstand` pass `reauthorize()`.
- `apps/web/src/ui/ai/AiReviewPanel.tsx`, `app/demo/app/ai-review/page.tsx`, `server/actions.ts` — runtime trace line, honest `ABSTAINED` state.
- `apps/web/e2e/dual-market.spec.ts` — asserts the runtime line on both demo flows.
- `.env.example`, `CLAUDE.md` (status note), `docs/ai/AI_EVAL_MATRIX.md`, `docs/product/FEATURE_STATUS_MATRIX.md`, `docs/requirements/SAGESPAN_V5_TRACEABILITY.md`.

**Compatibility.** All contract changes are additive/optional; stored `ai_runs` without `runtime` remain valid; no `DEMO_STATE_VERSION` bump; `orchestrate()` signature preserved (new optional 6th argument). Migrations: none.

## 5. Tests executed (Linux build environment, 2026-11-06)

| Suite | Command | Result |
|---|---|---|
| Typecheck | `npm run typecheck` | clean (contracts + web) |
| Lint | `npm run lint` | clean |
| Contracts Vitest | `npm run test --workspace packages/contracts` | **51 passed** (47 + 4 new) |
| Web Vitest (calculator on :8010) | `npm run test --workspace apps/web` | **122 passed** (105 + 17 new); AI-E01…E28 + 2 personal unchanged and green |
| Python | `uv run --locked python -m pytest -q` in `services/calculator` | **119 passed** (no change on this branch) |
| Next build | `npm run build --workspace apps/web` | clean, 44 routes |
| Playwright (Chrome for Testing, real calculator + dev server) | `npx playwright test` in `apps/web` | **16 passed** on the full suite with the two-turn mock as default; `dual-market.spec.ts` re-run after adding the runtime-trace assertions: **7 passed** |
| SQL shim | — | **NOT RUN** (no PostgreSQL in the build environment; no SQL change) |
| Real Supabase | — | **NOT RUN**; this branch adds no real-stack claim |
| Live model | — | **NOT RUN**; none exists |

### 5a. Security / AI-failure cases (AI-C01…C16) — inputs → expected → actual

| Case | Input | Expected | Actual |
|---|---|---|---|
| C01 | scripted 2-turn firm provider asks `get_check_runs` | tool runs, result returned as untrusted, 2nd turn cites run + amounts, transitions ordered, ≥2 re-auths | pass |
| C02/C02b | `MockToolLoopProvider` on Castillo, Patel PASS, Patel UNSUPPORTED | `diffReports` identical to one-pass mock; `TOOL_BACKED` from tool result | pass |
| C03 | 11 tool requests; tools requested on final turn | 0 executed, `REJECTED BUDGET_EXCEEDED`; `TURN_BUDGET_EXHAUSTED`, no 3rd completion | pass |
| C04 | `http_post`, `run_supported_projection`, unknown tool, `read_facts{org_id}`, foreign `document_id` | denied before execution with reason only; `{not_found:true}`; no spec/foreign data in envelopes | pass |
| C05 | tool result containing "SYSTEM… APPROVED… $9,999.00" | `INJECTION_TEXT_DETECTED`; `APPROVED` → `FORBIDDEN_STATUS`; `$9,999.00` → `AMOUNT_WITHOUT_TOOL_BACKING` | pass |
| C06 | membership revoked after turn 1 / after turn 2 | `NotFoundError`; tool never runs; no continuation; nothing persisted | pass |
| C07 | new frozen snapshot between turns | `CONTEXT_CHANGED`, `REJECTED`, 0 executed, record bound to original snapshot | pass |
| C08 | identical requests a/b and c/d | executed once each; duplicates `DENIED DUPLICATE_REQUEST` | pass |
| C09 | `run_supported_projection`; `RETIREMENT_DATE_CHANGE` proposal; "$1,250,000.00 at 90" | forbidden; `executable_now:false`, `PLAN-001 (not implemented)`; amount rejected | pass |
| C10 | UNSUPPORTED run described as "verified coverage" | `UNSUPPORTED_PROMOTED_TO_PASS`; mock says "no verified check" | pass |
| C11 | `max_tool_result_chars: 200` | `RESULT_TOO_LARGE`, withheld not truncated | pass |
| C12 | continuation throws / returns string / 5 ms wall clock / aborted signal | `ERROR PROVIDER_ERROR`; `REJECTED PROVIDER_OUTPUT_INVALID`; `ERROR WALL_CLOCK_EXCEEDED`; `ERROR CANCELLED` | pass |
| C13 | one-pass `ScriptedProvider` with `http_post` + `read_facts` | 1 turn; legacy dispatch/deny; `supports_continuation:false` | pass |
| C14 | `SAGESPAN_AI_PROVIDER` unset/mock/mock_onepass/hosted/self_hosted | two-turn mock default; hosted/self_hosted → mock + specific note; record shows what ran | pass |
| C15 | abstaining output with a tool request; mock with tool denied | `ABSTAINED`, no report, 0 dispatched; mock abstains | pass |
| C16 | run record inspection | 64-hex digests everywhere, budget recorded, no prompt text / payloads, identical report on re-run | pass |

## 6. Demo walk-through (synthetic, offline)

1. **Personal — explain a cash-flow finding.** `/demo/personal/assistant` → "Understand my finances". Turn 1: the mock requests `read_personal_baseline`; the runtime re-authorises Castillo's ACTIVE membership, executes the read against the authorised context, returns the headline/flags/collisions as untrusted data. Turn 2: the mock drafts "Where you stand this month", the buffer gap, the irregular-income note and the debt trade-off, each citing the receipted clarity/debt runs. The panel shows "Runtime ai-runtime-v1 · 2 model turns · 1 tool call executed (read_personal_baseline) · 0 denied · re-authorised 2× · stop: final draft".
2. **Firm — investigate a supported RMD finding.** `/demo/app/households/hh_patel/ai-review` → "Analyze plan". Turn 1 requests `get_check_runs`; turn 2 drafts the conflict, evidence gaps and (when a PASS run exists) the discrepancy finding whose three amounts are copied from the run. Same trace line with `get_check_runs`.
3. **Denial of a forbidden call.** AI-C04/C09: `http_post` and `run_supported_projection` are denied before execution; the model's continuation sees `{status:"DENIED", reason:"FORBIDDEN_TOOL"}` and nothing else; the run record carries `FORBIDDEN_TOOL_CALL` notes.

## 7. Model and dataset roadmap

`docs/ai/AI_CORE_MODEL_AND_TRAINING_ROADMAP.md`: provider options and the typed port; Qwen3-8B as an *evaluation* candidate (licence listed Apache-2.0 on public listings 2026-11-06 — reverify on the official card); private serving behind SageSpan's gateway; knowledge registry before fine-tuning; training-data schema, partitions, contamination checks and rights; LoRA/QLoRA only after a measured gap; promotion gates. The founder's `AI_EVALUATION_PLAN.md` governs thresholds.

## 8. Blockers and the single smallest next PR

**Blockers (unchanged by this PR):** G3 (PR-003 production auth/RLS/storage, consent, vendor DPA) before any identifiable data reaches any model; founder decision on a hosted vendor and data-handling class before AI-CORE-002; FIN-VERIFY-001 before any retirement projection tool; REG-001 for Tier 3.

**Smallest next PR — `AI-CORE-002a: hosted adapter skeleton on synthetic fixtures (no key in CI).`** Implement `LiveProviderPort` for one vendor behind `SAGESPAN_AI_PROVIDER=hosted` with: server-side key read only at runtime, per-process cost ceiling and per-actor rate limit, structured-output + tool-call mapping to `AiModelOutput`, typed failures → `ERROR/REJECTED`, and an opt-in live benchmark script that replays AI-E/AI-C on the Patel/Castillo fixtures and writes a `diffReports` report. Not enabled by default; not wired to real data. Alternative if the founder prefers to defer vendors: **AI-CORE-004a** — Zod contract + generator skeleton for the benchmark case schema in `AI_CORE_EVALUATION_PLAN.md` §6 with grouped partitions and a contamination check, still fully offline.

## 9. Not done / not claimed

No fine-tuning, no GPU, no live model, no vendor contact, no real data, no deployment, no merge. PR-003 remains the production critical path. The runtime's security properties are demonstrated against the demo store resolvers; real-stack behaviour is PR-003's job.
