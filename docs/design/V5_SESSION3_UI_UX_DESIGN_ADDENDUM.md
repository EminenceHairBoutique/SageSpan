# SageSpan UI/UX — Session 3 Update to the V5 Master Design Brief

**Date:** 2026-11-06  
**Purpose:** Preserve the existing premium navy/teal concept while redesigning the **now-integrated** PERS-002 workflows and PR-002 approval semantics. This is a companion to `docs/design/03_SageSpan_Claude_Code_UI_UX_Master_Prompt.md`, not a replacement for its design system or accessibility standard.

## What changed since the initial UI brief

- Consumer **guided intake** and **add/edit/retire record management** now exist in synthetic form; treat them as **existing flows to audit and polish**, not nonexistent mockups.
- Consumer what-if **spending, savings and income-interruption scenarios** are now available as deterministic receipted synthetic calculations; include them in the dashboard, cash-flow and scenario page review.
- The dual-market shell and B2B AI Review are merged in `master`; all legacy links and workflow routes remain in scope for regression.
- PR-002 introduced review outcomes `SUPPORTED_CHECK_VERIFIED`, `APPROVED_WITH_EXCEPTIONS`, `REVIEWED_WITH_LIMITATIONS` (confirm exact contract values in code). **Never use the same unqualified success treatment** for an unsupported or limited review just because a human approved it.
- A real customer sign-in and Supabase-backed data store do **not** yet exist. User-visible demo forms must retain synthetic-only labeling; do not solicit actual financial accounts.

## Design priorities

1. **Consumer information hierarchy:** Personal home begins with dated snapshot and data completeness; next three feasible actions; cash-flow outlook and scenario comparison; goals/retirement readiness; concise source/method explanations. Mobile prioritizes a single primary action and accessible navigation.
2. **Navigation:** Four consumer groups **Home / My Money / My Plan / Guidance** while keeping all existing routes and module functionality. Firm navigation optimized for review queue, clients, imports, checks, AI draft, approvals and evidence export.
3. **Guided intake:** Progressively disclose the existing flow, support unknown/skip without turning `MISSING` into `$0`, make errors and changes reversible, show a review screen before baseline computation. Add privacy notice appropriate to a demo.
4. **Scenario comparisons:** Label baseline and variation, cash floor impact, income interruptions, dated assumptions, credible caveats, versioned receipt and how to undo. Never show an AI-generated numeric scenario unbacked by a calculator.
5. **Debt intelligence:** Distinguish amortization success from cash-flow feasibility; show promo APR assumptions and whether an interest comparison reflects *greater payments* or an alternative ordering of equal payments.
6. **Professional review:** Separate `REVIEWED_WITH_LIMITATIONS` from verified coverage visually and textually; show per-account check outcome and limitations in panels and exported preview; separate latest-attempt state from historical errors.
7. **AI panels:** Offline mock vs actual live model shown truthfully. Evidence drawer contains source, date, methodology, tool run ID and validation state; feedback is a user decision, never equivalent to approving a financial check.
8. **Accessibility and quality:** WCAG 2.2 AA target, keyboard and 320/390px mobile, evidence/uncertainty readable without color, useful loading/error/partial states. Retain navy `#0B1F3A`, teal `#0E7C72`, light `#F5F7FA` as starting palette.

## UI branch plan (safe to parallelize PR-003)

- **UI-000:** Audit merged master/current screens (not just V5 branch), capture screenshots and route inventory, test the full current e2e suite.
- **UI-001:** Tokens, typography, grouped navigation, safe primitives, accessibility foundations; avoid SQL/contracts/financial model changes.
- **UI-002:** Polish working intake, cash-flow, budgets/next steps and scenarios. Mark nonimplemented transaction/bank integrations honestly.
- **UI-003:** Professional coverage, firm queue, evidence, review and approval experience.
- **UI-004:** AI grounding and Retirement Studio readiness with supported-plan boundaries. No generated retirement curves until PLAN-001 exists.
- **UI-005:** Responsive, performance, accessibility and regression hardening.

**Design acceptance:** A user clearly understands **what SageSpan knows**, **what it calculated**, **what is uncertain/unsupported**, and **which decision remains theirs**, without hiding the source evidence. A firm professional sees review authority, exception status and coverage scope without mistaking human signoff for mathematically verified financial advice.
