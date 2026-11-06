import "server-only";
import { cookies } from "next/headers";
import { supabaseConfigured } from "@/config/env";
import { resolveIdentity, type ResolvedIdentity } from "./identity";
import { DEFAULT_PERSONA_ID, PERSONA_COOKIE, findPersona } from "./persona";
import { createSupabaseServerClient, identityClientFor } from "./supabase-server";
import { NotFoundError, UnauthenticatedError, type Actor } from "./types";

export { NotFoundError, UnauthenticatedError };
export type { Actor };

/** Selector cookies: which of MY orgs / workspaces. Never authority — a value that matches no RLS-visible row is ignored. */
export const ORG_SELECTOR_COOKIE = "sagespan_org";
export const WORKSPACE_SELECTOR_COOKIE = "sagespan_workspace";

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
 * PR-003b: the signed-in identity, resolved against Supabase Auth and the `app`
 * schema under RLS. Null when Supabase is not configured or nobody is signed in.
 *
 * This resolves WHO the caller is and WHICH tenants the database says they belong
 * to. It does not yet give those actors a data store: domain reads and writes for
 * production actors arrive with the Supabase store adapter (DATA-001), and the UI
 * says so rather than falling back to demo data.
 */
export async function getProductionIdentity(): Promise<ResolvedIdentity | null> {
  if (!supabaseConfigured()) return null;
  const client = await createSupabaseServerClient();
  if (!client) return null;
  const jar = await cookies();
  return resolveIdentity(identityClientFor(client), {
    org_id: jar.get(ORG_SELECTOR_COOKIE)?.value ?? null,
    workspace_id: jar.get(WORKSPACE_SELECTOR_COOKIE)?.value ?? null,
  });
}

/** The firm actor for the signed-in user, or null (not configured, not signed in, or no ACTIVE firm membership). */
export async function getProductionActor(): Promise<Actor | null> {
  const identity = await getProductionIdentity();
  return identity?.firm ?? null;
}

export function assertSameOrg(actor: Actor, orgId: string): void {
  if (actor.org_id !== orgId) throw new NotFoundError();
}
