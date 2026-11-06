import { z } from "zod";

/**
 * `propose_scenario` output: a NON-AUTHORITATIVE draft the user or advisor
 * confirms before any engine runs. `run_supported_projection` is not an
 * available tool in this build because no retirement projection engine
 * (PLAN-001 / SCENARIO-001) exists yet; the registry refuses it rather than
 * pretending a model exists.
 */
export const SCENARIO_KINDS = ["DEBT_EXTRA_PAYMENT", "SPENDING_CHANGE", "SAVINGS_CHANGE", "INCOME_INTERRUPTION", "RETIREMENT_DATE_CHANGE", "RETURN_ASSUMPTION_CHANGE"] as const;
export type ScenarioKind = (typeof SCENARIO_KINDS)[number];

/** Which scenario kinds a deterministic engine can execute today. Others are proposals only. */
export const EXECUTABLE_SCENARIO_KINDS: readonly ScenarioKind[] = ["DEBT_EXTRA_PAYMENT"];

export const ScenarioProposalSchema = z.strictObject({
  proposal_id: z.string().min(1),
  kind: z.enum(SCENARIO_KINDS),
  title: z.string().min(1).max(160),
  rationale: z.string().min(1).max(1000),
  /** Typed parameters; amounts are decimal strings chosen by the proposer, to be confirmed by the user. */
  parameters: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
  status: z.literal("PROPOSED_NOT_AUTHORITATIVE"),
  executable_now: z.boolean(),
  engine_required: z.string().nullable(),
});
export type ScenarioProposal = z.infer<typeof ScenarioProposalSchema>;
