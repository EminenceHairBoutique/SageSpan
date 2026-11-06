import Link from "next/link";
import { Alert, Card, Chip, KeyValue } from "@/ui/primitives";

export const dynamic = "force-dynamic";

/**
 * Honest status page. The Planning Studio shares its engines with SageSpan
 * Personal; the retirement projection engine (PLAN-001 / SCENARIO-001) is not
 * built, so no planning controls are rendered here.
 */
export default function PlanningStudioPage() {
  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">Planning studio</h1>
          <Chip tone="amber">Proposed · not implemented</Chip>
        </div>
        <p className="mt-1 max-w-2xl text-sm text-ink-muted">The advisor planning studio and the consumer Retirement Studio will run the same deterministic, versioned engines with different authority: an advisor works on explicitly authorised client scopes and submits draft advice for review; an individual explores their own plan. Neither exists until the engine does.</p>
      </div>
      <Alert tone="slate" title="Why there are no controls here">
        A planning screen without a validated engine would invite confident-looking numbers with nothing behind them. The first engine is PLAN-001: a labelled, simplified gross-basis annual cash-flow model with golden tests and an omissions card. It is sequenced after PR-002 and the Personal clarity slice.
      </Alert>
      <div className="grid gap-6 md:grid-cols-2">
        <Card title="Shared with SageSpan Personal today">
          <KeyValue
            rows={[
              { k: "Cash-flow baseline", v: "personal.cashflow_baseline@2026.1 (receipted)" },
              { k: "Debt payoff paths", v: "personal.debt_amortization@2026.1 (receipted)" },
              { k: "Readiness gate", v: <Link href="/demo/personal/retirement" className="font-semibold text-navy hover:underline">Known / assumed / missing retirement inputs</Link> },
              { k: "RMD check", v: "rmd.* rule sets (this console, Checks tab)" },
            ]}
          />
        </Card>
        <Card title="Sequence to a working studio">
          <ol className="list-decimal space-y-1 pl-5 text-sm text-ink-muted">
            <li>PLAN-001 engine with independently reviewed scope and disclosure.</li>
            <li>Scenario definitions and comparisons (retirement date, spending, savings, return assumption, income interruption).</li>
            <li>Client-authorised scope via consent grants (PR-003), approval records for draft advice (existing review workflow).</li>
            <li>AI-003: typed scenario proposals the advisor confirms before any run.</li>
          </ol>
        </Card>
      </div>
    </div>
  );
}
