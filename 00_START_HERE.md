# SageSpan — Unified Framework V3 (Canonical Context Pack)
**Prepared:** 2026-11-05  
**Status:** Founder-selected build direction; brand, pricing and customer demand remain provisional or unvalidated where identified.  
**Scope:** U.S. B2B independent retirement plan assurance and supervisory intelligence.

## What is unified
This V3 pack consolidates: (1) the original AI-native five-stage retirement advisory framework; (2) Claude's *Plumbline Framework Audit, Upgrades and Competitive Research*; (3) the prior Plumbline V2 independent assurance specification and Fable coding prompt; and (4) the subsequent **SageSpan Founder Decision Review** supplied in `Pasted text.txt`.

**V3 is controlling**. Earlier SageSpan consumer-planner instructions and Plumbline V2 instructions should be archived or removed from Claude's active Context to avoid conflicting orders. Older research may remain as history, not as current product requirements.

## Five controlling build decisions
1. **Name:** SageSpan is the provisional working brand, pending substantive trademark/domain clearance. Keep copy and configuration easy to rebrand.
2. **Primary product:** independent retirement plan assurance and review evidence, not a greenfield robo-advisor or plan-builder.
3. **Buyer:** sell to RIA firms, with CCO/compliance leader as champion, managing partner/CEO/COO as economic buyer, and lead advisor as adoption stakeholder. Initial ideal customers: roughly 5–50 advisor RIAs.
4. **Architecture:** for greenfield build, Next.js App Router + strict TypeScript + Tailwind + Supabase/Postgres/Auth/RLS, AND a separately deployable **Python/FastAPI financial calculation and verification service** from the first vertical slice; future async workers when needed. Preserve existing useful code and migrate safely if the repo is already established.
5. **Pricing hypothesis:** $750/month firm minimum includes 100 active monitored households; $3.50/month per additional active monitored household; limited $500/month paid pilot up to 50 households. All unvalidated until firms commit.

## Read / upload order
**If you want one Context upload:** use `SAGESPAN_MASTER_SOURCE_OF_TRUTH.md`. It contains the complete consolidated framework, founder record, technical requirements, instructions and development kickoff. Do **not** upload all the individual files as well unless necessary: duplication may waste context and cause confusion.

**If you prefer modular Context files:** upload `01`–`05` and `07`, then paste `06_CLAUDE_PROJECT_INSTRUCTIONS.md` into Claude Project **Instructions** and paste `08_FABLE_5_1_BUILD_KICKOFF.md` into a Claude Code session. In modular mode, do not also upload the master file.

## First proof of product
Synthetic Patel household → supported CSV/JSON plan export + independent source statement → normalized facts and ownership → visible material balance conflict → freeze blocked → explicit resolution → immutable snapshot → 2026 age-74 owner-held traditional IRA RMD check → difference against synthetic imported $24,000 → authorized review → versioned, limited-scope evidence packet download.

For the specified eligible IRS Uniform Lifetime Table case: `$640,000 / 25.5 = $25,098.04` (annual RMD rounded to cents). Never generalize to inherited IRAs, unusual spouse-beneficiary cases, or unsupported workplace plans.

## Hard restrictions
- Synthetic data only in prototypes and Claude Code. No authentic client financial records, secrets, or confidential contracts in prompts.
- No trading, money movement, discretionary recommendations, automated fiduciary approval, or false vendor integrations.
- Mathematical pass ≠ adviser approval; evidence packet ≠ SEC certification.
- No unsupported statements that SageSpan is registered, SOC 2 certified, ZDR, independent-audit certified, guaranteed accurate, or compatible with all advisor software.
- Fable 5.1 generally requires 30-day retention, with only explicitly authorized exceptions. Verify your organization and vendor terms. 

## Files
- `01_FOUNDER_DECISIONS_AND_POSITIONING.md` — definitive product, buyer and branding choices.
- `02_PRODUCT_AND_FIVE_STAGE_MAPPING.md` — B2B workflow, screens, lifecycle mapping, statuses.
- `03_ARCHITECTURE_AND_DATA_SCHEMA.md` — components, typed facts, permissions, data provenance, contracts.
- `04_FINANCIAL_RULES_AND_TEST_STRATEGY.md` — RMD golden cases, tax v0 boundary, independent tests.
- `05_COMPLIANCE_PRIVACY_AI_SECURITY.md` — legal perimeter, data security, release gates.
- `06_CLAUDE_PROJECT_INSTRUCTIONS.md` — concise permanent project behavior prompt.
- `07_SOURCES_AND_CLAIM_REGISTER.md` — sources, competitors, verified vs hypothesis claims.
- `08_FABLE_5_1_BUILD_KICKOFF.md` — direct implementation assignment for Claude Code.
- `09_PRICING_GTM_90_DAY_GATES.md` — published hypothesis and sales/pilot measures.
- `10_CHANGELOG_V1_V2_V3.md` — explicit reconciliation of decisions.
- `SAGESPAN_MASTER_SOURCE_OF_TRUTH.md` — everything above in one document.

## Authority and uncertainty
The founder decision review selects V3 implementation choices; it does **not** mean any government body, trademark attorney, CPA, security auditor or paying firm has independently approved the product. Dates are as of November 5, 2026. Revalidate externally changing facts before publication, production rule updates or commercial release.
