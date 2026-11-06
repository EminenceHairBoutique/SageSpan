import type { Role, ShareDomain, WorkspaceActor, WorkspaceKind, WorkspaceRole } from "@sagespan/contracts";
import { ROLES, SHARE_DOMAINS, WORKSPACE_KINDS, WORKSPACE_ROLES } from "@sagespan/contracts";
import type { Actor } from "./types";

/**
 * PR-003b — production identity resolution, independent of any transport.
 *
 * Everything an Actor or WorkspaceActor carries is re-derived here from (1) the
 * authenticated user the session server vouches for and (2) rows the database
 * returns UNDER ROW-LEVEL SECURITY for that user. Nothing is taken from cookies,
 * query strings or form fields except a *selector* (which of my orgs / which of
 * my workspaces), and a selector that does not match a row the database already
 * showed us is ignored, not trusted.
 *
 * `IdentityClient` is the narrow surface the resolvers need. `supabase-server.ts`
 * adapts a real @supabase/ssr client to it; tests pass a hand-written mock. Keeping
 * the interface small is what lets the resolution logic be unit-tested without a
 * Supabase stack, and lets the real-stack job (PR-003c) exercise the same RLS paths
 * with real JWTs.
 */
export interface SessionUser {
  id: string;
  email: string | null;
}

export interface FirmMembershipRow {
  org_id: string;
  role: string;
  status: string;
  org_name: string | null;
  org_slug: string | null;
}

export interface ProfileRow {
  display_name: string;
}

export interface WorkspaceRow {
  id: string;
  kind: string;
  label: string;
}

export interface WorkspaceAccessRow {
  workspace_id: string;
  kind: string;
  label: string;
  membership_role: string | null;
  membership_status: string | null;
  readable_domains: string[];
  via: string;
}

export interface IdentityClient {
  /** The user the auth server vouches for (token verified server-side), or null. */
  getUser(): Promise<SessionUser | null>;
  /** app.memberships rows visible to the caller under RLS (their own orgs' rosters) filtered to themselves. */
  listFirmMemberships(userId: string): Promise<FirmMembershipRow[]>;
  getProfile(userId: string): Promise<ProfileRow | null>;
  /** app.workspaces rows visible to the caller under RLS (member of any status, or active grantee). */
  listWorkspaces(): Promise<WorkspaceRow[]>;
  /** app.my_workspace_access(p_workspace): one row or none. */
  workspaceAccess(workspaceId: string): Promise<WorkspaceAccessRow | null>;
}

export interface ResolvedIdentity {
  user: SessionUser;
  /** Every ACTIVE firm membership, so the UI can offer a switcher. */
  firms: Array<{ org_id: string; org_name: string; role: Role }>;
  /** The firm actor for the selected (or only) org, if any. */
  firm: Actor | null;
  /** Personal / household workspaces the user is an ACTIVE member of. */
  workspaces: Array<{ workspace_id: string; kind: Exclude<WorkspaceKind, "FIRM">; label: string; workspace_role: WorkspaceRole; domains: ShareDomain[] }>;
  /** The personal actor for the selected (or only) workspace, if any. */
  personal: Extract<WorkspaceActor, { scope: "PERSONAL" | "HOUSEHOLD" }> | null;
  /** Workspaces reachable only through a consent grant (read-only, by domain). Not an actor: reads need the store adapter (DATA-001). */
  granted: Array<{ workspace_id: string; kind: Exclude<WorkspaceKind, "FIRM">; label: string; domains: ShareDomain[] }>;
}

export interface Selectors {
  org_id?: string | null;
  workspace_id?: string | null;
}

const isRole = (v: string): v is Role => (ROLES as readonly string[]).includes(v);
const isWorkspaceRole = (v: string | null): v is WorkspaceRole => v !== null && (WORKSPACE_ROLES as readonly string[]).includes(v);
const isConsumerKind = (v: string): v is Exclude<WorkspaceKind, "FIRM"> => v !== "FIRM" && (WORKSPACE_KINDS as readonly string[]).includes(v);
const toDomains = (v: readonly string[]): ShareDomain[] => v.filter((d): d is ShareDomain => (SHARE_DOMAINS as readonly string[]).includes(d));

function displayNameFor(profile: ProfileRow | null, user: SessionUser): string {
  const fromProfile = profile?.display_name?.trim();
  if (fromProfile) return fromProfile;
  const local = user.email?.split("@")[0]?.trim();
  return local || "Member";
}

/**
 * Resolve the signed-in identity. Returns null when there is no verified user.
 * Never throws for "not a member": a signed-in user with no memberships is a valid
 * state the UI must show honestly (they can create a personal workspace or wait
 * for a firm invitation).
 */
export async function resolveIdentity(client: IdentityClient, selectors: Selectors = {}): Promise<ResolvedIdentity | null> {
  const user = await client.getUser();
  if (!user) return null;

  const [memberships, profile, workspaceRows] = await Promise.all([client.listFirmMemberships(user.id), client.getProfile(user.id), client.listWorkspaces()]);
  const displayName = displayNameFor(profile, user);

  // Firm side: only ACTIVE memberships with a role the contracts know; sorted for determinism.
  const firms = memberships
    .filter((m) => m.status === "ACTIVE" && isRole(m.role))
    .map((m) => ({ org_id: m.org_id, org_name: m.org_name?.trim() || m.org_slug || m.org_id, role: m.role as Role }))
    .sort((a, b) => a.org_name.localeCompare(b.org_name) || a.org_id.localeCompare(b.org_id));
  const chosenFirm = firms.find((f) => f.org_id === selectors.org_id) ?? firms[0] ?? null;
  const firm: Actor | null = chosenFirm
    ? { user_id: user.id, org_id: chosenFirm.org_id, role: chosenFirm.role, display_name: displayName, actor_type: "USER", mode: "PRODUCTION" }
    : null;

  // Consumer side: ask the database what the caller may read in each visible workspace.
  const consumerRows = workspaceRows.filter((w) => isConsumerKind(w.kind)).sort((a, b) => a.label.localeCompare(b.label) || a.id.localeCompare(b.id));
  const access = await Promise.all(consumerRows.map((w) => client.workspaceAccess(w.id)));
  const workspaces: ResolvedIdentity["workspaces"] = [];
  const granted: ResolvedIdentity["granted"] = [];
  for (const row of access) {
    if (!row || !isConsumerKind(row.kind)) continue;
    const domains = toDomains(row.readable_domains ?? []);
    if (row.via === "MEMBERSHIP" && row.membership_status === "ACTIVE" && isWorkspaceRole(row.membership_role)) {
      workspaces.push({ workspace_id: row.workspace_id, kind: row.kind, label: row.label, workspace_role: row.membership_role, domains });
    } else if (row.via === "CONSENT_GRANT" && domains.length > 0) {
      granted.push({ workspace_id: row.workspace_id, kind: row.kind, label: row.label, domains });
    }
    // via = INVITED_ONLY: visible, but confers nothing until accepted.
  }
  // Prefer the selector, then an owned workspace, then the first.
  const chosenWs = workspaces.find((w) => w.workspace_id === selectors.workspace_id) ?? workspaces.find((w) => w.workspace_role === "OWNER") ?? workspaces[0] ?? null;
  const personal: ResolvedIdentity["personal"] = chosenWs
    ? { scope: chosenWs.kind, principal_id: user.id, workspace_id: chosenWs.workspace_id, workspace_role: chosenWs.workspace_role, domains: chosenWs.domains, display_name: displayName }
    : null;

  return { user, firms, firm, workspaces, personal, granted };
}
