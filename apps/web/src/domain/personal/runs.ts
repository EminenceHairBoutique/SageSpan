import { DebtPathsResponseSchema, PersonalClarityResponseSchema, evaluateDecisionPolicy, type DebtPathsResponse, type PersonalCalcRun, type PersonalClarityResponse, type PolicyOutput, type RuleSetRef } from "@sagespan/contracts";
import type { PersonalActor } from "@/auth/personal-actor";
import { CalcServiceError, callDebtPaths, callPersonalClarity, fetchMethodSets, type PersonalCalcResult } from "@/provenance/calc-client";
import { TRUSTED_ENGINE_NAME } from "../checks";
import { newId, nowIso } from "../ids";
import type { Store } from "../store";
import { currentRun, personalBundle, personalLabels, type PersonalBundle } from "./queries";
import { buildDebtPathsRequest, ensureCurrentSnapshot } from "./snapshot";

/**
 * Personal engine runs. Mirrors the firm check-run discipline (audit S-04):
 * requests are built from the snapshot only, the request hash is re-derived
 * here, the engine must be the trusted one and every cited methodology set must
 * be PUBLISHED in the service's registry. Failures are recorded as ERROR runs
 * with no amounts; nothing is computed locally.
 */
export function verifyPersonalReceipt<T extends PersonalClarityResponse | DebtPathsResponse>(result: PersonalCalcResult<T>, registry: readonly RuleSetRef[], expectedInputHash: string): string | null {
  const receipt = result.response.receipt;
  if (!result.requestHashVerified || receipt.request_hash !== result.requestHash) return "REQUEST_HASH_MISMATCH";
  if (receipt.engine_name !== TRUSTED_ENGINE_NAME) return `UNKNOWN_ENGINE:${receipt.engine_name}`;
  if (receipt.inputs_used["input_hash"] !== expectedInputHash) return "RECEIPT_SNAPSHOT_REF_MISMATCH";
  if (receipt.rule_sets.length === 0) return "RULE_SETS_MISSING";
  for (const rs of receipt.rule_sets) {
    const known = registry.find((k) => k.rule_set_id === rs.rule_set_id && k.version === rs.version && k.checksum === rs.checksum && k.status === "PUBLISHED");
    if (!known) return `METHOD_SET_NOT_PUBLISHED:${rs.rule_set_id}@${rs.version}`;
  }
  return null;
}

const RETRY_BACKOFF_MS = 60_000;

export interface RefreshOutcome {
  snapshotId: string;
  snapshotCreated: boolean;
  clarity: PersonalCalcRun;
  debt: PersonalCalcRun | null;
  errors: Array<{ check: string; code: string; message: string }>;
}

function errorRun(b: PersonalBundle, snapshotId: string, checkType: PersonalCalcRun["check_type"], requestHash: string, code: string, message: string): PersonalCalcRun {
  return { id: newId("pcr"), workspace_id: b.workspace.id, snapshot_id: snapshotId, check_type: checkType, request_sha256: requestHash, request_hash_verified: false, engine_name: null, engine_version: null, method_set_versions: {}, response: null, run_status: "ERROR", error: { code, message }, executed_at: nowIso() };
}

/** Build (or reuse) the current snapshot and record receipted clarity + debt-path runs for it. */
export async function refreshPersonalBaseline(store: Store, actor: PersonalActor, opts: { force?: boolean } = {}): Promise<RefreshOutcome> {
  const state = store.read();
  const b = personalBundle(state, actor);
  const { snapshot, created, request } = await ensureCurrentSnapshot(b, actor, state);
  if (created) store.write(state);
  const fresh = personalBundle(store.read(), actor);
  const existingClarity = currentRun(fresh, "PERSONAL_CLARITY");
  const existingDebt = currentRun(fresh, "DEBT_PATHS");
  if (!opts.force && existingClarity && existingClarity.run_status !== "ERROR" && (existingDebt || fresh.liabilities.length === 0)) {
    return { snapshotId: snapshot.id, snapshotCreated: created, clarity: existingClarity, debt: existingDebt, errors: [] };
  }
  // Back off after a recent failure so page loads do not hammer a down service or pile up ERROR runs.
  if (!opts.force && existingClarity?.run_status === "ERROR" && Date.now() - Date.parse(existingClarity.executed_at) < RETRY_BACKOFF_MS) {
    return { snapshotId: snapshot.id, snapshotCreated: created, clarity: existingClarity, debt: existingDebt, errors: [{ check: "PERSONAL_CLARITY", code: existingClarity.error?.code ?? "ERROR", message: existingClarity.error?.message ?? "Previous attempt failed" }] };
  }
  const errors: RefreshOutcome["errors"] = [];
  const inputHash = snapshot.content_sha256;
  let registry: RuleSetRef[] = [];
  try {
    registry = (await fetchMethodSets(b.workspace.id)).method_sets;
  } catch (e) {
    const err = e instanceof CalcServiceError ? e : new CalcServiceError("SERVICE_ERROR", String(e));
    errors.push({ check: "METHOD_REGISTRY", code: err.code, message: err.message });
  }

  // clarity
  let clarityRun: PersonalCalcRun;
  try {
    if (errors.length) throw new CalcServiceError(errors[0]!.code, errors[0]!.message);
    const result = await callPersonalClarity(request, b.workspace.id);
    const failure = verifyPersonalReceipt(result, registry, inputHash);
    if (failure) {
      clarityRun = errorRun(fresh, snapshot.id, "PERSONAL_CLARITY", result.requestHash, "RECEIPT_INTEGRITY", `Receipt rejected: ${failure}. No amounts were recorded.`);
      errors.push({ check: "PERSONAL_CLARITY", code: "RECEIPT_INTEGRITY", message: failure });
    } else {
      clarityRun = {
        id: newId("pcr"),
        workspace_id: fresh.workspace.id,
        snapshot_id: snapshot.id,
        check_type: "PERSONAL_CLARITY",
        request_sha256: result.requestHash,
        request_hash_verified: true,
        engine_name: result.response.receipt.engine_name,
        engine_version: result.response.receipt.engine_version,
        method_set_versions: Object.fromEntries(result.response.receipt.rule_sets.map((r) => [r.rule_set_id, r.version])),
        response: result.response,
        run_status: result.response.result_status,
        error: null,
        executed_at: nowIso(),
      };
    }
  } catch (e) {
    const err = e instanceof CalcServiceError ? e : new CalcServiceError("SERVICE_ERROR", e instanceof Error ? e.message : String(e));
    clarityRun = errorRun(fresh, snapshot.id, "PERSONAL_CLARITY", "", err.code, err.message);
    if (!errors.some((x) => x.check === "PERSONAL_CLARITY")) errors.push({ check: "PERSONAL_CLARITY", code: err.code, message: err.message });
  }

  // debt paths (only when there are liabilities)
  let debtRun: PersonalCalcRun | null = null;
  const debtRequest = buildDebtPathsRequest(fresh, inputHash);
  if (debtRequest && clarityRun.run_status !== "ERROR") {
    try {
      const result = await callDebtPaths(debtRequest, fresh.workspace.id);
      const failure = verifyPersonalReceipt(result, registry, inputHash);
      if (failure) {
        debtRun = errorRun(fresh, snapshot.id, "DEBT_PATHS", result.requestHash, "RECEIPT_INTEGRITY", `Receipt rejected: ${failure}. No amounts were recorded.`);
        errors.push({ check: "DEBT_PATHS", code: "RECEIPT_INTEGRITY", message: failure });
      } else {
        debtRun = {
          id: newId("pcr"),
          workspace_id: fresh.workspace.id,
          snapshot_id: snapshot.id,
          check_type: "DEBT_PATHS",
          request_sha256: result.requestHash,
          request_hash_verified: true,
          engine_name: result.response.receipt.engine_name,
          engine_version: result.response.receipt.engine_version,
          method_set_versions: Object.fromEntries(result.response.receipt.rule_sets.map((r) => [r.rule_set_id, r.version])),
          response: result.response,
          run_status: result.response.result_status,
          error: null,
          executed_at: nowIso(),
        };
      }
    } catch (e) {
      const err = e instanceof CalcServiceError ? e : new CalcServiceError("SERVICE_ERROR", e instanceof Error ? e.message : String(e));
      debtRun = errorRun(fresh, snapshot.id, "DEBT_PATHS", "", err.code, err.message);
      errors.push({ check: "DEBT_PATHS", code: err.code, message: err.message });
    }
  }

  store.mutate((s) => {
    s.personal_calc_runs.push(clarityRun);
    if (debtRun) s.personal_calc_runs.push(debtRun);
  });
  return { snapshotId: snapshot.id, snapshotCreated: created, clarity: clarityRun, debt: debtRun, errors };
}

export interface PersonalInsights {
  clarity: PersonalClarityResponse | null;
  clarityRun: PersonalCalcRun | null;
  debt: DebtPathsResponse | null;
  debtRun: PersonalCalcRun | null;
  policy: PolicyOutput | null;
}

/** Read-side: parse the stored receipted responses and evaluate the decision policy. No service call. */
export function personalInsights(b: PersonalBundle): PersonalInsights {
  const clarityRun = currentRun(b, "PERSONAL_CLARITY");
  const debtRun = currentRun(b, "DEBT_PATHS");
  const clarity = clarityRun?.response ? PersonalClarityResponseSchema.parse(clarityRun.response) : null;
  const debt = debtRun?.response ? DebtPathsResponseSchema.parse(debtRun.response) : null;
  const policy = clarity && clarityRun ? evaluateDecisionPolicy({ workspace_id: b.workspace.id, clarity, clarity_run_id: clarityRun.id, debt, debt_run_id: debtRun?.id ?? null, labels: personalLabels(b) }) : null;
  return { clarity, clarityRun, debt, debtRun, policy };
}
