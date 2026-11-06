# AI-CORE architecture — SageSpan Intelligence runtime (AI-CORE-000/001)

**Status:** AI-CORE-001 implemented in synthetic mode on `feat/ai-core-001-runtime` (2026-11-06). Offline deterministic providers only; no live model, no vendor key, no real data. Everything marked *proposed* below is not built.
**Companions:** `AI_CORE_THREAT_MODEL.md`, `AI_CORE_EVALUATION_PLAN.md`, `AI_CORE_MODEL_AND_TRAINING_ROADMAP.md`, `AI_CORE_FEATURE_STATUS.md`, the founder's `AI_EVALUATION_PLAN.md`, the existing `AI_EVAL_MATRIX.md`, ADR `docs/architecture/AI_CORE_RUNTIME_ADR.md`.

## 1. What exists and what changed

| Component | File (apps/web unless noted) | Before AI-CORE-001 (V5 session 1, verified on `master` 5299791) | After AI-CORE-001 |
|---|---|---|---|
| Provider boundary | `src/ai/provider.ts` | `AiProvider.complete()` once; `MockDeterministicProvider`, `ScriptedProvider`; `resolveProvider()` → mock + note for any other value | Same interface **plus optional** `continue()` and `describe()`; `MockToolLoopProvider` (two-turn, default), `ScriptedToolLoopProvider` (tests), `buildContinuationInput()`; `resolveProvider()` recognises `mock`, `mock_onepass`, `hosted`, `self_hosted` — the last two still run the mock with a specific note |
| Orchestration | `src/ai/review-orchestrator.ts` | One `provider.complete()`; tool calls dispatched **after** the model had already written its draft; validator; append-only record | Thin wrapper over `src/ai/runtime/tool-loop.ts`; `orchestrate()` keeps its signature; `runFirmAnalyzePlan` / `runPersonalUnderstand` pass a `reauthorize()` closure that re-resolves the scope from current state |
| Runtime | `src/ai/runtime/tool-loop.ts` (**new**) | — | Bounded state machine AUTHORIZE → … → RETURN; budgets before dispatch; per-call strict args, allow/deny, de-duplication, fresh re-authorisation; tool results returned to the model as untrusted data for one bounded continuation; outcomes DRAFT_READY / REJECTED / ERROR / ABSTAINED; immutable `runtime` trace on the record |
| Tools | `src/ai/tools.ts` | Loose argument handling | Exact per-tool strict schemas (`AI_TOOL_ARG_SCHEMAS`) → `BAD_ARGS` on any undeclared key; same five read-only tools; `run_supported_projection` still forbidden |
| Evidence resolver | `src/ai/evidence-resolver.ts` | unchanged | unchanged (the only path to data; authorises with the app's own checks) |
| Validator | `src/ai/result-validator.ts` | unchanged | unchanged (schema, citations, locators, amounts, status, budgets); still the sole decider of what survives |
| Contracts | `packages/contracts/src/ai/runtime.ts` (**new**), `review.ts` | `ai-review-v1` | `ai-runtime-v1`: budgets, tool request/result envelopes, provider descriptor, trace; `AiRunRecord.run_status` gains `ABSTAINED`, optional `runtime`; `tool_calls[].call_id` optional; new validation codes |
| Live adapter port | `src/ai/providers/port.ts` (**new**, types only) | — | `LiveProviderPort` request/response/failure shapes for AI-CORE-002 (hosted) and AI-CORE-005 (self-hosted). No implementation, no network code |
| UI | `src/ui/ai/AiReviewPanel.tsx`, firm `ai-review` list, server actions | — | One runtime line (turns, tool calls, denials, re-authorisations, stop reason); honest ABSTAINED state |
| Tests | `src/ai/__tests__/ai-core-toolloop.test.ts` (**new**, AI-C01…C16), `packages/contracts/test/ai-runtime-contracts.test.ts` (**new**) | 28 AI-E cases + 2 personal | 28 AI-E cases **unchanged** and passing; +17 web runtime tests; +4 contract tests |

No SQL migration, no financial-rule change, no workflow/approval change, no new tool with write authority.

## 2. Dataflow

```
Personal / Household UI                 Advisor / CCO UI
(/demo/personal/assistant)              (/demo/app/households/[id]/ai-review)
            \                                  /
      Next.js server actions (server-resolved actor: PersonalActor | Actor)
                               |
             review-orchestrator.runFirmAnalyzePlan / runPersonalUnderstand
                               |  authorize() = resolveFirmContext / resolvePersonalContext
                               |  (assertCan + householdBundle | ACTIVE workspace membership)
                               v
                     GroundingContext (minimal, authorised, citable ids, amounts-by-run,
                                       untrusted snippets flagged for injection)
                               |
                 runtime/tool-loop.runToolLoop(ctx, kind, requestedBy, provider, {reauthorize, budget})
      ┌────────────────────────┴───────────────────────────────────────────────────┐
      │ AUTHORIZE → RESOLVE_CONTEXT                                                │
      │ REQUEST_MODEL  ──► provider.complete(buildProviderInput)  [wall clock]     │
      │ VALIDATE_TOOL_REQUESTS   budget: Σ calls ≤ max_tool_calls (else none run)  │
      │ for each request:                                                          │
      │   AUTHORIZE_EACH_TOOL    de-dup; reauthorize() → NotFound ends the run     │
      │   EXECUTE_ALLOWED_READ   dispatchTool(ctx): allow/deny + strict args       │
      │                          size cap → withheld; injection scan → note        │
      │ ADD_TOOL_RESULTS         envelopes {untrusted:true} → buildContinuationInput│
      │ CONTINUE_MODEL ──► provider.continue()   (only if turn < max_model_turns)  │
      │ VALIDATE_FINAL_DRAFT     result-validator (ids, locators, amounts, status) │
      │ RECORD                   reauthorize() again; AiRunRecord + runtime trace  │
      │ RETURN                                                                     │
      └────────────────────────────────────────────────────────────────────────────┘
                               |
                 store.mutate(s => s.ai_runs.push(record))   (append-only)
                               |
          Human: Accept / Edit / Dismiss / Request evidence → ai_feedback (versioned, separate)

      Python deterministic calculator (services/calculator) — unchanged; the runtime never calls it.
      Amounts reach a draft only by being present in a receipted run already in the context.
```

### Authority by layer (unchanged by AI-CORE-001)

| Layer | Authority |
|---|---|
| Identity, workspace, consent, policy | Server (`auth/*`, `domain/*`); re-checked by `reauthorize()` before every tool execution and before RECORD |
| Facts, evidence, provenance, snapshot | Store, via the evidence resolver only |
| Deterministic models | `services/calculator` receipts already in the context; the runtime performs no arithmetic |
| Decision policy | `packages/contracts/src/decision-policy.ts` (unchanged) |
| LLM | Proposes tool reads, drafts, abstains. Cannot set status, cite outside scope, carry an uncited amount, or reach a write/network tool |
| Reviewer / consumer | Decides; feedback is a separate append-only record |

## 3. Runtime semantics

- **Turn budget.** `max_model_turns` default 2: one completion and one bounded continuation. A provider without `continue()` is one-pass (legacy): its tool requests are still dispatched/denied and recorded, as before (AI-E14 pins this). A two-turn provider that requests tools on its final turn gets `TURN_BUDGET_EXHAUSTED` denials and its returned draft is validated as-is; there is never a third completion.
- **Tool budget.** `max_tool_calls` default 10, counted across the run. If a batch would exceed it, **nothing in the batch is dispatched** and the run is `REJECTED` with `BUDGET_EXCEEDED` (AI-C03, AI-E27).
- **Per-call checks, in order:** duplicate `(tool, args_digest)` → `DUPLICATE_REQUEST`; `reauthorize()` (throws NotFound → run aborted, nothing recorded; scope/snapshot drift → `CONTEXT_CHANGED`, run `REJECTED`); forbidden → `FORBIDDEN_TOOL`; unknown → `UNKNOWN_TOOL`; strict schema → `BAD_ARGS`; result size > `max_tool_result_chars` → `RESULT_TOO_LARGE` (withheld, never truncated); injection pattern in a result → `INJECTION_TEXT_DETECTED` note, result still passed as data.
- **Envelopes.** The model receives `{status:"OK", call_id, tool, args_digest, result_digest, untrusted:true, result}` or `{status:"DENIED", call_id, tool, reason, args_digest, untrusted:true}`. Denials carry no tool specification and no data; a foreign document id returns `{not_found:true}` through the OK path (non-disclosing).
- **Outcomes.** `DRAFT_READY` (validator produced a report), `REJECTED` (validator or runtime rejected), `ERROR` (provider threw, wall clock, cancellation), `ABSTAINED` (model returned `ABSTAINED_INSUFFICIENT_EVIDENCE`; no report; tool requests in the abstention are ignored). `APPROVED`/`VERIFIED` remain impossible (validator `FORBIDDEN_STATUS`).
- **Trace.** `AiRunRecord.runtime` (`ai-runtime-v1`): budget, provider descriptor (what *ran*), state transitions, per-turn output digest/size/tokens, per-call digests and decisions, counts, stop reason, elapsed ms. No prompt text, no result payloads, no PII (AI-C16).
- **Determinism.** `MockToolLoopProvider` drafts from the tool result and reproduces the one-pass mock finding-for-finding (`diffReports` identical; AI-C02/C02b), so model/prompt regression comparisons still work.

## 4. Specialists are task policies, not separate agents

Routing is deterministic by `analysis_kind` and scope: `RETIREMENT_PLAN_REVIEW` (firm) and `PERSONAL_FINANCES_UNDERSTAND` (personal). The retirement, assurance and advisor specialities of the master prompt map onto these two resolver/tool sets today; `EXPLAIN` exists in the enum and is unused. Any multi-agent composition is **proposed** and must pass its own permission, latency and evaluation gates.

## 5. Configuration

`SAGESPAN_AI_PROVIDER` (server only): `mock` (default), `mock_onepass`, `hosted`, `self_hosted`. The last two are **ports only**: they resolve to the mock and add a note to every run's limitations. No key is read anywhere. Changing this to a live adapter is AI-CORE-002 and requires the G3 gates in `docs/legal/FEATURE_RELEASE_GATES.md`.

## 6. Proposed (not built)

Hosted adapter (AI-CORE-002), knowledge registry and retrieval (AI-CORE-003), training-data pipeline (AI-CORE-004), open-weight bake-off and private serving (AI-CORE-005), LoRA experiment (AI-CORE-006), governance/registry (AI-CORE-007). See the roadmap document. None is authorised by this architecture note.
