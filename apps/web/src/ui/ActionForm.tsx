"use client";

import { useActionState, useEffect, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import type { ActionResult } from "@/domain/errors";
import { Alert, buttonClasses, cx } from "./primitives";

type Action<T> = (prev: ActionResult<T> | null, formData: FormData) => Promise<ActionResult<T>>;

export function SubmitButton({ children, pendingLabel, variant = "primary", size = "md", disabled, className, title }: { children: ReactNode; pendingLabel?: string; variant?: "primary" | "secondary" | "ghost" | "danger"; size?: "sm" | "md" | "lg"; disabled?: boolean; className?: string; title?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={disabled || pending} title={title} className={cx(buttonClasses(variant, size), className)} aria-disabled={disabled || pending}>
      {pending && <Loader2 size={16} className="animate-spin" aria-hidden />}
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}

/**
 * Generic server-action form with inline result reporting. Hidden fields are
 * convenience only: the server re-derives the actor and re-validates every id
 * against the actor's organisation, so forged values are rejected there.
 */
export function ActionForm<T>({ action, hidden, children, submitLabel, pendingLabel, variant, size, disabled, disabledReason, successMessage, className, inline, onSuccess }: { action: Action<T>; hidden?: Record<string, string>; children?: ReactNode; submitLabel: ReactNode; pendingLabel?: string; variant?: "primary" | "secondary" | "ghost" | "danger"; size?: "sm" | "md" | "lg"; disabled?: boolean; disabledReason?: string; successMessage?: string | ((data: T) => string); className?: string; inline?: boolean; onSuccess?: (data: T) => void }) {
  const [state, formAction] = useActionState(action, null);
  const router = useRouter();
  useEffect(() => {
    if (state?.ok) {
      router.refresh();
      onSuccess?.(state.data);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  return (
    <form action={formAction} className={cx(inline ? "inline-flex flex-col gap-2" : "space-y-3", className)}>
      {hidden && Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      {children}
      <div className={cx("flex flex-wrap items-center gap-3", inline && "flex-col items-start")}>
        <SubmitButton variant={variant} size={size} disabled={disabled} title={disabled ? disabledReason : undefined} pendingLabel={pendingLabel}>
          {submitLabel}
        </SubmitButton>
        {disabled && disabledReason && <span className="text-xs text-ink-muted">{disabledReason}</span>}
      </div>
      {state && !state.ok && (
        <Alert tone="conflict" title={`Not applied (${state.code})`}>
          {state.message}
        </Alert>
      )}
      {state?.ok && (successMessage || state.message) && (
        <Alert tone="teal">{typeof successMessage === "function" ? successMessage(state.data) : (successMessage ?? state.message)}</Alert>
      )}
    </form>
  );
}
