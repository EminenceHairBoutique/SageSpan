"use client";

import { useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { ActionResult } from "@/domain/errors";
import { buttonClasses } from "@/ui/primitives";

export function ResetDemoButton({ action, children }: { action: () => Promise<ActionResult>; children: ReactNode }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button
      type="button"
      disabled={pending}
      className={buttonClasses("secondary", "sm")}
      onClick={() => {
        if (!window.confirm("Reset all synthetic demo data to the seeded fixtures? Any demo progress is discarded.")) return;
        start(async () => {
          await action();
          router.refresh();
        });
      }}
    >
      {pending ? "Resetting…" : children}
    </button>
  );
}
