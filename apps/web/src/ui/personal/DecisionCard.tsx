"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { DECISION_TIER_LABELS, PRIORITY_LABELS, formatMoney, type Recommendation, type UserDecisionEvent } from "@sagespan/contracts";
import { decideAction } from "@/server/personal-actions";
import { ActionForm } from "@/ui/ActionForm";
import { Chip, cx } from "@/ui/primitives";

/**
 * One prioritised action. Everything on the card comes from the policy output;
 * the dollar figure is shown only when the policy copied it from a receipted run.
 * The feedback buttons record append-only events (Done / Snooze / Not relevant /
 * I disagree); "Ask why" expands the ranking rationale and alternatives.
 */
type DecideAction = typeof decideAction;

/** `decide` defaults to the demo action; /app/personal passes the production one (same event shape). */
export function DecisionCard({ rec, labels, decision, compact, decide = decideAction }: { rec: Recommendation; labels: Record<string, string>; decision: UserDecisionEvent | undefined; compact?: boolean; decide?: DecideAction }) {
  const [why, setWhy] = useState(false);
  const tone = rec.priority === "DO_THIS_NOW" ? "conflict" : rec.priority === "CONSIDER_NEXT" ? "amber" : "slate";
  const settled = decision && ["DONE", "NOT_RELEVANT", "DISMISS"].includes(decision.decision);
  return (
    <article className={cx("rounded-card border bg-surface shadow-card", settled ? "opacity-70" : "", rec.priority === "DO_THIS_NOW" ? "border-conflict/30" : "border-line")} aria-label={rec.title}>
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3">
        <Chip tone={tone}>{PRIORITY_LABELS[rec.priority]}</Chip>
        <Chip tone="neutral" title={DECISION_TIER_LABELS[rec.tier]}>
          Tier {rec.tier} · {DECISION_TIER_LABELS[rec.tier]}
        </Chip>
        {rec.classification === "DATA_REQUEST" && <Chip tone="navy">Information needed</Chip>}
        {decision && (
          <Chip tone={decision.decision === "DONE" ? "teal" : "slate"} className="ml-auto">
            You: {decision.decision.toLowerCase().replace(/_/g, " ")}
          </Chip>
        )}
      </div>
      <div className="space-y-3 px-5 py-4">
        <h3 className="text-base font-semibold text-ink">{rec.title}</h3>
        <p className="text-sm text-ink">
          <span className="font-semibold text-ink-muted">What SageSpan sees: </span>
          {rec.observed}
        </p>
        <p className="text-sm text-ink">
          <span className="font-semibold text-ink-muted">Why it matters: </span>
          {rec.why_it_matters}
        </p>
        <p className="rounded-lg bg-teal-100/50 px-3 py-2 text-sm text-teal-700">
          <span className="font-semibold">Suggested action: </span>
          {rec.action}
        </p>
        <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Impact</dt>
            <dd>
              {rec.impact.source === "DETERMINISTIC_TOOL" && rec.impact.amount ? (
                <>
                  <span className="font-semibold tabular">{formatMoney(rec.impact.amount)}</span> <span className="text-ink-muted">— {rec.impact.description}</span>
                </>
              ) : (
                <span className="text-ink-muted">{rec.impact.description}</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Decision</dt>
            <dd className="text-ink-muted">{rec.action_authority === "READ_ONLY" ? "Nothing to decide; read only." : "Yours. Reversible." + (rec.reversible ? "" : " (not easily reversed)")}</dd>
          </div>
        </dl>
        {!compact && (
          <>
            {rec.tradeoffs.length > 0 && <Line label="Trade-offs" items={rec.tradeoffs} />}
            {rec.uncertainty.length > 0 && <Line label="What limits this" items={rec.uncertainty} />}
            {rec.prerequisites.length > 0 && <Line label="Before acting" items={rec.prerequisites} />}
          </>
        )}
        <button type="button" onClick={() => setWhy((v) => !v)} className="inline-flex items-center gap-1 text-sm font-semibold text-navy" aria-expanded={why}>
          {why ? <ChevronUp size={14} aria-hidden /> : <ChevronDown size={14} aria-hidden />} Ask why
        </button>
        {why && (
          <div className="space-y-2 rounded-lg border border-line bg-canvas p-3 text-xs text-ink-muted">
            <p>
              <span className="font-semibold text-ink">Ranking:</span> {rec.ranking_rationale}
            </p>
            {rec.alternatives.length > 0 && <Line label="Alternatives considered" items={rec.alternatives} />}
            {rec.what_would_change_this.length > 0 && <Line label="What would change this" items={rec.what_would_change_this} />}
            <p>
              <span className="font-semibold text-ink">Evidence:</span> {rec.evidence_refs.length ? rec.evidence_refs.map((r) => labels[r] ?? r).join(", ") : "baseline totals"} · <span className="font-semibold text-ink">Calculations:</span> {rec.calculation_refs.join(", ") || "none"} · policy {rec.policy_version}
            </p>
            {rec.recheck_trigger && (
              <p>
                <span className="font-semibold text-ink">Re-check:</span> {rec.recheck_trigger}
              </p>
            )}
          </div>
        )}
        {rec.action_authority !== "READ_ONLY" && (
          <div className="flex flex-wrap gap-2 border-t border-line pt-3">
            {(["DONE", "SNOOZE", "NOT_RELEVANT", "DISAGREE"] as const).map((d) => (
              <ActionForm key={d} action={decide} hidden={{ recommendation_id: rec.recommendation_id, decision: d, note: "" }} submitLabel={d === "DONE" ? "Done" : d === "SNOOZE" ? "Snooze" : d === "NOT_RELEVANT" ? "Not relevant" : "I disagree"} variant={d === "DONE" ? "primary" : "secondary"} size="sm" inline className="!gap-1" />
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

function Line({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="text-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{label}</p>
      <ul className="mt-0.5 list-disc space-y-0.5 pl-5 text-ink-muted">
        {items.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>
    </div>
  );
}
