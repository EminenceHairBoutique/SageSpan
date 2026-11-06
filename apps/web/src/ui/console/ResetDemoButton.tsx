"use client";

import type { ReactNode } from "react";
import type { ActionResult } from "@/domain/errors";
import { ConfirmDialog } from "@/ui/ConfirmDialog";
import { buttonClasses } from "@/ui/primitives";

/** Resets the synthetic demo state behind a native confirmation dialog (no `window.confirm`). */
export function ResetDemoButton({ action, children }: { action: () => Promise<ActionResult>; children: ReactNode }) {
  return (
    <ConfirmDialog
      trigger={children}
      triggerClassName={buttonClasses("secondary", "sm")}
      title="Reset the synthetic demo data?"
      description="Every household, import, check run, review and approval in this demo returns to the seeded fixtures. Any demo progress is discarded. No real data is involved."
      confirmLabel="Reset demo data"
      pendingLabel="Resetting…"
      onConfirm={action}
    />
  );
}
