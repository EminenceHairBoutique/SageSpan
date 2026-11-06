"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ORG_SELECTOR_COOKIE, WORKSPACE_SELECTOR_COOKIE, getProductionIdentity } from "@/auth/actor";
import { createSupabaseServerClient } from "@/auth/supabase-server";
import type { ActionResult } from "@/domain/errors";

/**
 * PR-003b — production sign-in / sign-out. Password sign-in only: supabase/config.toml
 * disables self-service sign-up, so accounts are created by an administrator (or by
 * the real-stack test harness). Magic-link / OAuth completions land on
 * /app/auth/callback, which exchanges the code for a session.
 *
 * These actions never read a service-role key and never set the org / workspace
 * selectors to anything the resolved identity does not already list.
 */
function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

const SAFE_NEXT = /^\/app(\/[A-Za-z0-9_\-./]*)?$/;
const safeNext = (v: string): string => (SAFE_NEXT.test(v) ? v : "/app");

export async function signInWithPasswordAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const email = str(formData, "email");
  const password = typeof formData.get("password") === "string" ? (formData.get("password") as string) : "";
  const next = safeNext(str(formData, "next"));
  if (!email || !password) return { ok: false, code: "VALIDATION", message: "E-mail and password are required." };
  const client = await createSupabaseServerClient();
  if (!client) return { ok: false, code: "NOT_CONFIGURED", message: "Supabase is not configured for this deployment." };
  const { error } = await client.auth.signInWithPassword({ email, password });
  // One generic message: never reveal whether the e-mail exists.
  if (error) return { ok: false, code: "SIGN_IN_FAILED", message: "Sign-in failed. Check the e-mail and password and try again." };
  redirect(next);
}

export async function signOutAction(): Promise<void> {
  const client = await createSupabaseServerClient();
  if (client) await client.auth.signOut();
  const jar = await cookies();
  jar.delete(ORG_SELECTOR_COOKIE);
  jar.delete(WORKSPACE_SELECTOR_COOKIE);
  redirect("/app/sign-in");
}

/** Selector cookies are set only to a tenant the database already showed this user. */
export async function selectOrgAction(formData: FormData): Promise<void> {
  const wanted = str(formData, "org_id");
  const identity = await getProductionIdentity();
  if (!identity || !identity.firms.some((f) => f.org_id === wanted)) return;
  const jar = await cookies();
  jar.set(ORG_SELECTOR_COOKIE, wanted, { httpOnly: true, sameSite: "lax", path: "/", secure: process.env.NODE_ENV === "production" });
  redirect("/app");
}

export async function selectWorkspaceAction(formData: FormData): Promise<void> {
  const wanted = str(formData, "workspace_id");
  const identity = await getProductionIdentity();
  if (!identity || !identity.workspaces.some((w) => w.workspace_id === wanted)) return;
  const jar = await cookies();
  jar.set(WORKSPACE_SELECTOR_COOKIE, wanted, { httpOnly: true, sameSite: "lax", path: "/", secure: process.env.NODE_ENV === "production" });
  redirect("/app");
}
