import "server-only";
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env, supabaseConfigured } from "@/config/env";
import type { FirmMembershipRow, IdentityClient, ProfileRow, SessionUser, WorkspaceAccessRow, WorkspaceRow } from "./identity";

/**
 * PR-003b — the only place the web tier touches Supabase Auth.
 *
 *  - Anon key + the user's own session cookie: every PostgREST read below runs as
 *    `authenticated` with the user's JWT, so RLS (0003/0005/0008) is what decides
 *    which rows come back. No service-role key is read anywhere in the app.
 *  - Reads go to the `app` schema (exposed in supabase/config.toml). The database
 *    enforces membership; the client never passes an org_id or workspace_id as
 *    authority, only as a filter the policies re-check.
 *  - Cookie writes can fail inside a Server Component (read-only cookies); that is
 *    the documented @supabase/ssr pattern and is safe to swallow because the
 *    token refresh is retried on the next request that can set cookies.
 */
export async function createSupabaseServerClient(): Promise<SupabaseClient | null> {
  if (!supabaseConfigured()) return null;
  const jar = await cookies();
  return createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return jar.getAll();
      },
      setAll(toSet: Array<{ name: string; value: string; options: CookieOptions }>) {
        try {
          for (const { name, value, options } of toSet) jar.set(name, value, options);
        } catch {
          /* Server Component render: cookies are read-only here; refreshed on a mutable request. */
        }
      },
    },
  });
}

type Row = Record<string, unknown>;
const str = (v: unknown): string | null => (typeof v === "string" ? v : null);

/** Adapt a Supabase client to the narrow IdentityClient the resolvers use. */
export function identityClientFor(client: SupabaseClient): IdentityClient {
  const app = () => client.schema("app");
  return {
    async getUser(): Promise<SessionUser | null> {
      // getUser() verifies the token with the auth server (unlike getSession(), which trusts the cookie).
      const { data, error } = await client.auth.getUser();
      if (error || !data.user) return null;
      return { id: data.user.id, email: data.user.email ?? null };
    },
    async listFirmMemberships(userId: string): Promise<FirmMembershipRow[]> {
      const { data, error } = await app().from("memberships").select("org_id, role, status, organizations(name, slug)").eq("user_id", userId);
      if (error || !data) return [];
      return (data as Row[]).map((r) => {
        const org = (Array.isArray(r.organizations) ? r.organizations[0] : r.organizations) as Row | null | undefined;
        return { org_id: String(r.org_id), role: String(r.role), status: String(r.status), org_name: str(org?.name), org_slug: str(org?.slug) };
      });
    },
    async getProfile(userId: string): Promise<ProfileRow | null> {
      const { data, error } = await app().from("profiles").select("display_name").eq("user_id", userId).maybeSingle();
      if (error || !data) return null;
      return { display_name: String((data as Row).display_name ?? "") };
    },
    async listWorkspaces(): Promise<WorkspaceRow[]> {
      const { data, error } = await app().from("workspaces").select("id, kind, label").neq("kind", "FIRM");
      if (error || !data) return [];
      return (data as Row[]).map((r) => ({ id: String(r.id), kind: String(r.kind), label: String(r.label) }));
    },
    async workspaceAccess(workspaceId: string): Promise<WorkspaceAccessRow | null> {
      const { data, error } = await app().rpc("my_workspace_access", { p_workspace: workspaceId });
      if (error || !data) return null;
      const row = (Array.isArray(data) ? data[0] : data) as Row | undefined;
      if (!row) return null;
      return {
        workspace_id: String(row.workspace_id),
        kind: String(row.kind),
        label: String(row.label),
        membership_role: str(row.membership_role),
        membership_status: str(row.membership_status),
        readable_domains: Array.isArray(row.readable_domains) ? row.readable_domains.map(String) : [],
        via: String(row.via ?? "NONE"),
      };
    },
  };
}
