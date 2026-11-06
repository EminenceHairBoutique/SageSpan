import Link from "next/link";
import { Lock } from "lucide-react";
import { brand } from "@/config/brand";
import { supabaseConfigured } from "@/config/env";
import { Alert, ButtonLink, Card, KeyValue } from "@/ui/primitives";

/**
 * /app/* is the authenticated production namespace. This build ships the
 * schema, RLS policies and workflow functions for Supabase, but the
 * Supabase-backed data store adapter and session wiring are not implemented
 * yet. Rather than fall back to demo data behind a "login", we say so.
 */
export function ProductionGate({ requestedPath }: { requestedPath?: string }) {
  const configured = supabaseConfigured();
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <Card
        title={
          <span className="flex items-center gap-2">
            <Lock size={18} aria-hidden /> Production mode is not available in this build
          </span>
        }
        subtitle={requestedPath ? `Requested: ${requestedPath}` : undefined}
      >
        <Alert tone={configured ? "amber" : "slate"} title={configured ? "Supabase credentials detected, but the production data store is not wired" : "Supabase is not configured"}>
          {configured ? "NEXT_PUBLIC_SUPABASE_URL and the anon key are set, but this build has no Supabase-backed store adapter; sessions are not resolved against real memberships yet." : "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY after applying supabase/migrations, then implement the Supabase store adapter (see docs/ARCHITECTURE.md)."}
        </Alert>
        <KeyValue
          className="mt-4"
          rows={[
            { k: "Available now", v: "Synthetic demo console at /demo/app with simulated reviewer personas." },
            { k: "Shipped for production", v: "Normalised schema, RLS policies, append-only triggers and SECURITY DEFINER workflow functions under supabase/migrations, with SQL tests under supabase/tests." },
            { k: "Still required", v: "Supabase project, applied migrations, auth session resolution in src/auth/actor.ts, a Supabase store adapter implementing the same domain functions, and the release gates in docs/SECURITY_AND_LIMITS.md." },
          ]}
        />
        <div className="mt-6 flex flex-wrap gap-3">
          <ButtonLink href="/demo/app/reviews">Open the synthetic demo</ButtonLink>
          <ButtonLink href="/security" variant="secondary">
            Security design approach
          </ButtonLink>
        </div>
        <p className="mt-6 text-xs text-ink-muted">
          {brand.name} is a provisional working name. <Link href="/" className="underline">Back to the site</Link>.
        </p>
      </Card>
    </main>
  );
}
