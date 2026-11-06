import { CHECKPOINTS, checkpointReached, type WorkflowStatus } from "@sagespan/contracts";
import { Check } from "lucide-react";
import { cx } from "@/ui/primitives";

/**
 * Review checkpoints stepper (design system §3.10). The current step is the
 * furthest checkpoint the workflow has reached (`aria-current="step"`); text
 * never drops below the 12 px caption floor.
 */
export function Checkpoints({ status }: { status: WorkflowStatus }) {
  const reached = CHECKPOINTS.filter((c) => checkpointReached(status, c.key));
  const currentKey = reached.length ? reached[reached.length - 1]?.key : undefined;
  return (
    <ol className="flex flex-wrap items-center gap-x-1 gap-y-2" aria-label="Review checkpoints">
      {CHECKPOINTS.map((c, i) => {
        const done = checkpointReached(status, c.key);
        const current = c.key === currentKey;
        return (
          <li key={c.key} className="flex items-center gap-1" aria-current={current ? "step" : undefined}>
            <span className={cx("inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-0.5 text-caption font-semibold", done ? "border-teal/30 bg-teal-100 text-teal-700" : "border-line bg-surface text-ink-faint", current && "ring-2 ring-teal/30")}>
              <span className={cx("grid h-5 w-5 place-items-center rounded-pill text-caption tabular", done ? "bg-teal text-white" : "bg-surface-muted text-ink-faint")}>{done ? <Check size={12} aria-hidden /> : i + 1}</span>
              {c.label}
              <span className="sr-only">{current ? " (current)" : done ? " reached" : " not reached"}</span>
            </span>
            {i < CHECKPOINTS.length - 1 && <span className="h-px w-3 bg-line" aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}
