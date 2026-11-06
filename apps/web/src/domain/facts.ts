import { FACT_FIELDS, moneyEquals, normalizeMoney, type Fact, type FactStatus, type SourceKind, type ValueKind, PRIMARY_EVIDENCE_KINDS } from "@sagespan/contracts";

export function initialFactStatus(sourceKind: SourceKind, isAssumption: boolean): FactStatus {
  if (isAssumption) return "FACT_ASSUMED";
  return PRIMARY_EVIDENCE_KINDS.includes(sourceKind) ? "FACT_CONFIRMED" : "NEEDS_CONFIRMATION";
}

export function isPrimaryEvidence(sourceKind: SourceKind | null | undefined): boolean {
  return !!sourceKind && PRIMARY_EVIDENCE_KINDS.includes(sourceKind);
}

/** Parse a raw import value into typed columns. Throws on malformed values. */
export function typedValue(kind: ValueKind, raw: string): Pick<Fact, "value_number" | "value_text" | "value_date" | "value_bool"> {
  const base = { value_number: null, value_text: null, value_date: null, value_bool: null };
  const v = raw.trim();
  switch (kind) {
    case "NUMBER":
      return { ...base, value_number: normalizeMoney(v) };
    case "DATE": {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v))) throw new Error(`not an ISO date: ${raw}`);
      return { ...base, value_date: v };
    }
    case "BOOL": {
      const l = v.toLowerCase();
      if (["true", "yes", "y", "1"].includes(l)) return { ...base, value_bool: true };
      if (["false", "no", "n", "0"].includes(l)) return { ...base, value_bool: false };
      throw new Error(`not a boolean: ${raw}`);
    }
    default:
      return { ...base, value_text: v };
  }
}

export function factValuesEqual(a: Fact, b: Fact): boolean {
  if (a.value_kind !== b.value_kind) return false;
  switch (a.value_kind) {
    case "NUMBER":
      return a.value_number != null && b.value_number != null && moneyEquals(a.value_number, b.value_number) && (a.value_currency ?? "USD") === (b.value_currency ?? "USD");
    case "DATE":
      return a.value_date === b.value_date;
    case "BOOL":
      return a.value_bool === b.value_bool;
    default:
      return (a.value_text ?? "").trim().toLowerCase() === (b.value_text ?? "").trim().toLowerCase();
  }
}

export function isTimeVarying(fieldKey: string): boolean {
  return FACT_FIELDS[fieldKey]?.time_varying ?? false;
}

export function conflictGroupKey(f: Pick<Fact, "subject_type" | "subject_id" | "field_key" | "as_of_date">): string {
  const base = `${f.subject_type}:${f.subject_id}:${f.field_key}`;
  return isTimeVarying(f.field_key) ? `${base}:${f.as_of_date}` : base;
}
