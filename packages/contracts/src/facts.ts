import type { Materiality, SubjectType, ValueKind } from "./enums";

/**
 * Registry of typed fact fields. Materiality drives freeze gating: an open
 * MATERIAL conflict or a missing MATERIAL fact required by the check blocks
 * snapshot freeze. Nonmaterial conflicts may be carried by a documented,
 * authorised exception when firm policy allows.
 */
export interface FactFieldDef {
  key: string;
  label: string;
  subject_type: SubjectType;
  value_kind: ValueKind;
  materiality: Materiality;
  /** Checks that require this fact to be present (confirmed or allowed-assumed). */
  required_for: readonly string[];
  /** Whether an explicit documented assumption may satisfy the requirement. */
  assumption_allowed: boolean;
  /** For balances: the fact's as_of_date must equal 31 December of the year before the tax year. */
  must_be_prior_year_end: boolean;
  /**
   * Time-varying facts (balances) only conflict when two sources disagree for the SAME as-of date;
   * differing as-of dates are a freshness question, not a conflict. Static facts (birth date,
   * account type, inherited flag) conflict whenever two sources disagree.
   */
  time_varying: boolean;
  unit?: string;
}

export const FACT_FIELDS: Record<string, FactFieldDef> = {
  "person.birth_date": { key: "person.birth_date", label: "Date of birth", subject_type: "PERSON", value_kind: "DATE", materiality: "MATERIAL", required_for: ["RMD_ANNUAL"], assumption_allowed: false, must_be_prior_year_end: false, time_varying: false },
  "person.is_alive": { key: "person.is_alive", label: "Living status", subject_type: "PERSON", value_kind: "BOOL", materiality: "MATERIAL", required_for: ["RMD_ANNUAL"], assumption_allowed: true, must_be_prior_year_end: false, time_varying: false },
  "account.account_type": { key: "account.account_type", label: "Account type", subject_type: "ACCOUNT", value_kind: "TEXT", materiality: "MATERIAL", required_for: ["RMD_ANNUAL"], assumption_allowed: false, must_be_prior_year_end: false, time_varying: false },
  "account.is_inherited": { key: "account.is_inherited", label: "Inherited account", subject_type: "ACCOUNT", value_kind: "BOOL", materiality: "MATERIAL", required_for: ["RMD_ANNUAL"], assumption_allowed: false, must_be_prior_year_end: false, time_varying: false },
  "account.year_end_balance": { key: "account.year_end_balance", label: "Prior year-end balance", subject_type: "ACCOUNT", value_kind: "NUMBER", materiality: "MATERIAL", required_for: ["RMD_ANNUAL"], assumption_allowed: false, must_be_prior_year_end: true, time_varying: true, unit: "USD" },
  "account.prior_prior_year_end_balance": { key: "account.prior_prior_year_end_balance", label: "Balance two year-ends prior", subject_type: "ACCOUNT", value_kind: "NUMBER", materiality: "NONMATERIAL", required_for: [], assumption_allowed: false, must_be_prior_year_end: false, time_varying: true, unit: "USD" },
  "account.custodian_label": { key: "account.custodian_label", label: "Custodian label", subject_type: "ACCOUNT", value_kind: "TEXT", materiality: "NONMATERIAL", required_for: [], assumption_allowed: true, must_be_prior_year_end: false, time_varying: false },
  "beneficiary.primary.spouse_sole_entire_year": { key: "beneficiary.primary.spouse_sole_entire_year", label: "Spouse sole primary beneficiary for entire year", subject_type: "ACCOUNT", value_kind: "BOOL", materiality: "MATERIAL", required_for: ["RMD_ANNUAL"], assumption_allowed: false, must_be_prior_year_end: false, time_varying: false },
  "rmd.first_year_election": { key: "rmd.first_year_election", label: "First-year RMD election", subject_type: "ACCOUNT", value_kind: "TEXT", materiality: "NONMATERIAL", required_for: [], assumption_allowed: true, must_be_prior_year_end: false, time_varying: false },
};

export const REQUIRED_FACT_KEYS_RMD = Object.values(FACT_FIELDS)
  .filter((f) => f.required_for.includes("RMD_ANNUAL"))
  .map((f) => f.key);

export function factFieldDef(key: string): FactFieldDef | undefined {
  return FACT_FIELDS[key];
}

export function priorYearEnd(taxYear: number): string {
  return `${taxYear - 1}-12-31`;
}
