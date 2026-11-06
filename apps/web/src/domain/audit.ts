import { createHash } from "node:crypto";
import { canonicalJson, type AuditEvent, type AuditEventType, type DataState, type Role } from "@sagespan/contracts";
import { newId, nowIso } from "./ids";

/**
 * Append-only, hash-chained audit events (one chain per organisation).
 *
 * event_hash = sha256(canonical({id, org_id, actor_user_id, actor_role, actor_type,
 *   event_type, entity_type, entity_id, created_at, previous_event_hash, payload_digest}))
 *
 * The payload itself is never stored in the event: only its digest. Summaries
 * reference identifiers and statuses, never raw financial values or PII.
 */
export function sha256(data: string | Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

export interface AuditInput {
  org_id: string;
  actor_user_id: string | null;
  actor_role: Role | null;
  actor_type: AuditEvent["actor_type"];
  event_type: AuditEventType;
  entity_type: string;
  entity_id: string;
  summary: string;
  payload?: unknown;
  request_id?: string;
}

export function appendAudit(state: DataState, input: AuditInput): AuditEvent {
  const previous = [...state.audit_events].reverse().find((e) => e.org_id === input.org_id) ?? null;
  const created_at = nowIso();
  const id = newId("evt");
  const payload_digest = sha256(canonicalJson(input.payload ?? {}));
  const core = {
    id,
    org_id: input.org_id,
    actor_user_id: input.actor_user_id,
    actor_role: input.actor_role,
    actor_type: input.actor_type,
    event_type: input.event_type,
    entity_type: input.entity_type,
    entity_id: input.entity_id,
    created_at,
    previous_event_hash: previous?.event_hash ?? null,
    payload_digest,
  };
  const event: AuditEvent = {
    ...core,
    event_hash: sha256(canonicalJson(core)),
    request_id: input.request_id ?? newId("req"),
    summary: input.summary,
  };
  state.audit_events.push(event);
  return event;
}

/** Verify the per-organisation hash chain. Returns the first broken event id, or null when intact. */
export function verifyAuditChain(state: DataState, orgId: string): { intact: boolean; brokenAt: string | null; count: number } {
  let prev: string | null = null;
  let count = 0;
  for (const e of state.audit_events.filter((x) => x.org_id === orgId)) {
    count++;
    const core = {
      id: e.id,
      org_id: e.org_id,
      actor_user_id: e.actor_user_id,
      actor_role: e.actor_role,
      actor_type: e.actor_type,
      event_type: e.event_type,
      entity_type: e.entity_type,
      entity_id: e.entity_id,
      created_at: e.created_at,
      previous_event_hash: e.previous_event_hash,
      payload_digest: e.payload_digest,
    };
    if (e.previous_event_hash !== prev || sha256(canonicalJson(core)) !== e.event_hash) {
      return { intact: false, brokenAt: e.id, count };
    }
    prev = e.event_hash;
  }
  return { intact: true, brokenAt: null, count };
}

/** Emit the history implied by the seed (imports already reconciled) so the trail is never empty. */
export function seedAuditTrail(state: DataState): void {
  for (const org of state.organizations) {
    appendAudit(state, { org_id: org.id, actor_user_id: null, actor_role: null, actor_type: "SYSTEM", event_type: "DEMO_RESET", entity_type: "organization", entity_id: org.id, summary: "Synthetic demo state seeded from fixtures/synthetic/seed.json" });
  }
  for (const imp of state.plan_imports) {
    const base = { org_id: imp.org_id, actor_user_id: imp.imported_by, actor_role: null, actor_type: "SIMULATED_REVIEWER" as const, entity_type: "plan_import", entity_id: imp.id };
    appendAudit(state, { ...base, event_type: "IMPORT_CREATED", summary: `Import ${imp.id} created for household ${imp.household_id} (${imp.format}, ${imp.format_version})` });
    appendAudit(state, { ...base, event_type: "IMPORT_MAPPED", summary: `Import ${imp.id} mapped (${imp.row_count} rows)` });
    if (imp.import_status === "RECONCILED") {
      appendAudit(state, { ...base, event_type: "IMPORT_RECONCILED", summary: `Import ${imp.id} reconciled; ${state.fact_conflicts.filter((c) => c.household_id === imp.household_id).length} conflict(s) recorded for household ${imp.household_id}` });
    }
  }
}
