import { ProductionGate } from "@/ui/ProductionGate";

export const dynamic = "force-dynamic";

export default async function AppCatchAll({ params }: { params: Promise<{ rest: string[] }> }) {
  const { rest } = await params;
  return <ProductionGate requestedPath={`/app/${rest.join("/")}`} />;
}
