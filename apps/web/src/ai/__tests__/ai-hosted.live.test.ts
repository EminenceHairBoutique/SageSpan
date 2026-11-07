/**
 * AI-CORE-002a — OPT-IN live benchmark against the hosted vendor on the frozen
 * synthetic fixtures (Patel, Castillo). Runs ONLY when every hosted gate holds in
 * the environment (`providers/hosted-config.ts`); skipped everywhere else, including
 * CI, which has no key. It spends real tokens. It asserts the runtime's invariants
 * (nothing a model can do reaches a report unvalidated) — it does NOT assert model
 * quality; the written report is for a human `diffReports` review per
 * `docs/ai/AI_EVAL_MATRIX.md`.
 *
 * Output: apps/web/.ai-bench/<timestamp>-hosted.json (git-ignored).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MemoryStore } from "@/domain/store";
import { MockToolLoopProvider, resolveProvider } from "../provider";
import { resolveHostedConfig } from "../providers/hosted-config";
import { HostedProvider } from "../providers/hosted-provider";
import { runFirmAnalyzePlan, runPersonalUnderstand } from "../review-orchestrator";
import { ALVAREZ, HP_CCO, addCastilloRuns, addPatelCheckRun } from "../evals/fixtures";
import { diffReports } from "../evals/regression";

const live = process.env.SAGESPAN_AI_PROVIDER === "hosted" && resolveHostedConfig(process.env).enabled;

describe.skipIf(!live)("hosted vendor on synthetic fixtures (opt-in, spends tokens)", () => {
  it("runs Patel and Castillo through the live adapter, validates every output server-side, and writes a review report", async () => {
    const resolved = resolveProvider(process.env);
    expect(resolved.provider).toBeInstanceOf(HostedProvider);
    const store = new MemoryStore();
    store.mutate((s) => {
      addPatelCheckRun(s);
      addCastilloRuns(s);
    });
    const firmLive = await runFirmAnalyzePlan(store, HP_CCO, "hh_patel", resolved.provider);
    const firmMock = await runFirmAnalyzePlan(store, HP_CCO, "hh_patel", new MockToolLoopProvider());
    const personalLive = await runPersonalUnderstand(store, ALVAREZ, resolved.provider);
    const personalMock = await runPersonalUnderstand(store, ALVAREZ, new MockToolLoopProvider());

    for (const r of [firmLive, personalLive]) {
      expect(r.mode).toBe("LIVE");
      expect(["DRAFT_READY", "REJECTED", "ABSTAINED", "ERROR"]).toContain(r.run_status);
      // invariants: whatever the model did, nothing unvalidated is in the report
      for (const f of r.report?.findings ?? []) {
        expect(f.evidence_status).not.toBe("VERIFIED");
        for (const a of f.cited_amounts) expect(f.check_run_refs).toContain(a.check_run_ref);
      }
      expect(r.report?.status ?? "DRAFT_FOR_HUMAN_REVIEW").toBe("DRAFT_FOR_HUMAN_REVIEW");
      expect(JSON.stringify(r)).not.toContain(process.env.SAGESPAN_AI_HOSTED_API_KEY!);
    }

    const report = {
      generated_at: new Date().toISOString(),
      provider_note: resolved.note,
      served_by: firmLive.runtime?.provider_descriptor,
      firm: { live: summarise(firmLive), mock: summarise(firmMock), diff: firmLive.report && firmMock.report ? diffReports(firmMock.report, firmLive.report) : null },
      personal: { live: summarise(personalLive), mock: summarise(personalMock), diff: personalLive.report && personalMock.report ? diffReports(personalMock.report, personalLive.report) : null },
      tokens: (firmLive.estimated_tokens ?? 0) + (personalLive.estimated_tokens ?? 0),
    };
    const dir = path.resolve(process.cwd(), ".ai-bench");
    mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${report.generated_at.replace(/[:.]/g, "-")}-hosted.json`);
    writeFileSync(file, JSON.stringify(report, null, 2));
    expect(report.tokens).toBeGreaterThan(0);
  }, 120_000);
});

function summarise(r: Awaited<ReturnType<typeof runFirmAnalyzePlan>>) {
  return {
    run_id: r.id,
    run_status: r.run_status,
    model: r.model,
    served_model: r.runtime?.provider_descriptor.model ?? null,
    turns: r.runtime?.turns.length ?? null,
    tool_calls: r.tool_calls.map((t) => t.tool),
    denied: r.runtime?.tool_calls_denied ?? null,
    stop_reason: r.runtime?.stop_reason ?? null,
    accepted: r.accepted_finding_count,
    rejected: r.rejected_finding_count,
    issue_codes: r.validation_issues.map((i) => i.code),
    finding_categories: r.report?.findings.map((f) => f.category) ?? [],
    estimated_tokens: r.estimated_tokens,
  };
}
