import { CHECKPOINTS, checkpointReached, type WorkflowStatus } from "@sagespan/contracts";
import { Check } from "lucide-react";
import { cx } from "@/ui/primitives";

export function Checkpoints({ status }: { status: WorkflowStatus }) {
  return (
    <ol className="flex flex-wrap items-center gap-x-1 gap-y-2" aria-label="Review checkpoints">
      {CHECKPOINTS.map((c, i) => {
        const done = checkpointReached(status, c.key);
        return (
          <li key={c.key} className="flex items-center gap-1">
            <span className={cx("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold", done ? "border-teal/30 bg-teal-100 text-teal-700" : "border-line bg-surface text-ink-faint")}>
              <span className={cx("grid h-4 w-4 place-items-center rounded-full text-[10px]", done ? "bg-teal text-white" : "bg-surface-muted text-ink-faint")}>{done ? <Check size={10} aria-hidden /> : i + 1}</span>
              {c.label}
              <span className="sr-only">{done ? " reached" : " not reached"}</span>
            </span>
            {i < CHECKPOINTS.length - 1 && <span className="h-px w-3 bg-line" aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}
