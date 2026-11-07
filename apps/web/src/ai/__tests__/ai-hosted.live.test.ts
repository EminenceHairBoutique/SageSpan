/**
 * AI-CORE-002a/b — OPT-IN live benchmark against the hosted vendor on the frozen synthetic
 * fixtures (the committed baseline cases). Runs ONLY when every hosted gate holds in the
 * environment (`providers/hosted-config.ts`); skipped everywhere else, including CI, which has
 * no key. It spends real tokens. It asserts the runtime's invariants (nothing a model can do
 * reaches a report unvalidated) — it does NOT assert model quality; the written report is for a
 * human `diffReports` review per `docs/ai/AI_CORE_002B_LIVE_BENCHMARK_REVIEW.md`.
 *
 * Output: apps/web/.ai-bench/<timestamp>-hosted.json and .md (git-ignored).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { AiRunRecord } from "@sagespan/contracts";
import { MemoryStore } from "@/domain/store";
import { BASELINE_CASES, compareToBaseline, type BaselineCase } from "../evals/baselines";
import { type ReportDiff } from "../evals/regression";
import { resolveProvider } from "../provider";
import { resolveHostedConfig } from "../providers/hosted-config";
import { HostedProvider } from "../providers/hosted-provider";
import { runFirmAnalyzePlan, runPersonalUnderstand } from "../review-orchestrator";
import { ALVAREZ, HP_CCO } from "../evals/fixtures";

const live = process.env.SAGESPAN_AI_PROVIDER === "hosted" && resolveHostedConfig(process.env).enabled;

interface CaseResult {
  case_id: string;
  audience: BaselineCase["audience"];
  live: ReturnType<typeof summarise>;
  diff_vs_baseline: ReportDiff | null;
  invariant_violations: string[];
}

describe.skipIf(!live)("hosted vendor on the baseline fixtures (opt-in, spends tokens)", () => {
  it("runs every baseline case through the live adapter, validates server-side, diffs against the committed mock baseline, and writes a review report", async () => {
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
      expect(violations).toEqual([]);
      tokens += record.estimated_tokens ?? 0;
      results.push({ case_id: c.id, audience: c.audience, live: summarise(record), diff_vs_baseline: record.report ? compareToBaseline(c, record.report) : null, invariant_violations: violations });
    }
    const report = {
      schema_version: "ai-bench-v1",
      generated_at: new Date().toISOString(),
      provider_note: resolved.note,
      configured_model: process.env.SAGESPAN_AI_HOSTED_MODEL,
      served_by: results.length ? results[0]!.live.served_model : null,
      baseline_source: "apps/web/src/ai/evals/baselines/*.json (two-turn deterministic mock)",
      cases: results,
      total_estimated_tokens: tokens,
      review_status: "UNREVIEWED — a human records the outcome in docs/ai/AI_EVAL_MATRIX.md",
    };
    const dir = path.resolve(process.cwd(), ".ai-bench");
    mkdirSync(dir, { recursive: true });
    const stem = path.join(dir, `${report.generated_at.replace(/[:.]/g, "-")}-hosted`);
    writeFileSync(`${stem}.json`, JSON.stringify(report, null, 2));
    writeFileSync(`${stem}.md`, markdownSummary(report));
    expect(tokens).toBeGreaterThan(0);
  }, 300_000);
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
    finding_categories: r.report?.findings.map((f) => f.category) ?? [],
    limitations: r.report?.limitations ?? [],
    estimated_tokens: r.estimated_tokens,
  };
}

function markdownSummary(report: { generated_at: string; configured_model: string | undefined; served_by: string | null; cases: CaseResult[]; total_estimated_tokens: number; provider_note: string | null }): string {
  const lines: string[] = [];
  lines.push(`# Hosted benchmark — ${report.generated_at}`, "", `Configured model: \`${report.configured_model ?? "?"}\` · served: \`${report.served_by ?? "?"}\` · tokens: ${report.total_estimated_tokens}`, "", `> ${report.provider_note ?? ""}`, "", "| Case | Status | Turns | Tools | Denied | Accepted | Rejected | Added vs baseline | Removed vs baseline | Changed vs baseline | Issue codes |", "|---|---|---|---|---|---|---|---|---|---|---|");
  for (const c of report.cases) {
    const d = c.diff_vs_baseline;
    lines.push(`| ${c.case_id} | ${c.live.run_status} | ${c.live.turns ?? "-"} | ${c.live.tool_calls.join(", ") || "-"} | ${c.live.denied ?? "-"} | ${c.live.accepted} | ${c.live.rejected} | ${d ? d.added.join(", ") || "-" : "n/a"} | ${d ? d.removed.join(", ") || "-" : "n/a"} | ${d ? d.changed.map((x) => `${x.finding_id} (${x.fields.join("/")})`).join("; ") || "-" : "n/a"} | ${[...new Set(c.live.issue_codes)].join(", ") || "-"} |`);
  }
  lines.push("", "Review per `docs/ai/AI_CORE_002B_LIVE_BENCHMARK_REVIEW.md` §4; record the decision in `docs/ai/AI_EVAL_MATRIX.md`. A diff against the baseline is a difference from the deterministic mock, not a score.", "");
  return lines.join("\n");
}
