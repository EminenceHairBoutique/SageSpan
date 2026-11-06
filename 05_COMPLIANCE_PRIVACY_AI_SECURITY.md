# V3 Legal, Compliance, Security and AI Governance
Research date: 2026-11-05. U.S. launch hypothesis. Not legal advice, a security assessment, or proof of compliance.

## Regulation is activity-based
A paid B2B checker may be a technology vendor, but do not assume that its business model automatically avoids registration or obligations. The legal analysis turns on actual outputs, who can act on them, whether personalized securities advice is provided, compensation structures, marketing, custody/execution and relationships with regulated firms. Obtain a scoped written counsel review before real-client deployment.

## External regulatory anchors
- SEC fiscal 2027 examination priorities (Oct 23, 2026) emphasize adviser fiduciary duty, conflicts of interest and recommendations, operations, cybersecurity, and emerging technologies. These are priorities, **not product certification criteria**: https://www.sec.gov/newsroom/press-releases/2026-109-sec-announces-fiscal-year-2027-examination-priorities
- SEC Investment Advisers Act books-and-records rule, 17 CFR 275.204-2: relevant firms must preserve specified records in proper formats for applicable periods; vendor product 'packet' alone does not establish full compliance: https://www.law.cornell.edu/cfr/text/17/275.204-2
- SEC 2024 Regulation S-P amendments emphasize incident-response plans, reasonable oversight of service providers and protection of customer information; determine covered-institution and vendor obligations with counsel: https://www.sec.gov/file/regulation-s-p-small-entity-compliance-guide
- FINRA supervision/communications obligations may apply to broker-dealer customers; enterprise configurable retention/control may be required: https://www.finra.org/rules-guidance/notices/24-09
- The 2023 proposed SEC predictive-data-analytics conflicts rule was withdrawn June 2025; do not treat it as enacted law: https://www.sec.gov/rules-regulations/2025/06/s7-12-23

## Human oversight
A system CHECK_PASS means a specific implemented rule or calculation passed tests, not the household plan is appropriate or the client’s best interest has been met. The human advisor or designated compliance reviewer owns suitability/fiduciary judgment and review authority. No automated sign-off, no invented professional endorsement, no trading. An audit record records what was actually reviewed; no retrospective approval claims.

## Model and data governance
- Data minimization: use synthetic inputs in demos, selective source fields rather than full SSN or tax return unless genuinely needed. Do not collect sensitive identifiers for prototype onboarding.
- AI: no LLM as authoritative numerical engine. AI can suggest mapping, draft explanatory text, or summarize discrepancies *only* with typed tool outputs and source links. AI-suggested facts must remain unconfirmed until reviewed.
- Imported vendor outputs, PDFs, CSVs and OCR text are untrusted material. Implement prompt-injection resistance, file type/size validation, malware scanning before real-world uploads, safe parsing, schema validation and sandboxing.
- Tenant security: enforced in DB with RLS and foreign keys; tests using separate authenticated organizations; audit logs for sensitive access; no tenant identifiers trusted from browser alone.
- Real documents: consent, data-processing contracts, deletion/export rights, retention/legal-hold policy, encryption, incident response, key management, MFA, least privilege and vendor assurance required before opening pilots.
- LLM vendor privacy: **never claim** 'zero data retention' or 'will not train on your data' unless every relevant vendor's contractual terms and configuration justify it; no passwords/documents sent to LLM by default. **Model-specific finding:** Anthropic currently documents a 30-day data-retention requirement for Claude Fable 5.1 and says zero data retention is generally unavailable absent express authorization; Anthropic describes limited eligible enterprise exceptions and Enterprise Frontier Safeguards. Verify account-specific terms before any real-data use. Do not send authentic client financial documents or PII through this development model without a separately approved contractual/privacy review. Source: https://platform.claude.com/docs/en/models/fable-5-1/whats-new-fable-5-1
- Security certifications: never claim SOC 2 Type II, ISO certification, bank grade, compliance approved, SEC registered, or examiner certified without evidence.
- Retention: avoid promising 5 years for the vendor universally; regulated customer legal retention and contracts may differ. Ensure export/immutability/portability can support a customer-configured retention policy.

## Evidence packet language
Use: 'Review packet with source references, recorded assumptions, rule-set versions and reviewer actions.'
Avoid as public claims prior to review: 'exam-proof', 'SEC-compliant', 'audited', 'certified', 'no errors', 'guaranteed fiduciary protection'.

## Release gates
**Prototype:** synthetic only, no production secrets or external execution. Required: unit/integration tests, threat-model notes and data classification.
**Design partner sandbox:** firm-approved synthetic/anonymized data only, signed permission, security review and documented use limitations.
**Real-client pilot:** counsel perimeter memo, DPA, security risk assessment and validated supported calculations; incident response and access control tests; review protocol; approved provider subprocessors.
**Public commercial release:** independent model validation, service legal terms and contract, acceptable security posture, regulated communications approved, billing/reporting controls and monitored operational runbook.


## V3 commercial boundaries
SageSpan is provisionally a firm-paid software vendor, **not** a licensed investment advisor merely by naming or labeling. Counsel must assess actual functions and statements before client use. Pricing is a hypothesis, not a compliant sales offer until contracts and buyer scope are ready.
