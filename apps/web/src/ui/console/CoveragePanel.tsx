import { REVIEW_OUTCOME_DESCRIPTIONS, REVIEW_OUTCOME_LABELS, approvalReadiness, coverageSummary, type AccountCoverage, type ReviewOutcome } from "@sagespan/contracts";
import type { HouseholdBundle } from "@/domain/queries";

export type HouseholdBundleLike = Pick<HouseholdBundle, "currentSnapshot" | "checkRuns" | "discrepancies" | "reviews" | "accounts">;
import { Alert, Chip, Td, Th } from "@/ui/primitives";

/**
 * PR-002 coverage panel (S-06 / N-02). Reads the latest attempt per account on the
 * current snapshot and states, in plain words, what an approval would mean right
 * now. Nothing here is computed from amounts; it reads stored run fields.
 */
const COVERAGE_LABEL: Record<AccountCoverage, { text: string; tone: "teal" | "slate" | "amber" | "conflict" | "neutral" }> = {
  VERIFIED: { text: "Verified (PASS)", tone: "teal" },
  NOT_REQUIRED: { text: "Verified (not required)", tone: "teal" },
  UNSUPPORTED: { text: "Outside supported scope", tone: "amber" },
  INDETERMINATE: { text: "Indeterminate", tone: "amber" },
  ERROR: { text: "Latest attempt failed", tone: "conflict" },
  NOT_RUN: { text: "Not run", tone: "neutral" },
};

export function OutcomeChip({ outcome }: { outcome: ReviewOutcome | null }) {
  if (!outcome) return <Chip tone="neutral">not approved</Chip>;
  const tone = outcome === "SUPPORTED_CHECK_VERIFIED" ? "teal" : outcome === "APPROVED_WITH_EXCEPTIONS" ? "navy" : "amber";
  return (
    <Chip tone={tone} title={REVIEW_OUTCOME_DESCRIPTIONS[outcome]}>
      {REVIEW_OUTCOME_LABELS[outcome]}
    </Chip>
  );
}

export function CoveragePanel({ b }: { b: HouseholdBundleLike }) {
  const snap = b.currentSnapshot;
  if (!snap) return null;
  const summary = coverageSummary(snap, b.checkRuns, b.discrepancies);
  const readiness = approvalReadiness(summary);
  const approval = b.reviews.find((r) => r.snapshot_id === snap.id && r.decision === "APPROVED") ?? null;
  const labelOf = (ref: string) => b.accounts.find((a) => a.id === ref)?.label ?? ref;
  return (
    <div className="space-y-3" data-testid="coverage-panel">
      <table className="w-full">
        <thead className="border-b border-line">
          <tr>
            <Th>Account (frozen classification)</Th>
            <Th>Latest attempt</Th>
            <Th>Coverage</Th>
            <Th align="right">Earlier attempts</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {summary.rows.map((r) => {
            const acct = snap.canonical_payload.accounts.find((a) => a.id === r.account_ref);
            const c = COVERAGE_LABEL[r.coverage];
            return (
              <tr key={`${r.check_type}:${r.account_ref}`}>
                <Td>
                  <span className="font-medium">{labelOf(r.account_ref)}</span>
                  <span className="ml-2 text-xs text-ink-muted">{acct?.account_type.toLowerCase().replace(/_/g, " ") ?? "—"}</span>
                </Td>
                <Td className="text-xs">{r.latest_run_id ? <code>{r.latest_run_id}</code> : "—"}</Td>
                <Td>
                  <Chip tone={c.tone}>{c.text}</Chip>
                  {r.coverage_status && r.coverage !== "ERROR" && <span className="ml-2 text-xs text-ink-muted">{r.coverage_status.toLowerCase().replace(/_/g, " ")}</span>}
                </Td>
                <Td align="right">{r.superseded_run_ids.length ? `${r.superseded_run_ids.length} kept as history` : "—"}</Td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {approval?.coverage_outcome ? (
        <Alert tone={approval.coverage_outcome === "SUPPORTED_CHECK_VERIFIED" ? "teal" : "amber"} title={`Approved: ${REVIEW_OUTCOME_LABELS[approval.coverage_outcome]}`}>
          {REVIEW_OUTCOME_DESCRIPTIONS[approval.coverage_outcome]} {summary.verified + summary.not_required} of {summary.accounts_in_scope} account(s) verified; {summary.unsupported + summary.indeterminate} outside supported scope.
        </Alert>
      ) : readiness.ready ? (
        <Alert tone={readiness.outcome === "SUPPORTED_CHECK_VERIFIED" ? "teal" : "amber"} title={`If approved now: ${REVIEW_OUTCOME_LABELS[readiness.outcome]}`}>
          {REVIEW_OUTCOME_DESCRIPTIONS[readiness.outcome]}
        </Alert>
      ) : (
        <Alert tone="conflict" title={`Approval blocked: ${readiness.code.toLowerCase().replace(/_/g, " ")}`}>
          {readiness.message}
        </Alert>
      )}
      <p className="text-xs text-ink-faint">
        Only the latest attempt per account counts; {summary.superseded_attempts} earlier attempt(s) on this snapshot are kept as history. Policy at freeze: tolerance ±{snap.canonical_payload.policy.tolerance.absolute} / {snap.canonical_payload.policy.tolerance.relative} (version {snap.canonical_payload.policy.policy_sha256.slice(0, 12)}…).
      </p>
    </div>
  );
}
