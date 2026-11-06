import Link from "next/link";
import { getDemoActor } from "@/auth/actor";
import { listHouseholds, profileName } from "@/domain/queries";
import { getStore } from "@/domain/store";
import { Alert, Card, Chip, EmptyState, Td, Th } from "@/ui/primitives";
import { OutcomeChip } from "@/ui/console/CoveragePanel";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage() {
  const actor = await getDemoActor();
  const state = getStore().read();
  const labels = new Map(listHouseholds(state, actor.org_id).map((h) => [h.id, h.label]));
  const reviews = state.reviews.filter((r) => r.org_id === actor.org_id).sort((a, b) => b.reviewed_at.localeCompare(a.reviewed_at));
  const org = state.organizations.find((o) => o.id === actor.org_id)!;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Reviews &amp; approvals</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-muted">Every recorded review and approval in your organisation. Approval is a professional act by an authorised person with a rationale and attestation; it is distinct from an arithmetic PASS and from any AI draft.</p>
      </div>
      <Alert tone="slate" title={`Firm policy: approver roles ${org.policies.approver_roles.join(", ")} · separation of duties ${org.policies.separation_of_duties ? "on" : "off"}`}>
        Policy is enforced on the server and, in production, in the database. Change it under Firm settings.
      </Alert>
      <Card>
        {reviews.length === 0 ? (
          <EmptyState title="No reviews recorded yet.">Record reviews and approvals from a household&apos;s Review tab once a check has completed.</EmptyState>
        ) : (
          <table className="w-full">
            <thead className="border-b border-line">
              <tr>
                <Th>Household</Th>
                <Th>Decision</Th>
                <Th>Coverage outcome</Th>
                <Th>Reviewer</Th>
                <Th>When</Th>
                <Th>Attestation</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {reviews.map((r) => (
                <tr key={r.id}>
                  <Td>
                    <Link href={`/demo/app/households/${r.household_id}/review`} className="font-medium text-navy hover:underline">
                      {labels.get(r.household_id) ?? r.household_id}
                    </Link>
                  </Td>
                  <Td>
                    <Chip tone={r.decision === "APPROVED" ? "teal" : r.decision === "REJECTED" ? "conflict" : "slate"}>{r.decision.toLowerCase()}</Chip>
                  </Td>
                  <Td>
                    {r.decision === "APPROVED" ? <OutcomeChip outcome={r.coverage_outcome} /> : <span className="text-xs text-ink-faint">—</span>}
                    {r.coverage_summary && <span className="ml-2 text-xs text-ink-muted">{r.coverage_summary.verified + r.coverage_summary.not_required}/{r.coverage_summary.accounts_in_scope} verified</span>}
                  </Td>
                  <Td>
                    {profileName(state, r.reviewer_user_id)} ({r.reviewer_role}) · {r.actor_type === "SIMULATED_REVIEWER" ? "simulated" : "user"}
                  </Td>
                  <Td>{r.reviewed_at.replace("T", " ").slice(0, 19)}</Td>
                  <Td>{r.conflict_attestation ? "yes" : "—"}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
