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
  PersonalScenarioRequestSchema,
  PersonalScenarioResponseSchema,
  EXECUTABLE_SCENARIO_KINDS,
  RecommendationSchema,
  ScenarioSpecSchema,
  approvalReadiness,
  coverageSummary,
  latestCheckRuns,
  packetTitle,
  type CheckRun,
  actorCanReadDomain,
  evaluateDecisionPolicy,
  grantCovers,
  tierEnabled,
  type ConsentGrant,
  type DebtPathsResponse,
  type PersonalClarityResponse,
  type PersonalScenarioResponse,
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

describe("personal what-if scenarios (PERS-002c)", () => {
  const scenario = PersonalScenarioResponseSchema.parse(load("castillo_scenario_interruption_expected_response.json")) as PersonalScenarioResponse;

  it("mirrors the Python request/response contract and the golden fixture", () => {
    expect(PersonalScenarioRequestSchema.safeParse(load("castillo_scenario_interruption_request.json")).success).toBe(true);
    expect(scenario.check_type).toBe("PERSONAL_SCENARIO");
    expect(scenario.scenario_metrics.margin_typical).toBe("-2266.50");
    expect(scenario.interruption?.runway_months_typical_spending).toBe("0.95");
    expect(scenario.receipt.rule_sets.map((r) => r.rule_set_id)).toEqual(["personal.cashflow_scenario", "personal.cashflow_baseline"]);
  });

  it("rejects specs whose fields do not belong to the kind, before any engine call", () => {
    expect(ScenarioSpecSchema.safeParse({ kind: "SPENDING_CHANGE", monthly_amount: "-100.00", months: 3 }).success).toBe(false);
    expect(ScenarioSpecSchema.safeParse({ kind: "SPENDING_CHANGE", monthly_amount: "0" }).success).toBe(false);
    expect(ScenarioSpecSchema.safeParse({ kind: "SAVINGS_CHANGE", monthly_amount: "-5" }).success).toBe(false);
    expect(ScenarioSpecSchema.safeParse({ kind: "INCOME_INTERRUPTION", stream_ref: "x" }).success).toBe(false);
    expect(ScenarioSpecSchema.safeParse({ kind: "INCOME_INTERRUPTION", stream_ref: "x", months: 13 }).success).toBe(false);
    expect(ScenarioSpecSchema.safeParse({ kind: "INCOME_INTERRUPTION", stream_ref: "x", months: 6 }).success).toBe(true);
    expect(PersonalScenarioRequestSchema.safeParse({ ...(load("castillo_scenario_interruption_request.json") as object), org_id: "org_x" }).success).toBe(false);
  });

  it("the policy turns an uncovered interruption into a tier-2 resilience decision that cites the scenario run", () => {
    const out = evaluateDecisionPolicy({ workspace_id: "ws_castillo_personal", clarity, clarity_run_id: "pcr_clarity_1", debt, debt_run_id: "pcr_debt_1", scenarios: [{ run_id: "pcr_scen_1", response: scenario }], labels: { inc_castillo_contract: "Design contract work" } });
    const rec = [...out.primary, ...out.more].find((r) => r.title.startsWith("If Design contract work stopped"));
    expect(rec).toBeTruthy();
    expect(rec!.tier).toBe(2);
    expect(rec!.calculation_refs).toContain("pcr_scen_1");
    expect(rec!.impact.source).toBe("DETERMINISTIC_TOOL");
    if (rec!.impact.source === "DETERMINISTIC_TOOL") expect(rec!.impact.amount).toBe(scenario.interruption!.margin_typical_during);
    expect(rec!.title).toContain("0.95");
  });

  it("an interruption the buffer covers produces no action, only a rationale line", () => {
    const covered: PersonalScenarioResponse = { ...scenario, interruption: { ...scenario.interruption!, cash_above_floor_covers_interruption: true } };
    const out = evaluateDecisionPolicy({ workspace_id: "ws", clarity, clarity_run_id: "c", debt: null, scenarios: [{ run_id: "s", response: covered }] });
    expect([...out.primary, ...out.more].some((r) => r.calculation_refs.includes("s"))).toBe(false);
    expect(out.rationale.some((l) => l.includes("no action proposed"))).toBe(true);
  });

  it("a savings change that turns the low month negative is rejected by constraint, not ranked", () => {
    const bad: PersonalScenarioResponse = { ...scenario, scenario: { kind: "SAVINGS_CHANGE", monthly_amount: "600.00", destination: "LIQUID" }, interruption: null, scenario_metrics: { ...scenario.baseline_metrics, margin_low: "-66.50", margin_typical: "903.50" } };
    const out = evaluateDecisionPolicy({ workspace_id: "ws", clarity, clarity_run_id: "c", debt: null, scenarios: [{ run_id: "s", response: bad }] });
    expect(out.rejected.some((r) => r.code === "ADOPT_SAVINGS_CHANGE")).toBe(true);
    expect([...out.primary, ...out.more].some((r) => r.calculation_refs.includes("s"))).toBe(false);
  });

  it("the three cash-flow what-ifs are now executable scenario kinds for the AI proposer", () => {
    expect(EXECUTABLE_SCENARIO_KINDS).toEqual(expect.arrayContaining(["SPENDING_CHANGE", "SAVINGS_CHANGE", "INCOME_INTERRUPTION"]));
    expect(EXECUTABLE_SCENARIO_KINDS).not.toContain("RETIREMENT_DATE_CHANGE");
  });
});

describe("PR-002 coverage helpers (pure)", () => {
  const snap = { id: "s1", canonical_payload: { accounts: [{ id: "a1", account_type: "TRADITIONAL_IRA", tax_character: "PRE_TAX" }], exceptions: [] } } as unknown as Parameters<typeof coverageSummary>[0];
  const run = (id: string, status: "PASS" | "ERROR" | "UNSUPPORTED", at: string, verified = status !== "ERROR") =>
    ({ id, snapshot_id: "s1", check_type: "RMD_ANNUAL", run_status: status, coverage_status: status === "PASS" ? "SUPPORTED_VERIFIED" : status === "ERROR" ? null : "UNSUPPORTED", request_hash_verified: verified, executed_at: at, request_payload: { account: { account_ref: "a1" } } }) as unknown as CheckRun;

  it("latestCheckRuns picks the newest attempt per account and keeps the rest as superseded; ties fall to the later insertion", () => {
    const { latest, superseded } = latestCheckRuns([run("r1", "ERROR", "2026-11-06T10:00:00Z"), run("r2", "PASS", "2026-11-06T10:01:00Z"), run("r3", "PASS", "2026-11-06T10:01:00Z")], "s1");
    expect(latest.map((r) => r.id)).toEqual(["r3"]);
    expect(superseded.map((r) => r.id).sort()).toEqual(["r1", "r2"]);
    expect(latestCheckRuns([run("x", "PASS", "2026-11-06T10:00:00Z")], "other").latest).toEqual([]);
  });

  it("approvalReadiness: ERROR->PASS recovers, PASS->ERROR blocks, unsupported-only is limitations, nothing run is CHECK_REQUIRED", () => {
    expect(approvalReadiness(coverageSummary(snap, [run("r1", "ERROR", "2026-11-06T10:00:00Z"), run("r2", "PASS", "2026-11-06T10:01:00Z")], []))).toEqual({ ready: true, outcome: "SUPPORTED_CHECK_VERIFIED" });
    expect(approvalReadiness(coverageSummary(snap, [run("r1", "PASS", "2026-11-06T10:00:00Z"), run("r2", "ERROR", "2026-11-06T10:01:00Z")], []))).toMatchObject({ ready: false, code: "CHECK_FAILED_LATEST" });
    expect(approvalReadiness(coverageSummary(snap, [run("r1", "UNSUPPORTED", "2026-11-06T10:00:00Z")], []))).toEqual({ ready: true, outcome: "REVIEWED_WITH_LIMITATIONS" });
    expect(approvalReadiness(coverageSummary(snap, [], []))).toMatchObject({ ready: false, code: "CHECK_REQUIRED" });
    expect(approvalReadiness(coverageSummary({ ...snap, canonical_payload: { ...snap.canonical_payload, accounts: [] } } as typeof snap, [], []))).toMatchObject({ ready: false, code: "NO_ACCOUNTS_IN_SCOPE" });
  });

  it("packetTitle never says 'verified' for unsupported-only coverage", () => {
    const s = coverageSummary(snap, [run("r1", "UNSUPPORTED", "2026-11-06T10:00:00Z")], []);
    expect(packetTitle(s, "REVIEWED_WITH_LIMITATIONS")).toMatch(/no supported checks/);
    expect(packetTitle(s, "REVIEWED_WITH_LIMITATIONS")).not.toMatch(/supported check verified/);
    expect(packetTitle(s, null)).toMatch(/not approved/);
  });
});
