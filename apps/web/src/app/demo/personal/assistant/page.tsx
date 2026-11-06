import { Sparkles } from "lucide-react";
import { listRunsForWorkspace } from "@/ai/review-orchestrator";
import { latestFeedbackByFinding } from "@/domain/ai/feedback";
import { getStore } from "@/domain/store";
import { personalAiFeedbackAction, understandFinancesAction } from "@/server/personal-actions";
import { ActionForm } from "@/ui/ActionForm";
import { AiReviewPanel } from "@/ui/ai/AiReviewPanel";
import { Alert, Card, EmptyState } from "@/ui/primitives";
import { loadPersonal } from "../load";

export const dynamic = "force-dynamic";

export default async function AssistantPage() {
  const { actor, labels, insights } = await loadPersonal({ ensureBaseline: true });
  const state = getStore().read();
  const runs = listRunsForWorkspace(state, actor);
  const latest = runs[0] ?? null;
  const feedback = latest ? Object.fromEntries(latestFeedbackByFinding(state, latest.id)) : {};
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal">AI assistant</p>
        <h1 className="mt-1 text-2xl font-bold">Understand my finances</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-muted">The assistant explains your receipted baseline in plain language and asks the questions that would sharpen it. It reads only this workspace, cites every number to the calculation that produced it, and cannot change a fact, move money or decide for you.</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-4">
          <ActionForm action={understandFinancesAction} submitLabel={<><Sparkles size={14} aria-hidden /> Understand my finances</>} pendingLabel="Drafting…" disabled={!insights.clarity} disabledReason={!insights.clarity ? "A baseline is needed first (see Overview)." : undefined} inline />
          {latest ? <AiReviewPanel run={latest} feedback={feedback} labels={labels} feedbackAction={personalAiFeedbackAction} audience="personal" canGiveFeedback /> : <EmptyState title="No draft yet.">Run the assistant to get a grounded explanation of your current baseline.</EmptyState>}
          {runs.length > 1 && (
            <details className="text-sm">
              <summary className="cursor-pointer font-medium text-navy">Earlier drafts ({runs.length - 1})</summary>
              <ul className="mt-2 space-y-1 text-xs text-ink-muted">
                {runs.slice(1).map((r) => (
                  <li key={r.id}>
                    {r.created_at.replace("T", " ").slice(0, 19)} UTC · {r.run_status} · {r.accepted_finding_count} finding(s) · snapshot {r.snapshot_id ?? "—"}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
        <div className="space-y-4">
          <Card title="What it can do">
            <ul className="list-disc space-y-1 pl-5 text-sm text-ink-muted">
              <li>Explain your margin, buffer, outlook and debt comparison using the receipted numbers.</li>
              <li>Point out stale or missing inputs and ask for them.</li>
              <li>Propose a scenario for you to confirm (it never runs one).</li>
              <li>Link you to the right explainer in Learn.</li>
            </ul>
          </Card>
          <Card title="What it cannot do">
            <ul className="list-disc space-y-1 pl-5 text-sm text-ink-muted">
              <li>Invent a number: any amount must come from a cited calculation or the validator removes the finding.</li>
              <li>Read anything outside this workspace, including firm or household data you have not shared.</li>
              <li>Change a fact, record a decision, pay a bill, trade or recommend specific investments.</li>
              <li>Follow instructions hidden in labels or documents: they are data to it, not commands.</li>
            </ul>
          </Card>
          <Alert tone="slate" title="Provider">
            This build runs a deterministic, offline provider. A live model requires a reviewed vendor agreement, consent and data-processing terms (release gate G3) before any of your data is sent anywhere.
          </Alert>
        </div>
      </div>
    </div>
  );
}
