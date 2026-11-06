# SageSpan (provisional brand) — independent retirement plan assurance

> Synthetic prototype. SageSpan is a provisional working name pending trademark
> and domain clearance. Nothing here processes real client data, accepts
> payments, or claims any certification.

SageSpan reviews retirement plans produced in other planning software for U.S.
RIA firms: import a permitted plan export and source statements, reconcile typed
facts, freeze an immutable snapshot, independently re-check a supported rule in a
separate deterministic engine, classify differences, record an authorised human
review, and export a review evidence packet.

First supported check: the 2026 required minimum distribution for a living owner
of a non-inherited traditional-family IRA. Golden case: `$640,000.00 / 25.5 = $25,098.04`.

## Repository

```
apps/web/              Next.js 16 marketing site + synthetic assurance console (demo mode)
services/calculator/   FastAPI calculation & verification service (Decimal, versioned rules, receipts, pytest)
packages/contracts/    Shared Zod/TS contracts, workflow state machine, permissions, pricing hypothesis
supabase/              Postgres migrations, RLS policies, workflow functions, pgTAP tests
fixtures/synthetic/    Fictional households, source documents, import samples, engine fixtures
docs/                  Architecture, financial methodology, security & limits, roadmap, decisions
00_*.md … 10_*.md      Founder V3 context pack (canonical product/business decisions)
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

Open http://localhost:3000. The console is at `/demo/app` with a persona
switcher (simulated reviewers). Start with the Patel household.

## Test

| Command | What it runs |
|---|---|
| `npm run test:calc` | pytest: RMD golden cases, classification, receipts, API auth/tenant, OpenAPI drift |
| `npm test` | Vitest in `packages/contracts` and `apps/web` (workflow, tenant isolation, imports, CSV safety, live-service integration when the service is up) |
| `npm run typecheck` / `npm run lint` / `npm run build` | strict TypeScript, ESLint, Next production build |
| `npm run test:e2e` | Playwright browser flow (starts both servers): public nav, unsupported import, Patel conflict → export, cross-tenant 404 |
| `supabase test db` | pgTAP RLS/workflow tests — **requires Docker; not executed in this build** |

## Documentation

* `CLAUDE.md` — founder decisions, implementation status, milestone log, conventions
* `docs/ARCHITECTURE.md` — components, data model, request flow, what still needs configuration
* `docs/FINANCIAL_METHODOLOGY.md` — exactly what the engine computes and refuses
* `docs/SECURITY_AND_LIMITS.md` — threat model, controls, verification status, release gates
* `docs/ROADMAP.md` — P0 completion, P1, P2, deferred
* `docs/DECISIONS.md` — decision record

## Boundaries

No planning-tool replacement, no trading or money movement, no automated
approval, no AI arithmetic, no vendor integrations, no SOC 2 / SEC / "exam-proof"
claims, no live pricing. Pricing shown on `/pricing` is an illustrative hypothesis.
