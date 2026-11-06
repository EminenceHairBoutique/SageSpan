import { notFound } from "next/navigation";
import { Bot } from "lucide-react";
import { can } from "@sagespan/contracts";
import { listRunsForHousehold } from "@/ai/review-orchestrator";
import { getDemoActor } from "@/auth/actor";
import { latestFeedbackByFinding } from "@/domain/ai/feedback";
import { accountLabel, householdBundle, householdOrNull } from "@/domain/queries";
import { getStore } from "@/domain/store";
import { analyzePlanAction, firmAiFeedbackAction } from "@/server/actions";
import { ActionForm } from "@/ui/ActionForm";
import { AiReviewPanel } from "@/ui/ai/AiReviewPanel";
import { Alert, Card, EmptyState, KeyValue, ResultChip } from "@/ui/primitives";

export const dynamic = "force-dynamic";

export default async function HouseholdAiReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await getDemoActor();
  const state = getStore().read();
  if (!householdOrNull(state, actor.org_id, id)) notFound();
  const b = householdBundle(state, actor.org_id, id);
  const runs = listRunsForHousehold(state, actor, id);
  const latest = runs[0] ?? null;
  const feedback = latest ? Object.fromEntries(latestFeedbackByFinding(state, latest.id)) : {};
  const labels: Record<string, string> = {};
  for (const f of b.facts) labels[f.id] = `${f.field_key} (${f.as_of_date})`;
  for (const d of b.documents) labels[d.id] = d.filename;
  for (const a of b.accounts) labels[a.id] = a.label;
  for (const c of b.conflicts) labels[c.id] = `conflict on ${c.field_key}`;
  const canReview = can(actor.role, "review.comment");
  const latestRuns = [...b.checkRuns].reverse().filter((r, i, arr) => arr.findIndex((x) => x.request_payload.account.account_ref === r.request_payload.account.account_ref) === i);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Card title="AI plan review (draft)" subtitle="Reads only this household's authorised facts, evidence and check runs; drafts findings, questions and a reviewer memo. It cannot verify a fact, run a calculation, record a review or approve anything.">
          <div className="flex flex-wrap gap-3">
            <ActionForm action={analyzePlanAction} hidden={{ household_id: id }} submitLabel={<><Bot size={14} aria-hidden /> Analyze plan</>} pendingLabel="Drafting…" disabled={!can(actor.role, "household.read")} inline />
          </div>
          <p className="mt-3 text-xs text-ink-muted">Every cited fact, document locator and calculation run is resolved server-side before a finding is shown. Dollar amounts that cannot be traced to a receipted run are removed, and any attempt by the model to output an approved or verified status rejects the whole draft.</p>
        </Card>
        <Card title="Deterministic check result" subtitle="Shown separately from the AI draft; the only source of amounts.">
          {latestRuns.length === 0 ? (
            <EmptyState title="No check has been run." />
          ) : (
            <KeyValue rows={latestRuns.map((r) => ({ k: accountLabel(b, r.request_payload.account.account_ref), v: <span className="flex flex-wrap items-center gap-2"><ResultChip status={r.run_status} />{r.response?.annual_rmd ? <span className="tabular">RMD {r.response.annual_rmd}</span> : null}</span> }))} />
          )}
        </Card>
      </div>
      {latest ? (
        <AiReviewPanel run={latest} feedback={feedback} labels={labels} feedbackAction={firmAiFeedbackAction} audience="firm" canGiveFeedback={canReview} />
      ) : (
        <EmptyState title="No AI draft for this household yet.">Run Analyze plan to get a grounded draft. Open conflicts, missing year-end balances and unsupported checks are the usual first findings.</EmptyState>
      )}
      {!canReview && latest && <Alert tone="slate">Your role can read drafts but not leave reviewer feedback.</Alert>}
      {runs.length > 1 && (
        <details className="text-sm">
          <summary className="cursor-pointer font-medium text-navy">Earlier drafts ({runs.length - 1})</summary>
          <ul className="mt-2 space-y-1 text-xs text-ink-muted">
            {runs.slice(1).map((r) => (
              <li key={r.id}>
                {r.id} · {r.created_at.replace("T", " ").slice(0, 19)} UTC · {r.run_status} · {r.accepted_finding_count} accepted / {r.rejected_finding_count} rejected · {r.model} · snapshot {r.snapshot_id ?? "none"}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
