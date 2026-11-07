import type { ReactNode } from "react";
import { AlertTriangle, BookmarkCheck, CheckCircle2, CircleHelp, Info, Lock, Stamp, XCircle } from "lucide-react";
import { DISCREPANCY_LABELS, FACT_STATUS_LABELS, REVIEW_OUTCOME_DESCRIPTIONS, REVIEW_OUTCOME_LABELS, WORKFLOW_LABELS, type AccountCoverage, type DiscrepancyClassification, type FactStatus, type ReviewOutcome, type WorkflowStatus } from "@sagespan/contracts";
import { Chip, chipIconSize, type ChipTone } from "./Chip";

/**
 * Advisor & Assurance status chips (design system §6.1–6.6). Every value of
 * every enum has one label, one tone and one icon; pages must not add inline
 * ternaries. Labels asserted by the Playwright suites are unchanged in
 * UI-001a: "Arithmetic PASS", "Verified (PASS)" and "Verified (not required)"
 * keep their PR-002 strings here; founder decision D5 (accepted 2026-11-06,
 * roadmap v1.1) renames them in UI-003b together with the two e2e regexes.
 */
const icons = {
  verified: <CheckCircle2 size={chipIconSize} aria-hidden />,
  limitation: <AlertTriangle size={chipIconSize} aria-hidden />,
  blocked: <XCircle size={chipIconSize} aria-hidden />,
  question: <CircleHelp size={chipIconSize} aria-hidden />,
  info: <Info size={chipIconSize} aria-hidden />,
  assumed: <BookmarkCheck size={chipIconSize} aria-hidden />,
  frozen: <Lock size={chipIconSize} aria-hidden />,
  approved: <Stamp size={chipIconSize} aria-hidden />,
} satisfies Record<string, ReactNode>;

/* ---- 6.5 fact verification status ---- */
export const FACT_STATUS_QUALIFIERS: Record<FactStatus, string | null> = {
  FACT_CONFIRMED: "evidence",
  FACT_ASSUMED: "documented",
  NEEDS_CONFIRMATION: "claim",
  FACT_CONFLICT: null,
};

const factTone: Record<FactStatus, { tone: ChipTone; icon: ReactNode }> = {
  FACT_CONFIRMED: { tone: "teal", icon: icons.verified },
  FACT_ASSUMED: { tone: "slate", icon: icons.assumed },
  NEEDS_CONFIRMATION: { tone: "amber", icon: icons.question },
  FACT_CONFLICT: { tone: "conflict", icon: icons.limitation },
};

export function FactStatusChip({ status }: { status: FactStatus }) {
  const q = FACT_STATUS_QUALIFIERS[status];
  return (
    <Chip tone={factTone[status].tone} icon={factTone[status].icon}>
      {FACT_STATUS_LABELS[status]}
      {q && <span className="font-medium">({q})</span>}
    </Chip>
  );
}

/* ---- 6.6 workflow status ---- */
const workflowTone: Record<WorkflowStatus, { tone: ChipTone; icon: ReactNode }> = {
  IMPORT_DRAFT: { tone: "slate", icon: icons.info },
  MAPPED: { tone: "slate", icon: icons.info },
  RECONCILIATION_PENDING: { tone: "slate", icon: icons.info },
  BLOCKED: { tone: "conflict", icon: icons.blocked },
  READY_TO_FREEZE: { tone: "neutral", icon: icons.info },
  FROZEN: { tone: "navy", icon: icons.frozen },
  CHECK_COMPLETE: { tone: "navy", icon: icons.frozen },
  REVIEW_PENDING: { tone: "amber", icon: icons.info },
  REVIEWED: { tone: "slate", icon: icons.info },
  APPROVED: { tone: "teal", icon: icons.approved },
  EXPORTED: { tone: "teal", icon: icons.approved },
};

export function WorkflowChip({ status }: { status: WorkflowStatus }) {
  return (
    <Chip tone={workflowTone[status].tone} icon={workflowTone[status].icon}>
      {WORKFLOW_LABELS[status]}
    </Chip>
  );
}

/* ---- 6.1 calculation result (per run) ---- */
export type RunResultStatus = "PASS" | "NOT_REQUIRED" | "UNSUPPORTED" | "INDETERMINATE" | "ERROR";

export const RESULT_CHIP: Record<RunResultStatus, { tone: ChipTone; icon: ReactNode; label: string }> = {
  PASS: { tone: "teal", icon: icons.verified, label: "Arithmetic PASS" },
  NOT_REQUIRED: { tone: "neutral", icon: icons.info, label: "Not required (eligibility confirmed)" },
  UNSUPPORTED: { tone: "amber", icon: icons.limitation, label: "Outside supported scope" },
  INDETERMINATE: { tone: "amber", icon: icons.question, label: "Indeterminate (inputs missing)" },
  ERROR: { tone: "conflict", icon: icons.blocked, label: "Service error (no result)" },
};

export function ResultChip({ status, history }: { status: RunResultStatus; history?: boolean }) {
  return (
    <Chip tone={RESULT_CHIP[status].tone} icon={RESULT_CHIP[status].icon} history={history}>
      {RESULT_CHIP[status].label}
    </Chip>
  );
}

/* ---- 6.2 receipt integrity ---- */
export const RECEIPT_INTEGRITY_CHIP = {
  verified: { tone: "teal", icon: icons.verified, label: "Receipt verified · request hash re-derived here" },
  mismatch: { tone: "conflict", icon: icons.blocked, label: "Receipt mismatch · result not trusted" },
  none: { tone: "neutral", icon: icons.info, label: "No receipt (no run)" },
} satisfies Record<string, { tone: ChipTone; icon: ReactNode; label: string }>;

export function ReceiptIntegrityChip({ verified }: { verified: boolean | null | undefined }) {
  const key = verified === true ? "verified" : verified === false ? "mismatch" : "none";
  const c = RECEIPT_INTEGRITY_CHIP[key];
  return (
    <Chip tone={c.tone} icon={c.icon}>
      {c.label}
    </Chip>
  );
}

/* ---- 6.3 account coverage (latest attempt) ---- */
export const COVERAGE_CHIP: Record<AccountCoverage, { tone: ChipTone; icon: ReactNode; label: string }> = {
  // D5 (accepted) becomes "Arithmetic PASS · receipt verified" in UI-003b; the PR-002 label stays until that PR updates assurance-flow.spec.ts.
  VERIFIED: { tone: "teal", icon: icons.verified, label: "Verified (PASS)" },
  // D5 (accepted) becomes "Not required (eligibility confirmed)" (neutral) in UI-003b; the PR-002 label stays until that PR updates pr-002-coverage.spec.ts.
  NOT_REQUIRED: { tone: "teal", icon: icons.verified, label: "Verified (not required)" },
  UNSUPPORTED: { tone: "amber", icon: icons.limitation, label: "Outside supported scope" },
  INDETERMINATE: { tone: "amber", icon: icons.question, label: "Indeterminate" },
  ERROR: { tone: "conflict", icon: icons.blocked, label: "Latest attempt failed" },
  NOT_RUN: { tone: "neutral", icon: icons.info, label: "Not run" },
};

export function CoverageChip({ coverage, history }: { coverage: AccountCoverage; history?: boolean }) {
  return (
    <Chip tone={COVERAGE_CHIP[coverage].tone} icon={COVERAGE_CHIP[coverage].icon} history={history}>
      {COVERAGE_CHIP[coverage].label}
    </Chip>
  );
}

/* ---- 6.4 review outcome ---- */
const outcomeTone: Record<ReviewOutcome, { tone: ChipTone; icon: ReactNode }> = {
  SUPPORTED_CHECK_VERIFIED: { tone: "teal", icon: icons.verified },
  APPROVED_WITH_EXCEPTIONS: { tone: "navy", icon: icons.approved },
  REVIEWED_WITH_LIMITATIONS: { tone: "amber", icon: icons.limitation },
};

export const OUTCOME_NOT_APPROVED_LABEL = "Not approved";

/** The approver never chooses this label: it is derived server-side from coverage. The description is one disclosure away (outcome notice). */
export function OutcomeChip({ outcome, exceptions }: { outcome: ReviewOutcome | null | undefined; exceptions?: number }) {
  if (!outcome) return <Chip tone="neutral">{OUTCOME_NOT_APPROVED_LABEL}</Chip>;
  const suffix = outcome === "APPROVED_WITH_EXCEPTIONS" && exceptions != null ? ` (${exceptions})` : "";
  return (
    <Chip tone={outcomeTone[outcome].tone} icon={outcomeTone[outcome].icon} title={REVIEW_OUTCOME_DESCRIPTIONS[outcome]}>
      {REVIEW_OUTCOME_LABELS[outcome]}
      {suffix}
    </Chip>
  );
}

/* ---- discrepancy classification ---- */
const classificationTone: Record<DiscrepancyClassification, ChipTone> = {
  WITHIN_TOLERANCE: "teal",
  SOURCE_CONFLICT: "conflict",
  RULE_DISAGREEMENT: "conflict",
  STALE_INPUT: "amber",
  MISSING_EVIDENCE: "amber",
  UNSUPPORTED_CHECK: "amber",
  METHODOLOGY_DIFFERENCE: "slate",
  NOT_COMPARABLE: "slate",
};

export function ClassificationChip({ classification }: { classification: DiscrepancyClassification }) {
  const tone = classificationTone[classification];
  return (
    <Chip tone={tone} icon={tone === "teal" ? icons.verified : tone === "conflict" ? icons.limitation : icons.info}>
      {DISCREPANCY_LABELS[classification]}
    </Chip>
  );
}
