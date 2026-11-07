"use client";

import { createContext, useActionState, useContext, useEffect, useMemo, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import type { ActionResult } from "@/domain/errors";
import { fieldLabel, parseFieldErrors } from "./fieldErrors";
import { Alert, buttonClasses, cx, type ButtonSize, type ButtonVariant } from "./primitives";

type Action<T> = (prev: ActionResult<T> | null, formData: FormData) => Promise<ActionResult<T>>;

const FieldErrorsContext = createContext<Record<string, string>>({});

/** Field-level message for `path` from the enclosing ActionForm's last failed result (VALIDATION results carry Zod paths). */
export function useFieldError(path: string): string | undefined {
  return useContext(FieldErrorsContext)[path];
}

export function SubmitButton({ children, pendingLabel, variant = "primary", size = "md", disabled, className, title }: { children: ReactNode; pendingLabel?: string; variant?: ButtonVariant; size?: ButtonSize; disabled?: boolean; className?: string; title?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={disabled || pending} title={title} className={cx(buttonClasses(variant, size), className)} aria-disabled={disabled || pending}>
      {/* static icon with the text label under prefers-reduced-motion */}
      {pending && <Loader2 size={16} className="animate-spin motion-reduce:animate-none" aria-hidden />}
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}

/**
 * Generic server-action form with inline result reporting. Hidden fields are
 * convenience only: the server re-derives the actor and re-validates every id
 * against the actor's organisation, so forged values are rejected there.
 * Success renders as `role="status"`, failure as `role="alert"`; when a
 * VALIDATION result names fields, each is listed and exposed to `Field`s via
 * `useFieldError` (read-only over the existing ActionResult shape).
 */
export function ActionForm<T>({ action, hidden, children, submitLabel, pendingLabel, variant, size, disabled, disabledReason, successMessage, className, inline }: { action: Action<T>; hidden?: Record<string, string>; children?: ReactNode; submitLabel: ReactNode; pendingLabel?: string; variant?: ButtonVariant; size?: ButtonSize; disabled?: boolean; disabledReason?: string; successMessage?: string; className?: string; inline?: boolean }) {
  const [state, formAction] = useActionState(action, null);
  const router = useRouter();
  useEffect(() => {
    if (state?.ok) router.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  const dataMessage = state?.ok && state.data && typeof state.data === "object" && "message" in (state.data as object) ? String((state.data as { message?: unknown }).message ?? "") : "";
  const shown = state?.ok ? (successMessage ?? state.message ?? dataMessage) : "";
  const parsed = useMemo(() => parseFieldErrors(state), [state]);
  const byPath = useMemo(() => Object.fromEntries(parsed.fields.map((f) => [f.path, f.message])), [parsed]);
  return (
    <FieldErrorsContext.Provider value={byPath}>
      <form action={formAction} className={cx(inline ? "inline-flex flex-col gap-2" : "space-y-3", className)}>
        {hidden && Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
        {children}
        <div className={cx("flex flex-wrap items-center gap-3", inline && "flex-col items-start")}>
          <SubmitButton variant={variant} size={size} disabled={disabled} title={disabled ? disabledReason : undefined} pendingLabel={pendingLabel}>
            {submitLabel}
          </SubmitButton>
          {disabled && disabledReason && <span className="text-caption text-ink-muted">{disabledReason}</span>}
        </div>
        {state && !state.ok && (
          <Alert tone="conflict" role="alert" title={`Not applied (${state.code})`}>
            {parsed.fields.length > 0 ? (
              <>
                <p>Check these fields:</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-4">
                  {parsed.fields.map((f) => (
                    <li key={f.path}>
                      <span className="font-semibold">{fieldLabel(f.path)}</span>: {f.message}
                    </li>
                  ))}
                </ul>
                {parsed.general.map((g, i) => <p key={i}>{g}</p>)}
              </>
            ) : (
              state.message
            )}
          </Alert>
        )}
        {state?.ok && shown && (
          <Alert tone="teal" role="status">
            {shown}
          </Alert>
        )}
      </form>
    </FieldErrorsContext.Provider>
  );
}
