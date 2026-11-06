# SageSpan V3 — Go-to-Market, Pricing, Interviews and 90-Day Gates
**Status:** research/pilot plan, not measured demand or a forecast.

## ICP and buyer discovery
Target 15–25 structured interviews across a minimum of five different firms. Cover CCOs, managing partners or owners, COOs, planning directors and operations reviewers; include advisors who use Income Lab, RightCapital, eMoney, MoneyGuide or similar. Do not assume these firms can export fully normalized data or that one individual controls buying.

Ask: which outputs are produced; which plan and account fields are exportable with contractual permission; how balances/as-of dates are verified; which assumptions are lost in exports; frequency, severity and cost of errors; whether a second opinion would save time or create false alarms; what is actually retained in the compliance file; who owns budget/security approval; how often rules change and how changes are evaluated across a book; pricing willingness to pay; how many active monitored households exist.

## Pricing experiment
**Primary hypothesis:** $750/month/firm including 100 active monitored households + $3.50/month/household above 100. Limited pilots at $500/month covering up to 50 households. Authorized firm seats included in pricing hypothesis. Sales pages should state **Illustrative / proposed pricing, not yet a live offer**.

Competing hypotheses: (1) $500–$1,500 platform minimum + per completed review/run; (2) fixed compliance team license with household cap; (3) implementation/onboarding project fee, supported by observed integration complexity. No AUM fees or advisor seat fees in baseline. Compare alternatives in pilot proposals rather than asserting household pricing wins.

## Exact pricing formula and examples
`revenue_per_firm_per_month = 750 + (3.50 × max(0, active_households - 100))`.
Examples: H=50 => $750 (standard); H=100 => $750; H=250 => $1,275; H=500 => $2,150; H=1,000 => $3,900. Pilot $500 is a separately agreed limited arrangement, not an automated discount applied to the standard formula. Historical 70–95% gross-margin estimates from the first framework are **not validated** and must not enter forecasts as facts.

## Practical commercial sequence
**Days 1–15:** conduct initial interviews, capture 3–5 real (but privacy-safe) export format samples/field maps if permitted; present synthetic demo and obtain preliminary budget owners. Counsel consult; source/coverage registry.
**Days 15–30:** build core typed schema, scoped imports, auth and RLS; repeat interviews with interactive conflict workflow; define benchmark protocols.
**Days 30–45:** RMD verified prototype, receipts, discrepancy class; obtain feedback on false-positive tolerance.
**Days 45–60:** review queue, export packet, prototype book-wide rule update event; map at least two export schemas using only permitted non-sensitive fixtures.
**Days 60–90:** security/legal/tax expert check; select five structured pilot prospects; seek written paid commitments, subject to being ready for a legally and technically permitted pilot.

## Measurement and decision gates (hypotheses)
| Metric | Test threshold | Interpretation |
|---|---|---|
| Buyer discovery | 15–25 interviews | If problem infrequent, narrow ICP/job-to-be-done. |
| Pilot candidates | 5 structured firms | If hard to recruit, revisit channel and value claim. |
| Willingness to pay | At least 2 of 5 sign written paid pilot commitments by day 90, if legal/security ready | If less, investigate pain, pricing, workflow friction; don't claim proof of failure. |
| Import feasibility | At least 2 real vendor/source **formats** demonstrably mapped by legal, privacy-safe test fixtures | Without: limit scope and compatibility claims. |
| Review time | >25% improvement without loss of correctness, versus documented current process, is target | If not met, simplify workflow/avoid unnecessary steps. |
| RMD golden coverage | 100% scoped independent golden and negative tests passing | Release blocker. |
| Tenant data separation | 0 unauthorized cross-org reads/writes/exports in test suite | Release blocker. |
| Conflict gate | 100% material unresolved conflicts block snapshot freeze unless a defined valid authorized exception | Release blocker. |
| Qualified findings | Measure material/false-positive/not-comparable rates | Product value depends on actionable, trusted findings, not total alert count. |
| Review adoption | Named authorized reviewers complete evidence-backed dispositions | If manual duplication is high, redesign. |

## Staffing and budget
Identify accountable founder/CTO, fractional RIA counsel, CPA/tax reviewer, security engineer, domain advisor/CFP design partners and product/UX QA. Obtain quotes and model three cost cases: `legal + accounting validation + engineering + hosting + security + research incentives + insurance + third-party data licensing + contingency`. Do not promise that all roles are zero-cost or that an unstaffed 90-day launch can serve real regulated client data.

## Legal sequence
Prototype (synthetic) → reviewed design-partner sandbox (authorized/anonymized only) → real-data beta after counsel/DPA/controls/independent tests → public release after actual operational security, retention, contract and incident response practices are in force. Do not interpret the 90-day commercial milestone as permission to skip these gates.
