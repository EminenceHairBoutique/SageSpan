import { notFound } from "next/navigation";
import Link from "next/link";
import { FACT_FIELDS, can } from "@sagespan/contracts";
import { getDemoActor } from "@/auth/actor";
import { evaluateGateFromBundle } from "@/domain/freeze";
import { householdBundle, householdOrNull, personLabel, profileName } from "@/domain/queries";
import { getStore } from "@/domain/store";
import { assignAction, recordAssumptionAction } from "@/server/actions";
import { ActionForm } from "@/ui/ActionForm";
import { FactsTable } from "@/ui/console/FactsTable";
import { FreezeGatePanel } from "@/ui/console/FreezeGatePanel";
import { Alert, Card, Chip, Field, KeyValue, inputClasses } from "@/ui/primitives";

export const dynamic = "force-dynamic";

export default async function HouseholdOverview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await getDemoActor();
  const state = getStore().read();
  if (!householdOrNull(state, actor.org_id, id)) notFound();
  const b = householdBundle(state, actor.org_id, id);
  const gate = evaluateGateFromBundle(b);
  const openConflicts = b.conflicts.filter((c) => c.status === "OPEN");
  const missingAlive = gate.required.filter((r) => r.field_key === "person.is_alive" && r.status === "MISSING");
  const members = state.memberships.filter((m) => m.org_id === actor.org_id && m.status === "ACTIVE");

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <div className="space-y-6">
        {openConflicts.length > 0 && (
          <Alert tone="conflict" title={`${openConflicts.length} open conflict${openConflicts.length > 1 ? "s" : ""} keep the snapshot from freezing`}>
            {openConflicts.map((c) => (
              <div key={c.id} className="mt-1">
                <span className="font-medium">{FACT_FIELDS[c.field_key]?.label ?? c.field_key}</span> ({c.materiality.toLowerCase()}): {c.reason}{" "}
                <Link href={`/demo/app/households/${id}/review#${c.id}`} className="font-semibold underline-offset-2 hover:underline">
                  Resolve →
                </Link>
              </div>
            ))}
          </Alert>
        )}
        <Card title="Facts" subtitle="Four evidence states, each shown with colour, icon and label. Click a value for its receipt.">
          <FactsTable b={b} facts={b.activeFacts} />
          {b.facts.some((f) => f.superseded) && (
            <details className="mt-4 text-sm">
              <summary className="cursor-pointer font-medium text-navy">Superseded history ({b.facts.filter((f) => f.superseded).length})</summary>
              <div className="mt-2">
                <FactsTable b={b} facts={b.facts.filter((f) => f.superseded)} />
              </div>
            </details>
          )}
        </Card>
        <div className="grid gap-6 md:grid-cols-2">
          <Card title="People">
            <ul className="space-y-2 text-sm">
              {b.persons.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2">
                  <span className="font-medium">{p.display_name}</span>
                  <Chip tone="neutral">{p.role_in_household.toLowerCase()}</Chip>
                </li>
              ))}
            </ul>
          </Card>
          <Card title="Accounts, ownership & beneficiaries" subtitle="Ownership is effective-dated; percentages are recorded, never assumed.">
            <ul className="space-y-4 text-sm">
              {b.accounts.map((a) => (
                <li key={a.id}>
                  <div className="font-medium">
                    {a.label} <span className="text-xs font-normal text-ink-faint">{a.account_type}</span>
                  </div>
                  <KeyValue
                    className="mt-1"
                    rows={[
                      { k: "Owners", v: b.ownership.filter((o) => o.account_id === a.id).map((o) => `${personLabel(b, o.person_id)} ${o.percentage}% (${o.ownership_type.toLowerCase()}, from ${o.effective_from})`).join("; ") || "—" },
                      { k: "Primary", v: b.beneficiaries.filter((d) => d.account_id === a.id && d.designation_type === "PRIMARY").map((d) => `${d.beneficiary_person_id ? personLabel(b, d.beneficiary_person_id) : d.beneficiary_label} (${d.relationship.toLowerCase().replace(/_/g, " ")}, ${d.share_percentage}%${d.sole_primary_entire_year === true ? ", sole for entire year" : d.sole_primary_entire_year === false ? ", not sole" : ", sole status unrecorded"})`).join("; ") || "none on file" },
                      { k: "Contingent", v: b.beneficiaries.filter((d) => d.account_id === a.id && d.designation_type === "CONTINGENT").map((d) => `${d.beneficiary_person_id ? personLabel(b, d.beneficiary_person_id) : d.beneficiary_label} (${d.share_percentage}%)`).join("; ") || "none on file" },
                    ]}
                  />
                </li>
              ))}
            </ul>
          </Card>
        </div>
        <Card title="Source documents" subtitle="Every source is referenced by SHA-256; nothing is OCR'd or guessed.">
          <ul className="divide-y divide-line text-sm">
            {b.documents.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  <span className="font-medium">{d.filename}</span> <span className="text-ink-muted">· {d.source_kind.toLowerCase().replace(/_/g, " ")}</span>
                  {d.source_vendor_label && <span className="text-ink-muted"> · {d.source_vendor_label}</span>}
                  {d.source_as_of && <span className="text-ink-muted"> · as of {d.source_as_of}</span>}
                </span>
                <code className="font-mono text-[11px] text-ink-faint" title={d.sha256}>
                  {d.sha256.slice(0, 16)}… · {d.byte_length} B
                </code>
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <div className="space-y-6">
        <FreezeGatePanel gate={gate} householdId={id} status={b.household.workflow_status} actor={actor} />
        {missingAlive.length > 0 && (
          <Card title="Record a documented assumption" subtitle="Living status may be satisfied by an explicit assumption with a basis (ADVISOR or COMPLIANCE).">
            {missingAlive.map((r) => (
              <ActionForm key={r.subject_id} action={recordAssumptionAction} hidden={{ household_id: id, subject_type: "PERSON", subject_id: r.subject_id, field_key: "person.is_alive", value: "true" }} submitLabel={`Record: ${r.subject_label} is alive`} disabled={!can(actor.role, "fact.confirm")} disabledReason={`Role ${actor.role} cannot record assumptions.`} successMessage="Assumption recorded and gate re-evaluated.">
                <Field label="Basis" required hint="For example: no death notice on file; client contact confirmed on a stated date.">
                  <textarea name="basis" required minLength={10} rows={2} className={inputClasses} />
                </Field>
              </ActionForm>
            ))}
          </Card>
        )}
        <Card title="Assignment">
          <ActionForm action={assignAction} hidden={{ household_id: id }} submitLabel="Update assignee" size="sm" variant="secondary" successMessage="Assignee updated.">
            <select name="assignee" defaultValue={b.household.assignee_user_id ?? ""} className={inputClasses} aria-label="Assignee">
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {profileName(state, m.user_id)} · {m.role}
                </option>
              ))}
            </select>
          </ActionForm>
        </Card>
        <Card title="Assumptions on file">
          {b.assumptions.length === 0 ? (
            <p className="text-sm text-ink-muted">None.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {b.assumptions.map((a) => (
                <li key={a.id}>
                  <span className="font-medium">{FACT_FIELDS[a.key]?.label ?? a.key}</span> = {a.value_text ?? a.value_decimal}
                  <div className="text-xs text-ink-muted">{a.basis}</div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
