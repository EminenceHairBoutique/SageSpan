import Link from "next/link";
import { Lock } from "lucide-react";
import { brand } from "@/config/brand";
import { supabaseConfigured } from "@/config/env";
import { Alert, ButtonLink, Card, KeyValue } from "@/ui/primitives";

/**
 * /app/* is the authenticated production namespace. Shown only when Supabase is
 * NOT configured. With NEXT_PUBLIC_SUPABASE_URL / anon key set, /app resolves the
 * session (PR-003b) and shows ProductionHome instead; the production data store
 * adapter is still not implemented, and that screen says so rather than falling
 * back to demo data behind a login.
 */
export function ProductionGate({ requestedPath }: { requestedPath?: string }) {
  const configured = supabaseConfigured();
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <Card
        title={
          <span className="flex items-center gap-2">
            <Lock size={18} aria-hidden /> Sign-in is not available in this build
          </span>
        }
        subtitle={requestedPath ? `Requested: ${requestedPath}` : undefined}
      >
        <Alert tone={configured ? "amber" : "slate"} title={configured ? "Supabase credentials detected" : "Supabase is not configured"}>
          {configured ? "NEXT_PUBLIC_SUPABASE_URL and the anon key are set; sign in at /app/sign-in. Identity and tenant memberships resolve under RLS, but the production data store adapter is not implemented yet." : "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY after applying supabase/migrations; sign-in then resolves memberships under RLS. The Supabase store adapter (DATA-001) is still required for production workflows."}
        </Alert>
        <KeyValue
          className="mt-4"
          rows={[
            { k: "Available now", v: "Synthetic Personal workspace at /demo/personal (fictional individual) and synthetic firm console at /demo/app (simulated reviewers)." },
            { k: "Shipped for production", v: "Normalised schema, RLS policies (firm and consumer workspaces), append-only triggers and SECURITY DEFINER workflow functions under supabase/migrations, SQL tests under supabase/tests, and server-side session / membership resolution (src/auth)." },
            { k: "Still required", v: "A Supabase project with the migrations applied, a Supabase store adapter implementing the same domain functions (DATA-001), real-stack security evidence, and the release gates in docs/SECURITY_AND_LIMITS.md." },
          ]}
        />
        <div className="mt-6 flex flex-wrap gap-3">
          <ButtonLink href="/demo/personal">Open the Personal demo</ButtonLink>
          <ButtonLink href="/demo/app/reviews" variant="secondary">
            Open the firm demo
          </ButtonLink>
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
