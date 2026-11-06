import Link from "next/link";
import { getDemoActor } from "@/auth/actor";
import { listHouseholds } from "@/domain/queries";
import { getStore } from "@/domain/store";
import { Alert, Card, EmptyState, Mono, ResultChip, Td, Th } from "@/ui/primitives";

export const dynamic = "force-dynamic";

export default async function ChecksIndexPage() {
  const actor = await getDemoActor();
  const state = getStore().read();
  const households = new Map(listHouseholds(state, actor.org_id).map((h) => [h.id, h.label]));
  const runs = state.check_runs.filter((r) => r.org_id === actor.org_id).sort((a, b) => b.executed_at.localeCompare(a.executed_at));
  const supported = runs.filter((r) => r.run_status === "PASS").length;
  const unsupported = runs.filter((r) => r.run_status === "UNSUPPORTED" || r.run_status === "INDETERMINATE").length;
  const errors = runs.filter((r) => r.run_status === "ERROR").length;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Checks</h1>
        <p className="mt-1 text-sm text-ink-muted">Every independent calculation run in your organisation, with its receipt status. An arithmetic PASS is not an approval; coverage is per account and per rule.</p>
      </div>
      <Alert tone="slate" title={`Coverage: ${supported} supported PASS · ${unsupported} unsupported/indeterminate · ${errors} errors · ${runs.length} runs`}>
        Supported scope today: lifetime RMD for a living owner of a non-inherited traditional-family IRA (Uniform Lifetime Table). Everything else returns a typed non-result.
      </Alert>
      <Card>
        {runs.length === 0 ? (
          <EmptyState title="No checks have been run yet.">Freeze a household snapshot and run the check from its Checks tab.</EmptyState>
        ) : (
          <table className="w-full">
            <thead className="border-b border-line">
              <tr>
                <Th>Household</Th>
                <Th>Executed</Th>
                <Th>Result</Th>
                <Th>Coverage</Th>
                <Th>Engine</Th>
                <Th>Receipt</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {runs.map((r) => (
                <tr key={r.id}>
                  <Td>
                    <Link href={`/demo/app/households/${r.household_id}/checks`} className="font-medium text-navy hover:underline">
                      {households.get(r.household_id) ?? r.household_id}
                    </Link>
                  </Td>
                  <Td>{r.executed_at.replace("T", " ").slice(0, 19)}</Td>
                  <Td>
                    <ResultChip status={r.run_status} />
                  </Td>
                  <Td>{r.coverage_status?.toLowerCase().replace(/_/g, " ") ?? "—"}</Td>
                  <Td>{r.engine_name ? `${r.engine_name} ${r.engine_version}` : "—"}</Td>
                  <Td>{r.request_hash_verified ? <Mono>{r.request_sha256.slice(0, 12)}… ✓</Mono> : <span className="text-conflict-700">not verified</span>}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
