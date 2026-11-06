import { DEBT_STRATEGY_LABELS, PERSONAL_SCENARIO_KIND_LABELS, formatMoney } from "@sagespan/contracts";
import { updatePolicyAction } from "@/server/personal-actions";
import { ActionForm } from "@/ui/ActionForm";
import { DisclosureList, FlagList, Money } from "@/ui/personal/components";
import { WhatIfForm } from "@/ui/personal/WhatIfForm";
import { Alert, Card, Chip, Field, inputClasses, KeyValue, Mono, Td, Th } from "@/ui/primitives";
import { loadPersonal } from "../load";

export const dynamic = "force-dynamic";

export default async function ScenariosPage() {
  const { b, insights, labels } = await loadPersonal({ ensureBaseline: true });
  const { debt, debtRun, clarity, scenarios } = insights;
  const isOwner = b.membership.role === "OWNER";
  const latest = scenarios[0] ?? null;
  const sr = latest?.response ?? null;
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal">Scenarios</p>
        <h1 className="mt-1 text-2xl font-bold">Debt payoff paths on identical inputs</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-muted">The same balances, rates and minimums under four orderings and one extra monthly amount you choose. Every figure is computed by the calculation service and carries a receipt; the comparison does not pick a strategy for you.</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
        <Card title="Scenario input" subtitle="Extra amount above all minimums, each month.">
          {isOwner ? (
            <ActionForm action={updatePolicyAction} submitLabel="Recompute paths" pendingLabel="Calling calculation service…" size="sm">
              <Field label="Extra monthly payment (USD)" hint={clarity ? `Your low-month margin is ${formatMoney(clarity.margin.low)}; an extra payment above it would need savings.` : undefined}>
                <input name="extra_debt_payment_monthly" inputMode="decimal" defaultValue={b.profile.extra_debt_payment_monthly} className={inputClasses} aria-label="Extra monthly payment" />
              </Field>
            </ActionForm>
          ) : (
            <p className="text-sm text-ink-muted">Only the owner can change scenario inputs.</p>
          )}
          {debt && (
            <KeyValue
              className="mt-4"
              rows={[
                { k: "Liquid cash", v: formatMoney(debt.liquidity_guard.liquid_cash) },
                { k: "Cash floor", v: formatMoney(debt.liquidity_guard.cash_floor) },
                { k: "Floor respected", v: debt.liquidity_guard.floor_respected ? "yes" : "NO" },
                { k: "Minimums / month", v: formatMoney(debt.liquidity_guard.total_minimums) },
                { k: "Extra / month", v: <Money value={debt.liquidity_guard.extra_per_month} run={debtRun} label="Extra per month" field="liquidity_guard.extra_per_month" /> },
              ]}
            />
          )}
        </Card>
        <Card title="Comparison" subtitle={debt ? `As of ${debt.as_of_date} · method ${Object.entries(debtRun!.method_set_versions).map(([k, v]) => `${k}@${v}`).join(", ")}` : undefined}>
          {!debt ? (
            <Alert tone="conflict" title="No comparison available">{b.liabilities.length === 0 ? "There are no liabilities to compare." : "The calculation service could not be reached; nothing is estimated here."}</Alert>
          ) : (
            <>
              {debt.result_status === "INFEASIBLE" && <Alert tone="conflict" title="No path is feasible on these inputs">{debt.flags.map((f) => f.message).join(" ")}</Alert>}
              <table className="w-full">
                <thead className="border-b border-line">
                  <tr>
                    <Th>Path</Th>
                    <Th align="right">Months</Th>
                    <Th align="right">Total interest</Th>
                    <Th align="right">Interest avoided vs minimums</Th>
                    <Th>First paid off</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {debt.results.map((r) => (
                    <tr key={r.strategy}>
                      <Td>
                        <span className="font-medium">{DEBT_STRATEGY_LABELS[r.strategy]}</span>
                        {!r.feasible && <Chip tone="conflict" className="ml-2">{r.infeasible_reason?.toLowerCase().replace(/_/g, " ")}</Chip>}
                      </Td>
                      <Td align="right">{r.months_to_payoff ?? "—"}</Td>
                      <Td align="right">
                        <Money value={r.total_interest} run={debtRun} label={`${DEBT_STRATEGY_LABELS[r.strategy]}: total interest`} field={`results[${r.strategy}].total_interest`} />
                      </Td>
                      <Td align="right">{r.interest_saved_vs_minimums != null ? <Money value={r.interest_saved_vs_minimums} run={debtRun} label={`${DEBT_STRATEGY_LABELS[r.strategy]}: interest avoided`} field={`results[${r.strategy}].interest_saved_vs_minimums`} /> : "—"}</Td>
                      <Td>{r.payoff_order[0] ? `${labels[r.payoff_order[0].liability_ref] ?? r.payoff_order[0].liability_ref} (${r.payoff_order[0].payoff_date})` : "—"}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-4 space-y-3">
                <DisclosureList title="Assumptions" items={debt.assumptions} />
                <FlagList flags={debt.flags} labels={labels} />
                <DisclosureList tone="amber" title="Limitations (from the receipt)" items={(debtRun?.response as { receipt?: { limitations: string[] } } | null)?.receipt?.limitations ?? []} />
                <p className="text-xs text-ink-faint">
                  Run <Mono>{debtRun?.id}</Mono> · request hash {debtRun?.request_hash_verified ? "re-derived and matched" : "NOT verified"}.
                </p>
              </div>
            </>
          )}
        </Card>
      </div>
      <div>
        <h2 className="text-xl font-bold">What if…</h2>
        <p className="mt-1 max-w-2xl text-sm text-ink-muted">One change at a time on your cash-flow baseline: spend differently, set more aside, or lose an income stream for a while. The calculation service computes the baseline and the scenario from the same snapshot and reports both; nothing here changes your records or picks for you.</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
        <Card title="Scenario" subtitle="Each run is stored with its receipt against the current snapshot.">
          <WhatIfForm
            streams={b.incomeStreams.map((s) => ({ id: s.id, label: s.label ?? s.id }))}
            goals={b.goals.map((g) => ({ id: g.id, label: g.label }))}
            asOf={clarity?.as_of_date ?? b.currentSnapshot?.as_of_date ?? ""}
            disabled={!isOwner || !clarity}
          />
          {!clarity && <p className="mt-3 text-sm text-ink-muted">A computed baseline is needed before a what-if can run.</p>}
        </Card>
        <Card title={sr ? `Result: ${PERSONAL_SCENARIO_KIND_LABELS[sr.scenario.kind].toLowerCase()}` : "Result"} subtitle={latest ? `As of ${sr?.as_of_date ?? ""} · method ${Object.entries(latest.run.method_set_versions).map(([k, v]) => `${k}@${v}`).join(", ")}` : undefined} id="what-if-result">
          {!latest ? (
            <p className="text-sm text-ink-muted">No what-if has been run on the current snapshot yet. Results for older snapshots are kept as history but not shown, because the inputs changed.</p>
          ) : latest.run.run_status === "ERROR" || !sr ? (
            <Alert tone="conflict" title={`Not computed (${latest.run.error?.code ?? "ERROR"})`}>{latest.run.error?.message ?? "The calculation service could not be reached; nothing is estimated here."}</Alert>
          ) : (
            <>
              {sr.result_status === "INFEASIBLE" && <Alert tone="conflict" title="This change cannot be applied to your inputs">{sr.infeasible_reason}</Alert>}
              {sr.result_status === "INSUFFICIENT_DATA" && <Alert tone="amber" title="Baseline is incomplete">The baseline is missing income, expenses or balances, so the comparison below is not interpretable.</Alert>}
              <table className="w-full">
                <thead className="border-b border-line">
                  <tr>
                    <Th>Figure</Th>
                    <Th align="right">Baseline</Th>
                    <Th align="right">Scenario</Th>
                    <Th align="right">Change</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {(
                    [
                      ["Typical income / month", "income_typical_monthly", null],
                      ["Essential commitments / month", "monthly_essential", null],
                      ["Discretionary spending / month", "monthly_discretionary_typical", "monthly_discretionary_typical"],
                      ["Margin, typical month", "margin_typical", "margin_typical"],
                      ["Margin, low month", "margin_low", "margin_low"],
                      ["Lowest projected cash (90 days)", "lowest_projected_cash", "lowest_projected_cash"],
                      ["Projected cash at day 90", "end_projected_cash", "end_projected_cash"],
                    ] as const
                  ).map(([name, key, deltaKey]) => (
                    <tr key={key}>
                      <Td>{name}</Td>
                      <Td align="right">
                        <Money value={sr.baseline_metrics[key] as string | null} run={latest.run} label={`${name} (baseline)`} field={`baseline_metrics.${key}`} />
                      </Td>
                      <Td align="right">
                        <Money value={sr.scenario_metrics[key] as string | null} run={latest.run} label={`${name} (scenario)`} field={`scenario_metrics.${key}`} />
                      </Td>
                      <Td align="right">{deltaKey ? <Money value={sr.delta[deltaKey]} run={latest.run} label={`${name} (change)`} field={`delta.${deltaKey}`} /> : "—"}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {sr.interruption && (
                <KeyValue
                  className="mt-4"
                  rows={[
                    { k: "Interruption", v: `${labels[sr.interruption.stream_ref] ?? sr.interruption.stream_ref}, ${sr.interruption.start_date} to ${sr.interruption.end_date} (${sr.interruption.months} month${sr.interruption.months === 1 ? "" : "s"})` },
                    { k: "Income forgone (typical)", v: <Money value={sr.interruption.income_forgone_typical} run={latest.run} label="Income forgone" field="interruption.income_forgone_typical" /> },
                    { k: "Monthly shortfall at typical spending", v: <Money value={sr.interruption.margin_typical_during} run={latest.run} label="Shortfall, typical spending" field="interruption.margin_typical_during" /> },
                    { k: "Monthly shortfall, essentials only", v: <Money value={sr.interruption.margin_essential_only_during} run={latest.run} label="Shortfall, essentials only" field="interruption.margin_essential_only_during" /> },
                    { k: "Cash above your floor", v: <Money value={sr.interruption.cash_above_floor} run={latest.run} label="Cash above floor" field="interruption.cash_above_floor" /> },
                    { k: "Runway at typical spending", v: sr.interruption.runway_months_typical_spending != null ? `${sr.interruption.runway_months_typical_spending} months` : "no shortfall" },
                    { k: "Runway, essentials only", v: sr.interruption.runway_months_essentials_only != null ? `${sr.interruption.runway_months_essentials_only} months` : "no shortfall" },
                    { k: "Covers the interruption?", v: sr.interruption.cash_above_floor_covers_interruption ? "yes" : <Chip tone="conflict">no</Chip> },
                    ...(sr.interruption.horizon_covers_interruption ? [] : [{ k: "Note", v: "The interruption runs past the 90-day outlook; dated figures show only part of it." }]),
                  ]}
                />
              )}
              {sr.goal_changes.length > 0 && (
                <KeyValue className="mt-4" rows={sr.goal_changes.map((g) => ({ k: g.label, v: `${g.baseline_months_to_target ?? "—"} → ${g.scenario_months_to_target ?? "—"} months to target${g.scenario_on_track != null ? (g.scenario_on_track ? " (on track)" : " (behind)") : ""}` }))} />
              )}
              <div className="mt-4 space-y-3">
                <DisclosureList title="Assumptions" items={sr.assumptions} />
                {sr.new_flags.length > 0 && (
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">New in the scenario</p>
                    <FlagList flags={sr.new_flags} labels={labels} />
                  </div>
                )}
                {sr.resolved_flag_codes.length > 0 && <p className="text-sm text-ink-muted">Cleared by the scenario: {sr.resolved_flag_codes.map((c) => c.toLowerCase().replace(/_/g, " ")).join(", ")}.</p>}
                <DisclosureList tone="amber" title="Limitations (from the receipt)" items={sr.receipt.limitations} />
                <p className="text-xs text-ink-faint">
                  Run <Mono>{latest.run.id}</Mono> · request hash {latest.run.request_hash_verified ? "re-derived and matched" : "NOT verified"} · {scenarios.length} what-if{scenarios.length === 1 ? "" : "s"} on this snapshot.
                </p>
              </div>
            </>
          )}
        </Card>
      </div>
      <Card title="Not yet available" subtitle="Each needs its own engine before a number is shown.">
        <ul className="list-disc space-y-1 pl-5 text-sm text-ink-muted">
          <li>Retire at 63 vs 67, lower-return assumption (PLAN-001 retirement engine, see Retirement).</li>
          <li>Recurring-charge detection from transactions (PERS-002b) — the what-ifs above use the records you entered.</li>
          <li>The AI assistant can <em>propose</em> one of these scenarios for you to confirm; it cannot run one, and it never computes the result.</li>
        </ul>
      </Card>
    </div>
  );
}
