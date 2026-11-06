import { z } from "zod";
import { DecimalString, normalizeMoney, type DataState, type PersonalProfile, type Principal, type RetirementIntake, type Workspace, type WorkspaceMembership } from "@sagespan/contracts";
import { DomainError } from "../errors";
import { newId, nowIso } from "../ids";

/**
 * "Start fresh" guided intake (PERS-002b).
 *
 * Creates a new simulated principal with their own PERSONAL or HOUSEHOLD
 * workspace, an OWNER membership, an empty profile with the user's own
 * guardrails, and a retirement intake in which every field is MISSING. No
 * records are invented: the discovery steps that follow add records through the
 * same create/update/retire functions the record forms use, and anything left
 * blank stays MISSING. The engine then returns INSUFFICIENT_DATA until the
 * basics exist; it never guesses.
 *
 * Demo identity only (synthetic, cookie-selected). Real sign-up, consent and
 * household invitations arrive with PR-003 / DATA-001.
 */
export const StartFreshSchema = z.strictObject({
  display_name: z.string().trim().min(1, "required").max(60),
  workspace_kind: z.enum(["PERSONAL", "HOUSEHOLD"]),
  household_size: z.number().int().min(1).max(12),
  situation: z.string().trim().max(240).default(""),
  top_concern: z.string().trim().max(240).nullable().default(null),
  /** The user's own floor; required because every recommendation treats it as a hard constraint. */
  cash_floor: DecimalString.refine((v) => !v.startsWith("-"), "cannot be negative"),
  buffer_target_months: z.string().regex(/^\d+(\.\d{1,2})?$/, "months, e.g. 2 or 2.5").refine((v) => Number(v) <= 36, "at most 36").nullable().default(null),
});
export type StartFreshInput = z.infer<typeof StartFreshSchema>;

export interface StartFreshResult {
  principal: Principal;
  workspace: Workspace;
  membership: WorkspaceMembership;
}

const RETIREMENT_FIELDS = ["current_age", "target_retirement_age", "annual_retirement_spending", "retirement_assets_total", "annual_contributions", "expected_pension_annual", "social_security_estimate_annual"] as const;

export function startFreshWorkspace(state: DataState, raw: unknown): StartFreshResult {
  const parsed = StartFreshSchema.safeParse(raw);
  if (!parsed.success) throw new DomainError("VALIDATION", parsed.error.issues.map((i) => `${i.path.join(".") || "intake"}: ${i.message}`).join("; "));
  const input = parsed.data;
  if (input.workspace_kind === "HOUSEHOLD" && input.household_size < 2) throw new DomainError("VALIDATION", "A household workspace needs at least two people.");
  const now = nowIso();
  const principal: Principal = { id: newId("pr"), display_name: input.display_name, simulated: true };
  const workspace: Workspace = { id: newId("ws"), kind: input.workspace_kind, label: input.workspace_kind === "HOUSEHOLD" ? `${input.display_name}'s household` : `${input.display_name}'s finances`, owner_principal_id: principal.id, firm_org_id: null, created_at: now };
  const membership: WorkspaceMembership = { id: newId("wm"), workspace_id: workspace.id, principal_id: principal.id, role: "OWNER", domains: [], status: "ACTIVE", created_at: now };
  const profile: PersonalProfile = {
    workspace_id: workspace.id,
    principal_id: principal.id,
    household_size: input.household_size,
    situation: input.situation,
    top_concern: input.top_concern,
    cash_floor: normalizeMoney(input.cash_floor),
    buffer_target_months: input.buffer_target_months,
    extra_debt_payment_monthly: "0.00",
    notification_mode: "NORMAL",
    updated_at: now,
  };
  const retirement: RetirementIntake = {
    workspace_id: workspace.id,
    current_age: null,
    target_retirement_age: null,
    annual_retirement_spending: null,
    retirement_assets_total: null,
    retirement_assets_as_of: null,
    annual_contributions: null,
    expected_pension_annual: null,
    social_security_estimate_annual: null,
    social_security_estimate_source: null,
    life_span_range: null,
    states: Object.fromEntries(RETIREMENT_FIELDS.map((f) => [f, "MISSING" as const])),
    updated_at: now,
  };
  state.principals.push(principal);
  state.workspaces.push(workspace);
  state.workspace_memberships.push(membership);
  state.personal_profiles.push(profile);
  state.retirement_intakes.push(retirement);
  return { principal, workspace, membership };
}

/** Intake step order, shared by the wizard pages and the progress indicator. */
export const INTAKE_STEPS = [
  { key: "welcome", label: "Welcome" },
  { key: "income", label: "Income" },
  { key: "bills", label: "Bills" },
  { key: "spending", label: "Spending" },
  { key: "cash-debts", label: "Cash & debts" },
  { key: "goals", label: "Goals" },
  { key: "verify", label: "Verify" },
  { key: "baseline", label: "Baseline" },
] as const;
export type IntakeStep = (typeof INTAKE_STEPS)[number]["key"];
