import { FACT_FIELDS, formatMoney, type Fact } from "@sagespan/contracts";
import type { HouseholdBundle } from "@/domain/queries";
import { factDisplayValue, subjectLabel } from "@/domain/queries";
import { ReceiptButton } from "@/ui/ReceiptDialog";
import { FactStatusChip, Mono, Td, Th } from "@/ui/primitives";

export function FactReceipt({ fact, b, children }: { fact: Fact; b: HouseholdBundle; children: React.ReactNode }) {
  const doc = b.documents.find((d) => d.id === fact.source_document_id);
  const loc = b.locations.find((l) => l.id === fact.source_location_id);
  const asm = b.assumptions.find((a) => a.id === fact.assumption_id);
  const def = FACT_FIELDS[fact.field_key];
  return (
    <ReceiptButton
      title={`${def?.label ?? fact.field_key} — ${subjectLabel(b, fact.subject_type, fact.subject_id)}`}
      subtitle="Fact receipt: value, source, as-of date and verification status"
      rows={[
        { label: "Value", value: fact.value_kind === "NUMBER" ? formatMoney(fact.value_number, fact.value_currency ?? "USD") : factDisplayValue(fact) },
        { label: "As of", value: fact.as_of_date },
        { label: "Status", value: <FactStatusChip status={fact.verification_status} /> },
        { label: "Materiality", value: def?.materiality ?? "NONMATERIAL (unregistered field)" },
        { label: "Source", value: doc ? `${doc.filename} (${doc.source_kind.toLowerCase().replace(/_/g, " ")}${doc.source_as_of ? `, as of ${doc.source_as_of}` : ""})` : asm ? "Documented assumption" : "—" },
        { label: "Location", value: loc ? (loc.row_number ? `row ${loc.row_number}` : loc.json_pointer ?? loc.text_span ?? "—") : "—" },
        { label: "Source SHA-256", value: doc?.sha256 ?? "—", mono: true },
        ...(asm ? [{ label: "Assumption basis", value: asm.basis }] : []),
        ...(loc?.text_span ? [{ label: "Excerpt", value: <Mono>{loc.text_span}</Mono> }] : []),
        { label: "Fact id", value: `${fact.id} (revision ${fact.revision}${fact.supersedes_fact_id ? `, supersedes ${fact.supersedes_fact_id}` : ""})`, mono: true },
        ...(fact.note ? [{ label: "Note", value: fact.note }] : []),
      ]}
    >
      {children}
    </ReceiptButton>
  );
}

export function FactsTable({ b, facts }: { b: HouseholdBundle; facts: Fact[] }) {
  const grouped = facts.reduce<Record<string, Fact[]>>((acc, f) => {
    const key = `${f.subject_type}:${f.subject_id}`;
    (acc[key] ??= []).push(f);
    return acc;
  }, {});
  return (
    <div className="-mx-5 overflow-x-auto">
      <table className="w-full min-w-[820px]">
        <thead className="border-b border-line bg-surface-muted/60">
          <tr>
            <Th>Fact</Th>
            <Th align="right">Value</Th>
            <Th>As of</Th>
            <Th>Status</Th>
            <Th>Source</Th>
            <Th>Location</Th>
          </tr>
        </thead>
        {Object.entries(grouped).map(([key, list]) => {
          const [type, id] = key.split(":") as [string, string];
          return (
            <tbody key={key} className="divide-y divide-line border-b border-line">
              <tr className="bg-surface-muted/30">
                <td colSpan={6} className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  {type === "PERSON" ? "Person" : "Account"} · {subjectLabel(b, type, id)}
                </td>
              </tr>
              {list
                .sort((a, c) => a.field_key.localeCompare(c.field_key) || a.as_of_date.localeCompare(c.as_of_date))
                .map((f) => {
                  const doc = b.documents.find((d) => d.id === f.source_document_id);
                  const loc = b.locations.find((l) => l.id === f.source_location_id);
                  const def = FACT_FIELDS[f.field_key];
                  return (
                    <tr key={f.id} className={f.verification_status === "FACT_CONFLICT" ? "bg-conflict-100/30" : undefined}>
                      <Td>
                        <div className="font-medium">{def?.label ?? f.field_key}</div>
                        <div className="text-xs text-ink-faint">
                          {f.field_key} · {def?.materiality === "MATERIAL" ? "material" : "nonmaterial"}
                        </div>
                      </Td>
                      <Td align="right">
                        <FactReceipt fact={f} b={b}>
                          {f.value_kind === "NUMBER" ? formatMoney(f.value_number, f.value_currency ?? "USD") : factDisplayValue(f)}
                        </FactReceipt>
                      </Td>
                      <Td>{f.as_of_date}</Td>
                      <Td>
                        <FactStatusChip status={f.verification_status} />
                      </Td>
                      <Td>{doc ? <span title={doc.sha256}>{doc.filename}</span> : f.assumption_id ? <span className="text-slate-700">assumption</span> : "—"}</Td>
                      <Td className="text-ink-muted">{loc ? (loc.row_number ? `row ${loc.row_number}` : loc.json_pointer ?? loc.text_span) : "—"}</Td>
                    </tr>
                  );
                })}
            </tbody>
          );
        })}
      </table>
    </div>
  );
}
