import { z } from "zod";
import { DecimalString, IsoDate } from "./calc";
import { CADENCES, INCOME_KINDS, OBLIGATION_CATEGORIES, RATE_TYPES, RELIABILITIES } from "./personal";

/**
 * Shared validation for user-entered personal records (PERS-002a).
 *
 * These schemas are the single definition of what a well-formed record looks
 * like; the server action parses the form with them, tests exercise them, and
 * the engine mirror (personal-calc.ts) is downstream of them. They validate
 * shape and ranges only: no totals, no derived figures. Anything the user left
 * blank is simply absent here; the record keeps its data state (MISSING stays
 * MISSING) and the engine, not this tier, decides what that means.
 */
export const PERSONAL_RECORD_TYPES = ["CASH_ACCOUNT", "INCOME_STREAM", "OBLIGATION", "VARIABLE_SPENDING", "LIABILITY", "GOAL"] as const;
export type PersonalRecordType = (typeof PERSONAL_RECORD_TYPES)[number];

export const PERSONAL_RECORD_TYPE_LABELS: Record<PersonalRecordType, string> = {
  CASH_ACCOUNT: "Cash account",
  INCOME_STREAM: "Income stream",
  OBLIGATION: "Recurring commitment",
  VARIABLE_SPENDING: "Spending category",
  LIABILITY: "Debt",
  GOAL: "Goal",
};

const NonNegativeMoney = DecimalString.refine((v) => !v.startsWith("-"), "cannot be negative");
const Label = z.string().trim().min(1, "required").max(80);
const YearMonth = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "use YYYY-MM");

/** Observed monthly amounts, oldest first. Up to 24 months; the engine needs 3 for a pattern and says so itself. */
export const ObservedMonths = z.array(NonNegativeMoney).max(24);

export const CASH_ACCOUNT_KINDS = ["CHECKING", "SAVINGS", "CASH", "OTHER_LIQUID", "RETIREMENT", "INVESTMENT", "OTHER"] as const;
export const LIABILITY_KINDS = ["CREDIT_CARD", "AUTO_LOAN", "STUDENT_LOAN", "PERSONAL_LOAN", "MORTGAGE", "MEDICAL", "OTHER"] as const;
export const GOAL_KINDS = ["EMERGENCY_RESERVE", "MOVE", "EDUCATION", "HOME", "MEDICAL", "CAREGIVING", "TRAVEL", "RETIREMENT", "OTHER"] as const;

export const CashAccountWriteSchema = z.strictObject({
  label: Label,
  kind: z.enum(CASH_ACCOUNT_KINDS),
  balance: NonNegativeMoney,
  balance_as_of: IsoDate,
  /** Derived from kind when omitted: checking/savings/cash/other liquid count toward the buffer. */
  liquid: z.boolean().optional(),
});
export type CashAccountWrite = z.infer<typeof CashAccountWriteSchema>;

export const IncomeStreamWriteSchema = z
  .strictObject({
    label: Label,
    kind: z.enum(INCOME_KINDS),
    cadence: z.enum(CADENCES),
    reliability: z.enum(RELIABILITIES),
    observed_monthly_amounts: ObservedMonths,
    observed_from: YearMonth.nullable().optional(),
    observed_to: YearMonth.nullable().optional(),
    expected_amount: NonNegativeMoney.nullable().optional(),
    next_expected_date: IsoDate.nullable().optional(),
  })
  .superRefine((s, ctx) => {
    if (s.observed_from && s.observed_to && s.observed_from > s.observed_to) ctx.addIssue({ code: "custom", path: ["observed_to"], message: "must not be before observed_from" });
    if (s.cadence === "ONE_TIME" && s.expected_amount == null) ctx.addIssue({ code: "custom", path: ["expected_amount"], message: "a one-time payment needs its amount" });
  });
export type IncomeStreamWrite = z.infer<typeof IncomeStreamWriteSchema>;

export const ObligationWriteSchema = z.strictObject({
  label: Label,
  category: z.enum(OBLIGATION_CATEGORIES),
  amount: NonNegativeMoney,
  cadence: z.enum(CADENCES),
  next_due_date: IsoDate,
  essential: z.boolean(),
  /** Id of the liability this payment is the minimum for, if any. Validated against the workspace by the server. */
  liability_id: z.string().min(1).nullable().optional(),
});
export type ObligationWrite = z.infer<typeof ObligationWriteSchema>;

export const VariableSpendingWriteSchema = z.strictObject({
  category: Label,
  observed_monthly_amounts: ObservedMonths,
  essential: z.boolean(),
  transfers_excluded: z.boolean(),
});
export type VariableSpendingWrite = z.infer<typeof VariableSpendingWriteSchema>;

export const LiabilityWriteSchema = z
  .strictObject({
    label: Label,
    kind: z.enum(LIABILITY_KINDS),
    balance: NonNegativeMoney,
    balance_as_of: IsoDate,
    apr_percent: DecimalString.refine((v) => Number(v) >= 0 && Number(v) <= 100, "0 to 100"),
    minimum_payment: NonNegativeMoney,
    rate_type: z.enum(RATE_TYPES),
    promo_apr_percent: DecimalString.refine((v) => Number(v) >= 0 && Number(v) <= 100, "0 to 100").nullable().optional(),
    promo_apr_expires: IsoDate.nullable().optional(),
    due_day_of_month: z.number().int().min(1).max(31).nullable().optional(),
  })
  .superRefine((l, ctx) => {
    if (l.rate_type === "PROMOTIONAL" && (l.promo_apr_percent == null || l.promo_apr_expires == null)) ctx.addIssue({ code: "custom", path: ["promo_apr_percent"], message: "a promotional rate needs the promo APR and its expiry date" });
  });
export type LiabilityWrite = z.infer<typeof LiabilityWriteSchema>;

export const GoalWriteSchema = z.strictObject({
  label: Label,
  kind: z.enum(GOAL_KINDS),
  target_amount: NonNegativeMoney,
  saved_amount: NonNegativeMoney,
  target_date: IsoDate.nullable().optional(),
  monthly_contribution: NonNegativeMoney.nullable().optional(),
  funded_from_account_id: z.string().min(1).nullable().optional(),
});
export type GoalWrite = z.infer<typeof GoalWriteSchema>;

export const PERSONAL_RECORD_WRITE_SCHEMAS = {
  CASH_ACCOUNT: CashAccountWriteSchema,
  INCOME_STREAM: IncomeStreamWriteSchema,
  OBLIGATION: ObligationWriteSchema,
  VARIABLE_SPENDING: VariableSpendingWriteSchema,
  LIABILITY: LiabilityWriteSchema,
  GOAL: GoalWriteSchema,
} as const;

/**
 * Append-only history of every write to a personal record. `before`/`after`
 * are the record as stored (after is null for a retirement). Never edited,
 * never deleted; the current record is derivable from the chain, and a retired
 * record stays in the collections flagged `retired` so old runs keep resolving
 * their refs.
 */
export const PERSONAL_RECORD_CHANGES = ["CREATE", "UPDATE", "RETIRE"] as const;
export type PersonalRecordChange = (typeof PERSONAL_RECORD_CHANGES)[number];

export interface PersonalRecordRevision {
  id: string;
  workspace_id: string;
  record_type: PersonalRecordType;
  /** Stable record identity (the engine ref): account_ref for cash accounts, id for the others. */
  record_ref: string;
  revision: number;
  change: PersonalRecordChange;
  before: unknown | null;
  after: unknown | null;
  changed_by: string;
  created_at: string;
}
