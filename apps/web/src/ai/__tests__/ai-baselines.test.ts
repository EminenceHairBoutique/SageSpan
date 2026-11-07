/**
 * AI-CORE-002b — the deterministic two-turn mock is pinned to the committed baselines
 * (`evals/baselines/*.json`). A failing case here means a prompt, tool, validator or runtime
 * change moved a validated finding: review the diff, then regenerate deliberately with
 * `SAGESPAN_WRITE_AI_BASELINES=1 npx vitest run src/ai/__tests__/ai-baselines.test.ts` (apps/web)
 * and commit the JSON change in the same PR.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BASELINE_CASES, BASELINE_DIR, baselinePath, compareToBaseline, loadBaseline, regenerateBaseline } from "../evals/baselines";

const WRITE = process.env.SAGESPAN_WRITE_AI_BASELINES === "1";

describe("AI-CORE-002b committed diffReports baselines", () => {
  for (const c of BASELINE_CASES) {
    it(`AI-B ${c.id}: the two-turn mock reproduces the committed baseline exactly`, async () => {
      const fresh = await regenerateBaseline(c);
      if (WRITE || !existsSync(baselinePath(c))) {
        mkdirSync(BASELINE_DIR, { recursive: true });
        writeFileSync(baselinePath(c), `${JSON.stringify(fresh, null, 2)}\n`);
      }
      const baseline = loadBaseline(c);
      const diff = compareToBaseline(c, fresh);
      expect(diff).toEqual({ added: [], removed: [], changed: [], identical: true });
      expect(baseline.status).toBe("DRAFT_FOR_HUMAN_REVIEW");
      expect(baseline.model_metadata.mode).toBe("MOCK_DETERMINISTIC");
      expect(baseline.findings.length).toBeGreaterThan(0);
      // the baseline carries no ids that change between runs, so it is stable across machines
      expect(JSON.stringify(baseline)).not.toMatch(/airun_|"created_at"/);
    });
  }

  it("AI-B baselines never contain an approval, a verified claim or a PASS asserted by the model", () => {
    for (const c of BASELINE_CASES) {
      const json = JSON.stringify(loadBaseline(c));
      expect(json).not.toMatch(/"status":"APPROVED"|"evidence_status":"VERIFIED"/);
    }
  });
});
