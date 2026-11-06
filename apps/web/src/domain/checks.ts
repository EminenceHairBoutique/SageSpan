import { assertCan, canonicalJson, coverageSummary, priorYearEnd, type CheckRun, type DataState, type Discrepancy, type RmdCheckRequest, type RuleSetRef, type Snapshot } from "@sagespan/contracts";
import type { Actor } from "@/auth/types";
import { CalcServiceError, callRmdCheck, fetchRuleSets, type RmdCheckResult } from "@/provenance/calc-client";
import { appendAudit, sha256 } from "./audit";
import { DomainError } from "./errors";
import { newId, nowIso } from "./ids";
import { householdBundle, requireHousehold } from "./queries";
import type { Store } from "./store";
import { transitionHousehold } from "./workflow";

const RMD_ACCOUNT_TYPES = new Set(["TRADITIONAL_IRA", "SEP_IRA", "SIMPLE_IRA", "ROTH_IRA", "EMPLOYER_401K", "EMPLOYER_403B", "OTHER"]);

/** The only engine whose receipts this tier accepts (audit S-04). */
export const TRUSTED_ENGINE_NAME = "sagespan-calculator";

/**
 * Build the calculation-service request for one account STRICTLY from the
 * frozen snapshot payload (S-07): facts, ownership, beneficiaries, imported
 * comparison, tolerance, vendor label and account classification all come from
 * the payload, never from live organisation settings or household rows, so the
 * receipt's request_hash is reproducible from the snapshot alone and a policy or
 * label change after freeze cannot move it.
 */
export function buildRmdRequest(snapshot: Snapshot, accountId: string): RmdCheckRequest {
  const p = snapshot.canonical_payload;
  if (p.snapshot_version !== "sagespan.snapshot.v2") throw new DomainError("SNAPSHOT_VERSION_UNSUPPORTED", `Snapshot payload ${String(p.snapshot_version)} predates PR-002; re-freeze to produce a v2 snapshot.`);
  const find = (subjectType: string, subjectId: string, key: string, asOf?: string) => p.facts.find((f) => f.subject_type === subjectType && f.subject_id === subjectId && f.field_key === key && (asOf ? f.as_of_date === asOf : true));
  const owners = p.ownership.filter((o) => o.account_id === accountId && !o.effective_to);
  if (owners.length !== 1) throw new DomainError("UNSUPPORTED_OWNERSHIP", `Account ${accountId} has ${owners.length} active owners; the RMD check supports exactly one.`);
  const ownerId = owners[0]!.person_id;
  const account = p.accounts.find((a) => a.id === accountId);
  if (!account) throw new DomainError("NOT_FOUND", "Account not found in the frozen snapshot", 404);
  const ty = p.tax_year;
  const yearEnd = priorYearEnd(ty);
  const balance = find("ACCOUNT", accountId, "account.year_end_balance", yearEnd);
  const priorPrior = find("ACCOUNT", accountId, "account.prior_prior_year_end_balance", priorYearEnd(ty - 1));
  const typeFact = find("ACCOUNT", accountId, "account.account_type");
  const inherited = find("ACCOUNT", accountId, "account.is_inherited");
  const dob = find("PERSON", ownerId, "person.birth_date");
  const alive = find("PERSON", ownerId, "person.is_alive");
  const election = find("ACCOUNT", accountId, "rmd.first_year_election")?.value_text ?? null;
  const soleFlag = find("ACCOUNT", accountId, "beneficiary.primary.spouse_sole_entire_year");
  const hasBeneficiaryEvidence = p.beneficiaries.some((d) => d.account_id === accountId);
  const beneficiaries = hasBeneficiaryEvidence
    ? p.beneficiaries
        .filter((d) => d.account_id === accountId)
        .map((d) => ({
          person_ref: d.beneficiary_person_id ?? `label:${d.designation_type.toLowerCase()}`,
          relationship: d.relationship,
          designation_type: d.designation_type,
          share_percent: d.share_percentage,
          birth_date: d.beneficiary_person_id ? (find("PERSON", d.beneficiary_person_id, "person.birth_date")?.value_date ?? null) : null,
          sole_primary_entire_year: d.designation_type === "PRIMARY" && d.relationship === "SPOUSE" ? (soleFlag?.value_bool ?? d.sole_primary_entire_year ?? null) : d.designation_type === "PRIMARY" ? false : null,
        }))
    : null;
  const ipv = p.imported_plan_values.find((v) => v.account_id === accountId && v.metric_key === "rmd.annual_amount" && v.tax_year === ty);
  const request: RmdCheckRequest = {
    schema_version: "sagespan.rmd-check.v1",
    tax_year: ty,
    owner: { person_ref: ownerId, birth_date: dob?.value_date ?? null, is_alive: alive?.value_bool ?? null },
    account: {
      account_ref: accountId,
      account_type: (typeFact?.value_text as RmdCheckRequest["account"]["account_type"]) ?? (RMD_ACCOUNT_TYPES.has(account.account_type) ? account.account_type : null),
      is_inherited: inherited?.value_bool ?? null,
      prior_year_end_balance: balance?.value_number ? { amount: balance.value_number, currency: balance.value_currency ?? "USD", as_of_date: balance.as_of_date } : null,
      prior_prior_year_end_balance: priorPrior?.value_number ? { amount: priorPrior.value_number, currency: priorPrior.value_currency ?? "USD", as_of_date: priorPrior.as_of_date } : null,
      outstanding_rollover_adjustment: null,
    },
    beneficiaries,
    first_rmd_election: election === "SATISFIED_IN_FIRST_YEAR" ? { deferred_first_rmd_to_april_1: false, first_rmd_satisfied_in_first_year: true } : election === "DEFERRED" ? { deferred_first_rmd_to_april_1: true, first_rmd_satisfied_in_first_year: false } : null,
    imported_comparison: ipv
      ? {
          import_value_ref: ipv.id,
          amount: ipv.value_decimal,
          currency: ipv.currency,
          tax_year: ipv.tax_year ?? ty,
          vendor_label: p.household.source_tool_label,
          calculation_scope: ipv.calculation_scope,
          balance_basis: ipv.balance_basis,
          declared_inputs: ipv.declared_inputs ?? null,
          assumptions: ipv.assumptions,
        }
      : null,
    tolerance: { absolute: p.policy.tolerance.absolute, relative: p.policy.tolerance.relative },
    snapshot_ref: { snapshot_id: snapshot.id, revision: snapshot.revision, input_hash: snapshot.content_sha256 },
  };
  return request;
}

/**
 * Receipt integrity (audit S-04). A response is accepted only when this tier
 * re-derived the request hash, the receipt is bound to the frozen snapshot, the
 * engine is the one we trust, and every cited rule set is PUBLISHED in the
 * registry with the same version and checksum. Returns the first failure.
 */
export function verifyReceipt(result: RmdCheckResult, snapshot: Snapshot, registry: readonly RuleSetRef[]): string | null {
  const receipt = result.response.receipt;
  if (!result.requestHashVerified || receipt.request_hash !== result.requestHash) return "REQUEST_HASH_MISMATCH";
  if (receipt.engine_name !== TRUSTED_ENGINE_NAME) return `UNKNOWN_ENGINE:${receipt.engine_name}`;
  if (!receipt.snapshot_ref || receipt.snapshot_ref.snapshot_id !== snapshot.id || receipt.snapshot_ref.input_hash !== snapshot.content_sha256) return "RECEIPT_SNAPSHOT_REF_MISMATCH";
  if (receipt.rule_sets.length === 0) return "RULE_SETS_MISSING";
  for (const rs of receipt.rule_sets) {
    const known = registry.find((k) => k.rule_set_id === rs.rule_set_id && k.version === rs.version && k.checksum === rs.checksum && k.status === "PUBLISHED");
    if (!known) return `RULE_SET_NOT_PUBLISHED:${rs.rule_set_id}@${rs.version}`;
  }
  return null;
}

export interface RunChecksOutcome {
  runs: CheckRun[];
  errors: Array<{ accountId: string; code: string; message: string }>;
}

/** Run the independent RMD check for every account in the frozen snapshot. Service failures and receipt-integrity failures are recorded as ERROR runs and surfaced; nothing is computed locally. */
export async function runRmdChecks(store: Store, actor: Actor, householdId: string): Promise<RunChecksOutcome> {
  assertCan(actor.role, "check.run");
  const state = store.read();
  const hh = requireHousehold(state, actor.org_id, householdId);
  if (hh.workflow_status !== "FROZEN" && hh.workflow_status !== "CHECK_COMPLETE") throw new DomainError("INVALID_STATE", `Household is ${hh.workflow_status}; checks run only on a FROZEN snapshot.`);
  const b = householdBundle(state, actor.org_id, householdId);
  const snapshot = b.currentSnapshot;
  if (!snapshot) throw new DomainError("INVALID_STATE", "No frozen snapshot exists.");
  // Accounts come from the frozen payload too (an account added after freeze belongs to the next revision).
  const requests = snapshot.canonical_payload.accounts.map((a) => ({ accountId: a.id, request: buildRmdRequest(snapshot, a.id) }));

  let registry: readonly RuleSetRef[] = [];
  let registryError: CalcServiceError | null = null;
  try {
    registry = (await fetchRuleSets(actor.org_id)).rule_sets;
  } catch (e) {
    registryError = e instanceof CalcServiceError ? e : new CalcServiceError("SERVICE_ERROR", e instanceof Error ? e.message : "Rule registry unavailable");
  }

  const results = await Promise.all(
    requests.map(async ({ accountId, request }) => {
      if (registryError) return { accountId, request, result: null as RmdCheckResult | null, error: registryError };
      try {
        const result = await callRmdCheck(request, actor.org_id);
        const failure = verifyReceipt(result, snapshot, registry);
        if (failure) {
          return { accountId, request, result: null, error: new CalcServiceError("RECEIPT_INTEGRITY_ERROR", `The calculation service's receipt failed verification (${failure}); the result was discarded and nothing was recorded as computed.`) };
        }
        return { accountId, request, result, error: null as CalcServiceError | null };
      } catch (e) {
        const err = e instanceof CalcServiceError ? e : new CalcServiceError("SERVICE_ERROR", e instanceof Error ? e.message : "Unknown calculation-service error");
        return { accountId, request, result: null, error: err };
      }
    }),
  );

  return store.mutate((s) => {
    const hh2 = requireHousehold(s, actor.org_id, householdId);
    const snap = s.snapshots.find((x) => x.id === snapshot.id && x.org_id === actor.org_id);
    if (!snap || snap.status !== "FROZEN") throw new DomainError("STALE_SNAPSHOT", "The snapshot changed while the check was running; re-run from the current revision.");
    const outcome: RunChecksOutcome = { runs: [], errors: [] };
    for (const r of results) {
      const run: CheckRun = {
        id: newId("run"),
        org_id: actor.org_id,
        snapshot_id: snap.id,
        household_id: householdId,
        check_type: "RMD_ANNUAL",
        engine_name: r.result?.response.receipt.engine_name ?? null,
        engine_version: r.result?.response.receipt.engine_version ?? null,
        rule_set_versions: Object.fromEntries((r.result?.response.receipt.rule_sets ?? []).map((x) => [x.rule_set_id, x.version])),
        request_payload: r.request,
        request_sha256: r.result?.requestHash ?? sha256(canonicalJson(r.request)),
        response: r.result?.response ?? null,
        response_sha256: r.result ? sha256(canonicalJson(r.result.response)) : null,
        executed_at: nowIso(),
        executed_by: actor.user_id,
        run_status: r.result ? r.result.response.result_status : "ERROR",
        coverage_status: r.result?.response.coverage_status ?? null,
        error: r.error ? { code: r.error.code, message: r.error.message } : null,
        request_hash_verified: r.result ? true : false,
      };
      s.check_runs.push(run);
      outcome.runs.push(run);
      if (r.error) {
        outcome.errors.push({ accountId: r.accountId, code: r.error.code, message: r.error.message });
        appendAudit(s, { org_id: actor.org_id, actor_user_id: actor.user_id, actor_role: actor.role, actor_type: actor.actor_type, event_type: "CHECK_RUN_FAILED", entity_type: "check_run", entity_id: run.id, summary: `RMD check for account ${r.accountId} failed: ${r.error.code}. No amount was produced.`, payload: { code: r.error.code } });
        continue;
      }
      const resp = r.result!.response;
      if (resp.discrepancy) {
        const d: Discrepancy = {
          id: newId("disc"),
          org_id: actor.org_id,
          check_run_id: run.id,
          household_id: householdId,
          imported_plan_value_id: resp.discrepancy.import_value_ref ?? null,
          classification: resp.discrepancy.classification,
          comparable: resp.discrepancy.comparable,
          computed_amount: resp.discrepancy.computed_amount ?? null,
          imported_amount: resp.discrepancy.imported_amount ?? null,
          delta_amount: resp.discrepancy.difference ?? null,
          tolerance_applied: resp.discrepancy.tolerance_applied ?? null,
          explanation: resp.discrepancy.explanation,
          next_step: resp.discrepancy.next_step,
          status: "OPEN",
          disposition: null,
        };
        s.discrepancies.push(d);
      }
      snap.rule_set_versions = { ...snap.rule_set_versions, ...run.rule_set_versions };
      appendAudit(s, { org_id: actor.org_id, actor_user_id: actor.user_id, actor_role: actor.role, actor_type: actor.actor_type, event_type: "CHECK_RUN_COMPLETED", entity_type: "check_run", entity_id: run.id, summary: `RMD check ${run.id} completed for account ${r.accountId}: ${resp.result_status} (${resp.coverage_status}); engine ${resp.receipt.engine_version}; receipt verified; run hash ${resp.receipt.run_hash.slice(0, 12)}…`, payload: { run_hash: resp.receipt.run_hash, request_hash: resp.receipt.request_hash, result_status: resp.result_status } });
    }
    // N-02: the household advances when the LATEST attempt for every account in the snapshot is a non-ERROR run
    // with a verified receipt — not merely when this batch had no failures. A failed retry after an earlier
    // success leaves that account's latest attempt as ERROR; the workflow status is not rewound (the state
    // machine has no CHECK_COMPLETE -> FROZEN edge) but approval evaluates the same latest attempts and refuses.
    const cov = coverageSummary(snap, s.check_runs.filter((r) => r.org_id === actor.org_id && r.household_id === householdId), []);
    if (cov.not_run === 0 && cov.error === 0 && hh2.workflow_status === "FROZEN") transitionHousehold(hh2, "CHECK_COMPLETE");
    hh2.updated_at = nowIso();
    return outcome;
  });
}

export function sendToReview(state: DataState, actor: Actor, householdId: string): void {
  if (!["ANALYST", "ADVISOR", "COMPLIANCE"].includes(actor.role)) assertCan(actor.role, "review.disposition");
  const hh = requireHousehold(state, actor.org_id, householdId);
  transitionHousehold(hh, "REVIEW_PENDING");
  appendAudit(state, { org_id: actor.org_id, actor_user_id: actor.user_id, actor_role: actor.role, actor_type: actor.actor_type, event_type: "SENT_TO_REVIEW", entity_type: "household", entity_id: householdId, summary: `Household ${householdId} sent to review` });
}
