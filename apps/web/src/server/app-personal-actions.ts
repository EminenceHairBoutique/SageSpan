"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getProductionIdentity } from "@/auth/actor";
import { createSupabaseServerClient } from "@/auth/supabase-server";
import { DomainError, errorResult, type ActionResult } from "@/domain/errors";
import { updatePersonalPolicy } from "@/domain/personal/mutations";
import { createPersonalRecord, retirePersonalRecord, updatePersonalRecord } from "@/domain/personal/records";
import { productionPersonalRepository, type PersonalRepository } from "@/domain/personal/repository";
import { StartFreshSchema } from "@/domain/personal/intake";
import { recordInputFromForm, recordType, str } from "./personal-form";

/**
 * DATA-001 — production (/app/personal) actions. Same domain functions as the demo
 * (`records.ts`, `mutations.ts`), different repository: every write lands in Supabase
 * under the signed-in user's session and is accepted or refused by RLS (0008), not by
 * anything in this file. Nothing here recomputes a baseline: receipted runs for
 * production workspaces arrive with DATA-002.
 */
type Res<T = undefined> = Promise<ActionResult<T>>;

async function run<T>(fn: (repo: PersonalRepository) => Promise<T> | T): Res<T> {
  try {
    const repo = await productionPersonalRepository();
    if (!repo) throw new DomainError("UNAUTHENTICATED", "Sign in and open a workspace first.", 401);
    const data = await fn(repo);
    revalidatePath("/app/personal", "layout");
    return { ok: true, data };
  } catch (e) {
    return errorResult(e);
  }
}

export async function appSaveRecordAction(_prev: ActionResult<{ message: string; ref: string }> | null, formData: FormData): Res<{ message: string; ref: string }> {
  return run(async (repo) => {
    const type = recordType(formData);
    const ref = str(formData, "record_ref");
    const input = recordInputFromForm(type, formData);
    const row = await repo.mutate((v) => (ref ? updatePersonalRecord(v, repo.actor, type, ref, input) : createPersonalRecord(v, repo.actor, type, input)));
    const outRef = type === "CASH_ACCOUNT" ? (row as { account_ref: string }).account_ref : (row as { id: string }).id;
    const label = "label" in (row as object) ? (row as { label: string }).label : (row as { category: string }).category;
    return { ref: outRef, message: `${ref ? "Updated" : "Added"} "${label}" as a new revision; the previous version is kept in history.` };
  });
}

export async function appRetireRecordAction(_prev: ActionResult<{ message: string }> | null, formData: FormData): Res<{ message: string }> {
  return run(async (repo) => {
    const type = recordType(formData);
    const out = await repo.mutate((v) => retirePersonalRecord(v, repo.actor, type, str(formData, "record_ref")));
    return { message: out.retired.length > 1 ? `Retired ${out.retired.length} records (the debt and its linked payments). History is kept.` : "Retired. The record stays in history and leaves your live picture." };
  });
}

export async function appUpdatePolicyAction(_prev: ActionResult<{ message: string }> | null, formData: FormData): Res<{ message: string }> {
  return run(async (repo) => {
    await repo.mutate((v) =>
      updatePersonalPolicy(v, repo.actor, {
        cash_floor: str(formData, "cash_floor") || undefined,
        buffer_target_months: formData.has("buffer_target_months") ? str(formData, "buffer_target_months") : undefined,
        extra_debt_payment_monthly: str(formData, "extra_debt_payment_monthly") || undefined,
        notification_mode: (str(formData, "notification_mode") || undefined) as "NORMAL" | "QUIET" | undefined,
      }),
    );
    return { message: "Your guardrails were saved." };
  });
}

/**
 * Production "Start fresh": creates the signed-in user's own workspace through the
 * SECURITY DEFINER entry point `app.create_personal_workspace` (owner, profile and the
 * WORKSPACE_CREATED event are written server-side from auth.uid()).
 */
export async function appStartFreshAction(_prev: ActionResult<{ message: string }> | null, formData: FormData): Res<{ message: string }> {
  try {
    const identity = await getProductionIdentity();
    if (!identity) throw new DomainError("UNAUTHENTICATED", "Sign in first.", 401);
    const parsed = StartFreshSchema.safeParse({
      display_name: str(formData, "display_name"),
      workspace_kind: str(formData, "workspace_kind"),
      household_size: Number(str(formData, "household_size") || "1"),
      situation: str(formData, "situation"),
      top_concern: str(formData, "top_concern") || null,
      cash_floor: str(formData, "cash_floor").replace(/[$,\s]/g, ""),
      buffer_target_months: str(formData, "buffer_target_months").trim() || null,
    });
    if (!parsed.success) throw new DomainError("VALIDATION", parsed.error.issues.map((i) => `${i.path.join(".") || "field"}: ${i.message}`).join("; "));
    const client = await createSupabaseServerClient();
    if (!client) throw new DomainError("NOT_CONFIGURED", "Supabase is not configured.", 503);
    const d = parsed.data;
    const { data, error } = await client.schema("app").rpc("create_personal_workspace", {
      p_kind: d.workspace_kind,
      p_label: d.workspace_kind === "HOUSEHOLD" ? `${d.display_name}'s household` : `${d.display_name}'s finances`,
      p_display_name: d.display_name,
      p_household_size: d.household_size,
      p_cash_floor: d.cash_floor,
      p_buffer_target_months: d.buffer_target_months,
      p_situation: d.situation,
      p_top_concern: d.top_concern,
    });
    if (error) throw new DomainError(error.code === "P0001" ? "VALIDATION" : "DATA_WRITE_FAILED", error.message, 502);
    void data;
  } catch (e) {
    return errorResult(e);
  }
  revalidatePath("/app", "layout");
  redirect("/app/personal");
}
