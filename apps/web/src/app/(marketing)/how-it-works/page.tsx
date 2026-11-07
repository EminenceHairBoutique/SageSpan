import type { Metadata } from "next";
import Link from "next/link";
import { Alert, Card, SectionHeading, Td, Th } from "@/ui/primitives";

export const metadata: Metadata = { title: "How it works" };

const stages = [
  { stage: "1. Discover", consumer: "Enter balances, income months, bills, debts and goals; each is dated and stated as reported, assumed, missing or stale.", firm: "Import permitted plan exports and source statements; every value becomes a typed fact with a source location.", control: "Provenance, as-of dates, explicit missingness" },
  { stage: "2. Diagnose", consumer: "Receipted baseline: margin, buffer, dated outlook, flags.", firm: "Reconcile claims against evidence; conflicts block the freeze; frozen snapshot; independent check.", control: "Deterministic engines, frozen inputs, coverage states" },
  { stage: "3. Design", consumer: "Compare feasible actions and debt paths on identical inputs.", firm: "Scenario proposals and comparisons on the same engines (PLAN-001 pending).", control: "Versioned methods, receipts, stated assumptions" },
  { stage: "4. Decide & review", consumer: "Accept, snooze, dismiss or disagree; your choice is an event.", firm: "AI draft findings → human accept/edit/dismiss → review → approval with attestation and separation of duties.", control: "Human decision authority, immutable approvals" },
  { stage: "5. Monitor", consumer: "Change an input; everything recomputes from a new snapshot (consented monitoring proposed).", firm: "Re-check after rule or fact changes; evidence packets with per-artifact hashes (AI-005 proposed).", control: "Audit trail, versioning, release gates" },
];

export default function HowItWorksPage() {
  return (
    <main id="main" className="mx-auto max-w-6xl px-4 py-14 md:px-6">
      <SectionHeading eyebrow="How it works" title="One lifecycle, two experiences, four layers">
        Individuals and firms move through the same five stages. Underneath, four layers keep the system honest: evidence, deterministic analytics, policy and ranking, and AI interaction.
      </SectionHeading>
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[720px]">
          <thead className="border-b border-line">
            <tr>
              <Th>Stage</Th>
              <Th>Individual / household</Th>
              <Th>Advisor / firm</Th>
              <Th>Required control</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {stages.map((s) => (
              <tr key={s.stage}>
                <Td className="font-semibold">{s.stage}</Td>
                <Td>{s.consumer}</Td>
                <Td>{s.firm}</Td>
                <Td className="text-ink-muted">{s.control}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <section className="mt-12 grid gap-6 md:grid-cols-2">
        <Card title="Layer A — Evidence">
          <p className="text-sm text-ink-muted">Dated, typed records with provenance: user-reported values, custodian statements, planning-tool exports (claims, not evidence), beneficiary forms. Nothing is promoted to verified without a reviewer.</p>
        </Card>
        <Card title="Layer B — Deterministic analytics">
          <p className="text-sm text-ink-muted">A separate Python service with Decimal arithmetic and versioned rule/method sets: RMD checks, the personal cash-flow baseline and the debt payoff comparison. Every result carries a receipt binding inputs, method versions and a run hash.</p>
        </Card>
        <Card title="Layer C — Policy and ranking">
          <p className="text-sm text-ink-muted">Testable rules decide feasibility and order: cash floor, required payments, data freshness, reversibility, urgency and benefit. No opaque model score, no revenue input. Regulated advice tiers are disabled.</p>
        </Card>
        <Card title="Layer D — AI interaction">
          <p className="text-sm text-ink-muted">A server-owned orchestrator with allowlisted read-only tools, a schema-validated output and a citation validator. The model proposes and explains; it cannot approve, verify, calculate, transact or read outside the authorised scope.</p>
        </Card>
      </section>
      <Alert tone="slate" title="Where AI fits" className="mt-10">
        Three responsibilities, none of which lets a model invent inputs or approve decisions: <strong>document intelligence</strong> (extraction linked to its source location, pending validation), <strong>review intelligence</strong> (discrepancy explanations, missing-evidence prioritisation, reviewer summaries, re-check candidates), and <strong>operational intelligence</strong> (assignment, evidence requests, workload summaries). Review intelligence ships in this build; the other two are proposed and individually gated.
      </Alert>
      <p className="mt-8 text-sm text-ink-muted">
        Try both paths: <Link href="/demo/personal" className="font-semibold text-navy hover:underline">Personal (Maya Castillo)</Link> and <Link href="/demo/app/reviews" className="font-semibold text-navy hover:underline">Firm console (Harbor Point)</Link>. Both are synthetic.
      </p>
    </main>
  );
}
