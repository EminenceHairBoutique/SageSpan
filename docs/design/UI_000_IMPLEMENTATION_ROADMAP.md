# SageSpan UI implementation roadmap: UI-001 → UI-005

**Document:** `docs/design/UI_000_IMPLEMENTATION_ROADMAP.md` · **Version:** 1.1 (founder decisions D1–D7 recorded as accepted) · **Date:** 2026-11-06 · **Status:** plan (UI-000, documentation only)
**Rules that bind every phase:** presentation only; no financial mathematics, receipts, statuses, permissions, migrations, contracts, calculator, AI validation or workflow code change in a UI PR; synthetic data only; URLs stable; every PR ships before/after screenshots, exact test results, accessibility evidence, files changed, limitations and the next milestone. Complexity bands: **S** ≤ 1 day, **M** 2–4 days, **L** 5–10 days of focused work, each phase split into reviewable sub-PRs as listed.

| Phase | Theme | Band | Sub-PRs | Depends on |
|---|---|---|---|---|
| UI-001 | Foundations, navigation, visual system | L | 001a tokens + primitives + helpers · 001b shells + navigation + loading states · 001c gallery + a11y/visual test harness | founder decisions D1–D4 |
| UI-002 | Consumer priority journeys | L | 002a Overview + Next steps + DecisionCard · 002b Cash flow + chart + forms · 002c Savings & debt, Spending, Scenarios, Assistant, Retirement, Privacy copy | UI-001 |
| UI-003 | Advisor assurance journeys | L | 003a queue, lists, stage headers · 003b household Checks/Review/Evidence, coverage vocabulary, receipts · 003c post-PR #10 auth layout + WorkspaceSwitcher | UI-001; 003c also PR #10 merged |
| UI-004 | Public website and storytelling | M | 004a header/footer/h1/status chips/claims · 004b home narrative, pillar pages, diagram, pricing wording | UI-001 |
| UI-005 | Polish and usability validation | M | one PR of fixes + `UI_005_VALIDATION_REPORT.md` | UI-002, UI-003, UI-004 |

---

## File ownership (all phases)

| May be edited by UI phases | Never edited by UI phases |
|---|---|
| `apps/web/src/app/globals.css` · `apps/web/src/app/layout.tsx` (skip link, font `<link>`) · `apps/web/src/ui/**` · `apps/web/src/app/**/page.tsx` and `layout.tsx` under `(marketing)`, `demo/personal`, `demo/app` (presentation only: JSX, class names, copy, component composition) · new `apps/web/src/app/**/loading.tsx` · `apps/web/src/app/design/system/page.tsx` (dev-only gallery) · `apps/web/e2e/**` (new specs; label updates to existing specs) · `apps/web/src/ui/__tests__/**` · `apps/web/src/config/brand.ts` (strings only, with founder approval) · `docs/design/**` | `apps/web/src/domain/**` · `apps/web/src/auth/**` · `apps/web/src/server/**` · `apps/web/src/ai/**` · `apps/web/src/provenance/**` · `apps/web/src/config/env.ts` · `apps/web/src/app/api/**` · `packages/contracts/**` · `services/calculator/**` · `supabase/**` · `fixtures/**` · `.github/**` · `CLAUDE.md` (except a one-line pointer to `docs/design/README.md`, if the founder wants it) |
| **Held until PR #10 merges:** `apps/web/src/ui/ProductionGate.tsx`, `ui/SignInForm.tsx`, `ui/ProductionHome.tsx`, `apps/web/src/app/app/**` | **Coordination required (domain owner):** `apps/web/src/domain/evidence.ts` packet HTML theme — proposal: `ui/evidence/packetStyles.ts` exporting a CSS string that `evidence.ts` imports |

Data-flow rule for pages: a page may *read* fields the bundle/insights already expose and may *format* them (`formatMoney`, `humanize`, `formatWhen`); it may not derive a money value, compare amounts to produce a judgement that the engine already provides as a flag, or call a new domain function. Where today's pages compare cents in TSX (Overview tones, outlook shading), UI-002 reads the engine flags instead and lists any residual gap as a calculator request, not a UI workaround.

---

## UI-001 — Foundations, navigation and visual system (L)

**Goal:** the design system of `UI_001_DESIGN_SYSTEM_SPEC.md` exists in code; every page inherits better type, colour, focus, motion, spacing and navigation without page rewrites; the accessibility harness runs.

**Scope (exact files).**
*001a tokens, primitives, helpers*
- `apps/web/src/app/globals.css`: colour primitives and semantic aliases (§1.1–1.2), `--text-*` scale (§1.3), spacing/density component tokens (§1.4), radius (§1.5), shadows (§1.6), motion tokens + `prefers-reduced-motion` (§1.7), focus ring with halo, `scroll-padding-top`, `[data-density]`.
- `apps/web/src/app/layout.tsx`: add JetBrains Mono to the existing Google Fonts link; skip link `<a href="#main">`; nothing else.
- `apps/web/src/ui/primitives.tsx` (additive only; every current export and prop keeps working for PR #10): `Card headingLevel|tone|density|footer`, `SectionHeading level`, `Alert role mapping + actions` (and a `Notice` alias), `Chip history`, `Th scope="col"`, `KeyValue stacked at < sm`, `EmptyState action|reason`, `Field error|required text`, `inputClasses` with `line-input`, `buttonClasses` pending/destructive variants.
- New `apps/web/src/ui/format.ts` (`humanize`, `formatWhen`, `shortHash`), `ui/PageHeader.tsx`, `ui/DataTable.tsx`, `ui/Skeleton.tsx`, `ui/ServiceState.tsx`, `ui/ConfirmDialog.tsx`, `ui/status/` (typed chips moved here with re-exports left in `primitives.tsx` and `personal/components.tsx` so no import breaks; vocabulary from §6).
- `ui/ActionForm.tsx`: static pending icon under reduced motion, field-level errors when the result carries a field path, success/failure roles.
- `ui/ReceiptDialog.tsx`: sections, copy button, `aria-describedby`.
- `ui/personal/components.tsx`: `FlagList` `items-start` (D1), `Stat` qualifier text + skeleton.
- `ui/console/Checkpoints.tsx`: 12 px floor, `aria-current="step"`.
*001b shells and navigation*
- `ui/shell/{SyntheticBanner,BrandLockup,SideRail,RailNav(client),BottomNav(client),TopBar}.tsx` (new).
- `ui/marketing/SiteNav.tsx`: one-line header at ≥ 1280, "Menu" disclosure at < md listing all links + Sign in + both CTAs, remove the `hidden sm:inline-flex` conflict; nav label "Retirement Studio" (decision D1).
- `ui/console/ConsoleShell.tsx`: grouped rail with active state, top bar, banner component, `data-density="compact"`.
- `ui/personal/PersonalShell.tsx`, `ui/personal/PersonalNav.tsx`: grouped rail (Home / My money / My plan / Guidance), rail footer, bottom nav + More sheet at < md, `data-density="comfortable"`.
- `apps/web/src/app/demo/personal/loading.tsx`, `apps/web/src/app/demo/app/loading.tsx`, `apps/web/src/app/demo/app/households/[id]/loading.tsx`.
*001c gallery and harness*
- `apps/web/src/app/design/system/page.tsx`: renders every component in every state from §2 using synthetic props; returns `notFound()` unless `SAGESPAN_DEMO_MODE === "1"`.
- `apps/web/e2e/visual.spec.ts`: screenshot matrix (12 routes × 1440/1280/768/390/320) and the assertion `document.documentElement.scrollWidth <= window.innerWidth` at 320 and 390 on Personal and marketing routes (console tables are inside labelled scroll regions, so the page itself must not overflow either).
- `apps/web/e2e/a11y.spec.ts` with `@axe-core/playwright` (dev dependency; decision D4). If declined, the spec runs a built-in check set (headings order, one h1, `scope` on `th`, labels on inputs, `aria-current` presence) via `page.evaluate` without a dependency.
- `apps/web/src/ui/__tests__/*.test.tsx`: the web Vitest environment is node (no jsdom in `devDependencies`), so component tests render with `react-dom/server` `renderToStaticMarkup` and assert markup, labels, roles and class tokens. Cover: `PageHeader` (meta row with and without a run), `DataTable` (caption, scope, scroll region attributes), typed chips (every enum value → label + tone class), `Field` error state, `KeyValue` stacked class, `ServiceState` three variants, `format.ts` helpers.

**Non-goals:** no page-level redesign (UI-002/003/004), no chart, no copy rewrites beyond labels in the vocabulary table, no dark mode, no new runtime dependency, no change to `ProductionGate`/`SignInForm`/`ProductionHome`.

**Acceptance tests.** All 16 existing Playwright scenarios pass (with the label updates listed under *stable selectors*); new `visual.spec.ts` and `a11y.spec.ts` pass with zero `serious`/`critical`; Vitest additions pass; `npm run typecheck`, `npm run lint`, `npm run build --workspace apps/web` clean; contrast script output attached; token grep checks from design system §8 pass.

**Screenshots that prove the phase:** `/design/system` full page (every component/state); `/` header at 1280 and 1440 on one line; `/` at 390 with the menu open showing both CTAs; `/demo/personal` at 1440 (grouped rail, active item) and at 390 (bottom nav, More sheet open); `/demo/app/reviews` at 1440 (grouped rail with active state) and 390 (strip with active state); focus-ring montage on navy button, teal chip, input; reduced-motion pending state; `loading.tsx` skeleton for the Personal overview.

**Risks and conflicts:** `primitives.tsx` is imported by PR #10 — additive changes only, verified by building PR #10's branch against UI-001's `primitives.tsx` before merge (checkout, `npm run typecheck`); `SiteNav` label change needs `dual-market.spec.ts` update; moving typed chips must keep the exact exported names (`ResultChip`, `OutcomeChip`, `DataStateChip`, …).

---

## UI-002 — Consumer priority journeys (L)

**Goal:** Overview, Next steps, Cash flow, Savings & debt, Spending, Scenarios, Assistant, Retirement readiness and Privacy present evidence, feasibility and decisions calmly, per blueprints B2–B7, B13 and the screen plan §1–8, §13.

**Scope (exact files).** `apps/web/src/app/demo/personal/page.tsx`, `next-steps/page.tsx`, `cash-flow/page.tsx`, `spending/page.tsx`, `savings-debt/page.tsx`, `goals/page.tsx`, `scenarios/page.tsx`, `assistant/page.tsx`, `retirement/page.tsx`, `privacy/page.tsx`, `learn/page.tsx` (header only), `intake/[step]/page.tsx` (copy: "Check what you entered"; responsive grids); `ui/personal/DecisionCard.tsx` (v2), `ui/personal/components.tsx` (`Stat`, `FlagList`, `Money` qualifier), `ui/personal/RecordForms.tsx` (responsive grids, single labels, confirm on retire), `ui/personal/WhatIfForm.tsx` (correct disabled reason, labels), new `ui/personal/OutlookChart.tsx` (inline SVG + alt table, design system §4), `ui/ai/AiReviewPanel.tsx` (`FindingCard` v2 shared with the firm; UI-003 consumes).

**Non-goals:** no new engine fields (if a per-point below-floor marker is wanted, file it as a calculator request); no PERS-002b/d transaction features (status lines only); no consent-grant controls (B13 shows the disabled "Proposed (PR-003)" control and the empty state); no notification UI; no change to the decision policy or its outputs.

**Acceptance tests.** Existing `dual-market.spec.ts` and `pers-002-intake.spec.ts` pass, with these deliberate updates in the same PR: Overview compact cards keep `article[aria-label]` ×3 and the "Ask why" button; if feedback buttons move to Next steps, the "Snooze → You: snooze" step navigates there first. New `e2e/personal-ui.spec.ts`: chart renders with `role="img"` and an `aria-label` naming the lowest point and date; "Show as table" toggles the table and is keyboard operable; at 390 px the four stats fit in the first screen and no form overflows (`scrollWidth` check); INFEASIBLE what-if renders the blocked tone with the reason text. Vitest: `OutlookChart` (n points → path, floor line present, markers by event kind, alt table rows = points), `DecisionCard` states, liabilities row states, `WhatIfForm` disabled-reason mapping.

**Screenshots:** Overview 1440 + 390 before/after; Next steps 1440; Cash flow 1440 + 390 with the chart and with the table toggled; Scenarios 1440 with an INFEASIBLE result; Assistant 1440 after a draft; Retirement 1440; Privacy 1440 with the disabled share control; receipt dialog with sections.

**Risks:** the shared `AiReviewPanel` edit must keep firm e2e assertions ("AI draft — not a review, approval or verification", "Amounts from a receipted calculation", "Unverified draft", "draft for human review", "Accept", "Request evidence", "Record request").

---

## UI-003 — Advisor assurance journeys (L)

**Goal:** the console reads as a task-first assurance system: queue with true counters and coverage, stage headers with the next permitted action, dense but accessible tables, one coverage vocabulary, receipts and evidence with copyable integrity data, honest health and provider states; blueprints B8–B12.

**Scope (exact files).**
*003a*: `apps/web/src/app/demo/app/reviews/page.tsx`, `clients/page.tsx`, `imports/page.tsx`, `checks/page.tsx`, `ai-review/page.tsx`, `approvals/page.tsx`, `settings/page.tsx`, `planning-studio/page.tsx`; `households/[id]/layout.tsx` (stage header slot, stepper v2, tab counts).
*003b*: `households/[id]/page.tsx`, `imports/page.tsx`, `checks/page.tsx`, `ai-review/page.tsx` (`formatMoney` on the deterministic result, D4), `review/page.tsx`, `evidence/page.tsx`; `ui/console/CoveragePanel.tsx` (labels per design system §6.3–6.4, definitions as visible text, `OutcomeNotice`), `ui/console/CheckRunCard.tsx` (per-status layouts, history style, hash copy), `ui/console/FreezeGatePanel.tsx`, `ui/console/FactsTable.tsx` (DataTable semantics), `ui/console/HouseholdTabs.tsx`, `ui/console/PersonaSwitcher.tsx` (simulation marker, helper text), `ui/evidence/packetStyles.ts` (new; only wired if the domain owner accepts the one-line import in `domain/evidence.ts`).
*003c (after PR #10 merges)*: `ui/shell/WorkspaceSwitcher.tsx` (new; uses `selectOrgAction`/`selectWorkspaceAction` from `server/auth-actions.ts` as they exist, no new actions), auth layout styling for `app/app/sign-in/page.tsx` and `ui/ProductionHome.tsx` (presentation only), `ui/ProductionGate.tsx` restyle.

**Non-goals:** no change to approval, readiness, coverage or packet derivation; no new queue data beyond fields already in the store (`coverageSummary`, `updated_at`); no member management, import maps, document registration, PDF, manifest (PR-003 / IMPORT-001 / S-10); no mobile-first console redesign (operability only).

**Acceptance tests.** `assurance-flow.spec.ts` and `pr-002-coverage.spec.ts` pass with these deliberate updates: coverage label regex `/Outside supported scope|Not required \(eligibility confirmed\)/` and `"Arithmetic PASS · receipt verified"` in place of `"Verified (PASS)"` (decision D5; if declined, labels stay and only tones change). New `e2e/console-ui.spec.ts`: queue shows counters and a Coverage column; at 390 px the queue table sits in a focusable `role="region"` with an accessible name; the household stage header shows the next permitted action text that changes with the persona (ANALYST on FROZEN: "Run independent RMD check"; CCO on REVIEWED: "Approve (professional act)"); the calculation-service panel is neutral when reachable and blocked when not (`CALC_SERVICE_URL` pointed at a closed port in a second webServer config is optional; otherwise assert the neutral tone only). Vitest: `CoverageTable` label/tone map for all six coverage values, `OutcomeNotice` for the three outcomes + blocked codes, `shortHash`, stage-header next-action mapping (pure function over role × status strings already used as disabled reasons).

**Screenshots:** queue 1440 + 390 before/after; household Checks after a PASS run (Patel) and after UNSUPPORTED (Okafor) at 1440; review page as ANALYST, ADVISOR and CCO at 1440 showing the stage header and next action; approved states for both outcomes; evidence tab + packet HTML before/after; receipt dialog with copy; settings at 390.

**Risks:** label changes touch `pr-002-coverage.spec.ts` and `assurance-flow.spec.ts` (the Okafor test and the "Verified (PASS)" assertion); 003c waits for PR #10 and must not re-implement its actions.

---

## UI-004 — Public website and product storytelling (M)

**Goal:** a refined, truthful public site: one-line header, h1 on every page, outcome narrative, three pillar panels with honest status, trust section about implemented design controls, one purpose-built diagram from synthetic data, pricing as hypothesis; blueprint B1.

**Scope.** `apps/web/src/app/(marketing)/page.tsx`, `personal/page.tsx`, `retirement/page.tsx`, `firms/page.tsx`, `how-it-works/page.tsx`, `security/page.tsx`, `pricing/page.tsx`, `demo/page.tsx`; `ui/marketing/SiteNav.tsx` (if not finished in UI-001), `SiteFooter.tsx`, `SampleReceipt.tsx` (read every figure from the imported fixture; chip "Arithmetic PASS · receipt verified"), `PricingCalculator.tsx` (caption "Illustrative arithmetic computed in your browser from the published hypothesis; not a quote"), `PilotInterestForm.tsx`, new `ui/marketing/FlowDiagram.tsx` (inline SVG of Patel: two sources disagree → resolve → freeze → check → outcome, with text alternative); `apps/web/src/config/brand.ts` strings only if the founder approves ("Retirement Studio" naming).

**Claims register changes (must appear in the PR description):** A1 chip wording; A5 status chips become neutral/amber; A6 sentence on `/firms` becomes "Everything in this section runs in the synthetic demo on real code; capabilities marked Proposed are not built"; A7 "validated engines" → "receipted engines; validation is a release gate"; A8 "the web app never does arithmetic" → "the web application never computes a financial figure"; A9 fixture-driven numbers.

**Non-goals:** no new pages, no imagery licensing, no SEO beyond semantic headings and titles (robots stay `noindex` until the founder lifts it), no change to pricing values or the hypothesis framing, no analytics.

**Acceptance tests.** `assurance-flow.spec.ts` public-site test passes (its asserted strings "Independent plan assurance, one supported check at a time", "Design approach, not a certification", "Proposed, illustrative, not yet offered", "$2,150", "$3,900", "Interactive synthetic tour · Firm", "Start the tour", "/product → /firms" are kept or updated in the same PR); `dual-market.spec.ts` nav assertions; new `e2e/marketing-ui.spec.ts`: every marketing route has exactly one h1; header height ≤ 72 px at 1280 and 1440; at 390 px the menu button opens a list containing both CTA links and "Sign in"; the sample receipt amount equals the fixture's `annual_rmd` formatted; no page overflows at 320 px. Vitest: `FlowDiagram` markup has `role="img"`, an `aria-label` and a text alternative list.

**Screenshots:** home 1440/1280/768/390/320 before/after; each pillar page 1440; pricing 1440 + 390; security 1440; the diagram at 1440 and 390; menu open at 390.

---

## UI-005 — Polish and usability validation (M)

**Goal:** evidence that the redesign works for people, not only in screenshots.

**Scope.** Fix-only code changes under `apps/web/src/ui/**` and page presentation; `docs/design/UI_005_VALIDATION_REPORT.md`; `docs/design/screenshots/ui-005/`.

**Activities and acceptance.**
1. **User test tasks** (moderated, synthetic personas; five tasks per audience): Personal — find where you stand and why; decide on the first next step and record it; see what a one-month income gap does; find the receipt behind a number; find what is missing. Firm — find the household that needs attention; resolve the Patel conflict and freeze; run the check and read the receipt; approve with the right outcome and explain it; export and verify the packet. Success = completion without facilitator help and a "could explain the number's source" check; report task times, errors, quotes, fixes.
2. **Keyboard walkthrough** of both workspaces and the site (recorded checklist, focus-ring screenshots at every stop).
3. **Screen-reader pass** (NVDA + Firefox; VoiceOver iOS if available) on Overview, Cash flow, review page, receipt dialog, coverage notice; findings fixed or filed.
4. **Visual regression**: `visual.spec.ts` matrix committed as `screenshots/ui-005/` and compared by eye against `ui-000/`; no pixel-diff CI (keeps CI deterministic without new deps).
5. **Chart readability**: outlook chart checked at 320/390/1440, with colour-vision simulation (browser devtools), alt table parity.
6. **Mobile audit**: bottom nav reachability of all 11 Personal routes; console tables scroll regions; 200 % zoom at 1280.
7. **Performance**: `next build` route sizes before/after UI-001–004; client JS for the Personal overview must not grow by more than the chart and nav components; Playwright navigation timing on the four key routes reported.
8. **Stress and error states**: calculator stopped (ServiceState), AI provider configured as a vendor name (mock + note), INSUFFICIENT_DATA workspace (Start fresh with blanks), unsupported-only household (Okafor), denied role actions, revoked persona cookie; each with a screenshot.

**Non-goals:** no feature work, no backend changes, no production claims.

---

## Stable selectors (from the four Playwright specs) — keep or update with the test in the same PR

| Spec | Selectors that UI phases must keep working |
|---|---|
| `assurance-flow.spec.ts` | h1 containing "Clear money decisions, realistic plans, independent checks"; text "$25,098.04"; `navigation[name="Primary"]` links "For Advisors & Firms", "Security & Trust", "Pricing"; texts "Independent plan assurance, one supported check at a time", "Design approach, not a certification", "Proposed, illustrative, not yet offered"; cells "$2,150", "$3,900"; label "Active monitored households (number)"; `data-testid="price-monthly"`; `/product` → `/firms`; `/demo` text "Interactive synthetic tour · Firm", link "Start the tour"; `#persona` select and "Acting as {name}"; `input[name="file"]`, button "Upload and validate", text /files are not supported/; "Synthetic demonstration data"; button /Freeze snapshot/ (disabled state); texts /custodian statement \$640,000\.00/, /\$612,000\.00/; `#conf_patel_balance`, `#conf_patel_custodian` with radio, label /Rationale/, buttons "Resolve with chosen source", /Document exception/, label "Exception rationale", texts /Resolved by …/, /Exception documented by …/; "No blockers"; /Snapshot snap_… frozen/; /Reachable · engine/; button /Run independent RMD check/; "Arithmetic PASS"; button /\$25,098\.04/; "Source conflict"; "request hash verified"; dialog content "640000.00 / 25.5", "rmd.uniform_lifetime_table@2022.1"; dialog button "Close"; `code` starting "snap_"; button /Send to review/, "Sent to review."; label "Disposition note", button "Record disposition", /Marcus Lee \(ADVISOR\) on/; label "Review rationale", button /Record review/, "Review recorded."; label "Approval rationale"; a checkbox; `data-testid="coverage-panel"` with "Verified (PASS)" (**changes with D5**); /If approved now: Approved with exceptions/; button /Approve \(professional act\)/; /^Approved\./; "Approved: Approved with exceptions"; button /Generate evidence packet/; /Packet pkt_… ready/; link "JSON"; links "Bauer household", "Patel household"; "Not found" |
| `pr-002-coverage.spec.ts` | `#conf_okafor_dob`; coverage text /Outside supported scope\|Verified \(not required\)/ (**changes with D5**); "If approved now: Reviewed with limitations"; "Approved: Reviewed with limitations"; row /Okafor/ containing the outcome label; packet title strings (domain-owned, unchanged) |
| `dual-market.spec.ts` | `navigation[name="Primary"]` links "Personal", "Retirement Planning" (**changes with D1**), "For Advisors & Firms", "How It Works", "Security & Trust", "Pricing"; link "Sign In"; link /Plan My Finances/; text /Synthetic demonstration\. Every person here is fictional/; link "Explore for Firms"; link "Open the firm console (synthetic)"; h1 "Review queue"; "Sign-in is not available in this build"; h1 containing "Where you stand, Maya"; texts "$1,503.50", "$3,650.00", "re-derived and matched"; `article[aria-label]` ×3; "Do this now", "Consider next", "Revisit later"; "Build toward your 2-month essential buffer"; "$2,399.00"; button "Ask why"; /Ranked 1 of \d+/; /decision-policy\.v1/; button "$3,650.00"; dialog content "personal.cashflow_baseline@2026.1"; button "Snooze"; /You: snooze/; cells "Minimums only", "Highest rate first"; buttons "$3,024.50" / "$3,026.04" / "$3,094.50" (scenario receipts); /Understand my finances/, "AI draft — not advice", "Amounts from a receipted calculation", "Unverified draft", "Accept", "Request evidence", placeholder "What evidence is needed and from whom", "Record request"; `navigation[name="Console"]`, "Proposed · not implemented", /Analyze plan/, "AI draft — not a review, approval or verification", "draft for human review"; "Maya Castillo", "You have not shared anything."; `navigation[name="Personal workspace"]`, `main`; "What if…" heading, label "Scenario kind", "Income stream", "Interruption months", "Monthly spending change", button "Run what-if", "0.95 months", "personal.cashflow_scenario@2026.1", row /Margin, typical month/, "This change cannot be applied to your inputs", "Required minimum payments are always paid in full" |
| `pers-002-intake.spec.ts` | labels "Display name", "Workspace kind", "Household size", "Cash floor", "Income name", "Income kind", "Income cadence", "Income reliability", "Observed monthly amounts", "Commitment name", "Amount", "Next due date", "Category"/"Spending category", "Account name", "Balance", "Balance as of", "Switch person", "New balance for Savings", "As-of date for Savings"; buttons "Create my workspace", "Add an income stream", "Add a recurring commitment", "Add a category", "Add a cash account", "Add", "Retire", "Save new revision", "Switch"; links "Continue", "Skip for now", "Compute my baseline", /Open my Overview/; headings "Recurring bills and commitments", "Variable spending", "Cash and debts", "Goals", "Verify the key inputs" (**changes with the UI-002 copy fix**), "Insufficient data", "Computed", "Where you stand this month"; texts "Signed in as Jordan" (**changes with the identity-line rename; keep "Jordan" visible**), "Start fresh · Jordan's household", "The baseline will say INSUFFICIENT_DATA", "Missing", "Update balance", "savings · as of 2026-11-05 · revision 2", /Added "…"/ messages |

Rule: a UI PR that changes any of these strings edits the spec in the same PR, states it in the description, and runs the full e2e suite locally against its own dev server on a port other than 3000 (the main checkout's `.env.local` changes the brand tagline and state file).

---

## Founder decisions (requested before UI-001; decided 2026-11-06)

**Record:** on 2026-11-06 the founder accepted every recommendation below ("Accept all recommendations", answered in the UI-000 session). These are now binding for UI-001…UI-005; each row names the phase that acts on it. A copy of this record belongs in `docs/DECISIONS.md` once PR #11 (which edits that file) has merged, to avoid a conflict.

| Id | Decision | Recommendation | Decided | Acts in |
|---|---|---|---|---|
| D1 | Rename public nav "Retirement Planning" → "Retirement Studio" (and Personal rail "Retirement" → "Retirement Studio") | Yes; one name for the pillar | **Accepted** (update `dual-market.spec.ts` in the same PR) | UI-001b |
| D2 | Personal mobile bottom navigation: four items (Home · Money · Plan · More) | Yes; Assistant lives under More, never the primary path | **Accepted** | UI-001b |
| D3 | One interim brand mark (navy tile) for all three surfaces, pending the real mark | Yes | **Accepted** (a purpose-designed mark remains a separate brand decision) | UI-001b |
| D4 | Allow `@axe-core/playwright` as a dev-only dependency | Yes; otherwise the built-in check set | **Accepted** | UI-001c |
| D5 | Coverage labels: "Arithmetic PASS · receipt verified" and "Not required (eligibility confirmed)" instead of "Verified (PASS)" / "Verified (not required)" | Yes; reserves "verified" per the vocabulary rule; two e2e regexes update | **Accepted** (update `assurance-flow.spec.ts` and `pr-002-coverage.spec.ts` in the same PR; `CoveragePanel.tsx` labels only, no contract change) | UI-003b |
| D6 | Identity lines: "Simulated reviewer: …" / "Demo person: …" in demo; "Signed in as …" only for a real session | Yes | **Accepted** (keep the person's name visible; `pers-002-intake.spec.ts` asserts "Signed in as Jordan" and needs updating) | UI-001b |
| D7 | Calculator request (not UI): per-point `below_floor` marker in `outlook.points` so the UI stops comparing cents for row shading | File for the calculator owner; UI-002 reads flags meanwhile | **Accepted as a request** to the calculator owner (new method-set version, golden test, contracts mirror); UI-002 reads existing flags until it ships | calculator owner; UI-002 |

---

## PR report template (every UI phase)

```
## UI-00n{a|b|c}: <title>
Scope / non-goals (link to roadmap section)
Before / after screenshots (paths under docs/design/screenshots/ui-00n/)
Visual changes (bullets)
Accessibility evidence (axe summary, keyboard checklist, contrast script output)
Tests run (exact commands, pass/fail counts): typecheck · lint · web vitest · contracts vitest · e2e (port) · build
Files changed (grouped: tokens / primitives / shells / pages / tests / docs)
Known limitations · backend-blocked items shown as status only
Next milestone
🤖 Generated with [Claude Code](https://claude.com/claude-code)
```
