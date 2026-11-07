/** Joins class names, dropping falsy parts. Shared by every UI module (also re-exported from primitives). */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
