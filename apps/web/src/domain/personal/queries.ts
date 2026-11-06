import type { CashAccount, ConsentGrant, DataState, IncomeStream, Liability, PersonalCalcRun, PersonalProfile, PersonalSnapshot, RecurringObligation, RetirementIntake, SavingsGoal, UserDecisionEvent, VariableSpendingPattern, Workspace, WorkspaceMembership } from "@sagespan/contracts";
import type { PersonalActor } from "@/auth/personal-actor";
import { NotFoundError } from "@/auth/types";

/**
 * Workspace-scoped reads for the Personal experience. Every helper takes the
 * server-resolved actor and filters by ITS workspace_id; a record from any other
 * workspace is indistinguishable from "does not exist". Firm actors have no
 * entry point here at all (see docs/architecture/DUAL_WORKSPACE_ADR.md).
 */
export interface PersonalBundle {
  workspace: Workspace;
  membership: WorkspaceMembership;
  profile: PersonalProfile;
  cashAccounts: CashAccount[];
  incomeStreams: IncomeStream[];
  obligations: RecurringObligation[];
  variableSpending: VariableSpendingPattern[];
  liabilities: Liability[];
  goals: SavingsGoal[];
  retirement: RetirementIntake | null;
  currentSnapshot: PersonalSnapshot | null;
  snapshots: PersonalSnapshot[];
  runs: PersonalCalcRun[];
  decisions: UserDecisionEvent[];
  grants: ConsentGrant[];
  memberships: WorkspaceMembership[];
}

export function requireWorkspace(state: DataState, actor: PersonalActor): Workspace {
  const ws = state.workspaces.find((w) => w.id === actor.workspace_id && w.kind !== "FIRM");
  const membership = state.workspace_memberships.find((m) => m.workspace_id === actor.workspace_id && m.principal_id === actor.principal_id && m.status === "ACTIVE");
  if (!ws || !membership) throw new NotFoundError();
  return ws;
}

export function personalBundle(state: DataState, actor: PersonalActor): PersonalBundle {
  const workspace = requireWorkspace(state, actor);
  const id = workspace.id;
  const membership = state.workspace_memberships.find((m) => m.workspace_id === id && m.principal_id === actor.principal_id && m.status === "ACTIVE")!;
  const profile = state.personal_profiles.find((p) => p.workspace_id === id);
  if (!profile) throw new NotFoundError();
  const snapshots = state.personal_snapshots.filter((s) => s.workspace_id === id).sort((a, b) => b.revision - a.revision);
  return {
    workspace,
    membership,
    profile,
    cashAccounts: state.cash_accounts.filter((a) => a.workspace_id === id && !a.superseded),
    incomeStreams: state.income_streams.filter((s) => s.workspace_id === id),
    obligations: state.recurring_obligations.filter((o) => o.workspace_id === id),
    variableSpending: state.variable_spending.filter((v) => v.workspace_id === id),
    liabilities: state.liabilities.filter((l) => l.workspace_id === id),
    goals: state.savings_goals.filter((g) => g.workspace_id === id),
    retirement: state.retirement_intakes.find((r) => r.workspace_id === id) ?? null,
    currentSnapshot: snapshots.find((s) => s.status === "CURRENT") ?? null,
    snapshots,
    runs: state.personal_calc_runs.filter((r) => r.workspace_id === id).sort((a, b) => (a.executed_at < b.executed_at ? 1 : -1)),
    decisions: state.user_decisions.filter((d) => d.workspace_id === id),
    grants: state.consent_grants.filter((g) => g.grantor_workspace_id === id),
    memberships: state.workspace_memberships.filter((m) => m.workspace_id === id),
  };
}

/** Human labels for engine refs (record ids) so cards and findings read in plain language. */
export function personalLabels(b: PersonalBundle): Record<string, string> {
  const out: Record<string, string> = {};
  for (const a of b.cashAccounts) out[a.account_ref] = a.label;
  for (const s of b.incomeStreams) out[s.id] = s.label;
  for (const o of b.obligations) out[o.id] = o.label;
  for (const l of b.liabilities) out[l.id] = l.label;
  for (const g of b.goals) out[g.id] = g.label;
  for (const v of b.variableSpending) out[v.id] = v.category;
  return out;
}

/** Latest run of a given type for the CURRENT snapshot, or null. Runs for superseded snapshots are history, never reused. */
export function currentRun(b: PersonalBundle, checkType: PersonalCalcRun["check_type"]): PersonalCalcRun | null {
  if (!b.currentSnapshot) return null;
  return b.runs.find((r) => r.snapshot_id === b.currentSnapshot!.id && r.check_type === checkType) ?? null;
}

/** The latest user decision per recommendation id (append-only events, newest wins). */
export function latestDecisions(b: PersonalBundle): Map<string, UserDecisionEvent> {
  const map = new Map<string, UserDecisionEvent>();
  for (const d of [...b.decisions].sort((a, z) => (a.created_at < z.created_at ? -1 : 1))) map.set(d.recommendation_id, d);
  return map;
}
