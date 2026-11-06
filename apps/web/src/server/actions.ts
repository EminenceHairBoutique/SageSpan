"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Role, SourceKind } from "@sagespan/contracts";
import { getDemoActor, type Actor } from "@/auth/actor";
import { PERSONA_COOKIE, findPersona } from "@/auth/persona";
import { runRmdChecks, sendToReview } from "@/domain/checks";
import { errorResult, type ActionResult } from "@/domain/errors";
import { generatePacket } from "@/domain/evidence";
import { freezeSnapshot } from "@/domain/freeze";
import { applyColumnMapping, createImport } from "@/domain/imports";
import { reconcileImport } from "@/domain/reconcile";
import { addComment, attemptApproval, assignHousehold, confirmFact, dispositionDiscrepancy, documentException, recordAssumption, recordReview, resolveConflict, updatePolicy } from "@/domain/review";
import { getStore } from "@/domain/store";
import { newId, nowIso } from "@/domain/ids";
import type { ColumnMapping } from "@/import/csv-contract";
import { IMPORT_CSV_COLUMNS } from "@sagespan/contracts";

type Res<T = undefined> = Promise<ActionResult<T>>;

function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v : "";
}

async function run<T>(fn: (actor: Actor) => Promise<T> | T, revalidate?: string[]): Res<T> {
  try {
    const actor = await getDemoActor();
    const data = await fn(actor);
    for (const p of revalidate ?? []) revalidatePath(p, "layout");
    revalidatePath("/demo/app", "layout");
    return { ok: true, data };
  } catch (e) {
    return errorResult(e);
  }
}

// ---------------------------------------------------------------- demo session
export async function switchPersonaAction(formData: FormData): Promise<void> {
  const persona = findPersona(str(formData, "persona"));
  if (!persona) return;
  const jar = await cookies();
  jar.set(PERSONA_COOKIE, persona.user_id, { httpOnly: true, sameSite: "lax", path: "/" });
  revalidatePath("/demo/app", "layout");
}

export async function resetDemoAction(): Res {
  return run(() => {
    getStore().reset();
    return undefined;
  });
}

// ---------------------------------------------------------------- imports
export async function uploadImportAction(_prev: ActionResult<{ importId: string; message: string }> | null, formData: FormData): Res<{ importId: string; message: string }> {
  return run(async (actor) => {
    const householdId = str(formData, "household_id");
    const file = formData.get("file");
    if (!(file instanceof File)) throw new Error("Choose a .csv or .json file.");
    const sourceKind = z.enum(["CUSTODIAN_STATEMENT", "CUSTODIAN_PROFILE", "BENEFICIARY_FORM", "PLAN_EXPORT", "MANUAL_ENTRY"]).parse(str(formData, "source_kind")) as SourceKind;
    const vendorLabel = str(formData, "vendor_label").trim().slice(0, 120) || null;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const { importRecord } = getStore().mutate((s) => createImport(s, actor, householdId, { filename: file.name, mimeType: file.type, bytes, sourceKind, vendorLabel }));
    return { importId: importRecord.id, message: `Import ${importRecord.id} created (${importRecord.import_status.toLowerCase().replace(/_/g, " ")}). Continue with mapping below.` };
  });
}

export async function applyCsvMappingAction(_prev: ActionResult | null, formData: FormData): Res {
  return run((actor) => {
    const importId = str(formData, "import_id");
    const mapping: ColumnMapping = {};
    for (const col of IMPORT_CSV_COLUMNS) {
      const v = str(formData, `map_${col.key}`);
      if (v) mapping[col.key] = v;
    }
    const meta = { export_as_of: str(formData, "export_as_of"), tax_year: Number(str(formData, "tax_year")), household_ref: str(formData, "household_ref") || "household" };
    getStore().mutate((s) => applyColumnMapping(s, actor, importId, mapping, meta));
    return undefined;
  });
}

export async function reconcileImportAction(_prev: ActionResult<{ conflicts: number; facts: number; message: string }> | null, formData: FormData): Res<{ conflicts: number; facts: number; message: string }> {
  return run((actor) => {
    const importId = str(formData, "import_id");
    const persons: Record<string, string> = {};
    const accounts: Record<string, string> = {};
    for (const [k, v] of formData.entries()) {
      if (typeof v !== "string") continue;
      if (k.startsWith("person:")) persons[k.slice(7)] = v;
      if (k.startsWith("account:")) accounts[k.slice(8)] = v;
    }
    const summary = getStore().mutate((s) => reconcileImport(s, actor, importId, { persons, accounts }));
    return { conflicts: summary.conflictsOpened, facts: summary.factsCreated, message: `Reconciled: ${summary.factsCreated} facts created, ${summary.conflictsOpened} conflict(s) opened, ${summary.corroborated} corroborated. See the Overview for the freeze gate.` };
  });
}

// ---------------------------------------------------------------- facts / conflicts
export async function resolveConflictAction(_prev: ActionResult | null, formData: FormData): Res {
  return run((actor) => {
    getStore().mutate((s) => resolveConflict(s, actor, str(formData, "conflict_id"), str(formData, "chosen_fact_id"), str(formData, "rationale")));
    return undefined;
  });
}

export async function documentExceptionAction(_prev: ActionResult | null, formData: FormData): Res {
  return run((actor) => {
    getStore().mutate((s) => documentException(s, actor, str(formData, "conflict_id"), str(formData, "rationale")));
    return undefined;
  });
}

export async function recordAssumptionAction(_prev: ActionResult | null, formData: FormData): Res {
  return run((actor) => {
    const subjectType = str(formData, "subject_type") === "PERSON" ? "PERSON" : "ACCOUNT";
    getStore().mutate((s) => recordAssumption(s, actor, str(formData, "household_id"), subjectType, str(formData, "subject_id"), str(formData, "field_key"), str(formData, "value"), str(formData, "basis")));
    return undefined;
  });
}

export async function confirmFactAction(_prev: ActionResult | null, formData: FormData): Res {
  return run((actor) => {
    getStore().mutate((s) => confirmFact(s, actor, str(formData, "fact_id"), str(formData, "rationale"), str(formData, "evidence_reference")));
    return undefined;
  });
}

// ---------------------------------------------------------------- snapshot / checks
export async function freezeSnapshotAction(_prev: ActionResult<{ snapshotId: string; message: string }> | null, formData: FormData): Res<{ snapshotId: string; message: string }> {
  return run((actor) => {
    const snap = getStore().mutate((s) => freezeSnapshot(s, actor, str(formData, "household_id")));
    return { snapshotId: snap.id, message: `Snapshot ${snap.id} (revision ${snap.revision}) frozen; content SHA-256 ${snap.content_sha256.slice(0, 16)}…. Run the independent check from the Checks tab.` };
  });
}

export async function runChecksAction(_prev: ActionResult<{ errors: number; runs: number; message: string }> | null, formData: FormData): Res<{ errors: number; runs: number; message: string }> {
  return run(async (actor) => {
    const outcome = await runRmdChecks(getStore(), actor, str(formData, "household_id"));
    if (outcome.errors.length) {
      const first = outcome.errors[0]!;
      throw Object.assign(new Error(`${first.message} (${first.code})`), { name: "CalcServiceError" });
    }
    return { errors: outcome.errors.length, runs: outcome.runs.length, message: `${outcome.runs.length} check run(s) completed and recorded with receipts.` };
  });
}

export async function sendToReviewAction(_prev: ActionResult | null, formData: FormData): Res {
  return run((actor) => {
    getStore().mutate((s) => sendToReview(s, actor, str(formData, "household_id")));
    return undefined;
  });
}

// ---------------------------------------------------------------- review
export async function addCommentAction(_prev: ActionResult | null, formData: FormData): Res {
  return run((actor) => {
    getStore().mutate((s) => addComment(s, actor, str(formData, "household_id"), str(formData, "body")));
    return undefined;
  });
}

export async function dispositionDiscrepancyAction(_prev: ActionResult | null, formData: FormData): Res {
  return run((actor) => {
    getStore().mutate((s) => dispositionDiscrepancy(s, actor, str(formData, "discrepancy_id"), str(formData, "note")));
    return undefined;
  });
}

export async function recordReviewAction(_prev: ActionResult | null, formData: FormData): Res {
  return run((actor) => {
    getStore().mutate((s) => recordReview(s, actor, str(formData, "household_id"), str(formData, "rationale")));
    return undefined;
  });
}

export async function approveAction(_prev: ActionResult | null, formData: FormData): Res {
  return run((actor) => {
    attemptApproval(getStore(), actor, str(formData, "household_id"), { rationale: str(formData, "rationale"), conflictAttestation: str(formData, "attestation") === "on" });
    return undefined;
  });
}

export async function generatePacketAction(_prev: ActionResult<{ packetId: string; message: string }> | null, formData: FormData): Res<{ packetId: string; message: string }> {
  return run((actor) => {
    const pkt = getStore().mutate((s) => generatePacket(s, actor, str(formData, "household_id")));
    return { packetId: pkt.id, message: `Packet ${pkt.id} ready (export #${pkt.export_count}, sha256 ${pkt.sha256.slice(0, 16)}…). Download JSON or HTML from the export log.` };
  });
}

export async function assignAction(_prev: ActionResult | null, formData: FormData): Res {
  return run((actor) => {
    const assignee = str(formData, "assignee") || null;
    getStore().mutate((s) => assignHousehold(s, actor, str(formData, "household_id"), assignee));
    return undefined;
  });
}

export async function updatePolicyAction(_prev: ActionResult | null, formData: FormData): Res {
  return run((actor) => {
    const approver_roles = formData.getAll("approver_roles").filter((v): v is string => typeof v === "string") as Role[];
    getStore().mutate((s) => updatePolicy(s, actor, { separation_of_duties: str(formData, "separation_of_duties") === "on", allow_nonmaterial_exceptions: str(formData, "allow_nonmaterial_exceptions") === "on", approver_roles }));
    return undefined;
  });
}

// ---------------------------------------------------------------- marketing
const PilotInterestSchema = z.object({
  firm_name: z.string().trim().min(2).max(120),
  role: z.string().trim().min(2).max(80),
  contact: z.string().trim().min(3).max(160),
  advisors_band: z.enum(["1-4", "5-15", "16-50", "51+"]),
  planning_tools: z.string().trim().max(200).default(""),
  note: z.string().trim().max(1000).default(""),
});

export async function pilotInterestAction(_prev: ActionResult | null, formData: FormData): Res {
  try {
    const parsed = PilotInterestSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) return { ok: false, code: "VALIDATION", message: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
    getStore().mutate((s) => {
      s.pilot_interest.push({ id: newId("pilot"), created_at: nowIso(), ...parsed.data });
    });
    return { ok: true, data: undefined, message: "Recorded locally. Nothing was transmitted externally; the founder reviews this file manually." };
  } catch (e) {
    return errorResult(e);
  }
}
