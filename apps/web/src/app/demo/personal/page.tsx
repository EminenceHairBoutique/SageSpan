import Link from "next/link";
import { ArrowRight, RefreshCw } from "lucide-react";
import { formatMoney } from "@sagespan/contracts";
import { refreshBaselineAction } from "@/server/personal-actions";
import { ActionForm } from "@/ui/ActionForm";
import { DecisionCard } from "@/ui/personal/DecisionCard";
import { DataStateChip, FlagList, Money, Stat } from "@/ui/personal/components";
import { Alert, Card, EmptyState, Mono } from "@/ui/primitives";
import { latestDecisions } from "@/domain/personal/queries";
import { loadPersonal } from "./load";

export const dynamic = "force-dynamic";

export default async function PersonalOverview() {
  const { actor, b, insights, labels, refresh } = await loadPersonal({ ensureBaseline: true });
  const { clarity, clarityRun, policy } = insights;
  const decisions = latestDecisions(b);
  const errors = refresh?.errors ?? [];
  const firstName = actor.display_name.split(" ")[0];
  const unknowns = clarity?.data_quality.filter((d) => d.state !== "USER_REPORTED" && d.state !== "EVIDENCE_VERIFIED") ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal">Overview</p>
          <h1 className="mt-1 text-2xl font-bold">Where you stand, {firstName}</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">{b.profile.situation} Everything below is computed by SageSpan&apos;s calculation service from what you reported; tap any number to see where it came from.</p>
        </div>
        <ActionForm action={refreshBaselineAction} submitLabel={<><RefreshCw size={14} aria-hidden /> Recompute baseline</>} pendingLabel="Calling calculation service…" variant="secondary" size="sm" inline />
      </div>

      {errors.length > 0 && !clarity && (
        <Alert tone="conflict" title="The calculation service is not reachable, so there are no numbers to show.">
          {errors[0]!.message} Nothing is estimated in the browser or on this server; start the service with <code>npm run dev:calc</code> and recompute.
        </Alert>
      )}

      {clarity && clarityRun && (
        <>
          {clarity.result_status === "INSUFFICIENT_DATA" && (
            <Alert tone="amber" title="The picture is incomplete">
              Income, expenses or balances are missing, so SageSpan does not state a margin or buffer. Add the basics in Cash flow and Savings &amp; debt.
            </Alert>
          )}
          <section aria-label="Where I stand" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Liquid cash" hint={`Your floor: ${formatMoney(clarity.cash.cash_floor)} · ${formatMoney(clarity.cash.above_floor)} above it`} tone={clarity.cash.above_floor.startsWith("-") ? "conflict" : undefined}>
              <Money value={clarity.cash.liquid_total} run={clarityRun} label="Liquid cash" field="cash.liquid_total" />
            </Stat>
            <Stat label="Essentials covered" hint={clarity.cash.buffer_target_months ? `Target you chose: ${clarity.cash.buffer_target_months} months` : "No target set"} tone={clarity.cash.essential_buffer_months && Number(clarity.cash.essential_buffer_months) < 1 ? "conflict" : clarity.cash.buffer_gap_amount && clarity.cash.buffer_gap_amount !== "0.00" ? "amber" : "teal"}>
              {clarity.cash.essential_buffer_months ?? "—"} <span className="text-base font-medium text-ink-muted">months</span>
            </Stat>
            <Stat label="Typical monthly margin" hint={`Low month: ${formatMoney(clarity.margin.low)} · after ${formatMoney(clarity.commitments.monthly_essential)} essentials and ${formatMoney(clarity.commitments.monthly_discretionary_typical)} usual spending`} tone={clarity.margin.low?.startsWith("-") ? "conflict" : undefined}>
              <Money value={clarity.margin.typical} run={clarityRun} label="Typical monthly margin" field="margin.typical" />
            </Stat>
            <Stat label={`Lowest point, next ${clarity.outlook.horizon_days} days`} hint={`On ${clarity.outlook.lowest_projected_date}${clarity.outlook.first_floor_breach_date ? ` · below your floor from ${clarity.outlook.first_floor_breach_date}` : " · stays above your floor"}`} tone={clarity.outlook.first_floor_breach_date ? "conflict" : undefined}>
              <Money value={clarity.outlook.lowest_projected_cash} run={clarityRun} label="Lowest projected cash" field="outlook.lowest_projected_cash" />
            </Stat>
          </section>

          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <Card title="My next three steps" subtitle={`Ranked by ${policy?.policy_version ?? "policy"}: constraints first, then urgency, benefit, input reliability and reversibility. You decide; nothing happens automatically.`} actions={<Link href="/demo/personal/next-steps" className="inline-flex items-center gap-1 text-sm font-semibold text-navy hover:underline">All steps <ArrowRight size={14} aria-hidden /></Link>}>
              {policy && policy.primary.length > 0 ? (
                <div className="space-y-4">
                  {policy.primary.map((rec) => (
                    <DecisionCard key={rec.recommendation_id} rec={rec} labels={labels} decision={decisions.get(rec.recommendation_id)} compact />
                  ))}
                </div>
              ) : (
                <EmptyState title="No actions yet.">The baseline has to exist before anything is proposed.</EmptyState>
              )}
            </Card>
            <div className="space-y-6">
              <Card title="What needs attention" subtitle="Flags from the baseline, highest severity first.">
                <FlagList flags={[...clarity.flags].sort((a, z) => ["HIGH", "MEDIUM", "LOW", "INFO"].indexOf(a.severity) - ["HIGH", "MEDIUM", "LOW", "INFO"].indexOf(z.severity))} labels={labels} limit={6} />
              </Card>
              <Card title="What I don't know yet" subtitle="Inputs that could change the conclusion.">
                {unknowns.length === 0 ? (
                  <p className="text-sm text-ink-muted">
                    Every input is as you reported it. Income history: {clarity.income.observed_months} observed months ({clarity.income.classification.toLowerCase()}).
                  </p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {unknowns.map((d) => (
                      <li key={d.ref} className="flex items-center justify-between gap-3">
                        <span>{labels[d.ref] ?? d.ref}</span>
                        <DataStateChip state={d.state} />
                      </li>
                    ))}
                  </ul>
                )}
                {b.retirement && Object.values(b.retirement.states).some((s) => s === "MISSING") && (
                  <p className="mt-3 text-xs text-ink-muted">
                    Retirement: {Object.values(b.retirement.states).filter((s) => s === "MISSING").length} inputs missing. <Link href="/demo/personal/retirement" className="font-semibold text-navy hover:underline">See the readiness gate</Link>.
                  </p>
                )}
              </Card>
            </div>
          </div>

          <p className="text-xs text-ink-faint">
            Baseline from snapshot <Mono>{clarityRun.snapshot_id}</Mono> · as of {clarity.as_of_date} · method {Object.entries(clarityRun.method_set_versions).map(([k, v]) => `${k}@${v}`).join(", ")} · request hash {clarityRun.request_hash_verified ? "re-derived and matched" : "NOT verified"}. Descriptive arithmetic on your reported inputs; not advice.
          </p>
        </>
      )}
    </div>
  );
}
