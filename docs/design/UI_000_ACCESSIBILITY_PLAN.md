# SageSpan accessibility plan (WCAG 2.2 AA)

**Document:** `docs/design/UI_000_ACCESSIBILITY_PLAN.md` · **Version:** 1.0 · **Date:** 2026-11-06 · **Status:** plan (UI-000, documentation only)
**Scope:** public site, Personal workspace, Advisor & Assurance console, evidence packet HTML export. Target **WCAG 2.2 Level AA** for all three surfaces, measured per UI phase (roadmap §acceptance).
**Evidence basis:** code inspection of `apps/web/src/**` on this branch, computed contrast ratios (relative-luminance formula), and the UI-000 screenshots under `docs/design/screenshots/ui-000/`. No automated accessibility tool was run in this session; the first axe run is a UI-001 acceptance item.

---

## 1. Current gaps (found) and the fix that owns them

| # | WCAG | Finding (where) | Severity | Fix phase |
|---|---|---|---|---|
| A1 | 1.4.3 Contrast (minimum) | `--color-ink-faint #7B8A9E` is 3.5:1 on white, 3.3:1 on canvas, 3.1:1 on `surface-muted`; used for 10–11 px text: hashes (`[id]/page.tsx:93`, `evidence/page.tsx:99`, `settings/page.tsx:123,181`, `CheckRunCard.tsx:221`), "rev 1" (`reviews/page.tsx`), "none", sub-brand labels (`ConsoleShell.tsx:35`, `PersonalShell.tsx:41`), "provisional name" pill (`SiteNav.tsx:26`) | High | UI-001 token change (`#5B6C86`) |
| A2 | 1.4.11 Non-text contrast | Input borders use `line-strong #B9C4D1` (1.8:1 on white); inputs are identified only by that border (`inputClasses`) | High | UI-001 `--color-line-input #7F8EA3` |
| A3 | 1.4.4 / 1.4.12 Resize & spacing | 10 px (`SiteNav.tsx:26`, `Checkpoints.tsx:13`) and 11 px text; stepper numerals at 10 px | Medium | UI-001 type scale floor 12 px |
| A4 | 2.4.1 Bypass blocks | No skip link in `app/layout.tsx`; three navigation regions before main content on the console | High | UI-001 shell |
| A5 | 2.4.7 / 2.4.11 Focus visible, not obscured | Global `:focus-visible` ring exists (teal, 4.7:1 on canvas) but has no halo on teal/amber/navy surfaces (ring on a navy primary button is 1.6:1 against the button); sticky headers can obscure focused elements after keyboard scroll (`scroll-mt` only on conflict anchors) | Medium | UI-001 focus token + `scroll-padding-top` on `html` |
| A6 | 1.3.1 Info and relationships (headings) | Seven marketing pages have no h1 (`SectionHeading` renders h2); `Card` titles are always h2, so `/firms`, `/security`, `/retirement`, `/personal`, `/how-it-works` have sibling h2s at two hierarchy levels; `evidence/page.tsx` h3 under card h2 is fine | High | UI-001 `SectionHeading level` + `Card headingLevel`; UI-004 marketing |
| A7 | 1.3.1 Tables | No `scope="col"` on `Th`; no `<caption>`; 13 tables without an overflow region (audit §4.5) | Medium | UI-001 `DataTable` |
| A8 | 4.1.2 Name, role, value | Chip descriptions and disabled reasons delivered via `title` only (`OutcomeChip`, `CheckRunCard` coverage chip, `SubmitButton title`); `title` is not reliably exposed to screen readers or touch | Medium | UI-001 visible text / accessible tooltip |
| A9 | 1.3.1 / 3.3.2 Labels | Inputs with both a wrapping `<label>` (via `Field`) and an `aria-label` (`RecordForms.tsx`, `WhatIfForm.tsx`, `savings-debt/page.tsx`) are announced with the `aria-label` only, which sometimes differs from the visible label (e.g. visible "Balance (USD)", accessible "Balance") → 2.5.3 Label in Name risk | Medium | UI-002 forms |
| A10 | 3.3.1 / 3.3.3 Error identification & suggestion | Server validation errors are shown only as a form-level `Alert` "Not applied (CODE)" with no `aria-invalid`, no field association, even though the error contract returns field paths | Medium | UI-001 `ActionForm` + `Field error` |
| A11 | 2.5.8 Target size (minimum, 24×24) and mobile comfort | Mobile pill nav items are ~28 px tall; "Edit", "Retire", "Switch" buttons at `py-1` (~26 px); fine for 2.5.8 but below the 44 px comfort target the brief asks for | Low | UI-001 shells, UI-002 forms |
| A12 | 2.3.3 Animation from interactions / 2.2.2 | `html { scroll-behavior: smooth }` unconditional; `animate-spin` without `motion-reduce` | Low | UI-001 motion tokens |
| A13 | 4.1.3 Status messages | Synthetic banners use `role="status"` (a live region) for permanent content; `Alert` success uses `role="status"` (correct); `router.refresh()` after success re-renders the page without announcing the new numbers | Low | UI-001 `SyntheticBanner role="note"`; UI-002 `aria-live` on the stat region after recompute |
| A14 | 1.4.1 Use of colour | Stat tile tone is a coloured border only (`Stat tone`), DecisionCard "Do this now" border, "earlier attempt" `opacity-70`, outlook rows "shaded red" (text qualifier exists in the footnote only) | Medium | UI-002 text qualifiers + history style |
| A15 | 1.1.1 Non-text content | Icons are `aria-hidden` (good); the brand tile icon has no text alternative beyond the adjacent name (fine); the receipt trigger icon is decorative (fine). No charts exist yet. | — | UI-002 chart alt table |
| A16 | 2.1.1 Keyboard | Native `<dialog>`, `<details>`, forms and links: keyboard operable. `window.confirm` for reset is keyboard operable but not styled; retire has no confirmation at all | Low | UI-001 confirm dialog |
| A17 | 1.4.10 Reflow (320 px) | `RecordForms` fixed `grid-cols-2/3`; `KeyValue` fixed `max-content 1fr`; `PersonaSwitcher max-w-[320px]`; console tables without wrappers overflow the viewport (`fm-review-queue-320.png`) | Medium | UI-001 primitives, UI-002 forms, UI-003 tables |
| A18 | 3.2.3 Consistent navigation | Console desktop nav has no active state; mobile strips have none; group labels absent | Medium | UI-001 shells |
| A19 | 1.3.2 Meaningful sequence / 2.4.6 Headings | Personal pages repeat the eyebrow + h1 + lead block; headings fine. Console household pages rely on the layout h1 and tab name; pages lack an h2 for the active tab (tab name is link text only) | Low | UI-003 `PageHeader` per tab |

Positive findings to preserve: `aria-current` on Personal nav and household tabs; `aria-label` on nav regions; `<fieldset><legend>` on radio groups; native `<dialog aria-labelledby>` with a labelled close button; `role="alert"` for blocked results; `<time dateTime>` in the queue; disabled reasons shown as text next to the control; no colour-only status chips (text + icon everywhere); `lang="en"`.

---

## 2. Contrast and colour

* Token targets (see design system §1.1): all text ≥ 4.5:1 on canvas, surface and surface-muted; chip text ≥ 4.5:1 on its tint; input borders, focus ring and chart lines ≥ 3:1; decorative dividers exempt.
* Verified pairs (computed): ink 15.4; ink-muted 6.9 / 6.5 / 6.2; teal-700 on teal-100 6.5; amber-700 on amber-100 6.1; slate-700 on slate-100 6.5; conflict-700 on conflict-100 7.4; white on navy 16.5; white on conflict 6.6; teal on white 5.1 (AA text); proposed ink-faint `#5B6C86` 5.3 / 5.0 / 4.7; proposed line-input `#7F8EA3` 3.3 / 3.1.
* Colour is never the sole carrier: every status chip keeps icon + label; stat tones add a text qualifier; history gets a dashed border and the word "earlier"; the outlook chart hatches the below-floor region *and* labels the breach date in text.
* Windows High Contrast / forced colours: borders must remain (`border` not `box-shadow` for input boundaries), focus rings use `outline` (already), chips keep borders.

## 3. Keyboard and focus

* Skip link ("Skip to main content") as the first focusable element in `app/layout.tsx`, visible on focus; `<main id="main" tabindex="-1">` in each shell.
* Tab order follows the visual order: banner → brand → nav → page actions → content. The persona switcher's `onChange` auto-submit is acceptable (3.2.2 requires that the change be expected; add helper text "Changing the reviewer reloads the console as that person").
* Focus ring: 2 px `teal` outline, 2 px offset, plus a 2 px `surface` halo (box-shadow) so it meets 3:1 on every surface; `scroll-padding-top` equal to the sticky header height so a focused element is never under the header (2.4.11).
* Dialogs: native `<dialog>` keeps focus and restores it on close; add `aria-describedby` for the subtitle; Escape closes (native).
* Disclosures: `<details>` is keyboard operable; custom "Ask why" and "Validator log" buttons already use `aria-expanded`; add `aria-controls`.
* Tables: horizontally scrollable regions get `tabindex="0"`, `role="region"`, `aria-label`, so keyboard users can scroll them (A7, A17).
* Bottom navigation (Personal mobile): links, not buttons; `aria-current`; the "More" sheet is a `<dialog>` so focus is trapped intentionally and restored.
* No keyboard traps: verified by the keyboard walkthrough in each phase (section 7).

## 4. Motion

* Tokens with `prefers-reduced-motion: reduce` collapsing to 1 ms; `scroll-behavior` auto under reduced motion; no autoplaying or looping animation anywhere; the pending spinner becomes a static icon with text.
* No parallax, no count-ups, no chart draw-in, no toast slide-ins (success notices render in place).

## 5. Forms

* One visible label per control (`Field`); remove redundant `aria-label`s; hints via `aria-describedby`.
* Required: asterisk plus "(required)" text in the label, `required` attribute, and a form-level summary on submit failure that lists fields and moves focus to the summary (`role="alert"`).
* Errors: `aria-invalid="true"`, inline message linked by `aria-describedby`, message states what to change (3.3.3), never echoes submitted money values (existing privacy rule in the error contract).
* Money inputs: `inputMode="decimal"`, visible "USD" adornment, example placeholder; date inputs native. No autocomplete of financial identifiers (none collected).
* Radio groups keep `<fieldset><legend>`; checkbox attestation keeps the long visible label (review page) with the label element wrapping the input.
* Destructive actions (retire a record, reset synthetic data) use a native `<dialog>` confirmation naming the object, with Cancel focused by default.
* Sign-in (PR #10): `autocomplete="username"` / `"current-password"` already present; the error notice must be `role="alert"` and focus moves to it.

## 6. Tables of money

* `DataTable` adds `<caption>` (visible or `sr-only`) naming the table and its as-of date; `<th scope="col">`; row header (`scope="row"`) for the first column where rows are entities (household, account, liability).
* Money cells: right-aligned, `tabular-nums`, currency from `formatMoney`, negative values with a true minus; the cell text is the full amount (never truncated), and when a receipt exists the cell content is the receipt trigger button whose accessible name is the amount (tests depend on it).
* Sort state: `aria-sort` on the sorted header; the sort control is a link with text ("Sort by last update").
* Responsive: ≤ 4-column consumer tables reflow to stacked definition rows at < 640 px (each row becomes a `<dl>` with the column headers as `<dt>`); console tables scroll inside a labelled region with an edge fade and a visually hidden "Scroll horizontally to see more columns" hint.
* Status columns use typed chips (text + icon); never a bare colour cell.

## 7. Screen-reader semantics for receipts and statuses

* **Receipt trigger:** `<button aria-haspopup="dialog">$3,650.00</button>` (exists). Add `aria-describedby` pointing to a visually hidden "Opens the calculation receipt" once per page (not per button) to avoid verbosity.
* **Receipt dialog:** `role=dialog` via native element, `aria-labelledby` title, `aria-describedby` subtitle; content as a `<dl>`; "Limitations" as a list; hashes in `<code>` with `aria-label="Request hash"` on the `<dt>` only (do not read 64 characters twice); a "Copy" button announces "Copied" through a `role=status` region.
* **Status chips:** `<span>` with icon `aria-hidden` and text label; for chips whose meaning needs definition (review outcomes, coverage), the definition is rendered as visible text in the same card (outcome notice) so no tooltip is required. Where a tooltip is used, it is a focusable trigger with `aria-describedby`, dismissible with Escape (1.4.13).
* **Outcome notice:** `role="status"` for "If approved now …" (informational, updates after actions), `role="alert"` for "Approval blocked …".
* **Stepper:** `<ol aria-label="Review checkpoints">` (exists) with `aria-current="step"` on the current item and visually hidden "reached / not reached" (exists).
* **Synthetic banner:** `role="note"` + `aria-label="Synthetic demonstration"`; it is not a live region.
* **Recompute / run results:** the stats region gets `aria-live="polite"` and `aria-atomic="false"` so a recompute announces "Baseline recomputed as of …" via a status line, not every number.
* **History:** earlier attempts and superseded facts carry visible "earlier attempt — kept as history" text (exists on checks) and `aria-label` prefixes on their cards.
* **AI draft:** the panel's permanent "AI draft — not a review, approval or verification" chip is also the panel's `aria-label` (exists as "AI draft review"; align the wording).

## 8. Testing and acceptance

| Check | Tool | When |
|---|---|---|
| Automated rule scan on 12 representative routes at 1440 and 390 (home, personal overview, cash flow, scenarios, assistant, review queue, household overview/checks/review/evidence, pricing, sign-in gate) | `@axe-core/playwright` (dev dependency; proposed in UI-001, founder approval for the new dev dep) in a `e2e/a11y.spec.ts` that fails on `serious`/`critical` | every UI PR |
| Contrast of every token pair in design system §1.1 | script in the PR (`scripts/design/contrast.mjs`, no deps) | UI-001, then on token change |
| Keyboard walkthrough: skip link → nav → each primary action → open/close receipt dialog → approve flow; no trap; focus visible at every stop | manual, recorded as a checklist in the PR description with screenshots of focus rings | UI-001, UI-002, UI-003 |
| Screen reader pass (NVDA + Firefox, VoiceOver + Safari on a phone if available): page title, headings outline, landmark list, table navigation, receipt dialog, status chips | manual checklist | UI-002 (Personal), UI-003 (console) |
| Reflow at 320 / 390 / 768 / 1280 / 1440; 200 % zoom at 1280 | Playwright screenshot matrix (`e2e/visual.spec.ts`, screenshots only, no pixel diffing in CI) | every UI PR |
| Reduced motion | Playwright `reducedMotion: "reduce"` context on the dialog and pending states | UI-001 |
| Forced colours | manual check in Edge with a high-contrast theme on chips, inputs, focus | UI-001 |

Definition of done per phase: zero axe `critical`/`serious` on the scanned routes; the keyboard and screen-reader checklists attached; every finding in section 1 assigned to that phase closed or explicitly carried forward with a reason.
