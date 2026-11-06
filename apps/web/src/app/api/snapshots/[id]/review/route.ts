import { NextResponse } from "next/server";
import { z } from "zod";
import { getDemoActor } from "@/auth/actor";
import { errorResult } from "@/domain/errors";
import { attemptApproval, recordReview } from "@/domain/review";
import { getStore } from "@/domain/store";

const Body = z.object({
  decision: z.enum(["REVIEWED", "APPROVED"]),
  rationale: z.string().default(""),
  conflict_attestation: z.boolean().default(false),
});

/**
 * Authorised review status change for a snapshot. The actor (identity, org,
 * role) is resolved on the server; a request from a role without approval
 * permission is rejected with 403 even if the client forges the body.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const actor = await getDemoActor();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: { code: "VALIDATION", message: "Invalid body" } }, { status: 400 });
  const store = getStore();
  const state = store.read();
  const snap = state.snapshots.find((s) => s.id === id && s.org_id === actor.org_id);
  if (!snap) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Not found" } }, { status: 404 });
  try {
    const review = parsed.data.decision === "APPROVED" ? attemptApproval(store, actor, snap.household_id, { rationale: parsed.data.rationale, conflictAttestation: parsed.data.conflict_attestation }) : store.mutate((s) => recordReview(s, actor, snap.household_id, parsed.data.rationale));
    return NextResponse.json({ review });
  } catch (e) {
    const r = errorResult(e);
    const status = r.code === "PERMISSION_DENIED" || r.code === "NOT_AN_APPROVER" || r.code === "SEPARATION_OF_DUTIES" ? 403 : r.code === "NOT_FOUND" ? 404 : 409;
    return NextResponse.json({ error: r }, { status });
  }
}
