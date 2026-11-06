import Link from "next/link";
import { redirect } from "next/navigation";
import { formatMoney, PERSONAL_RECORD_TYPE_LABELS } from "@sagespan/contracts";
import { getProductionIdentity } from "@/auth/actor";
import { supabaseConfigured } from "@/config/env";
import { productionPersonalRepository } from "@/domain/personal/repository";
import { appRetireRecordAction, appSaveRecordAction, appUpdatePolicyAction } from "@/server/app-personal-actions";
import { ActionForm } from "@/ui/ActionForm";
import { DataStateChip } from "@/ui/personal/components";
import { AddRecord, CashAccountFields, EditRecord, GoalFields, IncomeStreamFields, LiabilityFields, ObligationFields, VariableSpendingFields } from "@/ui/personal/RecordForms";
import { ProductionGate } from "@/ui/ProductionGate";
import { Alert, Card, Chip, Field, inputClasses, KeyValue } from "@/ui/primitives";

export const dynamic = "force-dynamic";

const PENDING = "Saving…";

/**
 * DATA-001 — the production "My Money": the signed-in person's own records, read and written
 * through Supabase under their session (RLS 0008). Same forms and the same domain functions as
 * /demo/personal; no totals, no baseline, no recommendations here yet — those need receipted
 * runs over persisted snapshots (DATA-002), and we say so rather than compute in this tier.
 */
export default async function AppPersonalPage() {
  if (!supabaseConfigured()) return <ProductionGate requestedPath="/app/personal" />;
  const identity = await getProductionIdentity();
  if (!identity) redirect("/app/sign-in?next=%2Fapp%2Fpersonal");
  const repo = await productionPersonalRepository();
  if (!repo) redirect("/app/personal/start");
  const b = await repo.bundle();
  const isOwner = b.membership.role === "OWNER";
  const can = (domain: "CASH_FLOW" | "SPENDING" | "DEBT" | "SAVINGS_GOALS") => isOwner || b.membership.domains.includes(domain);
  const liabilityOptions = b.liabilities.map((l) => ({ id: l.id, label: l.label }));
  const accountOptions = b.cashAccounts.map((a) => ({ ref: a.account_ref, label: a.label }));
  const counts = [b.cashAccounts.length, b.incomeStreams.length, b.obligations.length, b.variableSpending.length, b.liabilities.length, b.goals.length];
  const empty = counts.every((c) => c === 0);

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal">My Money · {b.workspace.kind === "HOUSEHOLD" ? "household" : "personal"} workspace</p>
          <h1 className="mt-1 text-2xl font-bold">{b.workspace.label}</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">
            Every record below came from this workspace&apos;s rows in the database, read as you. {isOwner ? "You own this workspace: adds, edits and retirements are yours, each kept as a dated revision." : `You participate with access to: ${b.membership.domains.join(", ") || "nothing yet"}.`}
          </p>
        </div>
        <Link href="/app" className="text-sm underline">
          Account &amp; workspaces
        </Link>
      </div>

      <Alert tone="amber" title="Records only, for now">
        Totals, your cash-flow baseline, debt paths, what-ifs and next steps need receipted calculation runs over a frozen snapshot of these records. That persistence (DATA-002) is not built for production workspaces yet, so nothing is computed or estimated on this page. The synthetic demo of the full experience is at <Link href="/demo/personal" className="underline">/demo/personal</Link>.
      </Alert>

      {empty ? (
        <Card title="Nothing recorded yet">
          <p className="text-sm text-ink-muted">Add what you know below. Leave out what you do not know; blanks stay missing rather than being guessed.</p>
        </Card>
      ) : null}

      {can("CASH_FLOW") ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Cash accounts" subtitle="Each balance update is a new dated revision; the old one stays in history.">
            <div className="space-y-3">
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
                  {isOwner ? (
                    <EditRecord type="CASH_ACCOUNT" recordRef={a.account_ref} name={a.label} save={appSaveRecordAction} retire={appRetireRecordAction} pendingLabel={PENDING}>
                      <CashAccountFields r={a} />
                    </EditRecord>
                  ) : null}
                </div>
              ))}
              {isOwner ? (
                <AddRecord type="CASH_ACCOUNT" title="Add a cash account" save={appSaveRecordAction} pendingLabel={PENDING}>
                  <CashAccountFields />
                </AddRecord>
              ) : null}
            </div>
          </Card>
          <Card title="Income" subtitle="Observed net amounts per month, oldest first. Patterns are only characterised once there are enough months.">
            <div className="space-y-3">
              {b.incomeStreams.map((r) => (
                <div key={r.id} className="rounded-lg border border-line p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold">{r.label}</p>
                      <p className="text-xs text-ink-muted">
                        {r.kind.toLowerCase().replace(/_/g, " ")} · {r.cadence.toLowerCase()} · {r.observed_monthly_amounts.length} months observed
                      </p>
                    </div>
                    <DataStateChip state={r.data_state} />
                  </div>
                  {isOwner ? (
                    <EditRecord type="INCOME_STREAM" recordRef={r.id} name={r.label} save={appSaveRecordAction} retire={appRetireRecordAction} pendingLabel={PENDING}>
                      <IncomeStreamFields r={r} />
                    </EditRecord>
                  ) : null}
                </div>
              ))}
              {isOwner ? (
                <AddRecord type="INCOME_STREAM" title="Add an income stream" save={appSaveRecordAction} pendingLabel={PENDING}>
                  <IncomeStreamFields />
                </AddRecord>
              ) : null}
            </div>
          </Card>
          <Card title="Recurring bills" subtitle="Fixed commitments and their cadence. A debt minimum can be linked to its debt.">
            <div className="space-y-3">
              {b.obligations.map((o) => (
                <div key={o.id} className="rounded-lg border border-line p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold">{o.label}</p>
                      <p className="text-xs text-ink-muted">
                        {o.category.toLowerCase().replace(/_/g, " ")} · {o.cadence.toLowerCase()} · next {o.next_due_date}
                        {o.essential ? " · essential" : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold tabular">{formatMoney(o.amount)}</span>
                      <DataStateChip state={o.data_state} />
                    </div>
                  </div>
                  {isOwner ? (
                    <EditRecord type="OBLIGATION" recordRef={o.id} name={o.label} save={appSaveRecordAction} retire={appRetireRecordAction} pendingLabel={PENDING}>
                      <ObligationFields r={o} liabilities={liabilityOptions} />
                    </EditRecord>
                  ) : null}
                </div>
              ))}
              {isOwner ? (
                <AddRecord type="OBLIGATION" title="Add a recurring bill" save={appSaveRecordAction} pendingLabel={PENDING}>
                  <ObligationFields liabilities={liabilityOptions} />
                </AddRecord>
              ) : null}
            </div>
          </Card>
          <Card title="Your guardrails" subtitle="Your own choices; they constrain recommendations and are never a universal rule.">
            <KeyValue
              rows={[
                { k: "Cash floor", v: formatMoney(b.profile.cash_floor) },
                { k: "Buffer target", v: b.profile.buffer_target_months ? `${b.profile.buffer_target_months} months of essentials` : "not chosen" },
                { k: "Extra toward debt (what-if input)", v: `${formatMoney(b.profile.extra_debt_payment_monthly)}/month` },
                { k: "Notifications", v: b.profile.notification_mode === "QUIET" ? "quiet" : "normal" },
              ]}
            />
            {isOwner ? (
              <details className="mt-3">
                <summary className="cursor-pointer text-xs font-semibold text-navy">Change guardrails</summary>
                <ActionForm action={appUpdatePolicyAction} submitLabel="Save guardrails" pendingLabel={PENDING} size="sm" className="mt-2">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Field label="Cash floor">
                      <input name="cash_floor" defaultValue={b.profile.cash_floor} inputMode="decimal" className={inputClasses} aria-label="Cash floor" />
                    </Field>
                    <Field label="Buffer target (months)">
                      <input name="buffer_target_months" defaultValue={b.profile.buffer_target_months ?? ""} inputMode="decimal" className={inputClasses} aria-label="Buffer target months" />
                    </Field>
                    <Field label="Extra toward debt per month">
                      <input name="extra_debt_payment_monthly" defaultValue={b.profile.extra_debt_payment_monthly} inputMode="decimal" className={inputClasses} aria-label="Extra debt payment" />
                    </Field>
                    <Field label="Notifications">
                      <select name="notification_mode" defaultValue={b.profile.notification_mode} className={inputClasses} aria-label="Notification mode">
                        <option value="NORMAL">Normal</option>
                        <option value="QUIET">Quiet</option>
                      </select>
                    </Field>
                  </div>
                </ActionForm>
              </details>
            ) : null}
          </Card>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        {can("SPENDING") ? (
          <Card title="Variable spending" subtitle="Observed monthly totals per category, oldest first.">
            <div className="space-y-3">
              {b.variableSpending.map((v) => (
                <div key={v.id} className="rounded-lg border border-line p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold">{v.category}</p>
                    <div className="flex items-center gap-2">
                      <Chip tone="neutral">{v.observed_monthly_amounts.length} months</Chip>
                      <DataStateChip state={v.data_state} />
                    </div>
                  </div>
                  {isOwner ? (
                    <EditRecord type="VARIABLE_SPENDING" recordRef={v.id} name={v.category} save={appSaveRecordAction} retire={appRetireRecordAction} pendingLabel={PENDING}>
                      <VariableSpendingFields r={v} />
                    </EditRecord>
                  ) : null}
                </div>
              ))}
              {isOwner ? (
                <AddRecord type="VARIABLE_SPENDING" title="Add a spending category" save={appSaveRecordAction} pendingLabel={PENDING}>
                  <VariableSpendingFields />
                </AddRecord>
              ) : null}
            </div>
          </Card>
        ) : null}
        {can("DEBT") ? (
          <Card title="Debts" subtitle="Balances, APRs and minimums as you reported them.">
            <div className="space-y-3">
              {b.liabilities.map((l) => (
                <div key={l.id} className="rounded-lg border border-line p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold">{l.label}</p>
                      <p className="text-xs text-ink-muted">
                        {l.kind.toLowerCase().replace(/_/g, " ")} · {l.apr_percent}% APR · min {formatMoney(l.minimum_payment)} · as of {l.balance_as_of}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold tabular">{formatMoney(l.balance)}</span>
                      <DataStateChip state={l.data_state} />
                    </div>
                  </div>
                  {isOwner ? (
                    <EditRecord type="LIABILITY" recordRef={l.id} name={l.label} save={appSaveRecordAction} retire={appRetireRecordAction} pendingLabel={PENDING}>
                      <LiabilityFields r={l} />
                    </EditRecord>
                  ) : null}
                </div>
              ))}
              {isOwner ? (
                <AddRecord type="LIABILITY" title="Add a debt" save={appSaveRecordAction} pendingLabel={PENDING}>
                  <LiabilityFields />
                </AddRecord>
              ) : null}
            </div>
          </Card>
        ) : null}
        {can("SAVINGS_GOALS") ? (
          <Card title="Savings goals" subtitle="Targets and what is set aside so far.">
            <div className="space-y-3">
              {b.goals.map((g) => (
                <div key={g.id} className="rounded-lg border border-line p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold">{g.label}</p>
                      <p className="text-xs text-ink-muted">
                        {g.kind.toLowerCase().replace(/_/g, " ")}
                        {g.target_date ? ` · by ${g.target_date}` : ""}
                      </p>
                    </div>
                    <span className="font-bold tabular">
                      {formatMoney(g.saved_amount)} <span className="text-xs font-normal text-ink-muted">of {formatMoney(g.target_amount)}</span>
                    </span>
                  </div>
                  {isOwner ? (
                    <EditRecord type="GOAL" recordRef={g.id} name={g.label} save={appSaveRecordAction} retire={appRetireRecordAction} pendingLabel={PENDING}>
                      <GoalFields r={g} accounts={accountOptions} />
                    </EditRecord>
                  ) : null}
                </div>
              ))}
              {isOwner ? (
                <AddRecord type="GOAL" title="Add a goal" save={appSaveRecordAction} pendingLabel={PENDING}>
                  <GoalFields accounts={accountOptions} />
                </AddRecord>
              ) : null}
            </div>
          </Card>
        ) : null}
      </div>

      {isOwner && b.recordRevisions.length > 0 ? (
        <Card title="Change history" subtitle="Append-only. Every create, update and retirement, newest first.">
          <ul className="divide-y divide-line text-sm">
            {b.recordRevisions.slice(0, 25).map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2 py-2">
                <Chip tone="neutral">{r.change}</Chip>
                <span>{PERSONAL_RECORD_TYPE_LABELS[r.record_type]}</span>
                <span className="text-ink-muted">revision {r.revision}</span>
                <span className="ml-auto text-xs text-ink-muted">{r.created_at.slice(0, 19).replace("T", " ")} UTC</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </main>
  );
}
