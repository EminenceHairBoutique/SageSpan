# AI-CORE feature status — verified vs proposed (2026-11-06)

Classification vocabulary (project instructions): **implemented in synthetic demo**, **implemented and CI-tested**, **independently validated**, **blocked**, **proposed**, **released with real data**. Nothing in the AI programme is independently validated or released with real data.

Baseline verified for this branch: `origin/master` = `5299791` ("AI Checklist"); branch `feat/ai-core-001-runtime` stacked on it; `master` has since advanced to `8f7fa22` (#11 PR-002 follow-up, #14 UI-000 docs) and was merged into the branch cleanly. `feat/ai-core-002a-hosted-adapter` is stacked on `feat/ai-core-001-runtime`. The founder's local `master` carries one unpushed commit (`03df634`, `docs/ai/AI_EVALUATION_PLAN.md`); that file is included on this branch verbatim so references resolve. Open PR #10 (`feat/pr-003-identity`, 6 commits ahead of master) is independent of this branch; both touch `CLAUDE.md` status notes and will need a trivial merge.

| Capability | Status | Evidence / dependency |
|---|---|---|
| One-pass mock provider, scripted adversarial provider, 28 labelled cases + 2 personal | Implemented in synthetic demo; CI-tested | `ai-evals.test.ts` 30/30 (unchanged assertions) |
| **Bounded two-turn tool loop** (budgets before dispatch, strict args, de-dup, re-authorisation per call and before record, untrusted tool-result envelopes, honest stop reasons) | **Implemented in synthetic demo** (this branch); unit-tested | `runtime/tool-loop.ts`; `ai-core-toolloop.test.ts` 17/17 |
| Deterministic two-turn mock as the demo default | Implemented in synthetic demo | `MockToolLoopProvider`; `diffReports`-identical to one-pass mock (AI-C02/C02b) |
| `ai-runtime-v1` contracts (budget, envelopes, descriptor, trace), `ABSTAINED` outcome, new validation codes | Implemented; contract-tested | `packages/contracts/src/ai/runtime.ts`; `ai-runtime-contracts.test.ts` 4/4 |
| **AI-SEC-001 narrative grounding** (summary, draft memo, questions, model limitations get the finding-level amount and pass-claim rules; failing field withheld via `REDACT_TEXT`) | Implemented; CI-tested (closes the independent audit's P0 of 2026-11-06) | `result-validator.ts`; `ai-sec-001-narrative.test.ts` AI-N01…N08 |
| Runtime trace shown to reviewers / users | Implemented in synthetic demo | `AiReviewPanel` runtime line; firm list chip handles `ABSTAINED` |
| `SAGESPAN_AI_PROVIDER` = `mock` / `mock_onepass` / `hosted` / `self_hosted` | Implemented (hosted/self_hosted resolve to mock with an explicit note) | AI-C14, AI-E17 |
| Live provider **port** (types) | Implemented | `providers/port.ts` (now carries `output_json_schema`) |
| Hosted adapter (AI-CORE-002a) | **Implemented in synthetic demo, offline-tested, disabled by default**; Anthropic Messages port; enabled only with key + pinned model + synthetic acknowledgement + demo mode; fails closed on ceilings; **no live run executed in-repo** | `providers/{hosted-config,anthropic-messages,hosted-provider}.ts`; `ai-core-hosted.test.ts` 10/10; `docs/ai/AI_CORE_002_HOSTED_ADAPTER.md` |
| Hosted adapter live benchmark review + founder vendor decision (AI-CORE-002b) | **Proposed / blocked on a key the founder supplies and a recorded vendor decision**; real data remains G3 | `ai-hosted.live.test.ts` (opt-in), `FEATURE_RELEASE_GATES.md` G3 |
| Knowledge registry + retrieval (AI-CORE-003) | Proposed | — |
| Benchmark schema, synthetic generator, contamination checks, training manifests (AI-CORE-004) | Proposed (schema sketched in `AI_CORE_EVALUATION_PLAN.md` §6) | — |
| Open-weight bake-off, private serving spike (AI-CORE-005) | Proposed | licence reverification required |
| LoRA/QLoRA experiment (AI-CORE-006) | Proposed; blocked on AI-CORE-004 gates | — |
| Model register / governance (AI-CORE-007) | Proposed | — |
| `run_supported_projection` | **Blocked by design** (forbidden tool) until PLAN-001/SCENARIO-001 engine exists and is verified | AI-E14, AI-C09 |
| `propose_scenario` for retirement kinds | Implemented as non-authoritative proposal; `executable_now:false`, `engine_required: "PLAN-001 (not implemented)"` | AI-C09 |
| Real-stack (Supabase Auth/JWT/PostgREST/RLS) behaviour of the resolver | **Not validated by this branch** | PR-003 realstack CI job (disposable local stack) is the only real-stack evidence in the repo |
| Live-model accuracy, false-positive/negative rates, reviewer time saved | **Not measured** — no live provider | Suites C–F in `AI_EVALUATION_PLAN.md` |
| Regulated personalised advice (Tier 3), money movement (Tier 4) | Disabled / out of scope | `decisions.ts`; REG-001 |

## Dependencies on other workstreams

- **PR-002 (merged #9):** coverage semantics, snapshot-only requests and latest-attempt rules are consumed read-only by the resolver (`latestCheckRuns`). The runtime adds the snapshot-drift check (AI-C07) but does not alter PR-002 code.
- **PR-003 (open #10):** production identity and RLS. AI-CORE-001 uses the same `Actor`/`PersonalActor` shapes and the same resolvers, so it inherits PR-003's identity resolution when merged; nothing here depends on migration 0008.
- **PERS-002 / PLAN-001:** consumed, not modified. No cash-flow or debt engine change was made; the known methodology risks (promo APR ordering, amortisation-feasible ≠ cash-flow-feasible, planning anchor date) stay in the finance backlog and are **not** papered over by AI prose.

## Test evidence for this branch (executed in the Linux build environment, 2026-11-06)

| Suite | Command | Result |
|---|---|---|
| Typecheck | `npm run typecheck` | clean (contracts + web) |
| Lint | `npm run lint` | clean |
| Contracts Vitest | `npm run test --workspace packages/contracts` | 51 passed (47 + 4) |
| Web Vitest (calculator up) | `npm run test --workspace apps/web` | 122 passed (105 + 17) |
| Python | `uv run --locked python -m pytest -q` (services/calculator) | 119 passed (unchanged; no calculator change) |
| Next build | `npm run build --workspace apps/web` | clean, 44 routes |
| Playwright | `npx playwright test` (apps/web, Chrome for Testing) | 16 passed (full suite); `dual-market.spec.ts` 7 passed after adding runtime-trace assertions |
| SQL shim / real Supabase | — | **NOT RUN** (no PostgreSQL in the build environment; no SQL change on this branch) |
| Live model | — | **NOT RUN** (none exists) |
