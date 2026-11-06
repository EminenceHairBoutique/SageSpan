import { z } from "zod";
import { DecimalString, IsoDate, ReceiptSchema, RuleSetRefSchema } from "./calc";
import { CADENCES, INCOME_KINDS, OBLIGATION_CATEGORIES, PERSONAL_DATA_STATES, RATE_TYPES, RELIABILITIES } from "./personal";

/**
 * Zod mirror of the Personal engine contracts in
 * services/calculator/app/schemas_personal.py (and the committed OpenAPI
 * document). Requests are strict objects: the web tier builds them from the
 * personal snapshot only and the service rejects unknown fields, including any
 * org/workspace claim in the body.
 */
export const SEVERITIES = ["INFO", "LOW", "MEDIUM", "HIGH"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const CashAccountInputSchema = z.strictObject({
  account_ref: z.string().min(1),
  label: z.string().nullable().optional(),
  balance: DecimalString,
  currency: z.string().length(3).default("USD"),
  balance_as_of: IsoDate,
  liquid: z.boolean().default(true),
  data_state: z.enum(PERSONAL_DATA_STATES).default("USER_REPORTED"),
});

export const IncomeStreamInputSchema = z.strictObject({
  stream_ref: z.string().min(1),
  label: z.string().nullable().optional(),
  kind: z.enum(INCOME_KINDS).default("OTHER"),
  cadence: z.enum(CADENCES).default("MONTHLY"),
  reliability: z.enum(RELIABILITIES).default("UNKNOWN"),
  observed_monthly_amounts: z.array(DecimalString).default([]),
  expected_amount: DecimalString.nullable().optional(),
  next_expected_date: IsoDate.nullable().optional(),
  data_state: z.enum(PERSONAL_DATA_STATES).default("USER_REPORTED"),
});

export const ObligationInputSchema = z.strictObject({
  obligation_ref: z.string().min(1),
  label: z.string().nullable().optional(),
  category: z.enum(OBLIGATION_CATEGORIES).default("OTHER"),
  amount: DecimalString,
  cadence: z.enum(CADENCES).default("MONTHLY"),
  next_due_date: IsoDate,
  essential: z.boolean().default(true),
  liability_ref: z.string().nullable().optional(),
  data_state: z.enum(PERSONAL_DATA_STATES).default("USER_REPORTED"),
});

export const VariableSpendingInputSchema = z.strictObject({
  category: z.string().min(1),
  observed_monthly_amounts: z.array(DecimalString).default([]),
  essential: z.boolean().default(false),
  data_state: z.enum(PERSONAL_DATA_STATES).default("USER_REPORTED"),
});

export const LiabilityInputSchema = z.strictObject({
  liability_ref: z.string().min(1),
  label: z.string().nullable().optional(),
  balance: DecimalString,
  apr_percent: DecimalString,
  minimum_payment: DecimalString,
  rate_type: z.enum(RATE_TYPES).default("FIXED"),
  promo_apr_percent: DecimalString.nullable().optional(),
  promo_apr_expires: IsoDate.nullable().optional(),
  due_day_of_month: z.number().int().min(1).max(31).nullable().optional(),
  data_state: z.enum(PERSONAL_DATA_STATES).default("USER_REPORTED"),
});

export const GoalInputSchema = z.strictObject({
  goal_ref: z.string().min(1),
  label: z.string().min(1),
  target_amount: DecimalString,
  saved_amount: DecimalString.default("0"),
  target_date: IsoDate.nullable().optional(),
  monthly_contribution: DecimalString.nullable().optional(),
});

export const LiquidityPolicySchema = z.strictObject({
  cash_floor: DecimalString,
  buffer_target_months: DecimalString.nullable().optional(),
});

export const PersonalClarityRequestSchema = z.strictObject({
  schema_version: z.literal("sagespan.personal-clarity.v1"),
  as_of_date: IsoDate,
  horizon_days: z.number().int().min(30).max(180).default(90),
  policy: LiquidityPolicySchema,
  cash_accounts: z.array(CashAccountInputSchema).default([]),
  income_streams: z.array(IncomeStreamInputSchema).default([]),
  obligations: z.array(ObligationInputSchema).default([]),
  variable_spending: z.array(VariableSpendingInputSchema).default([]),
  liabilities: z.array(LiabilityInputSchema).default([]),
  goals: z.array(GoalInputSchema).default([]),
  workspace_ref: z.string().nullable().optional(),
  input_hash: z
    .string()
    .regex(/^[0-9a-f]{64}$/)
    .nullable()
    .optional(),
});
export type PersonalClarityRequest = z.infer<typeof PersonalClarityRequestSchema>;

export const FlagSchema = z.object({ code: z.string(), severity: z.enum(SEVERITIES), message: z.string(), refs: z.array(z.string()).default([]) });
export type Flag = z.infer<typeof FlagSchema>;

export const DataQualityItemSchema = z.object({ ref: z.string(), state: z.enum(PERSONAL_DATA_STATES), note: z.string().nullable().optional() });

export const OutlookEventSchema = z.object({
  date: IsoDate,
  ref: z.string(),
  kind: z.enum(["INCOME", "OBLIGATION", "DISCRETIONARY"]),
  amount: DecimalString,
  essential: z.boolean().nullable().optional(),
});

export const OutlookSchema = z.object({
  horizon_days: z.number().int(),
  start_cash: DecimalString,
  lowest_projected_cash: DecimalString,
  lowest_projected_date: IsoDate,
  end_projected_cash: DecimalString,
  floor_breach_dates: z.array(IsoDate).default([]),
  first_floor_breach_date: IsoDate.nullable().optional(),
  collisions: z.array(z.object({ window_start: IsoDate, window_end: IsoDate, total_due: DecimalString, refs: z.array(z.string()) })).default([]),
  points: z.array(z.object({ date: IsoDate, projected_cash: DecimalString, events: z.array(OutlookEventSchema).default([]) })).default([]),
});
export type Outlook = z.infer<typeof OutlookSchema>;

export const PersonalClarityResponseSchema = z.object({
  check_type: z.literal("PERSONAL_CLARITY"),
  result_status: z.enum(["COMPUTED", "INSUFFICIENT_DATA"]),
  as_of_date: IsoDate,
  income: z.object({
    observed_months: z.number().int(),
    typical_monthly: DecimalString.nullable().optional(),
    low_monthly: DecimalString.nullable().optional(),
    high_monthly: DecimalString.nullable().optional(),
    spread_ratio: DecimalString.nullable().optional(),
    classification: z.enum(RELIABILITIES),
  }),
  commitments: z.object({
    monthly_essential: DecimalString,
    monthly_discretionary_typical: DecimalString,
    monthly_debt_minimums: DecimalString,
    essential_items: z.number().int(),
    discretionary_items: z.number().int(),
  }),
  margin: z.object({ typical: DecimalString.nullable().optional(), low: DecimalString.nullable().optional(), essential_only_low: DecimalString.nullable().optional() }),
  cash: z.object({
    liquid_total: DecimalString,
    cash_floor: DecimalString,
    above_floor: DecimalString,
    essential_buffer_months: DecimalString.nullable().optional(),
    buffer_target_months: DecimalString.nullable().optional(),
    buffer_gap_amount: DecimalString.nullable().optional(),
  }),
  debt: z.object({
    liability_count: z.number().int(),
    total_balance: DecimalString,
    total_minimums: DecimalString,
    highest_apr_percent: DecimalString.nullable().optional(),
    highest_apr_ref: z.string().nullable().optional(),
    balance_weighted_apr_percent: DecimalString.nullable().optional(),
  }),
  outlook: OutlookSchema,
  goals: z
    .array(
      z.object({
        goal_ref: z.string(),
        label: z.string(),
        target_amount: DecimalString,
        saved_amount: DecimalString,
        remaining_amount: DecimalString,
        months_to_target_at_contribution: z.number().int().nullable().optional(),
        on_track_for_target_date: z.boolean().nullable().optional(),
      }),
    )
    .default([]),
  flags: z.array(FlagSchema).default([]),
  data_quality: z.array(DataQualityItemSchema).default([]),
  receipt: ReceiptSchema,
});
export type PersonalClarityResponse = z.infer<typeof PersonalClarityResponseSchema>;

export const DEBT_STRATEGIES = ["MINIMUMS_ONLY", "AVALANCHE", "SNOWBALL", "HYBRID"] as const;
export type DebtStrategy = (typeof DEBT_STRATEGIES)[number];
export const DEBT_STRATEGY_LABELS: Record<DebtStrategy, string> = {
  MINIMUMS_ONLY: "Minimums only",
  AVALANCHE: "Highest rate first",
  SNOWBALL: "Smallest balance first",
  HYBRID: "Small balances, then highest rate",
};

export const DebtPathsRequestSchema = z.strictObject({
  schema_version: z.literal("sagespan.debt-paths.v1"),
  as_of_date: IsoDate,
  liabilities: z.array(LiabilityInputSchema).min(1),
  /** Exactly one of monthly_debt_budget / extra_monthly_payment (the service enforces it). The web tier uses extra_monthly_payment so it never sums money. */
  monthly_debt_budget: DecimalString.nullable().optional(),
  extra_monthly_payment: DecimalString.nullable().optional(),
  policy: LiquidityPolicySchema,
  /** Either a total or the accounts (the service totals the liquid ones). */
  liquid_cash: DecimalString.nullable().optional(),
  cash_accounts: z.array(CashAccountInputSchema).default([]),
  strategies: z.array(z.enum(DEBT_STRATEGIES)).default(["MINIMUMS_ONLY", "AVALANCHE", "SNOWBALL"]),
  max_months: z.number().int().min(1).max(600).default(600),
  workspace_ref: z.string().nullable().optional(),
  input_hash: z
    .string()
    .regex(/^[0-9a-f]{64}$/)
    .nullable()
    .optional(),
});
export type DebtPathsRequest = z.infer<typeof DebtPathsRequestSchema>;

export const StrategyResultSchema = z.object({
  strategy: z.enum(DEBT_STRATEGIES),
  feasible: z.boolean(),
  infeasible_reason: z.string().nullable().optional(),
  months_to_payoff: z.number().int().nullable().optional(),
  payoff_date: IsoDate.nullable().optional(),
  total_interest: DecimalString,
  total_paid: DecimalString,
  payoff_order: z.array(z.object({ liability_ref: z.string(), month_index: z.number().int(), payoff_date: IsoDate })).default([]),
  first_year: z.array(z.object({ month_index: z.number().int(), month_start: IsoDate, opening_total_balance: DecimalString, interest: DecimalString, payment: DecimalString, closing_total_balance: DecimalString })).default([]),
  interest_saved_vs_minimums: DecimalString.nullable().optional(),
  months_saved_vs_minimums: z.number().int().nullable().optional(),
});
export type StrategyResult = z.infer<typeof StrategyResultSchema>;

export const DebtPathsResponseSchema = z.object({
  check_type: z.literal("DEBT_PATHS"),
  result_status: z.enum(["COMPUTED", "INFEASIBLE"]),
  as_of_date: IsoDate,
  liquidity_guard: z.object({
    liquid_cash: DecimalString,
    cash_floor: DecimalString,
    headroom: DecimalString,
    floor_respected: z.boolean(),
    budget_covers_minimums: z.boolean(),
    total_minimums: DecimalString,
    extra_per_month: DecimalString,
  }),
  results: z.array(StrategyResultSchema),
  assumptions: z.array(z.string()).default([]),
  flags: z.array(FlagSchema).default([]),
  receipt: ReceiptSchema,
});
export type DebtPathsResponse = z.infer<typeof DebtPathsResponseSchema>;

export const MethodSetListResponseSchema = z.object({ method_sets: z.array(RuleSetRefSchema), engine_name: z.string(), engine_version: z.string() });

// ---------------------------------------------------------------- what-if scenarios (PERS-002c)
export const PERSONAL_SCENARIO_KINDS = ["SPENDING_CHANGE", "SAVINGS_CHANGE", "INCOME_INTERRUPTION"] as const;
export type PersonalScenarioKind = (typeof PERSONAL_SCENARIO_KINDS)[number];
export const PERSONAL_SCENARIO_KIND_LABELS: Record<PersonalScenarioKind, string> = {
  SPENDING_CHANGE: "Spend more or less each month",
  SAVINGS_CHANGE: "Set aside more each month",
  INCOME_INTERRUPTION: "One income stream stops for a while",
};
export const SAVINGS_DESTINATIONS = ["LIQUID", "ILLIQUID"] as const;

/**
 * Exactly one bounded change. The service validates which fields belong to which
 * kind; this mirror enforces the same so a bad form never reaches the engine.
 */
export const ScenarioSpecSchema = z
  .strictObject({
    kind: z.enum(PERSONAL_SCENARIO_KINDS),
    monthly_amount: DecimalString.nullable().optional(),
    goal_ref: z.string().min(1).nullable().optional(),
    destination: z.enum(SAVINGS_DESTINATIONS).nullable().optional(),
    stream_ref: z.string().min(1).nullable().optional(),
    months: z.number().int().min(1).max(12).nullable().optional(),
    start_date: IsoDate.nullable().optional(),
  })
  .superRefine((s, ctx) => {
    const allowed: Record<PersonalScenarioKind, string[]> = {
      SPENDING_CHANGE: ["monthly_amount"],
      SAVINGS_CHANGE: ["monthly_amount", "goal_ref", "destination", "start_date"],
      INCOME_INTERRUPTION: ["stream_ref", "months", "start_date"],
    };
    for (const k of ["monthly_amount", "goal_ref", "destination", "stream_ref", "months", "start_date"] as const) {
      if (s[k] != null && !allowed[s.kind].includes(k)) ctx.addIssue({ code: "custom", path: [k], message: `not valid for ${s.kind}` });
    }
    if (s.kind !== "INCOME_INTERRUPTION" && s.monthly_amount == null) ctx.addIssue({ code: "custom", path: ["monthly_amount"], message: "required" });
    if (s.kind === "SPENDING_CHANGE" && s.monthly_amount != null && Number(s.monthly_amount) === 0) ctx.addIssue({ code: "custom", path: ["monthly_amount"], message: "must be non-zero" });
    if (s.kind === "SAVINGS_CHANGE" && s.monthly_amount != null && !(Number(s.monthly_amount) > 0)) ctx.addIssue({ code: "custom", path: ["monthly_amount"], message: "must be positive" });
    if (s.kind === "INCOME_INTERRUPTION" && (s.stream_ref == null || s.months == null)) ctx.addIssue({ code: "custom", path: ["stream_ref"], message: "stream_ref and months are required" });
  });
export type ScenarioSpec = z.infer<typeof ScenarioSpecSchema>;

export const PersonalScenarioRequestSchema = z.strictObject({
  schema_version: z.literal("sagespan.personal-scenario.v1"),
  baseline: PersonalClarityRequestSchema,
  scenario: ScenarioSpecSchema,
  workspace_ref: z.string().nullable().optional(),
  input_hash: z.string().regex(/^[0-9a-f]{64}$/).nullable().optional(),
});
export type PersonalScenarioRequest = z.infer<typeof PersonalScenarioRequestSchema>;

export const ScenarioMetricsSchema = z.object({
  income_typical_monthly: DecimalString.nullable().optional(),
  income_low_monthly: DecimalString.nullable().optional(),
  monthly_essential: DecimalString,
  monthly_discretionary_typical: DecimalString,
  margin_typical: DecimalString.nullable().optional(),
  margin_low: DecimalString.nullable().optional(),
  margin_essential_only_low: DecimalString.nullable().optional(),
  liquid_total: DecimalString,
  essential_buffer_months: DecimalString.nullable().optional(),
  lowest_projected_cash: DecimalString,
  lowest_projected_date: IsoDate,
  end_projected_cash: DecimalString,
  first_floor_breach_date: IsoDate.nullable().optional(),
});
export type ScenarioMetrics = z.infer<typeof ScenarioMetricsSchema>;

export const PersonalScenarioResponseSchema = z.object({
  check_type: z.literal("PERSONAL_SCENARIO"),
  result_status: z.enum(["COMPUTED", "INSUFFICIENT_DATA", "INFEASIBLE"]),
  infeasible_reason: z.string().nullable().optional(),
  as_of_date: IsoDate,
  scenario: ScenarioSpecSchema,
  baseline_metrics: ScenarioMetricsSchema,
  scenario_metrics: ScenarioMetricsSchema,
  delta: z.object({
    margin_typical: DecimalString.nullable().optional(),
    margin_low: DecimalString.nullable().optional(),
    monthly_discretionary_typical: DecimalString.nullable().optional(),
    lowest_projected_cash: DecimalString.nullable().optional(),
    end_projected_cash: DecimalString.nullable().optional(),
  }),
  interruption: z
    .object({
      stream_ref: z.string(),
      start_date: IsoDate,
      end_date: IsoDate,
      months: z.number().int(),
      stream_typical_monthly: DecimalString.nullable().optional(),
      income_forgone_typical: DecimalString.nullable().optional(),
      payments_skipped_in_horizon: z.number().int(),
      amount_skipped_in_horizon: DecimalString,
      cash_above_floor: DecimalString,
      margin_typical_during: DecimalString,
      margin_essential_only_during: DecimalString,
      runway_months_typical_spending: DecimalString.nullable().optional(),
      runway_months_essentials_only: DecimalString.nullable().optional(),
      cash_above_floor_covers_interruption: z.boolean(),
      horizon_covers_interruption: z.boolean(),
    })
    .nullable()
    .optional(),
  goal_changes: z
    .array(
      z.object({
        goal_ref: z.string(),
        label: z.string(),
        baseline_months_to_target: z.number().int().nullable().optional(),
        scenario_months_to_target: z.number().int().nullable().optional(),
        baseline_on_track: z.boolean().nullable().optional(),
        scenario_on_track: z.boolean().nullable().optional(),
      }),
    )
    .default([]),
  new_flags: z.array(FlagSchema).default([]),
  resolved_flag_codes: z.array(z.string()).default([]),
  assumptions: z.array(z.string()).default([]),
  receipt: ReceiptSchema,
});
export type PersonalScenarioResponse = z.infer<typeof PersonalScenarioResponseSchema>;
