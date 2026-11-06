"use client";

import { useState } from "react";
import { PERSONAL_SCENARIO_KIND_LABELS, PERSONAL_SCENARIO_KINDS, type PersonalScenarioKind } from "@sagespan/contracts";
import { runScenarioAction } from "@/server/personal-actions";
import { ActionForm } from "@/ui/ActionForm";
import { Field, inputClasses } from "@/ui/primitives";

export interface WhatIfOption {
  id: string;
  label: string;
}

/**
 * One bounded change at a time. The form only collects the fields the chosen
 * kind needs; the shared contract re-validates on the server and the engine
 * validates again. No figure is computed here.
 */
export function WhatIfForm({ streams, goals, asOf, disabled }: { streams: WhatIfOption[]; goals: WhatIfOption[]; asOf: string; disabled?: boolean }) {
  const [kind, setKind] = useState<PersonalScenarioKind>("INCOME_INTERRUPTION");
  return (
    <ActionForm action={runScenarioAction} submitLabel="Run what-if" pendingLabel="Calling calculation service…" size="sm" disabled={disabled} disabledReason={disabled ? "Only the owner can run what-ifs." : undefined}>
      <Field label="What changes?">
        <select name="kind" value={kind} onChange={(e) => setKind(e.target.value as PersonalScenarioKind)} className={inputClasses} aria-label="Scenario kind">
          {PERSONAL_SCENARIO_KINDS.map((k) => (
            <option key={k} value={k}>
              {PERSONAL_SCENARIO_KIND_LABELS[k]}
            </option>
          ))}
        </select>
      </Field>
      {kind === "SPENDING_CHANGE" && (
        <>
          <Field label="Direction">
            <select name="direction" defaultValue="LESS" className={inputClasses} aria-label="Spending direction">
              <option value="LESS">Spend less</option>
              <option value="MORE">Spend more</option>
            </select>
          </Field>
          <Field label="Amount per month (USD)" hint="Applied to discretionary spending only; essential bills are never reduced by a what-if.">
            <input name="monthly_amount" inputMode="decimal" placeholder="150.00" className={inputClasses} aria-label="Monthly spending change" required />
          </Field>
        </>
      )}
      {kind === "SAVINGS_CHANGE" && (
        <>
          <Field label="Extra amount set aside per month (USD)">
            <input name="monthly_amount" inputMode="decimal" placeholder="200.00" className={inputClasses} aria-label="Monthly savings change" required />
          </Field>
          <Field label="Toward which goal? (optional)">
            <select name="goal_ref" defaultValue="" className={inputClasses} aria-label="Goal">
              <option value="">No specific goal</option>
              {goals.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Where does it go?" hint="Money that stays in checking or savings is still liquid cash; a retirement or locked account is not.">
            <select name="destination" defaultValue="LIQUID" className={inputClasses} aria-label="Savings destination">
              <option value="LIQUID">Stays in a liquid account</option>
              <option value="ILLIQUID">Leaves liquid cash (retirement, locked)</option>
            </select>
          </Field>
        </>
      )}
      {kind === "INCOME_INTERRUPTION" && (
        <>
          <Field label="Which income stream stops?">
            <select name="stream_ref" defaultValue={streams[0]?.id ?? ""} className={inputClasses} aria-label="Income stream" required>
              {streams.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="For how many months? (1–12)">
            <input name="months" type="number" min={1} max={12} defaultValue={3} className={inputClasses} aria-label="Interruption months" required />
          </Field>
          <Field label="Starting" hint={`Defaults to the baseline date (${asOf}).`}>
            <input name="start_date" type="date" defaultValue={asOf} className={inputClasses} aria-label="Interruption start date" />
          </Field>
        </>
      )}
    </ActionForm>
  );
}
