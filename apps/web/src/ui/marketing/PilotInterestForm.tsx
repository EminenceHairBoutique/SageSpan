import { brand } from "@/config/brand";
import { pilotInterestAction } from "@/server/actions";
import { ActionForm } from "@/ui/ActionForm";
import { Field, inputClasses } from "@/ui/primitives";

export function PilotInterestForm() {
  return (
    <ActionForm action={pilotInterestAction} submitLabel="Register pilot interest" pendingLabel="Saving locally…" className="rounded-card border border-line bg-surface p-5 shadow-card">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Firm name" required>
          <input name="firm_name" required minLength={2} maxLength={120} className={inputClasses} autoComplete="organization" />
        </Field>
        <Field label="Your role" required>
          <input name="role" required minLength={2} maxLength={80} placeholder="CCO, managing partner, COO, planning director…" className={inputClasses} />
        </Field>
        <Field label="Contact (work email or phone)" required>
          <input name="contact" required minLength={3} maxLength={160} className={inputClasses} autoComplete="off" />
        </Field>
        <Field label="Advisors at the firm" required>
          <select name="advisors_band" defaultValue="5-15" className={inputClasses}>
            <option value="1-4">1–4</option>
            <option value="5-15">5–15</option>
            <option value="16-50">16–50</option>
            <option value="51+">51+</option>
          </select>
        </Field>
        <Field label="Planning tools in use (free text)">
          <input name="planning_tools" maxLength={200} className={inputClasses} />
        </Field>
        <Field label="What would you want checked first?">
          <input name="note" maxLength={1000} className={inputClasses} />
        </Field>
      </div>
      <p className="text-xs text-ink-muted">{brand.contactNote} No marketing automation, no third-party form service.</p>
    </ActionForm>
  );
}
