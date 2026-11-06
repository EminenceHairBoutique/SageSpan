"""Pydantic request/response contracts for the calculation service.

All models forbid unknown fields. In particular, `org_id` is NEVER accepted in a
request body: tenant context comes only from the trusted server-side header
set by the web application's server runtime (see app/auth.py).
"""
from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


# --------------------------------------------------------------------- inputs
class Money(StrictModel):
    amount: Decimal = Field(..., description="Decimal string, e.g. '640000.00'. Never a float.")
    currency: str = Field("USD", min_length=3, max_length=3)
    as_of_date: date


AccountType = Literal[
    "TRADITIONAL_IRA", "SEP_IRA", "SIMPLE_IRA", "ROTH_IRA", "EMPLOYER_401K", "EMPLOYER_403B", "OTHER"
]


class Owner(StrictModel):
    person_ref: str = Field(..., description="Opaque reference from the frozen snapshot; no PII required.")
    birth_date: Optional[date] = None
    is_alive: Optional[bool] = None


class Account(StrictModel):
    account_ref: str
    account_type: Optional[AccountType] = None
    is_inherited: Optional[bool] = None
    prior_year_end_balance: Optional[Money] = Field(None, description="Balance as of December 31 of the year before the tax year.")
    prior_prior_year_end_balance: Optional[Money] = Field(None, description="Balance as of December 31 two years before the tax year; needed only to value a deferred first-year RMD.")
    outstanding_rollover_adjustment: Optional[Decimal] = Field(None, description="Outstanding rollovers / recharacterizations to add back. Non-zero values are not supported in this engine version.")


class Beneficiary(StrictModel):
    person_ref: str
    relationship: Literal["SPOUSE", "NON_SPOUSE_INDIVIDUAL", "TRUST", "ESTATE", "CHARITY", "OTHER"]
    designation_type: Literal["PRIMARY", "CONTINGENT"]
    share_percent: Decimal
    birth_date: Optional[date] = None
    sole_primary_entire_year: Optional[bool] = Field(None, description="Whether this beneficiary was the sole primary beneficiary for the entire distribution year.")


class FirstRmdElection(StrictModel):
    deferred_first_rmd_to_april_1: Optional[bool] = None
    first_rmd_satisfied_in_first_year: Optional[bool] = None


class DeclaredInputs(StrictModel):
    balance: Optional[Decimal] = None
    balance_as_of: Optional[date] = None
    factor: Optional[Decimal] = None
    table: Optional[str] = None
    method: Optional[str] = None


class ImportedComparison(StrictModel):
    import_value_ref: str
    amount: Decimal
    currency: str = "USD"
    tax_year: int
    vendor_label: Optional[str] = Field(None, description="Free-text label of the planning tool. Metadata only; not an integration.")
    calculation_scope: Literal["SINGLE_ACCOUNT_ANNUAL_RMD", "AGGREGATE_ALL_IRAS", "OTHER", "UNKNOWN"] = "UNKNOWN"
    balance_basis: Literal["ACTUAL_PRIOR_YEAR_END", "PROJECTED", "UNKNOWN"] = "UNKNOWN"
    declared_inputs: Optional[DeclaredInputs] = None
    assumptions: dict[str, str] = Field(default_factory=dict)


class Tolerance(StrictModel):
    absolute: Decimal = Decimal("1.00")
    relative: Decimal = Decimal("0.001")


class SnapshotRef(StrictModel):
    snapshot_id: str
    revision: int
    input_hash: str


class RmdCheckRequest(StrictModel):
    schema_version: Literal["sagespan.rmd-check.v1"]
    tax_year: int = Field(..., ge=2022, le=2100)
    owner: Owner
    account: Account
    beneficiaries: Optional[list[Beneficiary]] = None
    first_rmd_election: Optional[FirstRmdElection] = None
    imported_comparison: Optional[ImportedComparison] = None
    tolerance: Optional[Tolerance] = None
    snapshot_ref: Optional[SnapshotRef] = None


# -------------------------------------------------------------------- outputs
class Reason(StrictModel):
    code: str
    message: str
    rule_ref: Optional[str] = None


EligibilityStatus = Literal["SUPPORTED", "NOT_REQUIRED", "UNSUPPORTED", "INDETERMINATE"]


class Eligibility(StrictModel):
    status: EligibilityStatus
    applicable_age: Optional[str] = None
    owner_age_in_tax_year: Optional[int] = None
    first_distribution_year: Optional[int] = None
    required_beginning_date: Optional[date] = None
    table_id: Optional[str] = None
    reasons: list[Reason] = Field(default_factory=list)


class ObligationEvent(StrictModel):
    event_type: Literal["ANNUAL_RMD", "DEFERRED_FIRST_YEAR_RMD"]
    distribution_year: int
    deadline: date
    status: Literal["COMPUTED", "INDETERMINATE", "REPORTED_SATISFIED_UNVERIFIED", "NOT_APPLICABLE"]
    amount: Optional[Decimal] = None
    basis_balance: Optional[Decimal] = None
    basis_as_of: Optional[date] = None
    owner_age: Optional[int] = None
    factor: Optional[Decimal] = None
    table_id: Optional[str] = None
    formula: Optional[str] = None
    reasons: list[Reason] = Field(default_factory=list)


DiscrepancyClassification = Literal[
    "SOURCE_CONFLICT",
    "STALE_INPUT",
    "RULE_DISAGREEMENT",
    "METHODOLOGY_DIFFERENCE",
    "MISSING_EVIDENCE",
    "UNSUPPORTED_CHECK",
    "WITHIN_TOLERANCE",
    "NOT_COMPARABLE",
]


class Discrepancy(StrictModel):
    classification: DiscrepancyClassification
    comparable: bool
    import_value_ref: Optional[str] = None
    computed_amount: Optional[Decimal] = None
    imported_amount: Optional[Decimal] = None
    difference: Optional[Decimal] = Field(None, description="computed - imported, in USD, when comparable.")
    tolerance_absolute: Optional[Decimal] = None
    tolerance_relative: Optional[Decimal] = None
    tolerance_applied: Optional[Decimal] = None
    explanation: str
    next_step: str


class RuleSourceRef(StrictModel):
    title: str
    citation: str
    url: Optional[str] = None


class RuleSetRef(StrictModel):
    rule_set_id: str
    version: str
    status: Literal["PUBLISHED", "DRAFT"]
    checksum: str
    effective_from: date
    effective_to: Optional[date] = None
    sources: list[RuleSourceRef] = Field(default_factory=list)


class OrgContext(StrictModel):
    org_id: str


class Receipt(StrictModel):
    receipt_version: Literal["sagespan.receipt.v1"]
    engine_name: str
    engine_version: str
    request_hash: str = Field(..., description="SHA-256 of the canonical request payload.")
    run_hash: str = Field(..., description="SHA-256 of canonical {request_hash, engine, rule set checksums, result}. Deterministic: identical inputs produce identical run hashes.")
    computed_at: datetime
    org_context: OrgContext
    snapshot_ref: Optional[SnapshotRef] = None
    rule_sets: list[RuleSetRef]
    inputs_used: dict[str, Any]
    formula: Optional[str] = None
    limitations: list[str]


CoverageStatus = Literal["SUPPORTED_VERIFIED", "SUPPORTED_UNVALIDATED", "NOT_COMPARABLE", "INDETERMINATE", "UNSUPPORTED"]


class RmdCheckResponse(StrictModel):
    check_type: Literal["RMD_ANNUAL"]
    result_status: Literal["PASS", "NOT_REQUIRED", "UNSUPPORTED", "INDETERMINATE"] = Field(..., description="Arithmetic outcome of the check. PASS is not a professional approval.")
    coverage_status: CoverageStatus = Field(..., description="Coverage-matrix status. SUPPORTED_VERIFIED means the published rule set has internal golden-test coverage; it is not an external attestation.")
    tax_year: int
    eligibility: Eligibility
    unsupported_reasons: list[Reason] = Field(default_factory=list, description="Populated when the check is UNSUPPORTED or INDETERMINATE.")
    annual_rmd: Optional[Decimal] = None
    events: list[ObligationEvent]
    discrepancy: Optional[Discrepancy] = None
    receipt: Receipt


class RuleSetListResponse(StrictModel):
    rule_sets: list[RuleSetRef]
    engine_name: str
    engine_version: str


class HealthResponse(StrictModel):
    status: Literal["ok"]
    engine_name: str
    engine_version: str
    demo_mode: bool


class ErrorBody(StrictModel):
    code: str
    message: str
    details: Optional[Any] = None


class ErrorResponse(StrictModel):
    error: ErrorBody
