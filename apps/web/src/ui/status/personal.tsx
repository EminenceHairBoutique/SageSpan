import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, CircleHelp, Clock3, Info, PencilLine } from "lucide-react";
import { PERSONAL_DATA_STATE_LABELS, PRIORITY_LABELS, type PersonalDataState, type RecommendationPriority, type Severity, type UserDecisionKind } from "@sagespan/contracts";
import { humanize } from "../format";
import { Chip, chipIconSize, type ChipTone } from "./Chip";

/** Personal workspace status chips (design system §6.7–6.8). */

/* ---- 6.7 data state ---- */
const dataStateIcon: Record<PersonalDataState, ReactNode> = {
  USER_REPORTED: <PencilLine size={chipIconSize} aria-hidden />,
  EVIDENCE_VERIFIED: <CheckCircle2 size={chipIconSize} aria-hidden />,
  ASSUMED: <Info size={chipIconSize} aria-hidden />,
  MISSING: <CircleHelp size={chipIconSize} aria-hidden />,
  STALE: <Clock3 size={chipIconSize} aria-hidden />,
  CONFLICTING: <AlertTriangle size={chipIconSize} aria-hidden />,
};

export function dataStateTone(state: PersonalDataState, required = true): ChipTone {
  switch (state) {
    case "EVIDENCE_VERIFIED":
      return "teal";
    case "USER_REPORTED":
      return "neutral";
    case "ASSUMED":
      return "slate";
    case "STALE":
      return "amber";
    case "MISSING":
      return required ? "conflict" : "amber";
    case "CONFLICTING":
      return "conflict";
  }
}

/** `required` only changes the tone of MISSING (blocked when the value is needed, limitation when optional). */
export function DataStateChip({ state, required = true }: { state: PersonalDataState; required?: boolean }) {
  return (
    <Chip tone={dataStateTone(state, required)} icon={dataStateIcon[state]}>
      {PERSONAL_DATA_STATE_LABELS[state]}
    </Chip>
  );
}

/* ---- 6.8 severity ---- */
export const SEVERITY_CHIP: Record<Severity, { tone: ChipTone; label: string }> = {
  HIGH: { tone: "conflict", label: "High" },
  MEDIUM: { tone: "amber", label: "Medium" },
  LOW: { tone: "slate", label: "Low" },
  INFO: { tone: "neutral", label: "Note" },
};

export function SeverityChip({ severity }: { severity: Severity }) {
  return <Chip tone={SEVERITY_CHIP[severity].tone}>{SEVERITY_CHIP[severity].label}</Chip>;
}

/* ---- 6.8 recommendation priority: urgency is a limitation of time, not an error ---- */
export const PRIORITY_TONE: Record<RecommendationPriority, ChipTone> = {
  DO_THIS_NOW: "amber",
  CONSIDER_NEXT: "slate",
  REVISIT_LATER: "neutral",
};

export function PriorityChip({ priority }: { priority: RecommendationPriority }) {
  return <Chip tone={PRIORITY_TONE[priority]}>{PRIORITY_LABELS[priority]}</Chip>;
}

/* ---- 6.8 user decision: DONE is a stated act (verified tone); the others are neutral with the verb in text ---- */
export function DecisionChip({ decision, className }: { decision: UserDecisionKind; className?: string }) {
  return (
    <Chip tone={decision === "DONE" ? "teal" : "neutral"} icon={decision === "DONE" ? <CheckCircle2 size={chipIconSize} aria-hidden /> : undefined} className={className}>
      You: {humanize(decision)}
    </Chip>
  );
}
