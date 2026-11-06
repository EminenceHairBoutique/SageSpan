# SageSpan UI/UX design audit (UI-000)

**Document:** `docs/design/UI_000_DESIGN_AUDIT.md` · **Version:** 1.0 · **Date:** 2026-11-06 · **Status:** audit (documentation only; no application code was changed in this session)
**Branch audited:** `claude/nice-kapitsa-6ae656` (= `master` @ `5299791` + the founder's `docs/ai/AI_EVALUATION_PLAN.md` commit). Reconciled against open PR #10 (`feat/pr-003-identity`, migration 0008, `/app/sign-in`, `ProductionHome`) and PR #11 (`claude/brave-gates-2b1262`, PR-002 follow-up docs/fixtures/tests).
**Method:** every route file under `apps/web/src/app/**` and every component under `apps/web/src/ui/**` was read; the site was run locally (Next dev on port 3200, calculator on 8010, both in demo mode, fresh synthetic state) and 184 screenshots were captured with Playwright at 1440, 1280, 768, 390 and 320 px, including the full Patel and Okafor assurance flows; contrast ratios were computed from the token values. The curated screenshot set (95 files) lives in `docs/design/screenshots/ui-000/` with `INDEX.tsv` (file → route → note). File names below refer to that folder.
**Not done:** no automated accessibility scan, no screen-reader session, no user testing, no real Supabase stack (never run on any branch). Statements about those are plans, not findings.

Companion documents: [information architecture](UI_000_INFORMATION_ARCHITECTURE.md) · [page blueprints](UI_001_PAGE_BLUEPRINTS.md) · [design system](UI_001_DESIGN_SYSTEM_SPEC.md) · [screen-by-screen plan](UI_000_SCREEN_IMPROVEMENT_PLAN.md) · [accessibility plan](UI_000_ACCESSIBILITY_PLAN.md) · [roadmap UI-001…UI-005](UI_000_IMPLEMENTATION_ROADMAP.md).

---

## 1. Executive summary

SageSpan's current UI is **honest and structurally sound but visually and navigationally unfinished**. The hard things are already right: every money figure comes from a receipted engine, every status is text + icon + colour, approvals are typed and separated from arithmetic, AI output is permanently marked as a draft, and synthetic data is announced on every workspace screen. The gaps are in the layer the brief asks for: hierarchy, density, navigation, responsive behaviour, vocabulary consistency and a handful of trust-sensitive labels.

Top findings, in priority order:

1. **Vocabulary drift around "verified".** Seven different phrases describe an engine PASS, and `NOT_REQUIRED` is labelled "Verified (not required)" in the coverage panel; the public hero chip reads "Arithmetic PASS · supported verified" with no explanation. None of these violates the founder's rule (UNSUPPORTED / INDETERMINATE are never shown as verified), but the word is spent too freely for a product whose promise is the opposite. (§3.1, §5.1)
2. **Navigation does not scale.** Personal shows 11 equal-weight items (desktop rail and a horizontally scrolling pill strip on mobile); the console rail has no active state at all; the marketing header wraps to two lines at 1440 px and hides "Pricing" and "Sign In" off-screen at 390 px; a utility-class conflict means a button meant to disappear on small screens never does. (§3.2, §3.3)
3. **Type and colour fall below AA in the small print.** `ink-faint` text (hashes, revisions, sub-brand labels) is 3.1–3.5:1; two sizes are 10 px; input borders are 1.8:1. (§3.4; accessibility plan §1)
4. **Cards instead of structure.** Most pages are stacks of `Card`s with identical weight; page titles (24 px) are smaller than stat numbers; every `Card` title is an h2, so marketing pages have no h1 and two levels of h2. (§3.5)
5. **Mobile is reachable but not designed.** 13 tables have no scroll wrapper (clipped at 390 px); record forms use fixed 2- and 3-column grids; stat tiles stack into a long scroll before the first recommendation. (§3.6)
6. **Success colour is spent on non-successes**: "Reachable · demo mode", "Working (offline mock)", "Readiness gate live", the suggested-action well on every recommendation. (§3.7)
7. **Small defects that undermine polish**: severity chips stretch into tall ovals on the Overview, the public pricing calculator does arithmetic in the browser under a page that says the web app never does, the sample receipt hard-codes `$25,098.04` instead of reading the fixture, mono text uses a font that is never loaded. (§3.8)

What is **good and must be preserved** (the audit's non-regression list) is in §6.

---

## 2. What exists (inventory)

### 2.1 Surfaces and routes

| Surface | Routes (41 page/layout files) | Shell | Status labels in UI |
|---|---|---|---|
| Public site | `/`, `/personal`, `/retirement`, `/firms` (← `/product`), `/how-it-works`, `/security`, `/pricing`, `/demo`, `/app` gate | `SiteNav` + `SiteFooter` | "Synthetic data", "Working (synthetic)", "Working (offline mock)", "Proposed", "Gated", "Readiness gate live" |
| Personal workspace (synthetic) | `/demo/personal` + 10 sections + `/intake/[step]` (8 steps) | `PersonalShell` (rail 240 px, 11 items; mobile pill strip) | persistent amber banner; "Simulated individual"; "Deterministic offline mock" |
| Firm console (synthetic) | `/demo/app/reviews`, `clients`, `imports`, `checks`, `planning-studio`, `ai-review`, `approvals`, `settings`; household `[id]` + `imports`, `checks`, `ai-review`, `review`, `evidence` | `ConsoleShell` (rail 256 px, 8 items; mobile text strip) | persistent amber banner; "Simulated reviewer"; "Proposed · not implemented" (Planning studio) |
| Production namespace | `/app` (gate), PR #10 adds `/app/sign-in`, `ProductionHome` | none (centred card) | "Sign-in is not available in this build" |
| Exports | evidence packet JSON / HTML / CSV via `/api/households/[id]/evidence/[packetId]` | inline-styled HTML | synthetic banner inside the packet |

### 2.2 Component inventory (what the UI is built from)

`ui/primitives.tsx`: `cx`, `Chip` + `FactStatusChip`, `WorkflowChip`, `ResultChip`, `ClassificationChip`, `Card`, `buttonClasses`/`ButtonLink`, `Alert`, `KeyValue`, `Mono`, `EmptyState`, `Field`, `inputClasses`, `Th`/`Td`, `SectionHeading`.
`ui/ActionForm.tsx` (server-action form with pending/success/failure), `ui/ReceiptDialog.tsx` (native dialog), `ui/ProductionGate.tsx`.
Console: `ConsoleShell`, `HouseholdTabs`, `Checkpoints`, `FactsTable` (+ `FactReceipt`), `FreezeGatePanel`, `CheckRunCard`, `CoveragePanel` (+ `OutcomeChip`), `PersonaSwitcher`, `ResetDemoButton`.
Personal: `PersonalShell`, `PersonalNav`, `components.tsx` (`DataStateChip`, `SeverityChip`, `Money`, `Stat`, `FlagList`, `DisclosureList`), `DecisionCard`, `RecordForms` (6 field sets, add/edit/retire), `WhatIfForm`.
AI: `AiReviewPanel` (+ `FindingCard`). Marketing: `SiteNav`, `SiteFooter`, `SampleReceipt`, `PricingCalculator`, `PilotInterestForm`.
Theme: `globals.css` (`@theme` tokens: 5 neutral + 5 colour scales, 3 fonts, 1 radius, 2 shadows), Google Fonts `<link>` for Public Sans and Schibsted Grotesk only. Icons: `lucide-react`. No chart, no skeleton, no toast, no tooltip, no table wrapper, no page-header component.

### 2.3 Capability status as the UI presents it (cross-checked with `FEATURE_STATUS_MATRIX.md`)

Implemented (synthetic) and visible: personal baseline/outlook/flags, records add/edit/retire, intake, debt paths, what-ifs, decision policy with Ask why and decision events, retirement readiness gate, learn module, privacy model (read-only), firm import → reconcile → freeze → RMD check → coverage → review → approval → packet, AI drafts for both audiences (offline mock), settings/policy, audit trail.
Offline mock: both AI surfaces (labelled). Proposed, with honest pages: Planning studio, consent grants/sharing, shared household goals, connected accounts, PLAN-001 projection, notifications. Disabled in code: Tier 3 advice, Tier 4 money movement. Blocked: production sign-in (PR #10 adds identity resolution but no store adapter).

---

## 3. Findings

Each finding has an id (A = trust/claims, N = navigation, V = visual system, R = responsive, C = content/vocabulary, D = defect), the evidence (file:line and screenshot), the impact, and the owning phase.

### 3.1 Trust, claims and the "verified" vocabulary

| Id | Finding | Evidence | Impact | Phase |
|---|---|---|---|---|
| A1 | The public hero receipt chip renders the raw `coverage_status` as "supported verified" next to "Arithmetic PASS", with no definition on the page | `ui/marketing/SampleReceipt.tsx:13-15`; `001-mk-home-1440.jpg` | First impression says "verified"; the definition ("internal golden-test coverage, not external attestation") exists only in a tooltip on the console (`CheckRunCard.tsx:12-28`) | UI-004 (copy), UI-001 (chip vocabulary) |
| A2 | `NOT_REQUIRED` coverage is labelled **"Verified (not required)"** in teal; `VERIFIED` is "Verified (PASS)" | `ui/console/CoveragePanel.tsx:12-19`; `172-fm-okafor-check-unsupported-1440-full.jpg` | "Verified" is applied to an eligibility outcome; the contracts count it as "supported", which is right, but the word overstates | UI-003 (label + e2e update) |
| A3 | Seven phrasings for one concept: "Arithmetic PASS", "supported PASS", "Verified (PASS)", "supported verified", "Supported check verified", "x/y verified", "Independent verification" | `primitives.tsx:70`, `demo/app/checks/page.tsx:23`, `CoveragePanel.tsx:13,72`, `approvals/page.tsx:53`, `(marketing)/firms/page.tsx:70` | Reviewers and consumers cannot learn one vocabulary; the packet, the UI and the site disagree | UI-001 (vocabulary table, design system §6) |
| A4 | Receipt-integrity wording varies: "re-derived and matched", "receipt verified yes/NO", "request hash verified / MISMATCH", "✓ / not verified" | `demo/personal/page.tsx:102`, `intake/[step]/page.tsx:370`, `CheckRunCard.tsx:53`, `demo/app/checks/page.tsx:55` | Same server fact, four labels | UI-001 |
| A5 | "Working (offline mock)" is rendered in a **teal success chip** on the Personal pillar page; "Readiness gate live" is teal on the Retirement page | `(marketing)/personal/page.tsx:32`, `(marketing)/retirement/page.tsx:17`; `004-mk-personal-1440-full.jpg`, `006-mk-retirement-1440-full.jpg` | Success colour attached to a mock and to "live" | UI-004 |
| A6 | `/firms` says "Everything below is implemented in the synthetic demo; nothing is a mock-up" one screen below a card listing three "proposed" capabilities, while the AI is an "offline mock" elsewhere | `(marketing)/firms/page.tsx:51`; `008-mk-firms-1440-full.jpg` | Over-claim by juxtaposition; "mock-up" vs "mock" confusion | UI-004 |
| A7 | "the same validated engines" on `/retirement` vs "validated calculations" listed as an unmet gate on `/security` | `(marketing)/retirement/page.tsx:11`, `(marketing)/security/page.tsx:33` | Contradiction on adjacent pages | UI-004 |
| A8 | Home tile says "the web app never does arithmetic"; the pricing calculator computes `monthly * 12`, `max(0, h − 100)` and the fee formula in the browser | `(marketing)/page.tsx:22`, `ui/marketing/PricingCalculator.tsx:9-12,31,40` | Pricing math is not financial advice, but the sentence is falsifiable | UI-004 (reword: "never computes a financial figure"); keep the calculator, label it "illustrative" |
| A9 | Sample receipt hard-codes `$25,098.04`, `$640,000.00`, `$24,000.00`, `$612,000.00` although the fixture it imports carries `annual_rmd` | `SampleReceipt.tsx:18,22,29` | A literal can drift from the fixture | UI-004 |
| A10 | The calculation-service health panel is a **teal** success notice ("Reachable · engine 0.1.0 · demo mode") on the checks page, visually equal to "Arithmetic PASS" | `demo/app/households/[id]/checks/page.tsx:55`; `161-fm-patel-check-pass-1440.jpg` | Reachability reads as verification | UI-003 |
| A11 | Review-outcome descriptions and coverage-status explanations are delivered through `title` attributes only | `CoveragePanel.tsx:25`, `CheckRunCard.tsx:52` | Touch and most screen-reader users never see what "Reviewed with limitations" means | UI-003 |
| A12 | The Personal intake step is titled "Verify the key inputs" while the same page says "nothing is verified against a statement in this build" | `intake/[step]/page.tsx:304,329` | The step should say "Check what you entered" | UI-002 |
| A13 | Next steps claims "no score" in copy while the same page explains a 100-point weighting (urgency 40 · benefit 30 · reliability 20 · reversibility 10) | `next-steps/page.tsx:56`; `022-ps-next-steps-1440-full.jpg` | Accurate but contradictory framing; "no financial health score" ≠ "no ranking weights" | UI-002 (copy) |

**Positive:** approvals are typed and derived server-side (`approvalReadiness`), the approver never chooses the label, "Arithmetic PASS is not approval" appears on the review page, the AI panel's "AI draft — not a review, approval or verification" chip is permanent, the packet title derives from coverage (`packetTitle`), the footer "Boundaries" list and `/security` "What we do not claim" are exemplary. The founder's PR-002 decision (unsupported-only snapshots approvable as REVIEWED_WITH_LIMITATIONS, never labelled verified) is honoured in the UI, the approvals list and the packet (`173-…`, `174-…`, `184-fm-okafor-packet-html-1440-full.jpg`).

### 3.2 Navigation and information architecture

| Id | Finding | Evidence | Impact | Phase |
|---|---|---|---|---|
| N1 | Personal rail lists **11 equal-weight items** with no grouping or icons; mobile is a horizontally scrolling pill strip | `PersonalShell.tsx:11-23`, `PersonalNav.tsx`; `019-ps-overview-1440.jpg`, `089-ps-overview-390.jpg` | Cognitive load; items past "Spending" are invisible on a phone | UI-001 (grouped rail + bottom nav) |
| N2 | Console rail has **no active state** and no `aria-current`; mobile strip likewise | `ConsoleShell.tsx:40-47,66-71`; `043-fm-review-queue-1440.jpg`, `177-fm-review-queue-390.jpg` | Users cannot tell where they are | UI-001 |
| N3 | Marketing header wraps every link onto two lines at 1440 px (six links + "provisional name" pill + Sign In + two CTAs) | `SiteNav.tsx`; `001-mk-home-1440.jpg` | Looks broken on the most common desktop width | UI-001 (shell) / UI-004 |
| N4 | Marketing mobile nav is a scrolling strip with "Pricing" and "Sign In" off-screen and no affordance; no menu button | `SiteNav.tsx:44-54`; `071-mk-home-390.jpg` | Discoverability | UI-001 / UI-004 |
| N5 | `ButtonLink className="hidden sm:inline-flex"` is combined with `buttonClasses` that already sets `inline-flex`; Tailwind orders `inline-flex` after `hidden`, so the Personal CTA is **never hidden** and the header shows two two-line buttons at 390 px | `SiteNav.tsx:39`, `primitives.tsx:118`; `071-mk-home-390.jpg` | Unintended layout; also means the intended B2C/B2B balance on mobile was never tested | UI-001 |
| N6 | Two different brand marks: navy `ShieldCheck` tile (site, console) vs teal `Leaf` tile (Personal) | `SiteNav.tsx:22`, `ConsoleShell.tsx:30`, `PersonalShell.tsx:36` | Reads as two products | UI-001 (one interim mark; founder decision on a real mark) |
| N7 | Naming drift: "Retirement Planning" (nav) / "Retirement Studio" (footer, pages) / "Retirement" (rail); "Settings" (h1) vs "Firm settings" (rail); "AI plan review" / "AI review" / "Analyze plan" | `SiteNav.tsx:9`, `SiteFooter.tsx`, `PersonalShell.tsx:18`, `settings/page.tsx:36`, `HouseholdTabs.tsx` | Same thing, three names | UI-001 (labels), e2e update for "Retirement Planning" |
| N8 | Household pages have no stage/next-action header; the "exact next permitted action" is scattered across disabled-button reasons | `households/[id]/layout.tsx`, `checks/page.tsx:27`, `review/page.tsx:31` | Reviewer must scan the page to learn what they may do | UI-003 |
| N9 | Review queue lacks search, coverage and age columns the brief asks for; counters exist only as filter counts | `reviews/page.tsx`; `043-…` | Queue is a list, not a work queue | UI-003 |
| N10 | No skip link; three nav landmarks precede `main` on the console | `app/layout.tsx`, `ConsoleShell.tsx` | Keyboard users tab through 8–11 links per page | UI-001 |

### 3.3 Visual hierarchy and layout

| Id | Finding | Evidence | Impact | Phase |
|---|---|---|---|---|
| V1 | App page titles are 24 px (`text-2xl`) while stat values are 24 px bold and the hero is 48 px; `Card` titles are 16 px, the same size as body | `demo/personal/page.tsx:27`, `components.tsx:Stat`, `primitives.tsx:107` | No unmistakable hierarchy (brief: display / H1 / H2 / section / body / supporting) | UI-001 type scale |
| V2 | Everything is a `Card` with the same elevation; cards nest (`Card` inside `Card` wells, stat tiles beside cards); console pages stack 6–8 cards | `households/[id]/page.tsx` (8 cards), `review/page.tsx` (6), `settings/page.tsx` (5); `059-fm-patel-overview-1440.jpg` | Flat importance, more borders than content | UI-001 (`Section`), UI-002/003 |
| V3 | Page-header block hand-written on 20 pages with an arbitrary `tracking-[0.14em]` eyebrow | 12 personal + 8 console pages (inventory) | Drift risk; no meta row | UI-001 `PageHeader` |
| V4 | Links are the same colour as body text (`text-navy` = `ink`) and only underline on hover | `primitives.tsx`, throughout | Links are undiscoverable until hovered | UI-001 `--color-link` |
| V5 | Flag rows on the Overview stretch the severity chip to the row height (tall ovals) | `components.tsx:FlagList` (`flex gap-3` without `items-start`); `019-ps-overview-1440.jpg` right column | Visibly broken | UI-002 (or UI-001 one-line fix) |
| V6 | Stat tile tone is a coloured border only; DecisionCard "Do this now" is a red chip + red border on the most important consumer card (alarm styling for a suggestion) | `components.tsx:Stat`, `DecisionCard.tsx:19-21`; `019-…` | Colour-only meaning; fear tone | UI-002 |
| V7 | Suggested action sits in a **teal** well on every recommendation | `DecisionCard.tsx:46` | Success colour for a proposal | UI-002 |
| V8 | Four feedback forms (Done / Snooze / Not relevant / I disagree) render as four vertically stacked inline forms on the Overview's compact cards | `DecisionCard.tsx:94-98`; `020-ps-overview-1440-full.jpg` | Action-heavy home screen; the brief asks for one primary "Review" action and details on a second interaction | UI-002 |
| V9 | Large empty canvas below short tables (queue with three rows) with no secondary content | `043-fm-review-queue-1440.jpg` | Wasted first screen for the professional | UI-003 (counters, coverage column, recent activity) |
| V10 | Hash digests are truncated to 16 chars with the full value only in `title` | `[id]/page.tsx:93`, `evidence/page.tsx:99`, `settings/page.tsx:123` | Cannot copy or verify on touch | UI-003 (`shortHash` + copy) |
| V11 | Synthetic banner text wraps to three lines on mobile and sits above the brand on both workspaces | `089-…`, `177-…` | Fine for honesty; costs 60 px of every phone screen | UI-001 (one-line compact banner on mobile with a details link, still persistent) |

### 3.4 Colour, type and accessibility (summary; full table in the accessibility plan)

| Id | Finding | Evidence |
|---|---|---|
| V12 | `ink-faint #7B8A9E` text at 3.1–3.5:1 on the three surfaces (fails AA) for hashes, "rev 1", "none", sub-brand labels, provisional pill | computed; `ConsoleShell.tsx:35`, `reviews/page.tsx:91`, `SiteNav.tsx:26` |
| V13 | 10 px text (`SiteNav.tsx:26`, `Checkpoints.tsx:13`), eight 11 px strings, one 12 px, one 13 px as arbitrary values | grep |
| V14 | Input borders `line-strong` at 1.8:1 (WCAG 1.4.11 needs 3:1 for the control boundary) | `primitives.tsx:inputClasses` |
| V15 | Focus ring is teal 2 px (4.7:1 on canvas, good) but has no halo on navy/teal/amber surfaces | `globals.css:66-69` |
| V16 | `scroll-behavior: smooth` and `animate-spin` ignore `prefers-reduced-motion` | `globals.css:46`, `ActionForm.tsx:16` |
| V17 | Seven marketing pages have no h1 (`SectionHeading` renders h2); `Card` titles are always h2 | `primitives.tsx:198-206,107` |
| V18 | `--font-mono` names JetBrains Mono, which is never loaded | `globals.css:34`, `app/layout.tsx:23` |
| V19 | Chip/outcome definitions and disabled reasons via `title` only (see A11) | `CoveragePanel.tsx`, `ActionForm.tsx:14` |
| V20 | Inputs labelled twice (`<label>` + `aria-label`) with differing text in record and what-if forms | `RecordForms.tsx`, `WhatIfForm.tsx` |
| V21 | Server errors are a form-level alert "Not applied (CODE)" with no field association | `ActionForm.tsx:52-56` |

### 3.5 Content density and page structure (per surface)

**Personal.** The Overview (`019`, `020`) has the right ingredients in the right order (stats → next steps → attention → unknowns) but no "what matters this week" sentence, no outlook, and a recommendation card that carries ten pieces of information plus four buttons. Cash flow (`023`, `024`) shows the dated outlook only as a 90-row table with a 480 px scroll box; the chart the brief asks for does not exist. Next steps (`022`) is complete and readable. Scenarios (`033`, `034`) is the densest consumer page: two comparison tables, a form, five disclosure lists and a "Not yet available" card; it is honest but long. Retirement (`032`) is exactly the readiness gate the blueprint asks for and already refuses to project. Assistant (`036`, `152`) works and is labelled, but the panel's feedback buttons use "Accept" as a primary-looking action.

**Console.** The household workspace (`059`, `156`–`169`) is a strong, serious flow: breadcrumb, h1, workflow chip, checkpoints and six tabs; the freeze gate explains blockers and how to resolve them; check runs show the receipt one click away (`163`); the review page states "What approval would mean" before the approval form (`167`); the approved state and packet carry the typed outcome (`168`, `170`, `182`). Weaknesses: no stage header, duplicate information between Overview and Review, tables without wrappers, teal health panel, `title`-only definitions. The queue (`043`) and the firm-level lists (`046`–`058`) are thin: one table per page, no counters, no coverage, no age, no search.

**Marketing.** Strong copy discipline (boundaries, FAQ, "not a certification") and a credible hero receipt. Weaknesses: header overflow, no h1s, status chips in teal, card grids of equal weight (three 3-up grids and a 4-up on the home page), the Patel "moment" callout in conflict red (alarm tone for a feature highlight), no product imagery or diagram (the brief allows purpose-built illustrative diagrams from synthetic data).

### 3.6 Responsive behaviour

| Id | Finding | Evidence | Phase |
|---|---|---|---|
| R1 | 13 tables render without an overflow region; at 390/320 px the status column is clipped with no affordance | inventory table; `177-fm-review-queue-390.jpg`, `180-fm-review-queue-320.jpg` | UI-001 `DataTable` |
| R2 | Record forms use fixed `grid-cols-2`/`grid-cols-3` (11 places) → three inputs share 358 px | `RecordForms.tsx` | UI-002 |
| R3 | `KeyValue` is a fixed `max-content 1fr` grid; long keys squeeze values on phones | `primitives.tsx:151`; `101-ps-retirement-390…` | UI-001 |
| R4 | Stat tiles stack 1-up at 390 px (four full-height tiles before the first recommendation) | `090-ps-overview-390-full.jpg` | UI-002 (2×2 compact grid) |
| R5 | Console mobile: persona select takes a full row; strips have no active state; dense card headers wrap awkwardly | `177-…`, `175-fm-patel-checks-after-390-full.jpg` | UI-001 / UI-003 |
| R6 | 768 px: rails hide, two-column grids collapse correctly; the marketing header still wraps | `143-mk-home-768.jpg`, `144-ps-overview-768.jpg`, `145-fm-review-queue-768.jpg` | UI-001 |
| R7 | 1280 px: layouts hold; the header wraps (N3) | `139-mk-home-1280.jpg`, `140`, `141`, `142` | UI-001 |
| R8 | 320 px: Personal reflows without horizontal page scroll; console tables overflow the viewport | `148-ps-overview-320.jpg`, `149-fm-patel-overview-320.jpg`, `180-…` | UI-001 |

### 3.7 Status colour discipline (where teal is spent on non-successes)

Teal/success tone today: calculation service reachable (`[id]/checks:55`), "Working (offline mock)" (`(marketing)/personal:32`), "Readiness gate live" (`(marketing)/retirement:17`), suggested action well (`DecisionCard:46`), goals "On track" (`goals:27`, acceptable: engine field), "Enough for a first baseline" (`intake:334`, acceptable), "Latest packet" (`evidence:47`), `ActionForm` success (acceptable), "Verified (not required)" (`CoveragePanel:14`), `READY_TO_FREEZE` workflow chip (`primitives.tsx:51`, nothing is verified yet). The design system's rule (teal = verified fact or recorded successful act) resolves each case.

### 3.8 Defects and inconsistencies (small, high-visibility)

| Id | Finding | Evidence | Phase |
|---|---|---|---|
| D1 | Severity chips stretch vertically in `FlagList` | `components.tsx` (`flex gap-3`), `019-…` | UI-001 |
| D2 | `hidden sm:inline-flex` conflict (see N5) | `SiteNav.tsx:39` | UI-001 |
| D3 | JetBrains Mono never loaded | `app/layout.tsx:23` | UI-001 |
| D4 | Raw `annual_rmd` string rendered without `formatMoney` on the household AI review page | `[id]/ai-review/page.tsx:46` | UI-003 |
| D5 | Two server actions share the name `updatePolicyAction` (firm vs personal) — not a UI bug, but a trap for UI PRs importing the wrong one | `server/actions.ts`, `server/personal-actions.ts` | note for all phases |
| D6 | `WhatIfForm` disabled reason says "Only the owner can run what-ifs" even when the real cause is a missing baseline | `WhatIfForm.tsx:22`, `scenarios/page.tsx:103` | UI-002 |
| D7 | Retire a record has no confirmation; reset uses `window.confirm` | `RecordForms.tsx:269`, `ResetDemoButton.tsx` | UI-001 |
| D8 | 25 inline `toLowerCase().replace(/_/g," ")`, 11 inline timestamp slices, 8 hash truncations, 9 ad-hoc status chips with inline tone ternaries, duplicated banner and brand lockup | inventory §(a) | UI-001 helpers |
| D9 | Synthetic banners use `role="status"` (live region) for permanent content | `ConsoleShell.tsx:23`, `PersonalShell.tsx:29` | UI-001 |
| D10 | The Next.js dev overlay badge ("N") appears in every screenshot; not a product defect, excluded from findings | all captures | — |

---

## 4. Cross-cutting measurements

### 4.1 Contrast (computed from `globals.css` values)

| Pair | Ratio | AA |
|---|---|---|
| ink on canvas | 15.4 | pass |
| ink-muted on surface / canvas / surface-muted | 6.9 / 6.5 / 6.2 | pass |
| **ink-faint on surface / canvas / surface-muted** | **3.5 / 3.3 / 3.1** | **fail (text)** |
| teal (eyebrow) on canvas / surface | 4.7 / 5.1 | pass |
| teal-700 on teal-100 · amber-700 on amber-100 · slate-700 on slate-100 · conflict-700 on conflict-100 | 6.5 · 6.1 · 6.5 · 7.4 | pass |
| white on navy · white on teal · white on conflict | 16.5 · 5.1 · 6.6 | pass |
| focus ring (teal) on canvas | 4.7 | pass (3:1) |
| **input border line-strong on surface** | **1.8** | **fail (3:1 UI)** |

### 4.2 Heading structure

h1 present: `/`, all 11 Personal pages, intake steps, 8 console index pages, household layout. **No h1:** `/personal`, `/retirement`, `/firms`, `/how-it-works`, `/pricing`, `/security`, `/demo`, `/app`. Two h2 levels on five marketing pages.

### 4.3 Arbitrary values (should be tokens)

`text-[10px]` ×2, `text-[11px]` ×8, `text-[12px]` ×2, `text-[13px]` ×1, `tracking-[0.14em]` ×13, `tracking-[0.12em]` ×1, `leading-[1.1]` ×1; nine grid templates, seven `min-w-[…]`, `max-h-[480px]`, two container widths, `max-w-[320px]`. No hex literals in TSX (good).

### 4.4 Web-tier arithmetic (brief constraint check)

Money arithmetic: **only** the pricing calculator and the shared `pricing.ts` helpers it calls (`monthly * 12`, fee formula). Money comparisons for presentation: Overview tone tests (`startsWith("-")`, `Number(buffer_months) < 1`), outlook row shading (`parseCents(a) < parseCents(b)`); these duplicate engine flags (`first_floor_breach_date`, `MISSING_*`/floor flags) and should read the flags instead. Count/percent arithmetic (tolerance ×100, MB conversion, state counts) is not money. Hard-coded money literals exist in marketing copy (`/`, `/demo`, `/retirement`, `SampleReceipt`).

### 4.5 Tables without an overflow region

`clients:20` (7 cols), `imports:22` (5), `checks:30` (6), `ai-review:39` (5), `approvals:29` (6), `pricing:44` (3), `cash-flow:88` (4), `savings-debt:108` (7), `scenarios:54` (5), `scenarios:116` (4), `privacy:32` (4), `intake verify:309` (4), `CoveragePanel:40` (4). With a wrapper: `reviews`, `settings` ×3, `evidence`, `[id]/imports`, `FactsTable`, `how-it-works`.

---

## 5. Screenshot references (curated set)

| Topic | Files |
|---|---|
| Marketing desktop | `001-mk-home-1440.jpg` (fold), `002-mk-home-1440-full.jpg`, `004-mk-personal-1440-full.jpg`, `006-mk-retirement-1440-full.jpg`, `008-mk-firms-1440-full.jpg`, `010-mk-how-it-works-1440-full.jpg`, `011-mk-pricing-1440.jpg`, `012-mk-pricing-1440-full.jpg`, `014-mk-security-1440-full.jpg`, `016-mk-demo-tour-1440-full.jpg`, `017-mk-sign-in-gate-1440.jpg` |
| Marketing responsive | `139-mk-home-1280.jpg`, `143-mk-home-768.jpg`, `072-mk-home-390-full.jpg`, `147-mk-home-320.jpg`, `078-mk-firms-390-full.jpg`, `082-mk-pricing-390-full.jpg`, `088-mk-sign-in-gate-390-full.jpg` |
| Personal desktop | `019-ps-overview-1440.jpg`, `020-ps-overview-1440-full.jpg`, `022-ps-next-steps-1440-full.jpg`, `023-ps-cash-flow-1440.jpg`, `024-ps-cash-flow-1440-full.jpg`, `026-ps-spending-1440-full.jpg`, `028-ps-savings-debt-1440-full.jpg`, `030-ps-goals-1440-full.jpg`, `032-ps-retirement-1440-full.jpg`, `033-ps-scenarios-1440.jpg`, `034-ps-scenarios-1440-full.jpg`, `036-ps-assistant-1440-full.jpg`, `038-ps-learn-1440-full.jpg`, `040-ps-privacy-1440-full.jpg`, `042-ps-intake-welcome-1440-full.jpg` |
| Personal interactions | `150-ps-overview-receipt-dialog-1440.jpg`, `151-ps-overview-ask-why-1440-full.jpg`, `152-ps-assistant-after-draft-1440-full.jpg` |
| Personal responsive | `140-ps-overview-1280.jpg`, `144-ps-overview-768.jpg`, `089-ps-overview-390.jpg`, `090-ps-overview-390-full.jpg`, `148-ps-overview-320.jpg`, `092-ps-next-steps-390-full.jpg`, `094-ps-cash-flow-390-full.jpg`, `098-ps-savings-debt-390-full.jpg`, `104-ps-scenarios-390-full.jpg`, `112-ps-intake-welcome-390-full.jpg`, `153-ps-overview-receipt-dialog-390.jpg`, `155-ps-assistant-after-draft-390-full.jpg` |
| Console lists | `043-fm-review-queue-1440.jpg`, `044-fm-review-queue-1440-full.jpg`, `046-fm-clients-1440-full.jpg`, `048-fm-imports-1440-full.jpg`, `050-fm-checks-1440-full.jpg`, `052-fm-planning-studio-1440-full.jpg`, `054-fm-ai-review-1440-full.jpg`, `056-fm-approvals-1440-full.jpg`, `058-fm-settings-1440-full.jpg`, `170-fm-approvals-after-1440-full.jpg`, `171-fm-review-queue-after-1440.jpg` |
| Patel flow | `059-fm-patel-overview-1440.jpg`, `156-fm-patel-freeze-blocked-1440-full.jpg`, `062-fm-patel-imports-1440-full.jpg`, `064-fm-patel-checks-before-1440-full.jpg`, `157-fm-patel-review-open-conflicts-1440-full.jpg`, `158-fm-patel-review-resolved-1440-full.jpg`, `159-fm-patel-freeze-ready-1440.jpg`, `160-fm-patel-frozen-1440.jpg`, `161-fm-patel-check-pass-1440.jpg`, `162-fm-patel-check-pass-1440-full.jpg`, `163-fm-patel-check-receipt-dialog-1440.jpg`, `164-fm-patel-check-request-json-1440-full.jpg`, `165-fm-patel-ai-review-draft-1440-full.jpg`, `166-fm-patel-review-pending-advisor-1440-full.jpg`, `167-fm-patel-review-cco-before-approval-1440-full.jpg`, `168-fm-patel-approved-1440-full.jpg`, `169-fm-patel-evidence-packet-ready-1440-full.jpg`, `181-fm-patel-packet-html-1440.jpg`, `182-fm-patel-packet-html-1440-full.jpg` |
| Okafor flow (reviewed with limitations) | `172-fm-okafor-check-unsupported-1440-full.jpg`, `173-fm-okafor-review-limitations-before-1440-full.jpg`, `174-fm-okafor-approved-limitations-1440-full.jpg`, `184-fm-okafor-packet-html-1440-full.jpg`, `179-fm-okafor-review-after-390-full.jpg` |
| Console responsive | `141-fm-review-queue-1280.jpg`, `145-fm-review-queue-768.jpg`, `177-fm-review-queue-390.jpg`, `178-fm-review-queue-390-full.jpg`, `180-fm-review-queue-320.jpg`, `142-fm-patel-overview-1280.jpg`, `146-fm-patel-overview-768.jpg`, `128-fm-patel-overview-390-full.jpg`, `149-fm-patel-overview-320.jpg`, `126-fm-settings-390-full.jpg`, `175-fm-patel-checks-after-390-full.jpg`, `176-fm-patel-review-after-390-full.jpg` |

Capture notes: desktop full-page images are scaled to 960 px wide and mobile full pages are cropped at 6000 px height to keep the repository small; the originals were 1440 px and uncropped. The evidence packet HTML was rendered from the export response (the route sends it as a download). The "N" badge at bottom-left is the Next.js development overlay.

---

## 6. Non-regression list (what the redesign must keep)

1. Receipt on every engine figure (`Money`, `ReceiptButton`), accessible name = amount, request hash re-derivation shown.
2. Typed, server-derived approval outcomes and their copy ("Arithmetic PASS is not approval", "What approval would mean", attestation text).
3. Permanent AI-draft marking, validator log, feedback as versioned events, "Deterministic offline mock" provider notice.
4. Persistent synthetic banners on both workspaces; "Simulated reviewer / individual, not an authenticated identity".
5. Freeze gate blockers with "How to resolve", disabled actions with reasons, non-disclosing not-found for foreign tenants.
6. Status always text + icon + colour; `aria-current` on tabs and Personal nav; `<fieldset>/<legend>` on radio groups; native `<dialog>`.
7. Honest status pages for proposed capabilities (Planning studio, Privacy grants, Shared goals, Retirement projection).
8. Marketing boundaries list, "What we do not claim", pricing as hypothesis, no SOC 2 / SEC / certification claims, provisional-brand notice.
9. All 16 Playwright scenarios (4 spec files) and the selectors they rely on (roadmap §stable selectors).

---

## 7. Prioritised redesign plan (summary; detail in the roadmap)

| Priority | Theme | Findings closed | Phase |
|---|---|---|---|
| P0 | Tokens, type scale, contrast, focus, motion; `PageHeader`, `DataTable`, `Section`, status vocabulary; grouped rails with active states; marketing header; bottom nav; skip link; banner role | V1, V3, V4, V12–V19, N1–N7, N10, R1, R3, D1–D3, D7–D9 | UI-001 |
| P1 | Personal journeys: Overview "what matters", 2×2 stats, outlook chart + table, calmer DecisionCard, forms reflow and labels, scenarios layout, intake copy | V5–V8, R2, R4, A12, A13, D6, V20, V21 | UI-002 |
| P2 | Console journeys: stage header + next permitted action, queue columns/counters/search, coverage vocabulary, neutral health panel, hash copy, definitions as text, review/evidence density | A2, A3, A10, A11, N8, N9, V9, V10, R5, D4 | UI-003 |
| P3 | Public site: header, h1s, status chips, claims (A1, A5–A9), outcome narrative, pillar panels, diagram from synthetic data | A1, A5–A9, V17 (marketing), N3, N4 | UI-004 |
| P4 | Validation: axe, keyboard, screen reader, visual matrix, user tasks, performance | all residual | UI-005 |
