import type { Role } from "@sagespan/contracts";
import { loadSeed } from "@/domain/seed";

/**
 * Demo personas. In DEMO mode there is no authentication: the console shows a
 * conspicuous banner and a persona switcher, and every reviewer action is
 * recorded with actor_type SIMULATED_REVIEWER. Production mode requires a real
 * authenticated user (see src/auth/actor.ts).
 */
export interface Persona {
  user_id: string;
  display_name: string;
  title: string;
  role: Role;
  org_id: string;
  org_name: string;
}

export const PERSONA_COOKIE = "sagespan_demo_persona";
export const DEFAULT_PERSONA_ID = "user_hp_analyst";

export function listPersonas(): Persona[] {
  const seed = loadSeed();
  return seed.memberships
    .filter((m) => m.status === "ACTIVE")
    .map((m) => {
      const profile = seed.profiles.find((p) => p.user_id === m.user_id);
      const org = seed.organizations.find((o) => o.id === m.org_id);
      return {
        user_id: m.user_id,
        display_name: profile?.display_name ?? m.user_id,
        title: profile?.title ?? "",
        role: m.role,
        org_id: m.org_id,
        org_name: org?.name ?? m.org_id,
      };
    });
}

export function findPersona(userId: string | undefined | null): Persona | undefined {
  if (!userId) return undefined;
  return listPersonas().find((p) => p.user_id === userId);
}
