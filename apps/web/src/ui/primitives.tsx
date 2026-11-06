import Link from "next/link";
import type { ReactNode } from "react";
import { AlertTriangle, BookmarkCheck, CheckCircle2, CircleHelp, Info, Lock, ShieldAlert, XCircle } from "lucide-react";
import { DISCREPANCY_LABELS, FACT_STATUS_LABELS, WORKFLOW_LABELS, type DiscrepancyClassification, type FactStatus, type WorkflowStatus } from "@sagespan/contracts";

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

type Tone = "teal" | "amber" | "slate" | "conflict" | "navy" | "neutral";

const toneClasses: Record<Tone, string> = {
  teal: "bg-teal-100 text-teal-700 border-teal-700/20",
  amber: "bg-amber-100 text-amber-700 border-amber-700/20",
  slate: "bg-slate-100 text-slate-700 border-slate-700/20",
  conflict: "bg-conflict-100 text-conflict-700 border-conflict-700/20",
  navy: "bg-navy-100 text-navy border-navy/20",
  neutral: "bg-surface-muted text-ink-muted border-line",
};

export function Chip({ tone = "neutral", icon, children, className, title }: { tone?: Tone; icon?: ReactNode; children: ReactNode; className?: string; title?: string }) {
  return (
    <span title={title} className={cx("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap", toneClasses[tone], className)}>
      {icon}
      {children}
    </span>
  );
}

const iconSize = 13;

export function FactStatusChip({ status }: { status: FactStatus }) {
  const map: Record<FactStatus, { tone: Tone; icon: ReactNode }> = {
    FACT_CONFIRMED: { tone: "teal", icon: <CheckCircle2 size={iconSize} aria-hidden /> },
    FACT_ASSUMED: { tone: "slate", icon: <BookmarkCheck size={iconSize} aria-hidden /> },
    NEEDS_CONFIRMATION: { tone: "amber", icon: <CircleHelp size={iconSize} aria-hidden /> },
    FACT_CONFLICT: { tone: "conflict", icon: <AlertTriangle size={iconSize} aria-hidden /> },
  };
  return (
    <Chip tone={map[status].tone} icon={map[status].icon}>
      {FACT_STATUS_LABELS[status]}
    </Chip>
  );
}

export function WorkflowChip({ status }: { status: WorkflowStatus }) {
  const tone: Record<WorkflowStatus, Tone> = {
    IMPORT_DRAFT: "slate",
    MAPPED: "slate",
    RECONCILIATION_PENDING: "slate",
    BLOCKED: "conflict",
    READY_TO_FREEZE: "teal",
    FROZEN: "navy",
    CHECK_COMPLETE: "navy",
    REVIEW_PENDING: "amber",
    REVIEWED: "slate",
    APPROVED: "teal",
    EXPORTED: "teal",
  };
  const icon = status === "BLOCKED" ? <ShieldAlert size={iconSize} aria-hidden /> : status === "FROZEN" ? <Lock size={iconSize} aria-hidden /> : status === "APPROVED" || status === "EXPORTED" ? <CheckCircle2 size={iconSize} aria-hidden /> : <Info size={iconSize} aria-hidden />;
  return (
    <Chip tone={tone[status]} icon={icon}>
      {WORKFLOW_LABELS[status]}
    </Chip>
  );
}

export function ResultChip({ status }: { status: "PASS" | "NOT_REQUIRED" | "UNSUPPORTED" | "INDETERMINATE" | "ERROR" }) {
  const map: Record<typeof status, { tone: Tone; icon: ReactNode; label: string }> = {
    PASS: { tone: "teal", icon: <CheckCircle2 size={iconSize} aria-hidden />, label: "Arithmetic PASS" },
    NOT_REQUIRED: { tone: "slate", icon: <Info size={iconSize} aria-hidden />, label: "Not required" },
    UNSUPPORTED: { tone: "amber", icon: <AlertTriangle size={iconSize} aria-hidden />, label: "Unsupported" },
    INDETERMINATE: { tone: "amber", icon: <CircleHelp size={iconSize} aria-hidden />, label: "Indeterminate" },
    ERROR: { tone: "conflict", icon: <XCircle size={iconSize} aria-hidden />, label: "Service error" },
  };
  return (
    <Chip tone={map[status].tone} icon={map[status].icon}>
      {map[status].label}
    </Chip>
  );
}

export function ClassificationChip({ classification }: { classification: DiscrepancyClassification }) {
  const tone: Record<DiscrepancyClassification, Tone> = {
    WITHIN_TOLERANCE: "teal",
    SOURCE_CONFLICT: "conflict",
    RULE_DISAGREEMENT: "conflict",
    STALE_INPUT: "amber",
    MISSING_EVIDENCE: "amber",
    UNSUPPORTED_CHECK: "amber",
    METHODOLOGY_DIFFERENCE: "slate",
    NOT_COMPARABLE: "slate",
  };
  return (
    <Chip tone={tone[classification]} icon={tone[classification] === "teal" ? <CheckCircle2 size={iconSize} aria-hidden /> : tone[classification] === "conflict" ? <AlertTriangle size={iconSize} aria-hidden /> : <Info size={iconSize} aria-hidden />}>
      {DISCREPANCY_LABELS[classification]}
    </Chip>
  );
}

export function Card({ children, className, title, subtitle, actions, id }: { children: ReactNode; className?: string; title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode; id?: string }) {
  return (
    <section id={id} className={cx("rounded-card border border-line bg-surface shadow-card", className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            {title && <h2 className="text-base font-semibold text-ink">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-sm text-ink-muted">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

export const buttonClasses = (variant: "primary" | "secondary" | "ghost" | "danger" = "primary", size: "sm" | "md" | "lg" = "md") =>
  cx(
    "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
    size === "sm" ? "px-3 py-1.5 text-sm" : size === "lg" ? "px-5 py-3 text-base" : "px-4 py-2 text-sm",
    variant === "primary" && "bg-navy text-white hover:bg-navy-700",
    variant === "secondary" && "border border-line-strong bg-surface text-ink hover:bg-surface-muted",
    variant === "ghost" && "text-navy hover:bg-navy-100",
    variant === "danger" && "bg-conflict text-white hover:bg-conflict-700",
  );

export function ButtonLink({ href, children, variant = "primary", size = "md", className }: { href: string; children: ReactNode; variant?: "primary" | "secondary" | "ghost" | "danger"; size?: "sm" | "md" | "lg"; className?: string }) {
  return (
    <Link href={href} className={cx(buttonClasses(variant, size), className)}>
      {children}
    </Link>
  );
}

export function Alert({ tone = "amber", title, children, className }: { tone?: Tone; title?: ReactNode; children?: ReactNode; className?: string }) {
  const Icon = tone === "teal" ? CheckCircle2 : tone === "conflict" ? XCircle : tone === "slate" || tone === "navy" ? Info : AlertTriangle;
  return (
    <div role={tone === "conflict" ? "alert" : "status"} className={cx("flex gap-3 rounded-lg border px-4 py-3 text-sm", toneClasses[tone], className)}>
      <Icon size={18} className="mt-0.5 shrink-0" aria-hidden />
      <div className="min-w-0">
        {title && <div className="font-semibold">{title}</div>}
        {children && <div className={cx(title ? "mt-0.5" : null, "text-[13px] leading-relaxed")}>{children}</div>}
      </div>
    </div>
  );
}

export function KeyValue({ rows, className }: { rows: Array<{ k: ReactNode; v: ReactNode }>; className?: string }) {
  return (
    <dl className={cx("grid grid-cols-[max-content_1fr] gap-x-6 gap-y-1.5 text-sm", className)}>
      {rows.map((r, i) => (
        <div key={i} className="contents">
          <dt className="text-ink-muted">{r.k}</dt>
          <dd className="min-w-0 break-words text-ink">{r.v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return <code className={cx("rounded bg-surface-muted px-1 py-0.5 font-mono text-[12px] break-all", className)}>{children}</code>;
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-line-strong bg-surface-muted/50 px-6 py-8 text-center">
      <p className="font-semibold text-ink">{title}</p>
      {children && <p className="mt-1 text-sm text-ink-muted">{children}</p>}
    </div>
  );
}

export function Field({ label, children, hint, required }: { label: string; children: ReactNode; hint?: ReactNode; required?: boolean }) {
  return (
    <label className="block text-sm">
      <span className="font-medium text-ink">
        {label}
        {required && <span className="text-conflict"> *</span>}
      </span>
      <div className="mt-1">{children}</div>
      {hint && <span className="mt-1 block text-xs text-ink-muted">{hint}</span>}
    </label>
  );
}

export const inputClasses = "w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-teal focus:outline-none";

export function Th({ children, className, align }: { children?: ReactNode; className?: string; align?: "right" }) {
  return <th className={cx("px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-ink-muted", align === "right" && "text-right", className)}>{children}</th>;
}

export function Td({ children, className, align }: { children?: ReactNode; className?: string; align?: "right" }) {
  return <td className={cx("px-3 py-2.5 align-top text-sm", align === "right" && "text-right tabular", className)}>{children}</td>;
}

export function SectionHeading({ eyebrow, title, children }: { eyebrow?: string; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-6">
      {eyebrow && <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-teal">{eyebrow}</p>}
      <h2 className="text-2xl font-bold text-ink md:text-3xl">{title}</h2>
      {children && <p className="mt-3 max-w-2xl text-base text-ink-muted">{children}</p>}
    </div>
  );
}
