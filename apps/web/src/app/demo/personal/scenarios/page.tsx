import { DEBT_STRATEGY_LABELS, formatMoney } from "@sagespan/contracts";
import { updatePolicyAction } from "@/server/personal-actions";
import { ActionForm } from "@/ui/ActionForm";
import { DisclosureList, FlagList, Money } from "@/ui/personal/components";
import { Alert, Card, Chip, Field, inputClasses, KeyValue, Mono, Td, Th } from "@/ui/primitives";
import { loadPersonal } from "../load";

export const dynamic = "force-dynamic";

export default async function ScenariosPage() {
  const { b, insights, labels } = await loadPersonal({ ensureBaseline: true });
  const { debt, debtRun, clarity } = insights;
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal">Scenarios</p>
        <h1 className="mt-1 text-2xl font-bold">Debt payoff paths on identical inputs</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-muted">The same balances, rates and minimums under four orderings and one extra monthly amount you choose. Every figure is computed by the calculation service and carries a receipt; the comparison does not pick a strategy for you.</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
        <Card title="Scenario input" subtitle="Extra amount above all minimums, each month.">
          {b.membership.role === "OWNER" ? (
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
      <Card title="Other scenarios" subtitle="Proposed; each needs its own engine before a number is shown.">
        <ul className="list-disc space-y-1 pl-5 text-sm text-ink-muted">
          <li>Spending change / savings change / one-year income interruption on the cash-flow baseline (PERS-002).</li>
          <li>Retire at 63 vs 67, lower-return assumption (PLAN-001 retirement engine, see Retirement).</li>
          <li>The AI assistant can <em>propose</em> a scenario for you to confirm; it cannot run one, and it never computes the result.</li>
        </ul>
      </Card>
    </div>
  );
}
