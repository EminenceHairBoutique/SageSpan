import type { Metadata } from "next";
import Link from "next/link";
import { Alert, Card, Chip, SectionHeading } from "@/ui/primitives";

export const metadata: Metadata = { title: "Retirement Studio" };

export default function RetirementPage() {
  return (
    <main id="main" className="mx-auto max-w-6xl px-4 py-14 md:px-6">
      <SectionHeading eyebrow="Retirement Studio · B2C and B2B" title="Realistic retirement planning, with the arithmetic kept honest">
        One planning environment shared by individuals and advisors: the same validated engines, different authority. Readiness before projections; disclosure before confidence.
      </SectionHeading>
      <Alert tone="slate" title="Status: readiness gate shipped; projection engine not yet built" className="mb-8">
        The Studio today records what is known, assumed and missing for a retirement plan and refuses to estimate an outcome from gaps. The first projection engine (PLAN-001) is a bounded, gross-basis annual cash-flow model with golden tests and an explicit omissions card. It is sequenced after the security and personal-clarity milestones.
      </Alert>
      <div className="grid gap-4 md:grid-cols-3">
        <Card title="Discover" actions={<Chip tone="teal">Readiness gate live</Chip>}>
          <p className="text-sm text-ink-muted">Age, target retirement age, expected spending, assets with as-of dates, contributions, pension and Social Security estimates with their source. Each input keeps its own state; blanks are recorded as missing.</p>
        </Card>
        <Card title="Design & compare" actions={<Chip tone="amber">PLAN-001 proposed</Chip>}>
          <p className="text-sm text-ink-muted">Retire at 63 vs 67, spend $300 less a month, save $200 more, assume lower returns, lose a year of income. Baseline vs alternative, assumptions, risks and what would invalidate the conclusion.</p>
        </Card>
        <Card title="Independently reviewed modules" actions={<Chip tone="amber">Gated</Chip>}>
          <p className="text-sm text-ink-muted">Social Security claiming, RMD coordination (the existing assurance engine), tax-aware withdrawals and Roth conversions, healthcare costs, Monte Carlo with documented assumptions. Each ships only after its own validation and professional review.</p>
        </Card>
      </div>
      <section className="mt-12 grid gap-8 md:grid-cols-2">
        <div>
          <SectionHeading eyebrow="Already real" title="The RMD engine" />
          <p className="text-sm text-ink-muted">A separate Python service computes the lifetime required minimum distribution for a living owner of a non-inherited traditional-family IRA from frozen, source-linked inputs under versioned IRS rule sets, and returns a receipt. Inherited accounts, the younger-spouse joint table and employer plans return typed non-results rather than guesses. Golden case: $640,000.00 ÷ 25.5 = $25,098.04.</p>
          <p className="mt-3 text-sm">
            <Link href="/demo/app/households/hh_patel/checks" className="font-semibold text-navy hover:underline">See it in the firm demo →</Link>
          </p>
        </div>
        <div>
          <SectionHeading eyebrow="What we will not do" title="No false confidence" />
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink-muted">
            <li>No probability-of-success figure without a validated stochastic model and stated assumptions.</li>
            <li>No after-tax comprehensive plan until tax, benefits and healthcare modules are independently reviewed.</li>
            <li>No LLM arithmetic: the assistant may propose a scenario for you to confirm; only an engine computes it.</li>
            <li>No personalised investment allocation; that remains disabled pending the legal perimeter.</li>
          </ul>
          <p className="mt-3 text-sm">
            <Link href="/demo/personal/retirement" className="font-semibold text-navy hover:underline">Open the readiness gate in the personal demo →</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
