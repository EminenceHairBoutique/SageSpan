/**
 * Canonical JSON + SHA-256, byte-compatible with
 * services/calculator/app/financial/canonical.py (sorted keys, no whitespace,
 * UTF-8, decimals and dates already rendered as strings by the caller).
 *
 * Both tiers must agree so the web app can independently re-derive the
 * calculation service's `request_hash` for the payload it sent.
 */

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

function sortKeysDeep(value: unknown): Json {
  if (value === null || typeof value === "boolean" || typeof value === "string") return value as Json;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("non-finite number is not canonically serialisable");
    return value;
  }
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    const out: { [k: string]: Json } = {};
    for (const key of Object.keys(value as object).sort()) {
      const v = (value as Record<string, unknown>)[key];
      if (v === undefined) continue; // mirror JSON.stringify: undefined keys are dropped
      out[key] = sortKeysDeep(v);
    }
    return out;
  }
  throw new TypeError(`value of type ${typeof value} is not canonically serialisable`);
}

export function canonicalJson(payload: unknown): string {
  return JSON.stringify(sortKeysDeep(payload));
}

export async function sha256Hex(data: string | Uint8Array): Promise<string> {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function canonicalHash(payload: unknown): Promise<string> {
  return sha256Hex(canonicalJson(payload));
}
