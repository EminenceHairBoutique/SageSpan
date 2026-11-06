/**
 * Typed status chips (design system §6). One label, one tone, one icon per
 * enum value, with labels from `@sagespan/contracts` wherever a label map
 * exists. `primitives.tsx` and `personal/components.tsx` re-export the chips
 * they used to define, so existing imports keep working.
 */
export { Chip, STATUS_TONE, type ChipTone, type StatusTone } from "./Chip";
export { ClassificationChip, COVERAGE_CHIP, CoverageChip, FACT_STATUS_QUALIFIERS, FactStatusChip, OUTCOME_NOT_APPROVED_LABEL, OutcomeChip, RECEIPT_INTEGRITY_CHIP, ReceiptIntegrityChip, RESULT_CHIP, ResultChip, WorkflowChip, type RunResultStatus } from "./assurance";
export { DataStateChip, DecisionChip, dataStateTone, PRIORITY_TONE, PriorityChip, SEVERITY_CHIP, SeverityChip } from "./personal";
export { AI_EVIDENCE_CHIP, AI_FEEDBACK_CHIP, AI_PROVIDER_LABEL, AI_RUN_STATUS_CHIP, AiEvidenceChip, AiFeedbackChip, AiProviderChip, AiRunStatusChip, type AiRunStatus } from "./ai";
export { CAPABILITY_CHIP, CAPABILITY_STATUSES, CapabilityChip, capabilityLabel, type CapabilityStatus } from "./capability";
