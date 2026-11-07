import { redirect } from "next/navigation";
import { Lock } from "lucide-react";
import { getProductionIdentity } from "@/auth/actor";
import { brand } from "@/config/brand";
import { supabaseConfigured } from "@/config/env";
import { ProductionGate } from "@/ui/ProductionGate";
import { SignInForm } from "@/ui/SignInForm";
import { Card } from "@/ui/primitives";

export const dynamic = "force-dynamic";

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (!supabaseConfigured()) return <ProductionGate requestedPath="/app/sign-in" />;
  const identity = await getProductionIdentity();
  if (identity) redirect("/app");
  const { next } = await searchParams;
  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <Card
        title={
          <span className="flex items-center gap-2">
            <Lock size={18} aria-hidden /> Sign in to {brand.name}
          </span>
        }
        subtitle="Production workspace. Your memberships and workspaces are resolved on the server from your session; nothing is taken from the browser."
      >
        <SignInForm next={next} />
      </Card>
    </main>
  );
}
