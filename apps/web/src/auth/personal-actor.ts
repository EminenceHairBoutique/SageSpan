import "server-only";
import { cookies } from "next/headers";
import type { DataState, WorkspaceActor, WorkspaceRole } from "@sagespan/contracts";
import { getStore } from "@/domain/store";
import { NotFoundError, UnauthenticatedError } from "./types";

/**
 * Demo identity for the Personal workspace. Deliberately separate from the firm
 * persona cookie: a simulated individual is never a firm member, and switching
 * firm personas never changes who the personal workspace belongs to. Production
 * identity (Supabase Auth) arrives with PR-003 and replaces this file's cookie
 * lookup only; the WorkspaceActor shape stays.
 *
 * PERS-002: personas are read from the demo store, not the static seed, so a
 * workspace created by "Start fresh" resolves like the seeded one. The cookie
 * names a principal; membership, role and workspace are always re-derived here.
 */
export const PRINCIPAL_COOKIE = "sagespan_demo_principal";
export const DEFAULT_PRINCIPAL_ID = "pr_castillo";

export interface PersonalPersona {
  principal_id: string;
  display_name: string;
  workspace_id: string;
  workspace_role: WorkspaceRole;
  status: "ACTIVE" | "INVITED" | "REVOKED";
}

export function listPersonalPersonas(state: DataState = getStore().read()): PersonalPersona[] {
  const seed = state;
  return seed.workspace_memberships
    .filter((m) => seed.workspaces.find((w) => w.id === m.workspace_id)?.kind !== "FIRM")
    .map((m) => ({
      principal_id: m.principal_id,
      display_name: seed.principals.find((p) => p.id === m.principal_id)?.display_name ?? m.principal_id,
      workspace_id: m.workspace_id,
      workspace_role: m.role,
      status: m.status,
    }));
}

/**
 * The actor every personal domain function takes. DEMO actors come from the persona cookie
 * below; PRODUCTION actors come from the Supabase session (src/auth/actor.ts, DATA-001).
 * Domain code reads only principal_id / workspace_id / workspace_role / domains.
 */
export type PersonalActor = Extract<WorkspaceActor, { scope: "PERSONAL" | "HOUSEHOLD" }> & ({ mode: "DEMO"; actor_type: "SIMULATED_INDIVIDUAL" } | { mode: "PRODUCTION"; actor_type: "USER" });

export async function getPersonalActor(): Promise<PersonalActor> {
  const jar = await cookies();
  const wanted = jar.get(PRINCIPAL_COOKIE)?.value ?? DEFAULT_PRINCIPAL_ID;
  const seed = getStore().read();
  const membership = seed.workspace_memberships.find((m) => m.principal_id === wanted && m.status === "ACTIVE") ?? seed.workspace_memberships.find((m) => m.principal_id === DEFAULT_PRINCIPAL_ID && m.status === "ACTIVE");
  if (!membership) throw new UnauthenticatedError("No demo individual available");
  const ws = seed.workspaces.find((w) => w.id === membership.workspace_id);
  if (!ws || ws.kind === "FIRM") throw new NotFoundError();
  const principal = seed.principals.find((p) => p.id === membership.principal_id);
  return {
    scope: ws.kind,
    principal_id: membership.principal_id,
    workspace_id: ws.id,
    workspace_role: membership.role,
    domains: membership.domains,
    display_name: principal?.display_name ?? membership.principal_id,
    mode: "DEMO",
    actor_type: "SIMULATED_INDIVIDUAL",
  };
}
