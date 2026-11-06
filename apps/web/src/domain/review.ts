import { FACT_FIELDS, assertCan, assertTransition, type DataState, type Fact, type Review, type Role } from "@sagespan/contracts";
import type { Actor } from "@/auth/types";
import { appendAudit } from "./audit";
import { DomainError } from "./errors";
import { isPrimaryEvidence, typedValue } from "./facts";
import { applyGateToStatus } from "./reconcile";
import { reopenForNewRevision } from "./freeze";
import { newId, nowIso } from "./ids";
import { householdBundle, requireHousehold } from "./queries";

const MIN_RATIONALE = 10;

function requireRationale(text: string | null | undefined, what: string): string {
  const t = (text ?? "").trim();
  if (t.length < MIN_RATIONALE) throw new DomainError("RATIONALE_REQUIRED", `${what} requires a written rationale of at least ${MIN_RATIONALE} characters.`);
  return t;
}

function actorFields(actor: Actor) {
  return { org_id: actor.org_id, actor_user_id: actor.user_id, actor_role: actor.role, actor_type: actor.actor_type };
}

/** Resolve a conflict by choosing the governing fact. Creates a new fact revision; never mutates history. */
export function resolveConflict(state: DataState, actor: Actor, conflictId: string, chosenFactId: string, rationale: string): Fact {
  assertCan(actor.role, "conflict.resolve");
  const conflict = state.fact_conflicts.find((c) => c.id === conflictId && c.org_id === actor.org_id);
  if (!conflict) throw new DomainError("NOT_FOUND", "Conflict not found", 404);
  if (conflict.status !== "OPEN") throw new DomainError("INVALID_STATE", `Conflict is already ${conflict.status}.`);
  if (!conflict.fact_ids.includes(chosenFactId)) throw new DomainError("INVALID_CHOICE", "The chosen fact is not part of this conflict.");
  const note = requireRationale(rationale, "Resolving a conflict");
  const hh = requireHousehold(state, actor.org_id, conflict.household_id);
  const chosen = state.facts.find((f) => f.id === chosenFactId && f.org_id === actor.org_id);
  if (!chosen) throw new DomainError("NOT_FOUND", "Fact not found", 404);
  const chosenDoc = state.source_documents.find((d) => d.id === chosen.source_document_id);
  if (conflict.materiality === "MATERIAL" && !isPrimaryEvidence(chosenDoc?.source_kind) && actor.role !== "COMPLIANCE") {
    throw new DomainError("PRIMARY_EVIDENCE_REQUIRED", "A material conflict may only be resolved in favour of primary evidence (statement, profile or beneficiary form). A COMPLIANCE user may override with rationale.");
  }
  const revision = Math.max(...conflict.fact_ids.map((id) => state.facts.find((f) => f.id === id)?.revision ?? 1)) + 1;
  const resolved: Fact = { ...chosen, id: newId("fact"), revision, supersedes_fact_id: chosen.id, superseded: false, verification_status: "FACT_CONFIRMED", note: `Resolved conflict ${conflict.id}: ${note}`, created_at: nowIso(), created_by: actor.user_id };
  for (const id of conflict.fact_ids) {
    const f = state.facts.find((x) => x.id === id);
    if (f) f.superseded = true;
  }
  state.facts.push(resolved);
  conflict.status = "RESOLVED";
  conflict.chosen_fact_id = resolved.id;
  conflict.resolution_note = note;
  conflict.resolved_by = actor.user_id;
  conflict.resolved_at = nowIso();
  appendAudit(state, { ...actorFields(actor), event_type: "CONFLICT_RESOLVED", entity_type: "fact_conflict", entity_id: conflict.id, summary: `Conflict ${conflict.id} (${conflict.field_key}, ${conflict.materiality}) resolved; fact ${resolved.id} (revision ${revision}) supersedes ${conflict.fact_ids.join(", ")}`, payload: { conflict_id: conflict.id, chosen_fact_id: resolved.id } });
  reopenForNewRevision(state, actor, hh, `conflict ${conflict.id} resolved`);
  applyGateToStatus(state, actor, hh);
  return resolved;
}

/** Document a policy-allowed exception for a NONMATERIAL conflict (COMPLIANCE only). */
export function documentException(state: DataState, actor: Actor, conflictId: string, rationale: string): void {
  assertCan(actor.role, "exception.document");
  const conflict = state.fact_conflicts.find((c) => c.id === conflictId && c.org_id === actor.org_id);
  if (!conflict) throw new DomainError("NOT_FOUND", "Conflict not found", 404);
  if (conflict.status !== "OPEN") throw new DomainError("INVALID_STATE", `Conflict is already ${conflict.status}.`);
  if (conflict.materiality !== "NONMATERIAL") throw new DomainError("EXCEPTION_NOT_ALLOWED", "Material conflicts cannot be carried by exception; they must be resolved.");
  const org = state.organizations.find((o) => o.id === actor.org_id)!;
  if (!org.policies.allow_nonmaterial_exceptions) throw new DomainError("EXCEPTION_NOT_ALLOWED", "Firm policy does not allow nonmaterial exceptions.");
  const note = requireRationale(rationale, "Documenting an exception");
  const hh = requireHousehold(state, actor.org_id, conflict.household_id);
  conflict.status = "EXCEPTION_DOCUMENTED";
  conflict.resolution_note = note;
  conflict.resolved_by = actor.user_id;
  conflict.resolved_at = nowIso();
  appendAudit(state, { ...actorFields(actor), event_type: "EXCEPTION_DOCUMENTED", entity_type: "fact_conflict", entity_id: conflict.id, summary: `Nonmaterial conflict ${conflict.id} (${conflict.field_key}) carried by documented exception under firm policy`, payload: { conflict_id: conflict.id } });
  reopenForNewRevision(state, actor, hh, `exception documented for ${conflict.id}`);
  applyGateToStatus(state, actor, hh);
}

/** Record a documented assumption for a fact that policy allows to be assumed (e.g. living status). */
export function recordAssumption(state: DataState, actor: Actor, householdId: string, subjectType: "PERSON" | "ACCOUNT", subjectId: string, fieldKey: string, rawValue: string, basis: string): Fact {
  assertCan(actor.role, "fact.confirm");
  const hh = requireHousehold(state, actor.org_id, householdId);
  const def = FACT_FIELDS[fieldKey];
  if (!def) throw new DomainError("UNKNOWN_FIELD", `Unknown fact field ${fieldKey}.`);
  if (!def.assumption_allowed) throw new DomainError("ASSUMPTION_NOT_ALLOWED", `${def.label} cannot be satisfied by an assumption; primary evidence is required.`);
  const b = householdBundle(state, actor.org_id, householdId);
  const subjectExists = subjectType === "PERSON" ? b.persons.some((p) => p.id === subjectId) : b.accounts.some((a) => a.id === subjectId);
  if (!subjectExists) throw new DomainError("NOT_FOUND", "Subject not found in this household", 404);
  const text = requireRationale(basis, "Recording an assumption");
  let set = b.assumptionSets.at(-1);
  if (!set) {
    set = { id: newId("asmset"), org_id: actor.org_id, household_id: householdId, version: 1, created_by: actor.user_id, created_at: nowIso(), methodology_id: null };
    state.assumption_sets.push(set);
  }
  const typed = typedValue(def.value_kind, rawValue);
  const fact: Fact = {
    id: newId("fact"),
    org_id: actor.org_id,
    household_id: householdId,
    subject_type: subjectType,
    subject_id: subjectId,
    field_key: fieldKey,
    value_kind: def.value_kind,
    ...typed,
    value_currency: def.value_kind === "NUMBER" ? "USD" : null,
    unit: def.unit ?? null,
    as_of_date: nowIso().slice(0, 10),
    effective_from: null,
    effective_to: null,
    source_document_id: null,
    source_location_id: null,
    verification_status: "FACT_ASSUMED",
    revision: 1,
    supersedes_fact_id: null,
    superseded: false,
    assumption_id: null,
    note: "Documented assumption; see assumption set",
    created_at: nowIso(),
    created_by: actor.user_id,
  };
  const assumption = { id: newId("asm"), org_id: actor.org_id, assumption_set_id: set.id, key: fieldKey, value_kind: def.value_kind, value_decimal: typed.value_number, value_text: typed.value_text ?? (typed.value_bool === null ? typed.value_date : String(typed.value_bool)), unit: def.unit ?? null, source_fact_id: fact.id, basis: text };
  fact.assumption_id = assumption.id;
  state.assumptions.push(assumption);
  state.facts.push(fact);
  appendAudit(state, { ...actorFields(actor), event_type: "ASSUMPTION_RECORDED", entity_type: "fact", entity_id: fact.id, summary: `Assumption recorded for ${fieldKey} on ${subjectType.toLowerCase()} ${subjectId} in household ${householdId}` });
  reopenForNewRevision(state, actor, hh, `assumption recorded for ${fieldKey}`);
  applyGateToStatus(state, actor, hh);
  return fact;
}

/** Manually confirm a NEEDS_CONFIRMATION fact with rationale and an evidence reference (ADVISOR / COMPLIANCE). */
export function confirmFact(state: DataState, actor: Actor, factId: string, rationale: string, evidenceReference: string): Fact {
  assertCan(actor.role, "fact.confirm");
  const fact = state.facts.find((f) => f.id === factId && f.org_id === actor.org_id);
  if (!fact || fact.superseded) throw new DomainError("NOT_FOUND", "Fact not found", 404);
  if (fact.verification_status !== "NEEDS_CONFIRMATION") throw new DomainError("INVALID_STATE", `Fact is ${fact.verification_status}; only NEEDS_CONFIRMATION facts can be manually confirmed.`);
  const note = requireRationale(rationale, "Confirming a fact");
  const ref = (evidenceReference ?? "").trim();
  if (ref.length < 3) throw new DomainError("EVIDENCE_REFERENCE_REQUIRED", "An evidence reference (e.g. 'custodian call 2026-11-03, ref 1234') is required.");
  const hh = requireHousehold(state, actor.org_id, fact.household_id);
  const confirmed: Fact = { ...fact, id: newId("fact"), revision: fact.revision + 1, supersedes_fact_id: fact.id, verification_status: "FACT_CONFIRMED", note: `Manually confirmed by ${actor.role}: ${note} [evidence: ${ref}]`, created_at: nowIso(), created_by: actor.user_id };
  fact.superseded = true;
  state.facts.push(confirmed);
  appendAudit(state, { ...actorFields(actor), event_type: "FACT_CONFIRMED", entity_type: "fact", entity_id: confirmed.id, summary: `Fact ${fact.id} (${fact.field_key}) manually confirmed as revision ${confirmed.revision} with evidence reference` });
  reopenForNewRevision(state, actor, hh, `fact ${fact.field_key} confirmed`);
  applyGateToStatus(state, actor, hh);
  return confirmed;
}

export function addComment(state: DataState, actor: Actor, householdId: string, body: string): void {
  assertCan(actor.role, "review.comment");
  const hh = requireHousehold(state, actor.org_id, householdId);
  const text = body.trim();
  if (!text) throw new DomainError("EMPTY_COMMENT", "Comment cannot be empty.");
  if (text.length > 2000) throw new DomainError("COMMENT_TOO_LONG", "Comment exceeds 2000 characters.");
  const b = householdBundle(state, actor.org_id, householdId);
  const comment = { id: newId("cmt"), org_id: actor.org_id, household_id: hh.id, snapshot_id: b.currentSnapshot?.id ?? null, author_user_id: actor.user_id, author_role: actor.role, body: text, created_at: nowIso() };
  state.review_comments.push(comment);
  appendAudit(state, { ...actorFields(actor), event_type: "REVIEW_COMMENT_ADDED", entity_type: "review_comment", entity_id: comment.id, summary: `Comment added on household ${hh.id}` });
}

export function dispositionDiscrepancy(state: DataState, actor: Actor, discrepancyId: string, note: string): void {
  assertCan(actor.role, "review.disposition");
  const d = state.discrepancies.find((x) => x.id === discrepancyId && x.org_id === actor.org_id);
  if (!d) throw new DomainError("NOT_FOUND", "Discrepancy not found", 404);
  const text = requireRationale(note, "Dispositioning a discrepancy");
  d.status = "DISPOSITIONED";
  d.disposition = { by: actor.user_id, role: actor.role, at: nowIso(), note: text };
  appendAudit(state, { ...actorFields(actor), event_type: "DISCREPANCY_DISPOSITIONED", entity_type: "discrepancy", entity_id: d.id, summary: `Discrepancy ${d.id} (${d.classification}) dispositioned` });
}

export function recordReview(state: DataState, actor: Actor, householdId: string, rationale: string): Review {
  assertCan(actor.role, "review.disposition");
  const hh = requireHousehold(state, actor.org_id, householdId);
  const b = householdBundle(state, actor.org_id, householdId);
  if (!b.currentSnapshot) throw new DomainError("INVALID_STATE", "No frozen snapshot to review.");
  assertTransition(hh.workflow_status, "REVIEWED");
  const text = requireRationale(rationale, "Recording a review");
  const review: Review = { id: newId("rev"), org_id: actor.org_id, snapshot_id: b.currentSnapshot.id, household_id: hh.id, reviewer_user_id: actor.user_id, reviewer_role: actor.role, actor_type: actor.actor_type, decision: "REVIEWED", rationale: text, conflict_attestation: false, reviewed_at: nowIso() };
  state.reviews.push(review);
  hh.workflow_status = "REVIEWED";
  hh.updated_at = nowIso();
  appendAudit(state, { ...actorFields(actor), event_type: "REVIEW_RECORDED", entity_type: "review", entity_id: review.id, summary: `Review recorded for snapshot ${review.snapshot_id} by ${actor.role} (${actor.actor_type})` });
  return review;
}

export interface ApprovalInput {
  rationale: string;
  conflictAttestation: boolean;
}

/**
 * Approval is a professional act, distinct from the arithmetic PASS. It requires:
 * an approver role per firm policy, a rationale, an explicit conflict attestation,
 * all discrepancies dispositioned, and (if policy requires) separation of duties
 * from the person who froze the snapshot or ran the check.
 */
export function approveReview(state: DataState, actor: Actor, householdId: string, input: ApprovalInput): Review {
  assertCan(actor.role, "review.approve");
  const org = state.organizations.find((o) => o.id === actor.org_id)!;
  if (!org.policies.approver_roles.includes(actor.role)) {
    appendAudit(state, { ...actorFields(actor), event_type: "APPROVAL_DENIED", entity_type: "household", entity_id: householdId, summary: `Approval denied: role ${actor.role} is not an approver role under firm policy` });
    throw new DomainError("NOT_AN_APPROVER", `Firm policy allows approval by ${org.policies.approver_roles.join(", ")} only.`);
  }
  const hh = requireHousehold(state, actor.org_id, householdId);
  const b = householdBundle(state, actor.org_id, householdId);
  const snap = b.currentSnapshot;
  if (!snap) throw new DomainError("INVALID_STATE", "No frozen snapshot to approve.");
  assertTransition(hh.workflow_status, "APPROVED");
  const text = requireRationale(input.rationale, "Approval");
  if (!input.conflictAttestation) throw new DomainError("ATTESTATION_REQUIRED", "You must attest that all conflicts were resolved or carried by documented exception and that the evidence was reviewed.");
  const runs = b.checkRuns.filter((r) => r.snapshot_id === snap.id);
  if (runs.length === 0 || runs.some((r) => r.run_status === "ERROR")) throw new DomainError("CHECK_REQUIRED", "A completed independent check is required before approval.");
  const openDisc = b.discrepancies.filter((d) => runs.some((r) => r.id === d.check_run_id) && d.status === "OPEN");
  if (openDisc.length) throw new DomainError("OPEN_DISCREPANCIES", `${openDisc.length} discrepancy(ies) still need a disposition before approval.`);
  if (org.policies.separation_of_duties) {
    const conflictsWith: string[] = [];
    if (snap.created_by === actor.user_id) conflictsWith.push("froze the snapshot");
    if (runs.some((r) => r.executed_by === actor.user_id)) conflictsWith.push("ran the check");
    if (conflictsWith.length) {
      appendAudit(state, { ...actorFields(actor), event_type: "APPROVAL_DENIED", entity_type: "snapshot", entity_id: snap.id, summary: `Approval denied by separation-of-duties policy: approver ${conflictsWith.join(" and ")}` });
      throw new DomainError("SEPARATION_OF_DUTIES", `Separation of duties: the approver cannot be the person who ${conflictsWith.join(" and ")}.`);
    }
  }
  const review: Review = { id: newId("rev"), org_id: actor.org_id, snapshot_id: snap.id, household_id: hh.id, reviewer_user_id: actor.user_id, reviewer_role: actor.role, actor_type: actor.actor_type, decision: "APPROVED", rationale: text, conflict_attestation: true, reviewed_at: nowIso() };
  state.reviews.push(review);
  hh.workflow_status = "APPROVED";
  hh.updated_at = nowIso();
  appendAudit(state, { ...actorFields(actor), event_type: "APPROVAL_RECORDED", entity_type: "review", entity_id: review.id, summary: `Snapshot ${snap.id} approved by ${actor.role} (${actor.actor_type}) with conflict attestation`, payload: { review_id: review.id, snapshot_id: snap.id } });
  return review;
}

export function assignHousehold(state: DataState, actor: Actor, householdId: string, assigneeUserId: string | null): void {
  if (!["ADMIN", "COMPLIANCE", "ADVISOR", "ANALYST"].includes(actor.role)) throw new DomainError("PERMISSION_DENIED", "Role cannot change assignment.", 403);
  const hh = requireHousehold(state, actor.org_id, householdId);
  if (assigneeUserId && !state.memberships.some((m) => m.org_id === actor.org_id && m.user_id === assigneeUserId && m.status === "ACTIVE")) throw new DomainError("INVALID_ASSIGNEE", "Assignee is not an active member of this organisation.");
  hh.assignee_user_id = assigneeUserId;
  hh.updated_at = nowIso();
  appendAudit(state, { ...actorFields(actor), event_type: "ASSIGNEE_CHANGED", entity_type: "household", entity_id: hh.id, summary: `Household ${hh.id} assigned to ${assigneeUserId ?? "nobody"}` });
}

export function updatePolicy(state: DataState, actor: Actor, patch: { separation_of_duties?: boolean; allow_nonmaterial_exceptions?: boolean; approver_roles?: Role[] }): void {
  assertCan(actor.role, "org.manage_policy");
  const org = state.organizations.find((o) => o.id === actor.org_id)!;
  if (patch.separation_of_duties !== undefined) org.policies.separation_of_duties = patch.separation_of_duties;
  if (patch.allow_nonmaterial_exceptions !== undefined) org.policies.allow_nonmaterial_exceptions = patch.allow_nonmaterial_exceptions;
  if (patch.approver_roles) {
    const allowed = patch.approver_roles.filter((r) => ["COMPLIANCE", "ADVISOR"].includes(r));
    if (!allowed.length) throw new DomainError("INVALID_POLICY", "At least one approver role (COMPLIANCE or ADVISOR) is required.");
    org.policies.approver_roles = allowed;
  }
  appendAudit(state, { ...actorFields(actor), event_type: "POLICY_UPDATED", entity_type: "organization", entity_id: org.id, summary: `Firm policy updated: SoD=${org.policies.separation_of_duties}, nonmaterial exceptions=${org.policies.allow_nonmaterial_exceptions}, approvers=${org.policies.approver_roles.join("/")}` });
}
