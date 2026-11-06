import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AI_EVIDENCE_STATUSES, AI_FEEDBACK_ACTIONS, DISCREPANCY_CLASSIFICATIONS, DISCREPANCY_LABELS, FACT_STATUSES, FACT_STATUS_LABELS, PERSONAL_DATA_STATES, PERSONAL_DATA_STATE_LABELS, PRIORITY_LABELS, RECOMMENDATION_PRIORITIES, REVIEW_OUTCOMES, REVIEW_OUTCOME_LABELS, SEVERITIES, USER_DECISIONS, WORKFLOW_LABELS, WORKFLOW_STATUSES, type AccountCoverage } from "@sagespan/contracts";
// Re-export paths are exercised on purpose: existing imports from these modules must keep working.
import { DataStateChip, SeverityChip } from "@/ui/personal/components";
import { ClassificationChip, FactStatusChip, ResultChip, WorkflowChip } from "@/ui/primitives";
import { OutcomeChip } from "@/ui/console/CoveragePanel";
import { AI_EVIDENCE_CHIP, AI_FEEDBACK_CHIP, AI_RUN_STATUS_CHIP, AiEvidenceChip, AiFeedbackChip, AiRunStatusChip, CAPABILITY_CHIP, CAPABILITY_STATUSES, CapabilityChip, COVERAGE_CHIP, CoverageChip, DecisionChip, PriorityChip, RECEIPT_INTEGRITY_CHIP, ReceiptIntegrityChip, RESULT_CHIP, type AiRunStatus, type RunResultStatus } from "@/ui/status";

const render = (node: React.ReactElement) => renderToStaticMarkup(node);
const toneClass: Record<string, string> = {
  teal: "bg-teal-100 text-teal-700",
  amber: "bg-amber-100 text-amber-700",
  slate: "bg-slate-100 text-slate-700",
  conflict: "bg-conflict-100 text-conflict-700",
  navy: "bg-navy-100 text-navy",
  neutral: "bg-surface-muted text-ink-muted",
};
const expectTone = (html: string, tone: string) => expect(html).toContain(toneClass[tone]);

describe("ResultChip (§6.1)", () => {
  const expected: Record<RunResultStatus, [string, string]> = {
    PASS: ["Arithmetic PASS", "teal"],
    NOT_REQUIRED: ["Not required (eligibility confirmed)", "neutral"],
    UNSUPPORTED: ["Outside supported scope", "amber"],
    INDETERMINATE: ["Indeterminate (inputs missing)", "amber"],
    ERROR: ["Service error (no result)", "conflict"],
  };
  for (const status of Object.keys(expected) as RunResultStatus[]) {
    it(`${status} → "${expected[status][0]}" (${expected[status][1]})`, () => {
      const html = render(<ResultChip status={status} />);
      expect(html).toContain(expected[status][0]);
      expectTone(html, expected[status][1]);
      expect(RESULT_CHIP[status].label).toBe(expected[status][0]);
      expect(html).toContain("<svg");
    });
  }
  it("history style keeps the label and adds the earlier marker", () => {
    const html = render(<ResultChip status="PASS" history />);
    expect(html).toContain("earlier ·");
    expect(html).toContain("border-dashed");
  });
});

describe("CoverageChip (§6.3; the accepted D5 labels land in UI-003b with the e2e regexes)", () => {
  const expected: Record<AccountCoverage, [string, string]> = {
    VERIFIED: ["Verified (PASS)", "teal"],
    NOT_REQUIRED: ["Verified (not required)", "teal"],
    UNSUPPORTED: ["Outside supported scope", "amber"],
    INDETERMINATE: ["Indeterminate", "amber"],
    ERROR: ["Latest attempt failed", "conflict"],
    NOT_RUN: ["Not run", "neutral"],
  };
  for (const coverage of Object.keys(expected) as AccountCoverage[]) {
    it(`${coverage} → "${expected[coverage][0]}"`, () => {
      const html = render(<CoverageChip coverage={coverage} />);
      expect(html).toContain(expected[coverage][0]);
      expectTone(html, expected[coverage][1]);
      expect(COVERAGE_CHIP[coverage].label).toBe(expected[coverage][0]);
    });
  }
});

describe("ReceiptIntegrityChip (§6.2)", () => {
  it("covers verified, mismatch and no receipt", () => {
    expect(render(<ReceiptIntegrityChip verified />)).toContain(RECEIPT_INTEGRITY_CHIP.verified.label);
    expectTone(render(<ReceiptIntegrityChip verified />), "teal");
    expect(render(<ReceiptIntegrityChip verified={false} />)).toContain("Receipt mismatch");
    expectTone(render(<ReceiptIntegrityChip verified={false} />), "conflict");
    expect(render(<ReceiptIntegrityChip verified={null} />)).toContain("No receipt (no run)");
    expectTone(render(<ReceiptIntegrityChip verified={null} />), "neutral");
  });
});

describe("OutcomeChip (§6.4)", () => {
  const tones: Record<(typeof REVIEW_OUTCOMES)[number], string> = { SUPPORTED_CHECK_VERIFIED: "teal", APPROVED_WITH_EXCEPTIONS: "navy", REVIEWED_WITH_LIMITATIONS: "amber" };
  for (const outcome of REVIEW_OUTCOMES) {
    it(`${outcome} → "${REVIEW_OUTCOME_LABELS[outcome]}"`, () => {
      const html = render(<OutcomeChip outcome={outcome} />);
      expect(html).toContain(REVIEW_OUTCOME_LABELS[outcome]);
      expectTone(html, tones[outcome]);
    });
  }
  it("null is Not approved, neutral; exceptions count is appended", () => {
    const html = render(<OutcomeChip outcome={null} />);
    expect(html).toContain("Not approved");
    expectTone(html, "neutral");
    expect(render(<OutcomeChip outcome="APPROVED_WITH_EXCEPTIONS" exceptions={2} />)).toContain("Approved with exceptions (2)");
  });
});

describe("FactStatusChip (§6.5)", () => {
  const tones = { FACT_CONFIRMED: "teal", FACT_ASSUMED: "slate", NEEDS_CONFIRMATION: "amber", FACT_CONFLICT: "conflict" } as const;
  for (const status of FACT_STATUSES) {
    it(`${status} → contract label + tone`, () => {
      const html = render(<FactStatusChip status={status} />);
      expect(html).toContain(FACT_STATUS_LABELS[status]);
      expectTone(html, tones[status]);
    });
  }
});

describe("WorkflowChip (§6.6)", () => {
  const tones: Record<(typeof WORKFLOW_STATUSES)[number], string> = {
    IMPORT_DRAFT: "slate",
    MAPPED: "slate",
    RECONCILIATION_PENDING: "slate",
    BLOCKED: "conflict",
    READY_TO_FREEZE: "neutral",
    FROZEN: "navy",
    CHECK_COMPLETE: "navy",
    REVIEW_PENDING: "amber",
    REVIEWED: "slate",
    APPROVED: "teal",
    EXPORTED: "teal",
  };
  for (const status of WORKFLOW_STATUSES) {
    it(`${status} → "${WORKFLOW_LABELS[status]}" (${tones[status]})`, () => {
      const html = render(<WorkflowChip status={status} />);
      expect(html).toContain(WORKFLOW_LABELS[status]);
      expectTone(html, tones[status]);
    });
  }
});

describe("ClassificationChip", () => {
  for (const c of DISCREPANCY_CLASSIFICATIONS) {
    it(`${c} → contract label`, () => {
      expect(render(<ClassificationChip classification={c} />)).toContain(DISCREPANCY_LABELS[c]);
    });
  }
});

describe("DataStateChip (§6.7)", () => {
  const tones = { USER_REPORTED: "neutral", EVIDENCE_VERIFIED: "teal", ASSUMED: "slate", MISSING: "conflict", STALE: "amber", CONFLICTING: "conflict" } as const;
  for (const state of PERSONAL_DATA_STATES) {
    it(`${state} → "${PERSONAL_DATA_STATE_LABELS[state]}" (${tones[state]})`, () => {
      const html = render(<DataStateChip state={state} />);
      expect(html).toContain(PERSONAL_DATA_STATE_LABELS[state]);
      expectTone(html, tones[state]);
    });
  }
  it("MISSING is a limitation when the value is optional", () => {
    expectTone(render(<DataStateChip state="MISSING" required={false} />), "amber");
  });
});

describe("SeverityChip, PriorityChip, DecisionChip (§6.8)", () => {
  it("severity tones and labels", () => {
    const expected = { HIGH: ["High", "conflict"], MEDIUM: ["Medium", "amber"], LOW: ["Low", "slate"], INFO: ["Note", "neutral"] } as const;
    for (const s of SEVERITIES) {
      const html = render(<SeverityChip severity={s} />);
      expect(html).toContain(expected[s][0]);
      expectTone(html, expected[s][1]);
    }
  });
  it("priority: urgency is a limitation, not an error", () => {
    const tones = { DO_THIS_NOW: "amber", CONSIDER_NEXT: "slate", REVISIT_LATER: "neutral" } as const;
    for (const p of RECOMMENDATION_PRIORITIES) {
      const html = render(<PriorityChip priority={p} />);
      expect(html).toContain(PRIORITY_LABELS[p]);
      expectTone(html, tones[p]);
    }
  });
  it("decision: DONE is verified tone, everything else neutral with the verb", () => {
    for (const d of USER_DECISIONS) {
      const html = render(<DecisionChip decision={d} />);
      expect(html).toContain(`You: ${d.toLowerCase().replace(/_/g, " ")}`);
      expectTone(html, d === "DONE" ? "teal" : "neutral");
    }
  });
});

describe("AI chips (§6.9)", () => {
  it("run status", () => {
    const expected: Record<AiRunStatus, string> = { DRAFT_READY: "slate", REJECTED: "conflict", ERROR: "conflict" };
    for (const s of Object.keys(expected) as AiRunStatus[]) {
      const html = render(<AiRunStatusChip status={s} />);
      expect(html).toContain(AI_RUN_STATUS_CHIP[s].label);
      expectTone(html, expected[s]);
    }
    expect(AI_RUN_STATUS_CHIP.DRAFT_READY.label).toBe("Draft for human review");
  });
  it("evidence status", () => {
    const tones = { TOOL_BACKED: "teal", UNVERIFIED: "neutral", HYPOTHESIS: "slate" } as const;
    for (const s of AI_EVIDENCE_STATUSES) {
      const html = render(<AiEvidenceChip status={s} />);
      expect(html).toContain(AI_EVIDENCE_CHIP[s].label);
      expectTone(html, tones[s]);
    }
    expect(AI_EVIDENCE_CHIP.TOOL_BACKED.label).toBe("Amounts from a receipted calculation");
  });
  it("feedback never uses the verified tone", () => {
    for (const a of AI_FEEDBACK_ACTIONS) {
      const html = render(<AiFeedbackChip action={a} version={2} />);
      expect(html).toContain(AI_FEEDBACK_CHIP[a].label);
      expect(html).toContain("· v2");
      expect(html).not.toContain("bg-teal-100");
    }
  });
});

describe("CapabilityChip (§6.10)", () => {
  it("never teal; gate name shown", () => {
    for (const s of CAPABILITY_STATUSES) {
      const html = render(<CapabilityChip status={s} gate="G3" />);
      expect(html).not.toContain("bg-teal-100");
      expectTone(html, CAPABILITY_CHIP[s].tone);
    }
    expect(render(<CapabilityChip status="GATED" gate="G4" />)).toContain("Gated (G4)");
    expect(render(<CapabilityChip status="WORKING_SYNTHETIC" />)).toContain("Working (synthetic)");
  });
});
