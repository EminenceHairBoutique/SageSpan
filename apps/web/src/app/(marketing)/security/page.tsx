import type { Metadata } from "next";
import { Alert, Card, SectionHeading } from "@/ui/primitives";

export const metadata: Metadata = { title: "Security design approach" };

const designed = [
  { t: "Tenant isolation in the database", d: "Every business table carries org_id with composite foreign keys that prevent cross-organisation references. Row-level security policies gate reads and writes through authenticated memberships; the server never trusts a client-supplied organisation id." },
  { t: "Server-authoritative workflow", d: "Review status, approvals and freeze decisions are enforced in server code and, for production, in SECURITY DEFINER database functions that validate role and state transition. The UI only reflects what the server allows." },
  { t: "Immutable evidence", d: "Frozen snapshots are canonically serialised and SHA-256 hashed. Audit events are append-only and hash-chained per organisation. Source documents are referenced by hash." },
  { t: "Separate calculation service", d: "Retirement math runs in a separately deployable service authenticated with a server-held secret. Tenant context travels in a server-set header; request bodies that include org_id are rejected." },
  { t: "Data minimisation", d: "Audit logs carry identifiers and digests, not raw financial values or PII. Validation errors return field paths, never submitted values. No account numbers, SSNs or tax returns are collected in the prototype." },
  { t: "Untrusted imports", d: "Only the documented CSV/JSON contract is parsed, with size, row, column and type limits; CSV parsing is a strict RFC 4180 reader; exports neutralise spreadsheet formula injection." },
  { t: "No AI in the numbers", d: "No language model computes, approves or invents facts. AI-assisted mapping or summarisation, if added later, would consume typed tool outputs with source links and leave facts unconfirmed until a person reviews them." },
];

const notClaimed = [
  "SOC 2, ISO 27001 or any third-party security certification",
  "SEC registration, examination readiness or 'exam-proof' packets",
  "Zero data retention or 'we never train on your data' guarantees for any AI vendor",
  "Encryption, backup, retention or incident-response guarantees beyond what a signed agreement states",
  "Bank-grade, military-grade or compliance-approved anything",
];

export default function SecurityPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-14 md:px-6">
      <SectionHeading eyebrow="Security" title="Design approach, not a certification">
        This page describes how the system is designed and what this synthetic build implements. It makes no compliance claims.
      </SectionHeading>
      <Alert tone="amber" title="Prototype status" className="mb-8">
        This build processes synthetic data only. Real-client use requires a counsel perimeter memo, data-processing agreements, a security risk assessment, validated calculations, incident-response and access-control testing, and approved sub-processors. None of those gates has been passed.
      </Alert>
      <div className="grid gap-5 md:grid-cols-2">
        {designed.map((d) => (
          <Card key={d.t} title={d.t}>
            <p className="text-sm text-ink-muted">{d.d}</p>
          </Card>
        ))}
      </div>
      <section className="mt-12 grid gap-6 md:grid-cols-2">
        <Card title="What is implemented in this build" subtitle="Verifiable in the repository and tests">
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink-muted">
            <li>Server-side role and organisation checks on every mutation, with tests for forged approvals and cross-tenant access in the demo store.</li>
            <li>Postgres schema, RLS policies, append-only triggers and workflow functions under supabase/migrations, with SQL tests under supabase/tests. Their execution status is reported honestly in docs/SECURITY_AND_LIMITS.md.</li>
            <li>Calculation service authentication, tenant header, strict schemas and an OpenAPI contract test.</li>
            <li>Hash-chained audit trail with an integrity check shown in the console.</li>
            <li>Security headers (no framing, no MIME sniffing, strict referrer policy).</li>
          </ul>
        </Card>
        <Card title="What we do not claim" subtitle="Until evidence exists">
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink-muted">
            {notClaimed.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-ink-faint">Development note: this prototype was built with Claude Fable 5.1, whose vendor terms document a 30-day data-retention requirement. Only synthetic data was used in development, and no client documents or PII should be processed with it absent a separate contractual and privacy review.</p>
        </Card>
      </section>
    </main>
  );
}
