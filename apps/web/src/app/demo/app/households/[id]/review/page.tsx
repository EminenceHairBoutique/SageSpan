import { notFound } from "next/navigation";
import { CheckCheck, MessageSquare, Stamp } from "lucide-react";
import { FACT_FIELDS, can, canApprove, formatMoney } from "@sagespan/contracts";
import { getDemoActor } from "@/auth/actor";
import { factDisplayValue, householdBundle, householdOrNull, profileName, subjectLabel } from "@/domain/queries";
import { getStore } from "@/domain/store";
import { addCommentAction, approveAction, dispositionDiscrepancyAction, documentExceptionAction, recordReviewAction, resolveConflictAction } from "@/server/actions";
import { ActionForm } from "@/ui/ActionForm";
import { FactReceipt } from "@/ui/console/FactsTable";
import { Alert, Card, Chip, ClassificationChip, EmptyState, FactStatusChip, Field, inputClasses } from "@/ui/primitives";

export const dynamic = "force-dynamic";

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await getDemoActor();
  const state = getStore().read();
  if (!householdOrNull(state, actor.org_id, id)) notFound();
  const b = householdBundle(state, actor.org_id, id);
  const status = b.household.workflow_status;
  const snap = b.currentSnapshot;
  const runIds = new Set(b.checkRuns.filter((r) => r.snapshot_id === snap?.id).map((r) => r.id));
  const discrepancies = b.discrepancies.filter((d) => runIds.has(d.check_run_id));
  const openDisc = discrepancies.filter((d) => d.status === "OPEN");
  const policies = b.org.policies;
  const isApprover = canApprove(actor.role, policies.approver_roles);
  const sodConflict = policies.separation_of_duties && snap ? [snap.created_by === actor.user_id ? "froze the snapshot" : null, b.checkRuns.some((r) => r.snapshot_id === snap.id && r.executed_by === actor.user_id) ? "ran the check" : null].filter(Boolean) : [];
  const approveDisabledReason = !isApprover ? `Approval requires ${policies.approver_roles.join(" or ")}; you are ${actor.role}.` : status !== "REVIEWED" ? `Household must be REVIEWED first (currently ${status.replace(/_/g, " ").toLowerCase()}).` : openDisc.length ? `${openDisc.length} discrepancy(ies) need a disposition.` : sodConflict.length ? `Separation of duties: you ${sodConflict.join(" and ")}.` : undefined;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <div className="space-y-6">
        <Card title="Conflicts" subtitle="Resolving creates a new fact revision; history is retained. Material conflicts must be resolved in favour of primary evidence; nonmaterial ones may carry a documented exception when firm policy allows.">
          {b.conflicts.length === 0 ? (
            <EmptyState title="No conflicts recorded." />
          ) : (
            <div className="space-y-4">
              {b.conflicts.map((c) => {
                const facts = c.fact_ids.map((fid) => b.facts.find((f) => f.id === fid)).filter((f): f is NonNullable<typeof f> => !!f);
                return (
                  <div key={c.id} id={c.id} className="scroll-mt-24 rounded-lg border border-line p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Chip tone={c.materiality === "MATERIAL" ? "conflict" : "amber"}>{c.materiality.toLowerCase()}</Chip>
                      <Chip tone={c.status === "OPEN" ? "conflict" : c.status === "RESOLVED" ? "teal" : "slate"}>{c.status.toLowerCase().replace(/_/g, " ")}</Chip>
                      <span className="font-semibold">{FACT_FIELDS[c.field_key]?.label ?? c.field_key}</span>
                      <span className="text-sm text-ink-muted">· {subjectLabel(b, c.subject_type, c.subject_id)}</span>
                    </div>
                    <p className="mt-2 text-sm">{c.reason}</p>
                    <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                      {facts.map((f) => {
                        const doc = b.documents.find((d) => d.id === f.source_document_id);
                        const loc = b.locations.find((l) => l.id === f.source_location_id);
                        return (
                          <li key={f.id} className="rounded-lg border border-line bg-surface-muted/40 p-3 text-sm">
                            <div className="text-lg font-bold tabular">
                              <FactReceipt fact={f} b={b}>
                                {f.value_kind === "NUMBER" ? formatMoney(f.value_number) : factDisplayValue(f)}
                              </FactReceipt>
                            </div>
                            <div className="mt-1 text-xs text-ink-muted">
                              {doc ? `${doc.filename} · ${doc.source_kind.toLowerCase().replace(/_/g, " ")}` : "no document"} {loc?.row_number ? `· row ${loc.row_number}` : loc?.json_pointer ? `· ${loc.json_pointer}` : ""}
                            </div>
                            <div className="mt-1 text-xs text-ink-muted">as of {f.as_of_date}</div>
                            <div className="mt-1">
                              <FactStatusChip status={f.verification_status} />
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                    {c.status === "OPEN" ? (
                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <ActionForm action={resolveConflictAction} hidden={{ conflict_id: c.id }} submitLabel="Resolve with chosen source" size="sm" disabled={!can(actor.role, "conflict.resolve")} disabledReason={`Role ${actor.role} cannot resolve conflicts.`} successMessage="Resolved; a new fact revision was created and the gate re-evaluated.">
                          <fieldset className="space-y-1.5 text-sm">
                            <legend className="font-medium">Governing fact</legend>
                            {facts.map((f) => {
                              const doc = b.documents.find((d) => d.id === f.source_document_id);
                              return (
                                <label key={f.id} className="flex items-center gap-2">
                                  <input type="radio" name="chosen_fact_id" value={f.id} required />
                                  <span>
                                    {f.value_kind === "NUMBER" ? formatMoney(f.value_number) : factDisplayValue(f)} <span className="text-ink-muted">({doc?.source_kind.toLowerCase().replace(/_/g, " ") ?? "no source"})</span>
                                  </span>
                                </label>
                              );
                            })}
                          </fieldset>
                          <Field label="Rationale" required hint="Why this source governs. Recorded in the audit trail and evidence packet.">
                            <textarea name="rationale" rows={2} minLength={10} required className={inputClasses} />
                          </Field>
                        </ActionForm>
                        {c.materiality === "NONMATERIAL" && (
                          <ActionForm action={documentExceptionAction} hidden={{ conflict_id: c.id }} submitLabel="Document exception (COMPLIANCE)" size="sm" variant="secondary" disabled={!can(actor.role, "exception.document") || !policies.allow_nonmaterial_exceptions} disabledReason={!policies.allow_nonmaterial_exceptions ? "Firm policy does not allow nonmaterial exceptions." : `Role ${actor.role} cannot document exceptions.`} successMessage="Exception documented under firm policy.">
                            <Field label="Exception rationale" required>
                              <textarea name="rationale" rows={2} minLength={10} required className={inputClasses} />
                            </Field>
                          </ActionForm>
                        )}
                      </div>
                    ) : (
                      <p className="mt-3 rounded-lg bg-surface-muted p-2 text-xs">
                        {c.status === "RESOLVED" ? "Resolved" : "Exception documented"} by {profileName(state, c.resolved_by)} on {c.resolved_at?.slice(0, 10)}: {c.resolution_note}
                        {c.chosen_fact_id && <> · governing fact <code className="font-mono">{c.chosen_fact_id}</code></>}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card title="Discrepancies" subtitle="Each classified difference needs a reviewer disposition before approval. A classification is not a finding of error.">
          {discrepancies.length === 0 ? (
            <EmptyState title="No discrepancies for the current snapshot." />
          ) : (
            <div className="space-y-4">
              {discrepancies.map((d) => (
                <div key={d.id} className="rounded-lg border border-line p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <ClassificationChip classification={d.classification} />
                    <Chip tone={d.status === "OPEN" ? "amber" : "teal"}>{d.status.toLowerCase()}</Chip>
                    <span className="text-sm">
                      computed {formatMoney(d.computed_amount)} · imported {formatMoney(d.imported_amount)} · difference {formatMoney(d.delta_amount)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm">{d.explanation}</p>
                  <p className="mt-1 text-sm text-ink-muted">Next step: {d.next_step}</p>
                  {d.status === "OPEN" ? (
                    <ActionForm action={dispositionDiscrepancyAction} hidden={{ discrepancy_id: d.id }} submitLabel="Record disposition" size="sm" className="mt-3" disabled={!can(actor.role, "review.disposition")} disabledReason={`Role ${actor.role} cannot record dispositions.`} successMessage="Disposition recorded.">
                      <Field label="Disposition note" required>
                        <textarea name="note" rows={2} minLength={10} required className={inputClasses} />
                      </Field>
                    </ActionForm>
                  ) : (
                    <p className="mt-2 rounded-lg bg-surface-muted p-2 text-xs">
                      {profileName(state, d.disposition!.by)} ({d.disposition!.role}) on {d.disposition!.at.slice(0, 10)}: {d.disposition!.note}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Comments">
          <ul className="space-y-2 text-sm">
            {b.comments.map((c) => (
              <li key={c.id} className="rounded-lg bg-surface-muted/60 p-3">
                <div className="text-xs text-ink-muted">
                  {profileName(state, c.author_user_id)} ({c.author_role}) · {c.created_at.replace("T", " ").slice(0, 16)} UTC
                </div>
                <div className="mt-1">{c.body}</div>
              </li>
            ))}
          </ul>
          <ActionForm action={addCommentAction} hidden={{ household_id: id }} submitLabel={<><MessageSquare size={14} aria-hidden /> Add comment</>} size="sm" variant="secondary" className="mt-3" disabled={!can(actor.role, "review.comment")} disabledReason={`Role ${actor.role} cannot comment.`}>
            <textarea name="body" rows={2} maxLength={2000} required placeholder="Authorized comment (recorded in the audit trail)" className={inputClasses} aria-label="Comment" />
          </ActionForm>
        </Card>
      </div>

      <div className="space-y-6">
        <Card title="Review and approval" subtitle="Arithmetic PASS is not approval. Approval records identity, role, rationale and a conflict attestation.">
          <Alert tone="slate" className="mb-4">
            Firm policy: approvers {policies.approver_roles.join(", ")} · separation of duties {policies.separation_of_duties ? "on" : "off"} · nonmaterial exceptions {policies.allow_nonmaterial_exceptions ? "allowed" : "not allowed"}.
          </Alert>
          <ActionForm action={recordReviewAction} hidden={{ household_id: id }} submitLabel={<><CheckCheck size={14} aria-hidden /> Record review</>} disabled={status !== "REVIEW_PENDING" || !can(actor.role, "review.disposition")} disabledReason={status !== "REVIEW_PENDING" ? `Available when REVIEW_PENDING (currently ${status.replace(/_/g, " ").toLowerCase()}).` : `Role ${actor.role} cannot record reviews.`} successMessage="Review recorded.">
            <Field label="Review rationale" required>
              <textarea name="rationale" rows={3} minLength={10} required className={inputClasses} />
            </Field>
          </ActionForm>
          <hr className="my-5 border-line" />
          <ActionForm action={approveAction} hidden={{ household_id: id }} submitLabel={<><Stamp size={14} aria-hidden /> Approve (professional act)</>} disabled={!!approveDisabledReason} disabledReason={approveDisabledReason} successMessage="Approved. Generate the evidence packet from the Evidence tab.">
            <Field label="Approval rationale" required>
              <textarea name="rationale" rows={3} minLength={10} required className={inputClasses} />
            </Field>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="attestation" required className="mt-0.5" />
              <span>I attest that all conflicts were resolved or carried by a documented exception, that I reviewed the source evidence and the independent check receipt, and that this approval is my professional judgment, not an automated result.</span>
            </label>
          </ActionForm>
          {actor.mode === "DEMO" && <p className="mt-3 text-xs text-ink-muted">Demo: this records a <strong>simulated reviewer</strong>. Production requires an authenticated user; the role and identity are enforced server-side and in the database.</p>}
        </Card>
        <Card title="Review history">
          {b.reviews.length === 0 ? (
            <p className="text-sm text-ink-muted">No reviews yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {b.reviews.map((r) => (
                <li key={r.id} className="rounded-lg border border-line p-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Chip tone={r.decision === "APPROVED" ? "teal" : r.decision === "REJECTED" ? "conflict" : "slate"}>{r.decision.toLowerCase()}</Chip>
                    <span className="font-medium">{profileName(state, r.reviewer_user_id)}</span>
                    <span className="text-xs text-ink-muted">
                      {r.reviewer_role} · {r.actor_type.toLowerCase().replace(/_/g, " ")} · {r.reviewed_at.replace("T", " ").slice(0, 16)} UTC
                    </span>
                  </div>
                  <p className="mt-1 text-ink-muted">{r.rationale}</p>
                  {r.conflict_attestation && <p className="mt-1 text-xs text-teal-700">Conflict attestation recorded.</p>}
                  <p className="text-xs text-ink-faint">snapshot {r.snapshot_id}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
