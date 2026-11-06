import { z } from "zod";

/**
 * AI finding vocabulary (V5 §18.2). Categories separate missing evidence,
 * observed discrepancies, likely risks and plain hypotheses. Severity is a
 * policy classification, never model confidence.
 */
export const AI_FINDING_CATEGORIES = ["MISSING_EVIDENCE", "CONFLICTING_FACTS", "STALE_EVIDENCE", "CHECK_DISCREPANCY", "UNSUPPORTED_CHECK", "ASSUMPTION_RISK", "FOLLOWUP_QUESTION", "HYPOTHESIS", "PATTERN_OBSERVATION", "EDUCATION"] as const;
export type AiFindingCategory = (typeof AI_FINDING_CATEGORIES)[number];

export const AI_FINDING_CATEGORY_LABELS: Record<AiFindingCategory, string> = {
  MISSING_EVIDENCE: "Missing evidence",
  CONFLICTING_FACTS: "Conflicting facts",
  STALE_EVIDENCE: "Stale evidence",
  CHECK_DISCREPANCY: "Check discrepancy",
  UNSUPPORTED_CHECK: "Unsupported check",
  ASSUMPTION_RISK: "Assumption risk",
  FOLLOWUP_QUESTION: "Follow-up question",
  HYPOTHESIS: "Hypothesis",
  PATTERN_OBSERVATION: "Pattern observation",
  EDUCATION: "Explanation",
};

export const AI_SEVERITIES = ["INFO", "LOW", "MEDIUM", "HIGH"] as const;
export type AiSeverity = (typeof AI_SEVERITIES)[number];

/**
 * Evidence status of a finding. VERIFIED is deliberately absent: a model can
 * never set it. A finding is UNVERIFIED until a human acts on it, and
 * TOOL_BACKED only when every amount it carries came from a cited calculation
 * run (checked by the validator, not asserted by the model).
 */
export const AI_EVIDENCE_STATUSES = ["UNVERIFIED", "TOOL_BACKED", "HYPOTHESIS"] as const;
export type AiEvidenceStatus = (typeof AI_EVIDENCE_STATUSES)[number];

export const DocumentRefSchema = z.strictObject({
  id: z.string().min(1),
  /** Page/row/pointer locator inside the document, in the resolver's vocabulary (e.g. "page 2", "row 14", "/accounts/0/balance"). */
  locator: z.string().min(1).max(200),
});
export type DocumentRef = z.infer<typeof DocumentRefSchema>;

/** A dollar amount a finding mentions MUST cite the run it came from. */
export const CitedAmountSchema = z.strictObject({
  amount: z.string().regex(/^-?\d+(\.\d+)?$/),
  currency: z.string().length(3).default("USD"),
  check_run_ref: z.string().min(1),
  field: z.string().min(1).max(80),
});
export type CitedAmount = z.infer<typeof CitedAmountSchema>;

export const AiFindingSchema = z.strictObject({
  finding_id: z.string().min(1),
  category: z.enum(AI_FINDING_CATEGORIES),
  severity: z.enum(AI_SEVERITIES),
  title: z.string().min(1).max(160),
  explanation: z.string().min(1).max(2000),
  fact_refs: z.array(z.string().min(1)).default([]),
  document_refs: z.array(DocumentRefSchema).default([]),
  check_run_refs: z.array(z.string().min(1)).default([]),
  cited_amounts: z.array(CitedAmountSchema).default([]),
  evidence_status: z.enum(AI_EVIDENCE_STATUSES),
  suggested_next_action: z.string().min(1).max(400).nullable(),
  /** Question the reviewer/user should answer to resolve the finding, if any. */
  question: z.string().max(400).nullable().optional(),
});
export type AiFinding = z.infer<typeof AiFindingSchema>;
