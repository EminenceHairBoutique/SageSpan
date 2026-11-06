import { NextResponse } from "next/server";
import { getDemoActor } from "@/auth/actor";
import { factsCsv, renderPacketHtml } from "@/domain/evidence";
import { householdOrNull } from "@/domain/queries";
import { getStore } from "@/domain/store";

/** Download an evidence packet (JSON, HTML or facts CSV). Tenant-scoped: other organisations' packets are not found. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string; packetId: string }> }) {
  const { id, packetId } = await ctx.params;
  const actor = await getDemoActor();
  const state = getStore().read();
  if (!householdOrNull(state, actor.org_id, id)) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Not found" } }, { status: 404 });
  const packet = state.evidence_packets.find((p) => p.id === packetId && p.org_id === actor.org_id && p.household_id === id);
  if (!packet) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Not found" } }, { status: 404 });
  const format = new URL(req.url).searchParams.get("format") ?? "json";
  const base = `evidence-packet-${packet.household_id}-rev${state.snapshots.find((s) => s.id === packet.snapshot_id)?.revision ?? "x"}`;
  if (format === "html") {
    return new NextResponse(renderPacketHtml(packet), { headers: { "content-type": "text/html; charset=utf-8", "content-disposition": `attachment; filename="${base}.html"`, "cache-control": "no-store", "x-packet-sha256": packet.sha256 } });
  }
  if (format === "csv") {
    return new NextResponse(factsCsv(packet), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${base}-facts.csv"`, "cache-control": "no-store" } });
  }
  return new NextResponse(JSON.stringify({ packet_sha256: packet.sha256, packet_id: packet.id, packet: packet.packet }, null, 2), { headers: { "content-type": "application/json; charset=utf-8", "content-disposition": `attachment; filename="${base}.json"`, "cache-control": "no-store", "x-packet-sha256": packet.sha256 } });
}
