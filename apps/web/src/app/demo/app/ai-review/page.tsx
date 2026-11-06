import Link from "next/link";
import { getDemoActor } from "@/auth/actor";
import { listHouseholds } from "@/domain/queries";
import { getStore } from "@/domain/store";
import { Alert, Card, Chip, EmptyState, Td, Th } from "@/ui/primitives";

export const dynamic = "force-dynamic";

export default async function FirmAiReviewPage() {
  const actor = await getDemoActor();
  const state = getStore().read();
  const households = listHouseholds(state, actor.org_id);
  const labels = new Map(households.map((h) => [h.id, h.label]));
  const runs = state.ai_runs.filter((r) => r.scope_kind === "FIRM_HOUSEHOLD" && r.org_id === actor.org_id).sort((a, b) => b.created_at.localeCompare(a.created_at));
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">AI plan review</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-muted">Draft reviews across your book. Each run is immutable, cites only resolvable evidence, and waits for a human to accept, edit, dismiss or request evidence. Nothing here is an approval.</p>
      </div>
      <Alert tone="slate" title="Scope of the assistant in this build">
        Review intelligence (missing evidence, conflicts, stale inputs, unsupported checks, discrepancy explanations, follow-up questions, draft memo) on a deterministic offline provider. Document extraction (AI-002), scenario proposals that run (AI-003), memo publication (AI-004) and change monitoring (AI-005) are later, individually gated milestones.
      </Alert>
      <Card title="Start a draft">
        <ul className="flex flex-wrap gap-2">
          {households.map((h) => (
            <li key={h.id}>
              <Link href={`/demo/app/households/${h.id}/ai-review`} className="inline-flex items-center rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-sm font-semibold text-ink hover:bg-surface-muted">
                {h.label}
              </Link>
            </li>
          ))}
        </ul>
      </Card>
      <Card title={`Runs (${runs.length})`}>
        {runs.length === 0 ? (
          <EmptyState title="No AI drafts yet." />
        ) : (
          <table className="w-full">
            <thead className="border-b border-line">
              <tr>
                <Th>Household</Th>
                <Th>When</Th>
                <Th>Status</Th>
                <Th>Findings</Th>
                <Th>Model</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {runs.map((r) => (
                <tr key={r.id}>
                  <Td>
                    <Link href={`/demo/app/households/${r.household_id}/ai-review`} className="font-medium text-navy hover:underline">
                      {labels.get(r.household_id ?? "") ?? r.household_id}
                    </Link>
                  </Td>
                  <Td>{r.created_at.replace("T", " ").slice(0, 19)}</Td>
                  <Td>
                    <Chip tone={r.run_status === "DRAFT_READY" ? "amber" : r.run_status === "ABSTAINED" ? "slate" : "conflict"}>{r.run_status === "DRAFT_READY" ? "draft for human review" : r.run_status.toLowerCase()}</Chip>
                  </Td>
                  <Td>
                    {r.accepted_finding_count} accepted · {r.rejected_finding_count} rejected
                  </Td>
                  <Td>
                    {r.provider} {r.model} · {r.prompt_version}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
