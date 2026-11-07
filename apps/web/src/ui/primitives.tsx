import Link from "next/link";
import { cloneElement, isValidElement, useId, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cx } from "./cx";
import { toneClasses, type ChipTone } from "./status/Chip";

/**
 * Shared presentation primitives. Every export and prop that existed before
 * UI-001a keeps working (PR #10 imports Alert, Card, Chip, EmptyState, Field,
 * KeyValue, buttonClasses, inputClasses); additions are optional props.
 * Tokens live in app/globals.css; typed status chips live in ui/status and are
 * re-exported here so no import breaks.
 */
export { cx } from "./cx";
export * from "./status";

type Tone = ChipTone;

/* ------------------------------------------------------------------ Card */

export type CardTone = "neutral" | "teal" | "amber" | "conflict" | "navy" | "slate";
export type Density = "comfortable" | "compact";

const cardToneBorder: Record<CardTone, string> = {
  neutral: "border-line",
  teal: "border-teal/40",
  amber: "border-amber/40",
  conflict: "border-conflict/40",
  navy: "border-navy/40",
  slate: "border-slate/40",
};

type HeadingTag = "h1" | "h2" | "h3" | "h4";

export function Card({ children, className, title, subtitle, actions, id, headingLevel = 2, tone = "neutral", density, footer, bodyClassName }: { children: ReactNode; className?: string; title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode; id?: string; headingLevel?: 2 | 3 | 4; tone?: CardTone; density?: Density; footer?: ReactNode; bodyClassName?: string }) {
  const Heading: HeadingTag = `h${headingLevel}`;
  return (
    <section id={id} data-density={density} className={cx("rounded-card border bg-surface shadow-card", cardToneBorder[tone], className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-(--card-padding) py-(--card-padding-y)">
          <div className="min-w-0">
            {title && <Heading className="text-h3 text-ink">{title}</Heading>}
            {subtitle && <p className="mt-0.5 text-support text-ink-muted">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cx("px-(--card-padding) py-(--card-padding-y)", bodyClassName)}>{children}</div>
      {footer && <footer className="border-t border-line px-(--card-padding) py-3 text-support text-ink-muted">{footer}</footer>}
    </section>
  );
}

/** A heading row with a divider and no elevation: groups content inside a card or on the canvas (never a card inside a card). */
export function Section({ children, className, title, subtitle, actions, id, headingLevel = 2 }: { children: ReactNode; className?: string; title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; id?: string; headingLevel?: 2 | 3 | 4 }) {
  const Heading: HeadingTag = `h${headingLevel}`;
  return (
    <section id={id} className={className}>
      <header className="mb-3 flex flex-wrap items-end justify-between gap-3 border-b border-line pb-2">
        <div className="min-w-0">
          <Heading className="text-h2 text-ink">{title}</Heading>
          {subtitle && <p className="mt-0.5 text-support text-ink-muted">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </header>
      {children}
    </section>
  );
}

/* --------------------------------------------------------------- Buttons */

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export const buttonClasses = (variant: ButtonVariant = "primary", size: ButtonSize = "md") =>
  cx(
    "inline-flex items-center justify-center gap-2 rounded-control font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
    size === "sm" ? "px-3 py-1.5 text-sm" : size === "lg" ? "px-5 py-3 text-base" : "px-4 py-2 text-sm",
    variant === "primary" && "bg-navy text-white hover:bg-navy-700",
    variant === "secondary" && "border border-line-strong bg-surface text-ink hover:bg-surface-muted",
    variant === "ghost" && "text-link hover:bg-navy-50 hover:text-link-hover",
    variant === "danger" && "bg-conflict text-white hover:bg-conflict-700",
  );

export function ButtonLink({ href, children, variant = "primary", size = "md", className }: { href: string; children: ReactNode; variant?: ButtonVariant; size?: ButtonSize; className?: string }) {
  return (
    <Link href={href} className={cx(buttonClasses(variant, size), className)}>
      {children}
    </Link>
  );
}

/* ---------------------------------------------------------------- Notice */

export type NoticeRole = "alert" | "status" | "note";

/** `alert` only for blocked/error, `status` for success confirmations after an action, `note` for persistent information. */
export function alertRole(tone: Tone): NoticeRole {
  return tone === "conflict" ? "alert" : tone === "teal" ? "status" : "note";
}

export function Alert({ tone = "amber", title, children, className, actions, role }: { tone?: Tone; title?: ReactNode; children?: ReactNode; className?: string; actions?: ReactNode; role?: NoticeRole }) {
  const Icon = tone === "teal" ? CheckCircle2 : tone === "conflict" ? XCircle : tone === "slate" || tone === "navy" || tone === "neutral" ? Info : AlertTriangle;
  return (
    <div role={role ?? alertRole(tone)} className={cx("flex gap-3 rounded-control border px-4 py-3 text-sm", toneClasses[tone], className)}>
      <Icon size={18} className="mt-0.5 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        {title && <div className="font-semibold">{title}</div>}
        {children && <div className={cx(title ? "mt-0.5" : null, "text-support leading-relaxed")}>{children}</div>}
        {actions && <div className="mt-2 flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

/** Design-system name for `Alert`; same component. */
export const Notice = Alert;

/* -------------------------------------------------------------- KeyValue */

/** Definition list; stacks label over value below `sm` instead of forcing a two-column grid onto narrow screens. */
export function KeyValue({ rows, className }: { rows: Array<{ k: ReactNode; v: ReactNode; mono?: boolean }>; className?: string }) {
  return (
    <dl className={cx("grid grid-cols-1 gap-x-6 text-sm sm:grid-cols-[max-content_1fr] sm:gap-y-1.5", className)}>
      {rows.map((r, i) => (
        <div key={i} className="contents">
          <dt className="text-ink-muted">{r.k}</dt>
          <dd className={cx("mb-2 min-w-0 break-words text-ink sm:mb-0", r.mono && "font-mono text-mono")}>{r.v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Mono({ children, className, title }: { children: ReactNode; className?: string; title?: string }) {
  return (
    <code title={title} className={cx("rounded-inline bg-surface-muted px-1 py-0.5 font-mono text-mono break-all", className)}>
      {children}
    </code>
  );
}

/* ------------------------------------------------------------ EmptyState */

export const EMPTY_STATE_REASONS = {
  "no-data": "Nothing has been recorded yet.",
  filtered: "No rows match the current filter.",
  "not-computed": "Not computed yet.",
  "not-available": "Not available in this build.",
} as const;
export type EmptyStateReason = keyof typeof EMPTY_STATE_REASONS;

export function EmptyState({ title, children, action, reason, className }: { title: string; children?: ReactNode; action?: ReactNode; reason?: EmptyStateReason; className?: string }) {
  return (
    <div className={cx("rounded-control border border-dashed border-line-strong bg-surface-muted/50 px-6 py-8 text-center", className)}>
      <p className="font-semibold text-ink">{title}</p>
      {children && <p className="mt-1 text-sm text-ink-muted">{children}</p>}
      {reason && <p className="mt-1 text-caption text-ink-faint">{EMPTY_STATE_REASONS[reason]}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

/* ----------------------------------------------------------------- Field */

type ControlProps = { "aria-invalid"?: boolean | "true" | "false"; "aria-describedby"?: string };

/**
 * Label above, hint and error below. `required` adds a visible "(required)".
 * With `error`, the single child control receives `aria-invalid` and an
 * `aria-describedby` pointing at the message (and the hint, when present);
 * a child that is not a single element is left untouched and the wrapper
 * carries `data-invalid` for styling.
 */
export function Field({ label, children, hint, required, error, className }: { label: string; children: ReactNode; hint?: ReactNode; required?: boolean; error?: ReactNode; className?: string }) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = cx(hintId, errorId) || undefined;
  let control = children;
  if (describedBy && isValidElement<ControlProps>(children)) {
    const previous = children.props["aria-describedby"];
    control = cloneElement(children, {
      "aria-describedby": cx(previous, describedBy),
      ...(error ? { "aria-invalid": true } : {}),
    });
  }
  return (
    <label className={cx("block text-sm", className)}>
      <span className="font-medium text-ink">
        {label}
        {required && (
          <>
            <span aria-hidden="true" className="text-conflict">
              {" "}
              *
            </span>
            <span className="font-normal text-ink-muted"> (required)</span>
          </>
        )}
      </span>
      <div className="mt-1" data-invalid={error ? "true" : undefined}>
        {control}
      </div>
      {hint && (
        <span id={hintId} className="mt-1 block text-caption text-ink-muted">
          {hint}
        </span>
      )}
      {error && (
        <span id={errorId} className="mt-1 block text-caption font-medium text-conflict-700">
          {error}
        </span>
      )}
    </label>
  );
}

export const inputClasses = "w-full rounded-input border border-line-input bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-teal aria-invalid:border-conflict";

/* ----------------------------------------------------------------- Table */

export function Th({ children, className, align, scope = "col", colSpan }: { children?: ReactNode; className?: string; align?: "right"; scope?: "col" | "row" | "colgroup" | "rowgroup"; colSpan?: number }) {
  return (
    <th scope={scope} colSpan={colSpan} className={cx("px-3 py-2 text-left text-eyebrow uppercase text-ink-muted", align === "right" && "text-right", className)}>
      {children}
    </th>
  );
}

export function Td({ children, className, align, colSpan }: { children?: ReactNode; className?: string; align?: "right"; colSpan?: number }) {
  return (
    <td colSpan={colSpan} className={cx("px-3 py-(--row-padding-y) align-top text-sm", align === "right" && "text-right tabular", className)}>
      {children}
    </td>
  );
}

/* -------------------------------------------------------- SectionHeading */

export function SectionHeading({ eyebrow, title, children, level = 2, className }: { eyebrow?: string; title: ReactNode; children?: ReactNode; level?: 1 | 2 | 3; className?: string }) {
  const Heading: HeadingTag = `h${level}`;
  return (
    <div className={cx("mb-6", className)}>
      {eyebrow && <p className="mb-2 text-eyebrow uppercase text-teal">{eyebrow}</p>}
      <Heading className="text-2xl font-bold text-ink md:text-3xl">{title}</Heading>
      {children && <p className="mt-3 max-w-2xl text-base text-ink-muted">{children}</p>}
    </div>
  );
}
