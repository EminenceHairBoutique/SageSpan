import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import type { ResolvedIdentity } from "@/auth/identity";
import { brand } from "@/config/brand";
import { selectOrgAction, selectWorkspaceAction, signOutAction } from "@/server/auth-actions";
import { Alert, Card, Chip, EmptyState, KeyValue, buttonClasses } from "@/ui/primitives";

/**
 * PR-003b — what a signed-in production user sees. It shows exactly what the database
 * resolved for them under RLS (firm memberships, personal / household workspaces,
 * consent-granted read scopes) and says plainly that production workflows are not
 * wired yet: domain reads and writes for these actors arrive with the Supabase store
 * adapter (DATA-001). No demo data is shown behind a real login.
 */
export function ProductionHome({ identity, requestedPath }: { identity: ResolvedIdentity; requestedPath?: string }) {
  const { user, firms, firm, workspaces, personal, granted } = identity;
  const nothing = firms.length === 0 && workspaces.length === 0 && granted.length === 0;
  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-12">
      <Card
        title={
          <span className="flex items-center gap-2">
            <ShieldCheck size={18} aria-hidden /> Signed in as {firm?.display_name ?? personal?.display_name ?? user.email ?? "member"}
          </span>
        }
        subtitle={user.email ?? undefined}
        actions={
          <form action={signOutAction}>
            <button type="submit" className={buttonClasses("secondary", "sm")} data-testid="sign-out">
              Sign out
            </button>
          </form>
        }
      >
        <Alert tone="amber" title="Production workflows are not available in this build">
          Your identity and tenant memberships are resolved against the database under row-level security. The production data store adapter that the
          firm console and Personal workspace need (DATA-001) is not implemented yet, so no plan, record or review is shown or editable here.
          {requestedPath ? ` Requested: ${requestedPath}.` : ""} The synthetic demos remain at <Link href="/demo/personal" className="underline">/demo/personal</Link> and{" "}
          <Link href="/demo/app" className="underline">/demo/app</Link>.
        </Alert>
      </Card>

      {nothing ? (
        <EmptyState title="No memberships yet">
          This account is not an active member of any firm and owns no personal workspace. A firm administrator can add you to their roster; personal
          workspace creation from this screen arrives with the store adapter.
        </EmptyState>
      ) : null}

      {firms.length > 0 ? (
        <Card title="Firm memberships" subtitle="From app.memberships, ACTIVE only. The selected firm is the one every firm-console permission check would use.">
          <ul className="divide-y divide-line">
            {firms.map((f) => (
              <li key={f.org_id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="flex items-center gap-2">
                  <span className="font-medium">{f.org_name}</span>
                  <Chip tone="neutral">{f.role}</Chip>
                  {firm?.org_id === f.org_id ? <Chip tone="teal">selected</Chip> : null}
                </span>
                {firm?.org_id !== f.org_id ? (
                  <form action={selectOrgAction}>
                    <input type="hidden" name="org_id" value={f.org_id} />
                    <button type="submit" className={buttonClasses("ghost", "sm")}>
                      Select
                    </button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {workspaces.length > 0 ? (
        <Card title="Your workspaces" subtitle="From app.my_workspace_access(): what the database says you may read, per workspace.">
          <ul className="divide-y divide-line">
            {workspaces.map((w) => (
              <li key={w.workspace_id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{w.label}</span>
                  <Chip tone="neutral">{w.kind}</Chip>
                  <Chip tone="neutral">{w.workspace_role}</Chip>
                  {w.workspace_role === "OWNER" ? <Chip tone="neutral">all domains</Chip> : w.domains.map((d) => <Chip key={d} tone="neutral">{d}</Chip>)}
                  {personal?.workspace_id === w.workspace_id ? <Chip tone="teal">selected</Chip> : null}
                </span>
                {personal?.workspace_id !== w.workspace_id ? (
                  <form action={selectWorkspaceAction}>
                    <input type="hidden" name="workspace_id" value={w.workspace_id} />
                    <button type="submit" className={buttonClasses("ghost", "sm")}>
                      Select
                    </button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {granted.length > 0 ? (
        <Card title="Shared with you by consent" subtitle="Read-only, limited to the listed domains, and gone the moment the owner revokes or the grant expires.">
          <ul className="divide-y divide-line">
            {granted.map((g) => (
              <li key={g.workspace_id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                <span className="font-medium">{g.label}</span>
                <Chip tone="neutral">{g.kind}</Chip>
                {g.domains.map((d) => (
                  <Chip key={d} tone="neutral">
                    {d}
                  </Chip>
                ))}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card title="How this screen was built">
        <KeyValue
          rows={[
            { k: "Session", v: "Supabase Auth cookie, verified server-side with auth.getUser(); never getSession()." },
            { k: "Tenancy", v: "PostgREST reads of app.memberships / app.workspaces as the authenticated user; RLS decides the rows. Selector cookies only pick among rows already returned." },
            { k: "Not here", v: "Service-role key (never read by the app), demo personas, any domain data." },
          ]}
        />
        <p className="mt-4 text-xs text-ink-muted">
          {brand.name} is a provisional working name. <Link href="/" className="underline">Back to the site</Link>.
        </p>
      </Card>
    </main>
  );
}
