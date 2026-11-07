import { REVIEW_OUTCOME_DESCRIPTIONS, REVIEW_OUTCOME_LABELS, approvalReadiness, coverageSummary } from "@sagespan/contracts";
import type { HouseholdBundle } from "@/domain/queries";
import { humanize, shortHash } from "@/ui/format";
import { Alert, Td, Th } from "@/ui/primitives";
import { CoverageChip } from "@/ui/status";

export type HouseholdBundleLike = Pick<HouseholdBundle, "currentSnapshot" | "checkRuns" | "discrepancies" | "reviews" | "accounts">;

/** The typed outcome chip now lives in ui/status (design system §6.4); re-exported so existing imports keep working. */
export { OutcomeChip } from "@/ui/status";

/**
 * PR-002 coverage panel (S-06 / N-02). Reads the latest attempt per account on the
 * current snapshot and states, in plain words, what an approval would mean right
 * now. Nothing here is computed from amounts; it reads stored run fields.
 * Coverage labels come from `CoverageChip` (decision D5 is accepted and renames them in UI-003b).
 */
export function CoveragePanel({ b }: { b: HouseholdBundleLike }) {
  const snap = b.currentSnapshot;
  if (!snap) return null;
  const summary = coverageSummary(snap, b.checkRuns, b.discrepancies);
  const readiness = approvalReadiness(summary);
  const approval = b.reviews.find((r) => r.snapshot_id === snap.id && r.decision === "APPROVED") ?? null;
  const labelOf = (ref: string) => b.accounts.find((a) => a.id === ref)?.label ?? ref;
  const policyVersion = shortHash(snap.canonical_payload.policy.policy_sha256);
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
            return (
              <tr key={`${r.check_type}:${r.account_ref}`}>
                <Td>
                  <span className="font-medium">{labelOf(r.account_ref)}</span>
                  <span className="ml-2 text-caption text-ink-muted">{acct ? humanize(acct.account_type) : "—"}</span>
                </Td>
                <Td className="text-caption">{r.latest_run_id ? <code>{r.latest_run_id}</code> : "—"}</Td>
                <Td>
                  <CoverageChip coverage={r.coverage} />
                  {r.coverage_status && r.coverage !== "ERROR" && <span className="ml-2 text-caption text-ink-muted">{humanize(r.coverage_status)}</span>}
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
        <Alert tone={readiness.outcome === "SUPPORTED_CHECK_VERIFIED" ? "teal" : "amber"} role="status" title={`If approved now: ${REVIEW_OUTCOME_LABELS[readiness.outcome]}`}>
          {REVIEW_OUTCOME_DESCRIPTIONS[readiness.outcome]}
        </Alert>
      ) : (
        <Alert tone="conflict" title={`Approval blocked: ${humanize(readiness.code)}`}>
          {readiness.message}
        </Alert>
      )}
      <p className="text-caption text-ink-faint">
        Only the latest attempt per account counts; {summary.superseded_attempts} earlier attempt(s) on this snapshot are kept as history. Policy at freeze: tolerance ±{snap.canonical_payload.policy.tolerance.absolute} / {snap.canonical_payload.policy.tolerance.relative} (version <span title={policyVersion.full}>{policyVersion.short}</span>).
      </p>
    </div>
  );
}
