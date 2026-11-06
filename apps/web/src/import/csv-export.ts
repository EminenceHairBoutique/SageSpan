/**
 * Formula-injection-safe CSV export.
 *
 * Spreadsheet applications evaluate cells beginning with = + - @ (and tab /
 * carriage return variants) as formulas. Every exported cell that starts with
 * one of those characters is prefixed with a single quote and the whole cell
 * is quoted, which neutralises the formula while keeping the text readable.
 */
const DANGEROUS_PREFIX = /^[\t\r=+\-@]/;

export function safeCell(value: unknown): string {
  let text = value === null || value === undefined ? "" : String(value);
  if (DANGEROUS_PREFIX.test(text)) text = `'${text}`;
  const needsQuote = /[",\r\n]/.test(text) || text.startsWith("'");
  if (needsQuote) text = `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(safeCell).join(",")];
  for (const row of rows) lines.push(row.map(safeCell).join(","));
  return lines.join("\r\n") + "\r\n";
}
