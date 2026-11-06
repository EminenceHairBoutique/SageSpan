"use client";

import { useActionState } from "react";
import { signInWithPasswordAction } from "@/server/auth-actions";
import type { ActionResult } from "@/domain/errors";
import { Alert, Field, buttonClasses, inputClasses } from "@/ui/primitives";

export function SignInForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(signInWithPasswordAction, null);
  return (
    <form action={action} className="space-y-4" aria-label="Sign in">
      <input type="hidden" name="next" value={next ?? "/app"} />
      <Field label="E-mail" required>
        <input className={inputClasses} type="email" name="email" autoComplete="username" required />
      </Field>
      <Field label="Password" required>
        <input className={inputClasses} type="password" name="password" autoComplete="current-password" required />
      </Field>
      {state && !state.ok ? (
        <Alert tone="amber" title="Could not sign in">
          {state.message}
        </Alert>
      ) : null}
      <button type="submit" className={buttonClasses("primary")} disabled={pending} data-testid="sign-in-submit">
        {pending ? "Signing in…" : "Sign in"}
      </button>
      <p className="text-xs text-ink-muted">Accounts are created by an administrator; there is no self-service sign-up in this build.</p>
    </form>
  );
}
