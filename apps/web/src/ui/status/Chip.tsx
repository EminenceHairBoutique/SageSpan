import type { ReactNode } from "react";
import { cx } from "../cx";

/**
 * Base status chip (design system §3.2). Text + icon + colour, never colour
 * alone. Typed chips in this folder map enum values to a tone and a label; the
 * labels come from `@sagespan/contracts` label maps wherever one exists.
 */
export type ChipTone = "teal" | "amber" | "slate" | "conflict" | "navy" | "neutral";

/** Semantic status tone (§6 matrix) → chip colour tone. */
export type StatusTone = "verified" | "limitation" | "blocked" | "assumed" | "neutral" | "exceptions";

export const STATUS_TONE: Record<StatusTone, ChipTone> = {
  verified: "teal",
  limitation: "amber",
  blocked: "conflict",
  assumed: "slate",
  neutral: "neutral",
  exceptions: "navy",
};

export const toneClasses: Record<ChipTone, string> = {
  teal: "bg-teal-100 text-teal-700 border-teal-700/20",
  amber: "bg-amber-100 text-amber-700 border-amber-700/20",
  slate: "bg-slate-100 text-slate-700 border-slate-700/20",
  conflict: "bg-conflict-100 text-conflict-700 border-conflict-700/20",
  navy: "bg-navy-100 text-navy border-navy/20",
  neutral: "bg-surface-muted text-ink-muted border-line",
};

/** History style: dashed border, faint text and the word "earlier" in the label; never opacity alone. */
export const historyClasses = "border-dashed border-line-strong bg-surface text-ink-faint";

export const chipIconSize = 14;

export function Chip({ tone = "neutral", icon, children, className, title, history }: { tone?: ChipTone; icon?: ReactNode; children: ReactNode; className?: string; title?: string; history?: boolean }) {
  return (
    <span title={title} className={cx("inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-0.5 text-caption font-semibold whitespace-nowrap", history ? historyClasses : toneClasses[tone], className)}>
      {icon}
      {history && <span className="font-medium">earlier ·</span>}
      {children}
    </span>
  );
}
