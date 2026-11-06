import { notFound } from "next/navigation";
import { Download, FileJson, FileText, Package } from "lucide-react";
import { can } from "@sagespan/contracts";
import { getDemoActor } from "@/auth/actor";
import { NOT_CHECKED, PACKET_LIMITATIONS, buildPacket } from "@/domain/evidence";
import { householdBundle, householdOrNull, profileName } from "@/domain/queries";
import { getStore } from "@/domain/store";
import { verifyAuditChain } from "@/domain/audit";
import { generatePacketAction } from "@/server/actions";
import { ActionForm } from "@/ui/ActionForm";
import { Alert, Card, Chip, EmptyState, KeyValue, Mono, Td, Th } from "@/ui/primitives";

export const dynamic = "force-dynamic";

export default async function EvidencePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await getDemoActor();
  const state = getStore().read();
  if (!householdOrNull(state, actor.org_id, id)) notFound();
  const b = householdBundle(state, actor.org_id, id);
  const status = b.household.workflow_status;
  const canGenerate = can(actor.role, "packet.export") && (status === "APPROVED" || status === "EXPORTED");
  const preview = b.currentSnapshot ? buildPacket(b, actor, state) : null;
  const latest = b.packets[0] ?? null;
  const chain = verifyAuditChain(state, actor.org_id);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <div className="space-y-6">
        <Card title="Review evidence packet — preview" subtitle="Structured, versioned, limited-scope. Not an SEC certification. The downloadable packet corresponds to exactly one immutable approved snapshot.">
          {!preview ? (
            <EmptyState title="Nothing to preview yet.">A packet is built from a frozen snapshot, its check runs and the review record.</EmptyState>
          ) : (
            <div className="space-y-5 text-sm">
              <KeyValue
                rows={[
                  { k: "Household", v: `${preview.household.label} · tax year ${preview.household.tax_year} · revision ${preview.household.revision}` },
                  { k: "Scope", v: `${preview.scope.check_types.join(", ")} on ${preview.scope.accounts.map((a) => a.label).join("; ")}` },
                  { k: "Snapshot", v: <Mono>{preview.snapshot.id} · {preview.snapshot.content_sha256}</Mono> },
                  { k: "Engine", v: preview.engine ? `${preview.engine.name} ${preview.engine.version}` : "no completed run" },
                  { k: "Rule sets", v: preview.rule_sets.length ? preview.rule_sets.map((r) => `${r.rule_set_id}@${r.version}`).join(", ") : "—" },
                  { k: "Sources", v: `${preview.sources.length} document(s) referenced by SHA-256` },
                  { k: "Facts", v: `${preview.facts.length} frozen` },
                  { k: "Check runs", v: preview.check_runs.map((r) => `${r.id}: ${r.run_status}`).join("; ") || "—" },
                  { k: "Discrepancies", v: preview.discrepancies.map((d) => `${d.classification_label} (${d.status.toLowerCase()})`).join("; ") || "—" },
                  { k: "Reviews", v: preview.reviews.map((r) => `${r.decision} by ${r.reviewer} (${r.reviewer_role}, ${r.actor_type.toLowerCase()})`).join("; ") || "none" },
                  { k: "Audit chain", v: <Chip tone={chain.intact ? "teal" : "conflict"}>{chain.intact ? `intact · ${chain.count} events` : `BROKEN at ${chain.brokenAt}`}</Chip> },
                ]}
              />
              <div>
                <h3 className="mb-1 font-semibold">Not checked</h3>
                <ul className="list-disc space-y-0.5 pl-5 text-ink-muted">
                  {NOT_CHECKED.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="mb-1 font-semibold">Limitations</h3>
                <ul className="list-disc space-y-0.5 pl-5 text-ink-muted">
                  {PACKET_LIMITATIONS.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </Card>
        <Card title="Export log" subtitle="Each export corresponds to one approved snapshot; re-exports log a separate event.">
          {b.packets.length === 0 ? (
            <p className="text-sm text-ink-muted">No packets generated.</p>
          ) : (
            <div className="-mx-5 overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead className="border-b border-line bg-surface-muted/60">
                  <tr>
                    <Th>Packet</Th>
                    <Th>Snapshot</Th>
                    <Th>Generated</Th>
                    <Th>SHA-256</Th>
                    <Th>Exports</Th>
                    <Th>Download</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {b.packets.map((p) => (
                    <tr key={p.id}>
                      <Td>
                        <code className="font-mono text-xs">{p.id}</code>
                      </Td>
                      <Td>
                        <code className="font-mono text-xs">{p.snapshot_id}</code>
                      </Td>
                      <Td>
                        {p.generated_at.replace("T", " ").slice(0, 16)} UTC
                        <div className="text-xs text-ink-faint">by {profileName(state, p.generated_by)}</div>
                      </Td>
                      <Td>
                        <code className="font-mono text-[11px]" title={p.sha256}>
                          {p.sha256.slice(0, 20)}…
                        </code>
                      </Td>
                      <Td>{p.export_count}</Td>
                      <Td>
                        <div className="flex flex-wrap gap-2">
                          <a className="inline-flex items-center gap-1 text-navy underline-offset-2 hover:underline" href={`/api/households/${id}/evidence/${p.id}?format=json`}>
                            <FileJson size={14} aria-hidden /> JSON
                          </a>
                          <a className="inline-flex items-center gap-1 text-navy underline-offset-2 hover:underline" href={`/api/households/${id}/evidence/${p.id}?format=html`}>
                            <FileText size={14} aria-hidden /> HTML
                          </a>
                          <a className="inline-flex items-center gap-1 text-navy underline-offset-2 hover:underline" href={`/api/households/${id}/evidence/${p.id}?format=csv`}>
                            <Download size={14} aria-hidden /> Facts CSV
                          </a>
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
      <div className="space-y-6">
        <Card title="Generate packet">
          <ActionForm action={generatePacketAction} hidden={{ household_id: id }} submitLabel={<><Package size={14} aria-hidden /> {status === "EXPORTED" ? "Re-export packet" : "Generate evidence packet"}</>} pendingLabel="Generating…" disabled={!canGenerate} disabledReason={!can(actor.role, "packet.export") ? `Role ${actor.role} cannot export packets.` : `Available after APPROVED (currently ${status.replace(/_/g, " ").toLowerCase()}).`} successMessage={(d) => `Packet ${d.packetId} ready. Download JSON or HTML from the export log.`} />
          <p className="mt-3 text-xs text-ink-muted">PDF is not bundled in this build because no reliable server-side renderer is configured; the HTML packet is print-ready (File → Print → Save as PDF).</p>
        </Card>
        {latest && (
          <Alert tone="teal" title="Latest packet">
            {latest.id} · sha256 {latest.sha256.slice(0, 16)}… · {latest.export_count} export(s)
          </Alert>
        )}
        <Alert tone="slate" title="Wording">
          This is a <em>review evidence packet</em> with source references, recorded assumptions, rule-set versions and reviewer actions. It is not an exam certification and does not establish full books-and-records compliance on its own.
        </Alert>
      </div>
    </div>
  );
}
