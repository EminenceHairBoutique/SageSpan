import { redirect } from "next/navigation";
import { getProductionIdentity } from "@/auth/actor";
import { supabaseConfigured } from "@/config/env";
import { ProductionGate } from "@/ui/ProductionGate";
import { ProductionHome } from "@/ui/ProductionHome";

export const dynamic = "force-dynamic";

export default async function AppIndex() {
  if (!supabaseConfigured()) return <ProductionGate />;
  const identity = await getProductionIdentity();
  if (!identity) redirect("/app/sign-in");
  return <ProductionHome identity={identity} />;
}
