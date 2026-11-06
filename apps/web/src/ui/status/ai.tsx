import type { ReactNode } from "react";
import { Bot, CheckCircle2, Info, XCircle } from "lucide-react";
import type { AiEvidenceStatus, AiFeedbackAction, AiRunRecord } from "@sagespan/contracts";
import { Chip, chipIconSize, type ChipTone } from "./Chip";

/**
 * AI status chips (design system §6.9). Acceptance of a draft is not an
 * approval, so no feedback chip uses the verified tone; the provider is always
 * the deterministic offline mock in this build.
 */
export type AiRunStatus = AiRunRecord["run_status"];

export const AI_RUN_STATUS_CHIP: Record<AiRunStatus, { tone: ChipTone; icon: ReactNode; label: string }> = {
  DRAFT_READY: { tone: "slate", icon: <Bot size={chipIconSize} aria-hidden />, label: "Draft for human review" },
  REJECTED: { tone: "conflict", icon: <XCircle size={chipIconSize} aria-hidden />, label: "Rejected by validator" },
  ERROR: { tone: "conflict", icon: <XCircle size={chipIconSize} aria-hidden />, label: "Provider failed" },
};

export function AiRunStatusChip({ status }: { status: AiRunStatus }) {
  const c = AI_RUN_STATUS_CHIP[status];
  return (
    <Chip tone={c.tone} icon={c.icon}>
      {c.label}
    </Chip>
  );
}

export const AI_EVIDENCE_CHIP: Record<AiEvidenceStatus, { tone: ChipTone; icon: ReactNode; label: string }> = {
  TOOL_BACKED: { tone: "teal", icon: <CheckCircle2 size={chipIconSize} aria-hidden />, label: "Amounts from a receipted calculation" },
  UNVERIFIED: { tone: "neutral", icon: <Info size={chipIconSize} aria-hidden />, label: "Unverified draft" },
  HYPOTHESIS: { tone: "slate", icon: <Info size={chipIconSize} aria-hidden />, label: "Hypothesis" },
};

export function AiEvidenceChip({ status }: { status: AiEvidenceStatus }) {
  const c = AI_EVIDENCE_CHIP[status];
  return (
    <Chip tone={c.tone} icon={c.icon}>
      {c.label}
    </Chip>
  );
}

export const AI_FEEDBACK_CHIP: Record<AiFeedbackAction, { tone: ChipTone; label: string }> = {
  ACCEPT: { tone: "neutral", label: "Accepted as draft" },
  EDIT: { tone: "neutral", label: "Edited" },
  DISMISS: { tone: "neutral", label: "Dismissed" },
  REQUEST_EVIDENCE: { tone: "amber", label: "Evidence requested" },
};

export function AiFeedbackChip({ action, version, className }: { action: AiFeedbackAction; version?: number; className?: string }) {
  const c = AI_FEEDBACK_CHIP[action];
  return (
    <Chip tone={c.tone} className={className}>
      {c.label}
      {version != null && ` · v${version}`}
    </Chip>
  );
}

export const AI_PROVIDER_LABEL = "Deterministic offline mock";

export function AiProviderChip() {
  return (
    <Chip tone="slate" icon={<Bot size={chipIconSize} aria-hidden />}>
      {AI_PROVIDER_LABEL}
    </Chip>
  );
}
