import { DebtPathsResponseSchema, PersonalClarityResponseSchema, PersonalScenarioResponseSchema, evaluateDecisionPolicy, type DataState, type DebtPathsResponse, type PersonalCalcRun, type PersonalClarityResponse, type PersonalScenarioResponse, type PolicyOutput, type RuleSetRef, type ScenarioSpec } from "@sagespan/contracts";
import type { PersonalActor } from "@/auth/personal-actor";
import { CalcServiceError, callDebtPaths, callPersonalClarity, callPersonalScenario, fetchMethodSets, type PersonalCalcResult } from "@/provenance/calc-client";
import { TRUSTED_ENGINE_NAME } from "../checks";
import { newId, nowIso } from "../ids";
import type { Store } from "../store";
import { currentRun, personalBundle, personalLabels, type PersonalBundle } from "./queries";
import { applySnapshot, buildClarityRequest, buildDebtPathsRequest, buildScenarioRequest, snapshotContentHash } from "./snapshot";

/**
 * DATA-002: the runs work against ANY backend through this minimal data source — the demo
 * file store (via `storeSource`) or the production Supabase repository (which implements the
 * same two methods and persists the delta atomically). `mutate` receives a DataState-shaped
 * view; the domain code never knows which backend it is talking to.
 */
export interface PersonalDataSource {
  readonly actor: PersonalActor;
  bundle(): Promise<PersonalBundle>;
  mutate<T>(fn: (view: DataState) => T): Promise<T>;
}

export function storeSource(store: Store, actor: PersonalActor): PersonalDataSource {
  return {
    actor,
    bundle: async () => personalBundle(store.read(), actor),
    mutate: async (fn) => store.mutate(fn),
  };
}

/** Make the CURRENT snapshot match the live records, persisting the change through the source. */
async function ensureSnapshot(source: PersonalDataSource): Promise<{ b: PersonalBundle; snapshotId: string; created: boolean; inputHash: string; request: ReturnType<typeof buildClarityRequest> }> {
  const b = await source.bundle();
  const request = buildClarityRequest(b);
  const hash = await snapshotContentHash(request);
  const { snapshot, created } = await source.mutate((view) => applySnapshot(personalBundle(view, source.actor), source.actor, view, hash, request.as_of_date));
  const fresh = created ? await source.bundle() : b;
  return { b: fresh, snapshotId: snapshot.id, created, inputHash: hash, request: { ...request, input_hash: hash } };
}

/**
 * Personal engine runs. Mirrors the firm check-run discipline (audit S-04):
 * requests are built from the snapshot only, the request hash is re-derived
 * here, the engine must be the trusted one and every cited methodology set must
 * be PUBLISHED in the service's registry. Failures are recorded as ERROR runs
 * with no amounts; nothing is computed locally.
 */
export function verifyPersonalReceipt<T extends PersonalClarityResponse | DebtPathsResponse | PersonalScenarioResponse>(result: PersonalCalcResult<T>, registry: readonly RuleSetRef[], expectedInputHash: string): string | null {
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

/** Build (or reuse) the current snapshot and record receipted clarity + debt-path runs for it (demo store signature). */
export async function refreshPersonalBaseline(store: Store, actor: PersonalActor, opts: { force?: boolean } = {}): Promise<RefreshOutcome> {
  return refreshBaseline(storeSource(store, actor), opts);
}

/** Backend-independent baseline refresh: snapshot → clarity → debt paths, each receipt verified before anything is stored. */
export async function refreshBaseline(source: PersonalDataSource, opts: { force?: boolean } = {}): Promise<RefreshOutcome> {
  const { b, snapshotId, created, inputHash, request } = await ensureSnapshot(source);
  const snapshot = { id: snapshotId, content_sha256: inputHash };
  const fresh = b;
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

  await source.mutate((s) => {
    s.personal_calc_runs.push(clarityRun);
    if (debtRun) s.personal_calc_runs.push(debtRun);
  });
  return { snapshotId: snapshot.id, snapshotCreated: created, clarity: clarityRun, debt: debtRun, errors };
}

export interface ScenarioInsight {
  run: PersonalCalcRun;
  response: PersonalScenarioResponse | null;
}

export interface PersonalInsights {
  clarity: PersonalClarityResponse | null;
  clarityRun: PersonalCalcRun | null;
  debt: DebtPathsResponse | null;
  debtRun: PersonalCalcRun | null;
  /** What-if runs for the CURRENT snapshot, newest first. Scenarios on a superseded snapshot are history, not shown. */
  scenarios: ScenarioInsight[];
  policy: PolicyOutput | null;
}

/** Read-side: parse the stored receipted responses and evaluate the decision policy. No service call. */
export function personalInsights(b: PersonalBundle): PersonalInsights {
  const clarityRun = currentRun(b, "PERSONAL_CLARITY");
  const debtRun = currentRun(b, "DEBT_PATHS");
  const clarity = clarityRun?.response ? PersonalClarityResponseSchema.parse(clarityRun.response) : null;
  const debt = debtRun?.response ? DebtPathsResponseSchema.parse(debtRun.response) : null;
  const scenarios: ScenarioInsight[] = b.currentSnapshot
    ? b.runs
        .filter((r) => r.check_type === "PERSONAL_SCENARIO" && r.snapshot_id === b.currentSnapshot!.id)
        .sort((x, y) => y.executed_at.localeCompare(x.executed_at))
        .map((run) => ({ run, response: run.response ? PersonalScenarioResponseSchema.parse(run.response) : null }))
    : [];
  const policy = clarity && clarityRun
    ? evaluateDecisionPolicy({
        workspace_id: b.workspace.id,
        clarity,
        clarity_run_id: clarityRun.id,
        debt,
        debt_run_id: debtRun?.id ?? null,
        scenarios: scenarios.filter((s) => s.response && s.run.run_status === "COMPUTED").map((s) => ({ run_id: s.run.id, response: s.response! })),
        labels: personalLabels(b),
      })
    : null;
  return { clarity, clarityRun, debt, debtRun, scenarios, policy };
}


/**
 * Run one what-if on the CURRENT snapshot. The baseline request is rebuilt from the
 * snapshot (never from the page), the scenario spec is validated by the shared
 * contract, and the result is stored as an immutable PERSONAL_SCENARIO run bound
 * to that snapshot. A failed call is recorded as an ERROR run with no amounts.
 */
export async function runPersonalScenario(store: Store, actor: PersonalActor, spec: ScenarioSpec): Promise<PersonalCalcRun> {
  return runScenario(storeSource(store, actor), spec);
}

export async function runScenario(source: PersonalDataSource, spec: ScenarioSpec): Promise<PersonalCalcRun> {
  if (source.actor.workspace_role !== "OWNER") throw new CalcServiceError("FORBIDDEN", "Only the workspace owner can run what-if scenarios.");
  const { b: fresh, snapshotId, inputHash } = await ensureSnapshot(source);
  const snapshot = { id: snapshotId };
  const request = buildScenarioRequest(fresh, spec, inputHash);
  let run: PersonalCalcRun;
  try {
    const registry = (await fetchMethodSets(fresh.workspace.id)).method_sets;
    const result = await callPersonalScenario(request, fresh.workspace.id);
    const failure = verifyPersonalReceipt(result, registry, inputHash);
    if (failure) {
      run = errorRun(fresh, snapshot.id, "PERSONAL_SCENARIO", result.requestHash, "RECEIPT_INTEGRITY", `Receipt rejected: ${failure}. No amounts were recorded.`);
    } else {
      run = {
        id: newId("pcr"),
        workspace_id: fresh.workspace.id,
        snapshot_id: snapshot.id,
        check_type: "PERSONAL_SCENARIO",
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
    run = errorRun(fresh, snapshot.id, "PERSONAL_SCENARIO", "", err.code, err.message);
  }
  await source.mutate((s) => {
    s.personal_calc_runs.push(run);
  });
  return run;
}
