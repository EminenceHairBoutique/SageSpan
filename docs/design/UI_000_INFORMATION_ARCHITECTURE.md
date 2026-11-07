# SageSpan dual-market information architecture

**Document:** `docs/design/UI_000_INFORMATION_ARCHITECTURE.md` · **Version:** 1.1 (IA decisions recorded) · **Date:** 2026-11-06 · **Status:** specification (UI-000, documentation only)
**Baseline:** `master` @ `5299791`; reconciled with PR #10 (`feat/pr-003-identity`: `/app/sign-in`, `ProductionHome`, workspace and consent resolution) and PR #11 (docs/fixtures).
**Controlling sources:** `docs/product/SAGESPAN_V5_MASTER_SOURCE_OF_TRUTH.md` §2, §7, §8; `docs/architecture/DUAL_WORKSPACE_ADR.md`; `docs/product/FEATURE_STATUS_MATRIX.md`; `docs/design/03_SageSpan_Claude_Code_UI_UX_Master_Prompt.md`.

> Rule for every phase: **URLs stay stable.** Navigation groups, labels and shells change; routes under `/`, `/demo/personal/*`, `/demo/app/*` and `/app/*` do not. Any route change needs a redirect plan, Playwright updates and founder approval (none proposed here).

---

## 1. Principles

1. **One brand, three pillars, two workspaces.** The public site explains *SageSpan Personal*, *Retirement Studio* and *Advisor & Assurance*. Signed-in people land in exactly one workspace type at a time: a Personal/Household workspace or a Firm workspace. Retirement Studio is a *section* inside each workspace, not a third workspace, because its authority differs by who is using it (ADR-V5-001 §1).
2. **Lifecycle over feature list.** Every workspace is organised around Discover → Diagnose → Develop/Design → Review/Decide → Monitor (V5 §8). The navigation does not spell out the stage names, but each group maps to stages, and each page header says which stage the person is in.
3. **Decision rights are visible in the structure.** Consumer navigation ends in "your decision" surfaces (Next steps, Scenarios); professional navigation ends in "recorded professional act" surfaces (Reviews & approvals, Evidence). AI surfaces sit *before* those and are labelled drafts.
4. **Honest status is part of the IA.** Proposed or gated capabilities get a real page with a real status, never a dead link or a mocked control (today: Planning studio, Privacy grants, Shared goals). The IA lists them so the shells can show them consistently.
5. **No implicit crossing.** Nothing in the Firm navigation reaches a Personal workspace; "Shared with you by consent" is the only bridge, and it is read-only and revocable (ADR §3; PR #10 `ProductionHome` "Shared with you by consent").

---

## 2. Site map

```
PUBLIC SITE  (apps/web/src/app/(marketing))                 Workspace shells
├── /                       Home: two paths, one principle   
├── /personal               SageSpan Personal (pillar page)  
├── /retirement             Retirement Studio (pillar page)  
├── /firms                  Advisor & Assurance (pillar page)   ← /product redirects here
├── /how-it-works           Lifecycle × audience × controls  
├── /security               Security & Trust (design, not certification)
├── /pricing                Pricing hypotheses               
├── /demo                   Synthetic tour (Personal + Firm) 
└── /app  ── Sign in ───────────────────────────────────────► ACCOUNT / IDENTITY (PR #10)
                                                               ├── /app/sign-in     (Supabase configured)
                                                               ├── /app             ProductionHome: firms · workspaces · shared-with-you
                                                               └── /app/[...rest]   gate until the store adapter exists

PERSONAL / HOUSEHOLD WORKSPACE  (/demo/personal today; /app/… later)     FIRM WORKSPACE  (/demo/app today; /app/… later)
Home                                                                      Work
├── Overview                 /demo/personal                               ├── Review queue            /demo/app/reviews
└── Next steps               /demo/personal/next-steps                    └── Clients & households    /demo/app/clients
My money                                                                  Evidence & checks
├── Cash flow                /demo/personal/cash-flow                     ├── Imports & evidence      /demo/app/imports
├── Spending                 /demo/personal/spending                      ├── Checks                  /demo/app/checks
└── Savings & debt           /demo/personal/savings-debt                  └── AI plan review          /demo/app/ai-review
My plan                                                                   Decisions
├── Goals                    /demo/personal/goals                         └── Reviews & approvals     /demo/app/approvals
├── Retirement Studio        /demo/personal/retirement                    Studio
└── Scenarios                /demo/personal/scenarios                     └── Planning studio         /demo/app/planning-studio   (status page)
Guidance                                                                  Firm
├── SageSpan Assistant       /demo/personal/assistant                     └── Firm settings           /demo/app/settings
└── Learn                    /demo/personal/learn                         
User menu (rail footer / More sheet)                                      Household workspace  /demo/app/households/[id]
├── Privacy & sharing        /demo/personal/privacy                       ├── Overview (sources, facts, freeze gate)
├── Switch person (demo)     form                                         ├── Imports
├── Start fresh (intake)     /demo/personal/intake/welcome → [step]       ├── Checks
└── Workspace switcher       (PR-003; demo: persona switcher)             ├── AI review
                                                                          ├── Review
                                                                          └── Evidence
```

Routes not in the map: `/api/*` (data), `/demo/app` → redirects to the queue, `/demo/personal/intake` → `welcome`, `not-found`.

---

## 3. Audience × lifecycle matrix

Status vocabulary follows `FEATURE_STATUS_MATRIX.md`: **Implemented (synthetic)**, **Offline mock**, **Proposed**, **Gated (Gn)**. The last column is the control the UI must make visible at that stage.

| Stage | Personal / Household | Retirement Studio | Advisor & Assurance | Visible control |
|---|---|---|---|---|
| **1 Discover** | Intake (`/intake/[step]`), record add/edit/retire on Cash flow, Spending, Savings & debt, Goals — *Implemented (synthetic)*. Connected accounts — *Gated G3*. | Readiness intake (`/demo/personal/retirement`) — *Implemented*. | Imports & evidence; household Imports tab (upload, CSV mapping, reconcile) — *Implemented*. Client onboarding / client-to-firm grants — *Proposed (PR-003)*. | Data states (You reported / Verified from a document / Assumed / Missing / Stale / Conflicting); source hash and as-of date; synthetic banner |
| **2 Diagnose** | Overview stats, flags, "What I don't know yet", Cash flow outlook, Spending, Savings & debt totals — *Implemented*, receipted. | Readiness gate (known / assumed / missing) — *Implemented*. Projection — *Proposed (PLAN-001)*. | Household Overview facts + freeze gate; household Checks (independent RMD check, coverage) — *Implemented*. | Receipt on every figure; calculation result vocabulary (PASS / NOT_REQUIRED / UNSUPPORTED / INDETERMINATE / ERROR); freeze gate blockers with the next permitted action |
| **3 Develop / Design** | Scenarios (debt paths, what-ifs) — *Implemented*. | Scenario comparisons — *Proposed (PLAN-001)*; page lists them as "Not yet available". | Planning studio — *status page only*; scenario proposals (AI-003) — *Proposed*. | Identical-inputs comparison; INFEASIBLE never capped; assumptions and limitations from the receipt |
| **4 Review / Decide** | Next steps (policy ranking, Ask why, Done / Snooze / Not relevant / Disagree) — *Implemented*. SageSpan Assistant "Understand my finances" — *Offline mock*. Tier 3 advice — *Disabled (REG-001)*. | Share with advisor — *Proposed (PR-003)*. | AI plan review (draft findings, Accept / Edit / Dismiss / Request evidence) — *Offline mock*; Review (conflicts, dispositions, record review, approve with attestation, typed coverage outcome) — *Implemented*. | Human-decision surfaces are never teal until the act is recorded; AI marked "draft" permanently; approval outcome (SUPPORTED_CHECK_VERIFIED / REVIEWED_WITH_LIMITATIONS / APPROVED_WITH_EXCEPTIONS) derived server-side |
| **5 Monitor** | Recompute from new snapshot after any change; quiet mode preference — *Implemented*. Notifications — *Proposed (AI-005)*. | Re-check after input change — *Proposed*. | Evidence packets (JSON / HTML / CSV, hashed), audit trail, re-run semantics (latest attempt) — *Implemented*. Rule-change impact previews — *Proposed*. | Snapshot id, revision, as-of, method/rule versions on every page; history never deleted, shown as history |

---

## 4. Navigation model

### 4.1 Public site header (marketing)
* ≥ md: brand lockup · Personal · Retirement Studio · For Advisors & Firms · How It Works · Security & Trust · Pricing · Sign in · **Plan My Finances** (secondary) · **Explore for Firms** (primary). Rename "Retirement Planning" → "Retirement Studio" so the nav, footer and pillar page agree (Playwright `dual-market.spec.ts` asserts the label "Retirement Planning"; update in the same PR).
* < md: brand lockup · **Menu** button (`aria-expanded`, opens a full-width disclosure listing the six links, Sign in and both CTAs). The current horizontally scrolling strip is removed; it hides "Pricing" and "Sign In" off-screen on a 390 px phone with no affordance.
* The header must fit on one line at 1280 and 1440 px (today every link wraps to two lines at 1440 px because of the "provisional name" pill and two CTAs). Move "provisional name" to a `title`/footer marker on ≥ md and keep it in the footer always.

### 4.2 Personal workspace
* **Desktop rail (240 px):** four groups as in the site map, group labels in eyebrow style, 36 px rows with icons; active item has wash + left bar + `aria-current="page"`. Rail footer: workspace name, person (demo: "Demo person: Maya Castillo (owner)"; production: real name), Privacy & sharing, Switch person (demo only), Start fresh (demo only), Workspace switcher (PR-003).
* **Mobile (< md):** sticky top bar (brand, workspace, as-of) + **bottom navigation**: Home · Money · Plan · More. "Money" opens Cash flow with in-page tabs to Spending and Savings & debt? No: to keep URLs and tests stable, "Money" lands on Cash flow and the **More** sheet lists every route under its group plus the user items. All 11 current routes remain one or two taps away; `dual-market.spec.ts` "mobile: personal overview renders banner, navigation and content at 390px" must still find a navigation named "Personal workspace".
* **Page header** on every page: eyebrow = group name (e.g. "My money"), h1, lead, actions, meta (as-of · snapshot · method · receipt status).

### 4.3 Firm workspace (console)
* **Desktop rail (256 px):** five groups as in the site map. Keep the eight existing routes and labels; add the active state (missing today) and the group labels. Rail footer: firm name, "Simulated reviewer: Name (ROLE)" (demo) / signed-in member (production), Firm settings, Workspace switcher (PR-003).
* **Top bar:** breadcrumb (Review queue / Household) · persona switcher (demo) or user menu (production). The persona switcher stays visually marked as a simulation.
* **Mobile:** the horizontal strip gains `aria-current`, 44 px targets and an overflow "More" button; dense tables scroll horizontally inside a labelled region with an edge fade. The console is desktop-first by product decision (V5 §7.2) but must remain operable and readable on a phone for look-ups.
* **Household workspace:** breadcrumb, h1 (household), workflow chip, **stepper** (Imported → Reconciled → Frozen → Checked → Reviewed → Approved / exported; exists as `Checkpoints`), six tabs. Each tab's page header states the stage, the status and the exact next permitted action for the current role (today this is spread across disabled-button reasons).

### 4.4 Account, identity and workspace switching (designing for PR #10, not changing it)
* `/app` (unconfigured): `ProductionGate` — unchanged content, restyled by UI-001 tokens only.
* `/app/sign-in`: `SignInForm` inside a centred auth layout (max-w-md card, brand lockup, "Production workspace" subtitle, no synthetic banner because nothing synthetic is shown). UI phases do not edit `SignInForm.tsx`, `ProductionHome.tsx`, `app/app/**` until PR #10 merges; they consume `Card`, `Field`, `Alert`, `buttonClasses`, `inputClasses` from primitives, so UI-001 keeps those APIs stable.
* `/app` (signed in): `ProductionHome` lists firm memberships, workspaces and consent-granted scopes with "Select" actions. The IA treats this as the **workspace chooser**; UI-003 proposes to lift the same three lists into a `WorkspaceSwitcher` in both rail footers (same server actions `selectOrgAction` / `selectWorkspaceAction`), after PR #10 merges.
* Consent grants: Personal → *Privacy & sharing* shows grants given (grantee, domains, purpose, expiry, revoke) and invitations; Firm → *Clients & households* shows "Shared with you by consent" rows with a read-only badge and the granted domains. Both are **Proposed** until PR-003's controls exist; the UI specs are in the blueprints so the empty states and copy are ready.

---

## 5. Naming decisions (canonical labels)

| Concept | Canonical label | Replaces (found in code) |
|---|---|---|
| Pillar 1 | **SageSpan Personal** (nav: "Personal") | — |
| Pillar 2 | **Retirement Studio** (nav: "Retirement Studio"; personal rail: "Retirement Studio") | "Retirement Planning" (SiteNav), "Retirement" (PersonalNav) |
| Pillar 3 | **Advisor & Assurance** (nav: "For Advisors & Firms") | "Planning Intelligence / Assurance Intelligence" as *product names* (keep as capability names inside the pillar page only) |
| Consumer AI | **SageSpan Assistant (demonstration)**; page title "Understand my finances" | "AI assistant" |
| Firm AI | **AI plan review (draft)** everywhere; household tab "AI review (draft)" | "AI plan review" / "AI review" / "Analyze plan" |
| Firm settings | **Firm settings** (page h1 too) | "Settings" |
| Approvals page | **Reviews & approvals** | — (keep; distinct from "Review queue") |
| Identity line | Demo: "Simulated reviewer: …" / "Demo person: …"; production: "Signed in as …" | "Acting as", "Signed in as" (demo) |
| Capability status | Working (synthetic) · Working (offline mock) · Proposed · Gated (Gn) · Not in this build | seven variants |

---

## 6. States every screen must have

| State | Trigger | Required presentation |
|---|---|---|
| Loading | route transition, server action pending | `loading.tsx` skeleton per route group; pending label on the button |
| Empty (no data) | new workspace, no runs | `EmptyState` with the reason and the primary action |
| Insufficient data | engine returns `INSUFFICIENT_DATA` | amber notice naming what is missing + link to add it; no numbers invented |
| Service unavailable | calculator or AI provider unreachable | `ServiceState` with retry; existing copy "Nothing is estimated in the browser or on this server" |
| Unsupported / indeterminate | engine typed non-result | result chip + reasons + "what would make this supported" |
| Permission denied / not found | role or tenant | existing non-disclosing not-found; disabled actions show the reason |
| Revoked / expired consent | PR-003 | "This share ended on …" notice, no data |
| Offline / mock provider | always in this build | slate "Deterministic offline mock" notice near the AI control |
| Stale / superseded | older snapshot, earlier attempt | history style + "kept as history" text |
| Success | recorded human act | teal `role=status` notice naming the act and the next step |

---

## 7. Founder decisions on the IA (decided 2026-11-06)

The founder accepted all recommendations on 2026-11-06 (see the roadmap's decision record, D1–D7):

1. **Decided:** the public nav item "Retirement Planning" becomes "Retirement Studio" (D1; `dual-market.spec.ts` updated in the same PR, UI-001b).
2. **Decided:** the Personal mobile bottom navigation has four items (Home · Money · Plan · More); the Assistant is one tap inside More and is never the primary way to use the product (D2, UI-001b).
3. **Decided by recommendation:** the console stays desktop-first per V5 §7.2 and gets an operability pass only (no mobile-first redesign).
4. **Decided:** one interim brand mark (navy tile) on all three surfaces now (D3, UI-001b); a purpose-designed mark waits for brand clearance.
