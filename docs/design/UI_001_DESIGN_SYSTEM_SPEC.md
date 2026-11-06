# SageSpan design system specification (UI-001 target)

**Document:** `docs/design/UI_001_DESIGN_SYSTEM_SPEC.md` · **Version:** 1.0 · **Date:** 2026-11-06
**Session:** UI-000 (design audit and architecture; documentation only, no application code changed)
**Baseline audited:** `master` @ `5299791` plus this branch; reconciled against open PR #10 (`feat/pr-003-identity`) and PR #11 (`claude/brave-gates-2b1262`).
**Related:** [UI_000_DESIGN_AUDIT.md](UI_000_DESIGN_AUDIT.md) · [UI_000_INFORMATION_ARCHITECTURE.md](UI_000_INFORMATION_ARCHITECTURE.md) · [UI_001_PAGE_BLUEPRINTS.md](UI_001_PAGE_BLUEPRINTS.md) · [UI_000_ACCESSIBILITY_PLAN.md](UI_000_ACCESSIBILITY_PLAN.md) · [UI_000_IMPLEMENTATION_ROADMAP.md](UI_000_IMPLEMENTATION_ROADMAP.md)

> This specification refines the token scheme that already exists in `apps/web/src/app/globals.css` (Tailwind v4 `@theme`) and the primitives in `apps/web/src/ui/primitives.tsx`. It does not replace them with a new library. Nothing here changes a financial figure, a status derivation, a permission or a workflow: the system only decides how server-provided values are presented.

---

## 0. Design principles (binding for every UI phase)

1. **Boundaries are the product.** The visual system must make four things unmistakably different at a glance and to a screen reader: an *observed input* (what someone reported or a document shows), a *deterministic calculation* (receipted engine output), an *explanation or draft* (AI, policy rationale) and a *human decision* (approval, acceptance, disposition). One tone, one icon family and one label vocabulary per category (section 8).
2. **Calm for individuals, precise for professionals, one brand.** The Personal workspace uses comfortable density, plain sentences and at most three calls to action per screen. The console uses compact density, dense tables and task-first navigation. Both use the same tokens, type and components; only density, copy and navigation differ.
3. **Honesty beats polish.** Every number has a receipt one interaction away. Every missing engine, mock provider, synthetic dataset or proposed capability is labelled in place, never in a footer alone. Success colour is reserved for stated successful acts.
4. **Fewer cards, better structure.** Prefer grouped sections, definition lists and tables to card grids. A card is for a bounded object (a recommendation, a check run, a finding), not a layout device.
5. **No colour-only meaning, no motion theatre, no invented figures.** Status is always text + icon + colour. Motion is 120–240 ms feedback only. The web tier never computes, rounds or extrapolates money.

---

## 1. Token architecture

Three layers, all expressed as CSS custom properties in `globals.css` `@theme` so Tailwind v4 generates the utilities (`bg-canvas`, `text-ink-muted`, `text-body`, …):

| Layer | Purpose | Example |
|---|---|---|
| **Primitive** | Raw palette, type scale, spacing, radius, shadow, motion | `--color-teal-700`, `--text-body`, `--radius-card` |
| **Semantic** | Meaning, independent of hue | `--color-status-verified-fg`, `--color-link`, `--color-focus` |
| **Component** | Only where a component needs a dedicated hook | `--shell-rail-width`, `--card-padding` (density-driven) |

Rules: no hex literals in TSX (today: none, keep it so); no arbitrary `text-[11px]`/`tracking-[0.14em]` once the scale tokens exist (today: 13 occurrences, see audit §4.3); semantic tokens are the only ones components may reference for *meaning*; primitives may be used for decoration.

### 1.1 Colour primitives (current → proposed)

All ratios below were computed with the WCAG 2.x relative-luminance formula for this document (script in the UI-000 session). "AA text" = ≥ 4.5:1; "AA large / UI" = ≥ 3:1.

| Token | Current | Proposed | Why |
|---|---|---|---|
| `--color-canvas` | `#F5F7FA` | keep | Warm-cool neutral page background |
| `--color-surface` | `#FFFFFF` | keep | Cards, rails, tables |
| `--color-surface-muted` | `#EEF2F6` | keep | Table heads, insets, chips (neutral) |
| `--color-surface-sunken` | — | **new `#E9EEF4`** | Inset wells (receipt dialog rows, request JSON) so they read as a different plane without a shadow |
| `--color-ink` | `#0B1F3A` | keep | 15.4:1 on canvas |
| `--color-ink-muted` | `#4A5B73` | keep | 6.9:1 on surface, 6.5:1 on canvas, 6.2:1 on surface-muted |
| `--color-ink-faint` | `#7B8A9E` | **`#5B6C86`** | Current fails AA for text (3.5:1 on white, 3.3 on canvas, 3.1 on surface-muted) yet is used for 11 px hashes, "rev 1", "none", sub-brand labels. Proposed: 5.3 / 5.0 / 4.7 |
| `--color-ink-ghost` | — | **new `#9AA7B8`** | Decorative only: dividers, disabled glyphs, placeholder *icons*. Never text |
| `--color-line` | `#D9E0E8` | keep | Decorative borders (1.3:1 is fine for non-essential separators) |
| `--color-line-strong` | `#B9C4D1` | keep | Secondary button borders, dashed empty states |
| `--color-line-input` | — | **new `#7F8EA3`** | Input/select/textarea boundary: 3.3:1 on white, 3.1:1 on canvas (WCAG 1.4.11). Current inputs use `line-strong` at 1.8:1 |
| `--color-navy` / `-700` / `-100` | `#0B1F3A` / `#13305A` / `#E3E9F2` | keep | Primary button, approved-with-exceptions, brand tile |
| `--color-navy-500` | — | **new `#1F4A80`** | Link and interactive text colour (8.9:1 on white). Today links use `navy` which is identical to body `ink`, so links are only discoverable on hover |
| `--color-navy-50` | — | **new `#F0F4F9`** | Selected row / active nav wash (console) |
| `--color-teal` / `-700` / `-100` | `#0E7C72` / `#0A5F58` / `#DDF2EF` | keep | Accent, verified, focus. `teal` text on canvas 4.7:1 (AA), on white 5.1:1; `teal-700` on `teal-100` 6.5:1 |
| `--color-teal-50` | — | **new `#EEF9F7`** | Active nav wash (personal), "In your numbers" wells |
| `--color-amber` / `-700` / `-100` | `#B45309` / `#92400E` / `#FDEBD3` | keep | Limitation / caution. `amber-700` on `amber-100` 6.1:1 |
| `--color-slate` / `-700` / `-100` | `#4F6D9A` / `#3B5478` / `#E6EDF7` | keep | Assumed / draft / informational |
| `--color-conflict` / `-700` / `-100` | `#B42318` / `#8F1D13` / `#FBE4E1` | keep (alias `--color-red-*` optional) | Blocked / error / conflict. `conflict-700` on `conflict-100` 7.4:1 |

### 1.2 Semantic colour tokens (new; map once, use everywhere)

| Semantic token | Value | Used for |
|---|---|---|
| `--color-link` / `--color-link-hover` | `navy-500` / `navy-700` | Inline links, "Open receipt" triggers, breadcrumb hover |
| `--color-focus` | `teal` | 2 px outline, 2 px offset, plus `box-shadow: 0 0 0 2px var(--color-surface)` halo so the ring passes 3:1 on teal/amber/navy surfaces |
| `--color-selection` | `navy-50` | Active rail item (console), selected table row |
| `--color-status-verified-fg/bg/line` | `teal-700` / `teal-100` / `teal/30` | Arithmetic PASS, receipt verified, SUPPORTED_CHECK_VERIFIED, EVIDENCE_VERIFIED, TOOL_BACKED, DONE |
| `--color-status-limitation-fg/bg/line` | `amber-700` / `amber-100` / `amber/30` | UNSUPPORTED, INDETERMINATE, REVIEWED_WITH_LIMITATIONS, STALE, NEEDS_CONFIRMATION, MEDIUM severity, "proposed / not implemented" |
| `--color-status-blocked-fg/bg/line` | `conflict-700` / `conflict-100` / `conflict/30` | ERROR, BLOCKED, FACT_CONFLICT, CONFLICTING, MISSING (required), HIGH severity, receipt mismatch, chain broken |
| `--color-status-assumed-fg/bg` | `slate-700` / `slate-100` | FACT_ASSUMED, ASSUMED, HYPOTHESIS, LOW severity, informational notices |
| `--color-status-neutral-fg/bg` | `ink-muted` / `surface-muted` | USER_REPORTED, NOT_RUN, not approved, draft chips without evidence status |
| `--color-status-exceptions-fg/bg` | `navy-700` / `navy-100` | APPROVED_WITH_EXCEPTIONS only |
| `--color-status-history-fg` | `ink-faint` + dashed `line-strong` border | Superseded attempts, superseded facts, earlier drafts (never opacity alone: today `opacity-70` is the only cue) |
| `--color-synthetic-fg/bg` | `amber-700` / `amber-100` | The persistent synthetic banner and "demo" markers |

Dark mode is **deferred** (brief: "support a high-quality dark mode later if proven valuable"). The semantic layer is what makes it cheap later; do not add `dark:` utilities in UI-001–UI-003.

### 1.3 Typography tokens

Fonts stay: **Schibsted Grotesk** (headings), **Public Sans** (body), **JetBrains Mono** (hashes, ids, formulas). Note for UI-001: `--font-mono` names JetBrains Mono but the root layout never loads it, so monospace falls back to `ui-monospace`; either add `JetBrains+Mono:wght@400;500` to the existing Google Fonts link (preferred, same provider, system fallback retained) or rename the token to the system stack. Fonts stay as a `<link>` per `docs/DECISIONS.md` ("build must not depend on network availability").

Define the scale as Tailwind v4 `--text-*` tokens so utilities read `text-h1`, `text-body`, `text-support`:

| Token | Size / line | Weight · tracking | Use |
|---|---|---|---|
| `--text-display` | 44 / 48 (md: 52 / 56) | 700 · −0.02em · heading font | Marketing hero only |
| `--text-h1` | 28 / 34 | 700 · −0.015em · heading | Page title (app). Today `text-2xl` (24) competes with stat numbers |
| `--text-h2` | 20 / 28 | 600 · −0.01em · heading | Section / card group title. Today Card titles are 16 px semibold and read as body |
| `--text-h3` | 16 / 24 | 600 · heading | Card title inside a section, finding title |
| `--text-eyebrow` | 12 / 16 | 600 · +0.08em · uppercase · body | Replaces ad-hoc `tracking-[0.14em]` (13 places) |
| `--text-body` | 15 / 24 | 400 · body | Consumer body text |
| `--text-body-dense` | 14 / 20 | 400 · body | Console body, table cells |
| `--text-support` | 13 / 18 | 400 · body | Hints, subtitles, secondary cells |
| `--text-caption` | 12 / 16 | 500 · body | **Floor.** Chips, table heads, timestamps. Nothing below 12 px; today there are 10 px and 11 px strings (audit §4.3) |
| `--text-stat` | 28 / 32 | 700 · tabular · body | Consumer stat tiles (today `text-2xl` bold) |
| `--text-stat-dense` | 22 / 28 | 700 · tabular · body | Console amounts in cards |
| `--text-mono` | 12.5 / 18 | 400 · mono | Hashes, ids, formulas; always with full value available (title + copy affordance in UI-003) |

Rules: `font-variant-numeric: tabular-nums` on every money and count cell (`.tabular` utility exists; apply via the `Money`, `Stat`, `Td align="right"` components rather than ad hoc). Money strings come only from `formatMoney` / `formatUsd` in `@sagespan/contracts`. Use a true minus sign (U+2212) when the engine returns a negative string: presentation-only substitution in `formatMoney` consumers, not arithmetic.

### 1.4 Spacing, layout and density

* **Grid:** 4 px base, 8 px rhythm. Scale: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64.
* **Containers:** marketing `max-w-6xl` (1152 px); Personal 1280 px; console 1440 px (keep). Reading columns: `max-w-2xl` (672 px) for lead paragraphs.
* **Rails:** Personal left rail 240 px (keep `w-60`), console 256 px (keep `w-64`); both pinned (`sticky top-0 h-screen`) on ≥ md. Mobile: Personal gets a 4-item bottom navigation (section 7.14); console keeps a horizontal top strip but with active state and grouped overflow.
* **Gutters:** 16 px (< md), 24 px (md), 32 px (≥ lg). Today 16/32.
* **Density attribute:** the shell root sets `data-density="comfortable"` (Personal, marketing) or `"compact"` (console). Component tokens read it:

| Component token | comfortable | compact |
|---|---|---|
| `--card-padding` | 20 px | 16 px |
| `--row-padding-y` | 12 px | 8 px |
| `--stack-gap` | 24 px | 16 px |
| `--text-body-current` | `--text-body` | `--text-body-dense` |

Implemented as a `@custom-variant` or simple attribute selectors on `:root`/shell; no runtime JS.

### 1.5 Radius

| Token | Value | Use |
|---|---|---|
| `--radius-xs` | 4 px | Checkbox, inline code |
| `--radius-sm` | 6 px | Inputs, chips (when not pill), mono wells |
| `--radius-md` | 10 px | Buttons, alerts, list rows |
| `--radius-card` | 14 px (`0.875rem`, keep) | Cards, stat tiles |
| `--radius-lg` | 20 px | Dialog |
| `--radius-pill` | 9999 px | Status chips, filter pills, nav pills |

### 1.6 Elevation

| Level | Token | Use |
|---|---|---|
| 0 | none, 1 px `line` border | Console tables, rail, header; most of the console |
| 1 | `--shadow-card` (keep) | Consumer cards, stat tiles, marketing panels |
| 2 | `--shadow-raised` **new** `0 4px 14px -6px rgb(11 31 58 / .18)` | Menus, popovers, sticky bottom nav |
| 3 | `--shadow-pop` (keep) | Dialogs |

Rule: never stack level 1 inside level 1 (card in card). Use a `Section` (border-top or heading) inside a card instead.

### 1.7 Motion

| Token | Value | Use |
|---|---|---|
| `--motion-fast` | 120 ms, `cubic-bezier(.2,.8,.2,1)` | Hover/focus colour, chip toggles |
| `--motion-base` | 180 ms | Disclosure open, tab underline, nav highlight |
| `--motion-slow` | 240 ms | Dialog enter (opacity + 4 px translate), bottom sheet |

`@media (prefers-reduced-motion: reduce)`: all three → 1 ms; `html { scroll-behavior: auto }` (today `smooth` is unconditional); the `Loader2 animate-spin` pending icon becomes a static icon with the text label ("Calling calculation service…" already exists). No count-up numbers, no chart draw-in animation, ever.

### 1.8 Iconography

Lucide only (already a dependency). Sizes: 14 in chips, 16 in nav and buttons, 18 for section markers, 22 for marketing panel icons. **One icon, one meaning:**

| Icon | Meaning | Must not be used for |
|---|---|---|
| `CheckCircle2` | Verified / PASS / done by a human | Decorative success, "live", "working" |
| `ShieldCheck` | Brand tile; security design pages | Approval outcome |
| `Lock` | Frozen snapshot; sign-in | Privacy marketing |
| `AlertTriangle` | Limitation / caution (UNSUPPORTED, conflict materiality) | Errors (use `XCircle`) |
| `XCircle` | ERROR / rejected / mismatch | Dismiss buttons (use `X`) |
| `CircleHelp` | INDETERMINATE / MISSING / needs confirmation | Help links (use `Info`) |
| `Clock3` | STALE / as-of age | Timestamps in general |
| `PencilLine` | USER_REPORTED / edit | — |
| `FlaskConical` | Synthetic data marker | — |
| `Bot` | AI draft | Anything approved |
| `Receipt` | Receipt trigger | — |
| `Stamp` | Human approval act | PASS |
| `Scale` | Policy / constraints | — |

**Brand mark:** today the public site and console use a navy `ShieldCheck` tile and the Personal workspace a teal `Leaf` tile, which reads as two brands. UI-001 unifies on one mark for all three surfaces (navy tile, `ShieldCheck` as the interim glyph) with the pillar named in text ("Personal", "Advisor & Assurance"); a purpose-designed mark is a founder/brand decision outside this plan (brand is provisional).

---

## 2. Component inventory and states

Legend — **Exists**: in `apps/web/src/ui/**` today; **Extend**: keep API, add props/states; **New**: UI-001 unless noted. "Owner" is the UI phase that may touch the file (see roadmap §file ownership).

| # | Component | File (current / proposed) | Status | Required states |
|---|---|---|---|---|
| 1 | `Button` / `ButtonLink` / `buttonClasses` | `ui/primitives.tsx` | Extend | default, hover, focus-visible, active, disabled + reason (tooltip and visible text), pending (static icon + label), destructive confirm |
| 2 | `Chip` + typed chips (`FactStatusChip`, `WorkflowChip`, `ResultChip`, `ClassificationChip`, `DataStateChip`, `SeverityChip`, `OutcomeChip`) | `ui/primitives.tsx`, `ui/personal/components.tsx`, `ui/console/CoveragePanel.tsx` → consolidate into `ui/status/*.tsx` | Extend | each enum value (section 8); `history` style; description via visible text or accessible tooltip (not `title` only) |
| 3 | `Alert` → `Notice` | `ui/primitives.tsx` | Extend | info (slate), limitation (amber), blocked (conflict, `role=alert`), verified (teal, `role=status`), synthetic (amber, `role=note`); optional action slot; dismiss only for non-critical |
| 4 | `Card` → `Card` + `Section` | `ui/primitives.tsx` | Extend | `headingLevel` prop (2–4), `density`, `tone` border, optional footer; `Section` = heading + divider without elevation |
| 5 | `PageHeader` | **new** `ui/PageHeader.tsx` | New | eyebrow, h1, lead, actions slot, meta row (as-of · snapshot · method); replaces 20 hand-written header blocks |
| 6 | `Stat` | `ui/personal/components.tsx` | Extend | value with receipt, hint, tone + **text label for the tone** ("below floor"), loading skeleton, "—" empty with reason |
| 7 | `Money` / `ReceiptButton` | `ui/personal/components.tsx`, `ui/ReceiptDialog.tsx` | Extend | verified receipt, unverified receipt (conflict), no-run (plain text, no trigger), copy-hash affordance, keyboard-openable (already a button) |
| 8 | `ReceiptDialog` | `ui/ReceiptDialog.tsx` | Extend | sections, long hash wrap, "Limitations" always last, close restores focus (native), reduced-motion |
| 9 | `DataTable` | **new** `ui/DataTable.tsx` | New | `<caption>`/aria-label, `scope="col"`, sticky head, right-aligned tabular money, row link, sortable header (server-driven via URL), responsive: horizontal scroll wrapper with edge fade + "scroll for more" sr text; 13 tables today lack the wrapper |
| 10 | `KeyValue` | `ui/primitives.tsx` | Extend | stacked on < sm (today fixed `max-content 1fr`), mono values, truncation with full value |
| 11 | `EmptyState` | `ui/primitives.tsx` | Extend | title, explanation, primary action, "why it is empty" (no data / filtered / not yet computed / not available in this build) |
| 12 | `Skeleton` | **new** `ui/Skeleton.tsx` | New | stat, row, card shapes; used by `loading.tsx` files (App Router) so navigation never shows a blank canvas |
| 13 | `ServiceState` | **new** `ui/ServiceState.tsx` | New | calculation service unreachable (conflict, retry action), AI provider offline (slate), production store not wired (amber); one component, one copy source |
| 14 | `Field` / inputs | `ui/primitives.tsx` | Extend | label, hint, required mark with text, **error state** (`aria-invalid`, `aria-describedby`, inline message), `line-input` border, money input affordance ("USD" prefix, `inputMode=decimal`), date input |
| 15 | `ActionForm` | `ui/ActionForm.tsx` | Extend | pending, success (`role=status`), failure (`role=alert`) with code and recovery text, disabled with reason, field-level errors when the server returns a field path |
| 16 | `Checkpoints` → `Stepper` | `ui/console/Checkpoints.tsx` | Extend | reached / current / blocked / not reached, with `aria-current="step"`, 12 px floor text |
| 17 | `Tabs` (`HouseholdTabs`) | `ui/console/HouseholdTabs.tsx` | Extend | `aria-current`, counts, overflow scroll with edge fade |
| 18 | `SideRail` + `RailGroup` | **new** `ui/shell/SideRail.tsx` | New | grouped items, active state (console lacks one), collapsed labels on lg, pinned footer slot |
| 19 | `BottomNav` | **new** `ui/shell/BottomNav.tsx` | New (Personal) | 4 destinations + "More" sheet listing every route; `aria-current`; safe-area padding |
| 20 | `TopBar` / `AsOfBar` | **new** `ui/shell/TopBar.tsx` | New | workspace name, as-of date, data completeness, last recompute, recompute action, user/persona menu |
| 21 | `SyntheticBanner` | **new** `ui/shell/SyntheticBanner.tsx` | New | shared by both shells (today duplicated); `role="note"`, not `role="status"` |
| 22 | `BrandLockup` | **new** `ui/shell/BrandLockup.tsx` | New | one mark, pillar label, "provisional" marker |
| 23 | `PersonaSwitcher` (demo) | `ui/console/PersonaSwitcher.tsx` | Keep | demo-only; visually marked "Simulated reviewer" |
| 24 | `WorkspaceSwitcher` | **new** `ui/shell/WorkspaceSwitcher.tsx` (UI-003, after PR #10 merges) | New | lists what `ProductionHome` lists today (firms, workspaces, shared-with-you); select = server action; demo mode shows persona switchers instead |
| 25 | `ConsentGrantRow` | **new** `ui/privacy/ConsentGrantRow.tsx` (UI-002 spec, UI-003 build after PR #10) | New | grantee, domains, purpose, expiry, status (ACTIVE / EXPIRED / REVOKED), revoke action with confirm |
| 26 | `DecisionCard` | `ui/personal/DecisionCard.tsx` | Extend | compact (overview) vs full; priority tone with text; suggested action in **neutral** well (not teal); feedback buttons as a single segmented group with one primary; settled state with text, not opacity alone |
| 27 | `FindingCard` (AI) | `ui/ai/AiReviewPanel.tsx` | Extend | evidence status chip vocabulary (section 8.9); citations as a definition list; feedback group; dismissed state with text |
| 28 | `CoverageTable` + `OutcomeNotice` | `ui/console/CoveragePanel.tsx` | Extend | per-account coverage rows; "if approved now" vs "approved" notice; blocked notice with the exact next permitted action |
| 29 | `CheckRunCard` | `ui/console/CheckRunCard.tsx` | Extend | PASS / NOT_REQUIRED / UNSUPPORTED / INDETERMINATE / ERROR layouts; "earlier attempt" history style; receipt verified / mismatch |
| 30 | `FreezeGatePanel` | `ui/console/FreezeGatePanel.tsx` | Extend | ready / blocked (n) / role-denied, each with the next permitted action |
| 31 | `OutlookChart` | **new** `ui/personal/OutlookChart.tsx` (UI-002) | New | inline SVG from receipted points; floor line; bill/income markers; alt table toggle; no bands |
| 32 | `EvidencePacket` HTML theme | `apps/web/src/domain/evidence.ts` (**not UI-owned**; propose a stylesheet string constant moved to `ui/evidence/packetStyles.ts` only with the domain owner's agreement) | Coordinate | print stylesheet, same tokens as the app, coverage block first |

---

## 3. Component specifications (key components)

### 3.1 Button
* Variants: `primary` (navy), `secondary` (surface + `line-strong`), `ghost` (link colour), `danger` (conflict). Sizes 32 / 36 / 44 px tall (`sm` / `md` / `lg`); touch targets ≥ 44 px on < md via `min-h`.
* Disabled: 50 % opacity **and** the reason as visible text next to the button (exists in `ActionForm`); keep `title` as a secondary hint only.
* Pending: label changes to the `pendingLabel`, icon static (no spin under reduced motion), `aria-disabled`, form stays in DOM.
* Destructive (retire a record, reset demo): native `<dialog>` confirmation with the object named; today `RecordForms` retire has no confirmation and `ResetDemoButton` uses `window.confirm`.

### 3.2 Status chip (`Chip` family)
* Anatomy: 14 px icon + label, 12 px/16 px caption weight 600, pill radius, 1 px border at 30 % of the tone, background at the `-100` tint.
* Every typed chip takes its label from `@sagespan/contracts` label maps; **no inline ternaries in pages** (audit lists 9 ad-hoc chips).
* Description: when a chip carries a definition (review outcome), render a visible `Info` disclosure or an accessible tooltip component (focusable, `aria-describedby`); `title` attributes are not accessible on touch or to most screen readers.
* History style: dashed border + `ink-faint` text + the word "earlier" in the label; never opacity alone.

### 3.3 Notice (today `Alert`)
* Tones map to semantic status tokens. `role="alert"` only for blocked/error; `role="status"` for success confirmations that appear after an action; `role="note"` for persistent informational banners (synthetic, provider, policy).
* Body text 13 px → use `--text-support`; never below 12 px.
* Optional `actions` slot (e.g., "Recompute", "Open conflict").

### 3.4 Card and Section
* `Card` keeps `rounded-card border bg-surface shadow-card` but gains `headingLevel` (default 2) so pages can keep a correct outline (today every Card title is an h2, so `/firms` and `/security` have sibling h2s at two hierarchy levels). `Section` = `<section>` with a heading row and no elevation, for grouping inside cards or on the canvas.
* Padding from `--card-padding` (density). Header row: title (h2/h3), subtitle (`--text-support`), actions.

### 3.5 PageHeader
* Eyebrow (pillar or section), h1 (`--text-h1`), lead (`--text-body`, max 60ch), actions (≤ 2), meta row (`--text-caption`): "As of 2026-11-06 · snapshot snap_… · method personal.cashflow_baseline@2026.1 · receipt verified". Replaces the identical blocks in 12 Personal pages and 8 console pages.

### 3.6 Stat (consumer) and amount display (console)
* Label (`--text-eyebrow`), value (`--text-stat`, tabular, receipt trigger), hint (`--text-support`), tone: coloured left rule 3 px + a textual qualifier ("below your floor", "gap to target"), not a coloured border alone.
* Loading: skeleton with the label visible. Empty: "—" plus the reason ("needs the calculation service", "no target set").
* Console amounts: `--text-stat-dense` inside `CheckRunCard`, same receipt trigger.

### 3.7 Money / ReceiptButton / ReceiptDialog
* Trigger: `<button>` styled as text with a dotted underline (keep), link colour (`--color-link`), `Receipt` icon 13 px, accessible name = the amount (tests rely on it: `getByRole("button", { name: "$3,650.00" })`).
* Dialog: title = figure name, subtitle = "Where this number comes from", rows in a `<dl>`; sections "Inputs", "Method / rule sets", "Integrity" (request SHA-256, run hash, "re-derived here: yes/no"), "Limitations". Hashes wrap (`break-all`) with a "Copy" button (UI-003). Close returns focus to the trigger (native `<dialog>` behaviour; keep).
* Unverified receipt (`request_hash_verified === false`): trigger gets the blocked tone and the dialog opens with a blocked notice first.

### 3.8 DataTable
* Wrapper: `role="region"` + `aria-label` + `tabindex=0` when it scrolls horizontally; edge fade; `min-w` tokens (`--table-min-sm: 560px`, `-md: 720px`, `-lg: 840px`).
* `<caption class="sr-only">` or visible; `<th scope="col">`; money columns `align="right"` + tabular; status columns use typed chips; row primary link in the first column; `<time dateTime>` for dates.
* Sorting and filtering stay URL-driven (server components); the header shows the active sort with text and `aria-sort`.
* Mobile: horizontal scroll is acceptable for console tables (intentional, labelled); Personal tables with ≤ 4 columns reflow to stacked rows at < sm.

### 3.9 Forms (`Field`, inputs, `ActionForm`)
* Label above, hint below, required shown as text "(required)" in addition to the asterisk. Inputs: 40 px tall, `line-input` border, focus ring token, `aria-invalid` + inline error with `aria-describedby` when the server returns a field path (the error contract already returns field paths, never values).
* Money input: `inputMode="decimal"`, "USD" prefix adornment, no client-side arithmetic; the server/contract validates.
* Remove duplicate labelling: today many inputs have both a wrapping `<label>` and an `aria-label` (announced twice); keep the visible label only.
* Responsive: no bare `grid-cols-2/3` in forms (11 occurrences in `RecordForms.tsx`); use `sm:grid-cols-*`.

### 3.10 Stepper (`Checkpoints`) and Tabs
* Stepper items: number or check, label at 12 px minimum (today 10 px), states reached / current (`aria-current="step"`) / blocked (conflict) / not reached; on mobile render as a compact "Step 3 of 6 · Frozen" with the full list in a disclosure.
* Tabs: `aria-current="page"` (exists), 44 px touch height on mobile, counts as text ("Checks · 2").

### 3.11 Navigation shells
* **SideRail** (both workspaces): brand lockup, grouped items (group label `--text-eyebrow`), 36 px rows, icon 16 px, active = `--color-selection` wash + 2 px left bar + `aria-current`. Console rail has no active state today; add it.
* **BottomNav** (Personal, < md): Home · Money · Plan · More (More = full-screen sheet with every route and the user items). 56 px + safe area. The current 11-pill horizontal strip is kept reachable inside "More" so nothing is lost.
* **TopBar / AsOfBar** (both workspaces): left = page context (breadcrumb on console), right = as-of/last recompute (Personal) or persona/workspace switcher. Sticky, 56 px, `bg-surface/90 backdrop-blur` (keep).
* **Marketing header**: 6 links + Sign In + two CTAs on ≥ md; on < md a disclosure menu button ("Menu", `aria-expanded`) replaces the horizontal scroll strip; **both** CTAs appear in the menu (today only "Explore for Firms" is visible under 640 px). Skip link as the first focusable element in the root layout.

### 3.12 DecisionCard (Personal)
* Header: priority chip (text + tone), tier chip, "Information needed" chip; settled state chip.
* Body order: title (h3), "What SageSpan sees" (observed), "Why it matters", **"Suggested action" in a neutral `surface-muted` well** (today a teal well, which uses success colour for a suggestion), impact (deterministic amount with receipt link when `source === "DETERMINISTIC_TOOL"`, otherwise descriptive text), decision authority line.
* Disclosures: "Trade-offs", "What limits this", "Before acting" collapsed by default on the Overview (compact) and open on Next steps.
* Feedback: one segmented group "Done · Snooze · Not relevant · I disagree" (secondary style; "Done" primary), each a server action; after recording, the card shows "You marked this done on 2026-11-06" in text (today `opacity-70` + chip).
* "Ask why" disclosure: ranking rationale, alternatives, what would change this, evidence refs, policy version, re-check trigger (keep content; present as a `<dl>`).

### 3.13 FindingCard (AI, both audiences)
* Permanent "AI draft" marker in the panel header (exists) with provider · model · prompt version · run time.
* Evidence status chip vocabulary (section 8.9). Citations as a `<dl>`: Facts, Sources (with locator), Calculations (run ids as receipt links), Amounts (each "← field").
* Feedback group: Accept (secondary, not primary: accepting a draft is not an approval), Edit, Dismiss, Request evidence; versioned feedback chip "accepted · v2".
* Validator log disclosure (exists): rejected items in blocked tone, notes in neutral.

### 3.14 CoverageTable and OutcomeNotice
* Table columns: Account (label + frozen classification) · Latest attempt (run id as receipt link) · Coverage (typed chip, section 8.3) · Earlier attempts (count, history style).
* Notice: "Approved: Reviewed with limitations" (verified tone only for SUPPORTED_CHECK_VERIFIED; amber for limitations; navy for exceptions) → "If approved now: …" (same tones, with "if") → "Approval blocked: … · Next permitted action: Re-run the check" (blocked tone). The approver never chooses the label (keep the copy).
* Footer line: latest-attempt rule and policy at freeze (keep), at `--text-caption`, `ink-faint` (new value).

### 3.15 Evidence packet (HTML export)
* Theme constants (fonts, ink, line, amber banner) are duplicated in `domain/evidence.ts`. Proposal (coordinate with the domain owner; not a UI-phase edit): a `packetStyles` string in `ui/evidence/` imported by `evidence.ts`, print stylesheet (`@page` margins, avoid table row breaks), coverage outcome block first (already first), and a visible "Synthetic demonstration" banner (exists). Packet title derives from coverage (exists; do not touch).

---

## 4. Charts and data visualisation (UI-002)

* **Only one chart is in scope:** the 30/60/90-day cash outlook on Cash flow and (compact) on Overview, drawn as inline SVG from `clarity.outlook.points` (receipted). No library.
* Encoding: step line for projected cash; horizontal dashed line for the user's cash floor; markers on dates with events (income up-triangle teal-700, essential bill square ink, discretionary small circle ink-muted); region below the floor hatched in conflict-100 with the first breach date labelled in text.
* Axes: dates (weekly ticks, ISO dates), USD (tabular). Title includes the horizon and as-of date; a caption names the method set version and "no interest or taxes; discretionary spending spread evenly per day" (copy exists on the page).
* Accessibility: `role="img"` + `aria-label` summary ("Projected cash falls to $…on 2026-01-14, below your $… floor"), and a visible "Show as table" toggle that reveals the existing date/events/cash table. Hover/focus tooltips on markers (`<title>` + focusable `<g tabindex=0>`).
* Forbidden: probability bands, smoothing, extrapolation past the engine's horizon, animation, dual axes, truncated y-axis without a visible break.
* Colour: the status tokens only; no new palette.

---

## 5. Microcopy and vocabulary rules

1. **"Verified" is reserved** for three server-derived facts: receipt integrity ("receipt verified: request hash re-derived here"), personal data state `EVIDENCE_VERIFIED` ("Verified from a document"), and the review outcome `SUPPORTED_CHECK_VERIFIED` ("Supported check verified"). It is never used for an engine PASS on its own, for NOT_REQUIRED, for "working", "live" or "reachable".
2. **PASS is always "Arithmetic PASS"** (chip label exists) and never sits beside the word "verified" without the receipt qualifier.
3. **NOT_REQUIRED** reads "Not required (eligibility confirmed)" everywhere, not "Verified (not required)" (`CoveragePanel.tsx`). This is a label change with a Playwright dependency (`pr-002-coverage.spec.ts` matches `/Outside supported scope|Verified \(not required\)/`); update the test in the same PR.
4. **Capability status vocabulary** (replace the seven variants found): `Working (synthetic)`, `Working (offline mock)`, `Proposed`, `Gated (G3/G4)`, `Not in this build`. Tone: synthetic/mock = amber, proposed/gated = slate, working = **neutral**, never teal (teal is for verified facts and successful acts).
5. **Helpers to add in `ui/format.ts`** (presentation only, no money): `humanize(enum)` for `lowercase + underscores → spaces` (25 inline copies today), `formatWhen(iso, { precision })` for the 11 inline `replace("T"," ").slice(0,19)` copies, `shortHash(sha)` returning `{ short, full }` for the 8 inline truncations.
6. **Identity lines:** "Simulated reviewer: Priya Raman (ANALYST)" in the console and "Demo person: Maya Castillo (owner)" in Personal; after PR #10, "Signed in as" is reserved for a real Supabase session.
7. **Limitations next to the figure.** Every stat, table and recommendation that depends on a receipt shows its receipt link; every page with engine output ends with the meta line (snapshot · as-of · method · receipt status) via `PageHeader`'s meta slot, not a loose paragraph.
8. **No fear language**: "below your floor from 2026-01-14" not "danger"; "outside supported scope" not "failed" (reserve "failed" for ERROR).

---

## 6. Status vocabulary and colour matrix

Tones: **V** verified (teal) · **L** limitation (amber) · **B** blocked (conflict) · **A** assumed/draft (slate) · **N** neutral · **X** exceptions (navy) · **H** history (dashed, faint).

### 6.1 Calculation result (`ResultChip`, per run)
| Value | Label | Tone | Icon |
|---|---|---|---|
| PASS | Arithmetic PASS | V | CheckCircle2 |
| NOT_REQUIRED | Not required (eligibility confirmed) | N | Info |
| UNSUPPORTED | Outside supported scope | L | AlertTriangle |
| INDETERMINATE | Indeterminate (inputs missing) | L | CircleHelp |
| ERROR | Service error (no result) | B | XCircle |

### 6.2 Receipt integrity (`request_hash_verified`)
| Value | Label | Tone |
|---|---|---|
| true | Receipt verified · request hash re-derived here | V |
| false | Receipt mismatch · result not trusted | B |
| null | No receipt (no run) | N |

### 6.3 Account coverage (latest attempt; `CoveragePanel`)
| Value | Label | Tone |
|---|---|---|
| VERIFIED | Arithmetic PASS · receipt verified | V |
| NOT_REQUIRED | Not required (eligibility confirmed) | N |
| UNSUPPORTED | Outside supported scope | L |
| INDETERMINATE | Indeterminate | L |
| ERROR | Latest attempt failed | B |
| NOT_RUN | Not run | N |

### 6.4 Review outcome (`OutcomeChip`)
| Value | Label | Tone | Icon |
|---|---|---|---|
| SUPPORTED_CHECK_VERIFIED | Supported check verified | V | CheckCircle2 |
| APPROVED_WITH_EXCEPTIONS | Approved with exceptions (n) | X | Stamp |
| REVIEWED_WITH_LIMITATIONS | Reviewed with limitations | L | AlertTriangle |
| null | Not approved | N | — |

An approval chip always sits next to the approver's name and role; the outcome description is one disclosure away.

### 6.5 Fact verification status
| Value | Label | Tone | Icon |
|---|---|---|---|
| FACT_CONFIRMED | Confirmed (evidence) | V | CheckCircle2 |
| FACT_ASSUMED | Assumed (documented) | A | BookmarkCheck |
| NEEDS_CONFIRMATION | Needs confirmation (claim) | L | CircleHelp |
| FACT_CONFLICT | Conflict | B | AlertTriangle |

### 6.6 Workflow status (household)
IMPORT_DRAFT, MAPPED, RECONCILIATION_PENDING → A · BLOCKED → B · READY_TO_FREEZE → N (not V: nothing is verified yet) · FROZEN, CHECK_COMPLETE → X-style navy with `Lock` · REVIEW_PENDING → L · REVIEWED → A · APPROVED, EXPORTED → V with `Stamp` (human act).

### 6.7 Personal data state
| Value | Label | Tone | Icon |
|---|---|---|---|
| USER_REPORTED | You reported | N | PencilLine |
| EVIDENCE_VERIFIED | Verified from a document | V | CheckCircle2 |
| ASSUMED | Assumed | A | Info |
| MISSING | Missing | B (required) / L (optional) | CircleHelp |
| STALE | Needs a fresh value | L | Clock3 |
| CONFLICTING | Two values disagree | B | AlertTriangle |

### 6.8 Recommendation priority, decision and severity
DO_THIS_NOW → L (urgent is a limitation of time, not an error) with text "Do this now"; CONSIDER_NEXT → A; REVISIT_LATER → N. Decisions: DONE → V, SNOOZE / NOT_RELEVANT / DISAGREE → N with the verb in text. Severity: HIGH → B, MEDIUM → L, LOW → A, INFO → N ("Note").

### 6.9 AI
Run: DRAFT_READY → A "Draft for human review"; REJECTED → B "Rejected by validator"; ERROR → B "Provider failed". Finding evidence: TOOL_BACKED → V "Amounts from a receipted calculation"; UNVERIFIED → N "Unverified draft"; HYPOTHESIS → A "Hypothesis". Feedback: ACCEPT → N "Accepted as draft" (not V: acceptance is not approval), EDIT → N, DISMISS → N, REQUEST_EVIDENCE → L. Provider: always "Deterministic offline mock" with the slate tone.

### 6.10 Capability status (marketing and in-app)
Working (synthetic) → N · Working (offline mock) → L · Proposed → A · Gated (Gn) → A · Not in this build → N. Never teal.

---

## 7. Implementation notes (for UI-001)

* All tokens live in `apps/web/src/app/globals.css` `@theme`; add the new primitives, the semantic aliases (as plain custom properties referencing primitives), the `--text-*` scale, radius, shadow and motion tokens; add `@media (prefers-reduced-motion: reduce)` and the `[data-density]` component tokens. No Tailwind config file is needed (v4 CSS-first).
* `ui/primitives.tsx` keeps every exported name and prop (PR #10 imports `Alert`, `Card`, `Chip`, `EmptyState`, `Field`, `KeyValue`, `buttonClasses`, `inputClasses`); changes are additive (`headingLevel`, `tone`, `density`, `error`).
* New files only under `apps/web/src/ui/**` and `apps/web/src/app/**/loading.tsx`; never under `domain/**`, `auth/**`, `server/**`, `packages/contracts/**`, `services/calculator/**`, `supabase/**`.
* Label changes that Playwright asserts (section 5 rule 3 and the audit's selector list) ship with the matching test update in the same PR.
* No new runtime dependency. Dev-only: `@axe-core/playwright` is proposed in the accessibility plan (small, dev-only, justified by the WCAG gate).

---

## 8. Acceptance for the design system itself (UI-001 definition of done)

1. Every colour in use resolves to a token; `grep -rn "#[0-9a-fA-F]{6}" apps/web/src --include=*.tsx` stays empty.
2. No `text-[Npx]` below 12 px remains; `tracking-[…]` replaced by `text-eyebrow`.
3. Contrast: all text ≥ 4.5:1, chips ≥ 4.5:1, input borders and focus ring ≥ 3:1 (checked by the axe run in the accessibility plan).
4. Component gallery route `/design/system` (dev-only, synthetic, excluded from production routing) renders every component in every state listed in section 2, and a Playwright screenshot of it is attached to the PR.
5. Existing Playwright suites (4 files, 16 scenarios) pass unchanged except for label updates listed in the PR.
