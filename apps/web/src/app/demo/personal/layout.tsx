import type { ReactNode } from "react";
import { getPersonalActor, listPersonalPersonas } from "@/auth/personal-actor";
import { personalBundle } from "@/domain/personal/queries";
import { getStore } from "@/domain/store";
import { PersonalShell } from "@/ui/personal/PersonalShell";

export const dynamic = "force-dynamic";

export default async function PersonalLayout({ children }: { children: ReactNode }) {
  const actor = await getPersonalActor();
  const state = getStore().read();
  const b = personalBundle(state, actor);
  return (
    <PersonalShell actor={actor} workspaceLabel={b.workspace.label} quiet={b.profile.notification_mode === "QUIET"} personas={listPersonalPersonas(state)}>
      {children}
    </PersonalShell>
  );
}
