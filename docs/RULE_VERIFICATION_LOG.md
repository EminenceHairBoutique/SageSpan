# Rule verification log

Claim register for numeric parameters shipped in the calculation service. Add a row whenever a parameter is added or re-verified. A parameter may be called "verified" in product copy, receipts or evidence packets only when a named qualified reviewer (CPA, CFP® or enrolled agent) has compared it to the current primary publication and signed this log.

| Parameter set | Checked on | Checked against | Result | Status | Checked by |
| --- | --- | --- | --- | --- | --- |
| IRS Uniform Lifetime Table, ages 72–100 (post-2022 table) | 2026-11-05 | BNY Mellon RMD worksheet (2024 tax year) citing IRS Pub. 590-B Appendix B Table III; irs.gov was not reachable from the build environment | All 29 factors matched (72: 27.4 … 74: 25.5 … 100: 6.4) | Secondary-source match only. **Not yet verified against the current IRS publication by a qualified reviewer.** | Claude (agent) |
| IRS Uniform Lifetime Table, all 49 factors (ages 72–120+) as shipped in `rmd.uniform_lifetime_table@2022.1` | 2026-11-05 | 26 CFR §1.401(a)(9)-9(c) (regulation text via Cornell LII) and IRS Pub. 590-B (2025) Appendix B Table III | All 49 factors matched both sources (72: 27.4 … 74: 25.5 … 120+: 2.0) | Primary-source match. **Agent check, unsigned**: not "verified" in the product sense until a qualified reviewer signs this row. | Claude (agent), PR-001 |
| 2026 standard deduction (single $16,100; MFJ $32,200; HoH $24,150) | 2026-11-05 | IRS news release for Rev. Proc. 2025-32 (IR-2025-103, Oct 9 2025) | Matched | Primary-source match (release text, not the Rev. Proc. itself) | Claude (agent) |
| 2026 ordinary-income brackets, single and MFJ | 2026-11-05 | Same release | Single 12,400 / 50,400 / 105,700 / 201,775 / 256,225 / 640,600; MFJ 24,800 / 100,800 / 211,400 / 403,550 / 512,450 / 768,700 | Primary-source match | Claude (agent) |
| 2026 additional standard deduction (65+/blind); temporary senior deduction | 2026-11-05 | Not found in reachable sources | Not verified | Must remain unsupported until verified | — |
| Social Security 2027 COLA 3.6% | 2026-11-05 | SSA news release, Oct 14 2026 | Matched | Primary-source match | Claude (agent) |

## Sources

- SSA: https://www.ssa.gov/news/en/mip/2026-10-01-f.html
- IRS IR-2025-103 / Rev. Proc. 2025-32: https://content.govdelivery.com/accounts/USIRS/bulletins/3f65fe1
- 26 CFR §1.401(a)(9)-9 (Cornell LII): https://www.law.cornell.edu/cfr/text/26/1.401(a)(9)-9
- IRS Publication 590-B (2025; to be signed off directly by a reviewer): https://www.irs.gov/publications/p590b
- BNY RMD worksheet citing Pub. 590-B: https://www.bny.com/assets/investments/im/documents/imwebdocs/account-form/annual/ret-required-minimum-distribution-worksheet.pdf
