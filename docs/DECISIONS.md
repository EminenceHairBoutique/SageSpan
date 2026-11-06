# Decision record (V3 founder decisions and implementation choices)

Baseline: 2026-11-05. Founder decisions come from `01_FOUNDER_DECISIONS_AND_POSITIONING.md`
and `10_CHANGELOG_V1_V2_V3.md`; implementation choices were made during the
first vertical-slice build and are recorded here so they are not relitigated.

## Founder decisions (adopted, not up for re-decision per turn)

| # | Decision | Qualification |
|---|---|---|
| 1 | Brand: **SageSpan**, provisional | Trademark/domain clearance pending; brand strings centralised in `apps/web/src/config/brand.ts` |
| 2 | Product: B2B independent retirement plan assurance | Not a planner, robo-advisor or trading tool; five-stage lifecycle retained as a long-term map |
| 3 | Buyer: U.S. RIAs ~5–50 advisors; CCO champion, owner/CEO/COO economic buyer, lead advisor adoption | ICP and buyer roles are hypotheses to verify in interviews |
| 4 | Stack: Next.js App Router + strict TS + Tailwind; Supabase/Postgres/Auth/RLS; separate Python/FastAPI calculation service from day one; queue/workers later | No retirement math in React/Next; no heavy compute in Vercel handlers |
| 5 | Pricing hypothesis: $750/month incl. 100 active monitored households, $3.50 per additional, $500/month pilot up to 50 | Illustrative, not offered; no billing |

## Implementation decisions

| Decision | Rationale |
|---|---|
| Greenfield monorepo (`apps/web`, `services/calculator`, `packages/contracts`, `supabase`, `fixtures/synthetic`, `docs`) | Repository was empty apart from design references; no migration needed |
| npm workspaces, Next 16.4, React 19, Zod 4, Tailwind 4, Vitest 4, Playwright 1.65, Python 3.14, FastAPI 0.162, Pydantic 2.14 | Current stable versions at build time |
| Demo mode uses a file-backed JSON store seeded from `fixtures/synthetic/seed.json`, with simulated reviewer personas and a conspicuous banner | No Supabase credentials; an honest local path beats a fake login |
| `/app/*` renders a "production mode not available" gate | Never pretend demo auth is production auth |
| Facts from planning exports are claims (`NEEDS_CONFIRMATION`); statements/profiles/forms are evidence (`FACT_CONFIRMED`) | Mirrors the methodology: a mismatch is not an error until normalised |
| Balances conflict only for the same as-of date; static facts conflict on any disagreement | Freshness is not disagreement |
| Analysts can reconcile, resolve toward primary evidence, freeze and run checks, but cannot manually confirm unevidenced facts or record assumptions; only COMPLIANCE documents nonmaterial exceptions; approval roles are firm policy (default COMPLIANCE) | Segregation per the product requirements |
| Separation of duties = approver is not the person who froze the snapshot or ran the check (policy-configurable) | Documented, testable definition |
| Approval denials are audited in a separate committed write | A denial raised inside a rolled-back transaction would otherwise lose its audit event |
| Receipts carry `coverage_status` (`SUPPORTED_VERIFIED` means internal golden coverage, not external attestation) | Coverage matrix from the financial rules document |
| Comparison tolerance is a published, bounded rule set ($1.00 / 0.1 % default; max $25.00 / 1 %) | Firms can tighten but not loosen beyond bounds |
| P1 tax module implemented as DRAFT with tests, not exposed | Requested but gated on benchmarking |
| Evidence packet formats: JSON, HTML (print-ready), facts CSV; no PDF | No reliable server-side PDF renderer bundled |
| Fonts via Google Fonts `<link>` with system fallbacks, not `next/font` | Build must not depend on network availability |

## Open founder/professional gates (unchanged)

Trademark search and domain; legal entity; RIA interviews and first source
formats; counsel-defined compliance scope; vendor/retention/security posture;
expert-validated rule library; contract, pricing and pilot approvals before any
live-client beta.
