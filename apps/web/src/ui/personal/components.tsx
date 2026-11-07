import type { ReactNode } from "react";
import { formatMoney, type Flag, type PersonalCalcRun } from "@sagespan/contracts";
import { ReceiptButton, type ReceiptRow } from "@/ui/ReceiptDialog";
import { Skeleton } from "@/ui/Skeleton";
import { cx } from "@/ui/primitives";
import { SeverityChip } from "@/ui/status";

/** Typed chips moved to ui/status (design system §6.7–6.8); re-exported so existing imports keep working. */
export { DataStateChip, SeverityChip } from "@/ui/status";

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
    <ReceiptButton title={label} subtitle="Where this number comes from" rows={rows} sections={receipt?.limitations.length ? [{ heading: "Limitations", rows: receipt.limitations.map((l, i) => ({ label: `${i + 1}`, value: l })) }] : undefined} className={cx("tabular underline decoration-dotted underline-offset-4", className)}>
      {text}
    </ReceiptButton>
  );
}

type StatTone = "teal" | "amber" | "conflict";

const statRule: Record<StatTone, string> = {
  teal: "border-l-teal",
  amber: "border-l-amber",
  conflict: "border-l-conflict",
};

const statQualifier: Record<StatTone, string> = {
  teal: "text-teal-700",
  amber: "text-amber-700",
  conflict: "text-conflict-700",
};

/**
 * Consumer stat tile (design system §3.6). A tone is a 3 px left rule plus a
 * textual `qualifier` ("below your floor"), never colour alone. `loading`
 * keeps the label visible over a skeleton; an empty value shows "—" with the
 * hint as the reason.
 */
export function Stat({ label, children, hint, tone, qualifier, loading }: { label: string; children: ReactNode; hint?: ReactNode; tone?: StatTone; qualifier?: string; loading?: boolean }) {
  return (
    <div className={cx("rounded-card border border-line bg-surface p-4 shadow-card", tone && cx("border-l-[3px]", statRule[tone]))}>
      <p className="text-eyebrow uppercase text-ink-muted">{label}</p>
      {loading ? <Skeleton shape="stat" className="mt-2" /> : <p className="mt-1 text-stat tabular text-ink">{children}</p>}
      {qualifier && tone && <p className={cx("mt-1 text-caption font-semibold", statQualifier[tone])}>{qualifier}</p>}
      {hint && <p className="mt-1 text-caption text-ink-muted">{hint}</p>}
    </div>
  );
}

export function FlagList({ flags, labels, limit }: { flags: Flag[]; labels: Record<string, string>; limit?: number }) {
  const shown = limit ? flags.slice(0, limit) : flags;
  if (shown.length === 0) return <p className="text-sm text-ink-muted">Nothing needs attention on the current inputs.</p>;
  return (
    <ul className="space-y-2">
      {shown.map((f, i) => (
        <li key={`${f.code}-${i}`} className="flex items-start gap-3 rounded-control border border-line bg-canvas px-3 py-2 text-sm">
          <SeverityChip severity={f.severity} />
          <div className="min-w-0">
            <p className="text-ink">{f.message}</p>
            {f.refs.length > 0 && <p className="mt-0.5 text-caption text-ink-faint">About: {f.refs.map((r) => labels[r] ?? r).join(", ")}</p>}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function DisclosureList({ title, items, tone = "neutral" }: { title: string; items: string[]; tone?: "neutral" | "amber" }) {
  if (!items.length) return null;
  return (
    <div className={cx("rounded-control border px-3 py-2 text-caption", tone === "amber" ? "border-amber/30 bg-amber-100/40 text-amber-700" : "border-line bg-surface-muted/60 text-ink-muted")}>
      <p className="font-semibold">{title}</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-4">
        {items.map((x, i) => (
          <li key={i}>{x}</li>
        ))}
      </ul>
    </div>
  );
}
