import { PERSONAL_RECORD_TYPES, ScenarioSpecSchema, type PersonalRecordType, type ScenarioSpec } from "@sagespan/contracts";
import { DomainError } from "@/domain/errors";

/**
 * Form → record write input, shared by the demo (/demo/personal) and production (/app/personal)
 * record actions so both paths feed the same Zod schema in the domain layer (DATA-001).
 */
export function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v : "";
}

export function recordType(fd: FormData): PersonalRecordType {
  const t = str(fd, "record_type");
  if (!(PERSONAL_RECORD_TYPES as readonly string[]).includes(t)) throw new DomainError("VALIDATION", "Unknown record type.");
  return t as PersonalRecordType;
}

const opt = (v: string) => (v.trim() === "" ? null : v.trim());
export const amount = (v: string) => v.replace(/[$,\s]/g, "");
const bool = (fd: FormData, k: string) => fd.get(k) === "on" || fd.get(k) === "true";

/** Parse the observed-months textarea: one amount per line or comma-separated, oldest first; blanks dropped. */
function observedMonths(v: string): string[] {
  return v
    .split(/[\n,;]+/)
    .map((x) => amount(x))
    .filter((x) => x.length > 0);
}

/** Shape the raw form into the record's write object. Shared Zod validation runs in the domain layer. */
export function recordInputFromForm(type: PersonalRecordType, fd: FormData): unknown {
  switch (type) {
    case "CASH_ACCOUNT":
      return { label: str(fd, "label"), kind: str(fd, "kind"), balance: amount(str(fd, "balance")), balance_as_of: str(fd, "balance_as_of"), ...(fd.has("liquid_explicit") ? { liquid: bool(fd, "liquid") } : {}) };
    case "INCOME_STREAM":
      return { label: str(fd, "label"), kind: str(fd, "kind"), cadence: str(fd, "cadence"), reliability: str(fd, "reliability") || "UNKNOWN", observed_monthly_amounts: observedMonths(str(fd, "observed_monthly_amounts")), observed_from: opt(str(fd, "observed_from")), observed_to: opt(str(fd, "observed_to")), expected_amount: opt(amount(str(fd, "expected_amount"))), next_expected_date: opt(str(fd, "next_expected_date")) };
    case "OBLIGATION":
      return { label: str(fd, "label"), category: str(fd, "category"), amount: amount(str(fd, "amount")), cadence: str(fd, "cadence"), next_due_date: str(fd, "next_due_date"), essential: bool(fd, "essential"), liability_id: opt(str(fd, "liability_id")) };
    case "VARIABLE_SPENDING":
      return { category: str(fd, "category"), observed_monthly_amounts: observedMonths(str(fd, "observed_monthly_amounts")), essential: bool(fd, "essential"), transfers_excluded: bool(fd, "transfers_excluded") };
    case "LIABILITY":
      return { label: str(fd, "label"), kind: str(fd, "kind"), balance: amount(str(fd, "balance")), balance_as_of: str(fd, "balance_as_of"), apr_percent: amount(str(fd, "apr_percent")), minimum_payment: amount(str(fd, "minimum_payment")), rate_type: str(fd, "rate_type"), promo_apr_percent: opt(amount(str(fd, "promo_apr_percent"))), promo_apr_expires: opt(str(fd, "promo_apr_expires")), due_day_of_month: str(fd, "due_day_of_month").trim() ? Number(str(fd, "due_day_of_month")) : null };
    case "GOAL":
      return { label: str(fd, "label"), kind: str(fd, "kind"), target_amount: amount(str(fd, "target_amount")), saved_amount: amount(str(fd, "saved_amount") || "0"), target_date: opt(str(fd, "target_date")), monthly_contribution: opt(amount(str(fd, "monthly_contribution"))), funded_from_account_id: opt(str(fd, "funded_from_account_id")) };
  }
}

/** What-if form → validated ScenarioSpec (shared by demo and production scenario actions). */
export function scenarioSpecFromForm(fd: FormData): ScenarioSpec {
  const kind = str(fd, "kind");
  const raw: Record<string, unknown> = { kind };
  const amount = str(fd, "monthly_amount").replace(/[$,\s]/g, "");
  if (kind === "SPENDING_CHANGE") {
    const direction = str(fd, "direction") === "MORE" ? "" : "-";
    if (amount) raw.monthly_amount = `${direction}${amount.replace(/^-/, "")}`;
  } else if (kind === "SAVINGS_CHANGE") {
    if (amount) raw.monthly_amount = amount;
    if (str(fd, "goal_ref")) raw.goal_ref = str(fd, "goal_ref");
    raw.destination = str(fd, "destination") === "ILLIQUID" ? "ILLIQUID" : "LIQUID";
  } else if (kind === "INCOME_INTERRUPTION") {
    if (str(fd, "stream_ref")) raw.stream_ref = str(fd, "stream_ref");
    if (str(fd, "months")) raw.months = Number(str(fd, "months"));
    if (str(fd, "start_date")) raw.start_date = str(fd, "start_date");
  }
  const parsed = ScenarioSpecSchema.safeParse(raw);
  if (!parsed.success) throw new DomainError("VALIDATION", parsed.error.issues.map((i) => `${i.path.join(".") || "scenario"}: ${i.message}`).join("; "));
  return parsed.data;
}
