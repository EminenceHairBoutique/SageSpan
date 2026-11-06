import { assertCan, assertTransition, canonicalJson, priorYearEnd, type CheckRun, type DataState, type Discrepancy, type Organization, type RmdCheckRequest, type Snapshot } from "@sagespan/contracts";
import type { Actor } from "@/auth/types";
import { CalcServiceError, callRmdCheck } from "@/provenance/calc-client";
import { appendAudit, sha256 } from "./audit";
import { DomainError } from "./errors";
import { newId, nowIso } from "./ids";
import { householdBundle, requireHousehold, type HouseholdBundle } from "./queries";
import type { Store } from "./store";

const RMD_ACCOUNT_TYPES = new Set(["TRADITIONAL_IRA", "SEP_IRA", "SIMPLE_IRA", "ROTH_IRA", "EMPLOYER_401K", "EMPLOYER_403B", "OTHER"]);

/**
 * Build the calculation-service request for one account STRICTLY from the
 * frozen snapshot payload (never from live facts), so the receipt's
 * request_hash is reproducible from the snapshot alone.
 */
export function buildRmdRequest(org: Organization, b: HouseholdBundle, snapshot: Snapshot, accountId: string): RmdCheckRequest {
  const p = snapshot.canonical_payload;
  const find = (subjectType: string, subjectId: string, key: string, asOf?: string) => p.facts.find((f) => f.subject_type === subjectType && f.subject_id === subjectId && f.field_key === key && (asOf ? f.as_of_date === asOf : true));
  const owners = p.ownership.filter((o) => o.account_id === accountId && !o.effective_to);
  if (owners.length !== 1) throw new DomainError("UNSUPPORTED_OWNERSHIP", `Account ${accountId} has ${owners.length} active owners; the RMD check supports exactly one.`);
  const ownerId = owners[0]!.person_id;
  const account = b.accounts.find((a) => a.id === accountId);
  if (!account) throw new DomainError("NOT_FOUND", "Account not found", 404);
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
          vendor_label: b.household.source_tool_label,
          calculation_scope: ipv.calculation_scope,
          balance_basis: ipv.balance_basis,
          declared_inputs: ipv.declared_inputs ?? null,
          assumptions: ipv.assumptions,
        }
      : null,
    tolerance: { absolute: org.policies.tolerance.absolute, relative: org.policies.tolerance.relative },
    snapshot_ref: { snapshot_id: snapshot.id, revision: snapshot.revision, input_hash: snapshot.content_sha256 },
  };
  return request;
}

export interface RunChecksOutcome {
  runs: CheckRun[];
  errors: Array<{ accountId: string; code: string; message: string }>;
}

/** Run the independent RMD check for every account in the frozen snapshot. Service failures are recorded and surfaced; nothing is computed locally. */
export async function runRmdChecks(store: Store, actor: Actor, householdId: string): Promise<RunChecksOutcome> {
  assertCan(actor.role, "check.run");
  const state = store.read();
  const hh = requireHousehold(state, actor.org_id, householdId);
  if (hh.workflow_status !== "FROZEN" && hh.workflow_status !== "CHECK_COMPLETE") throw new DomainError("INVALID_STATE", `Household is ${hh.workflow_status}; checks run only on a FROZEN snapshot.`);
  const b = householdBundle(state, actor.org_id, householdId);
  const snapshot = b.currentSnapshot;
  if (!snapshot) throw new DomainError("INVALID_STATE", "No frozen snapshot exists.");
  const requests = b.accounts.map((a) => ({ accountId: a.id, request: buildRmdRequest(b.org, b, snapshot, a.id) }));

  const results = await Promise.all(
    requests.map(async ({ accountId, request }) => {
      try {
        return { accountId, request, result: await callRmdCheck(request, actor.org_id), error: null as CalcServiceError | null };
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
        request_hash_verified: r.result ? r.result.requestHashVerified : null,
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
      appendAudit(s, { org_id: actor.org_id, actor_user_id: actor.user_id, actor_role: actor.role, actor_type: actor.actor_type, event_type: "CHECK_RUN_COMPLETED", entity_type: "check_run", entity_id: run.id, summary: `RMD check ${run.id} completed for account ${r.accountId}: ${resp.result_status} (${resp.coverage_status}); engine ${resp.receipt.engine_version}; run hash ${resp.receipt.run_hash.slice(0, 12)}…`, payload: { run_hash: resp.receipt.run_hash, request_hash: resp.receipt.request_hash, result_status: resp.result_status } });
    }
    if (outcome.errors.length === 0 && hh2.workflow_status === "FROZEN") {
      assertTransition(hh2.workflow_status, "CHECK_COMPLETE");
      hh2.workflow_status = "CHECK_COMPLETE";
    }
    hh2.updated_at = nowIso();
    return outcome;
  });
}

export function sendToReview(state: DataState, actor: Actor, householdId: string): void {
  if (!["ANALYST", "ADVISOR", "COMPLIANCE"].includes(actor.role)) assertCan(actor.role, "review.disposition");
  const hh = requireHousehold(state, actor.org_id, householdId);
  assertTransition(hh.workflow_status, "REVIEW_PENDING");
  hh.workflow_status = "REVIEW_PENDING";
  hh.updated_at = nowIso();
  appendAudit(state, { org_id: actor.org_id, actor_user_id: actor.user_id, actor_role: actor.role, actor_type: actor.actor_type, event_type: "SENT_TO_REVIEW", entity_type: "household", entity_id: householdId, summary: `Household ${householdId} sent to review` });
}
