# Deliverable 1 — SageSpan V5 UI/UX Current-State Summary

> **Reconciliation note (2026-11-06 evening, integration coordinator session):** this bundle is the founder-supplied independent audit (prepared outside the repository from the GitHub API at ~18:57 ET, `master` @ `e0d2f63`). It is preserved verbatim as dated evidence. Its "current state" rows predate the merges done the same evening (#10 PR-003/DATA-001/DATA-002 → #13 AI-CORE-001 → #16 AI-CORE-002a, then #18 AI-SEC-001). Each code-level finding was re-verified against the source and its disposition is recorded in `docs/engineering/V5_SESSION_7_BASELINE_RECONCILIATION_REPORT.md` §4 (P0 AI-SEC-001 **confirmed and fixed in #18**; P1 two-step save/refresh **confirmed, partly mitigated by snapshot-bound runs**; P1 render-time refresh **confirmed**; P1 synchronous `reauthorize()` **confirmed**; P1 in-process hosted budgets **confirmed**; P1 unprotected `master` **reported, not verifiable with the session token**). The operating model in `04_CLAUDE_CODE_NEXT_PROMPTS.md` §A was adopted by the founder and is codified in `docs/project/SESSION_OPERATING_MODEL.md`; its INT-001 prompt was executed by this session; the remaining prompts are superseded by the post-merge versions in the reconciliation report §7.

**Audit date:** November 6, 2026. **Default-branch baseline:** `master@e0d2f637` with UI-001a PR #17 merged.  
**Sources:** `docs/design/UI_000_DESIGN_AUDIT.md`, `UI_001_DESIGN_SYSTEM_SPEC.md`, `UI_000_INFORMATION_ARCHITECTURE.md`, `UI_000_SCREEN_IMPROVEMENT_PLAN.md`, `UI_000_ACCESSIBILITY_PLAN.md`, PR #14, PR #17, route/components in GitHub and five Claude reports. UI-000 describes 184 Playwright captures (curated 95 files); PR #17 records before/after and focus images in `docs/design/screenshots/ui-001a/`. These image assets were not independently pixel-inspected in this environment.

## Verdict

**Well-structured, honest, test-backed synthetic software with an unfinished visual system and incomplete production UX.** It is not accurate to call the UI 'not started': the product has substantial routes and functional controls. Nor is it accurate to call the new design 'complete': UI-001a only establishes the core tokens/primitives, while the IA and page redesigns are still pending. The correct next task is UI-001b, not a wholesale redesign.

## Existing routes and journeys

**Marketing:** `/`, `/personal`, `/retirement`, `/firms`, `/how-it-works`, `/security`, `/pricing`, `/demo`. B2C and B2B entry points are distinct, and claims are qualified as synthetic/illustrative. Product/firm links and pricing are hypotheses, not commercial offers.

**Personal demo:** `/demo/personal`, Next steps, Cash flow, Spending, Savings & debt, Goals, Retirement, Scenarios, Assistant, Learn, Privacy, and guided Start-fresh intake. Financial values are receipted calculations; editable simulated records lead to a policy-ranked queue with user decisions. Limits: crowded mobile navigation, card-heavy layouts and advanced retirement not built.

**Firm demo:** `/demo/app` review queue, Clients, Imports, Checks, Planning studio placeholder, AI plan review, Reviews/approvals, Settings, and household-level import/check/review/evidence screens. Important: arithmetic PASS is not an approval; synthetic reviewer roles and packets are demonstrable, not production onboarding.

**Production:** `/app` still displays an honest gate on `master`. PR #10 adds real sign-in, account/workspace selection and `/app/personal` with manual data and computed results; it is currently unmerged with merge conflicts. Do not redesign production sign-in or consent from the master UI alone.

## What UI-000 completed (PR #14, merged)

- All route/component inventory, IA, page blueprints, 184 cross-viewport captures (95 curated), mobile/desktop audit and token/contrast analysis.
- Component and token specification, screen-by-screen remediation plan, accessibility plan and sequenced UI-001…005 roadmap.
- Critical findings: overuse of “verified”; 11 equal-weight Personal nav items; no active state in console rail; mobile navigation clipping; 13 non-wrapped tables; fixed multicolumn forms; AA color deficits in small text and input outlines; inconsistent heading hierarchy; repeated elevated cards; contradictory positive colors for offline/unimplemented states.
- These are historical baseline findings at the UI-000 audit cut; reassess each against PR #17 before filing an issue.

## What UI-001a implemented (PR #17, merged)

- Shared semantic CSS token system: stronger `ink-faint`, distinct interactive navy, input boundaries, status color aliases, surface, typographic scale and role-specific radii/density hooks.
- Font loading for JetBrains Mono, a consistent page skip link, focus indicators with halo, motion reduction, dialog refinements, and improved form error semantics.
- Typed status components (`ui/status/*`) and reusable primitives: `PageHeader`, `DataTable`, `Skeleton`, `ServiceState`, `ConfirmDialog`, `ui/format.ts`, `ui/fieldErrors.ts`.
- Selected view improvements: receipt dialog copy control, confirm-on-retire/reset, CHECKPOINTS changes and coverage component adoption.
- `docs/design/screenshots/ui-001a/` compares personal overview, firm queue, Patel checks at 1440/390 plus keyboard focus and reduced-motion evidence.
- PR body reports 31/31 token contrast pair checks and post-reconciliation type/lint/build + 193 web Vitest and 16 Playwright. The `contrast.mjs` script is present; CI does not yet make it a required check.

## Remaining UX defects and improvements

| Priority | Area | Evidence/current gap | Acceptance criteria |
|---|---|---|---|
| P0 | Trust labels | “Verified (not required)” and multiple PASS/verified phrasings remain deliberately deferred to UI-003b | Every status distinguishes calculation outcome, evidence verification, human decision and coverage; no false endorsement |
| P1 | Personal navigation | 11 equal-level rail items and horizontally scrolling mobile strip per UI-000; not replaced in UI-001a | Group by jobs; mobile bottom nav ≤4 primary destinations + More; keyboard focus and deep links retained |
| P1 | Firm console navigation | No consistently visible active state/poor task grouping | Left rail organized by Review Queue, Clients, Evidence, Checks, Planning, Approvals, Settings, with active state and breadcrumb |
| P1 | Responsive records/tables | UI-000 identified 13 tables without overflow wrappers and rigid forms; Page DataTable not fully adopted | Every tabular screen works at 320/390/768/1440 px with labeled scrolling/responsive summary rows |
| P1 | Hierarchy/density | Equal-weight cards, small headings and long mobile stat stacks | Strong page H1 and primary action, 1 key insight before detail, compact advisor density and comfortable B2C density |
| P1 | Real authentication | PR #10 screens conflict with current master | Merge #10 first and test redirects, focus, session expiry, signed-out/empty/no-access states |
| P1 | Accessibility automation | Manual keyboard checks exist; no full axe suite or screen-reader pass | `@axe-core/playwright` for representative flows, semantic headings, focus/modal tests, real keyboard review and reduced-motion tests |
| P2 | Site navigation | Public mobile header wrapped/hidden items according to UI-000 | Responsive one-row nav, fully discoverable pricing/sign-in, visible selected pillar |
| P2 | Visual regression | UI screenshots exist but not centrally enforced | Curated representative 320/390/768/1440 screenshot baselines and reviewed diffs in CI |
| P2 | Status/empty states | Offline/mock/proposed can appear overly positive | Neutral/informational status rather than positive green; explicit 'not implemented' labels |
| P2 | Load/performance | Multi-card pages and app render-time refresh may extend latency | Skeletons, stable layout, performance budgets and no DB writes/calculator calls merely to render a page |

## Proposed navigation information architecture

**Personal:** Overview (where I stand and next three steps), Activity (Cash flow/Spending), Plan (Savings/Debt/Goals/Retirement/Scenarios), Guidance (Assistant/Learn), Privacy & sharing (grants, data controls), Account. On mobile: Overview / Activity / Plan / More, with all non-primary entries reachable through More.

**Advisor & Assurance:** Review Queue, Clients & Households, Imports & Evidence, Checks & Exceptions, Planning Studio, AI Review, Approvals, Firm Settings; use the household subnavigation for Imports → Reconcile → Freeze → Checks → Draft → Review → Packet. Respect role-based visibility, never pretend a disabled planning tab runs projections.

**Account/production:** authenticated chooser for PERSONAL/HOUSEHOLD/FIRM; explicit data-sharing permissions and expiry/revoke controls; no cross-market implicit access.

## Visual language to preserve and improve

Keep the established restrained professional palette (navy/teal/neutral), crisp typography and receipt-adjacent actions. Consumer screens should be reassuring and simple without hiding caveats; advisor screens should be information-dense, scannable and operational. Favor hierarchy, typography, whitespace and evidence states over gradients, theatrical motion or stock-photo trust signals. Reserve positive teal for real positive status rather than 'working mock'. Favor semantic color tokens over hard-coded styles. Dark mode is deferred until the light theme and semantics are stable.

## Recommended UI PR sequence

1. **UI-001b** — `SyntheticBanner`, BrandLockup, TopBar, SideRail, grouped navigation, mobile bottom nav, density attributes on both shells, marketing responsive nav, loading states. Do not touch PR #10-owned auth files until #10 is integrated.
2. **UI-001c** — component gallery and `@axe-core/playwright`, full keyboard/contrast regression, screenshot baseline. Add `node apps/web/scripts/design/contrast.mjs` to CI.
3. **UI-002 Personal** — overview hero 'three next steps', financial clarity mobile layouts, record-entry usability, better progress and source/reliability labels; preserve receipts and decisions.
4. **UI-003 Advisor & Trust** — queue triage, tables/filters, import/evidence path, status taxonomy, human approval and packet. Fix misleading verification terms.
5. **UI-004 Production** — account/scope selection, member/consent UI once backend exists, privacy dashboard, auth/session/error states.
6. **UI-005 polish** — measured performance, qualitative user tests, accessibility audit, restrained visual refinement.

## UI acceptance gates

- At 320, 390, 768 and 1440 px no clipping, overlaid CTA or inaccessible navigation; all tables are intentionally scrollable or responsive.
- First Tab reaches Skip to main; Enter places focus on the actual main content; dialogs trap/restore focus appropriately; error messages are announced.
- WCAG 2.2 AA criteria reviewed (at minimum contrast, focus, labels, keyboard, reflow, target sizes); axe has no critical/serious violations on core journeys, with manually-reviewed exceptions recorded.
- No production-looking workflow uses demo persona cookies to grant real access.
- All financial amounts and status labels are backed by current runs; UI does not calculate authoritative finance results.
- Demo banners and unavailable features remain clearly labeled in every viewport.
- `npm run typecheck`, `npm run lint`, package tests, build, E2E and screenshots are green.

**Overall UI status:** **UI-000 complete, UI-001a complete/merged, UI-001b and UI-001c not implemented, UI-002…005 not implemented as dedicated redesign PRs.** Functional demo UX is substantially implemented and should not be discarded.
