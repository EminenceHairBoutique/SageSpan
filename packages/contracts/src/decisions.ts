import { z } from "zod";

/**
 * Recommendation / decision-proposal contract (V5 blueprint §5.5, §20).
 *
 * A recommendation is decision support, never an instruction and never a
 * verified fact. Every material one must cite the evidence it rests on and the
 * deterministic calculation run that produced any dollar amount. The server
 * sets workspace scope, authority tier, expiry and provenance; a language model
 * can only propose candidates, and the policy in decision-policy.ts decides
 * feasibility and order using versioned, testable rules.
 */
export const DECISION_TIERS = [0, 1, 2, 3, 4] as const;
export type DecisionTier = (typeof DECISION_TIERS)[number];

export const DECISION_TIER_LABELS: Record<DecisionTier, string> = {
  0: "Explain",
  1: "Low-risk guidance",
  2: "Material household choice",
  3: "Regulated / high-stakes advice",
  4: "Money movement / execution",
};

/** Tiers 3 and 4 are disabled in this build regardless of input (legal and release gates G4). */
export const ENABLED_TIERS: readonly DecisionTier[] = [0, 1, 2];

export const RECOMMENDATION_SCOPES = ["CASH_FLOW", "SPENDING", "DEBT", "SAVINGS_GOALS", "RETIREMENT", "DATA_QUALITY", "EDUCATION"] as const;
export type RecommendationScope = (typeof RECOMMENDATION_SCOPES)[number];

export const ACTION_AUTHORITIES = ["READ_ONLY", "USER_CONFIRMATION_REQUIRED", "PROFESSIONAL_REVIEW_SUGGESTED", "DISABLED_PENDING_RELEASE_GATE"] as const;
export type ActionAuthority = (typeof ACTION_AUTHORITIES)[number];

export const RECOMMENDATION_PRIORITIES = ["DO_THIS_NOW", "CONSIDER_NEXT", "REVISIT_LATER"] as const;
export type RecommendationPriority = (typeof RECOMMENDATION_PRIORITIES)[number];
export const PRIORITY_LABELS: Record<RecommendationPriority, string> = { DO_THIS_NOW: "Do this now", CONSIDER_NEXT: "Consider next", REVISIT_LATER: "Revisit later" };

export const ImpactSchema = z.object({
  /** Only deterministic tool output may carry a dollar figure; a model-origin impact is rejected server-side. */
  source: z.enum(["DETERMINISTIC_TOOL", "NOT_QUANTIFIED"]),
  unit: z.literal("USD").optional(),
  amount: z
    .string()
    .regex(/^-?\d+(\.\d+)?$/)
    .nullable()
    .optional(),
  description: z.string(),
  calculation_run_ref: z.string().nullable().optional(),
});
export type Impact = z.infer<typeof ImpactSchema>;

export const RecommendationSchema = z.object({
  recommendation_id: z.string().min(1),
  workspace_id: z.string().min(1),
  policy_version: z.string().min(1),
  scope: z.enum(RECOMMENDATION_SCOPES),
  classification: z.enum(["DECISION_SUPPORT", "EDUCATION", "DATA_REQUEST"]),
  tier: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  status: z.enum(["DRAFT_FOR_USER", "ACCEPTED", "DONE", "SNOOZED", "DISMISSED", "DISAGREED", "EXPIRED"]),
  priority: z.enum(RECOMMENDATION_PRIORITIES),
  title: z.string().min(1),
  /** What SageSpan observed (the triggering pattern) and the observation window. */
  observed: z.string().min(1),
  why_it_matters: z.string().min(1),
  /** The specific, feasible action. */
  action: z.string().min(1),
  evidence_refs: z.array(z.string()).default([]),
  calculation_refs: z.array(z.string()).default([]),
  prerequisites: z.array(z.string()).default([]),
  alternatives: z.array(z.string()).default([]),
  impact: ImpactSchema,
  tradeoffs: z.array(z.string()).default([]),
  /** Uncertainty expressed as input coverage and limitations, never a fabricated confidence percentage. */
  uncertainty: z.array(z.string()).default([]),
  what_would_change_this: z.array(z.string()).default([]),
  reversible: z.boolean(),
  action_authority: z.enum(ACTION_AUTHORITIES),
  created_by: z.enum(["POLICY_ENGINE", "AI_ASSISTED"]),
  /** Why this ranked above the alternatives, in policy terms. */
  ranking_rationale: z.string(),
  recheck_trigger: z.string().nullable().optional(),
  expires_at: z.string().nullable().optional(),
});
export type Recommendation = z.infer<typeof RecommendationSchema>;

export const USER_DECISIONS = ["DONE", "SNOOZE", "NOT_RELEVANT", "DISAGREE", "ASK_WHY", "ACCEPT"] as const;
export type UserDecisionKind = (typeof USER_DECISIONS)[number];

/** Feedback is a separate, append-only event. It never mutates a fact, a calculation run or a historic recommendation record. */
export interface UserDecisionEvent {
  id: string;
  workspace_id: string;
  recommendation_id: string;
  principal_id: string;
  decision: UserDecisionKind;
  note: string | null;
  created_at: string;
}

export function tierEnabled(tier: DecisionTier): boolean {
  return ENABLED_TIERS.includes(tier);
}

export function authorityForTier(tier: DecisionTier): ActionAuthority {
  if (tier === 0) return "READ_ONLY";
  if (tier === 1) return "USER_CONFIRMATION_REQUIRED";
  if (tier === 2) return "USER_CONFIRMATION_REQUIRED";
  return "DISABLED_PENDING_RELEASE_GATE";
}
