import { AI_FORBIDDEN_TOOLS, AI_TOOLS, AI_TOOL_ARG_SCHEMAS, DEFAULT_AI_RUN_BUDGET, EXECUTABLE_SCENARIO_KINDS, type AiToolName, type ScenarioProposal } from "@sagespan/contracts";
import { canonicalJson } from "@sagespan/contracts";
import { sha256 } from "@/domain/audit";
import type { GroundingContext } from "./evidence-resolver";

/**
 * Allowlisted, read-only tool dispatcher. Every tool operates on the already
 * authorised GroundingContext and nothing else: there is no store handle, no
 * network, no mutation surface here by construction. Unknown or forbidden tool
 * names are denied and logged; they are never executed.
 *
 * AI-CORE-001: arguments are validated against the exact per-tool schema in
 * `AI_TOOL_ARG_SCHEMAS` (strict objects). A model cannot pass `org_id`,
 * `workspace_id`, a URL or any key the tool does not declare — such a request
 * is `BAD_ARGS` and nothing runs. The dispatcher stays single-call and
 * stateless; budgets, de-duplication and re-authorisation live in the runtime.
 */
export type ToolDispatch =
  | { status: "OK"; tool: AiToolName; args_digest: string; result_digest: string; result: unknown }
  | { status: "DENIED"; tool: string; reason: "FORBIDDEN_TOOL" | "UNKNOWN_TOOL" | "BAD_ARGS"; args_digest: string };

/** Per-run tool-call ceiling; the runtime enforces it BEFORE dispatching anything. */
export const MAX_TOOL_CALLS_PER_RUN = DEFAULT_AI_RUN_BUDGET.max_tool_calls;

function digest(value: unknown): string {
  return sha256(canonicalJson(value ?? null));
}

export function dispatchTool(ctx: GroundingContext, tool: string, args: Record<string, unknown> = {}): ToolDispatch {
  const args_digest = digest(args);
  if ((AI_FORBIDDEN_TOOLS as readonly string[]).includes(tool)) return { status: "DENIED", tool, reason: "FORBIDDEN_TOOL", args_digest };
  if (!(AI_TOOLS as readonly string[]).includes(tool)) return { status: "DENIED", tool, reason: "UNKNOWN_TOOL", args_digest };
  const name = tool as AiToolName;
  const parsedArgs = AI_TOOL_ARG_SCHEMAS[name].safeParse(args);
  if (!parsedArgs.success) return { status: "DENIED", tool, reason: "BAD_ARGS", args_digest };
  let result: unknown;
  switch (name) {
    case "read_facts": {
      const { ids } = parsedArgs.data as { ids?: string[] };
      result = ctx.facts.filter((f) => !ctx.superseded_fact_ids.has(f.id) && (ids === undefined || ids.includes(f.id)));
      break;
    }
    case "read_evidence": {
      const { document_id } = parsedArgs.data as { document_id: string };
      const doc = ctx.documents.find((d) => d.id === document_id);
      // A foreign or unknown id is a non-disclosing not-found; nothing outside the context exists here.
      result = doc ? { ...doc, snippets: ctx.untrusted.filter((u) => u.source_id === document_id).map((u) => ({ locator: u.locator, text: u.text, untrusted: true })) } : { not_found: true };
      break;
    }
    case "get_check_runs":
      result = ctx.check_runs;
      break;
    case "read_personal_baseline":
      result = ctx.personal ? { headline: ctx.personal.headline, flags: ctx.personal.flags, data_quality: ctx.personal.data_quality, collisions: ctx.personal.collisions, labels: ctx.personal.labels, clarity_run_id: ctx.personal.clarity_run_id, debt_run_id: ctx.personal.debt_run_id } : { not_found: true };
      break;
    case "propose_scenario": {
      const a = parsedArgs.data as { kind: ScenarioProposal["kind"]; title?: string; rationale?: string; parameters?: ScenarioProposal["parameters"] };
      const executable = (EXECUTABLE_SCENARIO_KINDS as readonly string[]).includes(a.kind);
      const proposal: ScenarioProposal = {
        proposal_id: `sp_${args_digest.slice(0, 16)}`,
        kind: a.kind,
        title: a.title ?? `Proposed ${a.kind.toLowerCase().replace(/_/g, " ")}`,
        rationale: a.rationale ?? "Proposed for the user's confirmation.",
        parameters: a.parameters ?? {},
        status: "PROPOSED_NOT_AUTHORITATIVE",
        executable_now: executable,
        // No retirement projection engine exists (PLAN-001 / SCENARIO-001); the proposal says so instead of pretending.
        engine_required: a.kind === "DEBT_EXTRA_PAYMENT" ? "personal.debt_amortization" : executable ? "personal.cashflow_scenario" : "PLAN-001 (not implemented)",
      };
      result = proposal;
      break;
    }
  }
  return { status: "OK", tool: name, args_digest, result_digest: digest(result), result };
}
