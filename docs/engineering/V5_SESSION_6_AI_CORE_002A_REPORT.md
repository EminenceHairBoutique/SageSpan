# V5 session 6 — AI-CORE-002a: hosted adapter skeleton (synthetic-only, disabled by default) — 2026-11-06

Branch `feat/ai-core-002a-hosted-adapter`, stacked on `feat/ai-core-001-runtime` (PR #13, which was first merged forward to `master` `8f7fa22`). No migration, no calculator change, no workflow/approval change, **no live run executed, no key present**, no real data.

## 1. State reconciled at session start

| Item | Observed |
|---|---|
| `origin/master` | advanced `5299791` → `8f7fa22`: #11 (PR-002 follow-up: v2 canonical fixtures, fixture-pinned policy hash, S-06 founder decision recorded, `AI_EVALUATION_PLAN.md` pushed) and #14 (UI-000 design audit, docs only) |
| #12 DATA-001 | merged into `feat/pr-003-identity` (PR #10 still open vs master); adds `PersonalRepository` seam and `docs/architecture/PARALLEL_SESSIONS_AND_DATA_BOUNDARY.md` — AI track owns `apps/web/src/ai/**`, `packages/contracts/src/ai/**`, `docs/ai/**`, migrations `0010+`; consumes identity/repository seams rather than re-implementing them |
| #13 AI-CORE-001 | merged `origin/master` into it (clean; `AI_EVALUATION_PLAN.md` byte-identical, both `CLAUDE.md` notes kept); re-verified contracts 53, web 123, typecheck/lint clean; pushed `e4256aa` |
| Founder working tree | not touched this session |

## 2. What was built

A `LiveProviderPort` implementation for the **Anthropic Messages API** plus the `AiProvider` wrapper that lets the AI-CORE-001 runtime drive a live vendor without changing the runtime:

- `providers/hosted-config.ts` — gates and ceilings from env. All of `SAGESPAN_AI_PROVIDER=hosted`, `SAGESPAN_AI_HOSTED_API_KEY`, `SAGESPAN_AI_HOSTED_MODEL` (pinned, no default), `SAGESPAN_AI_HOSTED_SYNTHETIC_ACK=I_UNDERSTAND_SYNTHETIC_ONLY`, `SAGESPAN_DEMO_MODE=1` are required; otherwise the mock runs and the run's limitations name the missing gate (never the secret).
- `providers/anthropic-messages.ts` — plain `fetch` (injectable), structured output by forced tool (`emit_review` with a JSON schema generated from Zod; read tools with strict schemas from `AI_TOOL_ARG_SCHEMAS`), `tool_choice: any` on turn 1 and forced `emit_review` from turn 2, continuation replays the model's `tool_use` with vendor ids and returns envelopes as `tool_result` (`is_error` + reason for denials, `untrusted_data: true` payloads), typed failures (`TIMEOUT`, `RATE_LIMITED`, `REFUSED`, `MALFORMED_OUTPUT`, `UNAVAILABLE`) with no vendor body beyond status/`error.type`, served model remembered for the descriptor.
- `providers/hosted-provider.ts` — per-process token ceiling and per-scope (workspace/household) run limit that **fail closed** to `ERROR` runs; server request ids; `EmitReviewSchema`; schema generators.
- `provider.ts` — `resolveProvider("hosted")` → `HostedProvider` only when every gate holds.
- `runtime/tool-loop.ts` — provider described **after** the turns so the served model is recorded; report limitations capped at 400 chars (a long provider note previously could invalidate a valid draft — found and fixed by AI-C14 under the new note).
- `port.ts` — `output_json_schema` added to the request.
- Tests: `ai-core-hosted.test.ts` AI-H01…H10 (offline, fake vendor); `ai-hosted.live.test.ts` opt-in benchmark (skipped without gates; writes `apps/web/.ai-bench/*.json`, git-ignored).
- Docs: `docs/ai/AI_CORE_002_HOSTED_ADAPTER.md`; `AI_CORE_FEATURE_STATUS.md`, `AI_EVAL_MATRIX.md`, `FEATURE_STATUS_MATRIX.md`, traceability, `CLAUDE.md` note, `.env.example`, `docs/DECISIONS.md` (AI-CORE table; vendor choice recorded as an **assumption awaiting founder confirmation**).

## 3. Tests executed (Linux build environment)

| Suite | Command | Result |
|---|---|---|
| Typecheck / lint | `npm run typecheck`, `npm run lint` | clean |
| Contracts Vitest | `npm run test --workspace packages/contracts` | 53 passed (unchanged this branch) |
| Web Vitest (calculator up) | `npm run test --workspace apps/web` | **133 passed, 1 skipped** (123 + 10 AI-H; the skipped file is the opt-in live benchmark) |
| Next build | `npm run build --workspace apps/web` | clean |
| Playwright | `dual-market.spec.ts` | 7 passed (default provider unchanged; full 16 ran on #13) |
| Python / SQL shim / real Supabase | — | NOT RUN (no change in scope) |
| Live vendor | — | **NOT RUN** (no key in this environment, by design) |

### AI-H01…H10 — input → expected → actual

| Case | Input | Expected | Actual |
|---|---|---|---|
| H01 | each gate removed in turn; http base URL | `enabled:false`, mock + note naming the gate, no secret; all gates → `HostedProvider` mode LIVE + "SYNTHETIC demo data only" | pass |
| H02 | first-turn request | `/v1/messages`, key in header only, `anthropic-version`, `tool_choice:any`, 5 read tools + `emit_review`, strict schemas (`additionalProperties:false`), output schema has no `"APPROVED"`/`"VERIFIED"`, `max_tokens ≤ 4096`, server request id | pass |
| H03 | vendor `tool_use get_check_runs` then `emit_review` citing the run | runtime executes the read, replays `tool_use` id + `tool_result` with `untrusted_data`, forces `emit_review` on turn 2, `DRAFT_READY`, `TOOL_BACKED`, descriptor = served model, tokens summed | pass |
| H04 | `http_post`, `read_facts{org_id}`, `read_facts` | two denied before execution, replayed as `is_error` with reason only, no schema/foreign text | pass |
| H05 | live `APPROVED`; `$31,000.00` uncited; foreign fact id | `FORBIDDEN_STATUS` → `REJECTED`; `AMOUNT_WITHOUT_TOOL_BACKING`, `UNRESOLVED_FACT_REF` | pass |
| H06 | 429 (+retry-after), 503, 401, refusal, prose-only, non-JSON, hang | `ERROR` with typed detail, provider still `anthropic-messages`, vendor body text absent | pass |
| H07 | ceiling 1000 tokens | third run `ERROR TOKEN_CEILING`, not mock | pass |
| H08 | 1 run/hour/scope | second run `ERROR RATE_LIMIT_SCOPE`; other scope OK; window expiry OK | pass |
| H09 | `emit_review` status `ABSTAINED_INSUFFICIENT_EVIDENCE` | `ABSTAINED`, no report | pass |
| H10 | vendor 500 whose body contains the key | key absent from record, store, descriptor | pass |

## 4. Decisions needed from the founder

1. **Vendor for AI-CORE-002b.** The port targets the Anthropic Messages API as an assumption (`docs/DECISIONS.md`). Confirm, or name another vendor — a one-file swap.
2. **Who runs the first live benchmark and where.** It needs a key in a developer's own environment with the synthetic acknowledgement; CI never has one. The report lands in `apps/web/.ai-bench/` for a `diffReports` review.
3. **Model id to pin** (`SAGESPAN_AI_HOSTED_MODEL`); no default is baked in.

## 5. Blockers and the smallest next PR

Unchanged: G3 (PR-003 + vendor DPA + retention/incident runbooks) before any identifiable data reaches a vendor; FIN-VERIFY-001 before projection tools; REG-001 for Tier 3.

**Smallest next PR:** **AI-CORE-002b — live benchmark review**: founder supplies a key locally, runs `ai-hosted.live.test.ts` on the frozen fixtures, the resulting `diffReports` report is reviewed and the decision recorded in `AI_EVAL_MATRIX.md`; any adapter fixes that review surfaces. If no key is available yet, the offline alternative is **AI-CORE-004a** (benchmark-case Zod contract, grouped partitions, contamination check — `AI_CORE_EVALUATION_PLAN.md` §6).

## 6. Not done / not claimed

No live call, no vendor quality claim, no DPA, no cost-in-USD, no persistent metering, no self-hosted adapter, no fine-tuning, no deployment, no merge.
