# AI session handoff — AI-CORE-002b (2026-11-06, evening)

> Saved as `docs/engineering/V5_SESSION_8_AI_CORE_002B_REPORT.md` and uploaded to the Project. The repository is the source of truth; this report is dated evidence of what this session did and saw.

## 1. Baseline I started from
- `master` @ `74930bd` ("Merge pull request #20 … feat/data-002-personal-runs"; CI run 42324987527: success 5/5); open PRs: none (#10, #13, #16, #17, #18, #19, #20, #21 merged; only `master` on origin); founder tree: not inspected — worked in a separate cloud clone per operating model §5.2.
- Applied migrations `0001`–`0009`; `0010` unallocated. No number requested this PR.
- Branch: `feat/ai-core-002b-benchmark-prep` → PR (see §9) base `master`.
- Brief executed: `SESSION_OPERATING_MODEL.md` §7.3 (AI — AI-CORE-002b). Item (1) needed a founder decision: asked in-session; **vendor confirmed (Anthropic Messages API), model pinned `claude-sonnet-5-5` (pinned, not verified against the Console)**.

## 2. What changed (file inventory)
| Path | Change | Why |
|---|---|---|
| `packages/contracts/src/ai/quota.ts` | added | `ai-quota-v1`: scope, policy, usage, decision contracts; `DEFAULT_AI_QUOTA_POLICY`; `aiQuotaScopeKey()` |
| `packages/contracts/src/ai/index.ts` | modified | export `./quota` |
| `apps/web/src/ai/quota/store.ts` | added | `AiQuotaStore` interface; `InMemoryAiQuotaStore` (PER_PROCESS); `UnavailableAiQuotaStore` (tests) |
| `apps/web/src/ai/runtime/tool-loop.ts` | modified | `reauthorize()` may be async (awaited before every tool and before RECORD); run id stamped on `ProviderInput.run_id` |
| `apps/web/src/ai/provider.ts` | modified | `ProviderInput.run_id?` |
| `apps/web/src/ai/evidence-resolver.ts` | modified | `personalContextFromBundle()` (sync path now delegates to it); `GroundingResolver`, `PersonalBundleSource`, `personalRepositoryResolver()` |
| `apps/web/src/ai/review-orchestrator.ts` | modified | `runPersonalUnderstandForRepository()` with honest `persisted` / `persistence_note` |
| `apps/web/src/ai/providers/hosted-config.ts` | modified | `tokensPerScopePerHour` (`SAGESPAN_AI_HOSTED_TOKENS_PER_SCOPE_PER_HOUR`) |
| `apps/web/src/ai/providers/hosted-provider.ts` | modified | quota reserve before any vendor call, settle per turn, keyed by `run_id`; `TOKEN_QUOTA_SCOPE`, `TOKEN_QUOTA_RUN`, `QUOTA_UNAVAILABLE` closed failures; `quotaPolicyFromConfig()` |
| `apps/web/src/ai/evals/baselines.ts`, `evals/baselines/*.mock-toolloop.json` (3) | added | committed `diffReports` baselines (Patel PASS, Patel UNSUPPORTED, Castillo) and helpers |
| `apps/web/src/ai/__tests__/ai-baselines.test.ts` | added | AI-B: mock pinned to baselines; deliberate regeneration via `SAGESPAN_WRITE_AI_BASELINES=1` |
| `apps/web/src/ai/__tests__/ai-core-002b-resolver-quota.test.ts` | added | AI-C17…C21, AI-Q01…Q06 |
| `apps/web/src/ai/__tests__/ai-hosted.live.test.ts` | modified | runs the baseline cases, diffs live vs baseline, asserts invariants, writes JSON + Markdown |
| `apps/web/src/ai/__tests__/ai-core-hosted.test.ts` | modified | config shape (`tokensPerScopePerHour`) |
| `docs/ai/AI_CORE_002B_LIVE_BENCHMARK_REVIEW.md` | added | runbook, review protocol, decision vocabulary, durable persistence design (tables / SECURITY DEFINER entry points, no SQL) |
| `docs/ai/AI_CORE_002_HOSTED_ADAPTER.md`, `docs/ai/AI_CORE_FEATURE_STATUS.md`, `docs/ai/AI_EVAL_MATRIX.md` | modified | 002b status and the AI-C17…C21 / AI-Q / AI-B inventory |
| `docs/DECISIONS.md` | appended (own section) | vendor confirmed; model pinned; async resolver; honest non-persistence; quota design |
| `docs/requirements/SAGESPAN_V5_TRACEABILITY.md` | appended §K | evidence mapping |
| `docs/product/FEATURE_STATUS_MATRIX.md`, `docs/SECURITY_AND_LIMITS.md` | appended (own rows) | status + limits |
| `.env.example` | modified (AI block) | pinned model example, tokens-per-scope ceiling, runbook pointer |

Not touched: `auth/**`, `domain/**` (consumed via `import type` only), `supabase/**`, `ui/**`, `server/**`, `CLAUDE.md`, `IMPLEMENTATION_STATUS.md`, `REGISTRY.md`.

## 3. Behaviour delivered vs. deferred
- **Delivered:** the AI runtime re-authorises against an async, RLS-shaped source of truth (the Data track's `PersonalRepository.bundle()`) before every tool execution and before recording; a repository-backed personal run exists and is explicit when it cannot persist; hosted-provider spending is governed by a typed per-workspace quota policy decided before any vendor call and failing closed; the deterministic mock is pinned to committed baselines; the live benchmark compares a live model to those baselines and writes a reviewable report; the founder's vendor/model decisions are recorded.
- **Deferred / non-goals kept:** no live vendor call (no key here); hosted mode still disabled by default; no SQL (durable quota store and AI-run/feedback tables designed only — number not requested); firm-side production resolver (needs DATA-003a); UI for production AI runs (UI track, later); cost in USD; self-hosted adapter.
- **Status vocabulary:** async resolver + repository-backed run `IMPLEMENTED_SYNTHETIC` / `CI_TESTED`; `ai-quota-v1` + in-process store + hosted wiring `IMPLEMENTED_SYNTHETIC` / `CI_TESTED`; baselines `CI_TESTED`; live benchmark run `PROPOSED`; durable persistence `PROPOSED`; firm-side production grounding `BLOCKED` (DATA-003a).

## 4. Evidence (only commands actually run — Linux cloud sandbox, Node 22.23, Python 3.13 via `uv.lock`, Chrome for Testing)
| Suite | Command | Result |
|---|---|---|
| typecheck / lint | `npm run typecheck`, `npm run lint` | clean / clean |
| contracts Vitest | `npm run test --workspace packages/contracts` | **53 passed** |
| web Vitest | `npm run test --workspace apps/web` (calculator up on :8010) | **267 passed / 5 skipped** (skips: opt-in real-stack repository test ×4 cases, opt-in live-vendor benchmark ×1) — +15 new (AI-C17…C21, AI-Q01…Q06, AI-B ×4) |
| pytest | `uv run --locked python -m pytest -p no:warnings` (services/calculator) | **119 passed** (no change) |
| SQL shim | — | NOT RUN (no SQL change) |
| build | `npm run build --workspace apps/web` | clean (48 routes) |
| Playwright | `npx playwright test` (apps/web, `SAGESPAN_E2E_CHROME_PATH`, live calculator) | **20 passed** (2.1 min) |
| CI | PR run URL in §9 | calculator / web / database / e2e / realstack: see §9 |
| Live vendor | — | **NOT RUN** — no key in this environment, by design |

Real-stack evidence is the CI `realstack` job on a disposable local Supabase only. No deployed project, live model, real data or professional sign-off is claimed.

## 5. Security / financial / regulatory implications
- **S-01 / consent at action time:** the AI tool loop now awaits an RLS-shaped re-authorisation before every tool execution and before RECORD; AI-C18 proves a membership revoked mid-run ends the run with the repository's NotFound and nothing is persisted; AI-C19 proves a new CURRENT snapshot between turns rejects the run. This closes the *design* half of IMPLEMENTATION_STATUS open item 5; the real-stack half (a `realstack` vitest driving the AI runtime through `productionPersonalRepository()`) remains open and is listed in §8.
- **No silent drop:** PRODUCTION AI runs are explicitly not persisted (`persisted:false`), never written into a repository view that would discard them.
- **Spend control:** quota reservation precedes any vendor call; runs/tokens exhausted or a store failure produce an `ERROR` run from the hosted provider — no fallback to the mock or a cheaper model. The shipped store is per-process (documented limit; IMPLEMENTATION_STATUS open item 6 has its design in the runbook §6.2).
- No new amount is shown anywhere; no engine, receipt, rule, migration, grant or workflow changed. REG-001 / FIN-VERIFY-001 unchanged; real data remains G3.

## 6. Traceability and decisions
- `docs/requirements/SAGESPAN_V5_TRACEABILITY.md` §K added.
- `docs/DECISIONS.md` rows added: AI-CORE-002b table (vendor confirmed; model pinned; async resolver; honest non-persistence; quota design).
- `FEATURE_STATUS_MATRIX.md` rows added (AI-CORE-002b; founder decisions) — coordinator finalises.

## 7. Cross-track requests (files I needed but do not own)
| File | Owner track | What I need |
|---|---|---|
| `supabase/migrations/REGISTRY.md` | Coordinator | Allocate a number **when** the AI track creates the SQL file for `ai_runs` / `ai_feedback` / `ai_quota_usage` (design in runbook §6.2). Not needed for this PR. |
| `apps/web/src/domain/**` (`HouseholdBundle` production repository) | Data (DATA-003a) | A `productionHouseholdRepository()` seam so the AI track can add `firmRepositoryResolver()` without reading tables. |
| `apps/web/src/ui/**` | UI | Nothing yet; when production AI runs get a surface, a "not persisted (production)" state and the quota denial copy. |
| `docs/project/IMPLEMENTATION_STATUS.md`, `CLAUDE.md` current-state line | Coordinator | On merge: open item 5 → "design closed, real-stack test open"; open item 6 → "contract + interface shipped, durable store pending migration". |

## 8. Next smallest PR for this track
**AI-CORE-002c — first live benchmark review** (founder-dependent): the founder exports the five gates locally (`SAGESPAN_AI_HOSTED_MODEL=claude-sonnet-5-5` after verifying the id), runs `npx vitest run src/ai/__tests__/ai-hosted.live.test.ts` from `apps/web`, and reviews `.ai-bench/<ts>-hosted.md` per the runbook §4; the AI session records the outcome in `AI_EVAL_MATRIX.md` and fixes any adapter defect under AI-H tests. Acceptance: one reviewed report with a recorded decision; no invariant violation. No migration.

If the founder's run is not yet possible, the offline alternative is **AI-CORE-002d — realstack AI resolver test**: a `supabase-repository`-style vitest (skipped without the realstack env) that drives `runPersonalUnderstandForRepository(productionPersonalRepository())` with the two-turn mock on the disposable local Supabase: owner gets a draft, revoked member gets NotFound mid-run, stranger NotFound. Needs the CI `realstack` job body (Data/coordinator) to include the new file — a cross-track request.

## 9. For the coordinator
- Merge prerequisites: green CI on the PR head; no dependency PRs.
- Expected conflicts: none expected (all shared files append-only in AI rows/sections; no `CLAUDE.md` edit).
- Docs to update on merge: `IMPLEMENTATION_STATUS.md` (AI row → 002b done; open items 5/6 wording), `CLAUDE.md` current-state line (+#22), matrix finalisation.
- PR and CI URLs: filled in the PR description.
