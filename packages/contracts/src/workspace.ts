import { z } from "zod";
import type { Role } from "./enums";

/**
 * V5 tenancy model (docs/architecture/DUAL_WORKSPACE_ADR.md).
 *
 * A *principal* (a person) may own a PERSONAL workspace, participate in a
 * HOUSEHOLD workspace, and belong to a FIRM workspace. Workspaces are not
 * interchangeable organisations: firm membership never implies access to an
 * individual's private records, and household membership is scoped by explicit
 * per-domain grants. The historical firm model (`organizations`, `memberships`,
 * `org_id` on every row) is preserved unchanged; a FIRM workspace *is* an
 * organization (`firm_org_id`). Consumer records carry `workspace_id` instead.
 */
export const WORKSPACE_KINDS = ["PERSONAL", "HOUSEHOLD", "FIRM"] as const;
export type WorkspaceKind = (typeof WORKSPACE_KINDS)[number];

export const WORKSPACE_ROLES = ["OWNER", "PARTICIPANT", "VIEWER"] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

/** Data domains a household participant or an advisor can be granted. Field-level grants are a later refinement. */
export const SHARE_DOMAINS = ["CASH_FLOW", "SPENDING", "DEBT", "SAVINGS_GOALS", "RETIREMENT", "DOCUMENTS", "AI_SUMMARIES"] as const;
export type ShareDomain = (typeof SHARE_DOMAINS)[number];

export const CONSENT_PURPOSES = ["HOUSEHOLD_PLANNING", "ADVISOR_REVIEW", "SECOND_OPINION", "SUPPORT"] as const;
export type ConsentPurpose = (typeof CONSENT_PURPOSES)[number];

export interface Principal {
  id: string;
  display_name: string;
  /** Demo builds only; production identity comes from Supabase Auth (PR-003). */
  simulated: boolean;
}

export interface Workspace {
  id: string;
  kind: WorkspaceKind;
  label: string;
  owner_principal_id: string | null;
  /** Set only for FIRM workspaces: the historical organization this workspace maps to. */
  firm_org_id: string | null;
  created_at: string;
}

export interface WorkspaceMembership {
  id: string;
  workspace_id: string;
  principal_id: string;
  role: WorkspaceRole;
  /** For HOUSEHOLD workspaces: which domains this participant may see. OWNER implies all. */
  domains: ShareDomain[];
  status: "ACTIVE" | "INVITED" | "REVOKED";
  created_at: string;
}

/**
 * Purpose-limited, revocable sharing of a workspace's records with another
 * principal or firm. Nothing is readable across workspaces without an ACTIVE,
 * unexpired grant covering the domain and purpose.
 */
export interface ConsentGrant {
  id: string;
  grantor_workspace_id: string;
  grantor_principal_id: string;
  grantee_principal_id: string | null;
  grantee_org_id: string | null;
  domains: ShareDomain[];
  purpose: ConsentPurpose;
  granted_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  revoked_by: string | null;
  /** Legal/regulatory retention exception noted for the grantee, if any. Communicated to the user. */
  retention_note: string | null;
  version: number;
}

export const ConsentGrantSchema = z.strictObject({
  id: z.string().min(1),
  grantor_workspace_id: z.string().min(1),
  grantor_principal_id: z.string().min(1),
  grantee_principal_id: z.string().nullable(),
  grantee_org_id: z.string().nullable(),
  domains: z.array(z.enum(SHARE_DOMAINS)).min(1),
  purpose: z.enum(CONSENT_PURPOSES),
  granted_at: z.iso.datetime(),
  expires_at: z.iso.datetime().nullable(),
  revoked_at: z.iso.datetime().nullable(),
  revoked_by: z.string().nullable(),
  retention_note: z.string().nullable(),
  version: z.number().int().min(1),
});

/** A grant is usable only when active, unexpired and covering the requested domain. */
export function grantCovers(grant: ConsentGrant, domain: ShareDomain, now: Date): boolean {
  if (grant.revoked_at) return false;
  if (grant.expires_at && new Date(grant.expires_at).getTime() <= now.getTime()) return false;
  return grant.domains.includes(domain);
}

/**
 * The V5 workspace-scoped actor. A firm actor keeps the historical shape
 * (org_id + Role) so every existing permission check continues to work; a
 * personal/household actor carries workspace scope instead. The two never mix:
 * a firm actor has no personal workspace and vice versa unless a ConsentGrant
 * says so.
 */
export type WorkspaceActor =
  | { scope: "FIRM"; principal_id: string; org_id: string; role: Role; display_name: string }
  | { scope: "PERSONAL" | "HOUSEHOLD"; principal_id: string; workspace_id: string; workspace_role: WorkspaceRole; domains: ShareDomain[]; display_name: string };

export function actorCanReadDomain(actor: WorkspaceActor, workspaceId: string, domain: ShareDomain, grants: readonly ConsentGrant[], now: Date = new Date()): boolean {
  if (actor.scope !== "FIRM") {
    if (actor.workspace_id === workspaceId) return actor.workspace_role === "OWNER" || actor.domains.includes(domain);
    return grants.some((g) => g.grantor_workspace_id === workspaceId && g.grantee_principal_id === actor.principal_id && grantCovers(g, domain, now));
  }
  // Firm membership alone never reaches a personal workspace: only an explicit grant to this firm does.
  return grants.some((g) => g.grantor_workspace_id === workspaceId && g.grantee_org_id === actor.org_id && grantCovers(g, domain, now));
}
