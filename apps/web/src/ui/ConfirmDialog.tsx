"use client";

import { useId, useRef, useState, useSyncExternalStore, useTransition, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import type { ActionResult } from "@/domain/errors";
import { Alert, buttonClasses } from "./primitives";
import { cx } from "./cx";

/**
 * Native <dialog> confirmation for destructive acts (design system §3.1):
 * names the object, focuses Cancel by default, keeps the result inline and
 * refreshes the route on success. The trigger is a plain button; the dialog
 * is portaled to document.body so it is valid wherever the trigger sits.
 */
export function ConfirmDialog({ trigger, triggerClassName, triggerAriaLabel, title, description, confirmLabel, cancelLabel = "Cancel", pendingLabel = "Working…", destructive = true, disabled, disabledReason, onConfirm }: { trigger: ReactNode; triggerClassName?: string; triggerAriaLabel?: string; title: string; description?: ReactNode; confirmLabel: string; cancelLabel?: string; pendingLabel?: string; destructive?: boolean; disabled?: boolean; disabledReason?: string; onConfirm: () => Promise<ActionResult<unknown> | void> | ActionResult<unknown> | void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const headingId = useId();
  const descriptionId = useId();
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const open = () => {
    setError(null);
    ref.current?.showModal();
    cancelRef.current?.focus();
  };
  const close = () => ref.current?.close();
  const confirm = () =>
    start(async () => {
      const result = await onConfirm();
      if (result && !result.ok) {
        setError({ code: result.code, message: result.message });
        return;
      }
      close();
      router.refresh();
    });

  const dialog = (
    <dialog ref={ref} className="m-auto w-[min(92vw,440px)] rounded-dialog border border-line bg-surface p-0 text-ink shadow-pop" aria-labelledby={headingId} aria-describedby={description ? descriptionId : undefined} onClose={() => setError(null)}>
      <div className="px-(--card-padding) py-(--card-padding-y)">
        <h2 id={headingId} className="text-h3 text-ink">
          {title}
        </h2>
        {description && (
          <p id={descriptionId} className="mt-2 text-support text-ink-muted">
            {description}
          </p>
        )}
        {error && (
          <Alert tone="conflict" title={`Not applied (${error.code})`} className="mt-3">
            {error.message}
          </Alert>
        )}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button ref={cancelRef} type="button" onClick={close} className={buttonClasses("secondary", "sm")} disabled={pending}>
            {cancelLabel}
          </button>
          <button type="button" onClick={confirm} className={buttonClasses(destructive ? "danger" : "primary", "sm")} disabled={pending} aria-disabled={pending}>
            {pending && <Loader2 size={14} className="animate-spin motion-reduce:animate-none" aria-hidden />}
            {pending ? pendingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );

  return (
    <>
      <button type="button" onClick={open} className={cx(triggerClassName)} aria-haspopup="dialog" aria-label={triggerAriaLabel} disabled={disabled} title={disabled ? disabledReason : undefined}>
        {trigger}
      </button>
      {disabled && disabledReason && <span className="ml-2 text-caption text-ink-muted">{disabledReason}</span>}
      {mounted ? createPortal(dialog, document.body) : null}
    </>
  );
}
