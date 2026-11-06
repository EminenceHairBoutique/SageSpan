# SageSpan V5 — Requirements Traceability and Non-Regression Matrix

**Status:** Documentation-level reconciliation, November 5, 2026. This matrix records where prior requirements are preserved in V5. It does **not** prove that the code implements them or that corresponding tests passed. The historical v2 audit used `master` / `1151c1e`; current code must be re-examined before assigning status.

**Artifact keys:** **V5-B** = `SageSpan_V5_Unified_Master_Blueprint.md`; **V5-C** = `SageSpan_V5_Claude_Code_Master_Engineering_Prompt.md`. **V4-B/V4-C** = preceding dual-market documents; **AI** = `SageSpan_AI_Planning_Blueprint_and_Claude_Prompt.md`; **P3** = `SageSpan_PR-001_Reviewed_Prompt_v3.md`; **A2** = `REPOSITORY_AUDIT_2026-11-05_v2.md`; **V3** = previous SageSpan context pack.

**Controlling principle:** V5 changes the target customers to B2C + B2B. It does not cancel B2B evidence/assurance design or any P0 security finding. Financial and AI features absent from the repository remain **requirements, not delivered features**.

## A. Founder direction and product design

| Requirement | Origin | V5 blueprint | V5 Code directive / owner | Completion evidence |
|---|---|---|---|---|
| Dual B2C + B2B, no deletion of either path | Founder, V4-B/C | §§1–2, 16 | DUAL-000/001 | Both routes and synthetic flows tested |
| Three pillars: Personal, Retirement, Professional Assurance | V4-B | §§1–6 | DUAL-000/001 | Feature status matrix and navigation |
| Five-stage Discover → Diagnose → Develop/Design → Review/Decide → Monitor | AI, V3, V4-B | §8 | Product lifecycle and AI annex | Stage-specific flows and states |
| Consumer manual-entry-first and calm next-three-actions UX | Founder, V4-B/C | §§3, 7, 20 | PERS-001/002 | Scenario usability and accessible mobile tests |
| Recurring/cash-flow patterns with missingness and freshness | V4-B/C | §§3, 5, 20 | PERS-001/002 | Duplicate/seasonal/irregular income evaluation |
| Debts, budget, savings, buffer constraints | V4-B/C | §§3–5, 19–20 | PERS-002 | Feasible options, minimum payments tests |
| Investment education now, personalized recommendations gated | Founder, V4-B | §§3.5, 20.2, 21.2 | REG-001 | Counsel release determination |
| Shared planning, separate workspaces and permissions | V4-B/C | §§2, 9, 21.1 | DUAL ADR / PR-003 | Grants, expiry and isolation tests |
| Professional CCO queue / evidence packet / bounded review | V3, A2, V4-B | §§6, 17, 22 | ASSURANCE-001 | Review flow and validated export manifest |
| Pricing, GTM as hypotheses, not promised revenue | V3, V4-B | §§12–14, 22 | Interview/price experiment | Recorded interviews, buyer evidence |
| Provisional brand/trademark review | V3 | §§14, 16 | Founder/counsel | Clearance record |

## B. Security, authorization, audit and provenance

| Requirement / finding | Origin | V5 blueprint | V5 Code directive / owner | Completion evidence |
|---|---|---|---|---|
| S-01 cross-tenant workflow and direct UPDATE restrictions | A2, P3 | §§17.1–17.2 | PR-001 Annex A | Denied foreign/viewer/analyst actions and valid paths |
| S-02 fake audit event/actor rejection | A2, P3 | §§17.1–17.2 | PR-001 Annex A | Foreign `SYSTEM` event denied |
| S-03 frozen snapshot integrity, required facts, cross-tier canonical JSON | A2, P3 | §§17.1–17.2 | PR-001 Annex A | Wrong hash/foreign/superseded/missing fact denied; parity fixtures |
| S-04 mismatched receipts fail closed | A2, P3 | §§17.1–17.2 | PR-001 Annex A | Tainted run ERROR, never approved |
| S-05a/b fact confirmation/supersession through trusted revision | A2, P3 | §17.2 | PR-001 Annex A | Update denied, explicit authorized revision passes |
| S-05c completed check run authentic, not client fabricated | A2, P3 | §§17.1–17.4 | PR-001/003 | Authenticated backend-only persisted run |
| S-05d source-less confirmed fact continues denied | A2, P3 | §17.2 | PR-001 Annex A | Existing negative probe stays denied |
| S-05e document hash derives from stored bytes | A2, P3 | §§17.2, 17.4 | PR-001 gate / PR-003 wiring | No client registration; digest object test |
| N-01 immutable post-approval amounts/dispositions | A2, P3 | §17.2 | PR-001 Annex A | Mutation denied; new revision supported |
| N-03 chain sequence and concurrency, historic fork treatment | A2, P3 | §§17.2, 17.5 | PR-001 Annex A | One head, 20 same-tx and concurrent appends |
| N-04 PUBLIC EXECUTE inventory/definer search_path/RLS helpers | A2, P3 | §§17.2, 17.5 | PR-001 Annex A | Explicit grants and real RPC/positive RLS tests |
| N-05 COMPLIANCE-only final approval default and SoD | A2, P3 | §17.2 | PR-001 Annex A | TS/SQL/settings policy agree |
| S-06 supported vs limited outcome/published packet scope | A2, P3 | §17.3 | PR-002 | Unsupported-only never verified |
| S-07 frozen snapshot-only calculation inputs and policy version | A2, P3 | §17.3 | PR-002 | Live settings mutation leaves hash constant |
| N-02 latest scoped attempt, ERROR→PASS/PASS→ERROR | A2, P3 | §17.3 | PR-002 | Recovery/no stale success cases |
| S-08 unsafe demo leads/state local file use | A2 | §§16.2, 17.2 | PR-003 / operations | Production store not a demo file |
| S-09 env/dependency/config hardening | A2, P3 | §§17.2, 17.5 | PR-001/OPS | Fail-closed prod, locked dependencies |
| S-10 independent packet artifact manifest and hashes | A2 | §17.4 | PR-003/ASSURANCE-001 | Independent verifier and per-file digest |
| No custom GUC as sole security barrier | P3 | §17.2 | PR-001 Annex A | Threat tests show server-authoritative privilege |
| No `current_user` as caller identity in definer | P3 | §17.2 | PR-001 Annex A | Actor derived from trusted session path |
| RLS helpers remain functional after revoke | P3 | §17.2 | PR-001 Annex A | Valid tenant SELECT/write tests |
| Rollback-aware durable failure telemetry | P3 | §17.2 | PR-001 Annex A | Rejected transaction and separate event test |
| Trusted calculator invocation vs matching hash only | P3 | §§17.1, 17.4 | PR-001/003 | Forged matching-hash JSON cannot persist as verified |
| OpenAPI strict version lock/drift test | A2, P3 | §17.2 | PR-001 Annex A | Locked CI and identical schema |
| Real Supabase/JWT/PostgREST RLS, not only shims | P3, A2 | §§17.4–17.5 | PR-003 | Authenticated 2-tenant and sharing tests |
| Personal/household/firm consent, expiry/revoke, privacy | Founder, V4-B | §§9, 17.4, 21.1 | PR-003/DATA | Scope+revocation and least-privilege tests |

## C. AI planning, assistant, evidence and governance

| Requirement | Origin | V5 blueprint | V5 Code directive / owner | Completion evidence |
|---|---|---|---|---|
| Separate Planning and Assurance Intelligence | AI | §§1, 6, 18 | AI-000 onward | Both user journeys |
| Server-owned AiReviewOrchestrator and allowlisted tools | AI | §§18.1–18.2 | AI-000/001 Annex B | Typed dispatcher, no mutation tools |
| `read_facts`, `read_evidence`, `get_check_runs` | AI | §18.1 | AI-000/001 Annex B | Auth and retrieval tests |
| `propose_scenario`, `run_supported_projection` only with validated engine | AI | §§18.1, 19 | AI-003 | No invented scenario result |
| Zod schema `AiReviewReport`, source links and draft statuses | AI | §18.2 | AI-000 Annex B | Invalid schema/status rejected |
| Server validates org/workspace/source/calc references | AI | §§18.2–18.3 | AI-001 | 100% accepted citations valid |
| Prompt injection/untrusted PDF/CSV/source text | AI, V3 | §§18.3–18.4 | AI-000/001 | Injection and exfiltration tests |
| AI cannot approve, verify fact, move money or alter policies | AI, founder | §§18.1–18.3, 20.2 | AI-001 onward | No mutation/approval path exposed |
| Human reviewer Accept/Edit/Dismiss/Request Evidence with version history | AI | §§18.2, 18.4 | AI-001 | Feedback separate from model record |
| Offline deterministic mock provider | AI | §§18.1, 18.4 | AI-000 | Runs without provider/network |
| At least 20 labeled synthetic cases, V5 raises to 28 | AI | §18.4 | AI-000/001 | E01–E28 labeled regression results |
| Model version/prompt/eval/replay, per-firm switch, rollback | AI | §§18.3, 21.3 | AI governance | Regression and off-switch tests |
| AI-002 source extraction benchmark and reviewer confirmation | AI | §18.5 | AI-002 | Exact-match + no truth promotion |
| AI-003 scenario orchestration and source-backed amounts | AI | §§18.5, 19 | AI-003 | Tool citations and deterministic rerun |
| AI-004 draft memos with human publication | AI | §18.5 | AI-004 | No unsupported number or auto-publish |
| AI-005 drift/change monitoring and safe notifications | AI | §18.5 | AI-005 | Consent/noise/opt-out tests |
| Provider data minimization, retention and cost guardrails | AI, V3 | §§18.3, 21 | AI governance | Privacy review, no secrets in logs |
| Consumer “financial stress reduction” without clinical claims | Founder, V4 | §§3, 7, 20 | PERS | Content/usability validation |

## D. Financial methodology, scope, compliance and release

| Requirement | Origin | V5 blueprint | V5 Code directive / owner | Completion evidence |
|---|---|---|---|---|
| Existing 2026 RMD sample, decimal math, reason-code coverage | V3, A2 | §19.2 | Finance engine | Golden and negative fixtures |
| 49 Uniform factors compared, still no qualified sign-off | A2 | §19.2 | FIN-VERIFY-001 | Review log accurately attributed |
| `DRAFT` 2026 federal ordinary-income rules not exposed as checked | A2 | §19.2 | Tax research | Independent benchmark before publish |
| Monthly margin/cash forecast accounting rules and missingness | V4 | §§3, 19.3 | PERS | Timing/transfer/seasonal goldens |
| Debt payoff interest/APR, fees and minimums | V4 | §§3, 19.3 | PERS | Rounding and liquidity tests |
| Gross-basis annual retirement scenario, event order and no-tax labeling | AI, V4 | §§4, 19.3 | SCENARIO-001 | Replay golden and property tests |
| SSA/tax/Roth/Monte Carlo separate validated future gates | AI, V4 | §§4, 19.3–19.4 | Later calculators | Reviewer signoff and uncertainty disclosure |
| Rule-set version, effective date, published/DRAFT and rollback | V3, AI | §§17, 19.4 | FIN-VERIFY | Source+test+reviewer registry |
| Legal B2C registered-advice perimeter and feature matrix | V4 | §§10, 21.2, 22 | REG-001 | Counsel feature decision and controls |
| Rule 206(4)-7, Rule 204-2 and Reg S-P context not automatic certification | V3, V4 | §§10, 21.2 | Counsel | Correct public and contractual claims |
| NIST GenAI / OWASP as governance guidance, not certification | AI, V3, V4 | §21.3 | AI governance | Risk register, evaluation and remediation |
| No SOC 2, zero-retention, bank integration or advisor licensing false claims | All | §§10, 21.4 | Marketing gate | Claims register with dated evidence |
| Staged synthetic → technical → professional/legal → commercial release | AI, P3, V4 | §22 | G0–G5 owners | Signed exit criteria, recorded tests |

## Required interpretation

This matrix is **traceability, not a certification**. It does not mean every possible line of historical documentation was repeated verbatim; it preserves requirements material to safety, correctness, product scope and implementation, with explicit release gating. If a newly inspected repository implementation or professional review contradicts a row, capture it as a tracked decision with evidence, version and owner; never silently mark it complete. The V5 Claude Code prompt contains the operative engineering instructions for implementation, testing and honest reporting.
