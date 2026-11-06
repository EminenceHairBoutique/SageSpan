import { assertTransition, type Discrepancy, type Household, type WorkflowStatus } from "@sagespan/contracts";
import { nowIso } from "./ids";

/**
 * TypeScript equivalent of the SQL workflow sentinel (`app.workflow_fn`):
 * workflow-owned fields (household workflow_status / current_revision,
 * discrepancy dispositions) are only ever written through these helpers, which
 * are called from the domain functions in this folder and nowhere else. The
 * database enforces the same rule with triggers; here it is a code convention
 * backed by tests in __tests__/trust-boundaries.test.ts.
 */
export function transitionHousehold(hh: Household, to: WorkflowStatus): void {
  assertTransition(hh.workflow_status, to);
  hh.workflow_status = to;
  hh.updated_at = nowIso();
}

export function setCurrentRevision(hh: Household, revision: number): void {
  hh.current_revision = revision;
  hh.updated_at = nowIso();
}

/** Dispositions are write-once: OPEN -> DISPOSITIONED exactly once. */
export function recordDisposition(d: Discrepancy, disposition: NonNullable<Discrepancy["disposition"]>): void {
  if (d.status !== "OPEN" || d.disposition) throw new Error("IMMUTABLE: a recorded disposition is write-once");
  d.status = "DISPOSITIONED";
  d.disposition = disposition;
}
