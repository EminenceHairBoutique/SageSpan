import Link from "next/link";
import { getDemoActor } from "@/auth/actor";
import { listHouseholds, profileName } from "@/domain/queries";
import { getStore } from "@/domain/store";
import { Alert, Card, Td, Th, WorkflowChip } from "@/ui/primitives";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const actor = await getDemoActor();
  const state = getStore().read();
  const households = listHouseholds(state, actor.org_id);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Clients &amp; households</h1>
        <p className="mt-1 text-sm text-ink-muted">Every household with an assurance record in your organisation. Persons, accounts and sources are scoped to your firm; a client&apos;s private SageSpan Personal workspace is never visible here unless they grant it.</p>
      </div>
      <Card>
        <table className="w-full">
          <thead className="border-b border-line">
            <tr>
              <Th>Household</Th>
              <Th>Status</Th>
              <Th>Tax year</Th>
              <Th>Persons</Th>
              <Th>Accounts</Th>
              <Th>Sources</Th>
              <Th>Assignee</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {households.map((h) => (
              <tr key={h.id}>
                <Td>
                  <Link href={`/demo/app/households/${h.id}`} className="font-semibold text-navy hover:underline">
                    {h.label}
                  </Link>
                  <span className="ml-2 text-xs text-ink-muted">{h.source_tool_label ?? ""}</span>
                </Td>
                <Td>
                  <WorkflowChip status={h.workflow_status} />
                </Td>
                <Td>{h.tax_year}</Td>
                <Td>{state.persons.filter((p) => p.household_id === h.id && p.org_id === actor.org_id).length}</Td>
                <Td>{state.accounts.filter((a) => a.household_id === h.id && a.org_id === actor.org_id).length}</Td>
                <Td>{state.source_documents.filter((d) => d.household_id === h.id && d.org_id === actor.org_id).length}</Td>
                <Td>{profileName(state, h.assignee_user_id)}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Alert tone="slate" title="Client onboarding, consent grants and the client portal are proposed (PR-003 / ASSURANCE-001)">
        Inviting a client, receiving an explicit client-to-firm data grant with scope, purpose and expiry, and publishing advisor-approved explanations to a restricted portal require real authentication and the consent model. No fake controls are shown for them.
      </Alert>
    </div>
  );
}
