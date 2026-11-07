/**
 * AI-SEC-001 (independent audit, 2026-11-06): the validator grounded every
 * finding but copied the top-level narrative — summary, draft_memo, questions,
 * model limitations — after only an injection check. A forged amount or an
 * unsupported "verified" claim in the summary would have been rendered.
 *
 * These cases pin the fix: the narrative gets the same amount and pass-claim
 * rules as findings, and a failing field is withheld (REDACT_TEXT) while the
 * validated findings survive. Offline, scripted provider, no network.
 */
import { describe, expect, it } from "vitest";
import type { AiRunRecord, AiValidationIssue } from "@sagespan/contracts";
import { MemoryStore } from "@/domain/store";
import { resolveFirmContext } from "../evidence-resolver";
import { ScriptedProvider } from "../provider";
import { orchestrate } from "../review-orchestrator";
import { HP_CCO, addPatelCheckRun, scriptedOutput } from "../evals/fixtures";

const redactions = (r: AiRunRecord): AiValidationIssue[] => r.validation_issues.filter((i) => i.disposition === "REDACT_TEXT");
const codes = (r: AiRunRecord) => r.validation_issues.map((i) => i.code);

function patel(opts?: Parameters<typeof addPatelCheckRun>[1]) {
  const store = new MemoryStore();
  let runId = "";
  store.mutate((s) => {
    runId = addPatelCheckRun(s, opts).run.id;
  });
  return { ctx: resolveFirmContext(store.read(), HP_CCO, "hh_patel"), runId };
}

/** A finding that legitimately cites the Patel run's computed RMD (25098.04) so the narrative may repeat it. */
function citedFinding(runId: string) {
  return { category: "CHECK_DISCREPANCY", explanation: "The engine computed 25098.04.", check_run_refs: [runId], cited_amounts: [{ amount: "25098.04", currency: "USD", check_run_ref: runId, field: "annual_rmd" }] };
}

async function run(ctx: ReturnType<typeof patel>["ctx"], output: ReturnType<typeof scriptedOutput>) {
  return (await orchestrate(ctx, "RETIREMENT_PLAN_REVIEW", HP_CCO.user_id, new ScriptedProvider(() => output))).record;
}

describe("AI-SEC-001 narrative grounding (summary, memo, questions, limitations)", () => {
  it("AI-N01 an invented amount in the summary is withheld; the validated finding survives", async () => {
    const { ctx, runId } = patel();
    const r = await run(ctx, scriptedOutput({ summary: "Overall the household owes $999,999.00 this year.", finding: citedFinding(runId) }));
    expect(r.run_status).toBe("DRAFT_READY");
    expect(r.accepted_finding_count).toBe(1);
    expect(r.report!.summary).not.toContain("999,999");
    expect(r.report!.summary).toMatch(/^Summary withheld/);
    const red = redactions(r);
    expect(red).toHaveLength(1);
    expect(red[0]).toMatchObject({ code: "AMOUNT_WITHOUT_TOOL_BACKING", finding_id: null });
    expect(red[0]!.detail).toContain("summary");
  });

  it("AI-N02 an invented amount in the draft memo drops the memo, not the report", async () => {
    const { ctx, runId } = patel();
    const r = await run(ctx, scriptedOutput({ draft_memo: "DRAFT memo: the shortfall is 1,250.00 and should be withdrawn.", finding: citedFinding(runId) }));
    expect(r.report).not.toBeNull();
    expect(r.report!.draft_memo).toBeNull();
    expect(redactions(r).map((i) => i.detail).join(" ")).toContain("draft_memo");
  });

  it("AI-N03 a question carrying an invented amount is dropped; grounded questions stay", async () => {
    const { ctx, runId } = patel();
    const r = await run(ctx, scriptedOutput({ questions: ["Which custodian statement governs?", "Can the client afford the $4,000.00 catch-up?"], finding: citedFinding(runId) }));
    expect(r.report!.questions).toEqual(["Which custodian statement governs?"]);
    expect(redactions(r)).toHaveLength(1);
  });

  it("AI-N04 an amount the accepted findings cite may be repeated in the narrative (no false positive)", async () => {
    const { ctx, runId } = patel();
    const r = await run(ctx, scriptedOutput({ summary: "The independent RMD is $25,098.04; see the finding.", draft_memo: "Memo: engine figure 25,098.04 vs plan.", questions: ["Is 25098.04 the figure the custodian will use?"], finding: citedFinding(runId) }));
    expect(redactions(r)).toHaveLength(0);
    expect(r.report!.summary).toContain("$25,098.04");
    expect(r.report!.draft_memo).toContain("25,098.04");
    expect(r.report!.questions).toHaveLength(1);
    expect(codes(r)).not.toContain("AMOUNT_WITHOUT_TOOL_BACKING");
  });

  it("AI-N05 pass/verified language in the summary while the cited run is UNSUPPORTED is withheld", async () => {
    const { ctx, runId } = patel({ status: "UNSUPPORTED" });
    const r = await run(ctx, scriptedOutput({ summary: "The RMD check passed and the account is verified.", finding: { category: "UNSUPPORTED_CHECK", explanation: "The check returned UNSUPPORTED.", check_run_refs: [runId] } }));
    expect(r.accepted_finding_count).toBe(1);
    expect(r.report!.summary).toMatch(/^Summary withheld/);
    expect(redactions(r)[0]).toMatchObject({ code: "UNSUPPORTED_PROMOTED_TO_PASS", finding_id: null });
  });

  it("AI-N06 verified/approved language with no calculation run anywhere is withheld; negated language is not", async () => {
    const { ctx } = patel();
    const claimed = await run(ctx, scriptedOutput({ summary: "This plan is approved and verified.", draft_memo: "Nothing here is verified; no check has run." }));
    expect(claimed.report!.summary).toMatch(/^Summary withheld/);
    expect(claimed.report!.draft_memo).toBe("Nothing here is verified; no check has run.");
    expect(redactions(claimed)).toHaveLength(1);
    expect(redactions(claimed)[0]!.code).toBe("UNSUPPORTED_PROMOTED_TO_PASS");
  });

  it("AI-N07 an invented amount in a model limitation drops that line; server limitations are untouched", async () => {
    const { ctx, runId } = patel();
    const r = await run(ctx, scriptedOutput({ limitations: ["Only one account was reviewed.", "Assumes a $7,500.00 contribution."], finding: citedFinding(runId) }));
    expect(r.report!.limitations).toContain("Only one account was reviewed.");
    expect(r.report!.limitations.join(" ")).not.toContain("7,500");
    expect(r.report!.limitations.length).toBeGreaterThan(1); // server limitations still appended
    expect(redactions(r)[0]!.detail).toContain("limitation");
  });

  it("AI-N08 a redaction never promotes the run: status stays DRAFT_READY, no finding is approved or verified", async () => {
    const { ctx, runId } = patel();
    const r = await run(ctx, scriptedOutput({ summary: "$1.00", finding: citedFinding(runId) }));
    expect(r.run_status).toBe("DRAFT_READY");
    expect(r.report!.status).toBe("DRAFT_FOR_HUMAN_REVIEW");
    expect(JSON.stringify(r.report)).not.toMatch(/"APPROVED"|"VERIFIED"/);
  });
});
