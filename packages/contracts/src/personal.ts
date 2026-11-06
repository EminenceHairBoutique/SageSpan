import type { ShareDomain } from "./workspace";

/**
 * Personal (B2C) domain records. Every row carries `workspace_id`; the web tier
 * scopes every read and write by the actor's workspace (never by a client
 * supplied id). Facts are typed, dated and carry one of the V5 data states.
 *
 * Money is a decimal string. No arithmetic happens in this tier: baselines,
 * margins, buffers, outlooks and debt comparisons are computed by the Python
 * calculation service and rendered from its receipted responses.
 */
export const PERSONAL_DATA_STATES = ["USER_REPORTED", "EVIDENCE_VERIFIED", "ASSUMED", "MISSING", "STALE", "CONFLICTING"] as const;
export type PersonalDataState = (typeof PERSONAL_DATA_STATES)[number];

export const PERSONAL_DATA_STATE_LABELS: Record<PersonalDataState, string> = {
  USER_REPORTED: "You reported",
  EVIDENCE_VERIFIED: "Verified from a document",
  ASSUMED: "Assumed",
  MISSING: "Missing",
  STALE: "Needs a fresh value",
  CONFLICTING: "Two values disagree",
};

export const CADENCES = ["WEEKLY", "BIWEEKLY", "MONTHLY", "QUARTERLY", "ANNUAL", "ONE_TIME"] as const;
export type Cadence = (typeof CADENCES)[number];

export const INCOME_KINDS = ["SALARY", "HOURLY", "VARIABLE_PAY", "SELF_EMPLOYMENT", "BENEFIT", "PENSION", "RENTAL", "OTHER"] as const;
export type IncomeKind = (typeof INCOME_KINDS)[number];

export const RELIABILITIES = ["REGULAR", "VARIABLE", "IRREGULAR", "UNKNOWN"] as const;
export type Reliability = (typeof RELIABILITIES)[number];

export const OBLIGATION_CATEGORIES = ["HOUSING", "UTILITIES", "INSURANCE", "DEBT_MINIMUM", "SUBSCRIPTION", "TRANSPORT", "FOOD", "CHILDCARE", "HEALTH", "SAVINGS_TRANSFER", "OTHER"] as const;
export type ObligationCategory = (typeof OBLIGATION_CATEGORIES)[number];

export const RATE_TYPES = ["FIXED", "VARIABLE", "PROMOTIONAL"] as const;
export type RateType = (typeof RATE_TYPES)[number];

export interface PersonalProfile {
  workspace_id: string;
  principal_id: string;
  household_size: number;
  /** Plain-language description the user chose, e.g. "Freelance designer with a part-time job". */
  situation: string;
  /** What worries the user most, in their words. Drives tone, never arithmetic. */
  top_concern: string | null;
  /** User-chosen liquidity floor (decimal string). A hard constraint for recommendations. */
  cash_floor: string;
  /** User-chosen essential-expense buffer target in months, or null if not chosen. Never a universal rule. */
  buffer_target_months: string | null;
  /** User-chosen amount above minimums to explore in the debt comparison (decimal string). A scenario input, not a commitment. */
  extra_debt_payment_monthly: string;
  notification_mode: "NORMAL" | "QUIET";
  updated_at: string;
}

export interface CashAccount {
  /** Unique per revision. */
  id: string;
  /** Stable identity across revisions; the engine ref and the label key. */
  account_ref: string;
  workspace_id: string;
  label: string;
  kind: "CHECKING" | "SAVINGS" | "CASH" | "OTHER_LIQUID" | "RETIREMENT" | "INVESTMENT" | "OTHER";
  balance: string;
  currency: string;
  balance_as_of: string;
  liquid: boolean;
  data_state: PersonalDataState;
  revision: number;
  supersedes_id: string | null;
  superseded: boolean;
  created_at: string;
}

export interface IncomeStream {
  id: string;
  workspace_id: string;
  label: string;
  kind: IncomeKind;
  cadence: Cadence;
  reliability: Reliability;
  /** Net amounts received per calendar month, oldest first. */
  observed_monthly_amounts: string[];
  observed_from: string | null;
  observed_to: string | null;
  expected_amount: string | null;
  next_expected_date: string | null;
  data_state: PersonalDataState;
  /** Retired records stay stored (old runs cite them) but leave the live picture and every new snapshot. */
  retired: boolean;
}

export interface RecurringObligation {
  id: string;
  workspace_id: string;
  label: string;
  category: ObligationCategory;
  amount: string;
  cadence: Cadence;
  next_due_date: string;
  essential: boolean;
  liability_id: string | null;
  data_state: PersonalDataState;
  retired: boolean;
}

export interface VariableSpendingPattern {
  id: string;
  workspace_id: string;
  category: string;
  observed_monthly_amounts: string[];
  essential: boolean;
  /** Transfers/refunds excluded before these totals were recorded; set false when unknown. */
  transfers_excluded: boolean;
  data_state: PersonalDataState;
  retired: boolean;
}

export interface Liability {
  id: string;
  workspace_id: string;
  label: string;
  kind: "CREDIT_CARD" | "AUTO_LOAN" | "STUDENT_LOAN" | "PERSONAL_LOAN" | "MORTGAGE" | "MEDICAL" | "OTHER";
  balance: string;
  balance_as_of: string;
  apr_percent: string;
  minimum_payment: string;
  rate_type: RateType;
  promo_apr_percent: string | null;
  promo_apr_expires: string | null;
  due_day_of_month: number | null;
  data_state: PersonalDataState;
  retired: boolean;
}

export interface SavingsGoal {
  id: string;
  workspace_id: string;
  label: string;
  kind: "EMERGENCY_RESERVE" | "MOVE" | "EDUCATION" | "HOME" | "MEDICAL" | "CAREGIVING" | "TRAVEL" | "RETIREMENT" | "OTHER";
  target_amount: string;
  saved_amount: string;
  target_date: string | null;
  monthly_contribution: string | null;
  /** Which cash account the saved amount sits in, if the user said. */
  funded_from_account_id: string | null;
  retired: boolean;
}

/**
 * Retirement intake for the Retirement Studio readiness gate. The projection
 * engine (PLAN-001 / SCENARIO-001) is NOT implemented in this build; the gate
 * only reports what is known, assumed and missing so no false-confidence result
 * can be produced.
 */
export interface RetirementIntake {
  workspace_id: string;
  current_age: number | null;
  target_retirement_age: number | null;
  annual_retirement_spending: string | null;
  retirement_assets_total: string | null;
  retirement_assets_as_of: string | null;
  annual_contributions: string | null;
  expected_pension_annual: string | null;
  social_security_estimate_annual: string | null;
  social_security_estimate_source: "SSA_STATEMENT" | "USER_GUESS" | null;
  life_span_range: { low: number; high: number } | null;
  states: Record<string, PersonalDataState>;
  updated_at: string;
}

/** A dated, versioned personal snapshot the engines are called from (what the receipt's input_hash binds). */
export interface PersonalSnapshot {
  id: string;
  workspace_id: string;
  revision: number;
  as_of_date: string;
  content_sha256: string;
  created_at: string;
  created_by: string;
  status: "CURRENT" | "SUPERSEDED";
}

/** Receipted engine result stored verbatim; the web tier never recomputes it. */
export interface PersonalCalcRun {
  id: string;
  workspace_id: string;
  snapshot_id: string;
  check_type: "PERSONAL_CLARITY" | "DEBT_PATHS" | "PERSONAL_SCENARIO";
  request_sha256: string;
  request_hash_verified: boolean;
  engine_name: string | null;
  engine_version: string | null;
  method_set_versions: Record<string, string>;
  response: unknown;
  run_status: "COMPUTED" | "INSUFFICIENT_DATA" | "INFEASIBLE" | "ERROR";
  error: { code: string; message: string } | null;
  executed_at: string;
}

export const PERSONAL_DOMAIN_OF_RECORD: Record<"cash_accounts" | "income_streams" | "obligations" | "variable_spending" | "liabilities" | "goals" | "retirement", ShareDomain> = {
  cash_accounts: "CASH_FLOW",
  income_streams: "CASH_FLOW",
  obligations: "CASH_FLOW",
  variable_spending: "SPENDING",
  liabilities: "DEBT",
  goals: "SAVINGS_GOALS",
  retirement: "RETIREMENT",
};
