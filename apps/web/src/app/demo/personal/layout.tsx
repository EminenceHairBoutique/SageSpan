import type { ReactNode } from "react";
import { getPersonalActor } from "@/auth/personal-actor";
import { personalBundle } from "@/domain/personal/queries";
import { getStore } from "@/domain/store";
import { PersonalShell } from "@/ui/personal/PersonalShell";

export const dynamic = "force-dynamic";

export default async function PersonalLayout({ children }: { children: ReactNode }) {
  const actor = await getPersonalActor();
  const b = personalBundle(getStore().read(), actor);
  return (
    <PersonalShell actor={actor} workspaceLabel={b.workspace.label} quiet={b.profile.notification_mode === "QUIET"}>
      {children}
    </PersonalShell>
  );
}
