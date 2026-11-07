# AI-CORE-002a — hosted adapter skeleton (synthetic-only, disabled by default)

**Status:** implemented on `feat/ai-core-002a-hosted-adapter` (stacked on `feat/ai-core-001-runtime`, 2026-11-06). Offline-tested against recorded vendor shapes (AI-H01…H10). **No live run has been executed in this repository**; the opt-in benchmark exists but needs a key you supply. Real-data processing remains gate G3.
**Founder decision (confirmed 2026-11-06 evening, AI-CORE-002b; `docs/DECISIONS.md`):** the first hosted port targets the **Anthropic Messages API**; the first benchmark model is pinned as `claude-sonnet-5-5` (verify the exact string in the Console before exporting it). Any other vendor plugs into the same `LiveProviderPort`; the runtime does not change.

## 1. What it is

| File | Role |
|---|---|
| `apps/web/src/ai/providers/port.ts` | `LiveProviderPort` (from AI-CORE-001) — now also carries `output_json_schema` |
| `apps/web/src/ai/providers/hosted-config.ts` | Enablement gates and ceilings from env; fails to the mock with a note naming the gate |
| `apps/web/src/ai/providers/anthropic-messages.ts` | Port implementation over plain `fetch` (no SDK, no new dependency, injectable fetch for tests) |
| `apps/web/src/ai/providers/hosted-provider.ts` | `AiProvider` over the port: per-process token ceiling, per-scope run limit, server request ids, typed errors |
| `apps/web/src/ai/provider.ts` | `resolveProvider()` wires `hosted` → `HostedProvider` only when every gate holds |
| `apps/web/src/ai/__tests__/ai-core-hosted.test.ts` | AI-H01…H14 offline suite (fake vendor) |
| `apps/web/src/ai/__tests__/ai-hosted.live.test.ts` | Opt-in live benchmark; skipped without the gates; writes `apps/web/.ai-bench/*.json` (git-ignored) |

## 2. Gates — all required, or the mock runs and says why

`SAGESPAN_AI_PROVIDER=hosted` · `SAGESPAN_AI_HOSTED_API_KEY` · `SAGESPAN_AI_HOSTED_MODEL` (pinned; **no default model id**) · `SAGESPAN_AI_HOSTED_SYNTHETIC_ACK=I_UNDERSTAND_SYNTHETIC_ONLY` · `SAGESPAN_DEMO_MODE=1`. `SAGESPAN_AI_HOSTED_BASE_URL` must be `https://`. Nothing here is read in the browser; the key never appears in a request body, a run record, a note or an error (AI-H02, H10).

Ceilings: `SAGESPAN_AI_HOSTED_MAX_TOKENS` (per completion), `_TIMEOUT_MS`, `_PROCESS_TOKEN_CEILING` (total tokens this process may spend), `_RUNS_PER_SCOPE_PER_HOUR` (per workspace / household). **Exceeding a ceiling produces an `ERROR` run from the hosted provider — never a quiet switch to the mock or to a cheaper model** (AI-H07, H08), because a substitute with different data-handling terms is a privacy event, not a fallback.

## 3. How a turn maps to the vendor API

- **Structured output by tool.** The model must call exactly one tool per turn: an allowlisted read tool (`read_facts`, `read_evidence`, `get_check_runs`, `read_personal_baseline`, `propose_scenario`, each with the strict JSON schema generated from `AI_TOOL_ARG_SCHEMAS`) or `emit_review` (schema generated from `EmitReviewSchema`: status ∈ {`DRAFT_FOR_HUMAN_REVIEW`, `ABSTAINED_INSUFFICIENT_EVIDENCE`}, ≤ 25 findings in the `ai-review-v1` finding shape, summary, memo, questions, limitations). `tool_choice: any` on turn 1; from turn 2 only `emit_review` is offered and forced, so the model cannot ask for tools past the runtime's turn budget.
- **Continuation.** The model's own tool calls are replayed as `tool_use` blocks with the vendor's ids; the runtime's envelopes become `tool_result` blocks — executed calls as `{untrusted_data:true, result}` and denied calls as `is_error:true` with the reason only (AI-H03, H04). Free text from the model is ignored and counted.
- **Response → `AiModelOutput`.** `emit_review.input` becomes the untrusted draft; read `tool_use` blocks become `tool_calls` with `call_id = block.id`. The validator then does exactly what it does for the mock: a live `APPROVED`, an invented `$31,000.00` or a foreign fact id is rejected (AI-H05).
- **Failures.** 429 → `RATE_LIMITED` (retry-after surfaced), 401/403 → `UNAVAILABLE` "credentials rejected", 5xx → `UNAVAILABLE` with status and `error.type` only, `stop_reason: refusal` → `REFUSED`, prose-only or `max_tokens` before any tool call → `MALFORMED_OUTPUT`, non-JSON → `MALFORMED_OUTPUT`, abort → `TIMEOUT`. Each becomes an `ERROR` run whose detail carries the kind and the server request id, never the vendor body (AI-H06).
- **What ran is what is recorded.** The port remembers the `model` the vendor reports; the runtime describes the provider *after* the turns, so `runtime.provider_descriptor.model` / `model_revision` is the served id, `data_handling = HOSTED_VENDOR`, `mode = LIVE` (AI-H03).

## 4. Running the opt-in live benchmark

```
cd apps/web
export SAGESPAN_AI_PROVIDER=hosted SAGESPAN_AI_HOSTED_API_KEY=… SAGESPAN_AI_HOSTED_MODEL=… \
       SAGESPAN_AI_HOSTED_SYNTHETIC_ACK=I_UNDERSTAND_SYNTHETIC_ONLY SAGESPAN_DEMO_MODE=1
npx vitest run src/ai/__tests__/ai-hosted.live.test.ts
```

It runs Patel (firm) and Castillo (personal) through the live adapter and the two-turn mock, asserts only runtime invariants (no `VERIFIED`, every amount cites a run it references, no key in the record), and writes a JSON report with `diffReports` against the mock for a human review. It is **not** a quality score; see `AI_EVALUATION_PLAN.md` Suites C–F for what a quality claim would need.

## 5. Not done in 002a (and why)

- No live run has been executed here: no key exists in this environment, by design.
- No per-request cost in USD (`cost_usd_estimate` is `null`): pricing is a vendor fact that must be looked up and versioned, not hard-coded.
- No persistent rate limiting or token metering (per-process memory only): **AI-CORE-002b** replaced the ad-hoc counters with the `ai-quota-v1` contract and an `AiQuotaStore` interface (still per-process); the durable store and AI-run tables are the AI track's future migration, numbered only through `supabase/migrations/REGISTRY.md`.
- No vendor DPA, retention review, incident runbook or founder vendor sign-off: those are the G3 items that gate real data, and they are documented in `FEATURE_RELEASE_GATES.md`.
- No self-hosted adapter: `self_hosted` still resolves to the mock (AI-CORE-005).

## 6. Promotion rule for this adapter

Before `hosted` is enabled anywhere outside a developer's own synthetic session: (1) AI-E01…E28, AI-C01…C16 and AI-H01…H14 green; (2) at least one live benchmark report reviewed with `diffReports` on the frozen fixtures; (3) a founder decision on vendor and data-handling class recorded in `docs/DECISIONS.md`; (4) for anything beyond synthetic data, the G3 gates.

## 2026-11-06 — first live attempt and `tool_choice` (fix/ai-hosted-tool-choice)

The founder's first local run with a real key and `SAGESPAN_AI_HOSTED_MODEL=claude-sonnet-5-5` failed closed with `ERROR` / 0 tokens. A direct one-line Messages call with the same key and model succeeded, and a diagnostic that printed the vendor body showed:

`HTTP 400 invalid_request_error — tool_choice: type "tool" and "any" are not supported for this model.`

Changes:

- `SAGESPAN_AI_HOSTED_TOOL_CHOICE` = `auto` (**default**) | `forced`. `auto` sends `tool_choice: {type: "auto"}`; on the final (`force_final`) turn only `emit_review` is offered, the system prompt requires a tool call, and a turn with no tool call is still `MALFORMED_OUTPUT` → `ERROR` (fail closed, no report). `forced` keeps the original `any` / named-tool behaviour for models that accept it. Any other value disables the hosted provider with a note (AI-H11).
- Request errors (4xx other than 401/403/429) now carry the vendor's `error.message`, whitespace-collapsed, truncated to 300 characters, with the configured key and anything `sk-…`-shaped replaced by `[redacted]`. 5xx and auth failures are unchanged (status and type only) (AI-H12, AI-H06, AI-H10).
- `ai-hosted.live.test.ts` now fails with the runs' issue details before the token assertion, and the written report includes `issue_details`, so a bad key or unsupported parameter says why instead of "expected 0 to be greater than 0".

- **Second attempt (same evening):** the 400 was gone, but both completions hit the 15 s per-completion timeout. Hosted runs now get a hosted-sized wall clock: `SAGESPAN_AI_HOSTED_TIMEOUT_MS` defaults to 50 s (max 110 s) and `SAGESPAN_AI_HOSTED_RUN_WALL_CLOCK_MS` to 110 s (max 120 s, the `AiRunBudgetSchema` cap). The provider passes the latter to the runtime as `budgetHint`; a caller's explicit budget still wins, and the mock keeps 20 s (AI-H13). The live test's own timeout is 600 s.

**Third attempt (after #22 merged): passed** on the founder's machine — Anthropic Messages API, `claude-sonnet-5-5`, synthetic Patel/Castillo fixtures, every invariant in `ai-hosted.live.test.ts` held. The report (`apps/web/.ai-bench/*-hosted.json`) is git-ignored and stays on that machine; review #1 is `docs/ai/AI_LIVE_BENCHMARK_REVIEW_2026-11-06.md` (invariants pass; content not captured, so the live report now records finding content and an evidence-based `alignReports` view, AI-H14). The vendor/model is recorded in `docs/DECISIONS.md` for **synthetic development only**; real data remains G3.
