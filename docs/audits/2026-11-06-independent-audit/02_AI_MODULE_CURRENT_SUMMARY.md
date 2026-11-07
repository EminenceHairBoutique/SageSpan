# Deliverable 2 — SageSpan V5 AI Module Current-State Summary

> **Reconciliation note (2026-11-06 evening, integration coordinator session):** this bundle is the founder-supplied independent audit (prepared outside the repository from the GitHub API at ~18:57 ET, `master` @ `e0d2f63`). It is preserved verbatim as dated evidence. Its "current state" rows predate the merges done the same evening (#10 PR-003/DATA-001/DATA-002 → #13 AI-CORE-001 → #16 AI-CORE-002a, then #18 AI-SEC-001). Each code-level finding was re-verified against the source and its disposition is recorded in `docs/engineering/V5_SESSION_7_BASELINE_RECONCILIATION_REPORT.md` §4 (P0 AI-SEC-001 **confirmed and fixed in #18**; P1 two-step save/refresh **confirmed, partly mitigated by snapshot-bound runs**; P1 render-time refresh **confirmed**; P1 synchronous `reauthorize()` **confirmed**; P1 in-process hosted budgets **confirmed**; P1 unprotected `master` **reported, not verifiable with the session token**). The operating model in `04_CLAUDE_CODE_NEXT_PROMPTS.md` §A was adopted by the founder and is codified in `docs/project/SESSION_OPERATING_MODEL.md`; its INT-001 prompt was executed by this session; the remaining prompts are superseded by the post-merge versions in the reconciliation report §7.

**Audit date:** November 6, 2026. **Scope:** master AI-000/001, PR #13 AI-CORE-001 and PR #16 AI-CORE-002a. Evidence: source files, `docs/ai/AI_EVAL_MATRIX.md`, CI, Claude's session 5/6 files.

## One-page verdict

**The AI architecture is real, but the SageSpan custom LLM is not.** The current master includes an **offline deterministic mock** with evidence-grounded draft reports, read-only tool dispatch and a 28-case adversarial test suite. PR #13 adds the missing *actual model → read tool → model* loop; PR #16 adds a synthetic-only hosted Anthropic API adapter with ten offline tests. Neither PR is in master. There is no evaluated live-model accuracy, no production AI data pipeline, no fine-tuning, no in-house inference service, no persistent production AI run record, and no data processing agreement. Such limitations are intentionally stated in the code and reports.

## Architecture / control plane

```text
Authenticated/authorized actor (demo today; real JWT only after PR #10)
   -> Firm household or personal workspace / frozen snapshot
   -> Server-owned evidence resolver (citable facts, check runs, permitted records)
   -> AI provider (mock today; hosted adapter draft)
   -> [PR #13] bounded tool-loop + strict schemas, renewed authorization per tool
   -> Read-only allowed tool results as UNTRUSTED DATA
   -> Server validator (references, citations, calculation amounts, statuses)
   -> Append-only draft + runtime trace
   -> Human review / decision / feedback (never automated approval)
```

The LLM must never be an authoritative calculator or approver. The Python deterministic engine is authoritative for calculations. Human role/policy and RLS are authoritative for permissions. Evidence source IDs are server-resolved. Model-supplied IDs, financial numbers, tool instructions and approval assertions are untrusted.

## Implementation status

| Module | In master? | On branch? | Current evidence/limitation |
|---|---|---|---|
| AI-000 typed review/finding/run/feedback contracts | Yes | — | `packages/contracts/src/ai/*`, versioned schemas |
| AI-001 mock provider, orchestrator and review drafts | Yes | — | `apps/web/src/ai/*`, deterministic script, 28 AI-E + 2 personal cases |
| Evidence resolver / allowlisted read tool dispatcher | Yes | Enhanced in #13 | Tenant-scoped in demo; no write tools |
| Grounding validator | Yes | Reused by #13/#16 | Per-finding amount/ref checks; **report-level narrative gap** identified |
| `ai-runtime-v1` bounded model/tool/model loop | No | PR #13 OPEN | 17 new tests, per-call reauth, budget, dedup, abstention, traces |
| Native hosted Anthropic Messages port | No | PR #16 DRAFT | Synthetic-only gates, forced structured tool output, 10 offline tests |
| Actual live Anthropic benchmark | No | No | One opt-in test skipped; no API key/live run |
| Self-hosted model adapter | No | No | Port and training roadmap only |
| Production AI run tables/RLS | No | No | Reservation for migration `0010+`; not implemented |
| Persistent cross-instance budgets and billing | No | No | PR #16 holds in-memory instance-level counters only |
| RAG knowledge registry / secure vector retrieval | No | No | Proposed; no vector-search tests |
| Fine-tuned SageSpan weights | No | No | Research roadmap only; no training evidence |
| Scheduled proactive monitoring AI-005 | No | No | Proposed; no consented monitor workers |

## Test inventory

- AI-E01…E28: fake citations, foreign workspace, stale run, missing evidence, invented amount in **finding text**, forged locator, invalid approvals, injection attempts, revoked membership, unsupported RMD etc. `docs/ai/AI_EVAL_MATRIX.md` states 30/30 for 28 labeled cases and two personal cases on deterministic mock. This demonstrates contract behavior, **not** predictive or advisory model accuracy.
- AI-C01…C16: PR #13 offline test suite (17 tests) covers bounded continuation, tool-result feedback, forbidden tools, duplicate calls, resource budgets, reauthorization, stale snapshot refusal, prompt injection text, abort/timeouts, legacy one-pass fallback, abstention and trace digests. PR #13 CI run 42239336974 is green.
- AI-H01…H10: PR #16 offline fake-vendor suite covers all required gates, Anthropic transport/request shape, tool_result replay, forbidden tool denial, invalid status/numbers, 429/503/refusal/timeout, process token ceiling, scope rate limit, abstention, secret redaction. Full live benchmark was **not** executed.

## High-priority independent findings

### AI-SEC-001 (P0): report narrative grounding hole

`apps/web/src/ai/result-validator.ts` validates each finding's `title` + `explanation` + `suggested_next_action` against amounts in cited runs, but copies `summary`, `draft_memo`, and `questions` without equivalent monetary-claim checks. This means the general guarantee 'AI cannot invent a number' is currently too broad. Implement a central `validateRenderedFinancialNarrative()` over every model-owned displayed text field; reject/qualify invented amounts, unsupported success claims, false professional authority and fake citation labels. Add adversarial tests for top-level summary, memo and questions with numbers not present in the authorized tool output. Tests should cover both one-pass mock/scripted and two-turn/live adapter output paths.

### AI-INT-002 (P1): production RLS and async store integration

PR #13's current `runToolLoop` callback `reauthorize(): GroundingContext` and `Store` are synchronous demo abstractions. PR #10 uses asynchronous Supabase clients and per-user JWT. Introduce `Promise<GroundingContext>` reauthorization and an append-only production run repository with direct RLS tests. Snapshot/version and active consent must be rechecked at **each tool** and **before persistence**, not just at the start. Do not promote a demo actor cookie as authenticated authority.

### AI-OPS-003 (P1): persistent capacity/cost controls

PR #16's `HostedProvider` uses process-level counters (`tokensSpent`, `runsByScope`). In serverless or horizontally scaled environments, every process can have its own limit; restarts reset it. Before live use beyond a single developer, add shared quotas/spend ledger, reserve/settle logic, rate-limit on account/workspace/org and alerts; caps should fail closed, and should not leak secrets.

### AI-SEC-004 (P1): vendor and untrusted data boundary

PR #16 deliberately requires `SAGESPAN_DEMO_MODE=1`, explicit synthetic acknowledgement, a pinned model identifier and server-side API key. Confirm vendor with founder, select a model only after benchmark, and review retention, DPA, model terms, region, observability, incident/rollback behavior and user/firm consent before any real data transfer. AI-generated output is always DRAFT; a model can never independently grant consent, approve a financial plan or modify authoritative facts.

### AI-QUALITY-005 (P1): evaluation is not model validation

28 synthetic cases plus scripted adversarial tests do not establish real model precision/recall, hallucination rate, useful recommendations or user comprehension. Expand into versioned evaluation sets with (a) no-data/insufficient-data, (b) adversarial privacy/financial prompts, (c) exact financial citations, (d) abstention, (e) human ratings, (f) bilingual/format variants if needed, and (g) per-model regression/latency/cost. Split training and evaluation groups by household/source to prevent contamination.

## Recommended AI release roadmap

1. **AI-CORE-001 merge** (after PR #10 integration): preserve tests and ensure UI stays draft-only; fix the narrative validator P0.
2. **AI-CORE-002b synthetic vendor benchmark:** confirm Anthropic API assumption or replace, pin model, run the opt-in benchmark on frozen synthetic fixtures, measure accepted finding precision, reference integrity, unsupported-claim rejection, abstentions, latency, token use and cost; compare to the mock using `diffReports` and record a human-reviewed decision. The live toggle stays off by default.
3. **AI-INT-001 production boundary:** new RLS-scoped, asynchronous source retrieval; `0010+` migrations for append-only AI run metadata, feedback and policy-controlled retention; explicit consent and revocation; no unapproved egress.
4. **AI-CORE-003 knowledge registry/RAG:** versioned, rights-reviewed rules/methodology with source provenance, document byte hashes and citation locators; separate untrusted customer source text and knowledge content from instructions; enforce workspace scopes for retrieval.
5. **AI-CORE-004 eval and training data:** governed labeling schema, dataset provenance, licensing, PHI/PII protections, contamination split, offline deterministic replay, human error taxonomy and promotion gates.
6. **AI-CORE-005 self-hosting/fine-tuning (conditional):** evaluate open-weight license-compliant candidates against hosted baseline; do LoRA/QLoRA only if clear empirical gap/ROI and suitable data rights. There is no rationale yet for training a foundation LLM from scratch.
7. **AI-005 consented monitoring:** scoped trigger engine, quiet periods, opt-in user notifications, anomaly-review, human confirmation and revocation audit. No autonomous trading/money movement.

## Concrete acceptance criteria before any live model release

- All 28 AI-E, all applicable AI-C and AI-H tests pass; added top-level narrative grounding tests pass.
- Real JWT/RLS tests prove zero cross-tenant evidence on read, continuation, replay, audit record or model request payload; revocation mid-turn prevents further reads and persistence.
- All displayed amounts are traceable to explicitly cited, snapshot-bound receipts, not user/model-provided convenient text; no false 'approved' or professional endorsement.
- Vendor request/response schema mismatches, rate limiting, refusal, timeout, malformed output and network errors fail safe with visible statuses.
- Legal/vendor obligations signed and data transfer purposes documented; actual PII never used in demos/benchmark fixtures.
- Durable cost/rate enforcement and monitoring, per-provider rollback, incident response and retention/deletion tests exist.
- Live benchmark results are signed off and version pinned; model updates never silently auto-promote.

**Recommendation on SageSpan-owned LLM:** Build an owned **AI application/control plane first** (runtime + knowledge registry + evals + policies + data), initially test a hosted provider on synthetic fixtures, then compare an appropriately licensed self-hosted model. Do not train a new foundation model or start fine-tuning before measurable failure cases and data rights are in place.
