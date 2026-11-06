import { AI_REVIEW_SCHEMA_VERSION, AiFindingSchema, AiModelOutputSchema, AiReviewReportSchema, type AiAnalysisKind, type AiFinding, type AiModelMetadata, type AiReviewReport, type AiValidationIssue } from "@sagespan/contracts";
import { looksLikeInjection, type GroundingContext } from "./evidence-resolver";
import { MAX_TOOL_CALLS_PER_RUN } from "./tools";

/**
 * Deterministic validation of untrusted model output against the authorised
 * grounding context. The validator, not the model, decides:
 *  - which findings survive (every cited id must resolve to current, in-scope evidence);
 *  - whether any dollar figure is allowed (only amounts copied from a cited run);
 *  - that no status other than DRAFT_FOR_HUMAN_REVIEW exists;
 *  - that an UNSUPPORTED/ERROR run is never described as PASS/verified;
 *  - that tool requests outside the allowlist are recorded and ignored;
 *  - that budgets hold.
 * Model-supplied tenant/workspace ids are ignored; the server's scope is used.
 */
export const MAX_FINDINGS_PER_RUN = 25;
export const MAX_OUTPUT_CHARS = 60_000;

const MONEY_IN_TEXT = /\$\s?\d[\d,]*(?:\.\d{1,2})?|\b\d{1,3}(?:,\d{3})+(?:\.\d{2})?\b|\b\d+\.\d{2}\b/g;
const PASS_CLAIM = /\b(PASS(ED)?|verified|approved|certified)\b/i;
/** Negated pass/verified language ("not verified", "do not label ... verified", "must not be reused") is not a claim. */
const NEGATED_CLAIM = /\b(not|never|no|cannot|can't|don't|do not|isn't|is not|neither|nor|without|un)[\s-]*(\S+\s+){0,5}?(verified|approved|certified|pass(ed)?)\b/gi;

function stripNegations(text: string): string {
  return text.replace(NEGATED_CLAIM, " ");
}

/** A bare decimal with cents is treated as money when it is at least 100; smaller ones (months, ratios, factors) are not. */
function looksLikeMoney(token: string): boolean {
  if (token.includes("$") || token.includes(",")) return true;
  const n = Number(token);
  return /\.\d{2}$/.test(token) && Number.isFinite(n) && Math.abs(n) >= 100;
}

function normaliseAmount(raw: string): string {
  const cleaned = raw.replace(/[$,\s]/g, "");
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return cleaned;
  const [whole, frac = ""] = cleaned.split(".");
  return `${whole}.${(frac + "00").slice(0, 2)}`;
}

export interface ValidationResult {
  report: AiReviewReport | null;
  issues: AiValidationIssue[];
  accepted: number;
  rejected: number;
}

export function validateModelOutput(raw: unknown, ctx: GroundingContext, analysisKind: AiAnalysisKind, metadata: AiModelMetadata, serverLimitations: string[]): ValidationResult {
  const issues: AiValidationIssue[] = [];
  const reject = (): ValidationResult => ({ report: null, issues, accepted: 0, rejected: Array.isArray((raw as { findings?: unknown[] })?.findings) ? (raw as { findings: unknown[] }).findings.length : 0 });

  const rawText = JSON.stringify(raw ?? null);
  if (rawText.length > MAX_OUTPUT_CHARS) {
    issues.push({ code: "BUDGET_EXCEEDED", finding_id: null, detail: `Output is ${rawText.length} characters; limit ${MAX_OUTPUT_CHARS}.`, disposition: "REJECT_REPORT" });
    return reject();
  }
  const parsed = AiModelOutputSchema.safeParse(raw);
  if (!parsed.success) {
    issues.push({ code: "REPORT_TEXT_INVALID", finding_id: null, detail: `Model output is not a review object: ${parsed.error.issues.map((i) => i.path.join(".")).join(", ")}`, disposition: "REJECT_REPORT" });
    return reject();
  }
  const out = parsed.data;
  if (out.schema_version !== AI_REVIEW_SCHEMA_VERSION) {
    issues.push({ code: "INVALID_SCHEMA_VERSION", finding_id: null, detail: `Expected ${AI_REVIEW_SCHEMA_VERSION}, got ${out.schema_version}.`, disposition: "REJECT_REPORT" });
    return reject();
  }
  if (out.status !== "DRAFT_FOR_HUMAN_REVIEW") {
    issues.push({ code: "FORBIDDEN_STATUS", finding_id: null, detail: `Model attempted status "${out.status}". Only DRAFT_FOR_HUMAN_REVIEW is permitted; approval is a human act.`, disposition: "REJECT_REPORT" });
    return reject();
  }
  if (out.org_id !== undefined || out.workspace_id !== undefined) {
    issues.push({ code: "MODEL_SUPPLIED_TENANT_IGNORED", finding_id: null, detail: "Model supplied org_id/workspace_id; ignored in favour of the server-resolved scope.", disposition: "NOTE" });
  }
  if (out.findings.length > MAX_FINDINGS_PER_RUN) {
    issues.push({ code: "BUDGET_EXCEEDED", finding_id: null, detail: `${out.findings.length} findings exceed the per-run limit of ${MAX_FINDINGS_PER_RUN}.`, disposition: "REJECT_REPORT" });
    return reject();
  }
  if ((out.tool_calls?.length ?? 0) > MAX_TOOL_CALLS_PER_RUN) {
    issues.push({ code: "BUDGET_EXCEEDED", finding_id: null, detail: `${out.tool_calls!.length} tool calls exceed the per-run limit of ${MAX_TOOL_CALLS_PER_RUN}.`, disposition: "REJECT_REPORT" });
    return reject();
  }
  for (const u of ctx.untrusted.filter((x) => x.injection_suspected)) {
    issues.push({ code: "INJECTION_TEXT_DETECTED", finding_id: null, detail: `Instruction-like text in untrusted source ${u.source_id}${u.locator ? ` (${u.locator})` : ""} was treated as data.`, disposition: "NOTE" });
  }

  const latestRunIds = new Set(ctx.check_runs.filter((r) => r.is_latest_for_account).map((r) => r.id));
  const runStatus = new Map(ctx.check_runs.map((r) => [r.id, r.run_status] as const));
  const accepted: AiFinding[] = [];
  let rejectedCount = 0;
  const seenIds = new Set<string>();

  for (const candidate of out.findings) {
    const f = AiFindingSchema.safeParse(candidate);
    const fidOf = (candidate as { finding_id?: unknown })?.finding_id;
    const findingId = typeof fidOf === "string" ? fidOf : null;
    if (!f.success) {
      issues.push({ code: "FINDING_SCHEMA_INVALID", finding_id: findingId, detail: f.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "), disposition: "REJECT_FINDING" });
      rejectedCount++;
      continue;
    }
    const finding = f.data;
    if (seenIds.has(finding.finding_id)) {
      issues.push({ code: "FINDING_SCHEMA_INVALID", finding_id: finding.finding_id, detail: "Duplicate finding_id.", disposition: "REJECT_FINDING" });
      rejectedCount++;
      continue;
    }
    let ok = true;
    const fail = (code: AiValidationIssue["code"], detail: string) => {
      issues.push({ code, finding_id: finding.finding_id, detail, disposition: "REJECT_FINDING" });
      ok = false;
    };
    for (const ref of finding.fact_refs) {
      if (ctx.superseded_fact_ids.has(ref)) fail("SUPERSEDED_FACT_REF", `Fact ${ref} is superseded and cannot be cited as current.`);
      else if (!ctx.citable_ids.has(ref)) fail("UNRESOLVED_FACT_REF", `Reference ${ref} does not resolve inside the authorised scope.`);
    }
    for (const d of finding.document_refs) {
      if (!ctx.citable_ids.has(d.id) || !ctx.locators.has(d.id)) fail("UNRESOLVED_DOCUMENT_REF", `Document ${d.id} does not resolve inside the authorised scope.`);
      else if (!ctx.locators.get(d.id)!.has(d.locator)) fail("FORGED_LOCATOR", `Locator "${d.locator}" is not a known location in ${d.id}.`);
    }
    for (const r of finding.check_run_refs) {
      if (!ctx.citable_ids.has(r)) fail("UNRESOLVED_CHECK_RUN_REF", `Run ${r} does not resolve inside the authorised scope.`);
      else if (runStatus.has(r) && !latestRunIds.has(r) && finding.cited_amounts.some((a) => a.check_run_ref === r)) fail("SUPERSEDED_RUN_CITED", `Run ${r} is not the latest attempt for its account; its amounts cannot be cited as current.`);
    }
    for (const a of finding.cited_amounts) {
      if (!finding.check_run_refs.includes(a.check_run_ref) || !ctx.citable_ids.has(a.check_run_ref)) fail("AMOUNT_WITHOUT_TOOL_BACKING", `Amount ${a.amount} cites run ${a.check_run_ref}, which is not a cited, resolvable run.`);
      else if (!ctx.amounts_by_run.get(a.check_run_ref)?.has(a.amount)) fail("AMOUNT_NOT_IN_CITED_RUN", `Amount ${a.amount} does not appear in run ${a.check_run_ref}.`);
    }
    const text = `${finding.title} ${finding.explanation} ${finding.suggested_next_action ?? ""}`;
    const citedSet = new Set(finding.cited_amounts.map((a) => a.amount));
    for (const m of text.match(MONEY_IN_TEXT) ?? []) {
      const n = normaliseAmount(m);
      if (looksLikeMoney(m) && !citedSet.has(n)) fail("AMOUNT_WITHOUT_TOOL_BACKING", `"${m}" appears in the finding text without a cited calculation run.`);
    }
    if (PASS_CLAIM.test(stripNegations(text))) {
      const badRun = finding.check_run_refs.find((r) => ["UNSUPPORTED", "INDETERMINATE", "ERROR"].includes(runStatus.get(r) ?? ""));
      if (badRun) fail("UNSUPPORTED_PROMOTED_TO_PASS", `Finding describes run ${badRun} (${runStatus.get(badRun)}) with pass/verified language.`);
      if (finding.check_run_refs.length === 0 && /\b(verified|approved|certified)\b/i.test(stripNegations(text)) && finding.category !== "EDUCATION") fail("UNSUPPORTED_PROMOTED_TO_PASS", "Finding uses verified/approved language without any calculation run.");
    }
    if (!ok) {
      rejectedCount++;
      continue;
    }
    // The server, not the model, sets the evidence status.
    const evidence_status: AiFinding["evidence_status"] = finding.category === "HYPOTHESIS" ? "HYPOTHESIS" : finding.cited_amounts.length > 0 ? "TOOL_BACKED" : "UNVERIFIED";
    seenIds.add(finding.finding_id);
    accepted.push({ ...finding, evidence_status });
  }

  for (const call of out.tool_calls ?? []) {
    issues.push({ code: "UNKNOWN_TOOL_CALL", finding_id: null, detail: `Model requested tool "${call.tool}" in its output; tool requests are dispatched only through the allowlisted dispatcher.`, disposition: "NOTE" });
  }

  const summary = (out.summary ?? "").slice(0, 4000);
  const memo = out.draft_memo ? out.draft_memo.slice(0, 8000) : null;
  for (const t of [summary, memo ?? "", ...(out.questions ?? [])]) {
    if (looksLikeInjection(t)) issues.push({ code: "INJECTION_TEXT_DETECTED", finding_id: null, detail: "Instruction-like text in the model's narrative was kept as text only.", disposition: "NOTE" });
  }

  const report = AiReviewReportSchema.safeParse({
    schema_version: AI_REVIEW_SCHEMA_VERSION,
    analysis_kind: analysisKind,
    scope: ctx.scope,
    status: "DRAFT_FOR_HUMAN_REVIEW",
    findings: accepted,
    summary,
    draft_memo: memo,
    questions: (out.questions ?? []).map((q) => q.slice(0, 400)).slice(0, 20),
    limitations: [...new Set([...(out.limitations ?? []).map((l) => l.slice(0, 400)), ...serverLimitations])],
    model_metadata: metadata,
  });
  if (!report.success) {
    issues.push({ code: "REPORT_TEXT_INVALID", finding_id: null, detail: report.error.issues.map((i) => i.path.join(".")).join(", "), disposition: "REJECT_REPORT" });
    return { report: null, issues, accepted: 0, rejected: out.findings.length };
  }
  return { report: report.data, issues, accepted: accepted.length, rejected: rejectedCount };
}
