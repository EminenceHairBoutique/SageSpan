import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, CircleHelp, Clock3, Info, PencilLine } from "lucide-react";
import { PERSONAL_DATA_STATE_LABELS, formatMoney, type Flag, type PersonalCalcRun, type PersonalDataState, type Severity } from "@sagespan/contracts";
import { ReceiptButton, type ReceiptRow } from "@/ui/ReceiptDialog";
import { Chip, cx } from "@/ui/primitives";

/** Plain-language status chip for the V5 data states. */
export function DataStateChip({ state }: { state: PersonalDataState }) {
  const tone = state === "EVIDENCE_VERIFIED" ? "teal" : state === "USER_REPORTED" ? "slate" : state === "ASSUMED" ? "navy" : state === "STALE" ? "amber" : "conflict";
  const Icon = state === "EVIDENCE_VERIFIED" ? CheckCircle2 : state === "USER_REPORTED" ? PencilLine : state === "ASSUMED" ? Info : state === "STALE" ? Clock3 : state === "MISSING" ? CircleHelp : AlertTriangle;
  return (
    <Chip tone={tone} icon={<Icon size={13} aria-hidden />}>
      {PERSONAL_DATA_STATE_LABELS[state]}
    </Chip>
  );
}

export function SeverityChip({ severity }: { severity: Severity }) {
  const tone = severity === "HIGH" ? "conflict" : severity === "MEDIUM" ? "amber" : severity === "LOW" ? "slate" : "neutral";
  return <Chip tone={tone}>{severity === "INFO" ? "Note" : severity.charAt(0) + severity.slice(1).toLowerCase()}</Chip>;
}

/** A number the user can click to see where it came from (receipt, method set, inputs). */
export function Money({ value, run, label, field, className }: { value: string | null | undefined; run: PersonalCalcRun | null; label: string; field: string; className?: string }) {
  const text = value == null ? "—" : formatMoney(value);
  if (!run || value == null) return <span className={cx("tabular", className)}>{text}</span>;
  const receipt = (run.response as { receipt?: { request_hash: string; run_hash: string; computed_at: string; formula?: string | null; limitations: string[]; rule_sets: Array<{ rule_set_id: string; version: string; status: string; checksum: string }> } } | null)?.receipt;
  const rows: ReceiptRow[] = [
    { label: "Figure", value: `${label}: ${text}` },
    { label: "Response field", value: field, mono: true },
    { label: "Engine", value: `${run.engine_name ?? "—"} ${run.engine_version ?? ""}` },
    { label: "Method set", value: Object.entries(run.method_set_versions).map(([k, v]) => `${k}@${v}`).join(", ") || "—", mono: true },
    { label: "Request SHA-256", value: run.request_sha256, mono: true },
    { label: "Request hash re-derived here", value: run.request_hash_verified ? "yes" : "NO" },
    { label: "Run hash", value: receipt?.run_hash ?? "—", mono: true },
    { label: "Computed at", value: receipt?.computed_at ?? run.executed_at },
    { label: "Formula", value: receipt?.formula ?? "—", mono: true },
  ];
  return (
    <ReceiptButton title={label} subtitle="Where this number comes from" rows={rows} sections={receipt?.limitations.length ? [{ heading: "Limitations", rows: receipt.limitations.map((l, i) => ({ label: `${i + 1}`, value: l })) }] : undefined} className={cx("tabular underline decoration-dotted underline-offset-4 hover:text-navy", className)}>
      {text}
    </ReceiptButton>
  );
}

export function Stat({ label, children, hint, tone }: { label: string; children: ReactNode; hint?: ReactNode; tone?: "teal" | "amber" | "conflict" }) {
  return (
    <div className={cx("rounded-card border bg-surface p-4 shadow-card", tone === "conflict" ? "border-conflict/30" : tone === "amber" ? "border-amber/30" : tone === "teal" ? "border-teal/30" : "border-line")}>
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold text-ink">{children}</p>
      {hint && <p className="mt-1 text-xs text-ink-muted">{hint}</p>}
    </div>
  );
}

export function FlagList({ flags, labels, limit }: { flags: Flag[]; labels: Record<string, string>; limit?: number }) {
  const shown = limit ? flags.slice(0, limit) : flags;
  if (shown.length === 0) return <p className="text-sm text-ink-muted">Nothing needs attention on the current inputs.</p>;
  return (
    <ul className="space-y-2">
      {shown.map((f, i) => (
        <li key={`${f.code}-${i}`} className="flex gap-3 rounded-lg border border-line bg-canvas px-3 py-2 text-sm">
          <SeverityChip severity={f.severity} />
          <div className="min-w-0">
            <p className="text-ink">{f.message}</p>
            {f.refs.length > 0 && <p className="mt-0.5 text-xs text-ink-faint">About: {f.refs.map((r) => labels[r] ?? r).join(", ")}</p>}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function DisclosureList({ title, items, tone = "neutral" }: { title: string; items: string[]; tone?: "neutral" | "amber" }) {
  if (!items.length) return null;
  return (
    <div className={cx("rounded-lg border px-3 py-2 text-xs", tone === "amber" ? "border-amber/30 bg-amber-100/40 text-amber-700" : "border-line bg-surface-muted/60 text-ink-muted")}>
      <p className="font-semibold">{title}</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-4">
        {items.map((x, i) => (
          <li key={i}>{x}</li>
        ))}
      </ul>
    </div>
  );
}
