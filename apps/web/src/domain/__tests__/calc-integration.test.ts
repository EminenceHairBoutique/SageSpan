import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { RmdCheckRequestSchema } from "@sagespan/contracts";
import { CalcServiceError, calcHealth, callRmdCheck, fetchRuleSets } from "@/provenance/calc-client";

/**
 * Live contract test against the Python service (skipped when it is not
 * running). Proves the TypeScript client, the Zod mirror and the engine agree
 * on the exact receipt metadata for the Patel fixture.
 */
const FIX = path.resolve(__dirname, "../../../../../fixtures/synthetic/calc");

describe("calculation service integration", async () => {
  const health = await calcHealth();
  const run = health.ok ? it : it.skip;

  run("returns the exact Patel receipt and the client re-derives the request hash", async () => {
    const request = RmdCheckRequestSchema.parse(JSON.parse(readFileSync(path.join(FIX, "patel_rmd_request.json"), "utf8")));
    const expected = JSON.parse(readFileSync(path.join(FIX, "patel_rmd_expected_response.json"), "utf8"));
    const { response, requestHashVerified } = await callRmdCheck(request, "org_harborpoint");
    expect(requestHashVerified).toBe(true);
    expect(response.annual_rmd).toBe("25098.04");
    expect(response.result_status).toBe("PASS");
    expect(response.coverage_status).toBe("SUPPORTED_VERIFIED");
    expect(response.receipt.request_hash).toBe(expected.receipt.request_hash);
    expect(response.receipt.run_hash).toBe(expected.receipt.run_hash);
    expect(response.receipt.org_context.org_id).toBe("org_harborpoint");
    expect(response.receipt.engine_version).toBe(expected.receipt.engine_version);
    expect(response.receipt.rule_sets.map((r) => `${r.rule_set_id}@${r.version}:${r.checksum}`)).toEqual(expected.receipt.rule_sets.map((r: { rule_set_id: string; version: string; checksum: string }) => `${r.rule_set_id}@${r.version}:${r.checksum}`));
    expect(response.discrepancy?.classification).toBe("SOURCE_CONFLICT");
    expect(response.discrepancy?.difference).toBe("1098.04");
  });

  run("surfaces service validation errors as typed failures (no local fallback)", async () => {
    const request = RmdCheckRequestSchema.parse(JSON.parse(readFileSync(path.join(FIX, "patel_rmd_request.json"), "utf8")));
    await expect(callRmdCheck({ ...request, org_id: "org_forged" } as unknown as typeof request, "org_harborpoint")).rejects.toBeInstanceOf(CalcServiceError);
    const rules = await fetchRuleSets("org_harborpoint");
    expect(rules.rule_sets.some((r) => r.rule_set_id === "rmd.uniform_lifetime_table" && r.status === "PUBLISHED")).toBe(true);
  });

  if (!health.ok) {
    it("is skipped because the calculation service is not running", () => {
      expect(health.ok).toBe(false);
    });
  }
});
