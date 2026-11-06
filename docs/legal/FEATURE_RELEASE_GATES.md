# Feature release gates and legal perimeter matrix (V5 §10, §21.2, §22)

**Status:** documentation of required gates. Nothing here is legal advice or a determination that any gate has passed. Counsel (REG-001) and a named qualified financial reviewer (FIN-VERIFY-001) own the professional determinations. Dates are not promised.

## Gate ladder

| Gate | Required evidence | Current state (2026-11-06) |
|---|---|---|
| **G0 synthetic demo** | isolated fixtures, truthful banners, typecheck/build/unit tests, no secrets/PII/money movement | **Passed for this branch**: both demos synthetic, banners persistent, suites green (see `CLAUDE.md` §5) |
| **G1 trust boundaries** | PR-001 controls, SQL privilege inventory, audit-chain verification, real-stack confirmation | **Not passed**: PR-001 implemented on branch, not merged, SQL suites not rerun this session, not real-stack validated |
| **G2 coverage semantics** | PR-002 S-06/S-07/N-02 | **Not started** |
| **G3 real personal data** | PR-003 Auth/JWT/RLS, consent + revocation, private storage, trusted calculator provenance, provider DPA, incident/restore runbooks | **Not started**; `/app` fails honestly; AI provider is offline mock |
| **G4 financial / professional clearance** | named qualified reviewer sign-off per rule/method set; counsel feature perimeter | **Not started**; see `docs/finance/RULE_VERIFICATION_AND_MODEL_REGISTRY.md` |
| **G5 controlled release** | consumer + firm pilot evidence, false-alarm tracking, contracts, support | **Not started** |

## Feature-by-feature perimeter matrix (to be completed with counsel)

| Feature (as built or proposed) | Audience | Intended output | Regulated-advice assessment needed | Authorised entity / professional | Compensation / conflicts | Current authority tier | Release owner |
|---|---|---|---|---|---|---|---|
| Cash-flow baseline, margin, buffer, outlook | B2C | Descriptive arithmetic on user inputs | Consumer-protection, UDAP, privacy review; not securities advice | None (software) | No referral/affiliate; none planned | Tier 0–1, enabled (synthetic) | Founder |
| Debt payoff path comparison | B2C | Illustrative comparison on identical inputs | Counsel to confirm no credit-counselling / debt-adjusting licensing trigger in target states | None | None | Tier 2, enabled with user confirmation (synthetic) | Founder + counsel |
| Decision policy "next steps" | B2C | Budgeting/organisation decision support | Counsel to confirm educational/decision-support scope; wording review | None | Order never revenue-weighted (policy has no revenue input) | Tier 1–2 (synthetic) | Founder + counsel |
| Learn module | B2C | General education | Truthful-marketing review | None | None | Tier 0 | Founder |
| Retirement readiness gate | B2C/B2B | Input-state record, no projection | None until PLAN-001 | — | — | Tier 0 | — |
| PLAN-001 retirement projection | B2C/B2B | Simplified gross-basis illustration | Model validation (FIN-VERIFY); counsel on illustration vs advice; hypothetical-performance rules if marketed by an adviser | Qualified reviewer | — | Tier 2 when built | FIN-VERIFY-001 |
| Personalised securities / allocation / tax / insurance advice | B2C | Individualised recommendation | **Investment-adviser (federal/state) registration or partnership, fiduciary, disclosures, suitability, supervision, Rule 204-2-style records, model validation** | Registered adviser or partner | Full disclosure required | **Tier 3 — DISABLED in code** | REG-001 |
| Money movement / trading / bill pay | B2C | Execution | Out of scope | — | — | **Tier 4 — out of scope** | — |
| AI "Understand my finances" | B2C | Explanation of receipted baseline | Same as baseline; provider DPA before any live model; NIST GenAI RMF risk register | None | — | Tier 0–1 (mock) | AI governance |
| Firm assurance workflow (RMD check, review, packet) | B2B | Bounded review record for the firm's own supervision | SageSpan supports but does **not** certify Rule 206(4)-7 / 204-2 / Reg S-P compliance; packet language must say so | The RIA's own CCO/advisers | B2B subscription hypothesis | Professional review by the firm | Firm |
| AI plan review (Analyze plan) | B2B | Draft findings for a human reviewer | No approval authority; provider DPA before live model; firm per-tenant switch | Firm reviewer | — | Draft only | AI governance |
| Household sharing / client-to-firm grants | B2C↔B2B | Scoped data access | Privacy law, consent records, retention exceptions (Reg S-P for registered firms) | — | — | Model only; controls proposed | PR-003 + counsel |
| Connected bank/brokerage data | B2C | Read-only aggregation | Vendor contracts, privacy, CFPB 1033 status re-check (compliance dates stayed Oct 2025 per CFPB) | — | — | Proposed; G3 | DATA-001 + counsel |

## Marketing / claims register (V5 §21.4)

Claims permitted in this build: "synthetic demonstration", "receipted deterministic calculations", "AI drafts, people decide", "no bank connections", "not advice". Claims **not** permitted anywhere: SEC-approved, SOC 2, fiduciary, independently audited, registered adviser, integrated with a named vendor, zero data retention, guaranteed outcomes, "exam-proof", or any pricing as an offer. Every public page carries the relevant limitation and the footer boundaries list.

## References to re-verify before launch (not legal conclusions)

Investor.gov on investment advisers; SEC robo-adviser guidance (2017-52); SEC Marketing Rule guidance on hypothetical performance; Regulation S-P amendments (2024-58); CFPB Personal Financial Data Rights status; NIST AI RMF GenAI Profile; CFP Board generative-AI ethics guide. The withdrawn SEC predictive-data-analytics proposal is not a binding rule.
