import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { getDemoActor } from "@/auth/actor";
import { getStore } from "@/domain/store";
import { householdOrNull, profileName } from "@/domain/queries";
import { Checkpoints } from "@/ui/console/Checkpoints";
import { HouseholdTabs } from "@/ui/console/HouseholdTabs";
import { WorkflowChip } from "@/ui/primitives";

export const dynamic = "force-dynamic";

export default async function HouseholdLayout({ params, children }: { params: Promise<{ id: string }>; children: ReactNode }) {
  const { id } = await params;
  const actor = await getDemoActor();
  const state = getStore().read();
  const hh = householdOrNull(state, actor.org_id, id);
  if (!hh) notFound();
  return (
    <div className="space-y-5">
      <nav className="text-xs text-ink-muted" aria-label="Breadcrumb">
        <Link href="/demo/app/reviews" className="hover:text-navy">
          Review queue
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-ink">{hh.label}</span>
      </nav>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold">{hh.label}</h1>
            <WorkflowChip status={hh.workflow_status} />
          </div>
          <p className="mt-1 text-sm text-ink-muted">
            Tax year {hh.tax_year} · revision {hh.current_revision} · assignee {profileName(state, hh.assignee_user_id)} · source {hh.source_tool_label ?? "—"}
          </p>
        </div>
        <Checkpoints status={hh.workflow_status} />
      </div>
      <HouseholdTabs id={hh.id} />
      {children}
    </div>
  );
}
