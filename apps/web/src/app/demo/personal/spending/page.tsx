import { formatMoney } from "@sagespan/contracts";
import { DataStateChip, Money, Stat } from "@/ui/personal/components";
import { AddRecord, EditRecord, VariableSpendingFields } from "@/ui/personal/RecordForms";
import { Alert, Card, Chip } from "@/ui/primitives";
import { loadPersonal } from "../load";

export const dynamic = "force-dynamic";

export default async function SpendingPage() {
  const { b, insights } = await loadPersonal({ ensureBaseline: true });
  const { clarity, clarityRun } = insights;
  const isOwner = b.membership.role === "OWNER";
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal">Spending</p>
        <h1 className="mt-1 text-2xl font-bold">Spending patterns, without a score</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-muted">Observed monthly totals by category, as you recorded them (transfers and refunds already excluded). SageSpan separates essential from discretionary because the buffer is measured against essentials; it does not grade your spending.</p>
      </div>
      {clarity && clarityRun ? (
        <section className="grid gap-3 sm:grid-cols-3">
          <Stat label="Essential commitments / month" hint="Fixed essentials plus typical essential variable spending">
            <Money value={clarity.commitments.monthly_essential} run={clarityRun} label="Monthly essential commitments" field="commitments.monthly_essential" />
          </Stat>
          <Stat label="Usual discretionary / month" hint={`${clarity.commitments.discretionary_items} categories and subscriptions`}>
            <Money value={clarity.commitments.monthly_discretionary_typical} run={clarityRun} label="Typical discretionary spending" field="commitments.monthly_discretionary_typical" />
          </Stat>
          <Stat label="Left in a low month, essentials only" hint="What a slow month leaves if discretionary spending paused">
            <Money value={clarity.margin.essential_only_low} run={clarityRun} label="Low-month margin, essentials only" field="margin.essential_only_low" />
          </Stat>
        </section>
      ) : (
        <Alert tone="conflict" title="No baseline available">Totals need the calculation service.</Alert>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {b.variableSpending.map((v) => (
          <Card key={v.id} title={v.category} subtitle={`${v.observed_monthly_amounts.length} observed months`} actions={<div className="flex gap-2"><Chip tone={v.essential ? "navy" : "neutral"}>{v.essential ? "Essential" : "Discretionary"}</Chip><DataStateChip state={v.data_state} /></div>}>
            <ul className="flex flex-wrap gap-1.5">
              {v.observed_monthly_amounts.map((a, i) => (
                <li key={i} className="rounded bg-surface-muted px-2 py-0.5 text-xs tabular">
                  {formatMoney(a)}
                </li>
              ))}
            </ul>
            {v.observed_monthly_amounts.length === 0 && <p className="text-xs text-ink-faint">No months recorded yet; this category is marked missing.</p>}
            <p className="mt-2 text-xs text-ink-faint">{v.transfers_excluded ? "Transfers and refunds excluded." : "Transfers may be included; totals could be overstated."}</p>
            {isOwner && (
              <EditRecord type="VARIABLE_SPENDING" recordRef={v.id} name={v.category}>
                <VariableSpendingFields r={v} />
              </EditRecord>
            )}
          </Card>
        ))}
        {isOwner && (
          <Card title="Add a spending category" subtitle="Observed monthly totals you know; nothing is estimated for you.">
            <AddRecord type="VARIABLE_SPENDING" title="Add a category">
              <VariableSpendingFields />
            </AddRecord>
          </Card>
        )}
        <Card title="Subscriptions and non-essential commitments" subtitle="Recurring items you marked as discretionary.">
          <ul className="space-y-1 text-sm">
            {b.obligations
              .filter((o) => !o.essential)
              .map((o) => (
                <li key={o.id} className="flex justify-between">
                  <span>{o.label}</span>
                  <span className="tabular">{formatMoney(o.amount)} / {o.cadence.toLowerCase()}</span>
                </li>
              ))}
          </ul>
          <p className="mt-3 text-xs text-ink-faint">Detection of recurring charges from transactions (with transfer/refund de-duplication) is a later milestone (PERS-002b); today these are manual entries, editable under Cash flow.</p>
        </Card>
      </div>
    </div>
  );
}
