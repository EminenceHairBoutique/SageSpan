import Link from "next/link";
import { formatMoney, type PersonalDataState } from "@sagespan/contracts";
import { updateRetirementIntakeAction } from "@/server/personal-actions";
import { ActionForm } from "@/ui/ActionForm";
import { DataStateChip } from "@/ui/personal/components";
import { Alert, Card, Field, inputClasses, KeyValue } from "@/ui/primitives";
import { loadPersonal } from "../load";

export const dynamic = "force-dynamic";

const FIELDS: Array<{ key: string; label: string; kind: "years" | "money" | "date"; hint?: string }> = [
  { key: "current_age", label: "Current age", kind: "years" },
  { key: "target_retirement_age", label: "Target retirement age", kind: "years", hint: "Tick 'assumed' if this is a placeholder." },
  { key: "annual_retirement_spending", label: "Expected annual spending in retirement", kind: "money", hint: "Today's dollars." },
  { key: "retirement_assets_total", label: "Retirement assets today", kind: "money" },
  { key: "retirement_assets_as_of", label: "Assets as of", kind: "date" },
  { key: "annual_contributions", label: "Annual contributions", kind: "money" },
  { key: "expected_pension_annual", label: "Expected pension (annual)", kind: "money" },
  { key: "social_security_estimate_annual", label: "Social Security estimate (annual)", kind: "money", hint: "From an SSA statement if you have one." },
];

export default async function RetirementPage() {
  const { b } = await loadPersonal();
  const r = b.retirement;
  const states = r?.states ?? {};
  const known = Object.values(states).filter((s) => s === "USER_REPORTED" || s === "EVIDENCE_VERIFIED").length;
  const missing = Object.values(states).filter((s) => s === "MISSING").length;
  const assumed = Object.values(states).filter((s) => s === "ASSUMED" || s === "STALE").length;
  const ready = missing === 0;
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal">Retirement Studio</p>
        <h1 className="mt-1 text-2xl font-bold">Readiness gate: what is known, assumed and missing</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-muted">A retirement projection is only as honest as its inputs. This gate records each input&apos;s state so that, when the projection engine exists, it can refuse to produce a confident-looking result from gaps.</p>
      </div>
      <Alert tone="slate" title="No projection engine in this build (PLAN-001 / SCENARIO-001 not implemented)">
        SageSpan will not estimate a retirement outcome until a separately versioned, independently benchmarked annual cash-flow model exists. The first engine will be a labelled, simplified gross-basis annual model; Social Security, tax, Roth and Monte Carlo analysis follow only after their own validation gates. Nothing on this page predicts anything.
      </Alert>
      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <Card title="Readiness" subtitle={`${known} known · ${assumed} assumed or stale · ${missing} missing`}>
          <KeyValue
            rows={FIELDS.map((f) => ({
              k: f.label,
              v: (
                <span className="flex flex-wrap items-center gap-2">
                  <span>{displayValue(r?.[f.key as keyof typeof r], f.kind)}</span>
                  <DataStateChip state={(states[f.key] ?? "MISSING") as PersonalDataState} />
                </span>
              ),
            }))}
          />
          <p className="mt-4 text-sm text-ink-muted">{ready ? "All material inputs are present. A projection would still be labelled preliminary until the engine and its validation exist." : `Missing inputs would make any projection misleading; the gate stays closed (${missing} missing).`}</p>
          <p className="mt-2 text-xs text-ink-faint">
            What an RMD is, how the applicable age works and why we check them independently: <Link href="/demo/personal/learn#retirement" className="font-semibold text-navy hover:underline">Learn → Retirement basics</Link>.
          </p>
        </Card>
        <Card title="Update intake" subtitle="Each field keeps its own state; blanks are recorded as missing, never guessed.">
          {b.membership.role === "OWNER" ? (
            <ActionForm action={updateRetirementIntakeAction} submitLabel="Save intake" pendingLabel="Saving…" size="sm">
              <div className="grid gap-3 sm:grid-cols-2">
                {FIELDS.map((f) => (
                  <Field key={f.key} label={f.label} hint={f.hint}>
                    <input name={f.key} type={f.kind === "date" ? "date" : "text"} inputMode={f.kind === "date" ? undefined : "decimal"} defaultValue={inputValue(r?.[f.key as keyof typeof r])} className={inputClasses} />
                  </Field>
                ))}
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="target_is_assumed" defaultChecked={states["target_retirement_age"] === "ASSUMED"} /> Target retirement age is an assumption
                </label>
                <Field label="Social Security estimate source">
                  <select name="social_security_estimate_source" defaultValue={r?.social_security_estimate_source ?? ""} className={inputClasses}>
                    <option value="">Not provided</option>
                    <option value="SSA_STATEMENT">SSA statement</option>
                    <option value="USER_GUESS">My own guess (recorded as assumed)</option>
                  </select>
                </Field>
              </div>
            </ActionForm>
          ) : (
            <p className="text-sm text-ink-muted">Only the workspace owner can edit the intake.</p>
          )}
        </Card>
      </div>
      <Card title="What the Studio will do, in order" subtitle="Each step is its own release gate; none is a promise of a date.">
        <ol className="list-decimal space-y-1 pl-5 text-sm text-ink-muted">
          <li>PLAN-001: bounded gross-basis annual cash-flow model (contributions, growth/fees, spending, withdrawals, inflation) with golden tests and an omissions card.</li>
          <li>Scenario comparisons on that engine: retire at 63 vs 67, spend less, save more, lower returns, a one-year income interruption.</li>
          <li>Independently reviewed modules, one at a time: Social Security claiming, RMD coordination (the existing engine), tax-aware withdrawals and Roth conversions, healthcare costs, Monte Carlo.</li>
          <li>Optional, consented sharing of a plan with an advisor through a revocable grant (Privacy).</li>
        </ol>
      </Card>
    </div>
  );
}

function displayValue(v: unknown, kind: "years" | "money" | "date"): string {
  if (v == null || v === "") return "—";
  if (kind === "money" && typeof v === "string") return formatMoney(v);
  if (kind === "years") return `${v} years`;
  return String(v);
}

function inputValue(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "object") return "";
  return String(v);
}
