import { Chip, type ChipTone } from "./Chip";

/**
 * Capability status vocabulary (design system §5.4, §6.10) for marketing and
 * in-app "what is built" markers. Never teal: that tone is reserved for
 * verified facts and stated successful acts.
 */
export const CAPABILITY_STATUSES = ["WORKING_SYNTHETIC", "WORKING_MOCK", "PROPOSED", "GATED", "NOT_IN_BUILD"] as const;
export type CapabilityStatus = (typeof CAPABILITY_STATUSES)[number];

export const CAPABILITY_CHIP: Record<CapabilityStatus, { tone: ChipTone; label: string }> = {
  WORKING_SYNTHETIC: { tone: "neutral", label: "Working (synthetic)" },
  WORKING_MOCK: { tone: "amber", label: "Working (offline mock)" },
  PROPOSED: { tone: "slate", label: "Proposed" },
  GATED: { tone: "slate", label: "Gated" },
  NOT_IN_BUILD: { tone: "neutral", label: "Not in this build" },
};

export function capabilityLabel(status: CapabilityStatus, gate?: string): string {
  if (status === "GATED") return `Gated (${gate ?? "G3/G4"})`;
  return CAPABILITY_CHIP[status].label;
}

export function CapabilityChip({ status, gate, className }: { status: CapabilityStatus; gate?: string; className?: string }) {
  return (
    <Chip tone={CAPABILITY_CHIP[status].tone} className={className}>
      {capabilityLabel(status, gate)}
    </Chip>
  );
}
