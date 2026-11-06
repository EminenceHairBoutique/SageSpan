# SageSpan screen-by-screen improvement plan

**Document:** `docs/design/UI_000_SCREEN_IMPROVEMENT_PLAN.md` · **Version:** 1.0 · **Date:** 2026-11-06 · **Status:** plan (UI-000, documentation only)
**How to read:** each screen lists what is there now (with a screenshot from `docs/design/screenshots/ui-000/`), what is wrong (ids from the [audit](UI_000_DESIGN_AUDIT.md)), the target (from the [blueprints](UI_001_PAGE_BLUEPRINTS.md)), the concrete presentation changes, what is **backend-blocked** (must not be faked), and the acceptance tests. "Data available" means the server already returns the field; no new domain code is implied.

---

## 1. Personal dashboard — Overview (`/demo/personal`)

**Now:** `019-ps-overview-1440.jpg`, `020-…-full.jpg`, `090-…-390-full.jpg`. Four stat tiles, "My next three steps" with full `DecisionCard`s and four feedback buttons each, "What needs attention" (tall chips, D1), "What I don't know yet", meta paragraph at the bottom.
**Problems:** V1, V5–V8, R4, no "what matters this week", no outlook, "Essentials covered" has no receipt, tones are colour-only, meta line is loose text.
**Target:** blueprint B2.
**Changes (UI-002 unless noted):**
1. `PageHeader` with eyebrow HOME, h1 "Where you stand, Maya" (keep the text; e2e), lead, `Recompute baseline` action, meta row from `clarityRun` (snapshot id, as-of, method versions, receipt status "re-derived and matched" — keep the phrase; e2e).
2. "What matters this week": one sentence derived from the highest-severity flag's `message` (already sorted on the page) — presentation of an existing string, not a new judgement.
3. Stats: 4 tiles desktop, 2×2 compact on < sm; each with a receipt (`Money`), a text qualifier for the tone ("$2,150.00 above your floor", "gap $2,399.00 to target", "low month $533.50", "stays above your floor"); "Essentials covered" uses `Money`-style receipt on `cash.essential_buffer_months` (field exists; receipt dialog shows the field name).
4. Next three steps as **compact** cards: priority chip, title, one-line observed, deterministic impact amount with receipt, one "Review" link to `/demo/personal/next-steps#rec_…`; feedback buttons stay only on Next steps. (Keep `article[aria-label]` ×3 and the "Ask why" button on at least the compact card so `dual-market.spec.ts` passes; or update that test in the same PR — decision in the roadmap.)
5. Attention list: severity chip `self-start`, due date and amount already in `message`; cap 4 + "Show all" link to Cash flow.
6. Outlook compact chart (UI-002 §cash flow) with "Open cash flow" link; mobile shows the lowest-point sentence only.
**Backend-blocked:** notifications/monitoring (AI-005), connected data (G3) — show as "Not in this build" lines inside "What I don't know yet", not as controls.
**Tests:** existing `Personal: receipted baseline…` (update selectors if feedback moves); new Vitest for `PageHeader` meta rendering with a null run (no receipt → "not computed"); Playwright: 390 px screenshot shows four tiles and the first step without scrolling past 1.5 screens; axe clean.

## 2. Next steps (`/demo/personal/next-steps`)

**Now:** `022-ps-next-steps-1440-full.jpg`. Full `DecisionCard`s, "More to revisit later", "Rejected by a hard constraint", "How this was evaluated".
**Problems:** V6–V8, A13 (copy), long cards.
**Changes (UI-002):** `PageHeader` (MY NEXT STEPS); DecisionCard v2 (design system §3.12): neutral suggested-action well, priority tone with text, segmented feedback group with one primary, settled state in text, disclosures for trade-offs/limits/prerequisites open by default here; "Rejected" items keep the blocked tone (they are refusals); "How this was evaluated" copy: "No financial health score. Candidates are ordered by explicit weights: …". Anchor ids per recommendation for deep links from the Overview.
**Tests:** existing e2e (Ask why → "Ranked 1 of", "decision-policy.v1"; Snooze → "You: snooze"); new Vitest snapshot for DecisionCard states (DONE/SNOOZE/NOT_RELEVANT/DISAGREE, READ_ONLY authority, DATA_REQUEST).

## 3. Cash flow (`/demo/personal/cash-flow`)

**Now:** `023-ps-cash-flow-1440.jpg`, `024-…-full.jpg`, `094-…-390-full.jpg`. Three stats, irregular-income notice, income streams, commitments table (no wrapper), cash accounts, dated outlook as a 90-row table in a 480 px scroll box with red-shaded rows.
**Problems:** no chart (brief §3), R1, R2, below-floor shading computed in TSX (audit §4.4), edit forms cramped on mobile.
**Changes (UI-002):** `PageHeader`; `OutlookChart` (design system §4) above the table with "Show as table"; row shading driven by the engine's `first_floor_breach_date` and flags rather than `parseCents` comparisons (presentation reads flags; if a per-point "below floor" marker is wanted it is a calculator change — out of scope, note in the roadmap); `DataTable` for commitments (reflow at < sm); income stream rows as a list with the observed-month pills; forms responsive.
**Backend-blocked:** recurring-charge detection from transactions (PERS-002b/d): keep the "Subscriptions…" status card as a labelled status, no mock controls.
**Tests:** Vitest for `OutlookChart` (renders n points, floor line, markers from `events`, alt table toggle, aria-label text); Playwright: chart visible at 1440 and 390, table toggle works with keyboard; existing "updating a balance… floor flag appears" scenario unchanged.

## 4. Spending (`/demo/personal/spending`)

**Now:** `026-ps-spending-1440-full.jpg`. Stats, category cards with month pills, add category, subscriptions status card.
**Problems:** cards for every category (V2), "transfers may be included" note is small, no denominators/sample size headline.
**Changes (UI-002):** `PageHeader` with the observed window and sample size ("6 observed months, as you recorded them") from existing fields; categories as a `DataTable` (Category · Essential/Discretionary chip · Typical month · Months recorded · State · Edit) with the month pills in an expandable row; keep "no score" framing; the transfers caveat moves next to the totals.
**Backend-blocked:** transaction-level detail, merchant correction, duplicate/refund detection — status line only.
**Tests:** reflow screenshot at 390; axe.

## 5. Savings & debt (`/demo/personal/savings-debt`)

**Now:** `028-…-full.jpg`, `098-…-390-full.jpg`. Stats, cash accounts with "Update balance" disclosure, guardrails form, liabilities table (7 cols, no wrapper).
**Changes (UI-002):** blueprint B4; `DataTable` for liabilities with promo-APR expiry as text next to the "variable" chip (brief §5: promotional/variable warnings visible); guardrails copy unchanged ("your choices, not rules"); balance update stays a disclosure with the revision shown; retire confirmation dialog (D7).
**Backend-blocked:** none for this screen.
**Tests:** existing `records: add a commitment, then retire it` (add the confirm step); Vitest for the liabilities row states (VARIABLE with promo, FIXED, STALE).

## 6. Scenarios (`/demo/personal/scenarios`)

**Now:** `033-ps-scenarios-1440.jpg`, `034-…-full.jpg`, `104-…-390-full.jpg`. Debt paths (input + comparison), what-if (form + result), "Not yet available".
**Problems:** two unrelated sections under one h1; infeasible rows styled only by a chip; D6; tables without wrappers; the comparison does not distinguish "pay more each month" from "change priority under the same budget" in its framing (brief §5).
**Changes (UI-002):** blueprint B5; section headings (h2) "Debt payoff paths — same extra amount, different order" and "What if… — one change at a time"; comparison `DataTable` with the first row explicitly "Minimums only (no extra)" so the ordering comparison is visibly under the same budget; INFEASIBLE rows get the blocked tone across the row with the reason text; cash-flow feasibility (liquidity guard "floor respected: NO") shown as a blocked notice above the table, separate from amortisation results; what-if result table keeps side-by-side numbers in a scroll region on mobile; fix the disabled reason (owner vs no baseline).
**Backend-blocked:** retirement scenarios (PLAN-001) — status list stays.
**Tests:** existing three what-if/scenario scenarios; Vitest for the comparison row state mapping; Playwright screenshot of an INFEASIBLE result at 1440 and 390.

## 7. Recommendations (component: `DecisionCard`)

Covered in screens 1–2. Summary of the component change: compact vs full, neutral suggested action, priority text, impact with receipt, one primary action, settled text, disclosures, "Ask why" as a `<dl>`. No change to the `Recommendation` contract or policy.

## 8. SageSpan Assistant (`/demo/personal/assistant`) and AI plan review (`/demo/app/households/[id]/ai-review`)

**Now:** `036-ps-assistant-1440-full.jpg`, `152-…-after-draft…`, `165-fm-patel-ai-review-draft-1440-full.jpg`. Permanent draft chip, provider line, findings with evidence-status chips, questions, limitations, validator log, feedback buttons.
**Problems:** "Accept" looks like approval (primary style); citations are a comma-joined line; provider notice is far from the button; firm page renders raw `annual_rmd` (D4).
**Changes (UI-002 personal, UI-003 firm):** title chips "SageSpan Assistant · demonstration · deterministic offline mock" / "AI plan review (draft)"; provider notice directly under the action; `FindingCard` v2 (design system §3.13) with citations `<dl>` and receipt links for cited run ids; feedback group with no primary button; "Why this is suggested" drawer = existing run metadata (provider, model, prompt version, snapshot, accepted/rejected counts, created time) in a `KeyValue`; `formatMoney` on the firm page's deterministic result.
**Backend-blocked:** live provider (G3), AI-002…005 — status lines only.
**Tests:** existing assistant and firm-AI scenarios; Vitest for `FindingCard` evidence-status chips (TOOL_BACKED / UNVERIFIED / HYPOTHESIS) and feedback states.

## 9. Evidence screens — check receipts, Evidence tab, packet HTML

**Now:** `161-…check-pass…`, `163-…receipt-dialog…`, `164-…request-json…`, `169-…packet-ready…`, `181/182-fm-patel-packet-html…`, `184-fm-okafor-packet-html…`.
**Problems:** A10 (teal health), V10 (hash truncation), chips defined via `title` (A11), evidence tab lists everything in one KeyValue, packet HTML has its own inline styles and no print rules.
**Changes (UI-003):** blueprint B9/B11; `ServiceState` neutral/blocked for the calculator; `ReceiptDialog` sections (Inputs · Method / rule sets · Integrity · Limitations) with copyable hashes; `CheckRunCard` layouts per result status with the history style for earlier attempts; Evidence tab: stage header, packet preview grouped (Outcome · Scope · Integrity · Not checked · Limitations), export log `DataTable`, generate action with reason; packet HTML theme (coordinate with `domain/evidence.ts` owner): tokens, print stylesheet, captions.
**Backend-blocked:** PDF export (no renderer bundled), per-artifact manifest (S-10 / PR-003) — state in the "Not checked"/limitations copy only.
**Tests:** existing Patel/Okafor e2e (packet title assertions unchanged); Vitest for `ReceiptDialog` sections and the copy button; Playwright screenshot of the HTML packet rendered via `setContent` (the route is a download).

## 10. Professional review queue (`/demo/app/reviews`)

**Now:** `043-fm-review-queue-1440.jpg`, `044-…-full.jpg`, `177/178/180-…-390/320`. Filters, assignee form, sort link, one table.
**Problems:** N2, N9, V9, R1, "rev 1" in failing contrast, no coverage/age.
**Changes (UI-003):** blueprint B8; counters row from the existing counts; `DataTable` with Coverage (from `coverageSummary` of the current snapshot: "1/1 PASS", "outside scope", "not run") and Age (days since `updated_at`, a date difference, not money); client-side text filter over rendered rows (presentation); row link; empty state with "reset filters"; sticky first column on mobile.
**Backend-blocked:** assignment suggestions, reviewer matching, workload summaries (operational intelligence, proposed) — not shown.
**Tests:** existing cross-tenant scenario (link names "Patel household", "Bauer household"); Vitest for the coverage cell mapping; Playwright: queue at 390 shows the status column via horizontal scroll region with keyboard focus.

## 11. Household review (`/demo/app/households/[id]` → Overview, Review, Checks)

**Now:** `059-…overview…`, `156-…freeze-blocked…`, `157/158-…review…`, `166/167/168-…`. Strong flow; see audit §3.5.
**Changes (UI-003):** stage header per tab with the next permitted action for the current role (strings already exist as disabled reasons); Overview: facts `DataTable` (keep `FactsTable` semantics), sources as a list with copyable hashes, freeze gate unchanged in logic; Review: approval column first on mobile, coverage definitions as visible text, discrepancy rows with the three amounts as a mini `KeyValue`, comments collapsed by default; Checks: per blueprint B9.
**Backend-blocked:** real member management, document bytes/registration (PR-003), import-format maps (IMPORT-001) — status only.
**Tests:** all `assurance-flow.spec.ts` and `pr-002-coverage.spec.ts` steps; Vitest for `CoverageTable` labels (new "Not required (eligibility confirmed)") and `OutcomeNotice` tones; Playwright screenshots of the three approval outcomes (Patel: exceptions; Okafor: limitations; a verified-only fixture if one exists in seed — otherwise document that SUPPORTED_CHECK_VERIFIED is proven by unit tests).

## 12. Sign-in and workspace chooser (`/app/sign-in`, `/app`; PR #10)

**Now (on PR #10):** `SignInForm` in a `Card`; `ProductionHome` lists memberships/workspaces/shared scopes. In this branch `/app` is the gate (`017-mk-sign-in-gate-1440.jpg`).
**Changes:** none until PR #10 merges. UI-001 keeps primitive APIs stable so those screens restyle automatically. UI-003 (post-merge) adds the auth layout (blueprint B12) and the rail-footer `WorkspaceSwitcher` using the same server actions.
**Backend-blocked:** everything behind the store adapter (DATA-001).

## 13. Privacy & sharing (`/demo/personal/privacy`)

**Now:** `040-ps-privacy-1440-full.jpg`. KeyValue, members table, empty grants, quiet mode, export notice.
**Changes (UI-002 spec, UI-003 build after PR #10):** blueprint B13 — grant rows and a disabled "Share with an advisor · Proposed (PR-003)" control; invitation list; retention/export/deletion notice stays "not live".
**Backend-blocked:** grants, invitations, export/deletion.

## 14. Public site (summary; UI-004 detail in the roadmap)

Header (N3–N5), h1 per page (V17), status chips (A5), claims (A1, A6–A9), outcome narrative section, pillar panels with status, trust section "design controls actually implemented", one purpose-built diagram from synthetic data (the Patel conflict → freeze → check → outcome), pricing as hypothesis with the calculator labelled "illustrative arithmetic in your browser".
