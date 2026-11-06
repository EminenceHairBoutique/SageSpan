/**
 * Presentation-only string helpers (design system §5.5). Nothing here touches
 * money: amounts are formatted by `formatMoney` / `formatUsd` in
 * `@sagespan/contracts` and the web tier never computes, rounds or
 * extrapolates a figure.
 */

/** `SOURCE_CONFLICT` → `source conflict`; replaces the inline `toLowerCase().replace(/_/g, " ")` copies. */
export function humanize(value: string | null | undefined, options: { capitalize?: boolean } = {}): string {
  if (value == null) return "";
  const text = String(value).trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  if (!text) return "";
  return options.capitalize ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

export type WhenPrecision = "date" | "minute" | "second";

const ISO_RE = /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/;

/**
 * Renders a stored ISO-8601 timestamp for display without converting time
 * zones: the demo stores UTC strings and the pages show them as recorded
 * (replaces the inline `replace("T", " ").slice(0, 19)` copies).
 * `formatWhen("2026-11-06T09:12:34.000Z")` → `2026-11-06 09:12:34`.
 */
export function formatWhen(value: string | Date | null | undefined, options: { precision?: WhenPrecision; utcSuffix?: boolean } = {}): string {
  if (value == null || value === "") return "—";
  const iso = value instanceof Date ? value.toISOString() : String(value);
  const m = ISO_RE.exec(iso);
  if (!m) return iso;
  const [, date, hh, mm, ss] = m;
  const precision = options.precision ?? (ss ? "second" : hh ? "minute" : "date");
  let out = date as string;
  if (precision !== "date" && hh && mm) {
    out += ` ${hh}:${mm}`;
    if (precision === "second") out += `:${ss ?? "00"}`;
  }
  return options.utcSuffix && precision !== "date" ? `${out} UTC` : out;
}

/**
 * Truncates a hash or id for display while keeping the full value available
 * for `title`, copy buttons and tests (replaces the inline `.slice(0, n)…`).
 */
export function shortHash(value: string | null | undefined, chars = 12): { short: string; full: string } {
  if (!value) return { short: "—", full: "" };
  const full = String(value);
  return { short: full.length > chars ? `${full.slice(0, chars)}…` : full, full };
}
