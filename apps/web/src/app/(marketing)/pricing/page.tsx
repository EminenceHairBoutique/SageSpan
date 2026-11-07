import type { Metadata } from "next";
import { CONSUMER_PRICING_HYPOTHESIS, ILLUSTRATIVE_PRICE_TABLE, PRICING, formatUsd } from "@sagespan/contracts";
import { PricingCalculator } from "@/ui/marketing/PricingCalculator";
import { Alert, Card, SectionHeading, Td, Th } from "@/ui/primitives";

export const metadata: Metadata = { title: "Proposed pricing (illustrative)" };

export default function PricingPage() {
  return (
    <main id="main" className="mx-auto max-w-6xl px-4 py-14 md:px-6">
      <SectionHeading eyebrow="Pricing hypothesis" title="Proposed, illustrative, not yet offered">
        Two audiences, two hypotheses to test in interviews and pilots. No live billing exists and nothing here constitutes an offer.
      </SectionHeading>
      <Alert tone="amber" title="Not a live offer" className="mb-8">
        No payments are accepted. Pilot enrolment is a separately agreed, limited arrangement subject to legal and security readiness. Final measurement, retention and fair-use rules require contracts.
      </Alert>
      <section className="mb-10">
        <h2 className="text-xl font-bold">Individuals and households (research ranges)</h2>
        <p className="mt-1 text-sm text-ink-muted">Candidate ranges for consumer research only; unvalidated and not announced. Safety explanations are never gated behind a paid tier.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <Card title={CONSUMER_PRICING_HYPOTHESIS.free.label} subtitle="Free (hypothesis)">
            <p className="text-sm text-ink-muted">Manual entry, baseline, explainers and the readiness gate. Useful without a bank connection or a paid model.</p>
          </Card>
          <Card title={CONSUMER_PRICING_HYPOTHESIS.personal.label} subtitle={`${formatUsd(CONSUMER_PRICING_HYPOTHESIS.personal.monthlyUsdLow)}–${formatUsd(CONSUMER_PRICING_HYPOTHESIS.personal.monthlyUsdHigh)}/month to test`}>
            <p className="text-sm text-ink-muted">Planning, scenarios, assistant and consented monitoring once those are released.</p>
          </Card>
          <Card title={CONSUMER_PRICING_HYPOTHESIS.household.label} subtitle={`${formatUsd(CONSUMER_PRICING_HYPOTHESIS.household.monthlyUsdLow)}–${formatUsd(CONSUMER_PRICING_HYPOTHESIS.household.monthlyUsdHigh)}/month to test`}>
            <p className="text-sm text-ink-muted">Shared goals and permissioned collaboration between household members.</p>
          </Card>
        </div>
        <ul className="mt-3 flex flex-wrap gap-2 text-xs text-ink-muted">
          {CONSUMER_PRICING_HYPOTHESIS.conduct.map((c) => (
            <li key={c} className="rounded-full border border-line px-2.5 py-0.5">
              {c}
            </li>
          ))}
        </ul>
      </section>
      <h2 className="mb-4 text-xl font-bold">Advisory firms</h2>
      <div className="grid gap-8 md:grid-cols-[1.1fr_1fr]">
        <div className="space-y-6">
          <Card title="Standard (proposed)" subtitle={`${formatUsd(PRICING.standard.minimumMonthlyUsd)}/month firm minimum including ${PRICING.standard.includedHouseholds} active monitored households, then ${formatUsd(PRICING.standard.perAdditionalHouseholdUsd)}/month per additional active monitored household.`}>
            <p className="font-mono text-sm">monthly(H) = 750 + 3.50 × max(0, H − 100)</p>
            <table className="mt-4 w-full">
              <thead className="border-b border-line">
                <tr>
                  <Th>Active monitored households</Th>
                  <Th align="right">Monthly (illustrative)</Th>
                  <Th align="right">Annual run-rate (illustrative)</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {ILLUSTRATIVE_PRICE_TABLE.map((r) => (
                  <tr key={r.households}>
                    <Td>{r.households.toLocaleString("en-US")}</Td>
                    <Td align="right">{formatUsd(r.monthlyUsd)}</Td>
                    <Td align="right">{formatUsd(r.annualRunRateUsd)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <Card title="Design-partner pilot (limited)" subtitle={`${formatUsd(PRICING.pilot.monthlyUsd)}/month for up to ${PRICING.pilot.maxHouseholds} households for an explicitly limited period.`}>
            <p className="text-sm text-ink-muted">A pilot is a separately agreed arrangement with a signed scope, not an automatic discount applied to the standard formula. It requires legal and security readiness on both sides.</p>
          </Card>
          <Card title="What counts as an active monitored household">
            <p className="text-sm text-ink-muted">A distinct family planning unit with an active assurance record in the measurement month. Archived, duplicate and prospect-only records are excluded. A household is never charged more than once because it has several people, accounts or reviews. Authorised firm seats are included; there is no per-seat fee in this hypothesis.</p>
          </Card>
        </div>
        <div className="space-y-6">
          <PricingCalculator />
          <Card title="Alternatives we will test against">
            <ul className="list-disc space-y-1 pl-5 text-sm text-ink-muted">
              <li>Platform minimum plus a fee per completed review</li>
              <li>Fixed compliance-team licence with a household cap</li>
              <li>Implementation or onboarding project fee where integration complexity justifies it</li>
            </ul>
            <p className="mt-3 text-xs text-ink-faint">No AUM fees or advisor seat fees in the baseline. Historical gross-margin estimates are not validated and are excluded from any forecast.</p>
          </Card>
        </div>
      </div>
    </main>
  );
}
