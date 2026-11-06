import { NextResponse } from "next/server";
import { getDemoActor } from "@/auth/actor";
import { evaluateGateFromBundle } from "@/domain/freeze";
import { householdBundle, householdOrNull } from "@/domain/queries";
import { getStore } from "@/domain/store";

/** Fact provenance and conflict status for a household (tenant-scoped; server-resolved organisation). */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const actor = await getDemoActor();
  const state = getStore().read();
  if (!householdOrNull(state, actor.org_id, id)) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Not found" } }, { status: 404 });
  const b = householdBundle(state, actor.org_id, id);
  const gate = evaluateGateFromBundle(b);
  return NextResponse.json({
    household: { id: b.household.id, label: b.household.label, workflow_status: b.household.workflow_status, revision: b.household.current_revision },
    facts: b.activeFacts,
    conflicts: b.conflicts,
    freeze_gate: { can_freeze: gate.canFreeze, blockers: gate.blockers },
    actor: { user_id: actor.user_id, org_id: actor.org_id, role: actor.role, actor_type: actor.actor_type },
  });
}
