/**
 * AI-CORE-002a/b — OPT-IN live benchmark against the hosted vendor on the frozen synthetic
 * fixtures (the committed baseline cases). Runs ONLY when every hosted gate holds in the
 * environment (`providers/hosted-config.ts`); skipped everywhere else, including CI, which has
 * no key. It spends real tokens. It asserts the runtime's invariants (nothing a model can do
 * reaches a report unvalidated) — it does NOT assert model quality; the written report is for a
 * human review per `docs/ai/AI_CORE_002B_LIVE_BENCHMARK_REVIEW.md`.
 *
 * Per case the report carries: the live run summary, the validated CONTENT (summary, memo,
 * questions, limitations, every finding's text/refs/amounts — synthetic only), the id-keyed
 * `diffReports` against the committed baseline, and the evidence-based `alignReports` pairing
 * (a live model names its findings freely, so ids alone cannot be compared — review #1,
 * `docs/ai/AI_LIVE_BENCHMARK_REVIEW_2026-11-06.md`).
 *
 * Output: apps/web/.ai-bench/<timestamp>-hosted.json and .md (git-ignored).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { AiRunRecord } from "@sagespan/contracts";
import { MemoryStore } from "@/domain/store";
import { BASELINE_CASES, compareToBaseline, loadBaseline, type BaselineCase } from "../evals/baselines";
import { alignReports, type ReportAlignment, type ReportDiff } from "../evals/regression";
import { resolveProvider } from "../provider";
import { resolveHostedConfig } from "../providers/hosted-config";
import { HostedProvider } from "../providers/hosted-provider";
import { runFirmAnalyzePlan, runPersonalUnderstand } from "../review-orchestrator";
import { ALVAREZ, HP_CCO } from "../evals/fixtures";

const live = process.env.SAGESPAN_AI_PROVIDER === "hosted" && resolveHostedConfig(process.env).enabled;

interface CaseResult {
  case_id: string;
  audience: BaselineCase["audience"];
  description: string;
  live: ReturnType<typeof summarise>;
  /** id-keyed diff: only meaningful when the model reuses the mock's ids (it usually does not). */
  diff_vs_baseline: ReportDiff | null;
  /** evidence-based pairing against the committed baseline — the reading aid for review. */
  alignment_vs_baseline: ReportAlignment | null;
  invariant_violations: string[];
}

describe.skipIf(!live)("hosted vendor on the baseline fixtures (opt-in, spends tokens)", () => {
  it("runs every baseline case through the live adapter, validates server-side, aligns against the committed mock baseline, and writes a review report", async () => {
    const resolved = resolveProvider(process.env);
    expect(resolved.provider).toBeInstanceOf(HostedProvider);
    const provider = resolved.provider;
    const results: CaseResult[] = [];
    let tokens = 0;
    for (const c of BASELINE_CASES) {
      const store = new MemoryStore();
      c.seed(store);
      const record = c.audience === "FIRM" ? await runFirmAnalyzePlan(store, HP_CCO, "hh_patel", provider) : await runPersonalUnderstand(store, ALVAREZ, provider);
      const violations = invariantViolations(record);
      expect(violations, `${c.id}: runtime invariant violated`).toEqual([]);
      tokens += record.estimated_tokens ?? 0;
      const baseline = loadBaseline(c);
      results.push({
        case_id: c.id,
        audience: c.audience,
        description: c.description,
        live: summarise(record),
        diff_vs_baseline: record.report ? compareToBaseline(c, record.report) : null,
        alignment_vs_baseline: record.report ? alignReports(baseline, record.report) : null,
        invariant_violations: violations,
      });
    }
    const report = {
      schema_version: "ai-bench-v2",
      generated_at: new Date().toISOString(),
      provider_note: resolved.note,
      configured_model: process.env.SAGESPAN_AI_HOSTED_MODEL,
      served_by: results[0]?.live.served_model ?? null,
      baseline_source: "apps/web/src/ai/evals/baselines/*.json (two-turn deterministic mock)",
      cases: results,
      total_estimated_tokens: tokens,
      review_status: "UNREVIEWED — a human records the outcome in docs/ai/AI_EVAL_MATRIX.md (protocol: docs/ai/AI_CORE_002B_LIVE_BENCHMARK_REVIEW.md §4)",
    };
    const dir = path.resolve(process.cwd(), ".ai-bench");
    mkdirSync(dir, { recursive: true });
    const stem = path.join(dir, `${report.generated_at.replace(/[:.]/g, "-")}-hosted`);
    writeFileSync(`${stem}.json`, JSON.stringify(report, null, 2));
    writeFileSync(`${stem}.md`, markdownSummary(report));
    // a vendor-side failure (bad key, unsupported parameter, no credit) is reported with its reason, not as "0 tokens"
    const vendorErrors = results.filter((r) => r.live.run_status === "ERROR").flatMap((r) => r.live.issue_details.map((d) => `${r.case_id}: ${d}`));
    expect(vendorErrors, `hosted run(s) ended in ERROR — report: ${stem}.json`).toEqual([]);
    expect(tokens).toBeGreaterThan(0);
  }, 600_000); // three live cases, each up to the hosted run wall clock (default 110 s)
});

/** Runtime invariants a live model can never violate without the validator catching it. Empty = good. */
function invariantViolations(r: AiRunRecord): string[] {
  const out: string[] = [];
  if (r.mode !== "LIVE") out.push(`mode ${r.mode} is not LIVE`);
  if (!["DRAFT_READY", "REJECTED", "ABSTAINED", "ERROR"].includes(r.run_status)) out.push(`unexpected run_status ${r.run_status}`);
  for (const f of r.report?.findings ?? []) {
    if ((f.evidence_status as string) === "VERIFIED") out.push(`${f.finding_id}: VERIFIED evidence status`);
    for (const a of f.cited_amounts) if (!f.check_run_refs.includes(a.check_run_ref)) out.push(`${f.finding_id}: amount ${a.amount} cites a run the finding does not reference`);
  }
  if (r.report && r.report.status !== "DRAFT_FOR_HUMAN_REVIEW") out.push(`report status ${r.report.status}`);
  const key = process.env.SAGESPAN_AI_HOSTED_API_KEY!;
  if (JSON.stringify(r).includes(key)) out.push("vendor key present in the run record");
  return out;
}

function summarise(r: AiRunRecord) {
  return {
    run_id: r.id,
    run_status: r.run_status,
    configured_model: r.model,
    served_model: r.runtime?.provider_descriptor.model ?? null,
    turns: r.runtime?.turns.length ?? null,
    tool_calls: r.tool_calls.map((t) => t.tool),
    denied: r.runtime?.tool_calls_denied ?? null,
    stop_reason: r.runtime?.stop_reason ?? null,
    accepted: r.accepted_finding_count,
    rejected: r.rejected_finding_count,
    issue_codes: r.validation_issues.map((i) => i.code),
    issue_details: r.validation_issues.map((i) => i.detail),
    finding_categories: r.report?.findings.map((f) => f.category) ?? [],
    estimated_tokens: r.estimated_tokens,
    // AI-CORE-002b: the validated content itself, so a human can review it (synthetic fixtures only; file is git-ignored)
    report: r.report
      ? {
          summary: r.report.summary,
          draft_memo: r.report.draft_memo,
          questions: r.report.questions,
          limitations: r.report.limitations,
          findings: r.report.findings.map((f) => ({
            id: f.finding_id,
            category: f.category,
            severity: f.severity,
            evidence_status: f.evidence_status,
            title: f.title,
            explanation: f.explanation,
            refs: { facts: f.fact_refs, documents: f.document_refs, check_runs: f.check_run_refs },
            cited_amounts: f.cited_amounts,
            suggested_next_action: f.suggested_next_action,
            question: f.question ?? null,
          })),
        }
      : null,
  };
}

function markdownSummary(report: { generated_at: string; configured_model: string | undefined; served_by: string | null; cases: CaseResult[]; total_estimated_tokens: number; provider_note: string | null }): string {
  const L: string[] = [];
  L.push(`# Hosted benchmark — ${report.generated_at}`, "", `Configured model: \`${report.configured_model ?? "?"}\` · served: \`${report.served_by ?? "?"}\` · vendor-reported tokens: ${report.total_estimated_tokens}`, "", `> ${report.provider_note ?? ""}`, "");
  L.push("## Runs", "", "| Case | Status | Turns | Tools | Denied | Accepted | Rejected | Issue codes | Baseline pairs | Baseline-only (gaps) | Live-only (new) |", "|---|---|---|---|---|---|---|---|---|---|---|");
  for (const c of report.cases) {
    const a = c.alignment_vs_baseline;
    L.push(`| ${c.case_id} | ${c.live.run_status} | ${c.live.turns ?? "-"} | ${c.live.tool_calls.join(", ") || "-"} | ${c.live.denied ?? "-"} | ${c.live.accepted} | ${c.live.rejected} | ${[...new Set(c.live.issue_codes)].join(", ") || "-"} | ${a ? a.pairs.length : "n/a"} | ${a ? a.reference_only.join(", ") || "-" : "n/a"} | ${a ? a.candidate_only.join(", ") || "-" : "n/a"} |`);
  }
  for (const c of report.cases) {
    L.push("", `## ${c.case_id} — ${c.description}`, "");
    if (c.live.run_status === "ERROR") L.push(`**ERROR:** ${c.live.issue_details.join(" ")}`, "");
    const a = c.alignment_vs_baseline;
    if (a) {
      L.push("### Alignment with the committed baseline (evidence-based; a reading aid, not a score)", "", "| Baseline finding | Live finding | Same category | Shared evidence |", "|---|---|---|---|");
      for (const p of a.pairs) L.push(`| ${p.reference} | ${p.candidate} | ${p.same_category ? "yes" : "**no**"} | ${p.shared_refs.join(", ")} |`);
      if (a.reference_only.length) L.push("", `Baseline findings with no live counterpart (possible coverage gaps): ${a.reference_only.join(", ")}`);
      if (a.candidate_only.length) L.push("", `Live findings with no baseline counterpart (read closely): ${a.candidate_only.join(", ")}`);
    }
    const rep = c.live.report;
    if (rep) {
      L.push("", "### Live content (validated; synthetic fixtures)", "", `**Summary.** ${rep.summary || "_(withheld or empty)_"}`, "");
      for (const f of rep.findings) {
        L.push(`- **${f.id}** · ${f.category} · ${f.severity} · ${f.evidence_status} — **${f.title}**`, `  ${f.explanation}`, `  refs: facts ${f.refs.facts.join(", ") || "-"}; docs ${f.refs.documents.map((d) => `${d.id}@${d.locator}`).join(", ") || "-"}; runs ${f.refs.check_runs.join(", ") || "-"}; amounts ${f.cited_amounts.map((x) => `${x.amount} (${x.field})`).join(", ") || "-"}`, `  next: ${f.suggested_next_action ?? "-"}${f.question ? ` · question: ${f.question}` : ""}`);
      }
      if (rep.questions.length) L.push("", `Questions: ${rep.questions.join(" | ")}`);
      L.push("", `Limitations: ${rep.limitations.join(" | ")}`);
      if (rep.draft_memo) L.push("", "<details><summary>Draft memo</summary>", "", rep.draft_memo, "", "</details>");
    }
  }
  L.push("", "Review per `docs/ai/AI_CORE_002B_LIVE_BENCHMARK_REVIEW.md` §4; record the decision in `docs/ai/AI_EVAL_MATRIX.md`. Differences from the baseline are differences from the deterministic mock, not a score.", "");
  return L.join("\n");
}
