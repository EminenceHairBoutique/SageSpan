# ADR-AI-001 — Bounded tool-loop runtime for SageSpan Intelligence (AI-CORE-001)

**Status:** Accepted for synthetic mode on `feat/ai-core-001-runtime` (2026-11-06). Supersedes nothing in ADR-V5-001; extends its point 8 ("AI is a server-owned orchestrator over an evidence resolver").
**Owner:** founder / engineering. **Review date:** before AI-CORE-002 (any live adapter).

## Context

V5 session 1 shipped an orchestrator that called `provider.complete()` once and dispatched whatever `tool_calls` the model had already written into its draft. That is honest as a one-pass draft but is not a tool loop: tool results never reached the model. The AI-CORE programme needs model → tool → model with server-enforced budgets and per-call authorisation, without disturbing the 28 labelled cases, the validator, the calculator, workflow SQL or human approval.

## Decision

1. **One runtime, one state machine.** `apps/web/src/ai/runtime/tool-loop.ts` owns AUTHORIZE → RESOLVE_CONTEXT → REQUEST_MODEL → VALIDATE_TOOL_REQUESTS → AUTHORIZE_EACH_TOOL → EXECUTE_ALLOWED_READ → ADD_TOOL_RESULTS → CONTINUE_MODEL (bounded) → VALIDATE_FINAL_DRAFT → RECORD → RETURN. `orchestrate()` keeps its signature and delegates.
2. **Backwards-compatible provider contract.** `AiProvider` gains optional `continue()` and `describe()`. Providers without `continue()` are one-pass and behave exactly as before (AI-E14 pins dispatch-and-deny). Default demo provider becomes the deterministic two-turn `MockToolLoopProvider`, which must stay `diffReports`-identical to the one-pass mock on the frozen fixtures.
3. **Budgets before dispatch.** Tool-call, turn, wall-clock, output-size and tool-result-size ceilings are server data (`AiRunBudget`) and are checked before anything runs. An over-budget batch dispatches nothing.
4. **Per-call authorisation is fresh.** `reauthorize()` re-resolves the actor's scope from current state before every tool execution and again before RECORD. A revoked membership propagates the resolver's non-disclosing `NotFoundError` and nothing is recorded; scope or snapshot drift rejects the run (`CONTEXT_CHANGED`).
5. **Strict tool arguments.** Each allowlisted tool has an exact Zod `strictObject` schema in contracts; undeclared keys (tenant ids, URLs, SQL) are `BAD_ARGS`. The allow/forbid lists are unchanged; `run_supported_projection` stays forbidden until a verified engine exists.
6. **Tool results are untrusted data.** Envelopes carry `untrusted: true`; the continuation prompt places them under TOOL_RESULTS below the rules; denied calls carry a reason only. Injection patterns in results produce a note, not a behaviour change.
7. **Outcome vocabulary.** `DRAFT_READY | REJECTED | ERROR | ABSTAINED`. `ABSTAINED` is new: the model may return `ABSTAINED_INSUFFICIENT_EVIDENCE` and the runtime records no report. `APPROVED`/`VERIFIED` remain impossible.
8. **Immutable trace.** `AiRunRecord.runtime` (`ai-runtime-v1`) stores budget, provider descriptor (what ran), transitions, per-turn digests, per-call decisions, counts and stop reason — digests only, no prompt text or payloads. Records written before this ADR lack the field and remain valid.
9. **Configuration is honest.** `SAGESPAN_AI_PROVIDER` accepts `mock`, `mock_onepass`, `hosted`, `self_hosted`; the last two resolve to the mock and add a note to every run's limitations until AI-CORE-002/005 pass their gates. The hosted/self-hosted **port** is types only.

## Alternatives considered

- *Make the existing mock request tools and keep one class.* Rejected: AI-E13/E22 assert `tool_calls` is empty for the one-pass mock; changing them would alter 28-case semantics.
- *Unbounded agent loop with model-decided termination.* Rejected: budgets must be server data checked before dispatch; a model cannot be the loop's authority.
- *Throw a new error type on mid-run revocation.* Rejected in favour of propagating the resolver's own `NotFoundError`, which keeps AI-E25 semantics and non-disclosure identical across paths.
- *Store tool results in the trace for debugging.* Rejected: traces must be shareable with reviewers without carrying payloads; digests suffice to prove what was returned.
- *Multi-agent specialists.* Deferred: one orchestrator with deterministic routing by `analysis_kind` is simpler to audit; composition needs its own gates.

## Consequences

- Both demo paths now exercise a real model → tool → model cycle offline; every run is reproducible and inspectable from its record.
- No SQL migration, no calculator change, no workflow or approval change; PR-003 merge impact is limited to `CLAUDE.md` status notes.
- Any future live adapter plugs into the same runtime through `providers/port.ts`; the runtime does not change per vendor.
- New tests: AI-C01…C16 (web), `ai-runtime-contracts` (contracts). Promotion rule: every prompt/tool/validator/runtime change replays AI-E01…E28 and AI-C01…C16 and records a `diffReports` review.

## Open decisions (founder / counsel)

- Vendor and data-handling class for the first hosted adapter (AI-CORE-002), and the DPA/retention terms that gate it.
- Whether denial evidence for runs aborted by `NotFound` should be recorded outside the run (CLAUDE.md §4) and by which authorised mechanism.
- Per-actor/workspace rate limits and cost ceilings once a paid provider exists.
