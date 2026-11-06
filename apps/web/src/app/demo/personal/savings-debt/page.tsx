import { formatMoney } from "@sagespan/contracts";
import { updateBalanceAction, updatePolicyAction } from "@/server/personal-actions";
import { ActionForm } from "@/ui/ActionForm";
import { DataStateChip, Money, Stat } from "@/ui/personal/components";
import { Alert, Card, Chip, Field, inputClasses, Td, Th } from "@/ui/primitives";
import { loadPersonal } from "../load";

export const dynamic = "force-dynamic";

export default async function SavingsDebtPage() {
  const { b, insights } = await loadPersonal({ ensureBaseline: true });
  const { clarity, clarityRun } = insights;
  const isOwner = b.membership.role === "OWNER";
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal">Savings &amp; debt</p>
        <h1 className="mt-1 text-2xl font-bold">Cash, reserves and what you owe</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-muted">Balances are yours to update; each update is a new dated revision and the baseline is recomputed from a new snapshot. Your cash floor and buffer target are your choices, not rules.</p>
      </div>
      {clarity && clarityRun ? (
        <section className="grid gap-3 sm:grid-cols-3">
          <Stat label="Liquid cash" hint={`${formatMoney(clarity.cash.above_floor)} above your ${formatMoney(clarity.cash.cash_floor)} floor`}>
            <Money value={clarity.cash.liquid_total} run={clarityRun} label="Liquid cash" field="cash.liquid_total" />
          </Stat>
          <Stat label="Gap to your buffer target" hint={clarity.cash.buffer_target_months ? `${clarity.cash.buffer_target_months} months of essentials; now ${clarity.cash.essential_buffer_months ?? "—"}` : "No target chosen"}>
            <Money value={clarity.cash.buffer_gap_amount} run={clarityRun} label="Buffer gap" field="cash.buffer_gap_amount" />
          </Stat>
          <Stat label="Total debt" hint={`${clarity.debt.liability_count} liabilities · minimums ${formatMoney(clarity.debt.total_minimums)}/month · weighted APR ${clarity.debt.balance_weighted_apr_percent ?? "—"}%`}>
            <Money value={clarity.debt.total_balance} run={clarityRun} label="Total debt balance" field="debt.total_balance" />
          </Stat>
        </section>
      ) : (
        <Alert tone="conflict" title="No baseline available">Totals need the calculation service; your records are listed below.</Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Cash accounts" subtitle="Liquid accounts count toward the buffer. Update a balance to create a new revision.">
          <div className="space-y-4">
            {b.cashAccounts.map((a) => (
              <div key={a.id} className="rounded-lg border border-line p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold">{a.label}</p>
                    <p className="text-xs text-ink-muted">
                      {a.kind.toLowerCase().replace(/_/g, " ")} · as of {a.balance_as_of} · revision {a.revision}
                      {a.liquid ? "" : " · not liquid"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold tabular">{formatMoney(a.balance)}</span>
                    <DataStateChip state={a.data_state} />
                  </div>
                </div>
                {isOwner && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs font-semibold text-navy">Update balance</summary>
                    <ActionForm action={updateBalanceAction} hidden={{ account_ref: a.account_ref }} submitLabel="Save new revision" pendingLabel="Saving and recomputing…" size="sm" className="mt-2">
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Field label="Balance" required>
                          <input name="balance" inputMode="decimal" defaultValue={a.balance} className={inputClasses} aria-label={`New balance for ${a.label}`} />
                        </Field>
                        <Field label="As of" required>
                          <input name="as_of" type="date" defaultValue={a.balance_as_of} className={inputClasses} aria-label={`As-of date for ${a.label}`} />
                        </Field>
                      </div>
                    </ActionForm>
                  </details>
                )}
              </div>
            ))}
          </div>
        </Card>
        <Card title="Your guardrails" subtitle="A hard constraint for every suggestion: nothing is proposed that would take you below your floor.">
          {isOwner ? (
            <ActionForm action={updatePolicyAction} submitLabel="Save and recompute" pendingLabel="Saving…" size="sm">
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Cash floor (USD)" hint="Liquid cash you never want to go below.">
                  <input name="cash_floor" inputMode="decimal" defaultValue={b.profile.cash_floor} className={inputClasses} />
                </Field>
                <Field label="Buffer target (months)" hint="Essential expenses to hold in reserve. Leave blank for none.">
                  <input name="buffer_target_months" inputMode="decimal" defaultValue={b.profile.buffer_target_months ?? ""} className={inputClasses} />
                </Field>
                <Field label="Extra debt payment (USD/month)" hint="Explored in Scenarios; not a commitment.">
                  <input name="extra_debt_payment_monthly" inputMode="decimal" defaultValue={b.profile.extra_debt_payment_monthly} className={inputClasses} />
                </Field>
              </div>
            </ActionForm>
          ) : (
            <p className="text-sm text-ink-muted">Only the workspace owner can change guardrails.</p>
          )}
        </Card>
      </div>

      <Card title="Liabilities" subtitle="Balances, rates and minimums as you reported them. Variable rates are held constant in comparisons.">
        <table className="w-full">
          <thead className="border-b border-line">
            <tr>
              <Th>Liability</Th>
              <Th align="right">Balance</Th>
              <Th align="right">APR</Th>
              <Th align="right">Minimum</Th>
              <Th>Rate</Th>
              <Th>State</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {b.liabilities.map((l) => (
              <tr key={l.id}>
                <Td>
                  <span className="font-medium">{l.label}</span>
                  <span className="ml-2 text-xs text-ink-muted">{l.kind.toLowerCase().replace(/_/g, " ")} · due day {l.due_day_of_month ?? "—"}</span>
                </Td>
                <Td align="right">{formatMoney(l.balance)}</Td>
                <Td align="right">{l.apr_percent}%</Td>
                <Td align="right">{formatMoney(l.minimum_payment)}</Td>
                <Td>
                  <Chip tone={l.rate_type === "VARIABLE" ? "amber" : "neutral"}>{l.rate_type.toLowerCase()}</Chip>
                  {l.promo_apr_expires && <span className="ml-2 text-xs text-ink-muted">promo until {l.promo_apr_expires}</span>}
                </Td>
                <Td>
                  <DataStateChip state={l.data_state} />
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-xs text-ink-faint">Compare payoff orderings under your extra payment in Scenarios. No consolidation, refinancing or balance-transfer products are recommended here.</p>
      </Card>
    </div>
  );
}
