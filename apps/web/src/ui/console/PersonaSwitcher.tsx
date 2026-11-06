"use client";

import { useRef } from "react";
import { UserRound } from "lucide-react";
import type { Persona } from "@/auth/persona";
import { switchPersonaAction } from "@/server/actions";
import { inputClasses } from "@/ui/primitives";

export function PersonaSwitcher({ personas, current }: { personas: Persona[]; current: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const byOrg = personas.reduce<Record<string, Persona[]>>((acc, p) => {
    (acc[p.org_name] ??= []).push(p);
    return acc;
  }, {});
  return (
    <form ref={formRef} action={switchPersonaAction} className="flex items-center gap-2">
      <UserRound size={16} className="text-ink-muted" aria-hidden />
      <label className="sr-only" htmlFor="persona">
        Simulated reviewer persona
      </label>
      <select id="persona" name="persona" defaultValue={current} onChange={() => formRef.current?.requestSubmit()} className={`${inputClasses} w-auto max-w-[320px] py-1.5`} aria-label="Simulated reviewer persona">
        {Object.entries(byOrg).map(([org, list]) => (
          <optgroup key={org} label={org}>
            {list.map((p) => (
              <option key={p.user_id} value={p.user_id}>
                {p.display_name} · {p.role}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <noscript>
        <button type="submit" className="text-xs underline">
          Switch
        </button>
      </noscript>
    </form>
  );
}
