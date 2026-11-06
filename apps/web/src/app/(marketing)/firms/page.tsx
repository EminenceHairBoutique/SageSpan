import type { Metadata } from "next";
import { DISCREPANCY_LABELS, FACT_STATUS_LABELS } from "@sagespan/contracts";
import { ButtonLink, Card, Chip, SectionHeading } from "@/ui/primitives";

export const metadata: Metadata = { title: "For Advisors & Firms" };

const classifications: Array<{ key: keyof typeof DISCREPANCY_LABELS; text: string }> = [
  { key: "SOURCE_CONFLICT", text: "The plan computed from a different input (e.g. a different balance for the same date). The difference is attributable to the input, not the rule." },
  { key: "STALE_INPUT", text: "The plan used an older as-of date. A different date is not by itself an error." },
  { key: "RULE_DISAGREEMENT", text: "Inputs and method are normalised, yet the amounts differ: the rule application disagrees." },
  { key: "METHODOLOGY_DIFFERENCE", text: "The plan declares a different method (timing, aggregation, rounding)." },
  { key: "MISSING_EVIDENCE", text: "There is nothing to compare against, or the import carries no declared inputs so the difference cannot be attributed yet." },
  { key: "UNSUPPORTED_CHECK", text: "The independent check returned UNSUPPORTED or INDETERMINATE; neither figure should be relied on." },
  { key: "WITHIN_TOLERANCE", text: "The difference is inside the documented tolerance." },
  { key: "NOT_COMPARABLE", text: "Assumptions differ materially (projected balance, aggregate scope, different tax year); harmonise before comparing." },
];

export default function FirmsPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-14 md:px-6">
      <SectionHeading eyebrow="For advisors, RIA firms and compliance teams" title="Planning Intelligence and Assurance Intelligence on one trusted foundation">
        Build and explain a client&apos;s plan, then independently challenge its calculations, assumptions, completeness and evidence. Two linked, separately permissioned capabilities; neither lets an AI proposal certify itself.
      </SectionHeading>
      <div className="mb-10 grid gap-4 md:grid-cols-3">
        <Card title="Planning Intelligence" subtitle="Draft and explain">
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink-muted">
            <li>Guided discovery and evidence-linked fact capture <span className="text-ink-faint">(AI-002, proposed)</span></li>
            <li>Scenario proposals confirmed by the advisor before any engine run <span className="text-ink-faint">(AI-003, proposed)</span></li>
            <li>Draft plan narratives for professional review <span className="text-ink-faint">(AI-004, proposed)</span></li>
            <li>Shared deterministic engines with SageSpan Personal: cash-flow baseline and debt paths today; PLAN-001 retirement engine next</li>
          </ul>
        </Card>
        <Card title="Assurance Intelligence" subtitle="Check and document — working in the synthetic demo">
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink-muted">
            <li>Source-to-fact reconciliation with four evidence states and conflict gating</li>
            <li>Independent RMD check from a frozen snapshot, with receipt and rule versions</li>
            <li>AI plan review: missing evidence, conflicts, stale inputs, unsupported checks, discrepancy explanations, questions and a draft memo, every citation validated</li>
            <li>CCO review, separation of duties, approval with attestation, hashed evidence packet</li>
          </ul>
        </Card>
        <Card title="Operational intelligence" subtitle="Proposed">
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink-muted">
            <li>Assignment and reviewer-matching suggestions</li>
            <li>Drafted evidence requests for the file</li>
            <li>Workload and coverage summaries without misleading &quot;compliant&quot; scores</li>
            <li>Rule-change impact previews: which households need rechecking</li>
          </ul>
        </Card>
      </div>
      <SectionHeading eyebrow="Assurance capabilities" title="Independent plan assurance, one supported check at a time">
        {`Four capabilities, each with explicit limits. Everything below is implemented in the synthetic demo; nothing is a mock-up.`}
      </SectionHeading>

      <div className="grid gap-6 md:grid-cols-2">
        <Card title="Fact reconciliation" subtitle="Typed facts, owners, units, as-of dates and sources">
          <p className="text-sm text-ink-muted">Every imported value becomes a typed fact with a subject (person or account), a value kind, an as-of date and a source location. Planning-tool values are claims; statements, profiles and beneficiary forms are evidence.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {(Object.keys(FACT_STATUS_LABELS) as Array<keyof typeof FACT_STATUS_LABELS>).map((k) => (
              <Chip key={k} tone={k === "FACT_CONFIRMED" ? "teal" : k === "FACT_ASSUMED" ? "slate" : k === "NEEDS_CONFIRMATION" ? "amber" : "conflict"}>
                {FACT_STATUS_LABELS[k]}
              </Chip>
            ))}
          </div>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-ink-muted">
            <li>Two values for the same date and fact open a conflict with a materiality.</li>
            <li>Two values for different dates are a freshness question, not a conflict.</li>
            <li>Ownership is effective-dated with recorded percentages; primary and contingent beneficiaries are separate.</li>
          </ul>
        </Card>
        <Card title="Independent verification" subtitle="Separate deterministic engine, versioned rules, receipts">
          <p className="text-sm text-ink-muted">A separately deployable Python service computes the supported check from the frozen snapshot only, using Decimal arithmetic and effective-dated rule sets with checksums. The web application renders receipts; it never computes retirement math.</p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-ink-muted">
            <li>Supported today: lifetime RMD for a living owner of a non-inherited traditional, SEP or SIMPLE IRA (Uniform Lifetime Table).</li>
            <li>Typed UNSUPPORTED / INDETERMINATE results for inherited accounts, the younger-spouse joint table, employer plans and any missing input.</li>
            <li>A deferred first-year RMD and the current-year RMD are separate obligation events with separate deadlines.</li>
          </ul>
        </Card>
        <Card title="Review trail" subtitle="Immutable snapshots, hash-chained audit, separation of duties">
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink-muted">
            <li>Freeze is fail-closed: material conflicts or missing required facts block it; nonmaterial conflicts need a documented exception under firm policy.</li>
            <li>Resolving a conflict creates a new fact revision and a new snapshot revision; nothing frozen is edited.</li>
            <li>Approval records identity, role, rationale and a conflict attestation. Firm policy can require that the approver is not the person who froze or ran the check.</li>
            <li>Every event is appended to a per-organisation SHA-256 hash chain.</li>
          </ul>
        </Card>
        <Card title="Limits" subtitle="What this release does not do">
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink-muted">
            <li>No federal or state income tax results are published (a narrow 2026 ordinary-income module exists as an unpublished draft with its exclusions listed).</li>
            <li>No Social Security, Medicare, estate, longevity or Monte Carlo analysis.</li>
            <li>No vendor integrations: a vendor name on an import is metadata, not a connection.</li>
            <li>No PDF/OCR parsing; only the documented CSV/JSON contract is accepted.</li>
            <li>No production login in this build; the console runs on synthetic data with simulated reviewers.</li>
            <li>No client portal or client-to-firm consent grants yet; a client&apos;s SageSpan Personal workspace is never visible to a firm without one.</li>
          </ul>
        </Card>
      </div>

      <section className="mt-14">
        <SectionHeading eyebrow="Discrepancy classification" title="A mismatch is not an error until it is normalised">
          Classification order is documented in the financial methodology and covered by tests.
        </SectionHeading>
        <div className="grid gap-3 md:grid-cols-2">
          {classifications.map((c) => (
            <div key={c.key} className="flex gap-3 rounded-lg border border-line bg-surface p-4">
              <div className="w-44 shrink-0">
                <Chip tone={c.key === "WITHIN_TOLERANCE" ? "teal" : c.key === "SOURCE_CONFLICT" || c.key === "RULE_DISAGREEMENT" ? "conflict" : c.key === "METHODOLOGY_DIFFERENCE" || c.key === "NOT_COMPARABLE" ? "slate" : "amber"}>{DISCREPANCY_LABELS[c.key]}</Chip>
              </div>
              <p className="text-sm text-ink-muted">{c.text}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-12 flex flex-wrap gap-3">
        <ButtonLink href="/demo/app/reviews">Open the firm console (synthetic)</ButtonLink>
        <ButtonLink href="/demo/app/households/hh_patel" variant="secondary">
          See the Patel conflict
        </ButtonLink>
        <ButtonLink href="/#pilot" variant="ghost">
          Design-partner pilot interest
        </ButtonLink>
      </div>
    </main>
  );
}
