# SageSpan V5 — Start Here

**Version:** 5.0 | **Founder product direction:** November 5, 2026

This package is the **self-contained V5 specification** for one unified SageSpan platform serving **B2C individuals/households and B2B advisors/RIA firms/compliance teams**. It preserves material security, AI, financial engineering, privacy, governance, and staged release requirements from previous versions. It is not a claim that code has been deployed or legally certified.

## Files

1. **`SageSpan_V5_Unified_Master_Blueprint.md`** — controlling 24-chapter product/architecture specification with detailed PR-001/002 security, AI planning, 28 labeled synthetic AI evaluations, financial calculation methodology, consumer decision policy, release gates, market hypotheses and sources. This is the document to store at `docs/product/SAGESPAN_V5_MASTER_SOURCE_OF_TRUTH.md` in the repository.
2. **`SageSpan_V5_Unified_Master_Blueprint.pdf`** — 51-page readable PDF of the blueprint, with contents and wrapped technical tables.
3. **`SageSpan_V5_Claude_Code_Master_Engineering_Prompt.md`** — complete executable handoff with detailed reviewed PR-001 requirements and AI-000/001 contracts/gates embedded. Paste into a Claude Code session opened at the repository root, but implement **only the bounded first-session scope**, not all PRs.
4. **`SageSpan_V5_Requirements_Traceability.md`** — source-to-requirement mapping of founder decisions, S-01–S-10/N-01–N-05, AI/finance/governance controls, milestones and evidence.

## Recommended use in Claude Code

1. Preserve a copy of existing `CLAUDE.md`, project source-of-truth and audit files. **Inspect current Git state**; the historical v2 audit was at `master/1151c1e` and might not reflect current code.
2. Add the **V5 blueprint** under `docs/product/`; add the **traceability matrix** under `docs/`; keep the original dated audit and old reviewed prompts as historical references if desired, but V5 is sufficient for new sessions.
3. Open Claude Code at the repository root and paste/upload **V5 Claude Code Master Engineering Prompt**.
4. First iteration: inspect actual current B2C/B2B implementation; document a truthful feature status matrix; implement only the safe, scoped **DUAL-000/DUAL-001** difference with tests. If security PR-001 is the current task, execute only its separate annex on a separate branch.
5. Do not connect real clients, banks, investment accounts, live Supabase data, or paid AI providers with private financial data before security, consent, vendor, financial validation and legal release gates are met.
6. Future PRs must declare which V5 requirement IDs they implement, evidence of tests performed, remaining risks and the next owner.

## Source hierarchy and caveats

- **Controlling market decision:** B2C **plus** B2B. Older statements of B2B-only or B2C-only are superseded.
- **Controlling security details:** V5 §17 and Engineering Prompt Annex A (preserved from reviewed PR-001 v3).
- **Controlling AI details:** V5 §18 and Engineering Prompt Annex B (preserved and expanded from the original AI blueprint).
- **Controlling financial and consumer policy:** V5 §§19–21 and Engineering Prompt Annex C.
- **Actual implementation evidence:** the *current* checked-out repository and test output. Historical audit counts are a dated baseline, not current results.
- **Professional/legal clearance:** not implied by this document. External rule/regulatory references need fresh validation before launch.

**Product principle:** AI proposes and explains; deterministic tools calculate; policy and authorization gates constrain; individuals and qualified humans decide; evidence and history remain traceable.
