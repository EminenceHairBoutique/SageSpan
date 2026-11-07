import type { ReactNode } from "react";
import { Alert, type NoticeRole } from "./primitives";
import type { ChipTone } from "./status/Chip";

/**
 * One component, one copy source for the three honest service states
 * (design system §2 #13): the calculation service cannot be reached, the AI
 * provider is the deterministic offline mock, the production data store is
 * not wired. Nothing here is a footer disclaimer; it renders where the
 * affected figures would be.
 */
export type ServiceStateKind = "calculator-unreachable" | "ai-offline-mock" | "store-not-wired";

export const SERVICE_STATE_COPY: Record<ServiceStateKind, { tone: ChipTone; role: NoticeRole; title: string; body: string }> = {
  "calculator-unreachable": {
    tone: "conflict",
    role: "alert",
    title: "Calculation service unreachable",
    body: "No figure on this page can be computed or re-verified until the calculation service answers. Nothing is estimated in the browser.",
  },
  "ai-offline-mock": {
    tone: "slate",
    role: "note",
    title: "AI provider: deterministic offline mock",
    body: "Drafts come from a scripted, deterministic mock, not a live model. They are proposals for human review, never verified facts or advice.",
  },
  "store-not-wired": {
    tone: "amber",
    role: "note",
    title: "Production data store not wired",
    body: "This build reads synthetic demo state from a local file. No real account, bank, custodian or client data is connected.",
  },
};

export function ServiceState({ kind, detail, action, className }: { kind: ServiceStateKind; detail?: ReactNode; action?: ReactNode; className?: string }) {
  const c = SERVICE_STATE_COPY[kind];
  return (
    <Alert tone={c.tone} role={c.role} title={c.title} actions={action} className={className}>
      {c.body}
      {detail && <span className="mt-1 block">{detail}</span>}
    </Alert>
  );
}
