# SageSpan page blueprints (desktop and mobile)

**Document:** `docs/design/UI_001_PAGE_BLUEPRINTS.md` · **Version:** 1.0 · **Date:** 2026-11-06 · **Status:** specification (UI-000, documentation only)
**Conventions:** desktop = 1440 px with a pinned rail (1280 px reflows the same layout with narrower gutters); tablet = 768 px (rail hidden, two columns become one, tables scroll); mobile = 390 px (bottom navigation on Personal; 320 px must reflow without horizontal page scroll). Every figure shown comes from an existing receipted engine field or a stored record; nothing in a blueprint introduces a value the server does not already return. Features that do not exist are drawn with their **status label** and are never drawn as working controls.

Blueprint index: B1 Marketing home · B2 Personal Overview · B3 Cash flow · B4 Savings & debt · B5 Scenarios · B6 SageSpan Assistant · B7 Retirement Studio readiness · B8 Firm review queue · B9 Household workspace: Checks · B10 Household workspace: Review and approval · B11 Evidence · B12 Sign-in and workspace chooser (PR #10) · B13 Privacy & sharing (consent grants, proposed)

---

## B1 · Marketing home (`/`)

**Desktop 1440**
```
┌ Header (64) ───────────────────────────────────────────────────────────────────────────────┐
│ [■ SageSpan]   Personal  Retirement Studio  For Advisors & Firms  How It Works  Security & Trust  Pricing │ Sign in  [Plan My Finances] [Explore for Firms] │
├ Hero (canvas) ─────────────────────────────────────────────────────────────────────────────┤
│ eyebrow: FOR INDIVIDUALS AND HOUSEHOLDS · FOR ADVISORS AND FIRMS                            │
│ H1 display: Clear money decisions, realistic plans, independent checks.                     │
│ lead (60ch)                                                   ┌ Receipt panel (synthetic) ┐ │
│ [Plan My Finances →] [See the professional workflow]           │ eyebrow + chip "Arithmetic │ │
│ fine print: No sign-up. Synthetic demonstration …             │ PASS · receipt verified"   │ │
│                                                               │ $25,098.04 (from fixture)  │ │
│                                                               │ formula · inputs · rule set│ │
│                                                               │ "PASS ≠ approval" line     │ │
├ Outcome narrative (surface) ───────────────────────────────────────────────────────────────┤
│ Where you stand → What matters → Options worth considering → You're in control (4 steps)  │
├ Three pillars ─────────────────────────────────────────────────────────────────────────────┤
│ [Personal · Working (synthetic)] [Retirement Studio · Readiness gate; projection Proposed] [Advisor & Assurance · Working (synthetic)] │
├ Trust: design controls actually implemented (not certifications) · links to Security & Trust │
├ "The moment that matters" (Patel conflict) · FAQ · Pilot interest form ───────────────────────┤
└ Footer: product links · boundaries list · provisional-name notice · synthetic notice ──────┘
```
**Mobile 390:** header = lockup + **Menu**; hero stacks (H1 at 36/40), both CTAs full-width stacked, fine print; receipt panel after the CTAs; pillars as a vertical list with status chips; FAQ as `<details>`; form single column.
Notes: the sample receipt chip changes from "supported verified" (raw `coverage_status`) to "Arithmetic PASS · receipt verified"; the big number reads from the fixture field, not a literal. "See the professional workflow" is an alternative CTA label (brief); keep `Explore for Firms` in the header for the existing test.

---

## B2 · Personal Overview (`/demo/personal`)

**Desktop 1440**
```
┌ Synthetic banner (note) ───────────────────────────────────────────────────────────────────┐
├ Rail 240 ──────┬ Top bar: Maya's finances · As of 2026-11-06 · last recompute 13:52 · [Recompute] ┤
│ Home           │ PageHeader: eyebrow HOME · H1 "Where you stand, Maya" · lead (situation)        │
│  • Overview    │ meta: snapshot snap_… · method personal.cashflow_baseline@2026.1 · receipt ✓     │
│  • Next steps  ├ "What matters this week" (one sentence from the highest-severity flag) ─────────┤
│ My money       ├ Stats (4) ───────────────────────────────────────────────────────────────────────┤
│  • Cash flow   │ Liquid cash $3,650.00 ⌁ | Essentials covered 1.21 mo ⌁ | Typical margin $1,503.50 ⌁ | Lowest point (90 d) $1,756.60 ⌁ │
│  • Spending    │ hint: floor $1,500 · $2,150 above | target 2 mo · gap $2,399 | low month $533.50 | 2026-11-06 · above floor │
│  • Savings&debt├ Two columns 1.4fr / 1fr ─────────────────────────────────────────────────────────┤
│ My plan        │ Your next three steps (compact DecisionCards; one primary "Review" per card, │ What needs attention (≤ 6 flags, severity chip left, │
│  • Goals       │ details on Next steps)                                                      │ due date and amount in text)                          │
│  • Retirement  │                                                                             │ What I don't know yet (data-state rows) + link        │
│  • Scenarios   ├ Cash-flow outlook (compact chart 160 px + "Show as table") ─────────────────────┤
│ Guidance       ├ meta line (snapshot · as-of · method · receipt) · "Descriptive arithmetic …; not advice" ┤
│  • Assistant   │
│  • Learn       │
│ footer: person · Privacy & sharing · Switch person (demo) · Start fresh (demo) │
```
**Mobile 390:** top bar (lockup, as-of), "What matters this week", stats as a 2×2 grid of compact tiles (value 22 px) so all four fit in one screen, next three steps as stacked compact cards (title, one-line observed, "Review" button), attention list collapsed to 3 with "Show all", outlook chart replaced by the lowest-point sentence + "Open cash flow", bottom nav Home · Money · Plan · More.
Changes vs today: stat tones gain text qualifiers; "Essentials covered" gets a receipt (field `cash.essential_buffer_months`); feedback buttons move off the Overview (one "Review" action per card; Done/Snooze/etc. live on Next steps); the suggested-action well is neutral, not teal; flag chips no longer stretch (`items-start`).

---

## B3 · Cash flow (`/demo/personal/cash-flow`)

**Desktop 1440**
```
PageHeader: MY MONEY · "Income, commitments and the next 90 days" · lead · meta
Stats (3): Typical monthly income ⌁ | Low month ⌁ | Essential commitments / month ⌁
Notice (amber, if IRREGULAR): "Irregular income: the outlook uses each stream's lowest observed month …"
┌ Outlook, next 90 days (full width) ───────────────────────────────────────────────────────┐
│ SVG step chart 280 px: projected cash, dashed floor line, income ▲ / essential ■ / discretionary ● markers, hatched below-floor region, first breach date label │
│ caption: starts $… · lowest $… on … · ends $… · "spread evenly per day; no interest or taxes" · [Show as table] (reveals the existing dated table, sticky head) │
│ "Weeks where essential payments cluster" disclosure (collisions)                                       │
└───────────────────────────────────────────────────────────────────────────────────────────┘
Two columns: Income streams (rows: name, kind·cadence chip, data-state chip, observed months pills, reliability, next expected; Edit) │ Recurring commitments (DataTable: Item · Next due · Amount · state · Edit; sorted by due date)
Cash accounts (rows with balance, as-of, revision, data state; Edit) · [Add …] disclosures at the end of each section
```
**Mobile 390:** stats stacked (3 compact tiles), chart 200 px with the table toggle, income streams as cards, commitments table reflows to stacked rows (Item / Next due / Amount), add/edit forms single column (fix fixed `grid-cols-3`).

---

## B4 · Savings & debt (`/demo/personal/savings-debt`)

Desktop: stats (Liquid cash ⌁ · Gap to buffer target ⌁ · Total debt ⌁); two columns: Cash accounts (balance update as an inline disclosure form, revision history link) │ Your guardrails (cash floor, buffer target, extra debt payment; "these are your choices, not rules"); Liabilities DataTable (Liability · Balance · APR · Minimum · Rate type chip with promo expiry text · State · Edit) with the footnote "No consolidation, refinancing or balance-transfer products are recommended here" kept adjacent to the table. Mobile: stacked rows per liability (Balance / APR / Minimum / Rate / State), guardrails single column.

---

## B5 · Scenarios (`/demo/personal/scenarios`)

**Desktop 1440**
```
PageHeader: MY PLAN · "Compare paths on identical inputs" · lead · meta
Section A — Debt payoff paths
 left (1fr): Scenario input (extra monthly payment; hint shows low-month margin) · liquidity guard KeyValue (floor respected: yes / NO chip)
 right (2fr): Comparison DataTable (Path · Months · Total interest ⌁ · Interest avoided ⌁ · First paid off) — infeasible rows get a blocked chip and never success styling; Assumptions · Flags · Limitations (from receipt) · run id · receipt ✓
Section B — What if…
 left: WhatIfForm (kind selector reveals only its fields; disabled reason states the real cause: owner vs no baseline)
 right: Result card (Figure · Baseline ⌁ · Scenario ⌁ · Change ⌁; interruption KeyValue; goal changes; new flags; cleared flags; limitations; run id)
Section C — Not yet available (status list: PLAN-001 retirement scenarios · recurring-charge detection PERS-002b · assistant can propose, never run)
```
Mobile: sections stacked; comparison table reflows to one card per path (Months / Total interest / Avoided / First paid off); result table stays a 4-column table inside a scroll region (numbers side by side matter) with a "Show as list" toggle.

---

## B6 · SageSpan Assistant (`/demo/personal/assistant`)

Desktop: PageHeader "Understand my finances" with the permanent chip **SageSpan Assistant · demonstration · deterministic offline mock**; left (1fr): the single action button, then the `AiReviewPanel` (summary, finding cards with evidence-status chips, citations `<dl>`, feedback group, questions, limitations, validator log); right (300 px): "What it can do" / "What it cannot do" / Provider notice (slate). Empty state: "No draft yet" with the button; disabled state names the cause ("A baseline is needed first"). Mobile: single column; the two "can / cannot" lists collapse into one disclosure under the button; finding cards full width; feedback group wraps to two rows.

---

## B7 · Retirement Studio readiness (`/demo/personal/retirement`)

Desktop: PageHeader "Retirement Studio · readiness gate" with status chip **Projection engine: Proposed (PLAN-001)**; slate notice "No projection in this build … nothing on this page predicts anything"; left: Readiness list (8 inputs, value + data-state chip, "x known · y assumed or stale · z missing"), gate sentence; right: Update intake form (two columns on desktop, one on mobile), "target age is an assumption" checkbox, SS source select; bottom: "What the Studio will do, in order" (4 gated steps with Gated chips) and a **non-interactive** placeholder region titled "Base case and scenarios (after PLAN-001 validation)" showing only the status and the list of what will appear (age/time horizon chart, annual ledger, A/B scenario cards with identical assumption basis, real vs nominal dollars, omissions card, source citations). Mobile: same order, single column.

---

## B8 · Firm review queue (`/demo/app/reviews`)

**Desktop 1440**
```
┌ Synthetic banner ────────────────────────────────────────────────────────────────────────────┐
├ Rail 256 (grouped, active state) ┬ Top bar: breadcrumb "Review queue" · Simulated reviewer: [Priya Raman · ANALYST ▾] ┤
│ WORK                             │ PageHeader: H1 Review queue · lead · counters row (true state): 3 households · 1 blocked · 0 pending · 2 reviewed │
│  • Review queue  ◀ active        │ Filters: [All 3] [Blocked 1] [Pending 0] [Reviewed 2] · Assignee [Anyone ▾] [Apply] · Sort: last update ▾ · Search (client-side text filter on the rendered rows only) │
│  • Clients & households          │ DataTable (caption "Households with an active assurance record, as of …"):                                   │
│ EVIDENCE & CHECKS                │ Household ▸ | Source tool | Status chip | Exceptions (n conflicts · n discrepancies) | Coverage (latest: 1/1 PASS · outside scope · not run) | Assignee | Tax year | Age (days since update) | Last update │
│  • Imports & evidence            │ row click → household overview; keyboard: row is a link in column 1                                                 │
│  • Checks                        │ Empty: "No households match this filter." + reset filters                                                           │
│  • AI plan review                │                                                                                                                      │
│ DECISIONS · Reviews & approvals  │                                                                                                                      │
│ STUDIO · Planning studio (status)│                                                                                                                      │
│ FIRM · Firm settings             │                                                                                                                      │
```
Mobile 390: top strip with active state and "More"; filters as a horizontal chip row; table inside a labelled scroll region with edge fade, first column sticky. Note: "Coverage" and "Age" columns read stored fields (`coverageSummary` of the current snapshot; `updated_at`); no new computation of money.

---

## B9 · Household workspace: Checks (`/demo/app/households/[id]/checks`)

**Desktop 1440**
```
Breadcrumb · H1 Patel household · [Check complete] · meta (tax year · revision · assignee · source)
Stepper: ✓ Imported — ✓ Reconciled — ✓ Frozen — ✓ Checked — 5 Reviewed — 6 Approved / exported
Tabs: Overview · Imports · Checks ◀ · AI review (draft) · Review · Evidence
Stage header: "Stage 2 · Diagnose — independent check" · status sentence · Next permitted action for ANALYST: "Send to review"
┌ Snapshot & actions (1fr) ─────────────────────────────┐ ┌ Calculation service (360) ──────────────┐
│ KeyValue: snapshot · revision · content SHA · frozen by │ │ neutral notice: "Reachable · engine 0.1.0 │
│ · facts · rule sets                                    │ │ · demo mode" (not teal) / blocked notice  │
│ [Re-run independent RMD check] [Send to review]        │ │ when unreachable with retry               │
└────────────────────────────────────────────────────────┘ └──────────────────────────────────────────┘
Coverage on this snapshot: CoverageTable (Account · Latest attempt · Coverage chip · Earlier attempts) + OutcomeNotice ("If approved now: Approved with exceptions" / "Approval blocked: … · next: re-run")
Check runs (latest first): CheckRunCard — header (account · owner · run id · time · engine · chips: Arithmetic PASS · supported · internal tests · receipt verified)
  left: Independent result $25,098.04 ⌁ (stat-dense) · eligibility KeyValue · unsupported reasons (amber list) · obligation events table
  right: Comparison with imported plan value (engine · imported ⌁ · difference · tolerance) · classification chip · explanation · next step · disposition
  disclosures: Limitations stated by the engine · Request sent (JSON, from the frozen snapshot only)
Earlier attempts: history style (dashed, "earlier attempt — kept as history, not evaluated for approval")
```
Mobile 390: stage header first, actions full width, coverage table scrolls, CheckRunCard columns stack (result, then comparison), JSON disclosure scrolls horizontally.

---

## B10 · Household workspace: Review and approval (`/demo/app/households/[id]/review`)

**Desktop 1440**
```
Stage header: "Stage 4 · Review & decide" · status (REVIEW_PENDING / REVIEWED / APPROVED) · next permitted action for the current role
Left (1fr)                                                     │ Right (380)
Conflicts — per conflict: materiality chip · status chip ·      │ What approval would mean — CoverageTable + OutcomeNotice
field · subject · reason; two fact tiles (value ⌁, source,     │ Review and approval — policy line (slate) · Record review form
as-of, status chip); Resolve form (radio legend "Governing      │ · divider · Approve form (rationale, attestation checkbox with
fact", rationale) · Document exception form (nonmaterial only) │ the full text, button "Approve (professional act)") · disabled
Discrepancies — classification chip · status · computed /      │ reason as text (role / status / readiness / open dispositions /
imported / difference (engine fields) · explanation · next step │ separation of duties) · "Demo: simulated reviewer" note
· Record disposition form                                       │ Review history — decision chip + OutcomeChip + name · role ·
Comments — list + Add comment                                   │ time · rationale · attestation line
```
After approval the OutcomeNotice becomes "Approved: Reviewed with limitations — by Dana Whitfield (COMPLIANCE) on …" in the outcome's tone (teal only for SUPPORTED_CHECK_VERIFIED) and the next permitted action is "Generate evidence packet". Mobile: right column moves **above** conflicts (the approver needs the outcome first), forms full width, attestation label wraps.

---

## B11 · Evidence (`/demo/app/households/[id]/evidence`)

Desktop: stage header "Stage 5 · Monitor — evidence packet"; left: packet preview KeyValue (title derived from coverage, outcome, scope accounts verified / outside scope, snapshot, engine, audit chain chip "intact · n events", policy at freeze), "Not checked" and "Limitations" lists (h3), Export log DataTable (packet id · generated · by · SHA-256 (short + copy) · formats JSON / HTML / CSV); right: Generate packet (disabled until APPROVED, reason shown), "Latest packet" status notice, "Wording" notice ("not an exam certification …"). HTML export page itself: same tokens, print stylesheet, coverage outcome block first, synthetic banner, tables with captions (coordinate with the domain owner; see design system §3.15). Mobile: single column, export log scrolls.

---

## B12 · Sign-in and workspace chooser (PR #10 surfaces; UI restyles only after merge)

```
/app/sign-in (centred, max-w-md)                 /app (ProductionHome, max-w-3xl)
┌ [■ SageSpan] Production workspace ┐            PageHeader: "Signed in as …" · [Sign out]
│ H1 Sign in to SageSpan            │            amber notice: production workflows not available (DATA-001) · links to demos
│ E-mail · Password · [Sign in]     │            Firm memberships — rows: firm · role chip · selected chip · [Select]
│ error notice (role=alert)         │            Your workspaces — rows: label · kind · role · domains · selected · [Select]
│ "Accounts are created by an admin"│            Shared with you by consent — rows: label · kind · domains (read-only badge)
└───────────────────────────────────┘            "How this screen was built" KeyValue
```
No synthetic banner on these screens (nothing synthetic is shown). Later (UI-003, post-merge): the same three lists become the rail-footer `WorkspaceSwitcher`.

---

## B13 · Privacy & sharing (`/demo/personal/privacy`) — consent grants (model exists; controls Proposed)

Desktop: PageHeader "Who can see what"; This workspace KeyValue (connections: none; AI provider: offline mock); Members table (person · role · domains · status); **Grants to advisors or firms** — today an empty state; blueprint for PR-003: rows `grantee · purpose · domains (chips) · expires · status (ACTIVE / EXPIRED / REVOKED) · [Revoke]` with a confirm dialog, plus "Share with an advisor" as a **disabled** button labelled "Proposed (PR-003)" until the server action exists; Notifications (quiet mode); Export / correction / deletion notice (not live). Mobile: single column; grant rows stack.
