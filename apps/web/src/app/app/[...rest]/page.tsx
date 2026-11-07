import { redirect } from "next/navigation";
import { getProductionIdentity } from "@/auth/actor";
import { supabaseConfigured } from "@/config/env";
import { ProductionGate } from "@/ui/ProductionGate";
import { ProductionHome } from "@/ui/ProductionHome";

export const dynamic = "force-dynamic";

export default async function AppCatchAll({ params }: { params: Promise<{ rest: string[] }> }) {
  const { rest } = await params;
  const requestedPath = `/app/${rest.join("/")}`;
  if (!supabaseConfigured()) return <ProductionGate requestedPath={requestedPath} />;
  const identity = await getProductionIdentity();
  if (!identity) redirect(`/app/sign-in?next=${encodeURIComponent(requestedPath)}`);
  return <ProductionHome identity={identity} requestedPath={requestedPath} />;
}
