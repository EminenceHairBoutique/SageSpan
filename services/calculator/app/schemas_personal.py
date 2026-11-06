"""Pydantic contracts for the Personal (B2C) deterministic engines.

Same rules as ``schemas.py``: every model forbids unknown fields, ``org_id`` /
``workspace_id`` are never accepted in a body (tenant context travels in the
trusted header), and every money value is a Decimal string, never a float.

These engines compute **descriptive baselines and illustrative comparisons** on
user-reported inputs. They do not verify the inputs, do not model taxes,
returns or benefits, and their outputs are labelled accordingly in receipts.
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Literal, Optional

from pydantic import Field, model_validator

from .schemas import Receipt, StrictModel

# ----------------------------------------------------------------- shared enums
Cadence = Literal["WEEKLY", "BIWEEKLY", "MONTHLY", "QUARTERLY", "ANNUAL", "ONE_TIME"]
IncomeKind = Literal["SALARY", "HOURLY", "VARIABLE_PAY", "SELF_EMPLOYMENT", "BENEFIT", "PENSION", "RENTAL", "OTHER"]
Reliability = Literal["REGULAR", "VARIABLE", "IRREGULAR", "UNKNOWN"]
ObligationCategory = Literal[
    "HOUSING", "UTILITIES", "INSURANCE", "DEBT_MINIMUM", "SUBSCRIPTION", "TRANSPORT", "FOOD", "CHILDCARE", "HEALTH", "SAVINGS_TRANSFER", "OTHER"
]
RateType = Literal["FIXED", "VARIABLE", "PROMOTIONAL"]
DataState = Literal["USER_REPORTED", "EVIDENCE_VERIFIED", "ASSUMED", "MISSING", "STALE", "CONFLICTING"]
Severity = Literal["INFO", "LOW", "MEDIUM", "HIGH"]


# ----------------------------------------------------------------- inputs
class CashAccountInput(StrictModel):
    account_ref: str = Field(..., description="Opaque reference from the personal workspace; no account numbers.")
    label: Optional[str] = None
    balance: Decimal
    currency: str = Field("USD", min_length=3, max_length=3)
    balance_as_of: date
    liquid: bool = Field(True, description="Counts toward the cash buffer only when true (checking/savings, not retirement or illiquid assets).")
    data_state: DataState = "USER_REPORTED"


class IncomeStreamInput(StrictModel):
    stream_ref: str
    label: Optional[str] = None
    kind: IncomeKind = "OTHER"
    cadence: Cadence = "MONTHLY"
    reliability: Reliability = "UNKNOWN"
    observed_monthly_amounts: list[Decimal] = Field(default_factory=list, description="Net amounts received per calendar month, oldest first. Used for the typical/low statistics.")
    expected_amount: Optional[Decimal] = Field(None, description="Expected per-payment amount for the outlook. If omitted the engine uses the typical (median) monthly amount scaled to the cadence.")
    next_expected_date: Optional[date] = None
    data_state: DataState = "USER_REPORTED"


class ObligationInput(StrictModel):
    obligation_ref: str
    label: Optional[str] = None
    category: ObligationCategory = "OTHER"
    amount: Decimal = Field(..., ge=0)
    cadence: Cadence = "MONTHLY"
    next_due_date: date
    essential: bool = True
    liability_ref: Optional[str] = Field(None, description="Set when this obligation is the minimum payment of a liability in `liabilities`.")
    data_state: DataState = "USER_REPORTED"


class VariableSpendingInput(StrictModel):
    category: str
    observed_monthly_amounts: list[Decimal] = Field(default_factory=list, description="Observed spend per calendar month, oldest first (transfers and refunds already excluded by the caller).")
    essential: bool = False
    data_state: DataState = "USER_REPORTED"


class LiabilityInput(StrictModel):
    liability_ref: str
    label: Optional[str] = None
    balance: Decimal = Field(..., ge=0)
    apr_percent: Decimal = Field(..., ge=0, le=100, description="Annual percentage rate as a percent, e.g. '24.99'.")
    minimum_payment: Decimal = Field(..., ge=0)
    rate_type: RateType = "FIXED"
    promo_apr_percent: Optional[Decimal] = Field(None, ge=0, le=100)
    promo_apr_expires: Optional[date] = None
    due_day_of_month: Optional[int] = Field(None, ge=1, le=31)
    data_state: DataState = "USER_REPORTED"


class GoalInput(StrictModel):
    goal_ref: str
    label: str
    target_amount: Decimal = Field(..., ge=0)
    saved_amount: Decimal = Field(Decimal("0"), ge=0)
    target_date: Optional[date] = None
    monthly_contribution: Optional[Decimal] = Field(None, ge=0)


class LiquidityPolicy(StrictModel):
    cash_floor: Decimal = Field(..., ge=0, description="The user's own minimum liquid-cash floor. A hard constraint for recommendations, never a universal rule.")
    buffer_target_months: Optional[Decimal] = Field(None, ge=0, description="User-chosen essential-expense buffer target. Optional; the engine never imposes a universal '3 months'.")


class PersonalClarityRequest(StrictModel):
    schema_version: Literal["sagespan.personal-clarity.v1"]
    as_of_date: date
    horizon_days: int = Field(90, ge=30, le=180)
    policy: LiquidityPolicy
    cash_accounts: list[CashAccountInput] = Field(default_factory=list)
    income_streams: list[IncomeStreamInput] = Field(default_factory=list)
    obligations: list[ObligationInput] = Field(default_factory=list)
    variable_spending: list[VariableSpendingInput] = Field(default_factory=list)
    liabilities: list[LiabilityInput] = Field(default_factory=list)
    goals: list[GoalInput] = Field(default_factory=list)
    workspace_ref: Optional[str] = Field(None, description="Opaque workspace reference echoed into the receipt. Not an authority claim.")
    input_hash: Optional[str] = Field(None, pattern=r"^[0-9a-f]{64}$", description="Caller-side SHA-256 of the personal snapshot the request was built from.")


# ----------------------------------------------------------------- outputs
class Flag(StrictModel):
    code: str
    severity: Severity
    message: str
    refs: list[str] = Field(default_factory=list, description="Input references (account_ref, obligation_ref, liability_ref...) the flag is about.")


class DataQualityItem(StrictModel):
    ref: str
    state: DataState
    note: Optional[str] = None


class IncomeSummary(StrictModel):
    observed_months: int
    typical_monthly: Optional[Decimal] = Field(None, description="Median of observed monthly totals across all streams.")
    low_monthly: Optional[Decimal] = Field(None, description="Minimum observed monthly total.")
    high_monthly: Optional[Decimal] = None
    spread_ratio: Optional[Decimal] = Field(None, description="(high - low) / typical, 4 dp.")
    classification: Reliability


class CommitmentSummary(StrictModel):
    monthly_essential: Decimal = Field(..., description="Essential obligations normalised to a month plus essential variable spending (typical).")
    monthly_discretionary_typical: Decimal
    monthly_debt_minimums: Decimal
    essential_items: int
    discretionary_items: int


class MarginSummary(StrictModel):
    typical: Optional[Decimal] = Field(None, description="typical income - essential - discretionary typical")
    low: Optional[Decimal] = Field(None, description="low income - essential - discretionary typical")
    essential_only_low: Optional[Decimal] = Field(None, description="low income - essential (what is left if discretionary spending stopped)")


class CashSummary(StrictModel):
    liquid_total: Decimal
    cash_floor: Decimal
    above_floor: Decimal
    essential_buffer_months: Optional[Decimal] = Field(None, description="liquid_total / monthly_essential, 2 dp; null when essentials are zero.")
    buffer_target_months: Optional[Decimal] = None
    buffer_gap_amount: Optional[Decimal] = Field(None, description="Positive when liquid cash is below the user's target buffer.")


class DebtSummary(StrictModel):
    liability_count: int
    total_balance: Decimal
    total_minimums: Decimal
    highest_apr_percent: Optional[Decimal] = None
    highest_apr_ref: Optional[str] = None
    balance_weighted_apr_percent: Optional[Decimal] = None


class OutlookEvent(StrictModel):
    date: date
    ref: str
    kind: Literal["INCOME", "OBLIGATION", "DISCRETIONARY"]
    amount: Decimal = Field(..., description="Signed: income positive, outflows negative.")
    essential: Optional[bool] = None


class OutlookPoint(StrictModel):
    date: date
    projected_cash: Decimal
    events: list[OutlookEvent] = Field(default_factory=list)


class Collision(StrictModel):
    window_start: date
    window_end: date
    total_due: Decimal
    refs: list[str]


class Outlook(StrictModel):
    horizon_days: int
    start_cash: Decimal
    lowest_projected_cash: Decimal
    lowest_projected_date: date
    end_projected_cash: Decimal
    floor_breach_dates: list[date] = Field(default_factory=list)
    first_floor_breach_date: Optional[date] = None
    collisions: list[Collision] = Field(default_factory=list)
    points: list[OutlookPoint] = Field(default_factory=list, description="Only days with events plus the horizon end, to keep payloads small.")


class GoalSummary(StrictModel):
    goal_ref: str
    label: str
    target_amount: Decimal
    saved_amount: Decimal
    remaining_amount: Decimal
    months_to_target_at_contribution: Optional[int] = Field(None, description="ceil(remaining / monthly_contribution) when a contribution is stated and positive.")
    on_track_for_target_date: Optional[bool] = None


class PersonalClarityResponse(StrictModel):
    check_type: Literal["PERSONAL_CLARITY"]
    result_status: Literal["COMPUTED", "INSUFFICIENT_DATA"] = Field(..., description="COMPUTED is a descriptive baseline on the supplied inputs. It is not advice and not a verification of the inputs.")
    as_of_date: date
    income: IncomeSummary
    commitments: CommitmentSummary
    margin: MarginSummary
    cash: CashSummary
    debt: DebtSummary
    outlook: Outlook
    goals: list[GoalSummary] = Field(default_factory=list)
    flags: list[Flag] = Field(default_factory=list)
    data_quality: list[DataQualityItem] = Field(default_factory=list)
    receipt: Receipt


# ----------------------------------------------------------------- debt paths
Strategy = Literal["MINIMUMS_ONLY", "AVALANCHE", "SNOWBALL", "HYBRID"]


class DebtPathsRequest(StrictModel):
    schema_version: Literal["sagespan.debt-paths.v1"]
    as_of_date: date
    liabilities: list[LiabilityInput] = Field(..., min_length=1)
    monthly_debt_budget: Optional[Decimal] = Field(None, ge=0, description="Total amount available for all debt payments each month, including minimums. Comes from the user's margin, never from below the cash floor. Supply exactly one of monthly_debt_budget or extra_monthly_payment.")
    extra_monthly_payment: Optional[Decimal] = Field(None, ge=0, description="Amount above the sum of stated minimums to direct at the strategy target each month. The engine derives the budget as minimums + extra so the web tier never sums money.")
    policy: LiquidityPolicy
    liquid_cash: Optional[Decimal] = Field(None, ge=0, description="Total liquid cash. Alternatively supply cash_accounts and let the engine total the liquid ones (the web tier never sums money).")
    cash_accounts: list[CashAccountInput] = Field(default_factory=list)
    strategies: list[Strategy] = Field(default_factory=lambda: ["MINIMUMS_ONLY", "AVALANCHE", "SNOWBALL"])
    max_months: int = Field(600, ge=1, le=600)
    workspace_ref: Optional[str] = None
    input_hash: Optional[str] = Field(None, pattern=r"^[0-9a-f]{64}$")

    @model_validator(mode="after")
    def _exactly_one_budget_input(self) -> "DebtPathsRequest":
        if (self.monthly_debt_budget is None) == (self.extra_monthly_payment is None):
            raise ValueError("supply exactly one of monthly_debt_budget or extra_monthly_payment")
        if self.liquid_cash is None and not self.cash_accounts:
            raise ValueError("supply liquid_cash or cash_accounts")
        return self


class PayoffEvent(StrictModel):
    liability_ref: str
    month_index: int = Field(..., description="1-based month counting from as_of_date in which the balance reaches zero.")
    payoff_date: date


class MonthRow(StrictModel):
    month_index: int
    month_start: date
    opening_total_balance: Decimal
    interest: Decimal
    payment: Decimal
    closing_total_balance: Decimal


class StrategyResult(StrictModel):
    strategy: Strategy
    feasible: bool = Field(..., description="False when the budget cannot cover the sum of minimum payments or the horizon ends before payoff.")
    infeasible_reason: Optional[str] = None
    months_to_payoff: Optional[int] = None
    payoff_date: Optional[date] = None
    total_interest: Decimal
    total_paid: Decimal
    payoff_order: list[PayoffEvent] = Field(default_factory=list)
    first_year: list[MonthRow] = Field(default_factory=list, description="First 12 months (or fewer) of the aggregate schedule for display.")
    interest_saved_vs_minimums: Optional[Decimal] = Field(None, description="MINIMUMS_ONLY total interest minus this strategy's total interest, when both are finite.")
    months_saved_vs_minimums: Optional[int] = None


class LiquidityGuard(StrictModel):
    liquid_cash: Decimal
    cash_floor: Decimal
    headroom: Decimal
    floor_respected: bool
    budget_covers_minimums: bool
    total_minimums: Decimal
    extra_per_month: Decimal = Field(..., description="budget - total minimums at the start; never negative.")


class DebtPathsResponse(StrictModel):
    check_type: Literal["DEBT_PATHS"]
    result_status: Literal["COMPUTED", "INFEASIBLE"]
    as_of_date: date
    liquidity_guard: LiquidityGuard
    results: list[StrategyResult]
    assumptions: list[str] = Field(default_factory=list)
    flags: list[Flag] = Field(default_factory=list)
    receipt: Receipt


class MethodSetListResponse(StrictModel):
    method_sets: list["RuleSetRef"]
    engine_name: str
    engine_version: str


from .schemas import RuleSetRef  # noqa: E402  (re-exported for the forward ref above)

MethodSetListResponse.model_rebuild()
