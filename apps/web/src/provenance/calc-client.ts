import "server-only";
import { DebtPathsResponseSchema, MethodSetListResponseSchema, PersonalClarityResponseSchema, RmdCheckResponseSchema, RuleSetListResponseSchema, ServiceErrorSchema, canonicalHash, type DebtPathsRequest, type DebtPathsResponse, type PersonalClarityRequest, type PersonalClarityResponse, type RmdCheckRequest, type RmdCheckResponse, type RuleSetRef } from "@sagespan/contracts";
import { env } from "@/config/env";

/**
 * Server-to-server client for the Python calculation & verification service.
 *
 * - Tenant context travels in X-SageSpan-Org-Id, resolved from the actor on
 *   this server; the request body never carries org_id.
 * - Any failure is surfaced as a typed error. There is NO fallback arithmetic
 *   in this tier: if the service is down, the check fails visibly.
 * - The response's request_hash is independently re-derived here so a tampered
 *   or mismatched receipt is detectable.
 */
export class CalcServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number | null = null,
  ) {
    super(message);
    this.name = "CalcServiceError";
  }
}

const TIMEOUT_MS = 10_000;

function headers(orgId: string): HeadersInit {
  return {
    "content-type": "application/json",
    accept: "application/json",
    authorization: `Bearer ${env.calcServiceToken}`,
    "x-sagespan-org-id": orgId,
  };
}

async function doFetch(pathname: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(`${env.calcServiceUrl}${pathname}`, { ...init, signal: controller.signal, cache: "no-store" });
  } catch (e) {
    const reason = e instanceof Error && e.name === "AbortError" ? "timed out" : "is unreachable";
    throw new CalcServiceError("SERVICE_UNAVAILABLE", `Calculation service ${reason} at ${env.calcServiceUrl}. No result was produced; nothing was computed locally.`);
  } finally {
    clearTimeout(timer);
  }
}

async function readError(res: Response): Promise<CalcServiceError> {
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* non-JSON error body */
  }
  const parsed = ServiceErrorSchema.safeParse(body);
  if (parsed.success) return new CalcServiceError(parsed.data.error.code, parsed.data.error.message, res.status);
  return new CalcServiceError("SERVICE_ERROR", `Calculation service returned HTTP ${res.status}.`, res.status);
}

export interface RmdCheckResult {
  response: RmdCheckResponse;
  requestHash: string;
  requestHashVerified: boolean;
}

export async function callRmdCheck(request: RmdCheckRequest, orgId: string): Promise<RmdCheckResult> {
  const res = await doFetch("/v1/checks/rmd", { method: "POST", headers: headers(orgId), body: JSON.stringify(request) });
  if (!res.ok) throw await readError(res);
  const json: unknown = await res.json();
  const parsed = RmdCheckResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new CalcServiceError("CONTRACT_MISMATCH", `Calculation service response did not match the expected contract: ${parsed.error.issues.map((i) => i.path.join(".")).join(", ")}`);
  }
  const requestHash = await canonicalHash(request);
  return { response: parsed.data, requestHash, requestHashVerified: requestHash === parsed.data.receipt.request_hash };
}

export async function fetchRuleSets(orgId: string): Promise<{ rule_sets: RuleSetRef[]; engine_name: string; engine_version: string }> {
  const res = await doFetch("/v1/rules", { method: "GET", headers: headers(orgId) });
  if (!res.ok) throw await readError(res);
  const parsed = RuleSetListResponseSchema.safeParse(await res.json());
  if (!parsed.success) throw new CalcServiceError("CONTRACT_MISMATCH", "Rule registry response did not match the expected contract.");
  return parsed.data;
}

export async function calcHealth(): Promise<{ ok: boolean; engine_version?: string; demo_mode?: boolean; message?: string }> {
  try {
    const res = await doFetch("/health", { method: "GET", headers: { accept: "application/json" } });
    if (!res.ok) return { ok: false, message: `HTTP ${res.status}` };
    const body = (await res.json()) as { engine_version?: string; demo_mode?: boolean };
    return { ok: true, engine_version: body.engine_version, demo_mode: body.demo_mode };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "unreachable" };
  }
}

// ---------------------------------------------------------------- Personal (V5) engines
export interface PersonalCalcResult<T> {
  response: T;
  requestHash: string;
  requestHashVerified: boolean;
}

/** Tenant header for a personal workspace is the workspace id (server-resolved), mirroring org_id for firms. */
export async function callPersonalClarity(request: PersonalClarityRequest, workspaceId: string): Promise<PersonalCalcResult<PersonalClarityResponse>> {
  const res = await doFetch("/v1/personal/clarity", { method: "POST", headers: headers(workspaceId), body: JSON.stringify(request) });
  if (!res.ok) throw await readError(res);
  const parsed = PersonalClarityResponseSchema.safeParse(await res.json());
  if (!parsed.success) throw new CalcServiceError("CONTRACT_MISMATCH", `Personal clarity response did not match the expected contract: ${parsed.error.issues.map((i) => i.path.join(".")).join(", ")}`);
  const requestHash = await canonicalHash(request);
  return { response: parsed.data, requestHash, requestHashVerified: requestHash === parsed.data.receipt.request_hash };
}

export async function callDebtPaths(request: DebtPathsRequest, workspaceId: string): Promise<PersonalCalcResult<DebtPathsResponse>> {
  const res = await doFetch("/v1/personal/debt-paths", { method: "POST", headers: headers(workspaceId), body: JSON.stringify(request) });
  if (!res.ok) throw await readError(res);
  const parsed = DebtPathsResponseSchema.safeParse(await res.json());
  if (!parsed.success) throw new CalcServiceError("CONTRACT_MISMATCH", `Debt paths response did not match the expected contract: ${parsed.error.issues.map((i) => i.path.join(".")).join(", ")}`);
  const requestHash = await canonicalHash(request);
  return { response: parsed.data, requestHash, requestHashVerified: requestHash === parsed.data.receipt.request_hash };
}

export async function fetchMethodSets(workspaceId: string): Promise<{ method_sets: RuleSetRef[]; engine_name: string; engine_version: string }> {
  const res = await doFetch("/v1/methods", { method: "GET", headers: headers(workspaceId) });
  if (!res.ok) throw await readError(res);
  const parsed = MethodSetListResponseSchema.safeParse(await res.json());
  if (!parsed.success) throw new CalcServiceError("CONTRACT_MISMATCH", "Method registry response did not match the expected contract.");
  return parsed.data;
}
