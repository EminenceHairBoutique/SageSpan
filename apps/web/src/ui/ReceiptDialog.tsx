"use client";

import { useId, useRef, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Receipt, X } from "lucide-react";
import { cx } from "./primitives";

export interface ReceiptRow {
  label: string;
  value: ReactNode;
  mono?: boolean;
}

/**
 * Every displayed number can be clicked to open its receipt: the input it
 * came from, the source as-of date, the governing rule set and version, and
 * the formula. Rendered with the native <dialog> element for accessibility.
 * The dialog is portaled to document.body so a trigger placed inside a <p>
 * or <button> never nests the dialog in invalid markup.
 */
export function ReceiptButton({ children, title, subtitle, rows, className, sections }: { children: ReactNode; title: string; subtitle?: string; rows: ReceiptRow[]; className?: string; sections?: Array<{ heading: string; rows: ReceiptRow[] }> }) {
  const ref = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  // false during SSR and hydration, true once the component is live in the browser
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const dialog = (
    <dialog ref={ref} className="m-auto w-[min(92vw,680px)] rounded-card border border-line bg-surface p-0 text-ink shadow-pop" aria-labelledby={headingId}>
      <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
        <div>
          <h3 id={headingId} className="text-base font-semibold">
            {title}
          </h3>
          {subtitle && <p className="mt-0.5 text-sm text-ink-muted">{subtitle}</p>}
        </div>
        <form method="dialog">
          <button className="rounded p-1 text-ink-muted hover:bg-surface-muted" aria-label="Close">
            <X size={18} />
          </button>
        </form>
      </div>
      <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
        <ReceiptTable rows={rows} />
        {sections?.map((s) => (
          <div key={s.heading} className="mt-4">
            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">{s.heading}</h4>
            <ReceiptTable rows={s.rows} />
          </div>
        ))}
      </div>
    </dialog>
  );
  return (
    <>
      <button type="button" onClick={() => ref.current?.showModal()} className={cx("inline-flex items-center gap-1 rounded border-b border-dotted border-navy/60 text-left font-semibold text-navy hover:bg-navy-100", className)} aria-haspopup="dialog" title="Open receipt">
        {children}
        <Receipt size={13} className="text-ink-faint" aria-hidden />
      </button>
      {mounted ? createPortal(dialog, document.body) : null}
    </>
  );
}

function ReceiptTable({ rows }: { rows: ReceiptRow[] }) {
  return (
    <dl className="grid grid-cols-[max-content_1fr] gap-x-5 gap-y-1.5 text-sm">
      {rows.map((r, i) => (
        <div key={i} className="contents">
          <dt className="text-ink-muted">{r.label}</dt>
          <dd className={cx("min-w-0 break-words", r.mono && "font-mono text-[12px]")}>{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}
