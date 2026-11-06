"use client";

import { useId, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Copy, Receipt, X } from "lucide-react";
import { cx } from "./cx";

export interface ReceiptRow {
  label: string;
  value: ReactNode;
  mono?: boolean;
  /** Text placed on the clipboard by the row's Copy button; defaults to a string `value`. */
  copy?: string;
}

/**
 * Every displayed number can be clicked to open its receipt: the input it
 * came from, the source as-of date, the governing rule set and version, and
 * the formula. Rendered with the native <dialog> element for accessibility.
 * The dialog is portaled to document.body so a trigger placed inside a <p>
 * or <button> never nests the dialog in invalid markup. Mono values (hashes,
 * ids, formulas) carry a Copy button; "Copied" is announced once through a
 * single role="status" region per dialog.
 */
export function ReceiptButton({ children, title, subtitle, rows, className, sections }: { children: ReactNode; title: string; subtitle?: string; rows: ReceiptRow[]; className?: string; sections?: Array<{ heading: string; rows: ReceiptRow[] }> }) {
  const ref = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const subtitleId = useId();
  const [copied, setCopied] = useState<string | null>(null);
  // false during SSR and hydration, true once the component is live in the browser
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const copy = async (row: ReceiptRow) => {
    const text = row.copy ?? (typeof row.value === "string" ? row.value : null);
    if (text == null) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(row.label);
    } catch {
      setCopied(null);
    }
  };
  const dialog = (
    <dialog ref={ref} className="m-auto w-[min(92vw,680px)] rounded-dialog border border-line bg-surface p-0 text-ink shadow-pop" aria-labelledby={headingId} aria-describedby={subtitle ? subtitleId : undefined} onClose={() => setCopied(null)}>
      <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
        <div>
          <h3 id={headingId} className="text-h3">
            {title}
          </h3>
          {subtitle && (
            <p id={subtitleId} className="mt-0.5 text-support text-ink-muted">
              {subtitle}
            </p>
          )}
        </div>
        <form method="dialog">
          <button className="rounded-inline p-1 text-ink-muted hover:bg-surface-muted" aria-label="Close">
            <X size={18} />
          </button>
        </form>
      </div>
      <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
        <ReceiptTable rows={rows} onCopy={copy} />
        {sections?.map((s) => (
          <section key={s.heading} className="mt-4" aria-label={s.heading}>
            <h4 className="mb-1 text-eyebrow uppercase text-ink-muted">{s.heading}</h4>
            <ReceiptTable rows={s.rows} onCopy={copy} />
          </section>
        ))}
        <p role="status" aria-live="polite" className={cx("mt-3 text-caption text-teal-700", !copied && "sr-only")}>
          {copied ? `Copied ${copied}` : ""}
        </p>
      </div>
    </dialog>
  );
  return (
    <>
      <button type="button" onClick={() => ref.current?.showModal()} className={cx("inline-flex items-center gap-1 rounded-inline border-b border-dotted border-link/60 text-left font-semibold text-link hover:bg-navy-50 hover:text-link-hover", className)} aria-haspopup="dialog" title="Open receipt">
        {children}
        <Receipt size={13} className="text-ink-faint" aria-hidden />
      </button>
      {mounted ? createPortal(dialog, document.body) : null}
    </>
  );
}

function ReceiptTable({ rows, onCopy }: { rows: ReceiptRow[]; onCopy: (row: ReceiptRow) => void }) {
  return (
    <dl className="grid grid-cols-1 gap-x-5 text-sm sm:grid-cols-[max-content_1fr] sm:gap-y-1.5">
      {rows.map((r, i) => {
        const copyable = r.copy != null || (r.mono && typeof r.value === "string" && r.value !== "—");
        return (
          <div key={i} className="contents">
            <dt className="text-ink-muted">{r.label}</dt>
            <dd className={cx("mb-2 min-w-0 break-words sm:mb-0", r.mono && "font-mono text-mono")}>
              {r.mono ? <span className="rounded-inline bg-surface-sunken px-1 py-0.5">{r.value}</span> : r.value}
              {copyable && (
                <button type="button" onClick={() => onCopy(r)} className="ml-2 inline-flex items-center gap-1 rounded-inline px-1 py-0.5 font-sans text-caption font-semibold text-link hover:bg-navy-50" aria-label={`Copy ${r.label}`}>
                  <Copy size={12} aria-hidden /> Copy
                </button>
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
