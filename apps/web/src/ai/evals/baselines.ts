import { readFileSync } from "node:fs";
import path from "node:path";
import { AiReviewReportSchema, type AiReviewReport } from "@sagespan/contracts";
import type { Store } from "@/domain/store";
import { MemoryStore } from "@/domain/store";
import { MockToolLoopProvider, type AiProvider } from "../provider";
import { runFirmAnalyzePlan, runPersonalUnderstand } from "../review-orchestrator";
import { ALVAREZ, HP_CCO, addCastilloRuns, addPatelCheckRun } from "./fixtures";
import { diffReports, type ReportDiff } from "./regression";

/**
 * AI-CORE-002b — committed `diffReports` baselines.
 *
 * Each baseline is the VALIDATED report the deterministic two-turn mock produces for one
 * frozen fixture. They are checked into `evals/baselines/*.json` so that:
 *  - `ai-baselines.test.ts` pins the mock to them (a prompt / tool / validator / runtime change
 *    that moves a finding must be reviewed, not absorbed);
 *  - the opt-in live benchmark compares a live model to the SAME baseline the mock meets, so a
 *    reviewer reads one diff shape for both.
 * Regenerate deliberately: `SAGESPAN_WRITE_AI_BASELINES=1 npx vitest run src/ai/__tests__/ai-baselines.test.ts`
 * from `apps/web`, then review the JSON diff in the PR. A baseline is evidence of the mock's
 * behaviour, not a quality target for a live model.
 */
export interface BaselineCase {
  id: string;
  file: string;
  audience: "FIRM" | "PERSONAL";
  description: string;
  seed(store: Store): void;
  /** Runs the case with the given provider (default: the two-turn mock) and returns the validated report. */
  run(store: Store, provider?: AiProvider): Promise<AiReviewReport | null>;
}

export const BASELINE_CASES: BaselineCase[] = [
  {
    id: "patel-firm-pass",
    file: "patel-firm-pass.mock-toolloop.json",
    audience: "FIRM",
    description: "Harbor Point / Patel household with one PASS RMD run (computed 25098.04 vs imported 24000.00): conflict, evidence gaps, discrepancy, beneficiary question.",
    seed: (store) =>
      store.mutate((s) => {
        addPatelCheckRun(s);
      }),
    run: async (store, provider) => (await runFirmAnalyzePlan(store, HP_CCO, "hh_patel", provider ?? new MockToolLoopProvider())).report,
  },
  {
    id: "patel-firm-unsupported",
    file: "patel-firm-unsupported.mock-toolloop.json",
    audience: "FIRM",
    description: "Patel household whose only run is UNSUPPORTED (inherited account): no verified check, reviewer follow-up, no amounts.",
    seed: (store) =>
      store.mutate((s) => {
        addPatelCheckRun(s, { status: "UNSUPPORTED", unsupportedCode: "INHERITED_ACCOUNT_UNSUPPORTED" });
      }),
    run: async (store, provider) => (await runFirmAnalyzePlan(store, HP_CCO, "hh_patel", provider ?? new MockToolLoopProvider())).report,
  },
  {
    id: "castillo-personal",
    file: "castillo-personal.mock-toolloop.json",
    audience: "PERSONAL",
    description: "Castillo personal workspace with a receipted clarity run and debt-paths run: where-you-stand, buffer gap, irregular income, debt trade-off, education.",
    seed: (store) =>
      store.mutate((s) => {
        addCastilloRuns(s);
      }),
    run: async (store, provider) => (await runPersonalUnderstand(store, ALVAREZ, provider ?? new MockToolLoopProvider())).report,
  },
];

export const BASELINE_DIR = path.resolve(__dirname, "baselines");

export function baselinePath(c: BaselineCase): string {
  return path.join(BASELINE_DIR, c.file);
}

export function loadBaseline(c: BaselineCase): AiReviewReport {
  return AiReviewReportSchema.parse(JSON.parse(readFileSync(baselinePath(c), "utf8")));
}

/** Fresh store + the case's seed + the mock → the report the baseline must equal. */
export async function regenerateBaseline(c: BaselineCase): Promise<AiReviewReport> {
  const store = new MemoryStore();
  c.seed(store);
  const report = await c.run(store);
  if (!report) throw new Error(`baseline case ${c.id} produced no report`);
  return report;
}

export function compareToBaseline(c: BaselineCase, candidate: AiReviewReport): ReportDiff {
  return diffReports(loadBaseline(c), candidate);
}
