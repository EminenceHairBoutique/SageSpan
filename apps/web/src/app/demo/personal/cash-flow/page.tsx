import { formatMoney, parseCents } from "@sagespan/contracts";
import { DataStateChip, DisclosureList, Money, Stat } from "@/ui/personal/components";
import { Alert, Card, Chip, Td, Th } from "@/ui/primitives";
import { loadPersonal } from "../load";

export const dynamic = "force-dynamic";

const cadence = (c: string) => c.toLowerCase().replace("_", "-");

export default async function CashFlowPage() {
  const { b, insights, labels } = await loadPersonal({ ensureBaseline: true });
  const { clarity, clarityRun } = insights;
  const income = clarity?.income;
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal">Cash flow</p>
        <h1 className="mt-1 text-2xl font-bold">Income, commitments and the next 90 days</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-muted">Observed history is shown as you reported it. The outlook is a dated projection of commitments and expected income; it is not a forecast of behaviour and includes no interest or taxes.</p>
      </div>

      {clarity && clarityRun ? (
        <>
          <section className="grid gap-3 sm:grid-cols-3">
            <Stat label="Typical monthly income" hint={`Median of ${income!.observed_months} observed months · ${income!.classification.toLowerCase()}`}>
              <Money value={income!.typical_monthly} run={clarityRun} label="Typical monthly income" field="income.typical_monthly" />
            </Stat>
            <Stat label="Low month" hint={`High month ${formatMoney(income!.high_monthly)} · spread ${income!.spread_ratio ?? "—"}`}>
              <Money value={income!.low_monthly} run={clarityRun} label="Lowest observed monthly income" field="income.low_monthly" />
            </Stat>
            <Stat label="Essential commitments / month" hint={`${clarity.commitments.essential_items} essential items incl. ${formatMoney(clarity.commitments.monthly_debt_minimums)} debt minimums · ${formatMoney(clarity.commitments.monthly_discretionary_typical)} usual discretionary`}>
              <Money value={clarity.commitments.monthly_essential} run={clarityRun} label="Monthly essential commitments" field="commitments.monthly_essential" />
            </Stat>
          </section>
          {income!.classification === "IRREGULAR" && (
            <Alert tone="amber" title="Irregular income">
              The outlook uses each irregular stream&apos;s lowest observed month, so the projection is deliberately conservative. Planning around {formatMoney(income!.low_monthly)} rather than the typical {formatMoney(income!.typical_monthly)} is what the Next steps are built on.
            </Alert>
          )}
        </>
      ) : (
        <Alert tone="conflict" title="No baseline available">The calculation service could not be reached; observed inputs are shown below but no totals are stated.</Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Income streams" subtitle="Net amounts per month as you reported them, oldest first.">
          <div className="space-y-4">
            {b.incomeStreams.map((s) => (
              <div key={s.id} className="rounded-lg border border-line p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">{s.label}</p>
                  <div className="flex gap-2">
                    <Chip tone="neutral">{s.kind.toLowerCase().replace(/_/g, " ")} · {cadence(s.cadence)}</Chip>
                    <DataStateChip state={s.data_state} />
                  </div>
                </div>
                <p className="mt-2 text-xs text-ink-muted">
                  Observed {s.observed_from ?? "—"} → {s.observed_to ?? "—"} ({s.observed_monthly_amounts.length} months) · reliability you stated: {s.reliability.toLowerCase()}
                  {s.next_expected_date ? ` · next expected ${s.next_expected_date}${s.expected_amount ? ` (${formatMoney(s.expected_amount)})` : ""}` : ""}
                </p>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {s.observed_monthly_amounts.map((a, i) => (
                    <li key={i} className="rounded bg-surface-muted px-2 py-0.5 text-xs tabular">
                      {formatMoney(a)}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Recurring commitments" subtitle="Essential items count toward the buffer; the rest are discretionary.">
          <table className="w-full">
            <thead className="border-b border-line">
              <tr>
                <Th>Item</Th>
                <Th>Next due</Th>
                <Th align="right">Amount</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {[...b.obligations]
                .sort((a, z) => a.next_due_date.localeCompare(z.next_due_date))
                .map((o) => (
                  <tr key={o.id}>
                    <Td>
                      <span className="font-medium">{o.label}</span>
                      <span className="ml-2 text-xs text-ink-muted">
                        {o.category.toLowerCase().replace(/_/g, " ")} · {cadence(o.cadence)}
                        {o.essential ? "" : " · discretionary"}
                      </span>
                    </Td>
                    <Td>{o.next_due_date}</Td>
                    <Td align="right">{formatMoney(o.amount)}</Td>
                  </tr>
                ))}
            </tbody>
          </table>
        </Card>
      </div>

      {clarity && clarityRun && (
        <Card title={`Dated outlook, next ${clarity.outlook.horizon_days} days`} subtitle={`Starts from ${formatMoney(clarity.outlook.start_cash)} liquid cash. Lowest point ${formatMoney(clarity.outlook.lowest_projected_cash)} on ${clarity.outlook.lowest_projected_date}; ends at ${formatMoney(clarity.outlook.end_projected_cash)}. Usual discretionary spending is spread evenly per day.`}>
          {clarity.outlook.collisions.length > 0 && (
            <DisclosureList tone="amber" title="Weeks where essential payments cluster" items={clarity.outlook.collisions.map((c) => `${c.window_start} – ${c.window_end}: ${formatMoney(c.total_due)} across ${c.refs.map((r) => labels[r] ?? r).join(", ")}`)} />
          )}
          <div className="mt-3 max-h-[480px] overflow-auto">
            <table className="w-full">
              <thead className="sticky top-0 border-b border-line bg-surface">
                <tr>
                  <Th>Date</Th>
                  <Th>Events</Th>
                  <Th align="right">Projected cash</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {clarity.outlook.points.map((p) => {
                  const below = parseCents(p.projected_cash) < parseCents(clarity.cash.cash_floor);
                  return (
                    <tr key={p.date} className={below ? "bg-conflict-100/40" : undefined}>
                      <Td>{p.date}</Td>
                      <Td>
                        <ul className="space-y-0.5 text-xs">
                          {p.events.map((e, i) => (
                            <li key={i} className={e.kind === "INCOME" ? "text-teal-700" : "text-ink"}>
                              {e.kind === "INCOME" ? "+" : ""}
                              {formatMoney(e.amount)} {labels[e.ref] ?? e.ref}
                              {e.essential === false ? " (discretionary)" : ""}
                            </li>
                          ))}
                          {p.events.length === 0 && <li className="text-ink-faint">horizon end</li>}
                        </ul>
                      </Td>
                      <Td align="right" className={below ? "font-semibold text-conflict-700" : undefined}>
                        {formatMoney(p.projected_cash)}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-ink-faint">Projection from the receipted baseline (method {Object.entries(clarityRun.method_set_versions).map(([k, v]) => `${k}@${v}`).join(", ")}). Rows shaded red are below your {formatMoney(clarity.cash.cash_floor)} floor.</p>
        </Card>
      )}
    </div>
  );
}
