import Link from "next/link";
import { getDemoActor } from "@/auth/actor";
import { listHouseholds } from "@/domain/queries";
import { getStore } from "@/domain/store";
import { Card, Chip, Mono, Td, Th } from "@/ui/primitives";

export const dynamic = "force-dynamic";

export default async function ImportsPage() {
  const actor = await getDemoActor();
  const state = getStore().read();
  const households = new Map(listHouseholds(state, actor.org_id).map((h) => [h.id, h.label]));
  const docs = state.source_documents.filter((d) => d.org_id === actor.org_id).sort((a, b) => b.uploaded_at.localeCompare(a.uploaded_at));
  const imports = state.plan_imports.filter((i) => i.org_id === actor.org_id).sort((a, b) => b.imported_at.localeCompare(a.imported_at));
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Imports &amp; evidence</h1>
        <p className="mt-1 text-sm text-ink-muted">Firm-wide view of source documents and plan imports. Documents are hashed on receipt; planning-tool exports are claims, statements and forms are evidence. Import new files from a household&apos;s Imports tab.</p>
      </div>
      <Card title={`Source documents (${docs.length})`}>
        <table className="w-full">
          <thead className="border-b border-line">
            <tr>
              <Th>Household</Th>
              <Th>Document</Th>
              <Th>Kind</Th>
              <Th>As of</Th>
              <Th>SHA-256</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {docs.map((d) => (
              <tr key={d.id}>
                <Td>
                  <Link href={`/demo/app/households/${d.household_id}/imports`} className="font-medium text-navy hover:underline">
                    {households.get(d.household_id) ?? d.household_id}
                  </Link>
                </Td>
                <Td>{d.filename}</Td>
                <Td>
                  <Chip tone={d.source_kind === "PLAN_EXPORT" ? "slate" : "teal"}>{d.source_kind.toLowerCase().replace(/_/g, " ")}</Chip>
                </Td>
                <Td>{d.source_as_of ?? "—"}</Td>
                <Td>
                  <Mono>{d.sha256.slice(0, 16)}…</Mono>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Card title={`Plan imports (${imports.length})`}>
        {imports.length === 0 ? (
          <p className="text-sm text-ink-muted">No imports in progress.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {imports.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  <Link href={`/demo/app/households/${i.household_id}/imports`} className="font-medium text-navy hover:underline">
                    {households.get(i.household_id) ?? i.household_id}
                  </Link>{" "}
                  · {i.format} {i.format_version} · {i.row_count} rows
                </span>
                <Chip tone={i.import_status === "RECONCILED" ? "teal" : i.import_status === "REJECTED" ? "conflict" : "amber"}>{i.import_status.toLowerCase().replace(/_/g, " ")}</Chip>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
