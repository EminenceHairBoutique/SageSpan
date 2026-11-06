import type { WorkflowStatus } from "./enums";

/**
 * Assurance workflow state machine.
 *
 * IMPORT_DRAFT -> MAPPED -> RECONCILIATION_PENDING -> BLOCKED | READY_TO_FREEZE
 *   -> FROZEN -> CHECK_COMPLETE -> REVIEW_PENDING -> REVIEWED -> APPROVED -> EXPORTED
 *
 * Resolving a blocker returns the case to RECONCILIATION_PENDING (a new input
 * revision), never to a mutated frozen state. Re-exports stay in EXPORTED and
 * log a separate audit event. A new import after freeze starts a new revision.
 */
export const WORKFLOW_TRANSITIONS: Record<WorkflowStatus, readonly WorkflowStatus[]> = {
  IMPORT_DRAFT: ["MAPPED"],
  MAPPED: ["RECONCILIATION_PENDING", "IMPORT_DRAFT"],
  RECONCILIATION_PENDING: ["BLOCKED", "READY_TO_FREEZE", "IMPORT_DRAFT"],
  BLOCKED: ["RECONCILIATION_PENDING", "READY_TO_FREEZE", "IMPORT_DRAFT"],
  READY_TO_FREEZE: ["FROZEN", "BLOCKED", "RECONCILIATION_PENDING", "IMPORT_DRAFT"],
  FROZEN: ["CHECK_COMPLETE", "RECONCILIATION_PENDING", "IMPORT_DRAFT"],
  CHECK_COMPLETE: ["REVIEW_PENDING", "RECONCILIATION_PENDING", "IMPORT_DRAFT"],
  REVIEW_PENDING: ["REVIEWED", "RECONCILIATION_PENDING", "IMPORT_DRAFT"],
  REVIEWED: ["APPROVED", "REVIEW_PENDING", "RECONCILIATION_PENDING", "IMPORT_DRAFT"],
  APPROVED: ["EXPORTED", "RECONCILIATION_PENDING", "IMPORT_DRAFT"],
  EXPORTED: ["EXPORTED", "RECONCILIATION_PENDING", "IMPORT_DRAFT"],
};
// A transition to IMPORT_DRAFT from a later state means "a new import opened a new input revision";
// earlier frozen snapshots, check runs and packets remain immutable history.

export function canTransition(from: WorkflowStatus, to: WorkflowStatus): boolean {
  return WORKFLOW_TRANSITIONS[from].includes(to);
}

export class WorkflowTransitionError extends Error {
  constructor(
    public readonly from: WorkflowStatus,
    public readonly to: WorkflowStatus,
  ) {
    super(`Invalid workflow transition ${from} -> ${to}`);
    this.name = "WorkflowTransitionError";
  }
}

export function assertTransition(from: WorkflowStatus, to: WorkflowStatus): void {
  if (!canTransition(from, to)) throw new WorkflowTransitionError(from, to);
}

/** The six checkpoints shown on the approval/export screen, in order. */
export const CHECKPOINTS = [
  { key: "imported", label: "Imported", reachedAt: ["MAPPED", "RECONCILIATION_PENDING", "BLOCKED", "READY_TO_FREEZE", "FROZEN", "CHECK_COMPLETE", "REVIEW_PENDING", "REVIEWED", "APPROVED", "EXPORTED"] },
  { key: "reconciled", label: "Reconciled", reachedAt: ["READY_TO_FREEZE", "FROZEN", "CHECK_COMPLETE", "REVIEW_PENDING", "REVIEWED", "APPROVED", "EXPORTED"] },
  { key: "frozen", label: "Frozen", reachedAt: ["FROZEN", "CHECK_COMPLETE", "REVIEW_PENDING", "REVIEWED", "APPROVED", "EXPORTED"] },
  { key: "checked", label: "Checked", reachedAt: ["CHECK_COMPLETE", "REVIEW_PENDING", "REVIEWED", "APPROVED", "EXPORTED"] },
  { key: "reviewed", label: "Reviewed", reachedAt: ["REVIEWED", "APPROVED", "EXPORTED"] },
  { key: "approved", label: "Approved / exported", reachedAt: ["APPROVED", "EXPORTED"] },
] as const satisfies readonly { key: string; label: string; reachedAt: readonly WorkflowStatus[] }[];

export function checkpointReached(status: WorkflowStatus, key: (typeof CHECKPOINTS)[number]["key"]): boolean {
  const cp = CHECKPOINTS.find((c) => c.key === key);
  return cp ? (cp.reachedAt as readonly WorkflowStatus[]).includes(status) : false;
}

export const QUEUE_FILTERS = {
  blocked: ["BLOCKED"],
  pending: ["IMPORT_DRAFT", "MAPPED", "RECONCILIATION_PENDING", "READY_TO_FREEZE", "FROZEN", "CHECK_COMPLETE", "REVIEW_PENDING"],
  reviewed: ["REVIEWED", "APPROVED", "EXPORTED"],
} as const satisfies Record<string, readonly WorkflowStatus[]>;
export type QueueFilter = keyof typeof QUEUE_FILTERS;
