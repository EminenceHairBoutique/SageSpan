/**
 * DATA-001 — real-stack test of the Supabase repository. Runs ONLY when SUPABASE_URL,
 * SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are set (the CI `realstack` job exports
 * them from `supabase status`); skipped everywhere else. Synthetic users, random passwords,
 * cleaned up at the end. The service-role key is used only to create/delete the users.
 */
import { randomBytes } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PersonalActor } from "@/auth/personal-actor";
import { updatePersonalPolicy } from "@/domain/personal/mutations";
import { createPersonalRecord, retirePersonalRecord, updatePersonalRecord } from "@/domain/personal/records";
import { SupabasePersonalRepository } from "@/domain/personal/supabase-repository";

const URL_ = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const live = Boolean(URL_ && ANON && SERVICE);

describe.skipIf(!live)("SupabasePersonalRepository on a real Supabase stack", () => {
  const run = randomBytes(4).toString("hex");
  const admin = live ? createClient(URL_!, SERVICE!, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
  const users: string[] = [];
  let ana: SupabaseClient;
  let ben: SupabaseClient;
  let anaId = "";
  let benId = "";
  let wsId = "";

  async function user(name: string): Promise<{ client: SupabaseClient; id: string }> {
    const email = `${name}.${run}@realstack.sagespan.test`;
    const password = randomBytes(24).toString("base64url");
    const { data, error } = await admin!.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw error;
    users.push(data.user.id);
    const client = createClient(URL_!, ANON!, { auth: { persistSession: false, autoRefreshToken: false } });
    const signed = await client.auth.signInWithPassword({ email, password });
    if (signed.error) throw signed.error;
    return { client, id: data.user.id };
  }

  beforeAll(async () => {
    ({ client: ana, id: anaId } = await user("ana"));
    ({ client: ben, id: benId } = await user("ben"));
    const { data, error } = await ana.schema("app").rpc("create_personal_workspace", { p_kind: "HOUSEHOLD", p_label: "Ana & Ben (synthetic)", p_display_name: "Ana", p_household_size: 2, p_cash_floor: 1500, p_buffer_target_months: 3, p_situation: "", p_top_concern: null });
    if (error) throw error;
    wsId = data as string;
    await ben.schema("app").rpc("require_principal", { p_display_name: "Ben" });
  }, 60_000);

  afterAll(async () => {
    for (const id of users) await admin!.auth.admin.deleteUser(id);
  });

  const actorFor = (principal: string, role: PersonalActor["workspace_role"], domains: PersonalActor["domains"]): PersonalActor => ({ scope: "HOUSEHOLD", principal_id: principal, workspace_id: wsId, workspace_role: role, domains, display_name: "", mode: "PRODUCTION", actor_type: "USER" });

  it("owner: create, read back, update (new revision), retire — all through RLS with the user's JWT", async () => {
    const repo = new SupabasePersonalRepository(ana, actorFor(anaId, "OWNER", []));
    const acct = await repo.mutate((v) => createPersonalRecord(v, repo.actor, "CASH_ACCOUNT", { label: "Checking (synthetic)", kind: "CHECKING", balance: "3200", balance_as_of: "2026-10-31" }));
    const card = await repo.mutate((v) => createPersonalRecord(v, repo.actor, "LIABILITY", { label: "Card (synthetic)", kind: "CREDIT_CARD", balance: "1800", balance_as_of: "2026-10-31", apr_percent: "24.99", minimum_payment: "55", rate_type: "FIXED" }));
    await repo.mutate((v) => createPersonalRecord(v, repo.actor, "OBLIGATION", { label: "Card minimum", category: "DEBT_MINIMUM", amount: "55", cadence: "MONTHLY", next_due_date: "2026-11-15", essential: true, liability_id: card.id }));
    await repo.mutate((v) => createPersonalRecord(v, repo.actor, "GOAL", { label: "Move (synthetic)", kind: "MOVE", target_amount: "6000", saved_amount: "900", funded_from_account_id: acct.account_ref }));

    let b = await repo.bundle();
    expect(b.cashAccounts.map((a) => a.balance)).toEqual(["3200.00"]);
    expect(b.liabilities[0]).toMatchObject({ balance: "1800.00", minimum_payment: "55.00" });
    expect(b.obligations[0]!.liability_id).toBe(card.id);
    expect(b.goals[0]!.funded_from_account_id).toBe(acct.account_ref);
    expect(b.recordRevisions.map((r) => r.change)).toEqual(["CREATE", "CREATE", "CREATE", "CREATE"]);

    await repo.mutate((v) => updatePersonalRecord(v, repo.actor, "CASH_ACCOUNT", acct.account_ref, { label: "Checking (synthetic)", kind: "CHECKING", balance: "2900.10", balance_as_of: "2026-11-05" }));
    b = await repo.bundle();
    expect(b.cashAccounts).toHaveLength(1);
    expect(b.cashAccounts[0]).toMatchObject({ balance: "2900.10", revision: 2, account_ref: acct.account_ref });
    expect(b.recordRevisions[0]!.change).toBe("UPDATE");

    await repo.mutate((v) => updatePersonalPolicy(v, repo.actor, { cash_floor: "2000" }));
    expect((await repo.bundle()).profile.cash_floor).toBe("2000.00");

    const out = await repo.mutate((v) => retirePersonalRecord(v, repo.actor, "LIABILITY", card.id));
    expect(out.retired).toHaveLength(2);
    b = await repo.bundle();
    expect(b.liabilities).toEqual([]);
    expect(b.obligations).toEqual([]);
    expect(b.recordRevisions.filter((r) => r.change === "RETIRE")).toHaveLength(2);
  }, 60_000);

  it("participant with SAVINGS_GOALS only: reads goals, nothing else; cannot write (RLS refuses, repository reports it)", async () => {
    const inv = await ana.schema("app").rpc("invite_participant", { p_workspace: wsId, p_principal: benId, p_role: "PARTICIPANT", p_domains: ["SAVINGS_GOALS"] });
    expect(inv.error).toBeNull();
    const acc = await ben.schema("app").rpc("accept_invitation", { p_membership: inv.data });
    expect(acc.error).toBeNull();
    const repo = new SupabasePersonalRepository(ben, actorFor(benId, "PARTICIPANT", ["SAVINGS_GOALS"]));
    const b = await repo.bundle();
    expect(b.goals).toHaveLength(1);
    expect(b.cashAccounts).toEqual([]);
    expect(b.liabilities).toEqual([]);
    expect(b.recordRevisions).toEqual([]); // revisions are owner-only
    // the domain layer refuses first (owner-only) — and if it were bypassed, RLS would too
    await expect(repo.mutate((v) => createPersonalRecord(v, repo.actor, "GOAL", { label: "x", kind: "OTHER", target_amount: "1", saved_amount: "0" }))).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
    const direct = await ben.schema("app").from("savings_goals").insert({ workspace_id: wsId, label: "x", kind: "OTHER", target_amount: 1 });
    expect(direct.error?.code).toBe("42501");
  }, 60_000);

  it("a stranger's repository sees no workspace (NOT_FOUND), not an empty one", async () => {
    const { client: cara, id: caraId } = await user("cara");
    const repo = new SupabasePersonalRepository(cara, actorFor(caraId, "OWNER", []));
    await expect(repo.bundle()).rejects.toThrow(/not found/i);
  }, 60_000);
});
