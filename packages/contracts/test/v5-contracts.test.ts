import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  AI_FORBIDDEN_TOOLS,
  AI_TOOLS,
  AiFindingSchema,
  AiReviewReportSchema,
  DebtPathsResponseSchema,
  DECISION_POLICY_VERSION,
  ENABLED_TIERS,
  MAX_PRIMARY_ACTIONS,
  PersonalClarityRequestSchema,
  PersonalClarityResponseSchema,
  RecommendationSchema,
  actorCanReadDomain,
  evaluateDecisionPolicy,
  grantCovers,
  tierEnabled,
  type ConsentGrant,
  type DebtPathsResponse,
  type PersonalClarityResponse,
  type WorkspaceActor,
} from "../src/index";

const fixtures = path.resolve(__dirname, "../../../fixtures/synthetic/personal");
const load = (name: string) => JSON.parse(readFileSync(path.join(fixtures, name), "utf8")) as unknown;

const clarity = PersonalClarityResponseSchema.parse(load("castillo_clarity_expected_response.json")) as PersonalClarityResponse;
const debt = DebtPathsResponseSchema.parse(load("castillo_debt_paths_expected_response.json")) as DebtPathsResponse;

describe("personal engine contracts mirror the Python service", () => {
  it("parses the committed Castillo request and responses", () => {
    const req = PersonalClarityRequestSchema.parse(load("castillo_clarity_request.json"));
    expect(req.cash_accounts).toHaveLength(2);
    expect(clarity.margin.typical).toBe("1503.50");
    expect(clarity.receipt.rule_sets[0]?.rule_set_id).toBe("personal.cashflow_baseline");
    expect(debt.results.find((r) => r.strategy === "AVALANCHE")?.interest_saved_vs_minimums).toBe("3026.04");
  });

  it("rejects a tenant claim in the request body (strict object)", () => {
    const req = load("castillo_clarity_request.json") as Record<string, unknown>;
    expect(PersonalClarityRequestSchema.safeParse({ ...req, org_id: "org_x" }).success).toBe(false);
    expect(PersonalClarityRequestSchema.safeParse({ ...req, workspace_id: "ws_x" }).success).toBe(false);
  });
});

describe("decision policy v1", () => {
  const input = { workspace_id: "ws_castillo_personal", clarity, clarity_run_id: "pcr_clarity_1", debt, debt_run_id: "pcr_debt_1", labels: { liab_castillo_card: "Rewards credit card", cash_castillo_savings: "Savings" } };

  it("produces at most three primary actions, all schema-valid and tier-enabled", () => {
    const out = evaluateDecisionPolicy(input);
    expect(out.policy_version).toBe(DECISION_POLICY_VERSION);
    expect(out.primary.length).toBeLessThanOrEqual(MAX_PRIMARY_ACTIONS);
    expect(out.primary.map((r) => r.priority)).toEqual(["DO_THIS_NOW", "CONSIDER_NEXT", "REVISIT_LATER"].slice(0, out.primary.length));
    for (const r of [...out.primary, ...out.more]) {
      expect(RecommendationSchema.safeParse(r).success).toBe(true);
      expect(tierEnabled(r.tier)).toBe(true);
      expect(r.status).toBe("DRAFT_FOR_USER");
      expect(r.created_by).toBe("POLICY_ENGINE");
    }
  });

  it("every dollar impact cites a deterministic run and copies an engine figure verbatim", () => {
    const out = evaluateDecisionPolicy(input);
    const engineNumbers = new Set<string>([clarity.cash.buffer_gap_amount!, clarity.margin.low!, clarity.outlook.lowest_projected_cash, ...clarity.outlook.collisions.map((c) => c.total_due), ...clarity.goals.map((g) => g.remaining_amount), ...debt.results.map((r) => r.interest_saved_vs_minimums ?? "")]);
    for (const r of [...out.primary, ...out.more]) {
      if (r.impact.source === "DETERMINISTIC_TOOL") {
        expect(r.impact.calculation_run_ref).toBeTruthy();
        expect(r.calculation_refs).toContain(r.impact.calculation_run_ref);
        expect(engineNumbers.has(r.impact.amount!)).toBe(true);
      } else {
        expect(r.impact.amount ?? null).toBeNull();
      }
    }
  });

  it("ranks the buffer gap and the debt comparison for Castillo, with the debt figure from the debt run", () => {
    const out = evaluateDecisionPolicy(input);
    const codes = [...out.primary, ...out.more].map((r) => r.recommendation_id);
    expect(codes.some((c) => c.endsWith("build_essential_buffer"))).toBe(true);
    const debtRec = [...out.primary, ...out.more].find((r) => r.recommendation_id.endsWith("compare_extra_debt_payment"))!;
    expect(debtRec.impact).toMatchObject({ source: "DETERMINISTIC_TOOL", amount: "3026.04", calculation_run_ref: "pcr_debt_1" });
    expect(debtRec.title).toContain("Rewards credit card");
    expect(debtRec.prerequisites).toContain("All minimum payments continue");
  });

  it("rejects extra debt payments outright when cash is below the floor (constraint, not a lower rank)", () => {
    const pressured: PersonalClarityResponse = { ...clarity, flags: [...clarity.flags, { code: "CASH_BELOW_FLOOR", severity: "HIGH", message: "Liquid cash is already below the cash floor you chose.", refs: [] }] };
    const out = evaluateDecisionPolicy({ ...input, clarity: pressured });
    expect(out.rejected.map((r) => r.code)).toContain("EXTRA_DEBT_PAYMENT");
    expect([...out.primary, ...out.more].some((r) => r.recommendation_id.endsWith("compare_extra_debt_payment"))).toBe(false);
    expect(out.primary[0]?.recommendation_id.endsWith("protect_cash_floor")).toBe(true);
  });

  it("proposes only data requests when the baseline is INSUFFICIENT_DATA", () => {
    const insufficient: PersonalClarityResponse = { ...clarity, result_status: "INSUFFICIENT_DATA", flags: [{ code: "MISSING_CASH_BALANCES", severity: "HIGH", message: "No cash balances were supplied; buffer and outlook start from zero.", refs: [] }] };
    const out = evaluateDecisionPolicy({ ...input, clarity: insufficient, debt: null, debt_run_id: null });
    expect(out.primary.every((r) => r.classification === "DATA_REQUEST")).toBe(true);
    expect(out.primary.every((r) => r.impact.source === "NOT_QUANTIFIED")).toBe(true);
  });

  it("surfaces stale inputs as uncertainty and a confirm request", () => {
    const stale: PersonalClarityResponse = {
      ...clarity,
      flags: [...clarity.flags, { code: "STALE_BALANCE", severity: "MEDIUM", message: "Balance for Savings is dated 2026-08-01.", refs: ["cash_castillo_savings"] }],
      data_quality: clarity.data_quality.map((d) => (d.ref === "cash_castillo_savings" ? { ...d, state: "STALE" as const } : d)),
    };
    const out = evaluateDecisionPolicy({ ...input, clarity: stale });
    const all = [...out.primary, ...out.more];
    expect(all.some((r) => r.recommendation_id.endsWith("confirm_cash_castillo_savings") && r.classification === "DATA_REQUEST")).toBe(true);
    const buffer = all.find((r) => r.recommendation_id.endsWith("build_essential_buffer"))!;
    expect(buffer.uncertainty.join(" ")).toContain("needs a fresh value");
  });

  it("is deterministic for identical inputs", () => {
    const a = JSON.stringify(evaluateDecisionPolicy(input));
    const b = JSON.stringify(evaluateDecisionPolicy(input));
    expect(a).toBe(b);
  });

  it("never enables tiers 3 or 4", () => {
    expect(ENABLED_TIERS).toEqual([0, 1, 2]);
    expect(tierEnabled(3)).toBe(false);
    expect(tierEnabled(4)).toBe(false);
  });
});

describe("workspace authority", () => {
  const now = new Date("2026-11-06T00:00:00Z");
  const grant: ConsentGrant = {
    id: "grant_1",
    grantor_workspace_id: "ws_castillo_personal",
    grantor_principal_id: "pr_castillo",
    grantee_principal_id: null,
    grantee_org_id: "org_harborpoint",
    domains: ["RETIREMENT"],
    purpose: "SECOND_OPINION",
    granted_at: "2026-11-01T00:00:00Z",
    expires_at: "2026-12-01T00:00:00Z",
    revoked_at: null,
    revoked_by: null,
    retention_note: null,
    version: 1,
  };
  const firmActor: WorkspaceActor = { scope: "FIRM", principal_id: "user_hp_cco", org_id: "org_harborpoint", role: "COMPLIANCE", display_name: "Dana" };
  const otherFirm: WorkspaceActor = { scope: "FIRM", principal_id: "user_nl_cco", org_id: "org_northline", role: "COMPLIANCE", display_name: "Elena" };
  const owner: WorkspaceActor = { scope: "PERSONAL", principal_id: "pr_castillo", workspace_id: "ws_castillo_personal", workspace_role: "OWNER", domains: [], display_name: "Maya" };
  const participant: WorkspaceActor = { scope: "HOUSEHOLD", principal_id: "pr_sam", workspace_id: "ws_castillo_personal", workspace_role: "PARTICIPANT", domains: ["SAVINGS_GOALS"], display_name: "Sam" };

  it("firm membership alone never reaches a personal workspace", () => {
    expect(actorCanReadDomain(firmActor, "ws_castillo_personal", "CASH_FLOW", [])).toBe(false);
    expect(actorCanReadDomain(firmActor, "ws_castillo_personal", "CASH_FLOW", [grant])).toBe(false); // grant covers RETIREMENT only
    expect(actorCanReadDomain(firmActor, "ws_castillo_personal", "RETIREMENT", [grant])).toBe(true);
    expect(actorCanReadDomain(otherFirm, "ws_castillo_personal", "RETIREMENT", [grant])).toBe(false);
  });

  it("grants expire and revoke", () => {
    expect(grantCovers(grant, "RETIREMENT", new Date("2026-12-01T00:00:00Z"))).toBe(false);
    expect(grantCovers({ ...grant, revoked_at: "2026-11-05T00:00:00Z" }, "RETIREMENT", now)).toBe(false);
  });

  it("household participants see only granted domains; owners see all", () => {
    expect(actorCanReadDomain(participant, "ws_castillo_personal", "SAVINGS_GOALS", [])).toBe(true);
    expect(actorCanReadDomain(participant, "ws_castillo_personal", "DEBT", [])).toBe(false);
    expect(actorCanReadDomain(owner, "ws_castillo_personal", "DEBT", [])).toBe(true);
    expect(actorCanReadDomain(owner, "ws_other", "DEBT", [])).toBe(false);
  });
});

describe("AI contracts", () => {
  it("has no VERIFIED/APPROVED status and keeps forbidden tools out of the allowlist", () => {
    expect(AiReviewReportSchema.shape.status.options).toEqual(["DRAFT_FOR_HUMAN_REVIEW"]);
    expect((AI_TOOLS as readonly string[]).some((t) => (AI_FORBIDDEN_TOOLS as readonly string[]).includes(t))).toBe(false);
    expect(AI_FORBIDDEN_TOOLS).toContain("run_supported_projection");
  });

  it("a finding cannot carry an evidence_status of VERIFIED", () => {
    const base = { finding_id: "f1", category: "MISSING_EVIDENCE", severity: "HIGH", title: "t", explanation: "e", evidence_status: "UNVERIFIED", suggested_next_action: null };
    expect(AiFindingSchema.safeParse(base).success).toBe(true);
    expect(AiFindingSchema.safeParse({ ...base, evidence_status: "VERIFIED" }).success).toBe(false);
    expect(AiFindingSchema.safeParse({ ...base, cited_amounts: [{ amount: "25098.04", currency: "USD", check_run_ref: "", field: "annual_rmd" }] }).success).toBe(false);
  });
});
