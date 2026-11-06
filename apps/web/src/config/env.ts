/** Server-side environment access. Never import from client components. */

export const env = {
  demoMode: (process.env.SAGESPAN_DEMO_MODE ?? "1") === "1",
  demoStatePath: process.env.SAGESPAN_DEMO_STATE_PATH?.trim() || ".demo-state/state.json",
  calcServiceUrl: (process.env.CALC_SERVICE_URL?.trim() || "http://127.0.0.1:8010").replace(/\/+$/, ""),
  calcServiceToken: process.env.CALC_SERVICE_TOKEN?.trim() || "demo-local-token",
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || "",
};

export function supabaseConfigured(): boolean {
  return Boolean(env.supabaseUrl && env.supabaseAnonKey);
}
