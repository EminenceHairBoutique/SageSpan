#!/usr/bin/env node
/**
 * PR-003c — real-stack security evidence for SageSpan's Supabase schema.
 *
 * Runs against a REAL Supabase stack (local `supabase start` or a disposable project):
 * real GoTrue JWTs, real PostgREST, real RLS. This is the proof the shimmed SQL harness
 * cannot give (CLAUDE.md §4 "a clean shim run is not proof that Supabase is safe").
 *
 * What it does, with synthetic users created for this run only:
 *   1. Admin (service role) creates Ana, Ben and Dee with random passwords that are never
 *      stored, seeds Firm F1 and makes Dee its ADVISOR.
 *   2. Ana signs in (anon key + password → user JWT), creates a PERSONAL (P) and a HOUSEHOLD (H)
 *      workspace through app.create_personal_workspace, writes a cash account and a goal.
 *   3. Ben registers, is invited to H for SAVINGS_GOALS only, accepts; assertions prove he reads
 *      the goal, not the cash account, not P, and cannot write or self-invite.
 *   4. Dee (firm member, no grant) sees nothing; Ana grants F1 CASH_FLOW+DEBT; Dee reads cash
 *      accounts, not goals; Ana revokes; Dee reads nothing again.
 *   5. The anon key alone reads nothing; direct writes to memberships / grants are refused with
 *      SQLSTATE 42501 over PostgREST; my_workspace_access is non-disclosing.
 *   6. Firm identity path: Dee reads her own app.memberships row (what the web tier resolves);
 *      Ana reads none.
 *
 * Output: TAP-ish "ok - ..." lines; exits 1 on the first failure. Cleanup deletes the users it
 * created (cascades through principals/workspaces) and the seeded org.
 *
 * Env: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY (from `supabase status -o env`).
 * The service-role key is used ONLY here, in a throwaway test process — never by the web app.
 */
import { randomBytes, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const URL_ = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !ANON || !SERVICE) {
  console.error("SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are required (supabase status -o env).");
  process.exit(2);
}

let n = 0;
const failures = [];
function ok(cond, desc, extra) {
  n += 1;
  if (cond) console.log(`ok ${n} - ${desc}`);
  else {
    console.log(`not ok ${n} - ${desc}${extra ? `\n  # ${String(extra).replace(/\n/g, "\n  # ")}` : ""}`);
    failures.push(desc);
  }
}
const is = (got, want, desc) => ok(JSON.stringify(got) === JSON.stringify(want), desc, `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
/** PostgREST surfaces PL/pgSQL errors with `code` = SQLSTATE. */
const throws = (res, code, desc) => ok(Boolean(res.error) && (!code || res.error.code === code), desc, res.error ? `code ${res.error.code}: ${res.error.message}` : "statement succeeded");
const lives = (res, desc) => ok(!res.error, desc, res.error ? `${res.error.code}: ${res.error.message}` : "");

const run = randomBytes(4).toString("hex");
const admin = createClient(URL_, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
const app = (c) => c.schema("app");

async function userClient(email, password) {
  const c = createClient(URL_, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`sign-in failed for ${email}: ${error.message}`);
  return { client: c, id: data.user.id };
}

const created = { users: [], orgs: [] };
async function makeUser(name) {
  const email = `${name}.${run}@realstack.sagespan.test`; // reserved .test TLD; synthetic
  const password = randomBytes(24).toString("base64url");
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { synthetic: true, run } });
  if (error) throw new Error(`createUser ${name}: ${error.message}`);
  created.users.push(data.user.id);
  return { email, password, id: data.user.id };
}

async function cleanup() {
  for (const org of created.orgs) await app(admin).from("organizations").delete().eq("id", org);
  for (const id of created.users) await admin.auth.admin.deleteUser(id);
}

try {
  // ------------------------------------------------------------------ 1. fixtures
  const ana = await makeUser("ana");
  const ben = await makeUser("ben");
  const dee = await makeUser("dee");
  const orgId = randomUUID();
  created.orgs.push(orgId);
  lives(
    await app(admin).from("organizations").insert({ id: orgId, name: `Firm F1 (synthetic ${run})`, slug: `realstack-${run}`, policies: { separation_of_duties: true, approver_roles: ["COMPLIANCE"], allow_nonmaterial_exceptions: true, tolerance: { absolute: "1.00", relative: "0.001" } } }),
    "service role seeds Firm F1",
  );
  lives(await app(admin).from("memberships").insert({ org_id: orgId, user_id: dee.id, role: "ADVISOR" }), "service role seeds Dee as F1 ADVISOR");

  // ------------------------------------------------------------------ 2. Ana
  const A = await userClient(ana.email, ana.password);
  is(A.id, ana.id, "GoTrue returns the created user id for Ana's real JWT");
  const P = await app(A.client).rpc("create_personal_workspace", { p_kind: "PERSONAL", p_label: "Ana (synthetic)", p_display_name: "Ana", p_household_size: 1, p_cash_floor: 1500, p_buffer_target_months: 3, p_situation: "Single, salaried", p_top_concern: "Build a buffer" });
  lives(P, "Ana creates a PERSONAL workspace over PostgREST RPC");
  const H = await app(A.client).rpc("create_personal_workspace", { p_kind: "HOUSEHOLD", p_label: "Ana & Ben (synthetic)", p_display_name: null, p_household_size: 2, p_cash_floor: 2500 });
  lives(H, "Ana creates a HOUSEHOLD workspace");
  const pId = P.data, hId = H.data;
  throws(await app(A.client).rpc("create_personal_workspace", { p_kind: "FIRM", p_label: "x", p_display_name: "x", p_household_size: 1, p_cash_floor: 0 }), "P0001", "FIRM kind refused through the consumer entry point");
  lives(await app(A.client).from("cash_accounts").insert({ account_ref: randomUUID(), workspace_id: pId, label: "Checking (synthetic)", kind: "CHECKING", balance: 3200, balance_as_of: "2026-10-31" }), "owner inserts a cash account into P (RLS insert policy)");
  lives(await app(A.client).from("savings_goals").insert({ workspace_id: hId, label: "Move (synthetic)", kind: "MOVE", target_amount: 6000, saved_amount: 900 }), "owner inserts a goal into H");
  is((await app(A.client).from("workspaces").select("id")).data?.length, 2, "owner sees exactly her two workspaces");
  const accP = await app(A.client).rpc("my_workspace_access", { p_workspace: pId });
  is(accP.data?.[0]?.via, "MEMBERSHIP", "my_workspace_access(P) for Ana = MEMBERSHIP");
  is(accP.data?.[0]?.membership_role, "OWNER", "…as OWNER");
  is((accP.data?.[0]?.readable_domains ?? []).length, 7, "…owner reads all seven domains");
  throws(await app(A.client).from("workspace_memberships").insert({ workspace_id: hId, principal_id: ana.id, role: "OWNER", domains: [], status: "ACTIVE" }), "42501", "S-02 direct membership insert refused over PostgREST (privilege)");
  throws(await app(A.client).from("consent_grants").insert({ grantor_workspace_id: pId, grantor_principal_id: ana.id, grantee_org_id: orgId, domains: ["CASH_FLOW"], purpose: "ADVISOR_REVIEW" }), "42501", "S-02 direct consent insert refused over PostgREST (privilege)");
  throws(await app(A.client).from("cash_accounts").delete().eq("workspace_id", pId), "42501", "end users cannot delete personal records (no DELETE grant)");
  is((await app(A.client).from("memberships").select("org_id")).data?.length, 0, "Ana (no firm) reads no firm memberships");

  // ------------------------------------------------------------------ 3. Ben
  const B = await userClient(ben.email, ben.password);
  is((await app(B.client).from("workspaces").select("id")).data?.length, 0, "S-01 Ben sees no workspaces before any relationship");
  is((await app(B.client).from("savings_goals").select("id")).data?.length, 0, "S-01 Ben sees no goals");
  is((await app(B.client).rpc("my_workspace_access", { p_workspace: pId })).data?.length, 0, "S-01 my_workspace_access(P) is empty for a stranger (non-disclosing)");
  lives(await app(B.client).rpc("require_principal", { p_display_name: "Ben" }), "Ben registers as a principal");
  throws(await app(B.client).rpc("invite_participant", { p_workspace: hId, p_principal: ben.id, p_role: "PARTICIPANT", p_domains: ["SAVINGS_GOALS"] }), "P0002", "S-01 a non-owner inviting into H gets NOT_FOUND");
  const inv = await app(A.client).rpc("invite_participant", { p_workspace: hId, p_principal: ben.id, p_role: "PARTICIPANT", p_domains: ["SAVINGS_GOALS"] });
  lives(inv, "Ana invites Ben into H for SAVINGS_GOALS only");
  is((await app(B.client).from("savings_goals").select("id")).data?.length, 0, "INVITED confers no record access");
  throws(await app(A.client).rpc("accept_invitation", { p_membership: inv.data }), "P0002", "the owner cannot accept on Ben's behalf");
  lives(await app(B.client).rpc("accept_invitation", { p_membership: inv.data }), "Ben accepts");
  is((await app(B.client).from("savings_goals").select("id")).data?.length, 1, "participant reads the H goal (granted domain)");
  is((await app(B.client).from("cash_accounts").select("id")).data?.length, 0, "participant reads no cash accounts (domain not granted; P never)");
  is((await app(B.client).from("workspaces").select("id")).data?.length, 1, "participant sees H only, never P");
  const accH = await app(B.client).rpc("my_workspace_access", { p_workspace: hId });
  is(accH.data?.[0]?.readable_domains, ["SAVINGS_GOALS"], "my_workspace_access(H) for Ben lists exactly SAVINGS_GOALS");
  throws(await app(B.client).from("savings_goals").insert({ workspace_id: hId, label: "Sneaky", kind: "OTHER", target_amount: 1 }), "42501", "participant cannot insert (RLS with check)");
  const upd = await app(B.client).from("savings_goals").update({ saved_amount: 999999 }).eq("workspace_id", hId).select("id");
  is(upd.data?.length ?? 0, 0, "participant update touches zero rows");
  is(Number((await app(A.client).from("savings_goals").select("saved_amount").eq("workspace_id", hId).single()).data?.saved_amount), 900, "goal unchanged");

  // ------------------------------------------------------------------ 4. Dee / firm
  const D = await userClient(dee.email, dee.password);
  is((await app(D.client).from("memberships").select("org_id, role, status, organizations(name, slug)").eq("user_id", dee.id)).data?.[0]?.role, "ADVISOR", "firm identity path: Dee reads her own ACTIVE membership with the org joined");
  is((await app(D.client).from("workspaces").select("id")).data?.length, 0, "S-01 firm membership alone reaches no consumer workspace");
  is((await app(D.client).from("cash_accounts").select("id")).data?.length, 0, "S-01 firm advisor reads no consumer cash accounts without a grant");
  const g = await app(A.client).rpc("grant_consent", { p_workspace: pId, p_grantee_principal: null, p_grantee_org: orgId, p_domains: ["CASH_FLOW", "DEBT"], p_purpose: "ADVISOR_REVIEW", p_expires_at: new Date(Date.now() + 30 * 86400e3).toISOString(), p_retention_note: "Delete after the review" });
  lives(g, "Ana grants F1 CASH_FLOW+DEBT on P for 30 days");
  is((await app(D.client).from("cash_accounts").select("id")).data?.length, 1, "F1 advisor now reads P cash accounts");
  is((await app(D.client).from("savings_goals").select("id")).data?.length, 0, "…but no goals (domain not granted)");
  is((await app(D.client).rpc("my_workspace_access", { p_workspace: pId })).data?.[0]?.via, "CONSENT_GRANT", "my_workspace_access(P) for Dee = CONSENT_GRANT");
  throws(await app(D.client).rpc("revoke_consent", { p_grant: g.data }), "P0002", "the grantee cannot revoke the grant");
  const widen = await app(D.client).from("consent_grants").update({ domains: ["CASH_FLOW", "DEBT", "SAVINGS_GOALS"] }).eq("id", g.data).select("id");
  ok(Boolean(widen.error) || (widen.data?.length ?? 0) === 0, "S-02 grantee cannot widen the grant", widen.error?.message ?? "update returned rows");
  lives(await app(A.client).rpc("revoke_consent", { p_grant: g.data }), "Ana revokes");
  is((await app(D.client).from("cash_accounts").select("id")).data?.length, 0, "revocation takes effect immediately for the firm");
  is((await app(D.client).from("consent_grants").select("version").eq("id", g.data).single()).data?.version, 2, "the former grantee still sees the revoked grant (version 2) as history");

  // ------------------------------------------------------------------ 5. anon key alone
  const anon = createClient(URL_, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const anonWs = await app(anon).from("workspaces").select("id");
  ok(Boolean(anonWs.error) || anonWs.data?.length === 0, "anon key alone reads no workspaces", anonWs.error?.message);
  const anonCash = await app(anon).from("cash_accounts").select("id");
  ok(Boolean(anonCash.error) || anonCash.data?.length === 0, "anon key alone reads no cash accounts", anonCash.error?.message);
  throws(await app(anon).rpc("create_personal_workspace", { p_kind: "PERSONAL", p_label: "x", p_display_name: "x", p_household_size: 1, p_cash_floor: 0 }), null, "anon cannot execute the consumer entry point");

  // ------------------------------------------------------------------ 6. event log
  const events = await app(A.client).from("workspace_events").select("seq, event_type, previous_event_hash, event_hash").eq("workspace_id", hId).order("seq");
  is(events.data?.map((e) => e.event_type), ["WORKSPACE_CREATED", "PARTICIPANT_INVITED", "INVITATION_ACCEPTED"], "S-04 H event log is linear and complete");
  ok((events.data ?? []).every((e, i, a) => i === 0 || e.previous_event_hash === a[i - 1].event_hash), "S-04 every event links to its predecessor's hash");
  is((await app(D.client).from("workspace_events").select("seq").eq("workspace_id", pId)).data?.length, 0, "grantees never see the event log");
} catch (e) {
  n += 1;
  console.log(`not ok ${n} - harness error: ${e instanceof Error ? e.message : String(e)}`);
  failures.push("harness error");
} finally {
  await cleanup().catch((e) => console.log(`# cleanup warning: ${e.message}`));
}

console.log(`1..${n}`);
console.log(failures.length ? `# ${failures.length} failed` : `# all ${n} passed on the real stack`);
process.exit(failures.length ? 1 : 0);
