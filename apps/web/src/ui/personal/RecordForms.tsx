"use client";

import { useState, type ReactNode } from "react";
import { PencilLine, Plus, Archive } from "lucide-react";
import { CADENCES, CASH_ACCOUNT_KINDS, GOAL_KINDS, INCOME_KINDS, LIABILITY_KINDS, OBLIGATION_CATEGORIES, RATE_TYPES, RELIABILITIES, type CashAccount, type IncomeStream, type Liability, type PersonalRecordType, type RecurringObligation, type SavingsGoal, type VariableSpendingPattern } from "@sagespan/contracts";
import { retireRecordAction, saveRecordAction } from "@/server/personal-actions";
import { ActionForm } from "@/ui/ActionForm";
import { buttonClasses, cx, Field, inputClasses } from "@/ui/primitives";

/**
 * Add / edit / retire forms for the six personal record types (PERS-002a).
 * Plain HTML inputs; the server action shapes the form, the shared Zod schema
 * validates it, and the engine recomputes the baseline. Nothing is summed here.
 * Blank optional fields are sent blank and stay MISSING.
 */
const words = (s: string) => s.toLowerCase().replace(/_/g, " ");

function Select({ name, options, defaultValue, label }: { name: string; options: readonly string[]; defaultValue?: string; label: string }) {
  return (
    <select name={name} defaultValue={defaultValue ?? options[0]} className={inputClasses} aria-label={label}>
      {options.map((o) => (
        <option key={o} value={o}>
          {words(o)}
        </option>
      ))}
    </select>
  );
}

function Check({ name, label, defaultChecked }: { name: string; label: string; defaultChecked?: boolean }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="h-4 w-4 rounded border-line-strong" />
      {label}
    </label>
  );
}

function Months({ defaultValue }: { defaultValue?: string[] }) {
  return (
    <Field label="Observed monthly amounts, oldest first" hint="One per line (or comma-separated). Net amounts actually received or spent. Leave empty if you do not know yet; it stays marked missing.">
      <textarea name="observed_monthly_amounts" rows={4} defaultValue={(defaultValue ?? []).join("\n")} className={inputClasses} aria-label="Observed monthly amounts" placeholder={"3100.00\n4650.00\n2800.00"} />
    </Field>
  );
}

export function CashAccountFields({ r }: { r?: CashAccount }) {
  return (
    <>
      <Field label="Name" required>
        <input name="label" defaultValue={r?.label} required className={inputClasses} aria-label="Account name" />
      </Field>
      <Field label="Type">
        <Select name="kind" options={CASH_ACCOUNT_KINDS} defaultValue={r?.kind} label="Account type" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Balance (USD)" required>
          <input name="balance" inputMode="decimal" defaultValue={r?.balance} required className={inputClasses} aria-label="Balance" />
        </Field>
        <Field label="As of" required>
          <input name="balance_as_of" type="date" defaultValue={r?.balance_as_of} required className={inputClasses} aria-label="Balance as of" />
        </Field>
      </div>
      <input type="hidden" name="liquid_explicit" value="1" />
      <Check name="liquid" label="Counts as liquid cash (checking, savings, cash on hand)" defaultChecked={r ? r.liquid : true} />
    </>
  );
}

export function IncomeStreamFields({ r }: { r?: IncomeStream }) {
  return (
    <>
      <Field label="Name" required>
        <input name="label" defaultValue={r?.label} required className={inputClasses} aria-label="Income name" />
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Kind">
          <Select name="kind" options={INCOME_KINDS} defaultValue={r?.kind} label="Income kind" />
        </Field>
        <Field label="Paid">
          <Select name="cadence" options={CADENCES} defaultValue={r?.cadence ?? "MONTHLY"} label="Income cadence" />
        </Field>
        <Field label="Reliability (your view)">
          <Select name="reliability" options={RELIABILITIES} defaultValue={r?.reliability ?? "UNKNOWN"} label="Income reliability" />
        </Field>
      </div>
      <Months defaultValue={r?.observed_monthly_amounts} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Observed from (YYYY-MM)">
          <input name="observed_from" defaultValue={r?.observed_from ?? ""} placeholder="2026-05" className={inputClasses} aria-label="Observed from" />
        </Field>
        <Field label="Observed to (YYYY-MM)">
          <input name="observed_to" defaultValue={r?.observed_to ?? ""} placeholder="2026-10" className={inputClasses} aria-label="Observed to" />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Expected per payment (USD, optional)">
          <input name="expected_amount" inputMode="decimal" defaultValue={r?.expected_amount ?? ""} className={inputClasses} aria-label="Expected amount" />
        </Field>
        <Field label="Next expected date (optional)" hint="Needed for the dated outlook.">
          <input name="next_expected_date" type="date" defaultValue={r?.next_expected_date ?? ""} className={inputClasses} aria-label="Next expected date" />
        </Field>
      </div>
    </>
  );
}

export function ObligationFields({ r, liabilities }: { r?: RecurringObligation; liabilities: Array<{ id: string; label: string }> }) {
  return (
    <>
      <Field label="Name" required>
        <input name="label" defaultValue={r?.label} required className={inputClasses} aria-label="Commitment name" />
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Category">
          <Select name="category" options={OBLIGATION_CATEGORIES} defaultValue={r?.category ?? "OTHER"} label="Category" />
        </Field>
        <Field label="Amount (USD)" required>
          <input name="amount" inputMode="decimal" defaultValue={r?.amount} required className={inputClasses} aria-label="Amount" />
        </Field>
        <Field label="Due">
          <Select name="cadence" options={CADENCES} defaultValue={r?.cadence ?? "MONTHLY"} label="Cadence" />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Next due date" required>
          <input name="next_due_date" type="date" defaultValue={r?.next_due_date} required className={inputClasses} aria-label="Next due date" />
        </Field>
        <Field label="Minimum payment for a debt? (optional)">
          <select name="liability_id" defaultValue={r?.liability_id ?? ""} className={inputClasses} aria-label="Linked debt">
            <option value="">Not a debt payment</option>
            {liabilities.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Check name="essential" label="Essential (counts toward the buffer; cannot be paused)" defaultChecked={r ? r.essential : true} />
    </>
  );
}

export function VariableSpendingFields({ r }: { r?: VariableSpendingPattern }) {
  return (
    <>
      <Field label="Category" required>
        <input name="category" defaultValue={r?.category} required className={inputClasses} aria-label="Spending category" placeholder="Groceries" />
      </Field>
      <Months defaultValue={r?.observed_monthly_amounts} />
      <Check name="essential" label="Essential (groceries, fuel to work) rather than discretionary" defaultChecked={r?.essential ?? false} />
      <Check name="transfers_excluded" label="Transfers and refunds are already excluded from these totals" defaultChecked={r?.transfers_excluded ?? true} />
    </>
  );
}

export function LiabilityFields({ r }: { r?: Liability }) {
  return (
    <>
      <Field label="Name" required>
        <input name="label" defaultValue={r?.label} required className={inputClasses} aria-label="Debt name" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Type">
          <Select name="kind" options={LIABILITY_KINDS} defaultValue={r?.kind ?? "CREDIT_CARD"} label="Debt type" />
        </Field>
        <Field label="Rate type">
          <Select name="rate_type" options={RATE_TYPES} defaultValue={r?.rate_type ?? "FIXED"} label="Rate type" />
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Balance (USD)" required>
          <input name="balance" inputMode="decimal" defaultValue={r?.balance} required className={inputClasses} aria-label="Debt balance" />
        </Field>
        <Field label="Balance as of" required>
          <input name="balance_as_of" type="date" defaultValue={r?.balance_as_of} required className={inputClasses} aria-label="Debt balance as of" />
        </Field>
        <Field label="APR (%)" required>
          <input name="apr_percent" inputMode="decimal" defaultValue={r?.apr_percent} required className={inputClasses} aria-label="APR percent" />
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Minimum payment (USD)" required>
          <input name="minimum_payment" inputMode="decimal" defaultValue={r?.minimum_payment} required className={inputClasses} aria-label="Minimum payment" />
        </Field>
        <Field label="Due day of month (optional)">
          <input name="due_day_of_month" type="number" min={1} max={31} defaultValue={r?.due_day_of_month ?? ""} className={inputClasses} aria-label="Due day" />
        </Field>
        <Field label="Promo APR (%) / expires" hint="Only for a promotional rate.">
          <div className="flex gap-2">
            <input name="promo_apr_percent" inputMode="decimal" defaultValue={r?.promo_apr_percent ?? ""} className={inputClasses} aria-label="Promo APR percent" />
            <input name="promo_apr_expires" type="date" defaultValue={r?.promo_apr_expires ?? ""} className={inputClasses} aria-label="Promo APR expires" />
          </div>
        </Field>
      </div>
      <p className="text-xs text-ink-muted">Add the minimum payment as a recurring commitment linked to this debt so it appears in the outlook.</p>
    </>
  );
}

export function GoalFields({ r, accounts }: { r?: SavingsGoal; accounts: Array<{ ref: string; label: string }> }) {
  return (
    <>
      <Field label="Name" required>
        <input name="label" defaultValue={r?.label} required className={inputClasses} aria-label="Goal name" />
      </Field>
      <Field label="Kind">
        <Select name="kind" options={GOAL_KINDS} defaultValue={r?.kind ?? "OTHER"} label="Goal kind" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Target (USD)" required>
          <input name="target_amount" inputMode="decimal" defaultValue={r?.target_amount} required className={inputClasses} aria-label="Target amount" />
        </Field>
        <Field label="Saved so far (USD)">
          <input name="saved_amount" inputMode="decimal" defaultValue={r?.saved_amount ?? "0.00"} className={inputClasses} aria-label="Saved amount" />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Target date (optional)">
          <input name="target_date" type="date" defaultValue={r?.target_date ?? ""} className={inputClasses} aria-label="Target date" />
        </Field>
        <Field label="Monthly contribution (USD, optional)">
          <input name="monthly_contribution" inputMode="decimal" defaultValue={r?.monthly_contribution ?? ""} className={inputClasses} aria-label="Monthly contribution" />
        </Field>
      </div>
      <Field label="Where the saved amount sits (optional)">
        <select name="funded_from_account_id" defaultValue={r?.funded_from_account_id ?? ""} className={inputClasses} aria-label="Funding account">
          <option value="">Not specified</option>
          {accounts.map((a) => (
            <option key={a.ref} value={a.ref}>
              {a.label}
            </option>
          ))}
        </select>
      </Field>
    </>
  );
}

type SaveAction = typeof saveRecordAction;
type RetireAction = typeof retireRecordAction;

/** Collapsible add form. `save` defaults to the demo action; /app/personal passes the production one (same form, same schema). */
export function AddRecord({ type, title, children, save = saveRecordAction, pendingLabel = "Saving and recomputing…" }: { type: PersonalRecordType; title: string; children: ReactNode; save?: SaveAction; pendingLabel?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-dashed border-line p-3">
      <button type="button" onClick={() => setOpen((o) => !o)} className={cx(buttonClasses("ghost", "sm"))} aria-expanded={open}>
        <Plus size={14} aria-hidden /> {title}
      </button>
      {open && (
        <div className="mt-3">
          <ActionForm action={save} hidden={{ record_type: type, record_ref: "" }} submitLabel="Add" pendingLabel={pendingLabel} size="sm">
            {children}
          </ActionForm>
        </div>
      )}
    </div>
  );
}

/** Inline edit + retire controls for one record. */
export function EditRecord({ type, recordRef, name, children, save = saveRecordAction, retire = retireRecordAction, pendingLabel = "Saving and recomputing…" }: { type: PersonalRecordType; recordRef: string; name: string; children: ReactNode; save?: SaveAction; retire?: RetireAction; pendingLabel?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setOpen((o) => !o)} className={buttonClasses("ghost", "sm")} aria-expanded={open} aria-label={`Edit ${name}`}>
          <PencilLine size={13} aria-hidden /> {open ? "Close" : "Edit"}
        </button>
        <ActionForm action={retire} hidden={{ record_type: type, record_ref: recordRef }} submitLabel={<><Archive size={13} aria-hidden /> Retire</>} pendingLabel="Retiring…" variant="ghost" size="sm" inline className="!gap-0" />
      </div>
      {open && (
        <div className="mt-3 rounded-lg border border-line bg-surface-muted/40 p-3">
          <ActionForm action={save} hidden={{ record_type: type, record_ref: recordRef }} submitLabel="Save as new revision" pendingLabel={pendingLabel} size="sm">
            {children}
          </ActionForm>
        </div>
      )}
    </div>
  );
}
