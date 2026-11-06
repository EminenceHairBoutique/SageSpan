import { AI_FORBIDDEN_TOOLS, AI_TOOLS, EXECUTABLE_SCENARIO_KINDS, SCENARIO_KINDS, type AiToolName, type ScenarioProposal } from "@sagespan/contracts";
import { canonicalJson } from "@sagespan/contracts";
import { sha256 } from "@/domain/audit";
import type { GroundingContext } from "./evidence-resolver";

/**
 * Allowlisted, read-only tool dispatcher. Every tool operates on the already
 * authorised GroundingContext and nothing else: there is no store handle, no
 * network, no mutation surface here by construction. Unknown or forbidden tool
 * names are denied and logged; they are never executed.
 */
export type ToolDispatch =
  | { status: "OK"; tool: AiToolName; args_digest: string; result_digest: string; result: unknown }
  | { status: "DENIED"; tool: string; reason: "FORBIDDEN_TOOL" | "UNKNOWN_TOOL" | "BAD_ARGS"; args_digest: string };

export const MAX_TOOL_CALLS_PER_RUN = 10;

function digest(value: unknown): string {
  return sha256(canonicalJson(value ?? null));
}

export function dispatchTool(ctx: GroundingContext, tool: string, args: Record<string, unknown> = {}): ToolDispatch {
  const args_digest = digest(args);
  if ((AI_FORBIDDEN_TOOLS as readonly string[]).includes(tool)) return { status: "DENIED", tool, reason: "FORBIDDEN_TOOL", args_digest };
  if (!(AI_TOOLS as readonly string[]).includes(tool)) return { status: "DENIED", tool, reason: "UNKNOWN_TOOL", args_digest };
  const name = tool as AiToolName;
  let result: unknown;
  switch (name) {
    case "read_facts": {
      const ids = Array.isArray(args.ids) ? (args.ids as unknown[]).filter((x): x is string => typeof x === "string") : null;
      result = ctx.facts.filter((f) => !ctx.superseded_fact_ids.has(f.id) && (ids === null || ids.includes(f.id)));
      break;
    }
    case "read_evidence": {
      const id = typeof args.document_id === "string" ? args.document_id : null;
      if (!id) return { status: "DENIED", tool, reason: "BAD_ARGS", args_digest };
      const doc = ctx.documents.find((d) => d.id === id);
      result = doc ? { ...doc, snippets: ctx.untrusted.filter((u) => u.source_id === id).map((u) => ({ locator: u.locator, text: u.text, untrusted: true })) } : { not_found: true };
      break;
    }
    case "get_check_runs":
      result = ctx.check_runs;
      break;
    case "read_personal_baseline":
      result = ctx.personal ? { headline: ctx.personal.headline, flags: ctx.personal.flags, data_quality: ctx.personal.data_quality, clarity_run_id: ctx.personal.clarity_run_id, debt_run_id: ctx.personal.debt_run_id } : { not_found: true };
      break;
    case "propose_scenario": {
      const kind = typeof args.kind === "string" ? args.kind : "";
      if (!(SCENARIO_KINDS as readonly string[]).includes(kind)) return { status: "DENIED", tool, reason: "BAD_ARGS", args_digest };
      const proposal: ScenarioProposal = {
        proposal_id: `sp_${args_digest.slice(0, 16)}`,
        kind: kind as ScenarioProposal["kind"],
        title: typeof args.title === "string" ? args.title.slice(0, 160) : `Proposed ${kind.toLowerCase().replace(/_/g, " ")}`,
        rationale: typeof args.rationale === "string" ? args.rationale.slice(0, 1000) : "Proposed for the user's confirmation.",
        parameters: Object.fromEntries(Object.entries((args.parameters as Record<string, unknown>) ?? {}).filter(([, v]) => ["string", "number", "boolean"].includes(typeof v))) as ScenarioProposal["parameters"],
        status: "PROPOSED_NOT_AUTHORITATIVE",
        executable_now: (EXECUTABLE_SCENARIO_KINDS as readonly string[]).includes(kind),
        engine_required: kind === "DEBT_EXTRA_PAYMENT" ? "personal.debt_amortization" : (EXECUTABLE_SCENARIO_KINDS as readonly string[]).includes(kind) ? "personal.cashflow_scenario" : "PLAN-001 (not implemented)",
      };
      result = proposal;
      break;
    }
  }
  return { status: "OK", tool: name, args_digest, result_digest: digest(result), result };
}
