import { humanize } from "./format";

/**
 * Read-only view over the existing `ActionResult` failure shape
 * (`{ ok: false, code, message }` in `domain/errors`). The server actions
 * build `VALIDATION` messages from Zod issues as `path: message; path: message`
 * and never include submitted values, so the UI can map each segment back to a
 * field without a contract change.
 */
export interface FieldError {
  /** Dotted Zod path, e.g. `balance` or `observed_monthly_amounts.2`. */
  path: string;
  message: string;
}

export interface ParsedActionErrors {
  fields: FieldError[];
  /** Segments that do not name a field; shown at form level. */
  general: string[];
}

const SEGMENT_RE = /^([A-Za-z0-9_][A-Za-z0-9_.[\]-]*): (.+)$/;

export function parseFieldErrors(result: { ok: boolean; code?: string; message?: string } | null | undefined): ParsedActionErrors {
  if (!result || result.ok || result.code !== "VALIDATION" || !result.message) return { fields: [], general: [] };
  const fields: FieldError[] = [];
  const general: string[] = [];
  for (const raw of result.message.split("; ")) {
    const segment = raw.trim();
    if (!segment) continue;
    const m = SEGMENT_RE.exec(segment);
    if (m) fields.push({ path: m[1] as string, message: m[2] as string });
    else general.push(segment);
  }
  return { fields, general };
}

/** `observed_monthly_amounts.2` → `Observed monthly amounts (item 3)`. */
export function fieldLabel(path: string): string {
  const parts = path.split(".");
  const index = parts.length > 1 && /^\d+$/.test(parts[parts.length - 1] as string) ? Number(parts.pop()) : null;
  const base = humanize(parts[parts.length - 1], { capitalize: true }) || path;
  return index == null ? base : `${base} (item ${index + 1})`;
}
