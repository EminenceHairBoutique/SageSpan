/**
 * Server-side environment access. Never import from client components.
 *
 * Fail-closed rule (audit N-03): when NODE_ENV is "production" and
 * SAGESPAN_DEMO_MODE is not exactly "1", the demo defaults are refused. The
 * calculation-service URL and a non-demo bearer token must then be configured,
 * or the first access (and `register()` in instrumentation.ts at server start)
 * throws EnvironmentError. In development the demo defaults still apply.
 */

const DEMO_TOKEN = "demo-local-token";
const DEFAULT_CALC_URL = "http://127.0.0.1:8010";

export class EnvironmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EnvironmentError";
  }
}

const isProduction = (): boolean => process.env.NODE_ENV === "production";

/** True when demo defaults must not be used: production without an explicit demo opt-in. */
export function failClosed(): boolean {
  return isProduction() && process.env.SAGESPAN_DEMO_MODE?.trim() !== "1";
}

/** Demo mode is the default in development and strictly opt-in ("1") in production. */
export function demoModeEnabled(): boolean {
  const flag = process.env.SAGESPAN_DEMO_MODE?.trim();
  if (flag) return flag === "1";
  return !isProduction();
}

function readCalcServiceToken(): string {
  const token = process.env.CALC_SERVICE_TOKEN?.trim();
  if (failClosed()) {
    if (!token || token === DEMO_TOKEN) {
      throw new EnvironmentError('CALC_SERVICE_TOKEN must be set to a non-demo value when NODE_ENV="production" and SAGESPAN_DEMO_MODE is not "1".');
    }
    return token;
  }
  return token || DEMO_TOKEN;
}

function readCalcServiceUrl(): string {
  const url = process.env.CALC_SERVICE_URL?.trim();
  if (failClosed() && !url) {
    throw new EnvironmentError('CALC_SERVICE_URL must be set when NODE_ENV="production" and SAGESPAN_DEMO_MODE is not "1".');
  }
  return (url || DEFAULT_CALC_URL).replace(/\/+$/, "");
}

/** Lazy getters: nothing is validated at import time, so `next build` and tests load this module freely. */
export const env = {
  get demoMode(): boolean {
    return demoModeEnabled();
  },
  /** File name inside apps/web/.demo-state (directories in the value are ignored). */
  get demoStatePath(): string {
    return process.env.SAGESPAN_DEMO_STATE_PATH?.trim() || "state.json";
  },
  get calcServiceUrl(): string {
    return readCalcServiceUrl();
  },
  get calcServiceToken(): string {
    return readCalcServiceToken();
  },
  get supabaseUrl(): string {
    return process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
  },
  get supabaseAnonKey(): string {
    return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || "";
  },
};

export function supabaseConfigured(): boolean {
  return Boolean(env.supabaseUrl && env.supabaseAnonKey);
}

/** Runs once at server start (instrumentation.ts) so a misconfigured production deployment fails before serving a request. */
export function assertServerEnvironment(): void {
  if (!failClosed()) return;
  void env.calcServiceUrl;
  void env.calcServiceToken;
}
