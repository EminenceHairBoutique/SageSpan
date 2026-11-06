import Link from "next/link";
import { Lock, ShieldAlert, ShieldCheck } from "lucide-react";
import { can } from "@sagespan/contracts";
import type { Actor } from "@/auth/actor";
import type { FreezeGate } from "@/domain/freeze";
import { freezeSnapshotAction } from "@/server/actions";
import { ActionForm } from "@/ui/ActionForm";
import { Alert, Card, Chip } from "@/ui/primitives";

export function FreezeGatePanel({ gate, householdId, status, actor }: { gate: FreezeGate; householdId: string; status: string; actor: Actor }) {
  const canFreezeRole = can(actor.role, "snapshot.freeze");
  const ready = gate.canFreeze && status === "READY_TO_FREEZE";
  const disabledReason = !canFreezeRole ? `Role ${actor.role} cannot freeze snapshots.` : !gate.canFreeze ? `${gate.blockers.length} blocker${gate.blockers.length > 1 ? "s" : ""} must be resolved first.` : status !== "READY_TO_FREEZE" ? `Household is ${status.replace(/_/g, " ").toLowerCase()}; a new freeze needs reconciliation first.` : undefined;
  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          {gate.canFreeze ? <ShieldCheck size={18} className="text-teal" aria-hidden /> : <ShieldAlert size={18} className="text-conflict" aria-hidden />}
          Freeze gate
        </span>
      }
      subtitle="Fail-closed: material conflicts or missing required facts block an immutable snapshot."
      actions={
        <ActionForm action={freezeSnapshotAction} hidden={{ household_id: householdId }} submitLabel={<><Lock size={14} aria-hidden /> Freeze snapshot</>} pendingLabel="Freezing…" disabled={!ready || !canFreezeRole} disabledReason={disabledReason} inline />
      }
    >
      {gate.blockers.length === 0 ? (
        <Alert tone="teal" title="No blockers">
          All material facts required for the RMD check are confirmed (or satisfied by a documented assumption) and no conflicts are open.
        </Alert>
      ) : (
        <ol className="space-y-3">
          {gate.blockers.map((bl, i) => (
            <li key={i} className="rounded-lg border border-conflict/20 bg-conflict-100/40 p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Chip tone="conflict">{bl.code.replace(/_/g, " ").toLowerCase()}</Chip>
                <span className="font-semibold">{bl.subject_label}</span>
                {bl.field_key && <span className="text-xs text-ink-faint">{bl.field_key}</span>}
              </div>
              <p className="mt-1.5">{bl.message}</p>
              <p className="mt-1 text-ink-muted">
                <span className="font-medium text-ink">How to resolve:</span> {bl.how_to_resolve}
                {bl.conflict_id && (
                  <>
                    {" "}
                    <Link href={`/demo/app/households/${householdId}/review#${bl.conflict_id}`} className="font-medium text-navy underline-offset-2 hover:underline">
                      Open conflict →
                    </Link>
                  </>
                )}
              </p>
            </li>
          ))}
        </ol>
      )}
      {gate.warnings.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-ink-muted">
          {gate.warnings.map((w, i) => (
            <li key={i}>• {w}</li>
          ))}
        </ul>
      )}
      <details className="mt-4 text-sm">
        <summary className="cursor-pointer font-medium text-navy">Required facts for the RMD check ({gate.required.filter((r) => r.status === "SATISFIED" || r.status === "ASSUMED").length}/{gate.required.length} satisfied)</summary>
        <ul className="mt-2 grid gap-1 sm:grid-cols-2">
          {gate.required.map((r, i) => (
            <li key={i} className="flex items-center justify-between gap-2 rounded border border-line px-2 py-1 text-xs">
              <span>
                {r.label} · <span className="text-ink-muted">{r.subject_label}</span>
              </span>
              <Chip tone={r.status === "SATISFIED" ? "teal" : r.status === "ASSUMED" ? "slate" : r.status === "CONFLICT" ? "conflict" : "amber"}>{r.status.toLowerCase()}</Chip>
            </li>
          ))}
        </ul>
      </details>
    </Card>
  );
}
