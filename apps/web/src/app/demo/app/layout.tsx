import type { ReactNode } from "react";
import { getDemoActor } from "@/auth/actor";
import { listPersonas } from "@/auth/persona";
import { getStore } from "@/domain/store";
import { orgById } from "@/domain/queries";
import { ConsoleShell } from "@/ui/console/ConsoleShell";

export const dynamic = "force-dynamic";

export default async function DemoAppLayout({ children }: { children: ReactNode }) {
  const actor = await getDemoActor();
  const state = getStore().read();
  const org = orgById(state, actor.org_id);
  return (
    <ConsoleShell actor={actor} personas={listPersonas()} orgName={org.name}>
      {children}
    </ConsoleShell>
  );
}
