import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { APPROVAL_CAPABLE_ROLES, ROLES, approvalDecision, can, canApprove, canonicalHash, canonicalJson, type Role } from "../src";

const CANON = resolve(__dirname, "../../../fixtures/synthetic/canonical");

describe("approval matrix (audit N-05): one table for TypeScript, SQL and the UI", () => {
  const defaultPolicy: Role[] = ["COMPLIANCE"];

  it("capability and firm policy are both required", () => {
    for (const role of ROLES) {
      const d = approvalDecision(role, defaultPolicy);
      if (role === "COMPLIANCE") expect(d).toEqual({ allowed: true });
      else if (role === "ADVISOR") expect(d).toMatchObject({ allowed: false, code: "NOT_AN_APPROVER" });
      else expect(d).toMatchObject({ allowed: false, code: "PERMISSION_DENIED" });
    }
  });

  it("firm policy can admit ADVISOR but never a role without the capability", () => {
    expect(canApprove("ADVISOR", ["COMPLIANCE", "ADVISOR"])).toBe(true);
    expect(canApprove("ADMIN", ["COMPLIANCE", "ADVISOR", "ADMIN"])).toBe(false);
    expect(canApprove("ANALYST", ["ANALYST"])).toBe(false);
    expect(canApprove("VIEWER", ["COMPLIANCE", "VIEWER"])).toBe(false);
    expect(canApprove("COMPLIANCE", [])).toBe(false);
  });

  it("APPROVAL_CAPABLE_ROLES is exactly the set that holds review.approve", () => {
    const capable = ROLES.filter((r) => can(r, "review.approve")).sort();
    expect([...APPROVAL_CAPABLE_ROLES].sort()).toEqual(capable);
    expect(capable).toEqual(["ADVISOR", "COMPLIANCE"]);
  });
});

describe("canonical JSON fixtures (audit S-03): TypeScript must hash the shared fixtures like Python and SQL", () => {
  const expected = JSON.parse(readFileSync(resolve(CANON, "expected.json"), "utf8")) as Record<string, string>;
  const cases = readdirSync(CANON).filter((f) => f.startsWith("case_") && f.endsWith(".json")).sort();

  it("every fixture file has an expected digest and vice versa", () => {
    expect(cases.length).toBeGreaterThanOrEqual(3);
    expect(Object.keys(expected).sort()).toEqual(cases);
  });

  for (const file of cases) {
    it(`${file} hashes to the recorded digest`, async () => {
      const payload = JSON.parse(readFileSync(resolve(CANON, file), "utf8"));
      expect(await canonicalHash(payload)).toBe(expected[file]);
      // Re-parsing the canonical text must round-trip (sorted keys, stable strings).
      const text = canonicalJson(payload);
      expect(canonicalJson(JSON.parse(text))).toBe(text);
    });
  }

  it("sorts keys in code-unit order, not locale order", () => {
    expect(canonicalJson({ b: 1, B: 2, _: 3, "1": 4, a: 5 })).toBe('{"1":4,"B":2,"_":3,"a":5,"b":1}');
  });
});
