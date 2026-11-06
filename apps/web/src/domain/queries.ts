import type { Account, AccountOwnership, AuditEvent, BeneficiaryDesignation, CheckRun, DataState, Discrepancy, EvidencePacket, Fact, FactConflict, Household, ImportedPlanValue, Organization, Person, PlanImport, Review, ReviewComment, Snapshot, SourceDocument, SourceLocation, Assumption, AssumptionSet } from "@sagespan/contracts";
import { NotFoundError } from "@/auth/types";

/**
 * Tenant-scoped read helpers. Every function takes the organisation id that
 * was resolved on the server from the actor; records belonging to another
 * organisation are indistinguishable from "not found".
 */
export function orgById(state: DataState, orgId: string): Organization {
  const org = state.organizations.find((o) => o.id === orgId);
  if (!org) throw new NotFoundError("Organisation not found");
  return org;
}

export function householdOrNull(state: DataState, orgId: string, householdId: string): Household | null {
  const hh = state.households.find((h) => h.id === householdId);
  if (!hh || hh.org_id !== orgId) return null;
  return hh;
}

export function requireHousehold(state: DataState, orgId: string, householdId: string): Household {
  const hh = householdOrNull(state, orgId, householdId);
  if (!hh) throw new NotFoundError("Household not found");
  return hh;
}

export function listHouseholds(state: DataState, orgId: string): Household[] {
  return state.households.filter((h) => h.org_id === orgId && h.status !== "ARCHIVED");
}

export function profileName(state: DataState, userId: string | null | undefined): string {
  if (!userId) return "Unassigned";
  return state.profiles.find((p) => p.user_id === userId)?.display_name ?? userId;
}

export function membershipRole(state: DataState, orgId: string, userId: string) {
  return state.memberships.find((m) => m.org_id === orgId && m.user_id === userId && m.status === "ACTIVE")?.role ?? null;
}

export interface HouseholdBundle {
  org: Organization;
  household: Household;
  persons: Person[];
  accounts: Account[];
  ownership: AccountOwnership[];
  beneficiaries: BeneficiaryDesignation[];
  documents: SourceDocument[];
  locations: SourceLocation[];
  facts: Fact[];
  activeFacts: Fact[];
  conflicts: FactConflict[];
  assumptionSets: AssumptionSet[];
  assumptions: Assumption[];
  imports: PlanImport[];
  importedValues: ImportedPlanValue[];
  snapshots: Snapshot[];
  currentSnapshot: Snapshot | null;
  checkRuns: CheckRun[];
  discrepancies: Discrepancy[];
  reviews: Review[];
  comments: ReviewComment[];
  packets: EvidencePacket[];
  audit: AuditEvent[];
}

export function householdBundle(state: DataState, orgId: string, householdId: string): HouseholdBundle {
  const household = requireHousehold(state, orgId, householdId);
  const org = orgById(state, orgId);
  const inOrg = <T extends { org_id: string }>(rows: T[]) => rows.filter((r) => r.org_id === orgId);
  const accounts = inOrg(state.accounts).filter((a) => a.household_id === householdId);
  const accountIds = new Set(accounts.map((a) => a.id));
  const facts = inOrg(state.facts).filter((f) => f.household_id === householdId);
  const snapshots = inOrg(state.snapshots).filter((s) => s.household_id === householdId).sort((a, b) => a.revision - b.revision);
  const checkRuns = inOrg(state.check_runs).filter((c) => c.household_id === householdId).sort((a, b) => a.executed_at.localeCompare(b.executed_at));
  const checkRunIds = new Set(checkRuns.map((c) => c.id));
  const docs = inOrg(state.source_documents).filter((d) => d.household_id === householdId);
  const docIds = new Set(docs.map((d) => d.id));
  const assumptionSets = inOrg(state.assumption_sets).filter((a) => a.household_id === householdId);
  const setIds = new Set(assumptionSets.map((s) => s.id));
  const householdEntityIds = new Set<string>([householdId, ...accountIds, ...snapshots.map((s) => s.id), ...checkRuns.map((c) => c.id)]);
  return {
    org,
    household,
    persons: inOrg(state.persons).filter((p) => p.household_id === householdId),
    accounts,
    ownership: inOrg(state.account_ownership).filter((o) => accountIds.has(o.account_id)),
    beneficiaries: inOrg(state.beneficiary_designations).filter((b) => accountIds.has(b.account_id)),
    documents: docs,
    locations: inOrg(state.source_locations).filter((l) => docIds.has(l.document_id)),
    facts,
    activeFacts: facts.filter((f) => !f.superseded),
    conflicts: inOrg(state.fact_conflicts).filter((c) => c.household_id === householdId),
    assumptionSets,
    assumptions: inOrg(state.assumptions).filter((a) => setIds.has(a.assumption_set_id)),
    imports: inOrg(state.plan_imports).filter((i) => i.household_id === householdId).sort((a, b) => b.imported_at.localeCompare(a.imported_at)),
    importedValues: inOrg(state.imported_plan_values).filter((v) => v.household_id === householdId),
    snapshots,
    currentSnapshot: snapshots.find((s) => s.status === "FROZEN") ?? null,
    checkRuns,
    discrepancies: inOrg(state.discrepancies).filter((d) => checkRunIds.has(d.check_run_id)),
    reviews: inOrg(state.reviews).filter((r) => r.household_id === householdId).sort((a, b) => a.reviewed_at.localeCompare(b.reviewed_at)),
    comments: inOrg(state.review_comments).filter((c) => c.household_id === householdId).sort((a, b) => a.created_at.localeCompare(b.created_at)),
    packets: inOrg(state.evidence_packets).filter((p) => p.household_id === householdId).sort((a, b) => b.generated_at.localeCompare(a.generated_at)),
    audit: inOrg(state.audit_events).filter((e) => householdEntityIds.has(e.entity_id) || e.summary.includes(householdId)),
  };
}

export function personLabel(bundle: Pick<HouseholdBundle, "persons">, personId: string): string {
  return bundle.persons.find((p) => p.id === personId)?.display_name ?? personId;
}

export function accountLabel(bundle: Pick<HouseholdBundle, "accounts">, accountId: string): string {
  return bundle.accounts.find((a) => a.id === accountId)?.label ?? accountId;
}

export function subjectLabel(bundle: Pick<HouseholdBundle, "persons" | "accounts" | "household">, subjectType: string, subjectId: string): string {
  if (subjectType === "PERSON") return personLabel(bundle, subjectId);
  if (subjectType === "ACCOUNT") return accountLabel(bundle, subjectId);
  return bundle.household.label;
}

export function factDisplayValue(f: Fact): string {
  switch (f.value_kind) {
    case "NUMBER":
      return f.value_number ?? "";
    case "DATE":
      return f.value_date ?? "";
    case "BOOL":
      return f.value_bool === null ? "" : f.value_bool ? "Yes" : "No";
    default:
      return f.value_text ?? "";
  }
}

export function openConflicts(bundle: Pick<HouseholdBundle, "conflicts">): FactConflict[] {
  return bundle.conflicts.filter((c) => c.status === "OPEN");
}
