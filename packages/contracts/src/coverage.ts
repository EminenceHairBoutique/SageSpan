import type { CheckRun, Discrepancy, Snapshot } from "./domain";

/**
 * PR-002 — coverage semantics shared by the web tier, the evidence packet and
 * (as a documented mirror) `app.latest_check_runs` / `app.record_review` in
 * Postgres migration 0007.
 *
 * S-06: a calculation outcome, a per-account coverage status and a review
 * outcome are three different things. `PASS`, `NOT_REQUIRED`, `UNSUPPORTED`,
 * `INDETERMINATE` and `ERROR` are never conflated; a household whose accounts
 * are all `UNSUPPORTED` can be approved by a professional but can never carry
 * the "supported check verified" label, and the packet's title and scope say
 * exactly which accounts were covered.
 *
 * N-02: only the LATEST attempt per (account, check type) on a snapshot counts
 * for approval. Earlier attempts stay as history. ERROR followed by PASS
 * recovers; PASS followed by ERROR blocks.
 *
 * This module performs no arithmetic and reads only stored run fields.
 */
export const REVIEW_OUTCOMES = ["SUPPORTED_CHECK_VERIFIED", "REVIEWED_WITH_LIMITATIONS", "APPROVED_WITH_EXCEPTIONS"] as const;
export type ReviewOutcome = (typeof REVIEW_OUTCOMES)[number];

export const REVIEW_OUTCOME_LABELS: Record<ReviewOutcome, string> = {
  SUPPORTED_CHECK_VERIFIED: "Supported check verified",
  REVIEWED_WITH_LIMITATIONS: "Reviewed with limitations",
  APPROVED_WITH_EXCEPTIONS: "Approved with exceptions",
};

export const REVIEW_OUTCOME_DESCRIPTIONS: Record<ReviewOutcome, string> = {
  SUPPORTED_CHECK_VERIFIED: "Every account in scope has a verified PASS or NOT_REQUIRED result from the independent engine, with no documented exceptions and no out-of-tolerance dispositions.",
  REVIEWED_WITH_LIMITATIONS: "At least one account in scope is UNSUPPORTED or INDETERMINATE for the independent check. The review covers only the supported accounts; no conclusion is expressed about the rest.",
  APPROVED_WITH_EXCEPTIONS: "Every account in scope has a verified result, but the approval relies on documented nonmaterial exceptions and/or dispositioned discrepancies recorded in the packet.",
};

export type AccountCoverage = "VERIFIED" | "NOT_REQUIRED" | "UNSUPPORTED" | "INDETERMINATE" | "ERROR" | "NOT_RUN";

export interface AccountCoverageRow {
  account_ref: string;
  check_type: CheckRun["check_type"];
  /** Latest attempt for this account/check type, or null when no run exists on the snapshot. */
  latest_run_id: string | null;
  /** Earlier attempts on the same snapshot, oldest first (history, never evaluated). */
  superseded_run_ids: string[];
  coverage: AccountCoverage;
  run_status: CheckRun["run_status"] | null;
  coverage_status: CheckRun["coverage_status"];
  receipt_verified: boolean;
}

export interface CoverageSummary {
  snapshot_id: string;
  check_types: CheckRun["check_type"][];
  accounts_in_scope: number;
  verified: number;
  not_required: number;
  unsupported: number;
  indeterminate: number;
  error: number;
  not_run: number;
  /** Attempts that are not the latest for their account/check type (kept as history). */
  superseded_attempts: number;
  documented_exceptions: number;
  dispositioned_discrepancies: number;
  /** Dispositioned discrepancies whose classification was a real difference (not NOT_COMPARABLE / MISSING_EVIDENCE / UNSUPPORTED_CHECK). */
  dispositioned_material_differences: number;
  rows: AccountCoverageRow[];
}

/** Latest attempt per (account_ref, check_type) on one snapshot. Ties on executed_at fall to the later array position (insertion order). */
export function latestCheckRuns(runs: readonly CheckRun[], snapshotId: string): { latest: CheckRun[]; superseded: CheckRun[] } {
  const onSnapshot = runs.filter((r) => r.snapshot_id === snapshotId);
  const byKey = new Map<string, CheckRun>();
  const order = new Map<CheckRun, number>();
  onSnapshot.forEach((r, i) => order.set(r, i));
  for (const r of onSnapshot) {
    const key = `${r.check_type}\u0000${r.request_payload.account.account_ref}`;
    const cur = byKey.get(key);
    if (!cur || r.executed_at > cur.executed_at || (r.executed_at === cur.executed_at && (order.get(r) ?? 0) > (order.get(cur) ?? 0))) byKey.set(key, r);
  }
  const latest = [...byKey.values()];
  const latestIds = new Set(latest.map((r) => r.id));
  return { latest, superseded: onSnapshot.filter((r) => !latestIds.has(r.id)) };
}

function accountCoverage(run: CheckRun | null): AccountCoverage {
  if (!run) return "NOT_RUN";
  if (run.run_status === "ERROR") return "ERROR";
  if (run.request_hash_verified !== true) return "ERROR";
  switch (run.run_status) {
    case "PASS":
      return "VERIFIED";
    case "NOT_REQUIRED":
      return "NOT_REQUIRED";
    case "UNSUPPORTED":
      return "UNSUPPORTED";
    case "INDETERMINATE":
      return "INDETERMINATE";
  }
}

const NON_DIFFERENCE_CLASSIFICATIONS = new Set(["NOT_COMPARABLE", "MISSING_EVIDENCE", "UNSUPPORTED_CHECK", "WITHIN_TOLERANCE"]);

/**
 * Per-account coverage on a snapshot from the latest attempts. `accountRefs`
 * is the snapshot's own account list (payload v2) so an account with no run at
 * all shows as NOT_RUN instead of silently vanishing from scope.
 */
export function coverageSummary(snapshot: Pick<Snapshot, "id" | "canonical_payload">, runs: readonly CheckRun[], discrepancies: readonly Discrepancy[], checkTypes: CheckRun["check_type"][] = ["RMD_ANNUAL"]): CoverageSummary {
  const { latest, superseded } = latestCheckRuns(runs, snapshot.id);
  const accountRefs = snapshot.canonical_payload.accounts.map((a) => a.id);
  const rows: AccountCoverageRow[] = [];
  for (const checkType of checkTypes) {
    for (const ref of accountRefs) {
      const run = latest.find((r) => r.check_type === checkType && r.request_payload.account.account_ref === ref) ?? null;
      const history = superseded.filter((r) => r.check_type === checkType && r.request_payload.account.account_ref === ref).map((r) => r.id);
      rows.push({
        account_ref: ref,
        check_type: checkType,
        latest_run_id: run?.id ?? null,
        superseded_run_ids: history,
        coverage: accountCoverage(run),
        run_status: run?.run_status ?? null,
        coverage_status: run?.coverage_status ?? null,
        receipt_verified: run?.request_hash_verified === true,
      });
    }
  }
  const count = (c: AccountCoverage) => rows.filter((r) => r.coverage === c).length;
  const latestIds = new Set(latest.map((r) => r.id));
  const dispositioned = discrepancies.filter((d) => latestIds.has(d.check_run_id) && d.disposition !== null);
  return {
    snapshot_id: snapshot.id,
    check_types: checkTypes,
    accounts_in_scope: accountRefs.length,
    verified: count("VERIFIED"),
    not_required: count("NOT_REQUIRED"),
    unsupported: count("UNSUPPORTED"),
    indeterminate: count("INDETERMINATE"),
    error: count("ERROR"),
    not_run: count("NOT_RUN"),
    superseded_attempts: superseded.length,
    documented_exceptions: snapshot.canonical_payload.exceptions.length,
    dispositioned_discrepancies: dispositioned.length,
    dispositioned_material_differences: dispositioned.filter((d) => !NON_DIFFERENCE_CLASSIFICATIONS.has(d.classification)).length,
    rows,
  };
}

export type ApprovalReadiness = { ready: true; outcome: ReviewOutcome } | { ready: false; code: "CHECK_REQUIRED" | "CHECK_FAILED_LATEST" | "CHECK_RECEIPT_UNVERIFIED" | "NO_ACCOUNTS_IN_SCOPE"; message: string };

/**
 * Whether the LATEST attempts allow approval, and which typed outcome the
 * approval would carry. Open discrepancies, attestation, role and separation of
 * duties are checked by the caller; this function covers coverage only.
 */
export function approvalReadiness(summary: CoverageSummary): ApprovalReadiness {
  if (summary.accounts_in_scope === 0) return { ready: false, code: "NO_ACCOUNTS_IN_SCOPE", message: "The frozen snapshot lists no accounts." };
  if (summary.not_run > 0) return { ready: false, code: "CHECK_REQUIRED", message: `${summary.not_run} account(s) in the frozen snapshot have no check run yet.` };
  const failedLatest = summary.rows.filter((r) => r.coverage === "ERROR");
  if (failedLatest.length) {
    const unverified = failedLatest.filter((r) => r.run_status !== "ERROR");
    if (unverified.length) return { ready: false, code: "CHECK_RECEIPT_UNVERIFIED", message: `${unverified.length} latest check run(s) lack a verified calculation receipt; approval is refused.` };
    return { ready: false, code: "CHECK_FAILED_LATEST", message: `The latest check attempt failed for ${failedLatest.length} account(s) (${failedLatest.map((r) => r.account_ref).join(", ")}). Re-run the check; earlier results do not carry over.` };
  }
  if (summary.unsupported + summary.indeterminate > 0) return { ready: true, outcome: "REVIEWED_WITH_LIMITATIONS" };
  if (summary.documented_exceptions > 0 || summary.dispositioned_material_differences > 0) return { ready: true, outcome: "APPROVED_WITH_EXCEPTIONS" };
  return { ready: true, outcome: "SUPPORTED_CHECK_VERIFIED" };
}

/** Packet title derived from actual coverage, never from the existence of a run. */
export function packetTitle(summary: CoverageSummary, outcome: ReviewOutcome | null): string {
  const base = "Review evidence packet";
  const supported = summary.verified + summary.not_required;
  if (summary.accounts_in_scope === 0) return `${base} — no accounts in scope`;
  if (outcome === null) {
    if (summary.error > 0 || summary.not_run > 0) return `${base} — checks incomplete (${supported} of ${summary.accounts_in_scope} accounts verified; not approved)`;
    return `${base} — not approved (${supported} of ${summary.accounts_in_scope} accounts with a verified result)`;
  }
  switch (outcome) {
    case "SUPPORTED_CHECK_VERIFIED":
      return `${base} — supported check verified (${supported} of ${summary.accounts_in_scope} accounts)`;
    case "APPROVED_WITH_EXCEPTIONS":
      return `${base} — approved with exceptions (${supported} of ${summary.accounts_in_scope} accounts verified; ${summary.documented_exceptions} exception(s), ${summary.dispositioned_material_differences} dispositioned difference(s))`;
    case "REVIEWED_WITH_LIMITATIONS":
      return supported === 0
        ? `${base} — reviewed with limitations (no supported checks: all ${summary.accounts_in_scope} accounts outside supported scope)`
        : `${base} — reviewed with limitations (${supported} of ${summary.accounts_in_scope} accounts verified; ${summary.unsupported + summary.indeterminate} outside supported scope)`;
  }
}
