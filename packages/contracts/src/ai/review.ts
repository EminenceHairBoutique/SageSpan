import { z } from "zod";
import { AiFindingSchema } from "./findings";
import type { AiRuntimeTrace } from "./runtime";

/**
 * Versioned AI review contract (V5 §18.2, Engineering Prompt Annex B).
 *
 * Trust rule: tenant/workspace scope, authorising principal, consent, the set
 * of citable source ids and the authoritative model metadata come from the
 * server. The model proposes an `AiModelOutput`; the server validates it into an
 * `AiReviewReport` and persists an immutable `AiRunRecord`. Reviewer feedback is
 * a separate append-only record and never edits the model output.
 */
export const AI_REVIEW_SCHEMA_VERSION = "ai-review-v1" as const;

export const AI_ANALYSIS_KINDS = ["RETIREMENT_PLAN_REVIEW", "PERSONAL_FINANCES_UNDERSTAND", "EXPLAIN"] as const;
export type AiAnalysisKind = (typeof AI_ANALYSIS_KINDS)[number];

/** Allowlisted read-only tools. Nothing here mutates, approves, verifies, transacts or escapes the authorised scope. */
export const AI_TOOLS = ["read_facts", "read_evidence", "get_check_runs", "read_personal_baseline", "propose_scenario"] as const;
export type AiToolName = (typeof AI_TOOLS)[number];

/** Explicitly denied as tools, whatever a prompt or document says. Kept as data so tests and the dispatcher share one list. */
export const AI_FORBIDDEN_TOOLS = ["transition_household", "append_audit", "confirm_fact", "record_review", "approve", "update_policy", "run_sql", "http_post", "send_message", "move_money", "place_trade", "delete_document", "run_supported_projection"] as const;

/** Model-facing status vocabulary. Only drafts and hypotheses exist; APPROVED/VERIFIED are rejected by the validator. */
export const AI_REPORT_STATUSES = ["DRAFT_FOR_HUMAN_REVIEW"] as const;

export const AiReviewRequestSchema = z.strictObject({
  schema_version: z.literal(AI_REVIEW_SCHEMA_VERSION),
  analysis_kind: z.enum(AI_ANALYSIS_KINDS),
  /** Firm context: household + frozen snapshot. Personal context: workspace + personal snapshot. Both are server-resolved. */
  scope: z.discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("FIRM_HOUSEHOLD"), org_id: z.string().min(1), household_id: z.string().min(1), snapshot_id: z.string().min(1).nullable() }),
    z.strictObject({ kind: z.literal("PERSONAL_WORKSPACE"), workspace_id: z.string().min(1), snapshot_id: z.string().min(1).nullable() }),
  ]),
  requested_by_principal_id: z.string().min(1),
  purpose: z.string().min(1).max(200),
});
export type AiReviewRequest = z.infer<typeof AiReviewRequestSchema>;

/** What the (mock or live) model returns. Deliberately permissive on `status` and amounts so the validator can reject bad values explicitly. */
export const AiModelOutputSchema = z.object({
  schema_version: z.string(),
  status: z.string(),
  findings: z.array(z.unknown()),
  summary: z.string().max(4000).optional(),
  draft_memo: z.string().max(8000).optional(),
  questions: z.array(z.string().max(400)).optional(),
  limitations: z.array(z.string().max(400)).optional(),
  /** Any tool calls the model asked for. The dispatcher authorises each one independently. */
  tool_calls: z.array(z.object({ call_id: z.string().min(1).max(80).optional(), tool: z.string(), args: z.record(z.string(), z.unknown()).optional() })).optional(),
  /** A model may try to supply these; the server ignores them and uses its own. */
  org_id: z.string().optional(),
  workspace_id: z.string().optional(),
});
export type AiModelOutput = z.infer<typeof AiModelOutputSchema>;

export const AiModelMetadataSchema = z.strictObject({
  provider: z.string().min(1),
  model: z.string().min(1),
  prompt_version: z.string().min(1),
  /** Deterministic mock provider or a configured live adapter. */
  mode: z.enum(["MOCK_DETERMINISTIC", "SCRIPTED_TEST", "LIVE"]),
  estimated_tokens: z.number().int().nonnegative().nullable(),
});
export type AiModelMetadata = z.infer<typeof AiModelMetadataSchema>;

export const AiReviewReportSchema = z.strictObject({
  schema_version: z.literal(AI_REVIEW_SCHEMA_VERSION),
  analysis_kind: z.enum(AI_ANALYSIS_KINDS),
  /** Server-resolved scope (never model-supplied). */
  scope: AiReviewRequestSchema.shape.scope,
  status: z.enum(AI_REPORT_STATUSES),
  findings: z.array(AiFindingSchema),
  summary: z.string().max(4000),
  /** Draft text only; publication is a separate authorised human act. */
  draft_memo: z.string().max(8000).nullable(),
  questions: z.array(z.string().max(400)),
  limitations: z.array(z.string().max(400)).min(1),
  model_metadata: AiModelMetadataSchema,
});
export type AiReviewReport = z.infer<typeof AiReviewReportSchema>;

export const AI_VALIDATION_CODES = [
  "INVALID_SCHEMA_VERSION",
  "FORBIDDEN_STATUS",
  "FINDING_SCHEMA_INVALID",
  "UNRESOLVED_FACT_REF",
  "UNRESOLVED_DOCUMENT_REF",
  "UNRESOLVED_CHECK_RUN_REF",
  "SUPERSEDED_FACT_REF",
  "FORGED_LOCATOR",
  "AMOUNT_WITHOUT_TOOL_BACKING",
  "AMOUNT_NOT_IN_CITED_RUN",
  "UNSUPPORTED_PROMOTED_TO_PASS",
  "FORBIDDEN_TOOL_CALL",
  "UNKNOWN_TOOL_CALL",
  "MODEL_SUPPLIED_TENANT_IGNORED",
  "INJECTION_TEXT_DETECTED",
  "BUDGET_EXCEEDED",
  "SUPERSEDED_RUN_CITED",
  "REPORT_TEXT_INVALID",
  // AI-CORE-001 runtime codes (all recorded as NOTE or REJECT_REPORT by the runtime, never by the model).
  "TOOL_ARGS_INVALID",
  "DUPLICATE_TOOL_CALL",
  "TOOL_RESULT_TOO_LARGE",
  "TURN_BUDGET_EXHAUSTED",
  "AUTHORIZATION_LOST",
  "CONTEXT_CHANGED",
  "MODEL_ABSTAINED",
  "PROVIDER_TIMEOUT",
  "RUN_CANCELLED",
] as const;
export type AiValidationCode = (typeof AI_VALIDATION_CODES)[number];

export interface AiValidationIssue {
  code: AiValidationCode;
  finding_id: string | null;
  detail: string;
  /**
   * REJECT_FINDING drops the finding; REJECT_REPORT fails the whole run; NOTE keeps the report and records the issue;
   * REDACT_TEXT (AI-SEC-001) keeps the report but replaces or drops one narrative field (summary, draft_memo, a question
   * or a model limitation) that carried an unbacked amount or an unsupported pass/verified claim.
   */
  disposition: "REJECT_FINDING" | "REJECT_REPORT" | "NOTE" | "REDACT_TEXT";
}

/** Immutable record of one orchestrated run. Model output is stored as a digest plus the validated report; secrets and raw prompts are never stored. */
export interface AiRunRecord {
  id: string;
  scope_kind: "FIRM_HOUSEHOLD" | "PERSONAL_WORKSPACE";
  org_id: string | null;
  workspace_id: string | null;
  household_id: string | null;
  snapshot_id: string | null;
  snapshot_sha256: string | null;
  analysis_kind: AiAnalysisKind;
  requested_by: string;
  prompt_version: string;
  provider: string;
  model: string;
  mode: AiModelMetadata["mode"];
  tool_calls: Array<{ tool: AiToolName; args_digest: string; result_digest: string }>;
  raw_output_sha256: string;
  report: AiReviewReport | null;
  validation_issues: AiValidationIssue[];
  /** ABSTAINED: the model declined to draft for lack of evidence (AI-CORE-001); no report exists and nothing is asserted. */
  run_status: "DRAFT_READY" | "REJECTED" | "ERROR" | "ABSTAINED";
  accepted_finding_count: number;
  rejected_finding_count: number;
  estimated_tokens: number | null;
  created_at: string;
  /** AI-CORE-001 bounded tool-loop trace (`ai-runtime-v1`). Absent on records written before the runtime existed. */
  runtime?: AiRuntimeTrace;
}

export const AI_FEEDBACK_ACTIONS = ["ACCEPT", "EDIT", "DISMISS", "REQUEST_EVIDENCE"] as const;
export type AiFeedbackAction = (typeof AI_FEEDBACK_ACTIONS)[number];

/** Reviewer/user action on a finding: separate append-only record with its own version. */
export interface AiFeedback {
  id: string;
  ai_run_id: string;
  finding_id: string;
  actor_principal_id: string;
  actor_role: string;
  action: AiFeedbackAction;
  /** For EDIT: the reviewer's text. The model's original finding is untouched. */
  edited_text: string | null;
  rationale: string;
  version: number;
  created_at: string;
}

export const AiFeedbackInputSchema = z.strictObject({
  ai_run_id: z.string().min(1),
  finding_id: z.string().min(1),
  action: z.enum(AI_FEEDBACK_ACTIONS),
  edited_text: z.string().max(2000).nullable().default(null),
  rationale: z.string().min(3).max(1000),
});
