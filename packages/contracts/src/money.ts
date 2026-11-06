/**
 * Decimal-string money helpers for the web tier. The web tier never computes
 * authoritative financial results; it only compares, formats and displays
 * values returned by the calculation service or recorded as typed facts.
 * Arithmetic here is integer cents via BigInt (no floats).
 */

const DECIMAL_RE = /^(-)?(\d+)(?:\.(\d+))?$/;

export function parseCents(value: string): bigint {
  const m = DECIMAL_RE.exec(value.trim());
  if (!m) throw new Error(`not a decimal string: ${value}`);
  const sign = m[1] ? -1n : 1n;
  const whole = BigInt(m[2] ?? "0");
  const fracRaw = (m[3] ?? "").padEnd(2, "0");
  if (fracRaw.length > 2) {
    // Values with more than two decimals are not money; refuse rather than round silently.
    throw new Error(`more than two decimal places: ${value}`);
  }
  return sign * (whole * 100n + BigInt(fracRaw));
}

export function centsToDecimalString(cents: bigint): string {
  const neg = cents < 0n;
  const abs = neg ? -cents : cents;
  const whole = abs / 100n;
  const frac = (abs % 100n).toString().padStart(2, "0");
  return `${neg ? "-" : ""}${whole}.${frac}`;
}

export function normalizeMoney(value: string): string {
  return centsToDecimalString(parseCents(value));
}

export function moneyEquals(a: string, b: string): boolean {
  return parseCents(a) === parseCents(b);
}

export function moneyDiff(a: string, b: string): string {
  return centsToDecimalString(parseCents(a) - parseCents(b));
}

export function formatMoney(value: string | null | undefined, currency = "USD"): string {
  if (value == null) return "—";
  const cents = parseCents(value);
  const neg = cents < 0n;
  const abs = neg ? -cents : cents;
  const whole = (abs / 100n).toString();
  const frac = (abs % 100n).toString().padStart(2, "0");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const symbol = currency === "USD" ? "$" : `${currency} `;
  return `${neg ? "-" : ""}${symbol}${grouped}.${frac}`;
}

export function isDecimalString(value: unknown): value is string {
  return typeof value === "string" && DECIMAL_RE.test(value.trim());
}
