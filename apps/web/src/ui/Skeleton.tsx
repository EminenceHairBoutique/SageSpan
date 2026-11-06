import type { ReactNode } from "react";
import { cx } from "./cx";

/**
 * Loading placeholders (design system §2 #12) for App Router `loading.tsx`
 * files and for components that wait on the calculation service. Shapes only;
 * the pulse stops under `prefers-reduced-motion`.
 */
export type SkeletonShape = "text" | "title" | "chip" | "stat" | "row" | "block";

const shapeClasses: Record<SkeletonShape, string> = {
  text: "h-3.5 w-full rounded-inline",
  title: "h-6 w-2/5 rounded-inline",
  chip: "h-5 w-24 rounded-pill",
  stat: "h-8 w-32 rounded-inline",
  row: "h-10 w-full rounded-inline",
  block: "h-24 w-full rounded-control",
};

export function Skeleton({ shape = "text", className }: { shape?: SkeletonShape; className?: string }) {
  return <span aria-hidden="true" className={cx("block animate-pulse bg-surface-muted motion-reduce:animate-none", shapeClasses[shape], className)} />;
}

/** Wraps skeletons in one polite status region so assistive technology hears "Loading…" once, not once per shape. */
export function Loading({ label = "Loading…", children, className }: { label?: string; children: ReactNode; className?: string }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

export function SkeletonStat({ label }: { label?: string }) {
  return (
    <div className="rounded-card border border-line bg-surface p-4 shadow-card">
      {label ? <p className="text-eyebrow uppercase text-ink-muted">{label}</p> : <Skeleton shape="chip" className="w-20" />}
      <Skeleton shape="stat" className="mt-2" />
      <Skeleton shape="text" className="mt-2 w-3/5" />
    </div>
  );
}

export function SkeletonRows({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} shape="row" />
      ))}
    </div>
  );
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="rounded-card border border-line bg-surface p-(--card-padding) shadow-card">
      <Skeleton shape="title" />
      <div className="mt-4 space-y-2">
        {Array.from({ length: lines }, (_, i) => (
          <Skeleton key={i} shape="text" className={i === lines - 1 ? "w-2/3" : undefined} />
        ))}
      </div>
    </div>
  );
}
