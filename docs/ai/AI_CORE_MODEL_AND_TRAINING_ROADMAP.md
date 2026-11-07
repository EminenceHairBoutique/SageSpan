# AI-CORE model, serving and training roadmap

**Status:** planning document. Nothing below past AI-CORE-001 is built, approved or scheduled. No model has been benchmarked, no GPU has been provisioned, no training data exists. The founder's `AI_EVALUATION_PLAN.md` (FT-0…FT-5, Suites A–F) governs the promotion gates; this document is the engineering route to them.

## 1. Provider options and the adapter port

| Option | Status in repo | Data handling class | Gate before use on synthetic data | Gate before any identifiable data |
|---|---|---|---|---|
| `MockToolLoopProvider` / `MockDeterministicProvider` | **Implemented**, default | `IN_PROCESS_NO_EGRESS` | — | — |
| Hosted vendor model (`SAGESPAN_AI_PROVIDER=hosted`) | **Port only** (`apps/web/src/ai/providers/port.ts`); resolves to mock + note | `HOSTED_VENDOR` | AI-CORE-002: adapter, server-side key, per-tenant rate limit, cost ceiling, structured output + tool calling verified against AI-E/AI-C with a live run on synthetic fixtures | G3 + vendor DPA + retention terms + founder vendor decision + incident runbook |
| Self-hosted open-weight model (`self_hosted`) | **Port only**; resolves to mock + note | `SELF_HOSTED_PRIVATE` | AI-CORE-005: private inference service (vLLM or equivalent) behind SageSpan's authenticated gateway, private network, egress rules, pinned model id + revision, chat template with tool calling, P50/P95/cost benchmark | G3 + model licence review + ops runbook |
| Fine-tuned adapter on an open-weight base | **Not started** | `SELF_HOSTED_PRIVATE` | AI-CORE-006 after AI-CORE-004 data gates | FT-3 head-to-head superiority on withheld set, zero safety regression, model card, rollback |

The port (`LiveProviderPort`) fixes the request/response/failure shapes so the runtime does not change between vendors: the adapter receives the authorised context, the strict tool schemas, the turn number, prior output and untrusted tool results, a server request id and budgets; it returns structured output, usage, the descriptor of what **actually served** the request, and typed failures (timeout, rate limit, refusal, malformed, unavailable). Any adapter that silently substitutes another model or vendor violates the port.

## 2. Candidate open-weight base (for evaluation, not selection)

- **Qwen/Qwen3-8B** — the model card lists Apache-2.0 (reverified 2026-11-06 via public listings; confirm the exact revision and licence text on the official card before any commercial use, and check dependency licences). Dense 8B, native 32k context, tool-calling chat template, fits LoRA/QLoRA on a single 24–48 GB GPU class. Candidate for the bake-off only.
- At least one further commercially licensed candidate of a different family should be evaluated in the same harness so the comparison is not single-vendor.
- Claude Fable 5.1 is the **development assistant** for this repository. It is not assumed to be open-weight, fine-tunable, or a SageSpan runtime provider; using any hosted Claude model as the runtime provider would go through the hosted port and its gates like any vendor.

## 3. Private serving spike (AI-CORE-005)

- Inference engine: vLLM or an equivalent OpenAI-compatible server. OpenAI compatibility is an API shape only; the server is **never** exposed publicly. It sits behind a SageSpan-owned gateway that authenticates the web tier, enforces per-tenant accounting and rate limits, forwards the server request id, and records the served model id/revision on every response.
- Benchmarks to record (Suite F0): cold start, context size, concurrency, P50/P95 latency, tokens/second, cost per accepted analysis, error budget, GPU memory by quantisation.
- No financial PII in the spike; synthetic fixtures only.

## 4. Knowledge before fine-tuning (AI-CORE-003)

A source-controlled Knowledge Registry (title, authority, canonical URL/file identity, version, jurisdiction, effective/as-of date, retrieved date, licence, revalidation rule, digest, owner; status DRAFT/REVIEWED/PUBLISHED/EXPIRED; scope tags; `not_a_calculator` boundary) over approved public education, verified agency texts, internal model cards and method documentation. Exact-term/metadata retrieval first; a vector index only later and only with tenant filtering inside the query and revocation enforced. Date-sensitive IRS/legal figures become authoritative only through the versioned rule/method registry (`docs/finance/RULE_VERIFICATION_AND_MODEL_REGISTRY.md`), never through retrieval or weights.

## 5. Training-data programme (AI-CORE-004)

- Record schema: immutable example id; task (`EXPLAIN`, `REQUEST_EVIDENCE`, `SELECT_TOOL`, `SCENARIO_COMPARE`, `ABSTAIN`, `RISK_EXPLAIN`, `FIRM_DRAFT`); synthetic household/workspace group key; fact references + versions; tool schemas and expected calls/results; target structured answer with receipted `amount_ref`s, allowed citations, limitations, authority tier and correct abstention; provenance/licence/author/reviewer; consent class; sensitivity tier; corpus ids; hash; quality state; origin label (synthetic / expert-authored / model-generated-expert-reviewed / production-feedback-with-rights); policy set and calculator/rule versions.
- Rejections: duplicates/near-duplicates, cross-tenant ids, injections masquerading as instructions, false legal claims, fabricated amounts, reference answers that disagree with the engine.
- Partitions grouped by synthetic household/source; permanently held-out test set and canaries protected from training; contamination checks, coverage and class-balance reports; reproducible manifest; JSONL export with schema validation; private examples encrypted, never committed.
- **Zero default ingestion of real customer transactions, documents or conversations.** Real data for training requires explicit purpose-specific consent/rights, privacy and regulatory review, retention/deletion mechanics and approved vendor terms. Unlearning from fine-tuned weights is not claimed; retraining and replacement procedures are documented instead.

## 6. LoRA/QLoRA experiment (AI-CORE-006)

Only if prompting + retrieval + tools underperform on a stable, measurable skill. Parameter-efficient fine-tuning (Hugging Face PEFT/Transformers or compatible pinned tooling) in an isolated GPU worker — never inside Next.js handlers or the calculator process. Reproducible config, pinned dependencies, seed, hardware spec, run/checkpoint manifests, adapter/base hashes, evaluation results, model card, licence, rollback. Acceptance requires real held-out regression superiority against the base and the hosted baseline with no weakening of AI-E/AI-C safeguards. Falling loss is not acceptance.

## 7. Governance (AI-CORE-007)

Owner-signed model register (`docs/ai/AI_MODEL_REGISTRY.md`, proposed): provider routing policy, model/prompt/tool-schema/corpus versions, canary and rollback, per-workspace controls, counsel release gates, retention, drift/cost/latency dashboards (rejection rate, unauthorised tool attempts, false-alarm trends, P95, cost). Every run already records `runtime.provider_descriptor` — the register will reconcile against it.

## 8. Cost and risk notes

- Hosted vendor: variable per-token cost, vendor retention terms, model deprecations; mitigated by the port, budgets, and recording what ran.
- Self-hosted: fixed GPU cost, ops burden, licence diligence; mitigated by a spike with measured P95/cost before any commitment.
- Fine-tuning: data-rights and contamination risk dominate; mitigated by AI-CORE-004 gates preceding any GPU time.

## 9. Promotion gates for an adapted or live model (summary)

Licence and training-rights review; stable artifact lineage (base revision + adapter revision + tokenizer/template + dataset manifest + code hash); zero accepted hallucinated ids, unauthorised tool operations, unbacked amounts or model approvals across negative-gate tests; FP/FN, abstention, grounding precision, authority compliance, usability and segment-differential reporting with denominators; minimum quality vs baseline within latency/cost/privacy limits; named human model owner and finance reviewer sign-off; canary, monitoring, rollback; replay of AI-E01…E28 and AI-C01…C16 plus fresh withheld scenarios at every model/prompt/knowledge/tool-schema update.

## References to reverify before implementing (not verified in this session beyond the licence note above)

- Hugging Face PEFT / LoRA conceptual guide — https://huggingface.co/docs/peft/main/conceptual_guides/lora
- Qwen3-8B model card and licence — https://huggingface.co/Qwen/Qwen3-8B
- vLLM OpenAI-compatible server — https://docs.vllm.ai/en/latest/serving/openai_compatible_server/
- NIST AI RMF Generative AI Profile — https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence
- Claude Fable 5.1 model overview — https://platform.claude.com/docs/en/models/fable-5-1/overview
