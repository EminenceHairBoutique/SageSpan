import { formatMoney } from "@sagespan/contracts";
import { Money } from "@/ui/personal/components";
import { AddRecord, EditRecord, GoalFields } from "@/ui/personal/RecordForms";
import { Alert, Card, Chip, KeyValue } from "@/ui/primitives";
import { loadPersonal } from "../load";

export const dynamic = "force-dynamic";

export default async function GoalsPage() {
  const { b, insights, labels } = await loadPersonal({ ensureBaseline: true });
  const { clarity, clarityRun } = insights;
  const summaries = new Map(clarity?.goals.map((g) => [g.goal_ref, g]) ?? []);
  const isOwner = b.membership.role === "OWNER";
  const accountOptions = b.cashAccounts.map((a) => ({ ref: a.account_ref, label: a.label }));
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal">Goals</p>
        <h1 className="mt-1 text-2xl font-bold">Goals, at your pace</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-muted">Progress is arithmetic on what you saved and what you said you would contribute. A goal behind its date is information, not a judgement: change the date, the pace or the target.</p>
      </div>
      {!clarity && <Alert tone="conflict" title="No baseline available">Progress figures need the calculation service.</Alert>}
      <div className="grid gap-4 md:grid-cols-2">
        {b.goals.map((g) => {
          const s = summaries.get(g.id);
          return (
            <Card key={g.id} title={g.label} subtitle={g.kind.toLowerCase().replace(/_/g, " ")} actions={s?.on_track_for_target_date === false ? <Chip tone="amber">Behind target date</Chip> : s?.on_track_for_target_date ? <Chip tone="teal">On track</Chip> : null}>
              <KeyValue
                rows={[
                  { k: "Target", v: formatMoney(g.target_amount) },
                  { k: "Saved", v: formatMoney(g.saved_amount) + (g.funded_from_account_id ? ` (in ${labels[g.funded_from_account_id] ?? g.funded_from_account_id})` : "") },
                  { k: "Remaining", v: s ? <Money value={s.remaining_amount} run={clarityRun} label={`${g.label}: remaining`} field="goals[].remaining_amount" /> : "—" },
                  { k: "Monthly contribution", v: g.monthly_contribution ? formatMoney(g.monthly_contribution) : "not set" },
                  { k: "Months at this pace", v: s?.months_to_target_at_contribution ?? "—" },
                  { k: "Target date", v: g.target_date ?? "none" },
                ]}
              />
              {isOwner && (
                <EditRecord type="GOAL" recordRef={g.id} name={g.label}>
                  <GoalFields r={g} accounts={accountOptions} />
                </EditRecord>
              )}
            </Card>
          );
        })}
        {isOwner && (
          <Card title="Add a goal" subtitle="A target, what is saved, and the pace you choose.">
            <AddRecord type="GOAL" title="Add a goal">
              <GoalFields accounts={accountOptions} />
            </AddRecord>
          </Card>
        )}
        <Card title="Shared household goals" subtitle="Proposed">
          <p className="text-sm text-ink-muted">Sam Rivera has been invited to this workspace with access to <strong>goals only</strong>. Until the invitation is accepted and the consent model is finished (PR-003 / DATA-001), no record is shared. Participants will never see cash, spending or debt unless you grant that domain explicitly.</p>
        </Card>
      </div>
    </div>
  );
}
