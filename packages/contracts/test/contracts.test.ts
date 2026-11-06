import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ILLUSTRATIVE_PRICE_TABLE,
  ImportFileSchema,
  PRICING,
  RmdCheckRequestSchema,
  RmdCheckResponseSchema,
  assertCan,
  assertTransition,
  can,
  canTransition,
  canonicalHash,
  canonicalJson,
  checkpointReached,
  formatMoney,
  moneyDiff,
  moneyEquals,
  normalizeMoney,
  parseCents,
  pilotMonthlyUsd,
  standardMonthlyUsd,
} from "../src";

const FIX = resolve(__dirname, "../../../fixtures/synthetic");
const read = (p: string) => JSON.parse(readFileSync(resolve(FIX, p), "utf8"));

describe("pricing hypothesis (illustrative, not offered)", () => {
  it("yields $750 at 100, $2,150 at 500 and $3,900 at 1,000 active households", () => {
    expect(standardMonthlyUsd(100)).toBe(750);
    expect(standardMonthlyUsd(500)).toBe(2150);
    expect(standardMonthlyUsd(1000)).toBe(3900);
  });
  it("applies the firm minimum below 100 and $3.50 per additional household", () => {
    expect(standardMonthlyUsd(0)).toBe(750);
    expect(standardMonthlyUsd(50)).toBe(750);
    expect(standardMonthlyUsd(101)).toBe(753.5);
    expect(standardMonthlyUsd(250)).toBe(1275);
    expect(ILLUSTRATIVE_PRICE_TABLE.map((r) => r.monthlyUsd)).toEqual([750, 750, 1275, 2150, 3900]);
  });
  it("pilot is $500 up to 50 households and not an automatic discount", () => {
    expect(pilotMonthlyUsd(50)).toBe(500);
    expect(pilotMonthlyUsd(51)).toBeNull();
    expect(PRICING.status).toBe("PROPOSED_ILLUSTRATIVE_NOT_OFFERED");
  });
  it("rejects invalid household counts", () => {
    expect(() => standardMonthlyUsd(-1)).toThrow(RangeError);
    expect(() => standardMonthlyUsd(1.5)).toThrow(RangeError);
  });
});

describe("workflow state machine", () => {
  it("follows the documented path", () => {
    const path = ["IMPORT_DRAFT", "MAPPED", "RECONCILIATION_PENDING", "BLOCKED", "RECONCILIATION_PENDING", "READY_TO_FREEZE", "FROZEN", "CHECK_COMPLETE", "REVIEW_PENDING", "REVIEWED", "APPROVED", "EXPORTED"] as const;
    for (let i = 1; i < path.length; i++) expect(canTransition(path[i - 1]!, path[i]!)).toBe(true);
  });
  it("forbids skipping review or approving without a check", () => {
    expect(canTransition("FROZEN", "APPROVED")).toBe(false);
    expect(canTransition("CHECK_COMPLETE", "APPROVED")).toBe(false);
    expect(canTransition("BLOCKED", "FROZEN")).toBe(false);
    expect(() => assertTransition("BLOCKED", "FROZEN")).toThrow(/Invalid workflow transition/);
  });
  it("re-export stays in EXPORTED and checkpoints accumulate", () => {
    expect(canTransition("EXPORTED", "EXPORTED")).toBe(true);
    expect(canTransition("EXPORTED", "IMPORT_DRAFT")).toBe(true); // new import = new revision cycle
    expect(checkpointReached("FROZEN", "frozen")).toBe(true);
    expect(checkpointReached("FROZEN", "checked")).toBe(false);
    expect(checkpointReached("EXPORTED", "approved")).toBe(true);
  });
});

describe("permissions", () => {
  it("analysts cannot approve, viewers cannot edit, admins cannot approve", () => {
    expect(can("ANALYST", "review.approve")).toBe(false);
    expect(can("ANALYST", "fact.confirm")).toBe(false);
    expect(can("ANALYST", "conflict.resolve")).toBe(true);
    expect(can("VIEWER", "conflict.resolve")).toBe(false);
    expect(can("ADMIN", "review.approve")).toBe(false);
    expect(can("COMPLIANCE", "review.approve")).toBe(true);
    expect(can("ADVISOR", "review.disposition")).toBe(true);
    expect(can(null, "household.read")).toBe(false);
    expect(() => assertCan("ANALYST", "review.approve")).toThrow(/Permission denied/);
  });
});

describe("money (integer cents, no floats)", () => {
  it("parses, normalises, compares and subtracts", () => {
    expect(parseCents("640000.00")).toBe(64000000n);
    expect(normalizeMoney("612000")).toBe("612000.00");
    expect(moneyEquals("640000", "640000.00")).toBe(true);
    expect(moneyDiff("25098.04", "24000.00")).toBe("1098.04");
    expect(formatMoney("25098.04")).toBe("$25,098.04");
    expect(formatMoney("-1098.04")).toBe("-$1,098.04");
    expect(() => parseCents("1.005")).toThrow(/decimal places/);
    expect(() => parseCents("abc")).toThrow();
  });
});

describe("canonical hashing matches the Python service byte-for-byte", () => {
  it("produces the same canonical string as canonical.py for the documented sample", () => {
    expect(canonicalJson({ b: ["1"], c: "x", a: "0.10" })).toBe('{"a":"0.10","b":["1"],"c":"x"}');
  });
  it("re-derives the request_hash recorded by the engine for the Patel fixture", async () => {
    const request = read("calc/patel_rmd_request.json");
    const response = read("calc/patel_rmd_expected_response.json");
    const ours = await canonicalHash(request);
    expect(ours).toBe(response.receipt.request_hash);
    // and node:crypto agrees with WebCrypto
    expect(createHash("sha256").update(canonicalJson(request)).digest("hex")).toBe(ours);
  });
});

describe("calculation-service contract fixtures", () => {
  it("Patel request and expected response validate against the Zod mirror", () => {
    const req = RmdCheckRequestSchema.parse(read("calc/patel_rmd_request.json"));
    expect(req.account.prior_year_end_balance?.amount).toBe("640000.00");
    const res = RmdCheckResponseSchema.parse(read("calc/patel_rmd_expected_response.json"));
    expect(res.annual_rmd).toBe("25098.04");
    expect(res.result_status).toBe("PASS");
    expect(res.coverage_status).toBe("SUPPORTED_VERIFIED");
    expect(res.discrepancy?.classification).toBe("SOURCE_CONFLICT");
    expect(res.receipt.rule_sets[0]?.rule_set_id).toBe("rmd.uniform_lifetime_table");
  });
  it("rejects org_id in the request body (never trusted from the client)", () => {
    const req = read("calc/patel_rmd_request.json");
    expect(RmdCheckRequestSchema.safeParse({ ...req, org_id: "org_other" }).success).toBe(false);
  });
});

describe("import contract", () => {
  it("accepts the synthetic Patel plan export and the Reyes statement", () => {
    const patel = ImportFileSchema.parse(read("imports/patel_plan_export_2026.json"));
    expect(patel.schema_version).toBe("sagespan.import.v1");
    expect(patel.imported_checks[0]?.value).toBe("24000.00");
    const reyes = ImportFileSchema.parse(read("imports/reyes_custodian_statement_2025-12-31.json"));
    expect(reyes.source_kind).toBe("CUSTODIAN_STATEMENT");
  });
  it("rejects files carrying org_id or unknown keys", () => {
    const patel = read("imports/patel_plan_export_2026.json");
    expect(ImportFileSchema.safeParse({ ...patel, org_id: "org_x" }).success).toBe(false);
    expect(ImportFileSchema.safeParse({ ...patel, schema_version: "vendor.v9" }).success).toBe(false);
  });
});
