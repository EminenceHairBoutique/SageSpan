# SAGESPAN INTELLIGENCE — CLAUDE CODE / FABLE 5.1 MASTER ENGINEERING PROMPT

**Program:** AI-CORE — Proprietary Financial Intelligence Runtime and Future Fine-Tuned LLM  
**Edition:** 1.1 — November 6, 2026, incorporating Session 3 and post-PR-002 integration  
**Use:** Open Claude Code at the root of `EminenceHairBoutique/SageSpan`, select **Claude Fable 5.1** if available, provide this file as the implementation brief.  
**Goal:** Build proprietary SageSpan intelligence (decision engine + trusted tools + model adapters + governed knowledge/evaluation infrastructure), then establish the technical path to a privately served, fine-tuned open-weight model.  
**Initial authority:** **AI-CORE-000/001 only** in an isolated **synthetic-data** branch; the roadmap below is not authorization to build everything at once.

---

## 0. ROLE, MISSION AND EXECUTION BEHAVIOR

You are SageSpan's founding AI/ML architect, senior TypeScript/Python engineer, quantitative financial-model reviewer, application security engineer, responsible-AI architect and technical lead. Use the highest-quality coding/research capability of Claude Fable 5.1, but be disciplined: **inspect the real repository before proposing code, implement one small verifiable phase at a time, preserve user changes, and never invent passing tests or functionality**.

When independent reads/searches are needed, batch them in parallel. Do not parallelize state-changing Git operations, migrations, or dependent builds. Keep concise progress notes and finish with exact evidence. Do not generate an unwieldy second app or an entirely new monorepo.

### Mission

Build **SageSpan Intelligence**, an integrated proprietary AI program for **both B2C individuals/households and B2B financial advisors/RIA firms/compliance teams**, with four product specialties:

- **Personal Financial Intelligence:** budgeting, spending and income patterns, cash flow, debts, financial priorities and low-pressure next steps.
- **Retirement Planning Intelligence:** readiness, transparent scenario proposals, independently calculated projections, trade-offs, income and withdrawal modeling when the engines are validated.
- **Assurance Intelligence:** evidence reconciliation, plan discrepancy identification, unsupported-check detection, source-linked review drafts and human-directed follow-up.
- **Advisor Copilot:** authorization-aware preparation, source-backed review notes, plan comparisons and professional workflows, without impersonating a licensed adviser or CCO.

Our moat is not merely an LLM. It is **trusted financial data + evidence provenance + deterministic finance engines + evaluated decision policies + bounded model reasoning + human authority and feedback**. Start with an external or open-weight language model through an adapter; plan for fine-tuning only when a measured task-specific gap exists. **Do not train a new foundation model from scratch** or claim a proprietary base model now.

**Fable 5.1 is the development assistant. It is not automatically the SageSpan runtime LLM. Do not assume Fable 5.1 is open-weight or fine-tunable.**

---

## 1. REQUIRED REPOSITORY DISCOVERY, VERSION CONTROL AND PRECEDENCE

Read these first, if present, using the actual current names/locations:

1. Root `CLAUDE.md` and its current instructions.
2. `docs/product/SAGESPAN_V5_MASTER_SOURCE_OF_TRUTH.md`.
3. `docs/requirements/SAGESPAN_V5_TRACEABILITY.md`.
4. `docs/engineering/SAGESPAN_V5_ENGINEERING_PROMPT.md`.
5. `docs/product/FEATURE_STATUS_MATRIX.md`, `docs/ai/AI_EVAL_MATRIX.md`, and **`docs/ai/AI_EVALUATION_PLAN.md`** (new plan; if absent in repo, add the supplied file before dependent evaluation work).
6. `docs/architecture/DUAL_WORKSPACE_ADR.md`; `docs/legal/FEATURE_RELEASE_GATES.md`; finance rule/model registry.
7. Existing AI source and tests: `apps/web/src/ai/{provider,review-orchestrator,evidence-resolver,result-validator,tools}.ts`, prompts, AI evals and UI; contracts in `packages/contracts`; `services/calculator` Python methods; Supabase schema/migrations.
8. Current CI, active branches, open PRs, uncommitted changes, and actual test status.

**Current merged baseline (verified 2026-11-06; recheck HEAD):** PR-001 (#5), PERS-002 (#6 via V5), V5 dual-market (#7), and PR-002 (#9, migration `0007_coverage_and_reproducibility.sql`) are merged into `master`. The inspected `master` commit was `52997912dba0`; latest observed GitHub Actions run `42207031870` succeeded. Reported Session 3 results were Python 119, contracts 47, web 104 passed/2 skipped, and Playwright 16; SQL comprised seven PostgreSQL/pgTAP-shim test files. These are **not real Supabase Auth/JWT/PostgREST/RLS tests**, financial expert review, or production AI benchmarks. The prior unmerged-V5, unmerged-PR-002 and failing-master-CI statements are superseded. The runtime remains an offline mock/scripted provider with one-pass `provider.complete()`, read-only dispatcher, draft validator, 28 named evaluations, plus two consumer cases; a real model adapter and true model-tool-model loop are not demonstrated. PR-003A/B/C/D is now the production critical path. Verify live repository state before work.

Before editing, produce a **reality matrix** with columns `component`, `actual file`, `implemented behavior`, `gaps/risks`, `specific planned change`, `tests`. Use `git status --short`, `git branch --show-current`, `git log -8 --oneline`, `git fetch` only if safe, branch comparison and CI evidence. Never discard the founder's edits, edit applied migrations or force-push. Develop in a separate `feat/ai-core-001-runtime` branch after checking that the working tree is clean and reviewing its base.

**V5 dual-market direction is binding.** Financial accuracy, tenant isolation, consent, PR-001/002 invariants, and legal feature release gates are binding. Resolve code/document differences transparently. Do not silently supersede established correct functionality.

---

## 1A. SESSION 3 AI-GOVERNANCE AND FINANCIAL-CORRECTNESS INTEGRATION

**Reference companion:** `docs/ai/AI_EVALUATION_PLAN.md`. This is distinct from the implemented offline test-case inventory `AI_EVAL_MATRIX.md`; follow both and never infer that a mock-provider pass predicts live model accuracy.

**PR-002 semantics to preserve in AI:**

- **S-06:** distinguish `SUPPORTED_CHECK_VERIFIED`, `APPROVED_WITH_EXCEPTIONS`, and `REVIEWED_WITH_LIMITATIONS`. Human approval of a bounded review does **not** mean unsupported accounts were independently verified. AI cannot promote `UNSUPPORTED`, `INDETERMINATE`, `ERROR`, or `NOT_REQUIRED` into PASS.
- **S-07:** all calculation-relevant tolerance/account classifications must be frozen in the calculation snapshot; model and scenarios can read only authorized frozen or clearly provisional data, never silently substitute live assumptions for reproducible calculations.
- **N-02:** latest calculation attempt determines current review; preserve historical ERROR. There is a potential TS/SQL equal-timestamp tie-break mismatch: design a shared attempt sequence/total-order regression rather than trusting string timestamps or random UUID semantics. AI evidence and packet rendering must share the same resolver.
- **Policy distinction:** immutable historical calculation assumptions versus **current** actor permissions, consent status, membership, approval rights. A revoked user cannot continue an old AI/tool call, even if their old frozen snapshot remains reproducible for authorized reviewers.
- **New B2C AI tools:** The user-controlled intake and deterministic cash-flow what-if scenarios from PERS-002 exist in the synthetic app. Reuse them; the model may propose permitted scenario inputs, and a trusted engine must issue versioned receipts before the assistant describes financial impacts.

**Evaluation progression:** offline labeled AI-E01…AI-E28 → typed two-turn tool loop → 50+ distinct synthetic benchmark groups → hosted/open-weight model head-to-head on expert-scored holdout → optional LoRA experiment with authorized data and model registry → private serving only when it materially improves measured tasks. Keep each experimental stage separately gateable. **No fine-tuning in AI-CORE-001.**

**Implementation sequencing:** PR-003 is the critical-path program. AI-CORE-000/001 may progress on synthetic, separate branches. Do not put live-model integration and database/auth migration changes into one PR. In all code/handoffs, verify latest master SHA and CI before claiming status.

---

## 2. NON-NEGOTIABLE SYSTEM BOUNDARIES

Retain the current Next.js/React/TypeScript app, shared Zod contracts, versioned Python/FastAPI calculator service at **`services/calculator`**, and existing Supabase/PostgreSQL security design. Do **not** create a second finance engine or put authoritative calculations inside the LLM, JavaScript UI or prompt templates.

The ownership model is:

| Layer | Authority |
|---|---|
| Identity, workspace, consent, policy | Trusted server and DB, always reauthorized |
| Financial facts, evidence, provenance, snapshot | Trusted stores with review and versioning |
| Deterministic models | Authoritative bounded calculations, rule/version receipts |
| Decision policy | Hard feasibility constraints and transparent ranking; may abstain |
| LLM | Explanation, question generation, hypothesis, proposed scenario, draft |
| Qualified reviewer / consumer | Decision ownership and approval within granted role |

AI may **never** autonomously verify a fact, certify coverage, alter a financial input, approve a plan, change policy or permissions, move money, trade, publish regulated advice or send sensitive data elsewhere. A review “PASS” is not an overall approved plan. Invalid, stale or unsupported numerical results must never become recommended dollars.

**Release constraints:** Use synthetic data and mock tools for initial AI-CORE. PR-001/002 are already merged into the audited baseline but not real-stack validated; real financial data and provider processing of identifiable financial records require completed PR-003 production Auth/JWT/PostgREST/RLS/Storage, consent/revocation, private storage, vendor data-processing approval, model governance, privacy and legal review. Tier-3 personalized securities advice remains OFF without the proper regulated business model and supervisory controls. Tier-4 trading/transfers remain out of scope.

---

## 3. TARGET ARCHITECTURE — ONE AI CORE, MULTIPLE SPECIALISTS

```text
Personal / Household UI          Advisor / CCO UI
           \                       /
            Next.js authenticated server boundary
                      |
            AI-CORE Orchestration API
  identity + workspace + consent + purpose + rate limit
                      |
               Context Builder
   typed data / provenance / freshness / coverage /
        authorized source excerpts (untrusted)
                      |
                 Model Router
  Mock | approved hosted model | private open-weight
                      |
        Bounded structured tool-call state machine
    read_facts | read_evidence | get_check_runs |
    read_personal_baseline | propose_scenario |
       run_supported_projection (only when built)
                      |
       Tool Result Validator + Finance Receipts
                      |
   Structured Output / Citation / Advice Policy Gate
                      |
         DRAFT insight + options + limitations
                      |
        Explicit consumer or adviser decision
                      |
  Immutable run metadata + feedback + eval telemetry

      Python deterministic calculator (existing)
      PostgreSQL / Supabase / private evidence store
      Versioned, licensed, retrievable knowledge corpus
```

### Specialist modules (routing by **authorized task**, not separate chatbots invented for marketing)

- `personal` — receipts from existing cash-flow and debt modules, patterns and guardrail status.
- `retirement` — only supported readiness and scenario tools; retire-at-X projections require PLAN-001 to be implemented and signed off.
- `assurance` — frozen facts, source-to-fact conflicts, check coverage, evidence requests and reviewer drafts.
- `advisor` — firm-specific client consent, review queue and evidence-linked memos.

Avoid a “multi-agent swarm” initially. One orchestrator with deterministic routing, typed tools and several task policies is simpler to audit. Agent composition is optional later and must pass its own permission/latency/evaluation gates.

### Provider adapter contract

Extend the current `AiProvider` rather than rewriting it. Define a versioned, backwards-compatible request/response layer with:

- Provider and exact model ID/revision, capability discovery, context ceiling, supported tool schema, structured output format, data-handling class.
- Input: authorized minimal context, task kind, prompt/schema version, explicit available tools, resource budget; no client-supplied workspace authority.
- Output: structured assistant content, zero or more typed tool calls, token usage/cost if available, refusal/stop/failure reason, model/provider metadata.
- Implement **deterministic mock** as first-class, optional **hosted provider** only if securely configured, and a future **OpenAI-compatible private server adapter**. OpenAI compatibility is an API shape, *not* permission to expose a raw vLLM server to the internet.
- Fail closed when model returns illegal tool/status/amounts or service is unavailable; degrade to honest read-only baseline when that is safe. No stealth switch to a cheaper provider with different data-retention terms.

### Bounded multi-step tool loop (upgrade required)

The current V5 source historically called `provider.complete()` once and dispatched `tool_calls` from the already generated output. Do **not** represent that as a live iterative tool agent. Implement a distinct **state machine** for bounded continuation:

`AUTHORIZE → RESOLVE_CONTEXT → REQUEST_MODEL → VALIDATE_TOOL_REQUESTS → AUTHORIZE_EACH_TOOL → EXECUTE_ALLOWED_READ → ADD_TOOL_RESULTS → CONTINUE_MODEL (bounded) → VALIDATE_FINAL_DRAFT → RECORD → RETURN`.

Enforce **before dispatch**: maximum tool calls, loop turns, wall-clock timeout, output size, monetary token budget, allowed tool names, exact tool arguments schemas, no duplicate cyclic requests, no arbitrary URL/file/network/SQL access, and tenant + purpose permissions. Reauthorize on every tool invocation and before persistence/export; handle expired/revoked grants during a run. No document content may introduce a tool command or expand its privileges. Preserve immutable model transcript metadata and verified result digests **without unnecessarily storing raw PII**.

Constrain task outcomes to `DRAFT_READY`, `REJECTED`, `ERROR`, `ABSTAINED` or current equivalent; never `APPROVED` from AI. Human decisions create a separate audited record. Validate cited account/fact/doc IDs, effective dates, locator existence, latest applicable calculation receipt, tool-backed numeric statements, status/coverage and legal advice tier. The existing regex-based money guard may be useful defense-in-depth but **must not be the sole provenance validator**: enforce structured `amount_ref` fields resolved to calculator output.

---

## 4. PRODUCT INTELLIGENCE — REALISTIC FINANCIAL DECISIONS

The engine must reason over **typed observations and checked options**, not produce opaque advice. For a household, compute/identify candidate actions using:

1. Data coverage and freshness: available cash, incomplete accounts, stated income and date windows, essential obligations, debts and APR terms, uncertainties.
2. Patterns: recurrence, paycheck timing, irregular/seasonal income, true spending net of transfers/refunds, concentration of bills, cash buffer variability. Only report a pattern when sample size and data coverage support it.
3. Candidate alternatives: revise a budget category, preserve reserves, defer a discretionary purchase, compare extra debt payments, adjust savings goals, clarify missing evidence, simulate a bounded change. Always include “gather information / do nothing for now / seek professional help” when appropriate.
4. Hard constraints **first**: required debt payments, liquidity floor, bills before paydays, negative cash projections, user preferences, unsupported tools, unsuitable regulated advice. Ranking applies only to feasible alternatives.
5. Proposed priority: explain urgency, reversible benefits, impact (only from engine), downside risks, effort, what could invalidate result and user's decision authority.

Default to at most **three** top actions and allow “Why?”, “What if?”, “Dismiss,” “Not relevant,” and “Review assumptions.” Avoid fear-based scoring, artificial urgency, diagnoses, investment-return promises and assertive unsupported conclusions. Separate `OBSERVED`, `PROJECTED`, `HYPOTHESIS`, `MISSING`, `STALE`, `CONFLICTING`, `UNSUPPORTED`, and `REVIEWED` states.

Specific known model-methodology risks to retain in the backlog: debt avalanche ordering currently uses standard APR even during promo terms; amortization-feasible is not automatically future-household-cash-flow feasible; the personal forecast used latest account balance date rather than a validated planning anchor. **Do not solve those by changing AI prose**; fix their deterministic engines under separately tested financial PRs and forbid strong recommendations until then.

---

## 5. FINANCIAL KNOWLEDGE — RETRIEVAL BEFORE FINE-TUNING

Create a source-controlled **Knowledge Registry** with explicit provenance and licensed usage, initially over approved public financial education, verified IRS/SSA/relevant agency texts, internal model cards and documented calculation methodologies. Each item requires:

- source title, authority, canonical URL/file identity, version, jurisdiction, effective/as-of date, retrieved date, license/use permission, expiration/revalidation rule, content digest and internal owner;
- extraction pipeline with page/section/line locators (no fabricated citations), deduplication, change tracking, review status (`DRAFT`, `REVIEWED`, `PUBLISHED`, `EXPIRED`);
- scope tags: consumer education vs plan assurance vs retirement/tax vs investment, and explicit `not_a_calculator` boundary;
- tenant segregation and permitted-content filters for any future private RIA/consumer corpus.

Start with a local, deterministic corpus and exact-term/metadata retrieval. A vector index can be a later additive capability **only if** tenant filtering occurs before/inside query and revocation is enforced; it must never let a model retrieve another firm's documents or combine consumer/firm identities. A retrieval reference is not independent truth: date-sensitive IRS/legal figures are authoritative only through a versioned, reviewed rule/model when used in calculations.

**Do not fine-tune on statutory rules or changing tax rates as a substitute for updating verified retrieval and the deterministic calculators.** Keep knowledge text and calc rule updates independently versioned.

---

## 6. TRAINING-DATA PROGRAM — PREPARE FOR OWN FINE-TUNED MODEL

Build training readiness **before** running a GPU experiment. Produce a reproducible data pipeline for **synthetic, human-reviewed or appropriately licensed** examples, with zero default ingestion of live customers' private transactions, documents or conversations. Real client data may be used for training only after explicit, separately reviewed purpose-specific consent/rights, regulatory/privacy review, retention/deletion mechanisms and approved vendor terms; do not infer permission from access for financial planning.

### Dataset schema and provenance

Each record should contain:

- immutable example ID, task/skill (`EXPLAIN`, `REQUEST_EVIDENCE`, `SELECT_TOOL`, `SCENARIO_COMPARE`, `ABSTAIN`, `RISK_EXPLAIN`, `FIRM_DRAFT`);
- synthetic household/workspace grouping key; minimal structured fact references and versions; available tool schemas and expected tool calls/results;
- target structured answer with **receipted** amount references, allowed source citations, missingness, limitations, authority tier and correct refusal/abstention where required;
- provenance/license/author/reviewer, version, creation timestamp, consent class, sensitivity tier, source corpus IDs, hash and quality state;
- label of whether the example is synthetic, expert-authored, generated by another model and expert-reviewed, or observed production feedback with valid training rights;
- policy set and calculator/rule version to prevent training on unsupported “correct” numbers.

Reject duplicated/near-duplicated examples, cross-tenant IDs, prompt injections masquerading as instructions, false legal claims, fabricated amounts, and examples whose reference answers disagree with validated calculators. Keep **train, validation and permanently held-out test sets grouped by synthetic household/source** to avoid leakage. Protect held-out cases and canaries from training; add contamination checks, coverage reports, class balance, multilingual/reading-level tests where relevant, and a reproducible training manifest.

### Dataset development order

1. **Curated gold set** from the existing 28 AI evals + newly designed consumer and professional cases; manually verify exact answers and tool receipts.
2. **Synthetic scenario generator** that varies household constraints, stale or conflicting facts, interest scenarios, ineligible account types and financial goals. Every generated numerical target must come from the deterministic engine; split groups before generating paraphrases.
3. **Human expert review** and rubric for risky financial decisions; label uncertainty and when the correct answer is to ask for more information.
4. **Preference/feedback set** of accepted/edited/rejected explanations, never treating user acceptance as proof of mathematical or regulatory correctness.
5. **Fine-tuning dataset exports** in a stable JSONL conversation/tool-call format with schema validation and a manifest. Private examples encrypted and access controlled; no sensitive dataset committed to Git.

Prepare for corrections: record training-set membership, artifact lineage, revoked rights and model replacement/retraining procedures. Do not claim instantaneous unlearning from immutable fine-tuned weights.

---

## 7. FUTURE OPEN-WEIGHT MODEL AND TRAINING STRATEGY

**Do not begin GPU fine-tuning in AI-CORE-001.** First benchmark the hosted provider (if approved) against two or more open-weight candidates and the deterministic mock using exactly the same private synthetic/evaluation suite.

Evaluate models based on commercial license, parameter size, supported structured output/tool calling, hardware footprint, context needs, English/multilingual financial explanation quality, false citation rate, capability to abstain, token cost, latency and security. A candidate **for evaluation**, not an approved final choice, is **`Qwen/Qwen3-8B`** (model card currently lists Apache-2.0). Reverify the exact model/revision/license and dependency licenses before commercial use. Do not assume an unrelated proprietary hosted model provides fine-tunable weights or authorization to distill its outputs.

**Training path:** if prompting/RAG/tools underperform on a stable, measurable skill, run a **LoRA/QLoRA-style parameter-efficient fine-tuning experiment** on the selected permitted open-weight base model; use Hugging Face PEFT/Transformers (or compatible, pinned tooling) for GPU worker jobs. Keep training outside Next.js handlers and the Python financial-calculator process. Include reproducible configuration, pinned dependencies, seed, hardware requirements, run/checkpoint manifests, adapter/base hashes, evaluation results, model cards, license and rollback. No unattended private GPU training with client data. Fine-tuning cannot be accepted merely because loss fell: require real held-out regression superiority against the base and no weakening of safeguards.

**Private serving path:** a future GPU service based on vLLM or an equivalent inference engine, behind a server-owned authenticated gateway, private network, egress rules, per-tenant accounting and rate limits. Do not expose a default OpenAI-compatible model-server port publicly. Add a `SelfHostedProvider` adapter using the existing `AiProvider` interface; require pinned model ID and revision, supported chat template/tool calling, server-generated request IDs, model/provider status and versioned rollback. Benchmark cold starts, context size, concurrency, P50/P95 latency, tokens/second, cost per successful accepted analysis and error budget.

Maintain automatic **fallback only when the substitute has equivalent authorized privacy/data processing scope**. Every run records the actual provider/model, not the intended provider. Public/private models may both be used in different environments, but users must not be misled about data location or handling.

### Promotion gates for an adapted model

- License and data-training rights independently reviewed.
- Stable artifact lineage: base weights revision + adapter revision + tokenizer/template + dataset manifest + code hash.
- Zero accepted hallucinated fact/document IDs, unauthorized tool operations, unbacked authoritative amounts or model approvals across negative-gate tests.
- Evaluate false positives/false negatives, financial safety, correct abstention, citation/amount grounding, policy and authority compliance, usability and differential performance across household segments; report denominators and confidence intervals where feasible.
- Meets agreed minimum quality vs baseline, within latency/cost/privacy limits; human model owner and finance reviewer sign off applicable aspects; canary deployment, monitoring and rollback exist.
- Re-run historical 28 labeled cases and fresh withheld scenarios at **every** model/prompt/knowledge/tool-schema update. Do not overfit the published 28-case suite alone.

---

## 8. EVALUATION, SECURITY, OPERATIONAL AND GOVERNANCE CONTRACT

### Offline baseline (required now)

Retain all 28 labeled AI-E01–E28 cases with unchanged semantics; preserve existing Playwright and calculation tests. Add new AI-CORE cases covering:

1. Multi-turn tool continuation with authorized output feeding model; independent tool calls and cancellation.
2. Tool-call cap enforced **before any dispatch**, not after model completion; retries and cyclic calls bounded.
3. Document/source text attempts instruction override, network exfiltration, tool impersonation, fake currency figures and malicious nested JSON.
4. Revoked consent midway through a long run; unrelated personal/firm workspace IDs; RLS error and no message-body leaks.
5. Numeric statements only through validated structured references and actual engine receipts; reject unsupported account/plan scenarios.
6. Stale balance dates, unknown APR, promo APR, cash-floor breach and unaffordable debt suggestions.
7. Hosted/private provider failover, invalid JSON, malformed tool arguments, timeout, token-budget overrun, provider refusal, provider errors and rate limiting.
8. Cross-model regression and financial-methodology differences; no “AI is 99% confident” scores fabricated by the model.
9. Dataset license violations, train/test contamination, fake gold answers and canary leakage.
10. Provider outage fallback that honestly labels mock/disabled capabilities.

**Security principles:** apply V5 S-01–S-10 and N-01–N-05 findings; explicit least privilege; read-only tool allowlist; immutable run history; private source storage; tenant and purpose authorization at every boundary; consent; encrypted data; secret management; injection defenses; safe rendering; no raw PII in logs; retention and deletion operations; reviewer signoff. Document risk register aligned with NIST GenAI AI RMF and the current OWASP LLM guidance. No certification implied.

**Quality/observability:** log run_id, task/workspace ID pseudonyms where possible, prompt/model/schema/corpus versions, sources used, tool names/digests, outcome, validation reasons, token cost, latency, evaluation version and reviewer feedback. Separate an accepted AI *draft* from a professional approved document. Use alerts and dashboards for rejection rate, unauthorized tool attempts, false-alarm trends, P95 latency, drift and cost, with sensitive-data redaction.

**Regulatory:** document legal advice tier/feature policy. Preserve low-risk education and budget decisions; individualized paid securities recommendations, tax/insurance opinions and RIA advice require counsel-defined registration/partner, disclosures, fiduciary/supervisory arrangements and financial model verification. A model card or benchmark cannot authorize regulated advice. No autonomous trades, bill payments, bank transfers or withdrawals.

---

## 9. DEVELOPMENT PLAN — REVIEWABLE PRs, NOT A REWRITE

### AI-CORE-000 — Discovery, threat model, contracts and architecture (safe documentation)

Deliver:

- `docs/ai/AI_CORE_ARCHITECTURE.md` — exact dataflow, existing code reuse, versioned contracts and server-only authorization.
- `docs/ai/AI_CORE_THREAT_MODEL.md` — attacker/asset/trust boundary, privacy/consent, injection, excessive agency, provider risks and mitigations.
- `docs/ai/AI_CORE_EVALUATION_PLAN.md` — 28-case inheritance, additional labels, error classes, pass/fail measures and withheld-set policy.
- `docs/ai/AI_CORE_MODEL_AND_TRAINING_ROADMAP.md` — provider options, private hosting, dataset rights, LoRA experiment gates, cost plan and model registry.
- `docs/ai/AI_CORE_FEATURE_STATUS.md` — verified current vs proposed and dependencies on merged PR-002 versus open PR-003.

No new provider keys, financial schema migrations or live customer data.

### AI-CORE-001 — Implement the first **working** runtime vertical slice

On a focused new branch, deliver the smallest behaviorally meaningful, testable code change:

- Retain `MockDeterministicProvider` and `ScriptedProvider`; refactor/extend the provider contract in a backwards-compatible way to permit `assistant content → tool calls → tool results → continuation`.
- Implement **bounded AI tool-loop state machine** with server ownership, pre-dispatch budgets, per-tool validation/auth, stop/error/abstain paths and safe cancellation. Avoid changing financial rules, workflow SQL or original human approval.
- Create versioned typed schemas and a `run_id` record for tool/result digests, model metadata and accepted draft status; maintain existing immutable AI run/feedback behavior.
- Build one synthetic end-to-end task each: (a) Personal user asks why a cash-buffer alert exists and requests a permitted scenario explanation, (b) Advisor runs Analyze Plan on a fictitious household with a supported RMD discrepancy or unsupported coverage. Only consume already implemented calculation tools; no fictitious PLAN-001 results.
- Add unit tests and E2E where feasible; preserve all existing 28 AI labeled cases and the firm assurance flow. Ensure the service is usable **without** a live model/GPU/API key.
- Add `SAGESPAN_AI_PROVIDER` configuration with values `mock` as default in demo, `hosted` and `self_hosted` as future options **not enabled** until validated. If a live provider can be added safely in a separate subsequent PR, design its port but do not deploy external financial-data processing now.

**AI-CORE-001 Definition of Done:** the test model requests authorized read-only evidence, the tool executes with controlled arguments, its verified results are returned for a second model turn, a final draft is schema/citation/amount validated, and the run is recorded with exact tool/model/version details. Illegal calls are denied before execution; user- and firm-scoped negative tests succeed; no production data is touched; branch CI is green where runnable.

### AI-CORE-002 — Approved hosted model integration (synthetic first)

Build provider adapter with typed tool calling and structured response support, rate limits and cost controls; live synthetic benchmark; privacy contracts and model approval. Introduce real-data processing only after PR-003/G3 and vendor authorization.

### AI-CORE-003 — Knowledge and retrieval

Source/version registry, minimal trusted corpus, citations, effective-date filtering and robust permissioned retrieval. Changes to tax/SSA rules still go through deterministic model versioning.

### AI-CORE-004 — Training data and evaluations

Synthetic generator, expert-reviewed gold set, lineage/consent/licensing, grouped splits, contamination checking, dataset manifests and reproducible quality metrics. **No GPU fine-tuning required yet.**

### AI-CORE-005 — Open-weight model bake-off and private serving spike

Evaluate several licenses/hardware classes; reproduce structured tool-loop behavior via private endpoint, safely gatewayed; measure quality, throughput, P95 latency and operating cost. No public deployment or financial PII.

### AI-CORE-006 — Small LoRA/QLoRA fine-tuning experiment

Only after data/eval/license gates; benchmark base vs adapter on permanently held-out cases; store model card, adapter hashes and rollout/rollback decision. Do not auto-merge a lower-performing model.

### AI-CORE-007 — Governance and controlled release

Owner-signed model register, provider routing policy, version changes, rollback, per-workspace controls, professional/counsel release gates, data retention, drift monitoring, cost/latency dashboards and canary strategy.

**Parallel-track dependencies:** PR-001 and PR-002 are merged at the inspected baseline; preserve their tests. **PR-003A/B/C/D real Auth, RLS, consent and storage is now the highest-priority production workstream**, blocking real personal data and external model processing of customer records. **PERS-002 guided intake and cash-flow scenario comparison are already integrated in the synthetic tier**; do not duplicate or rebuild them. PERS-003 transaction/spending intelligence, PERS-004 budgeting and PLAN-001 validated retirement projection are distinct financial/product workstreams. AI-CORE-000/001 can proceed in a separate synthetic-only branch while PR-003 advances. Do not silently absorb those workstreams into an AI task.

---

## 10. REQUIRED TESTS AND HANDOFF REPORT

Run, when available, and report **actual** results: `npm run typecheck`, `npm run lint`, contracts and web Vitest, locked Python `pytest`, OpenAPI/schema drift, Next.js build, Playwright synthetic firm and consumer flows; add dedicated AI-CORE tests and report counts. Do not call PostgreSQL shim harness “real Supabase”. For cross-tenant real-data readiness, separately require Auth/JWT/PostgREST/RLS tests. If any command cannot be run, mark **NOT RUN** with reason.

Return a concise but detailed handoff with:

1. Current Git SHA, branch, uncommitted changes and PR dependency map.
2. What the existing AI system actually did, and what the new code does.
3. Architecture and dataflow with tool/consent/persistence boundaries.
4. Exact files changed; migrations (ideally none in AI-CORE-001); API and schema compatibility.
5. Security and AI-failure tests: inputs, expected outcomes, actual results.
6. Demo: explain a permitted personal cash-flow finding; investigate a supported synthetic RMD finding; demonstrate denial of a forbidden tool call.
7. Model and dataset roadmap: candidate licenses, governance, data generation, training conditions, serving options, cost risks and measurable promotion gates.
8. Open blockers and the **single smallest next PR**.

**First session instruction:** Complete repository reconciliation, AI-CORE-000 documents, and a bounded AI-CORE-001 runtime implementation **only if** the branch is clean, tests can be maintained and security invariants are not touched. Otherwise complete AI-CORE-000 and produce the smallest patch plan. No training run, no live customer data, no blanket PR merge, no production deployment.

### Final commitment

**Build SageSpan's own intelligence system by owning the model interface, evidence graph, deterministic engines, policy constraints, evaluation sets, training rights and operational controls. Make fine-tuning an evidence-based upgrade—not a substitute for correct financial mathematics, trusted sources, human oversight or security.**

---

## Official technical references to reverify when implementing

- Claude Fable 5.1 model overview and coding guidance: https://platform.claude.com/docs/en/models/fable-5-1/overview and https://platform.claude.com/docs/en/models/fable-5-1/whats-new-fable-5-1
- Hugging Face PEFT/LoRA: https://huggingface.co/docs/peft/main/conceptual_guides/lora
- Qwen3-8B reference model card and license: https://huggingface.co/Qwen/Qwen3-8B
- vLLM server documentation: https://docs.vllm.ai/en/latest/serving/openai_compatible_server/
- NIST GenAI risk-management profile: https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence
