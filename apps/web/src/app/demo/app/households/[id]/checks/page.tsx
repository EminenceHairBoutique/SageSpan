import { notFound } from "next/navigation";
import { Play, Send } from "lucide-react";
import { can, latestCheckRuns } from "@sagespan/contracts";
import { getDemoActor } from "@/auth/actor";
import { householdBundle, householdOrNull, profileName } from "@/domain/queries";
import { getStore } from "@/domain/store";
import { calcHealth } from "@/provenance/calc-client";
import { runChecksAction, sendToReviewAction } from "@/server/actions";
import { ActionForm } from "@/ui/ActionForm";
import { CheckRunCard } from "@/ui/console/CheckRunCard";
import { CoveragePanel } from "@/ui/console/CoveragePanel";
import { Alert, Card, EmptyState, KeyValue, Mono } from "@/ui/primitives";

export const dynamic = "force-dynamic";

export default async function ChecksPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await getDemoActor();
  const state = getStore().read();
  if (!householdOrNull(state, actor.org_id, id)) notFound();
  const b = householdBundle(state, actor.org_id, id);
  const health = await calcHealth();
  const snap = b.currentSnapshot;
  const status = b.household.workflow_status;
  const runsForSnapshot = snap ? b.checkRuns.filter((r) => r.snapshot_id === snap.id) : [];
  const latestIds = new Set(snap ? latestCheckRuns(b.checkRuns, snap.id).latest.map((r) => r.id) : []);
  const canRun = can(actor.role, "check.run") && (status === "FROZEN" || status === "CHECK_COMPLETE");
  const runReason = !can(actor.role, "check.run") ? `Role ${actor.role} cannot run checks.` : status !== "FROZEN" && status !== "CHECK_COMPLETE" ? `Household is ${status.replace(/_/g, " ").toLowerCase()}; freeze a snapshot first.` : undefined;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card title="Independent RMD check" subtitle="Computed by the separate Python calculation service from the frozen snapshot only. The web application renders receipts; it never computes retirement math.">
          {snap ? (
            <KeyValue
              rows={[
                { k: "Snapshot", v: <Mono>{snap.id}</Mono> },
                { k: "Revision", v: snap.revision },
                { k: "Content SHA-256", v: <Mono>{snap.content_sha256}</Mono> },
                { k: "Frozen", v: `${snap.created_at.replace("T", " ").slice(0, 19)} UTC by ${profileName(state, snap.created_by)} (${snap.created_by_role})` },
                { k: "Facts in snapshot", v: snap.canonical_payload.facts.length },
                { k: "Rule sets (after run)", v: Object.keys(snap.rule_set_versions).length ? Object.entries(snap.rule_set_versions).map(([k, v]) => `${k}@${v}`).join(", ") : "— (set when a run completes)" },
              ]}
            />
          ) : (
            <EmptyState title="No frozen snapshot yet.">Resolve blockers on the Overview, then freeze the snapshot.</EmptyState>
          )}
          <div className="mt-4 flex flex-wrap gap-3">
            <ActionForm action={runChecksAction} hidden={{ household_id: id }} submitLabel={<><Play size={14} aria-hidden /> {runsForSnapshot.length ? "Re-run independent RMD check" : "Run independent RMD check"}</>} pendingLabel="Calling calculation service…" disabled={!canRun} disabledReason={runReason} inline />
            <ActionForm action={sendToReviewAction} hidden={{ household_id: id }} submitLabel={<><Send size={14} aria-hidden /> Send to review</>} disabled={status !== "CHECK_COMPLETE"} disabledReason={status !== "CHECK_COMPLETE" ? "Available once a check has completed." : undefined} successMessage="Sent to review." variant="secondary" inline />
          </div>
        </Card>
        <Card title="Calculation service" subtitle="Server-to-server; tenant context is set by this server, never by the browser.">
          {health.ok ? (
            <Alert tone="teal" title={`Reachable · engine ${health.engine_version}${health.demo_mode ? " · demo mode" : ""}`}>
              Rule registry and OpenAPI contract are served by the Python service.
            </Alert>
          ) : (
            <Alert tone="conflict" title="Unreachable">
              {health.message}. Running a check now will fail visibly; no amounts will be invented. Start it with <code>npm run dev:calc</code>.
            </Alert>
          )}
        </Card>
      </div>
      {snap && runsForSnapshot.length > 0 && (
        <Card title="Coverage on this snapshot" subtitle="Latest attempt per account. A re-run after a failure recovers; a failure after a success blocks. Earlier attempts are kept, never deleted.">
          <CoveragePanel b={b} />
        </Card>
      )}
      {runsForSnapshot.length > 0 ? (
        <div className="space-y-5">
          {[...runsForSnapshot].reverse().map((run) => (
            <div key={run.id} className={latestIds.has(run.id) ? undefined : "opacity-70"} data-latest-attempt={latestIds.has(run.id) ? "true" : "false"}>
              {!latestIds.has(run.id) && <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">Earlier attempt — kept as history, not evaluated for approval</p>}
              <CheckRunCard run={run} discrepancy={b.discrepancies.find((d) => d.check_run_id === run.id) ?? null} b={b} />
            </div>
          ))}
        </div>
      ) : (
        snap && <EmptyState title="No check runs for this snapshot yet.">Run the independent check to get a traceable receipt.</EmptyState>
      )}
      {b.checkRuns.some((r) => r.snapshot_id !== snap?.id) && (
        <details>
          <summary className="cursor-pointer text-sm font-medium text-navy">Earlier runs on superseded snapshots ({b.checkRuns.filter((r) => r.snapshot_id !== snap?.id).length})</summary>
          <div className="mt-3 space-y-4 opacity-80">
            {b.checkRuns
              .filter((r) => r.snapshot_id !== snap?.id)
              .map((run) => (
                <CheckRunCard key={run.id} run={run} discrepancy={b.discrepancies.find((d) => d.check_run_id === run.id) ?? null} b={b} />
              ))}
          </div>
        </details>
      )}
    </div>
  );
}
