import { describe, expect, it } from "vitest";
import { resolveIdentity, type FirmMembershipRow, type IdentityClient, type WorkspaceAccessRow, type WorkspaceRow } from "../identity";

/**
 * PR-003b — identity resolution is tested against a hand-written IdentityClient.
 * The mock plays the database AFTER row-level security: it returns only what the
 * policies in 0003/0008 would return for the signed-in user. The resolver's job
 * is to never widen that, to ignore selectors the database did not confirm, and
 * to represent "signed in but no memberships" honestly.
 */
const ANA = "40000000-0000-0000-0000-00000000000a";
const P = "aaaaaaaa-0000-0000-0000-000000000001";
const H = "aaaaaaaa-0000-0000-0000-000000000002";
const OTHER = "bbbbbbbb-0000-0000-0000-000000000009";

function mock(over: Partial<IdentityClient> & { user?: { id: string; email: string | null } | null } = {}): IdentityClient {
  const user = over.user === undefined ? { id: ANA, email: "ana@e.test" } : over.user;
  return {
    getUser: over.getUser ?? (async () => user),
    listFirmMemberships: over.listFirmMemberships ?? (async () => []),
    getProfile: over.getProfile ?? (async () => null),
    listWorkspaces: over.listWorkspaces ?? (async () => []),
    workspaceAccess: over.workspaceAccess ?? (async () => null),
  };
}

const firmRows: FirmMembershipRow[] = [
  { org_id: "f1", role: "ADVISOR", status: "ACTIVE", org_name: "Firm One", org_slug: "f1" },
  { org_id: "f2", role: "COMPLIANCE", status: "ACTIVE", org_name: "Firm Two", org_slug: "f2" },
  { org_id: "f3", role: "ADMIN", status: "DISABLED", org_name: "Firm Three", org_slug: "f3" },
  { org_id: "f4", role: "SUPERUSER", status: "ACTIVE", org_name: "Firm Four", org_slug: "f4" },
];
const wsRows: WorkspaceRow[] = [
  { id: P, kind: "PERSONAL", label: "Ana" },
  { id: H, kind: "HOUSEHOLD", label: "Ana & Ben" },
];
const access: Record<string, WorkspaceAccessRow> = {
  [P]: { workspace_id: P, kind: "PERSONAL", label: "Ana", membership_role: "OWNER", membership_status: "ACTIVE", readable_domains: ["CASH_FLOW", "SPENDING", "DEBT", "SAVINGS_GOALS", "RETIREMENT", "DOCUMENTS", "AI_SUMMARIES"], via: "MEMBERSHIP" },
  [H]: { workspace_id: H, kind: "HOUSEHOLD", label: "Ana & Ben", membership_role: "PARTICIPANT", membership_status: "ACTIVE", readable_domains: ["SAVINGS_GOALS"], via: "MEMBERSHIP" },
};

describe("resolveIdentity", () => {
  it("returns null when the auth server vouches for nobody", async () => {
    expect(await resolveIdentity(mock({ user: null }))).toBeNull();
  });

  it("signed in with no memberships is a valid, empty identity (no demo fallback)", async () => {
    const id = await resolveIdentity(mock());
    expect(id).not.toBeNull();
    expect(id!.firm).toBeNull();
    expect(id!.personal).toBeNull();
    expect(id!.firms).toEqual([]);
    expect(id!.workspaces).toEqual([]);
  });

  it("firm actor: ACTIVE memberships with known roles only; mode PRODUCTION, actor_type USER", async () => {
    const id = await resolveIdentity(mock({ listFirmMemberships: async () => firmRows }));
    expect(id!.firms.map((f) => f.org_id)).toEqual(["f1", "f2"]); // f3 disabled, f4 unknown role dropped
    expect(id!.firm).toEqual({ user_id: ANA, org_id: "f1", role: "ADVISOR", display_name: "ana", actor_type: "USER", mode: "PRODUCTION" });
  });

  it("org selector picks among confirmed memberships and is ignored otherwise", async () => {
    const c = mock({ listFirmMemberships: async () => firmRows });
    expect((await resolveIdentity(c, { org_id: "f2" }))!.firm!.org_id).toBe("f2");
    expect((await resolveIdentity(c, { org_id: "f3" }))!.firm!.org_id).toBe("f1"); // disabled: not selectable
    expect((await resolveIdentity(c, { org_id: OTHER }))!.firm!.org_id).toBe("f1"); // S-01: a guessed org is never authority
  });

  it("display name comes from app.profiles when present, else the e-mail local part", async () => {
    const withProfile = await resolveIdentity(mock({ listFirmMemberships: async () => firmRows, getProfile: async () => ({ display_name: "Ana Castillo" }) }));
    expect(withProfile!.firm!.display_name).toBe("Ana Castillo");
    const noEmail = await resolveIdentity(mock({ user: { id: ANA, email: null }, listFirmMemberships: async () => firmRows }));
    expect(noEmail!.firm!.display_name).toBe("Member");
  });

  it("personal actor: owner workspace preferred; participant domains are exactly what the database returned", async () => {
    const id = await resolveIdentity(mock({ listWorkspaces: async () => wsRows, workspaceAccess: async (w) => access[w] ?? null }));
    expect(id!.personal).toMatchObject({ scope: "PERSONAL", workspace_id: P, workspace_role: "OWNER", principal_id: ANA });
    const hh = id!.workspaces.find((w) => w.workspace_id === H)!;
    expect(hh.workspace_role).toBe("PARTICIPANT");
    expect(hh.domains).toEqual(["SAVINGS_GOALS"]);
  });

  it("workspace selector picks among ACTIVE memberships only; INVITED and unknown ids are ignored", async () => {
    const invited: WorkspaceAccessRow = { ...access[H]!, membership_status: "INVITED", readable_domains: [], via: "INVITED_ONLY" };
    const c = mock({ listWorkspaces: async () => wsRows, workspaceAccess: async (w) => (w === H ? invited : access[w] ?? null) });
    const id = await resolveIdentity(c, { workspace_id: H });
    expect(id!.workspaces.map((w) => w.workspace_id)).toEqual([P]);
    expect(id!.personal!.workspace_id).toBe(P);
    expect((await resolveIdentity(c, { workspace_id: OTHER }))!.personal!.workspace_id).toBe(P);
  });

  it("a consent grant is reported as read-only scope, never as an actor", async () => {
    const grantRow: WorkspaceAccessRow = { workspace_id: OTHER, kind: "PERSONAL", label: "Client (synthetic)", membership_role: null, membership_status: null, readable_domains: ["CASH_FLOW", "DEBT"], via: "CONSENT_GRANT" };
    const id = await resolveIdentity(mock({ listWorkspaces: async () => [{ id: OTHER, kind: "PERSONAL", label: "Client (synthetic)" }], workspaceAccess: async () => grantRow }));
    expect(id!.personal).toBeNull();
    expect(id!.workspaces).toEqual([]);
    expect(id!.granted).toEqual([{ workspace_id: OTHER, kind: "PERSONAL", label: "Client (synthetic)", domains: ["CASH_FLOW", "DEBT"] }]);
  });

  it("unknown domain strings from the database are dropped rather than trusted", async () => {
    const weird: WorkspaceAccessRow = { ...access[H]!, readable_domains: ["SAVINGS_GOALS", "EVERYTHING", "ADMIN"] };
    const id = await resolveIdentity(mock({ listWorkspaces: async () => [wsRows[1]!], workspaceAccess: async () => weird }));
    expect(id!.personal!.domains).toEqual(["SAVINGS_GOALS"]);
  });

  it("FIRM-kind workspace rows never become personal actors", async () => {
    const firmWs: WorkspaceAccessRow = { workspace_id: OTHER, kind: "FIRM", label: "Firm", membership_role: "OWNER", membership_status: "ACTIVE", readable_domains: [], via: "MEMBERSHIP" };
    const id = await resolveIdentity(mock({ listWorkspaces: async () => [{ id: OTHER, kind: "FIRM", label: "Firm" }], workspaceAccess: async () => firmWs }));
    expect(id!.personal).toBeNull();
    expect(id!.workspaces).toEqual([]);
  });
});
