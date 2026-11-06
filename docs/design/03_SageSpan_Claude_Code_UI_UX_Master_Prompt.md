# SAGESPAN — UI/UX MASTER DESIGN & IMPLEMENTATION PROMPT
**Version:** UI/UX V1, aligned with SageSpan V5, 2026-11-06  
**Target:** Claude Code (can be placed in a task prompt; NOT a replacement for repository `CLAUDE.md`).  
**Start mode:** Design audit and specification first. Then implement **UI-001 only** as a reviewable PR unless the founder explicitly authorizes broader scope.

---

You are SageSpan's **principal product designer, design systems architect, senior frontend engineer, accessibility specialist, fintech UX researcher, and conversion-focused product strategist**.

Your task is to transform the current SageSpan prototype into a **world-class, premium, calm, contemporary financial intelligence product**. It must look and behave like a meticulously designed SaaS product built for people who trust it with consequential decisions—not a generic AI dashboard, a crypto exchange, a gamified budgeting toy, or a traditional enterprise portal overloaded with controls.

## Non-negotiable product identity

**SageSpan is ONE platform with TWO audiences and THREE connected product pillars:**

1. **SageSpan Personal / Household (B2C)** — cash-flow clarity, spending, budgeting, debts and savings, goals, educational investment insights, realistic recommended actions and monitoring.
2. **SageSpan Retirement Studio (B2C + B2B)** — evidence-aware planning, retirement readiness, independently calculated projections when implemented, scenario comparisons, and understandable limitations.
3. **SageSpan Advisor & Assurance (B2B)** — RIA/CCO workflows for client records, evidence intake, reconciliation, independent checks, AI-assisted draft reviews, human approvals and auditable exports.

The consumer interface must feel **reassuring without being patronizing**. The professional interface must feel **efficient, accurate and operationally serious**. Both belong to the same refined brand, but their navigation and information densities should differ.

**Product promise:** “Know where you stand. See your best-supported options. Make the next decision with confidence.” Do not imply guaranteed improvement, financial returns, no risk, professional registration, SEC certification, SOC 2 certification, verified AI, or real bank integrations when absent.

## Phase 0 — Inspect before designing

1. Read root `CLAUDE.md`, `docs/product/SAGESPAN_V5_MASTER_SOURCE_OF_TRUTH.md`, `docs/product/FEATURE_STATUS_MATRIX.md`, `docs/architecture/DUAL_WORKSPACE_ADR.md`, `docs/legal/FEATURE_RELEASE_GATES.md`, and `docs/ai/AI_EVAL_MATRIX.md`; understand current branch status and any open PRs.
2. Inspect all existing marketing, personal and professional routes, `apps/web/src/app/globals.css`, `apps/web/src/ui/primitives`, `apps/web/src/ui/personal`, `apps/web/src/ui/console`, `apps/web/src/ui/ai`, Tailwind/theme configuration, font loading, icon library, Playwright specs and reusable forms.
3. Inventory all interactive financial behaviors and underlying source-of-truth rules. List route-by-route what is **implemented**, **synthetic/demo**, **disabled**, **proposed**, or **blocked by G1–G4**. Maintain these labels in the UI.
4. Capture representative 1440px, 1280px, 768px, 390px and 320px screenshots of existing pages when a browser is available. If browser rendering is unavailable, say so; do not pretend to have reviewed screenshots.
5. Produce `docs/design/UI_000_DESIGN_AUDIT.md`: current IA map, component inventory, accessibility gaps, content hierarchy issues, navigation problems, high-friction tasks, responsive risks, and a prioritized redesign plan. Include a named, maintainable design-system specification before extensive component rewrites.
6. **Do not overwrite financial engines, SQL migrations, RLS, actor/consent code, AI validation, calculation receipts, approval flows, audit events or legal release gates.** The initial visual PR should be presentation-only except for safe accessibility fixes and obviously isolated UI state.

## Desired art direction — premium, modern, trustworthy

Imagine an excellent balance of **high-end financial research software**, **quiet consumer wellness design**, and **finely crafted productivity SaaS**:

- **Aesthetic:** contemporary editorial minimalism, visually disciplined, intelligent, not sterile. Abundant intentional whitespace, crisp alignment, subtle separation, restrained elevation, nuanced shadows, excellent typography.
- **Brand posture:** dependable, calm, precise, transparent, sophisticated and human. Suggest “clarity and considered judgment,” not “AI magic.”
- **Theme:** start with beautiful warm/cool light-mode neutrals; support a high-quality dark mode later if proven valuable. Neither page should be a wall of navy blue or a glowing gradient.
- **Accent:** existing deep navy and deep teal provide a defensible visual foundation. Refine rather than discard brand identity unless a clearly superior reason is presented and approved.
- **Avoid:** generic purple gradients, oversized AI robot imagery, glassmorphism everywhere, neon line charts, artificial finance “health scores,” ornamental icon overload, distracting animation, weak gray typography, fake live market data, unnecessary card grids, arbitrary badges, and seven-paragraph alerts.
- **Photography/visuals:** prefer purposeful diagrams, typographic storytelling, and truthful product illustrations. Do not import copyrighted screenshots, stock trader visuals, fictitious endorsements, or watermarked assets. Use synthetic charts only with prominent demo labeling.

### Starting design tokens (refine systematically, do not scatter hex codes)

These are *recommended starting points consistent with current `globals.css`*, not an order to ignore the existing Tailwind token scheme:

```css
/* Directional examples: consolidate into your established token system. */
--ss-canvas: #F5F7FA;
--ss-surface: #FFFFFF;
--ss-surface-muted: #EEF2F6;
--ss-ink: #0B1F3A;
--ss-ink-muted: #4A5B73;
--ss-line: #D9E0E8;
--ss-navy: #0B1F3A;
--ss-teal: #0E7C72;
--ss-teal-soft: #DDF2EF;
--ss-warning: #B45309;
--ss-danger: #B42318;
--ss-radius-card: 14px;
```

- Typography: retain or refine **Schibsted Grotesk** (headlines) and **Public Sans** (body), with JetBrains Mono sparingly for hashes/receipts. Typography hierarchy should be unmistakable: display / H1 / H2 / section / body / supporting text. Body comfortable at 15–16px; minimum readable supporting text where possible; tabular figures for finances.
- Grid: 8px rhythm with purposeful 4px substeps; max readable dashboard width roughly 1280–1360px, content column lengths appropriate for reading, pinned sidebars on desktop, mobile content never clipped.
- Surfaces: selective rounded cards, 1px borders, subtle shadow only where useful; fewer cards, better structure. Use grouped sections, tables and inline data visualization where more effective than another card.
- Status colors: success green/teal only for actual successful *stated* action; warning amber for risk/uncertainty; red for genuine critical risk; neutral for draft/unsupported/unknown. **Never use color alone to communicate a status.**
- Animation: 120–220ms purposeful feedback, reduce-motion support, no distracting count-up money numbers or non-reproducible financial chart theatrics.
- Icons: consistent Lucide icons, 16–20px, one clear meaning; avoid icons in every headline.

## Information architecture — reduce cognitive load

**Keep current URLs stable initially** to avoid breaking E2E tests, user bookmarks and backend contracts. Navigation can group links without changing routes.

### Consumer IA: four clear primary groups

1. **Home** — Overview (`/demo/personal`) and My next steps (`/demo/personal/next-steps`).
2. **My Money** — Cash flow, Spending, Savings & debt (eventually Accounts and Bills after PERS-002).
3. **My Plan** — Goals, Retirement Studio, Scenarios.
4. **Guidance** — SageSpan Assistant, Learn; Privacy/Sharing/Settings in user menu.

Do not present eleven equal-weight tabs simultaneously. On 1440px desktop, use a quiet 232–256px grouped left rail with compact active states. On 390px mobile, use a focused bottom navigation of 3–4 primary destinations plus an accessible “More” / group navigation, or a tested compact alternative. Make sure all original routes remain reachable.

**Consumer home screen priority, above the fold:**
- A personal, non-intrusive welcome: “Your financial picture,” date/as-of badge, data completeness and sources.
- One distilled **“What matters this week”** statement, always based on actual computed findings.
- 3–4 meaningful metrics maximum: available liquid cash, essential monthly commitments, typical/low monthly margin and buffer coverage, each linked to source and calculation receipt.
- **Your next three steps**: short recommendation title, observed evidence, expected impact if validated, urgency, trade-off and a primary “Review” action; expanding details is a second interaction.
- Cash-flow outlook: modest 30/60/90-day timeline or uncertainty-banded chart (do not invent probabilistic bands) with clear upcoming bills, projected floor breaches and a chart-to-table alternative.
- What data is missing or stale: actionable panel rather than red “bad score.”
- Never make the AI chat the only way to use the product. The interface must be useful without a provider connection.

### Professional IA: serious, task-first assurance console

Keep separate professional navigation: Review queue · Clients · Evidence & imports · Checks · AI plan reviews · Reviews & approvals · Planning Studio · Firm settings. Group operations as useful, but preserve role-specific access and current URLs.

**Professional review dashboard priority:**
- Review queue with strong search, filter, sortable status, assigned reviewer, evidence gaps, rule coverage and age of review.
- Concise high-level counters that represent true system state, not decorative performance claims.
- Household workspace with clear steps: Sources → Reconciliation → Frozen snapshot → Checks → Draft AI findings → Human review → Packet.
- Each step shows status (ready, blocked, missing, unsupported, pending review, approved by named person) and the exact next permitted action.
- Dense tables are appropriate here; still support keyboard, focus, sticky headers, grouped columns and small-screen horizontal overflow intentionally.
- Reviewer signoff must always be distinct from AI output and from a successful calculation.

### Retirement Studio IA

Do not invent a retirement-age success score or projected ending net worth while the engine does not exist. Current page remains a polished **readiness/intake** experience with missing/assumed/known data. When PLAN-001 is independently validated, reveal:
- A base-case age/time horizon visualization and annual balance/withdrawal ledger.
- Side-by-side A/B scenario cards with identical assumption basis, clearly labeled differences, real versus nominal dollars, incomplete scope notice and source citations.
- Consequences and tradeoffs—not a glowing “optimal plan” stamp.
- A discrete “Share with advisor” consent flow, only after PR-003 supports real grants and revocation.

## Screen and component specifications

### 1. Public website / marketing

Build a refined, confident landing page with a purpose-driven layout:
- Header: SageSpan brand, Personal, Retirement Planning, For Advisors & Firms, How It Works, Security & Trust, Pricing. Sign in must route to truthful gate while production auth is unavailable.
- Hero: short, lucid benefit statement; 2 audience pathways, CTA “Explore personal demo” and “See the professional workflow”; synthetic-demo limitation nearby. No misleading animated market chart.
- Outcome narrative: Where you stand → What matters → Options worth considering → You're in control.
- Three product pillars as useful concise panels, differentiated by use case.
- Trust section about *design controls actually implemented*, not claims of independent certification.
- Real interface previews or purpose-built illustrative diagrams generated from supported synthetic fixture data.
- Thoughtful B2C/B2B segmentation, mobile hero and footer, SEO/semantic headings, clear waitlist/pilot interest with truthful privacy messaging.
- Pricing remains explicitly **illustrative research hypotheses**, never auto-billed or falsely announced.

### 2. Consumer guided intake (future PERS-002 experience)

Use a non-threatening step-by-step flow with progress disclosure and “Skip / Not sure” controls. Pre-emptively design states without claiming it is implemented. On creation, first provide UI specs/mock states until the forms and secure storage exist. Fields are grouped by context with money/date helpers and example explanations; users can review before computation. Never substitute zeros for unanswered questions. Each field can show “user reported”, “assumed”, “stale” and later “verified evidence” distinctions.

### 3. Financial overview and cash-flow page

- Consistent top bar with as-of date, source state, last recompute, workspace switch if real auth permits; a refresh button with clear progress and retry.
- Curated summary metrics with unobtrusive tooltip “How we calculated this”.
- Dated outlook chart with bills/income as semantic markers, clear cash floor and numerical table for screen readers.
- Flag rows should indicate magnitude, due date and concrete option rather than fear-inducing alert storm.
- Empty state and failed calculator state must be first-class screens; never present a fictitious value as current.

### 4. Spending

- Category trends and composition with actual denominators, selected date range and sample size.
- Pending / unmatched / duplicate / transfers / refunds explicit; category totals only mean what the data shows.
- In current demo, do **not** claim automatic transfers/refund detection; existing inputs are manual and `transfers_excluded` can be false.
- When transactions arrive, add simple merchant correction, transaction detail, recurring candidates and source trace.

### 5. Savings, debt and decision comparisons

- Separate current balances, required payments, liquidity floor, extra-payment budget and achievable versus illustrative payoff paths.
- Comparison should distinguish **paying more each month** from **changing repayment priority under the same monthly budget**.
- Promotional APR / variable APR warnings visible on paths and in assumptions.
- Cash-flow feasibility must be shown separately from amortization feasibility; do not use success styling for a path that violates the user's cash floor.
- Cards for “Pay extra,” “Build reserve,” “Adjust goal date,” etc. include no-pressure alternatives and “Ask why.”

### 6. AI Guidance / AI Plan Review

- Call the current consumer tool **SageSpan Assistant — demonstration**, visibly labeled **offline/mock** where appropriate. No “real AI intelligence” marketing claim until a live adapter is validated.
- Conversation or insight UI should have citations linked to specific evidence, calculation receipt and assumptions; badges should reflect real statuses only.
- Group findings by question, issue and next action; allow accept/edit/dismiss/request evidence where authorized, with separate event histories.
- For firms, use an **AI-drafted findings panel** beside—not replacing—human reviewer controls. Distinguish `DRAFT`, `TOOL_BACKED`, `UNVERIFIED`, `HYPOTHESIS`, `UNSUPPORTED`, `ERROR`, and actual `HUMAN_APPROVED` with text and color.
- Provide a compact but meaningful “Why this is suggested” drawer: evidence sources, exact tool/model/prompt versions, confidence/uncertainty phrased honestly, omitted scope, last-updated time and reviewer notes.
- If the provider is unavailable, show retry or read-only baseline; no fake animated typing leading to hardcoded “AI” insight without a label.

### 7. Professional evidence and approvals

- Evidence panels display source names, date, file hash, state, conflict and locator when verified. Avoid implying a filename is a trusted statement.
- Stepper/timeline showing “Import → Reconcile → Freeze → Check → Review → Export.”
- Exceptions are visible; a review approval by a named authorized person is not a green “SEC-compliant” badge.
- Drill-down drawers and keyboard shortcuts only when documented and safe; every destructive action needs appropriate confirmation.

## Microcopy and communication principles

- Write in everyday precise language, especially to consumers: “Your income varied over three observed months,” not “We detected a risky financial pattern” without support.
- Support agency and emotional calm. Avoid shame (“poor discipline”), gamification, vague “financial health” grades, or alarmist red dashboards.
- Use first person user-directed labels sparingly and accurately: “Your next steps,” “What we don't know,” “Why this option.”
- Conditional language for scenario hypotheses (“Under these assumptions,” “If expenses stay near…”). Distinguish a historical observation from a future projection.
- Avoid hiding caveats in legal footers; important limitations belong adjacent to the relevant figure or recommended action.
- When a calculation service is down or input incomplete, display an honest status and recovery path. Never invent a fallback numeric prediction in JS.

## UX system and accessibility acceptance

**Target WCAG 2.2 AA** for public, consumer and professional surfaces. Implement and test:
- Semantic header/nav/main/footer, labeled regions, sensible heading hierarchy, accessible names for actions and inputs.
- 4.5:1 typical text contrast and 3:1 for large text/UI components as applicable; distinct icon/text labels for statuses.
- Full keyboard use for nav, dialogs, charts' alternative tables, forms, dropdowns and review actions; visible focus rings, focus restoration on close, no traps except intentional modal behavior.
- Reduced motion and no scroll-jacking; skip-to-content; meaningful error summaries and `aria-live` for async results where appropriate.
- Touch targets comfortable, no horizontal overflow at 320/375/390px (except intentionally controlled data tables), proper reflow at tablet; user can zoom to 200%.
- Tested loading, first-run empty, incomplete, stale, unsupported, service error, permission denied, revoked consent, offline/no model, success and review-required states.
- Charts must have text equivalent, actual axes, units, dates, source/timeframe, hover/focus tooltips and no deceptive truncation.
- Design tokens and components documented in a small Storybook or equivalent component gallery if low-overhead; visual regression screenshots.

## Technical constraints and implementation pattern

- **Keep Next.js 16 App Router, React 19, TypeScript, Tailwind and existing design primitives.** Prefer token and component consolidation; avoid adding large UI dependencies unless justified and approved.
- No financial calculations in React or client code; all figures from existing server-calculated, versioned receipts. No changed rounding, statuses, dates, underlying data or permissions as a side effect of styling.
- Do not modify database migrations, Python calculator, financial golden fixtures, Zod financial contracts, authorization or approval logic in a UI PR.
- Respect `server-only` imports and React server/client component boundaries; keep client JS small and layout performant.
- Use typed view models/components, visible skeleton and failure states, source links and consistent formatting. Do not duplicate business logic across pages.
- Preserve current `/demo/personal/*`, `/demo/app/*`, marketing URLs and `/app` production gate. If proposing a route change, document redirect and test impact, request founder approval before breaking routes.
- Keep synthetic banners visible and persistent during demo. Do not make fictional charts look like a customer's real account. Never accept real payment/login credentials in the demo.
- Ensure mobile navigation does not require 11 equal-weight menu items; use progressive disclosure and test reachability.
- Build with existing `lucide-react`, minimal motion and no external copyrighted UI screenshots.

## Deliverable order / PR boundaries

### UI-000 — Design audit and approval (NO UI CODE CHANGE)
Output:
- `docs/design/UI_000_DESIGN_AUDIT.md`: current screens, problems, role-specific IA, UX flows, state map, risk list, supported vs proposed features.
- `docs/design/UI_001_DESIGN_SYSTEM_SPEC.md`: typography, palette, tokens, spacing, components, charts, navigation, accessibility.
- `docs/design/UI_001_PAGE_BLUEPRINTS.md`: wireframe-in-text for 1 home, 1 cashflow, 1 scenarios, 1 AI view, 1 firm queue, 1 firm household review, and 1 marketing page, each desktop/mobile.
- A phased, small-PR implementation plan with estimated complexity bands (S/M/L) and screenshot/interaction acceptance criteria. Explicitly call out any requested feature that is backend-blocked.

### UI-001 — Foundations, navigation and visual system (FIRST CODE PR)
Implement refined tokens, typography, buttons, cards, inputs, nav shells, status components, empty/skeleton/error states, spacing and responsiveness while **retaining business behavior**. Desktop and mobile screenshots, axe, keyboard, Playwright existing flows. Avoid widespread page rewrites yet.

### UI-002 — Consumer priority journeys
Redesign Overview, Next steps, Cash flow, Savings & debt, and Scenarios around semantic evidence and feasible decisions. Keep PERS-002 missing form features in documented mock/spec state only; do not invent API endpoints.

### UI-003 — Advisor assurance journeys
Redesign queue, household, checks, AI findings, approvals, evidence export, and firm workflow chrome; enhance density and review speed, without changing authorization.

### UI-004 — Public website and product storytelling
Refine landing/pillar pages, segment entry points, product demos, trust copy and pricing hypotheses. SEO/performance/accessibility.

### UI-005 — Polish and usability validation
Conduct user test tasks, keyboard walkthrough, accessibility review, visual regression, chart readability, mobile audits, performance profiling and stress/error-state verification. Report fixes and remaining gaps.

## Required output in the first Claude Code session

Before editing code, return:
1. Current branch/status/commit and whether V5 is merged or isolated.
2. Audit of existing UI and UX against this brief, specific file references and screenshots where possible.
3. Recommended navigational hierarchy and text-based desktop/mobile wireframes, including evidence panel design.
4. Tokens, typography, component APIs and page-level design recipes.
5. List of exact files for **UI-001 only**, risk assessment and how to avoid conflicts with PR-002/PR-003/Personal feature branches.
6. Test plan and definition of done, including 320/390/768/1280/1440 widths, keyboard and screen readers, and existing 11 Playwright flows.
7. Clear list of items needing founder decision (if any), then implement **UI-001** on its own branch only when the project instructions permit.

At the end of each implementation PR, provide **before/after screenshots, visual changes, accessibility evidence, exact test results, files changed, known limitations and remaining UI milestone**.

## Final design standard

The goal is not just a prettier dashboard. A consumer should open SageSpan and feel **in control, informed and never overwhelmed**. An advisor should instantly know what requires attention, what evidence supports each number, what is outside validated scope, and which action is permitted next.

**Beautifully design the boundaries between uncertainty, calculation, explanation, and human decision. Those boundaries are SageSpan's product advantage.**
