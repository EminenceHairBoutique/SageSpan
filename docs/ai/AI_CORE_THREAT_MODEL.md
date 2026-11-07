# AI-CORE threat model — bounded tool-loop runtime

**Scope:** `apps/web/src/ai/*` (resolver, runtime, tools, validator, providers) as implemented on `feat/ai-core-001-runtime`, synthetic mode. Aligned with the NIST AI RMF Generative AI Profile (govern/map/measure/manage) and the OWASP Top 10 for LLM Applications categories; **no certification or conformance is claimed**. Historical findings S-01–S-10 / N-01–N-05 remain governed by `docs/requirements/SAGESPAN_V5_TRACEABILITY.md`; this document covers the AI surface only.

## 1. Assets

| Asset | Where | Why it matters |
|---|---|---|
| Authorised household / workspace data (facts, documents, check runs, personal baseline) | `GroundingContext` built by the resolver | Confidentiality across tenants and across the firm ↔ personal boundary |
| Calculator receipts and amounts | `ctx.amounts_by_run` | Integrity: the only legitimate source of any dollar figure in a draft |
| Review / approval / verification state | Not reachable from `ai/*` | Integrity: AI output must never become an approval |
| Run records and feedback | `ai_runs`, `ai_feedback` (append-only) | Auditability, reproducibility |
| Provider identity and data-handling class | `runtime.provider_descriptor` | Honesty about where data went |
| Budgets (tokens, calls, time) | `AiRunBudget` | Availability / cost |

## 2. Trust boundaries

1. **Browser → server action.** Only an actor cookie/session and a household id or form field cross; authority is re-derived server-side. (Unchanged.)
2. **Server → resolver → context.** The resolver loads nothing outside the authorised scope; a foreign id does not resolve.
3. **Context → provider.** Everything sent is minimal and already authorised; untrusted text is under a DATA heading. The provider's output is **untrusted** on the way back.
4. **Model output → runtime.** Tool requests are *requests*; the runtime decides. Tool results go back under a TOOL_RESULTS (untrusted data) heading.
5. **Runtime → validator → record.** Only validated findings exist; the record is append-only.
6. **Provider → outside world.** None in this build (mocks are in-process). For a future adapter: server-side key, egress to one configured endpoint, declared data-handling class.

## 3. Threats, mitigations, tests

| # | Threat (attacker / vector) | Mitigation in code | Test |
|---|---|---|---|
| T1 | **Prompt injection via document / label / CSV text** tries to change rules, approve, or request tools | Untrusted text under DATA; `looksLikeInjection` flags; validator rejects any non-draft status; tools dispatched only by the runtime's allowlist | AI-E13, E23, **C05** |
| T2 | **Injection through a tool result** (second-order) | Tool results under TOOL_RESULTS as data; injection scan on serialised result → note; validator unchanged on turn 2 | **C05** |
| T3 | **Excessive agency: forbidden tools** (`http_post`, `run_sql`, `approve`, `move_money`, `run_supported_projection`…) | `AI_FORBIDDEN_TOOLS` denied before dispatch; no network/store/write surface exists in `ai/*` | AI-E14, **C04, C09** |
| T4 | **Tenant smuggling through tool args** (`org_id`, `workspace_id`, foreign `document_id`) | Strict per-tool Zod schemas (`BAD_ARGS`); tools read only `ctx`; foreign ids → `{not_found:true}` | **C04**, contracts `ai-runtime-contracts` |
| T5 | **Cross-tenant / firm→personal leakage** | Separate resolvers; firm context has no personal ids; validator `UNRESOLVED_*` with id-only detail | AI-E11, E12, **C04** |
| T6 | **Revoked consent / membership mid-run** | `reauthorize()` before every tool execution and before RECORD; resolver's NotFound aborts the run, nothing recorded, no continuation | AI-E25, **C06** |
| T7 | **Snapshot / scope drift between turns** (stale authority, N-02 semantics) | Re-resolved scope compared on `scope`, `snapshot_id`, `snapshot_sha256` → `CONTEXT_CHANGED`, run `REJECTED` | **C07** |
| T8 | **Fabricated or stale citations** (ids, locators, superseded facts, superseded runs) | Validator: `UNRESOLVED_*`, `FORGED_LOCATOR`, `SUPERSEDED_*` | AI-E09–E12, E21, E24 |
| T9 | **Unbacked or invented amounts** (incl. figures copied from injected text) | `cited_amounts` must resolve to a cited, current run; regex guard as defence in depth | AI-E15, **C05, C09** |
| T10 | **Unsupported → verified promotion / REVIEWED_WITH_LIMITATIONS relabelling** | `UNSUPPORTED_PROMOTED_TO_PASS`; limitations state "no verified check" | AI-E04–E07, E18, **C10** |
| T11 | **Model approval / verification** | Only `DRAFT_FOR_HUMAN_REVIEW` accepted; `FORBIDDEN_STATUS` rejects the report; `evidence_status` set by server | AI-E16, **C05** |
| T12 | **Budget exhaustion / cost DoS** (tool storms, infinite loops, giant outputs, slow provider) | Caps checked **before** dispatch; turn cap; wall clock with `withTimeout`; output and tool-result size caps; cooperative cancellation | AI-E27, **C03, C11, C12** |
| T13 | **Duplicate / cyclic tool requests** | `(tool, args_digest)` de-duplication per run | **C08** |
| T14 | **Provider failure modes** (throw, malformed output, timeout, refusal) | Honest `ERROR` / `REJECTED` with stop reason; never a silent fallback to a different model | **C12** |
| T15 | **Silent vendor switch / misreported provider** | `runtime.provider_descriptor` records what ran; configured-but-unimplemented providers add a note to limitations | AI-E17, **C14** |
| T16 | **Sensitive data in traces / logs** | Trace stores digests, counts and decisions only; no prompt text, no result payloads | **C16** |
| T17 | **Model-supplied tenant fields in output** | Ignored with `MODEL_SUPPLIED_TENANT_IGNORED`; server scope used | validator (E-suite) |
| T18 | **Abstention misuse** (abstain while still requesting tools) | `MODEL_ABSTAINED` stop; tool requests ignored; no report | **C15** |

## 4. Residual risks and non-claims

- The resolver authorises against the **demo store**. Real Supabase Auth/JWT/PostgREST/RLS behaviour is PR-003 territory and has only been exercised by the PR-003 real-stack CI job on a disposable local stack, not by this suite.
- The regex money guard is defence in depth; evasive formats (words, other currencies, Unicode spacing) are covered only by the structured `cited_amounts` rule. Suite D in the founder's `AI_EVALUATION_PLAN.md` must add these adversarial fixtures before any live model.
- `looksLikeInjection` is pattern-based and will miss novel phrasings; it only produces a note. The hard controls are the allowlist, strict args, validator and re-authorisation.
- Denial evidence lives in the run record; a run aborted by `NotFound` records nothing (CLAUDE.md §4 "durable denial evidence outside the transaction" is still open and out of scope here).
- No rate limiting per actor/workspace exists yet (proposed for AI-CORE-002 alongside the hosted adapter).
- No certification (SOC 2, NIST conformance, SEC) is implied by this document.

## 5. Governance hooks

- Every change to `prompts/review-v1.ts`, the tool allowlist, `AI_TOOL_ARG_SCHEMAS`, the validator or the runtime must replay AI-E01…E28 **and** AI-C01…C16 and record a `diffReports` review on the frozen fixtures (AI_EVAL_MATRIX promotion rule).
- A live adapter requires: G3 gates, vendor DPA, server-side secret management, per-tenant rate limits, redaction policy, incident runbook, and a founder decision on the vendor and data-handling class.
