import { latestDecisions } from "@/domain/personal/queries";
import { DecisionCard } from "@/ui/personal/DecisionCard";
import { Alert, Card, EmptyState } from "@/ui/primitives";
import { loadPersonal } from "../load";

export const dynamic = "force-dynamic";

export default async function NextStepsPage() {
  const { b, insights, labels } = await loadPersonal({ ensureBaseline: true });
  const { policy } = insights;
  const decisions = latestDecisions(b);
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal">Next steps</p>
        <h1 className="mt-1 text-2xl font-bold">Every candidate action, and why it ranked where it did</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-muted">By default the Overview shows at most three. Here you can see the rest, the candidates that were rejected by a hard constraint, and the policy&apos;s own account of the evaluation.</p>
      </div>
      {!policy ? (
        <Alert tone="amber" title="No baseline">Recompute the baseline on the Overview to see candidate actions.</Alert>
      ) : (
        <>
          <section className="space-y-4" aria-label="Primary actions">
            {policy.primary.map((rec) => (
              <DecisionCard key={rec.recommendation_id} rec={rec} labels={labels} decision={decisions.get(rec.recommendation_id)} />
            ))}
          </section>
          {policy.more.length > 0 && (
            <Card title={`More to revisit later (${policy.more.length})`} subtitle="Lower urgency or benefit on the current inputs.">
              <div className="space-y-4">
                {policy.more.map((rec) => (
                  <DecisionCard key={rec.recommendation_id} rec={rec} labels={labels} decision={decisions.get(rec.recommendation_id)} compact />
                ))}
              </div>
            </Card>
          )}
          <Card title="Rejected by a hard constraint" subtitle="These were not merely ranked lower; the policy refused them and says why.">
            {policy.rejected.length === 0 ? (
              <EmptyState title="Nothing was rejected on the current inputs." />
            ) : (
              <ul className="space-y-2 text-sm">
                {policy.rejected.map((r) => (
                  <li key={r.code} className="rounded-lg border border-conflict/20 bg-conflict-100/40 px-3 py-2">
                    <p className="font-semibold text-conflict-700">{r.title}</p>
                    <p className="text-ink">{r.reason}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="How this was evaluated" subtitle={`Policy ${policy.policy_version}. Deterministic; the same inputs always give the same ranking.`}>
            <ul className="list-disc space-y-1 pl-5 text-sm text-ink-muted">
              {policy.rationale.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
              <li>Weights: urgency up to 40, benefit up to 30, input reliability up to 20 (stale, missing or assumed inputs lower it), reversibility up to 10. No model confidence, no SageSpan revenue, no affiliate input.</li>
              <li>Tiers 3 (regulated advice) and 4 (money movement) are disabled in this build regardless of inputs.</li>
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}
