import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

const ALLOWED = new Set(["patel_plan_export_2026.json", "okafor_plan_export_2026.json", "bauer_plan_export_2026.json", "reyes_plan_export_2026.csv", "reyes_custodian_statement_2025-12-31.json", "unsupported_vendor_sample.csv"]);

/** Serves the synthetic sample import files from fixtures/synthetic/imports (allow-listed names only). */
export async function GET(_req: Request, ctx: { params: Promise<{ name: string }> }) {
  const { name } = await ctx.params;
  if (!ALLOWED.has(name)) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Unknown sample" } }, { status: 404 });
  const file = path.resolve(process.cwd(), "../../fixtures/synthetic/imports", name);
  try {
    const body = await readFile(file);
    return new NextResponse(body, {
      headers: {
        "content-type": name.endsWith(".json") ? "application/json; charset=utf-8" : "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${name}"`,
        "cache-control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: { code: "NOT_AVAILABLE", message: "Sample files are not bundled in this deployment." } }, { status: 404 });
  }
}
