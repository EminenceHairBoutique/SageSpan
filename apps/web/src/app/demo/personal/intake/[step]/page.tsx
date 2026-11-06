import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CheckCircle2, CircleDashed } from "lucide-react";
import { PERSONAL_DATA_STATE_LABELS, formatMoney } from "@sagespan/contracts";
import { INTAKE_STEPS, type IntakeStep } from "@/domain/personal/intake";
import { refreshBaselineAction, startFreshAction } from "@/server/personal-actions";
import { ActionForm } from "@/ui/ActionForm";
import { DataStateChip } from "@/ui/personal/components";
import { AddRecord, CashAccountFields, EditRecord, GoalFields, IncomeStreamFields, LiabilityFields, ObligationFields, VariableSpendingFields } from "@/ui/personal/RecordForms";
import { Alert, ButtonLink, Card, Chip, cx, Field, inputClasses, KeyValue, Td, Th } from "@/ui/primitives";
import { loadPersonal } from "../../load";

export const dynamic = "force-dynamic";

/**
 * "Start fresh" guided intake: Welcome → Income → Bills → Spending → Cash & debts
 * → Goals → Verify → Baseline. Every step writes the same records the record
 * forms write (owner only, revisioned, workspace-scoped). Blanks stay MISSING.
 * The baseline step asks the calculation service for the first receipted run;
 * if the basics are absent it returns INSUFFICIENT_DATA and says so.
 */
const KEYS = INTAKE_STEPS.map((s) => s.key) as readonly string[];

function Progress({ current }: { current: IntakeStep }) {
  const idx = KEYS.indexOf(current);
  return (
    <ol className="flex flex-wrap gap-2 text-xs" aria-label="Intake steps">
      {INTAKE_STEPS.map((s, i) => (
        <li key={s.key} className={cx("flex items-center gap-1 rounded-full border px-2.5 py-1", i < idx ? "border-teal/40 bg-teal/5 text-teal-700" : i === idx ? "border-navy bg-navy text-white" : "border-line text-ink-muted")}>
          {i < idx ? <CheckCircle2 size={12} aria-hidden /> : <CircleDashed size={12} aria-hidden />}
          {s.label}
        </li>
      ))}
    </ol>
  );
}

function Next({ step, label = "Continue" }: { step: IntakeStep; label?: string }) {
  return (
    <ButtonLink href={`/demo/personal/intake/${step}`} variant="primary" size="md">
      {label} <ArrowRight size={14} aria-hidden />
    </ButtonLink>
  );
}

export default async function IntakeStepPage({ params }: { params: Promise<{ step: string }> }) {
  const { step } = await params;
  if (!KEYS.includes(step)) notFound();
  const current = step as IntakeStep;
  const idx = KEYS.indexOf(current);
  const back = idx > 0 ? (KEYS[idx - 1] as IntakeStep) : null;

  if (current === "welcome") {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <Progress current={current} />
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal">Start fresh</p>
          <h1 className="mt-1 text-2xl font-bold">Your own picture, from your own numbers</h1>
          <p className="mt-2 text-sm text-ink-muted">This creates a new synthetic individual and an empty workspace, separate from the Maya Castillo demo. Nothing is connected, imported or assumed: you enter what you know, leave blank what you do not, and SageSpan shows what it can and cannot conclude.</p>
        </div>
        <Card title="Who is this for?">
          <ActionForm action={startFreshAction} submitLabel="Create my workspace" pendingLabel="Creating…">
            <Field label="Your first name (or a nickname)" required>
              <input name="display_name" required maxLength={60} className={inputClasses} aria-label="Display name" placeholder="Jordan" />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Workspace" hint="A household workspace lets you invite a partner later with limited, revocable access.">
                <select name="workspace_kind" defaultValue="PERSONAL" className={inputClasses} aria-label="Workspace kind">
                  <option value="PERSONAL">Just me</option>
                  <option value="HOUSEHOLD">My household</option>
                </select>
              </Field>
              <Field label="People in the household">
                <input name="household_size" type="number" min={1} max={12} defaultValue={1} className={inputClasses} aria-label="Household size" />
              </Field>
            </div>
            <Field label="Your situation, in a sentence (optional)" hint="Used for tone only, never for arithmetic.">
              <input name="situation" maxLength={240} className={inputClasses} aria-label="Situation" placeholder="Two incomes, one car loan, saving for a move." />
            </Field>
            <Field label="What worries you most? (optional)">
              <input name="top_concern" maxLength={240} className={inputClasses} aria-label="Top concern" />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Cash floor (USD)" required hint="The lowest your liquid cash should ever go. Your rule; every suggestion respects it.">
                <input name="cash_floor" inputMode="decimal" required className={inputClasses} aria-label="Cash floor" placeholder="1000.00" />
              </Field>
              <Field label="Buffer target (months of essentials, optional)" hint="Your choice; SageSpan never imposes a universal number.">
                <input name="buffer_target_months" inputMode="decimal" className={inputClasses} aria-label="Buffer target months" placeholder="2" />
              </Field>
            </div>
          </ActionForm>
        </Card>
        <p className="text-xs text-ink-faint">Synthetic demonstration. Identity is a demo cookie, not an account; real sign-up, consent and sharing arrive with PR-003 / DATA-001.</p>
      </div>
    );
  }

  const { b, insights, labels } = await loadPersonal({ ensureBaseline: current === "baseline" });
  const isOwner = b.membership.role === "OWNER";
  const liabilityOptions = b.liabilities.map((l) => ({ id: l.id, label: l.label }));
  const accountOptions = b.cashAccounts.map((a) => ({ ref: a.account_ref, label: a.label }));

  const header = (title: string, lead: string) => (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal">Start fresh · {b.workspace.label}</p>
      <h1 className="mt-1 text-2xl font-bold">{title}</h1>
      <p className="mt-2 text-sm text-ink-muted">{lead}</p>
    </div>
  );
  const footer = (next: IntakeStep, skipLabel?: string) => (
    <div className="flex flex-wrap items-center gap-3">
      {back && (
        <Link href={`/demo/personal/intake/${back}`} className="text-sm text-ink-muted underline-offset-4 hover:underline">
          Back
        </Link>
      )}
      <Next step={next} label={skipLabel} />
    </div>
  );
  if (!isOwner) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <Progress current={current} />
        <Alert tone="amber" title="Owner only">Only the workspace owner can add records.</Alert>
      </div>
    );
  }

  if (current === "income") {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <Progress current={current} />
        {header("Income", "Each stream separately, with the net amount received per month for as many recent months as you know (three or more lets SageSpan describe a pattern). Irregular is fine; say so and the outlook will be conservative.")}
        <Card title={`Income streams (${b.incomeStreams.length})`}>
          <div className="space-y-3">
            {b.incomeStreams.map((s) => (
              <div key={s.id} className="rounded-lg border border-line p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">{s.label}</p>
                  <div className="flex gap-2">
                    <Chip tone="neutral">{s.observed_monthly_amounts.length} months</Chip>
                    <DataStateChip state={s.data_state} />
                  </div>
                </div>
                <EditRecord type="INCOME_STREAM" recordRef={s.id} name={s.label}>
                  <IncomeStreamFields r={s} />
                </EditRecord>
              </div>
            ))}
            <AddRecord type="INCOME_STREAM" title="Add an income stream">
              <IncomeStreamFields />
            </AddRecord>
          </div>
        </Card>
        {footer("bills", b.incomeStreams.length ? "Continue" : "Skip for now")}
      </div>
    );
  }
  if (current === "bills") {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <Progress current={current} />
        {header("Recurring bills and commitments", "Rent or mortgage, utilities, insurance, loan minimums, subscriptions. Mark essential the ones that cannot be paused; the buffer is measured against those.")}
        <Card title={`Commitments (${b.obligations.length})`}>
          <div className="space-y-3">
            {b.obligations.map((o) => (
              <div key={o.id} className="rounded-lg border border-line p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">
                    {o.label} <span className="ml-1 text-xs text-ink-muted">{formatMoney(o.amount)} · {o.cadence.toLowerCase()} · next {o.next_due_date}</span>
                  </p>
                  <Chip tone={o.essential ? "navy" : "neutral"}>{o.essential ? "Essential" : "Discretionary"}</Chip>
                </div>
                <EditRecord type="OBLIGATION" recordRef={o.id} name={o.label}>
                  <ObligationFields r={o} liabilities={liabilityOptions} />
                </EditRecord>
              </div>
            ))}
            <AddRecord type="OBLIGATION" title="Add a commitment">
              <ObligationFields liabilities={liabilityOptions} />
            </AddRecord>
          </div>
        </Card>
        {footer("spending", b.obligations.length ? "Continue" : "Skip for now")}
      </div>
    );
  }
  if (current === "spending") {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <Progress current={current} />
        {header("Variable spending", "Groceries, fuel, dining, the rest: monthly totals you know, oldest first. SageSpan separates essential from discretionary; it does not grade you. A category with no months stays marked missing.")}
        <Card title={`Categories (${b.variableSpending.length})`}>
          <div className="space-y-3">
            {b.variableSpending.map((v) => (
              <div key={v.id} className="rounded-lg border border-line p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">{v.category}</p>
                  <div className="flex gap-2">
                    <Chip tone={v.essential ? "navy" : "neutral"}>{v.essential ? "Essential" : "Discretionary"}</Chip>
                    <DataStateChip state={v.data_state} />
                  </div>
                </div>
                <EditRecord type="VARIABLE_SPENDING" recordRef={v.id} name={v.category}>
                  <VariableSpendingFields r={v} />
                </EditRecord>
              </div>
            ))}
            <AddRecord type="VARIABLE_SPENDING" title="Add a category">
              <VariableSpendingFields />
            </AddRecord>
          </div>
        </Card>
        {footer("cash-debts", b.variableSpending.length ? "Continue" : "Skip for now")}
      </div>
    );
  }
  if (current === "cash-debts") {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <Progress current={current} />
        {header("Cash and debts", "Balances with their dates. Liquid accounts count toward your buffer. For each debt, add its minimum payment under Bills linked to the debt so it shows in the outlook.")}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title={`Cash accounts (${b.cashAccounts.length})`}>
            <div className="space-y-3">
              {b.cashAccounts.map((a) => (
                <div key={a.account_ref} className="rounded-lg border border-line p-3">
                  <p className="font-semibold">
                    {a.label} <span className="ml-1 text-xs text-ink-muted tabular">{formatMoney(a.balance)} as of {a.balance_as_of}</span>
                  </p>
                  <EditRecord type="CASH_ACCOUNT" recordRef={a.account_ref} name={a.label}>
                    <CashAccountFields r={a} />
                  </EditRecord>
                </div>
              ))}
              <AddRecord type="CASH_ACCOUNT" title="Add a cash account">
                <CashAccountFields />
              </AddRecord>
            </div>
          </Card>
          <Card title={`Debts (${b.liabilities.length})`}>
            <div className="space-y-3">
              {b.liabilities.map((l) => (
                <div key={l.id} className="rounded-lg border border-line p-3">
                  <p className="font-semibold">
                    {l.label} <span className="ml-1 text-xs text-ink-muted tabular">{formatMoney(l.balance)} · {l.apr_percent}% · min {formatMoney(l.minimum_payment)}</span>
                  </p>
                  {!b.obligations.some((o) => o.liability_id === l.id) && <p className="mt-1 text-xs text-amber-700">No linked minimum payment under Bills yet.</p>}
                  <EditRecord type="LIABILITY" recordRef={l.id} name={l.label}>
                    <LiabilityFields r={l} />
                  </EditRecord>
                </div>
              ))}
              <AddRecord type="LIABILITY" title="Add a debt">
                <LiabilityFields />
              </AddRecord>
            </div>
          </Card>
        </div>
        {footer("goals", b.cashAccounts.length ? "Continue" : "Skip for now")}
      </div>
    );
  }
  if (current === "goals") {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <Progress current={current} />
        {header("Goals", "What you are saving for, what is already set aside, and the pace you choose. Optional; a goal behind its date is information, not a judgement.")}
        <Card title={`Goals (${b.goals.length})`}>
          <div className="space-y-3">
            {b.goals.map((g) => (
              <div key={g.id} className="rounded-lg border border-line p-3">
                <p className="font-semibold">
                  {g.label} <span className="ml-1 text-xs text-ink-muted tabular">{formatMoney(g.saved_amount)} of {formatMoney(g.target_amount)}</span>
                </p>
                <EditRecord type="GOAL" recordRef={g.id} name={g.label}>
                  <GoalFields r={g} accounts={accountOptions} />
                </EditRecord>
              </div>
            ))}
            <AddRecord type="GOAL" title="Add a goal">
              <GoalFields accounts={accountOptions} />
            </AddRecord>
          </div>
        </Card>
        {footer("verify", b.goals.length ? "Continue" : "Skip for now")}
      </div>
    );
  }
  if (current === "verify") {
    const rows: Array<{ what: string; count: number; missing: number; note: string }> = [
      { what: "Income streams", count: b.incomeStreams.length, missing: b.incomeStreams.filter((s) => s.data_state === "MISSING").length, note: b.incomeStreams.some((s) => s.observed_monthly_amounts.length >= 3) ? "Enough months for a pattern on at least one stream." : "Fewer than 3 observed months; patterns will be flagged as short." },
      { what: "Recurring commitments", count: b.obligations.length, missing: 0, note: `${b.obligations.filter((o) => o.essential).length} essential.` },
      { what: "Spending categories", count: b.variableSpending.length, missing: b.variableSpending.filter((v) => v.data_state === "MISSING").length, note: b.variableSpending.some((v) => !v.transfers_excluded) ? "Some totals may include transfers." : "Transfers excluded where stated." },
      { what: "Cash accounts", count: b.cashAccounts.length, missing: 0, note: b.cashAccounts.length ? `Latest balance date ${b.cashAccounts.map((a) => a.balance_as_of).sort().at(-1)}.` : "Buffer and outlook will start from zero." },
      { what: "Debts", count: b.liabilities.length, missing: b.liabilities.filter((l) => !b.obligations.some((o) => o.liability_id === l.id)).length, note: "Missing = debts without a linked minimum payment." },
      { what: "Goals", count: b.goals.length, missing: 0, note: "" },
    ];
    const basicsMissing = b.incomeStreams.every((s) => s.observed_monthly_amounts.length === 0) || (b.obligations.length === 0 && b.variableSpending.length === 0) || b.cashAccounts.length === 0;
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <Progress current={current} />
        {header("Verify the key inputs", "What you entered, what is missing, and what SageSpan will be able to say. Anything blank stays blank; nothing is filled in for you.")}
        <Card title="Your guardrails">
          <KeyValue rows={[{ k: "Cash floor", v: formatMoney(b.profile.cash_floor) }, { k: "Buffer target", v: b.profile.buffer_target_months ? `${b.profile.buffer_target_months} months of essentials` : "not set (that is fine)" }, { k: "Household", v: `${b.workspace.kind.toLowerCase()} · ${b.profile.household_size} ${b.profile.household_size === 1 ? "person" : "people"}` }]} />
        </Card>
        <Card title="Records">
          <table className="w-full">
            <thead className="border-b border-line">
              <tr>
                <Th>What</Th>
                <Th align="right">Entered</Th>
                <Th align="right">Missing</Th>
                <Th>Note</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.what}>
                  <Td>{r.what}</Td>
                  <Td align="right">{r.count}</Td>
                  <Td align="right">{r.missing ? <Chip tone="amber">{r.missing}</Chip> : "0"}</Td>
                  <Td className="text-xs text-ink-muted">{r.note}</Td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-ink-muted">Data states: {Object.values(PERSONAL_DATA_STATE_LABELS).slice(0, 4).join(" · ")}. Every record you entered is marked &quot;You reported&quot;; nothing is verified against a statement in this build.</p>
        </Card>
        {basicsMissing ? (
          <Alert tone="amber" title="The baseline will say INSUFFICIENT_DATA">Income months, at least one bill or spending category, and one cash balance are needed for an honest baseline. You can continue and see exactly what is missing, or go back and add them.</Alert>
        ) : (
          <Alert tone="teal" title="Enough for a first baseline">The calculation service can compute income statistics, commitments, margin, buffer and a dated 90-day outlook from these inputs, with a receipt.</Alert>
        )}
        {footer("baseline", "Compute my baseline")}
      </div>
    );
  }
  // baseline
  const { clarity, clarityRun } = insights;
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Progress current={current} />
      {header("Your first baseline", "Computed by the calculation service from a dated snapshot of what you entered, with a receipt. Descriptive only: no advice, no guesses.")}
      {!clarityRun ? (
        <Alert tone="conflict" title="Not computed">The calculation service could not be reached. Nothing is estimated locally; try again when it is available.</Alert>
      ) : clarityRun.run_status === "ERROR" ? (
        <Alert tone="conflict" title={`Not computed (${clarityRun.error?.code ?? "ERROR"})`}>{clarityRun.error?.message}</Alert>
      ) : clarity?.result_status === "INSUFFICIENT_DATA" ? (
        <Card title="Insufficient data" subtitle="The engine returned a dated snapshot and said what is missing instead of guessing.">
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {clarity.flags
              .filter((f) => f.code.startsWith("MISSING_") || f.code === "SHORT_INCOME_HISTORY")
              .map((f) => (
                <li key={f.code}>{f.message}</li>
              ))}
            {clarity.income.observed_months === 0 && <li>No observed income months were supplied.</li>}
          </ul>
          <div className="mt-4 flex flex-wrap gap-3">
            <ButtonLink href="/demo/personal/intake/income" variant="secondary" size="sm">
              Add what is missing
            </ButtonLink>
            <ButtonLink href="/demo/personal" variant="ghost" size="sm">
              Go to Overview anyway
            </ButtonLink>
          </div>
        </Card>
      ) : clarity ? (
        <Card title="Computed" subtitle={`As of ${clarity.as_of_date} · ${Object.entries(clarityRun.method_set_versions).map(([k, v]) => `${k}@${v}`).join(", ")} · receipt verified ${clarityRun.request_hash_verified ? "yes" : "NO"}`}>
          <KeyValue
            rows={[
              { k: "Typical monthly income", v: formatMoney(clarity.income.typical_monthly) },
              { k: "Essential commitments / month", v: formatMoney(clarity.commitments.monthly_essential) },
              { k: "Margin in a typical month", v: formatMoney(clarity.margin.typical) },
              { k: "Liquid cash vs your floor", v: `${formatMoney(clarity.cash.liquid_total)} vs ${formatMoney(clarity.cash.cash_floor)}` },
              { k: "Essential buffer", v: clarity.cash.essential_buffer_months ? `${clarity.cash.essential_buffer_months} months` : "—" },
              { k: "Lowest projected cash (90 days)", v: `${formatMoney(clarity.outlook.lowest_projected_cash)} on ${clarity.outlook.lowest_projected_date}` },
              { k: "Flags", v: clarity.flags.length ? clarity.flags.map((f) => labels[f.refs[0] ?? ""] ?? f.code.toLowerCase().replace(/_/g, " ")).slice(0, 4).join(", ") : "none" },
            ]}
          />
          <div className="mt-4 flex flex-wrap gap-3">
            <ButtonLink href="/demo/personal" variant="primary" size="md">
              Open my Overview <ArrowRight size={14} aria-hidden />
            </ButtonLink>
            <ButtonLink href="/demo/personal/next-steps" variant="secondary" size="md">
              See next steps
            </ButtonLink>
          </div>
        </Card>
      ) : null}
      <ActionForm action={refreshBaselineAction} submitLabel="Recompute" pendingLabel="Calling calculation service…" variant="ghost" size="sm" inline />
    </div>
  );
}
