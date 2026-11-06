import type { AiModelOutput, CheckRun, DataState, Discrepancy, Snapshot } from "@sagespan/contracts";
import type { PersonalActor } from "@/auth/personal-actor";
import type { Actor } from "@/auth/types";
import patelRequest from "../../../../../fixtures/synthetic/calc/patel_rmd_request.json";
import patelResponse from "../../../../../fixtures/synthetic/calc/patel_rmd_expected_response.json";
import castilloClarity from "../../../../../fixtures/synthetic/personal/castillo_clarity_expected_response.json";
import castilloDebt from "../../../../../fixtures/synthetic/personal/castillo_debt_paths_expected_response.json";

/**
 * Shared fixtures for the AI-000/001 evaluation suite. Everything is synthetic
 * and derived from committed fixtures; nothing here contacts a service.
 */
export const HP_CCO: Actor = { user_id: "user_hp_cco", org_id: "org_harborpoint", role: "COMPLIANCE", display_name: "Dana Whitfield", actor_type: "SIMULATED_REVIEWER", mode: "DEMO" };
export const HP_VIEWER: Actor = { user_id: "user_hp_viewer", org_id: "org_harborpoint", role: "VIEWER", display_name: "Sam Okoro", actor_type: "SIMULATED_REVIEWER", mode: "DEMO" };
export const NL_CCO: Actor = { user_id: "user_nl_cco", org_id: "org_northline", role: "COMPLIANCE", display_name: "Elena Brooks", actor_type: "SIMULATED_REVIEWER", mode: "DEMO" };
export const ALVAREZ: PersonalActor = { scope: "PERSONAL", principal_id: "pr_castillo", workspace_id: "ws_castillo_personal", workspace_role: "OWNER", domains: [], display_name: "Maya Castillo", mode: "DEMO", actor_type: "SIMULATED_INDIVIDUAL" };

type PatelRunStatus = CheckRun["run_status"];

/** Add a frozen snapshot plus a check run (with the committed Patel response) to the state. */
export function addPatelCheckRun(state: DataState, opts: { runId?: string; status?: PatelRunStatus; executedAt?: string; unsupportedCode?: string; accountRef?: string } = {}): { snapshot: Snapshot; run: CheckRun; discrepancy: Discrepancy | null } {
  const status = opts.status ?? "PASS";
  const runId = opts.runId ?? `cr_patel_${status.toLowerCase()}_${(opts.executedAt ?? "2026-11-05T10:00:00Z").replace(/[^0-9]/g, "")}`;
  let snapshot = state.snapshots.find((s) => s.id === "snap_patel_r2");
  if (!snapshot) {
    snapshot = {
      id: "snap_patel_r2",
      org_id: "org_harborpoint",
      household_id: "hh_patel",
      revision: 2,
      content_sha256: "0".repeat(64),
      rule_set_versions: { "rmd.uniform_lifetime_table": "2022.1" },
      assumption_set_id: null,
      created_by: "user_hp_analyst",
      created_by_role: "ANALYST",
      created_at: "2026-11-05T09:00:00Z",
      status: "FROZEN",
      canonical_payload: { snapshot_version: "sagespan.snapshot.v1", household_id: "hh_patel", tax_year: 2026, revision: 2, facts: [], source_documents: [], ownership: [], beneficiaries: [], assumptions: [], exceptions: [], imported_plan_values: [] },
    };
    state.snapshots.push(snapshot);
  }
  const request = structuredClone(patelRequest) as CheckRun["request_payload"];
  if (opts.accountRef) request.account.account_ref = opts.accountRef;
  const response = status === "PASS" ? (structuredClone(patelResponse) as CheckRun["response"]) : status === "ERROR" ? null : ({ ...structuredClone(patelResponse), result_status: status, coverage_status: status === "NOT_REQUIRED" ? "SUPPORTED_VERIFIED" : status, annual_rmd: null, discrepancy: null, events: [], unsupported_reasons: [{ code: opts.unsupportedCode ?? "INHERITED_ACCOUNT_UNSUPPORTED", message: "synthetic", rule_ref: null }] } as unknown as CheckRun["response"]);
  const run: CheckRun = {
    id: runId,
    org_id: "org_harborpoint",
    snapshot_id: snapshot.id,
    household_id: "hh_patel",
    check_type: "RMD_ANNUAL",
    engine_name: response ? "sagespan-calculator" : null,
    engine_version: response ? "0.1.0" : null,
    rule_set_versions: { "rmd.uniform_lifetime_table": "2022.1" },
    request_payload: request,
    request_sha256: "1".repeat(64),
    response,
    response_sha256: response ? "2".repeat(64) : null,
    executed_at: opts.executedAt ?? "2026-11-05T10:00:00Z",
    executed_by: "user_hp_analyst",
    run_status: status,
    coverage_status: status === "PASS" ? "SUPPORTED_VERIFIED" : status === "ERROR" ? null : status === "NOT_REQUIRED" ? "SUPPORTED_VERIFIED" : status,
    error: status === "ERROR" ? { code: "SERVICE_UNAVAILABLE", message: "synthetic outage" } : null,
    request_hash_verified: status !== "ERROR",
  };
  state.check_runs.push(run);
  let discrepancy: Discrepancy | null = null;
  if (status === "PASS") {
    discrepancy = { id: `disc_${runId}`, org_id: "org_harborpoint", check_run_id: runId, household_id: "hh_patel", imported_plan_value_id: "ipv_patel_rmd_2026", classification: "SOURCE_CONFLICT", comparable: true, computed_amount: "25098.04", imported_amount: "24000.00", delta_amount: "1098.04", tolerance_applied: "25.10", explanation: "synthetic", next_step: "synthetic", status: "OPEN", disposition: null };
    state.discrepancies.push(discrepancy);
  }
  return { snapshot, run, discrepancy };
}

/** Give Castillo a current personal snapshot and receipted clarity + debt runs from the committed fixtures (no service call). */
export function addCastilloRuns(state: DataState): { clarityRunId: string; debtRunId: string } {
  const snapId = "psnap_castillo_1";
  state.personal_snapshots.push({ id: snapId, workspace_id: "ws_castillo_personal", revision: 1, as_of_date: "2026-11-01", content_sha256: "a".repeat(64), created_at: "2026-11-01T12:00:00Z", created_by: "pr_castillo", status: "CURRENT" });
  const clarityRunId = "pcr_castillo_clarity_1";
  const debtRunId = "pcr_castillo_debt_1";
  state.personal_calc_runs.push(
    { id: clarityRunId, workspace_id: "ws_castillo_personal", snapshot_id: snapId, check_type: "PERSONAL_CLARITY", request_sha256: "b".repeat(64), request_hash_verified: true, engine_name: "sagespan-calculator", engine_version: "0.1.0", method_set_versions: { "personal.cashflow_baseline": "2026.1" }, response: structuredClone(castilloClarity), run_status: "COMPUTED", error: null, executed_at: "2026-11-01T12:00:01Z" },
    { id: debtRunId, workspace_id: "ws_castillo_personal", snapshot_id: snapId, check_type: "DEBT_PATHS", request_sha256: "c".repeat(64), request_hash_verified: true, engine_name: "sagespan-calculator", engine_version: "0.1.0", method_set_versions: { "personal.debt_amortization": "2026.1" }, response: structuredClone(castilloDebt), run_status: "COMPUTED", error: null, executed_at: "2026-11-01T12:00:02Z" },
  );
  return { clarityRunId, debtRunId };
}

/** A minimal, otherwise-valid model output with one finding; cases override pieces to simulate misbehaviour. */
export function scriptedOutput(overrides: Partial<AiModelOutput> & { finding?: Record<string, unknown> }): AiModelOutput {
  const { finding, ...rest } = overrides;
  const base: Record<string, unknown> = {
    finding_id: "f_scripted_1",
    category: "MISSING_EVIDENCE",
    severity: "MEDIUM",
    title: "Scripted finding",
    explanation: "Scripted explanation without amounts.",
    fact_refs: [],
    document_refs: [],
    check_run_refs: [],
    cited_amounts: [],
    evidence_status: "UNVERIFIED",
    suggested_next_action: null,
    ...finding,
  };
  return { schema_version: "ai-review-v1", status: "DRAFT_FOR_HUMAN_REVIEW", findings: [base], summary: "scripted", limitations: ["scripted"], ...rest };
}
