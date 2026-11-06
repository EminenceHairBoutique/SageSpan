# SageSpan (provisional brand) — financial clarity, retirement planning and independent plan assurance

> Synthetic prototype. SageSpan is a provisional working name pending trademark
> and domain clearance. Nothing here processes real client data, accepts
> payments, connects to a bank or broker, or claims any certification. Not advice.

**V5 (founder decision 2026-11-05): one platform for two audiences.**

* **SageSpan Personal (B2C)** — where do I stand, what matters most, what can I
  realistically do next. Manual entry first. A receipted deterministic baseline
  (margin, buffer, dated 90-day outlook), a debt payoff comparison, a versioned
  decision policy that proposes at most three feasible actions with their
  trade-offs, an AI assistant that explains the baseline and cannot invent a
  number, and a Tier-0 education module. Demo: `/demo/personal` (fictional
  Maya Castillo).
* **SageSpan Advisor & Assurance (B2B)** — import a permitted plan export and
  source statements, reconcile typed facts, freeze an immutable snapshot,
  independently re-check a supported rule in a separate deterministic engine,
  classify differences, read a grounded AI draft review, record an authorised
  human review, and export a review evidence packet. Demo: `/demo/app`.
* **Retirement Studio (both)** — readiness gate today; projection engine
  (PLAN-001) proposed.

Operating rule: **AI proposes and explains. Deterministic engines calculate.
Policy and authorisation constrain. People decide.**

First supported assurance check: the 2026 required minimum distribution for a
living owner of a non-inherited traditional-family IRA. Golden case:
`$640,000.00 / 25.5 = $25,098.04`. First personal engines:
`personal.cashflow_baseline@2026.1` and `personal.debt_amortization@2026.1`.

## Repository

```
apps/web/              Next.js 16 site + synthetic Personal workspace (/demo/personal) + firm console (/demo/app); src/ai = AI review layer
services/calculator/   FastAPI calculation service: RMD rules + personal cash-flow and debt engines (Decimal, versioned sets, receipts, pytest)
packages/contracts/    Shared Zod/TS contracts: firm domain, workspaces/consent, personal records, decision policy, AI contracts, pricing hypotheses
supabase/              Postgres migrations (0001–0006), RLS policies, workflow functions, SQL tests — unchanged in V5 session 1
fixtures/synthetic/    Fictional households (firm) and the Castillo personal fixture; engine request/response goldens
docs/                  V5 blueprint (docs/product), engineering prompt, traceability, feature matrix, ADR, AI eval matrix, release gates, model registry
00_*.md … 10_*.md      Founder V3 context pack — SUPERSEDED by V5 for market direction (kept as history)
```

## Run locally (two processes, no cloud accounts)

Prerequisites: Node 20+, Python 3.12+.

**1) Calculation service — first time only** (from the repository root):

```powershell
# Windows PowerShell
cd services\calculator
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

```bash
# macOS / Linux
cd services/calculator
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
```

**Start it** (any shell, from `services/calculator` with the venv active):

```bash
python scripts/dev.py            # http://127.0.0.1:8010, demo mode, auto-reload
```

`scripts/dev.py` sets `CALC_DEMO_MODE=1` for its own process, so it works the
same in PowerShell, cmd.exe and bash. To run uvicorn directly instead, set the
variable with your shell's syntax first:

| Shell | Command |
|---|---|
| PowerShell | `$env:CALC_DEMO_MODE = "1"; uvicorn app.main:app --port 8010 --reload` |
| cmd.exe | `set CALC_DEMO_MODE=1` then `uvicorn app.main:app --port 8010 --reload` |
| bash / zsh | `CALC_DEMO_MODE=1 uvicorn app.main:app --port 8010 --reload` |

Note: in PowerShell, `set X=1` does **not** set an environment variable (`set`
is an alias for `Set-Variable`), which produces
`RuntimeError: CALC_SERVICE_TOKEN is not set` at startup. Run `python -m venv
.venv` only once; re-running it while the venv is active fails with
`Unable to copy ... venvlauncher.exe` (harmless, the existing venv is fine).

**2) Web** — in a second terminal, from the repository root:

```powershell
# Windows PowerShell
npm install
Copy-Item .env.example apps\web\.env.local
npm run dev:web
```

```bash
# macOS / Linux
npm install
cp .env.example apps/web/.env.local
npm run dev:web
```

Open http://localhost:3000. The Personal demo is at `/demo/personal` (fictional
individual, receipted baseline, next steps, scenarios, assistant). The firm
console is at `/demo/app` with a persona switcher (simulated reviewers); start
with the Patel household and its new **AI review** tab.

## Test

| Command | What it runs |
|---|---|
| `npm run test:calc` | pytest: RMD golden cases, classification, receipts, API auth/tenant, OpenAPI drift, personal cash-flow and debt-path goldens |
| `npm test` | Vitest in `packages/contracts` (incl. decision policy, workspace authority) and `apps/web` (workflow, tenant isolation, imports, CSV safety, personal snapshot/receipt discipline, the 28-case AI evaluation suite, live-service integration when the service is up) |
| `npm run typecheck` / `npm run lint` / `npm run build` | strict TypeScript, ESLint, Next production build |
| `npm run test:e2e` | Playwright (starts both servers): public nav, Patel conflict → export, cross-tenant 404, both audience paths, Personal baseline/decisions/scenarios/assistant/balance revision, firm AI draft, workspace isolation, mobile. Set `SAGESPAN_E2E_CHROME_PATH` to use an installed Chrome |
| `supabase test db` | pgTAP RLS/workflow tests — **requires Docker; not executed in this build** |

## Documentation

* `docs/product/SAGESPAN_V5_MASTER_SOURCE_OF_TRUTH.md` — controlling V5 specification; `docs/product/FEATURE_STATUS_MATRIX.md` — what is implemented vs proposed
* `docs/architecture/DUAL_WORKSPACE_ADR.md`, `docs/ai/AI_EVAL_MATRIX.md`, `docs/legal/FEATURE_RELEASE_GATES.md`, `docs/finance/RULE_VERIFICATION_AND_MODEL_REGISTRY.md`
* `CLAUDE.md` — founder decisions, implementation status, milestone log, conventions
* `docs/ARCHITECTURE.md` — components, data model, request flow, what still needs configuration
* `docs/FINANCIAL_METHODOLOGY.md` — exactly what the engine computes and refuses
* `docs/SECURITY_AND_LIMITS.md` — threat model, controls, verification status, release gates
* `docs/ROADMAP.md` — P0 completion, P1, P2, deferred
* `docs/DECISIONS.md` — decision record

## Boundaries

No trading or money movement, no personalised securities/tax/insurance advice
(decision tiers 3–4 disabled in code pending counsel), no automated approval, no
AI arithmetic, no bank/broker/vendor integrations, no SOC 2 / SEC / "exam-proof"
claims, no live pricing. Pricing shown on `/pricing` is an illustrative hypothesis
for both audiences.
