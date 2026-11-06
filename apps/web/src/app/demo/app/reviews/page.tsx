import Link from "next/link";
import { QUEUE_FILTERS, WORKFLOW_LABELS, type QueueFilter, type WorkflowStatus } from "@sagespan/contracts";
import { getDemoActor } from "@/auth/actor";
import { getStore } from "@/domain/store";
import { listHouseholds, profileName } from "@/domain/queries";
import { Card, Chip, EmptyState, Td, Th, WorkflowChip, cx } from "@/ui/primitives";

export const dynamic = "force-dynamic";

export default async function ReviewsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const actor = await getDemoActor();
  const state = getStore().read();
  const filter = (typeof sp.status === "string" && sp.status in QUEUE_FILTERS ? sp.status : "all") as QueueFilter | "all";
  const assignee = typeof sp.assignee === "string" ? sp.assignee : "";
  const sort = sp.sort === "household" ? "household" : "updated";

  let rows = listHouseholds(state, actor.org_id);
  if (filter !== "all") rows = rows.filter((h) => (QUEUE_FILTERS[filter] as readonly WorkflowStatus[]).includes(h.workflow_status));
  if (assignee === "me") rows = rows.filter((h) => h.assignee_user_id === actor.user_id);
  else if (assignee === "unassigned") rows = rows.filter((h) => !h.assignee_user_id);
  else if (assignee) rows = rows.filter((h) => h.assignee_user_id === assignee);
  rows = [...rows].sort((a, b) => (sort === "household" ? a.label.localeCompare(b.label) : b.updated_at.localeCompare(a.updated_at)));

  const members = state.memberships.filter((m) => m.org_id === actor.org_id && m.status === "ACTIVE");
  const counts = {
    all: listHouseholds(state, actor.org_id).length,
    blocked: listHouseholds(state, actor.org_id).filter((h) => h.workflow_status === "BLOCKED").length,
    pending: listHouseholds(state, actor.org_id).filter((h) => (QUEUE_FILTERS.pending as readonly WorkflowStatus[]).includes(h.workflow_status)).length,
    reviewed: listHouseholds(state, actor.org_id).filter((h) => (QUEUE_FILTERS.reviewed as readonly WorkflowStatus[]).includes(h.workflow_status)).length,
  };
  const link = (patch: Record<string, string>) => {
    const q = new URLSearchParams({ status: filter, assignee, sort, ...patch });
    for (const [k, v] of [...q.entries()]) if (!v || v === "all") q.delete(k);
    const s = q.toString();
    return `/demo/app/reviews${s ? `?${s}` : ""}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Review queue</h1>
        <p className="mt-1 text-sm text-ink-muted">Households with an active assurance record in your organisation. Status and history are server-authoritative.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {(["all", "blocked", "pending", "reviewed"] as const).map((f) => (
          <Link key={f} href={link({ status: f })} className={cx("rounded-full border px-3 py-1 text-sm font-medium", filter === f ? "border-navy bg-navy text-white" : "border-line bg-surface text-ink-muted hover:text-ink")} aria-current={filter === f ? "page" : undefined}>
            {f === "all" ? "All" : f[0]!.toUpperCase() + f.slice(1)} <span className="opacity-70">({counts[f]})</span>
          </Link>
        ))}
        <span className="mx-2 hidden h-5 w-px bg-line sm:block" />
        <form method="get" className="flex items-center gap-2 text-sm">
          <input type="hidden" name="status" value={filter} />
          <input type="hidden" name="sort" value={sort} />
          <label htmlFor="assignee" className="text-ink-muted">
            Assignee
          </label>
          <select id="assignee" name="assignee" defaultValue={assignee} className="rounded-lg border border-line-strong bg-surface px-2 py-1 text-sm">
            <option value="">Anyone</option>
            <option value="me">Me</option>
            <option value="unassigned">Unassigned</option>
            {members.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {profileName(state, m.user_id)}
              </option>
            ))}
          </select>
          <button type="submit" className="rounded-lg border border-line-strong px-2 py-1 text-sm hover:bg-surface-muted">
            Apply
          </button>
        </form>
        <Link href={link({ sort: sort === "updated" ? "household" : "updated" })} className="ml-auto text-sm text-navy underline-offset-2 hover:underline">
          Sort by {sort === "updated" ? "household" : "last update"}
        </Link>
      </div>
      <Card className="overflow-hidden" title={`${rows.length} household${rows.length === 1 ? "" : "s"}`} subtitle="Exceptions = open conflicts + open discrepancies.">
        {rows.length === 0 ? (
          <EmptyState title="No households match this filter.">Adjust the status or assignee filter.</EmptyState>
        ) : (
          <div className="-mx-5 overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead className="border-b border-line bg-surface-muted/60">
                <tr>
                  <Th>Household</Th>
                  <Th>Source tool</Th>
                  <Th>Status</Th>
                  <Th>Exceptions</Th>
                  <Th>Assignee</Th>
                  <Th>Tax year</Th>
                  <Th>Last update</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((h) => {
                  const openConflicts = state.fact_conflicts.filter((c) => c.household_id === h.id && c.status === "OPEN");
                  const runIds = new Set(state.check_runs.filter((r) => r.household_id === h.id).map((r) => r.id));
                  const openDisc = state.discrepancies.filter((d) => runIds.has(d.check_run_id) && d.status === "OPEN");
                  return (
                    <tr key={h.id} className="hover:bg-surface-muted/40">
                      <Td>
                        <Link href={`/demo/app/households/${h.id}`} className="font-semibold text-navy hover:underline">
                          {h.label}
                        </Link>
                        <div className="text-xs text-ink-faint">rev {h.current_revision}</div>
                      </Td>
                      <Td>{h.source_tool_label ?? <span className="text-ink-faint">—</span>}</Td>
                      <Td>
                        <WorkflowChip status={h.workflow_status} />
                      </Td>
                      <Td>
                        <div className="flex flex-wrap gap-1">
                          {openConflicts.length > 0 && <Chip tone="conflict">{openConflicts.length} conflict{openConflicts.length > 1 ? "s" : ""}</Chip>}
                          {openDisc.length > 0 && <Chip tone="amber">{openDisc.length} discrepanc{openDisc.length > 1 ? "ies" : "y"}</Chip>}
                          {openConflicts.length === 0 && openDisc.length === 0 && <span className="text-xs text-ink-faint">none</span>}
                        </div>
                      </Td>
                      <Td>{profileName(state, h.assignee_user_id)}</Td>
                      <Td>{h.tax_year}</Td>
                      <Td>
                        <time dateTime={h.updated_at}>{h.updated_at.slice(0, 10)}</time>
                        <div className="text-xs text-ink-faint">{WORKFLOW_LABELS[h.workflow_status]}</div>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
