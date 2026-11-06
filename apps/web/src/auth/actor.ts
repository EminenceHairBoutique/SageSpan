import "server-only";
import { cookies } from "next/headers";
import { env, supabaseConfigured } from "@/config/env";
import { DEFAULT_PERSONA_ID, PERSONA_COOKIE, findPersona } from "./persona";
import { NotFoundError, UnauthenticatedError, type Actor } from "./types";

export { NotFoundError, UnauthenticatedError };
export type { Actor };

export async function getDemoActor(): Promise<Actor> {
  const jar = await cookies();
  const persona = findPersona(jar.get(PERSONA_COOKIE)?.value) ?? findPersona(DEFAULT_PERSONA_ID);
  if (!persona) throw new UnauthenticatedError("No demo persona available");
  return {
    user_id: persona.user_id,
    org_id: persona.org_id,
    role: persona.role,
    display_name: persona.display_name,
    actor_type: "SIMULATED_REVIEWER",
    mode: "DEMO",
  };
}

/**
 * Production actor resolution. Requires Supabase configuration and an active
 * session. The Supabase-backed data store is not implemented in this build, so
 * callers surface an honest "not configured" state rather than demo data.
 */
export async function getProductionActor(): Promise<Actor | null> {
  if (!supabaseConfigured() || !env.demoMode) return null;
  return null;
}

export function assertSameOrg(actor: Actor, orgId: string): void {
  if (actor.org_id !== orgId) throw new NotFoundError();
}
