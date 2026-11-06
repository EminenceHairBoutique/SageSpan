import { CheckCircle2 } from "lucide-react";
import expected from "../../../../../fixtures/synthetic/calc/patel_rmd_expected_response.json";
import { Chip } from "@/ui/primitives";

/** A real receipt produced by the calculation engine for the synthetic Patel fixture. */
export function SampleReceipt() {
  const r = expected;
  const table = r.receipt.rule_sets[0]!;
  return (
    <div className="rounded-card border border-line bg-surface p-5 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-teal">Traceable check receipt · synthetic</p>
        <Chip tone="teal" icon={<CheckCircle2 size={13} aria-hidden />}>
          Arithmetic PASS · {r.coverage_status.toLowerCase().replace(/_/g, " ")}
        </Chip>
      </div>
      <p className="mt-3 text-sm text-ink-muted">Patel household (fictional) · traditional IRA · tax year {r.tax_year} · owner age {r.eligibility.owner_age_in_tax_year}</p>
      <p className="mt-2 font-heading text-4xl font-bold tabular text-ink">$25,098.04</p>
      <p className="font-mono text-xs text-ink-muted">{r.receipt.formula}</p>
      <dl className="mt-4 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-[max-content_1fr]">
        <dt className="text-ink-muted">Input balance</dt>
        <dd>$640,000.00 as of 2025-12-31 · custodian statement (SHA-256 referenced)</dd>
        <dt className="text-ink-muted">Rule set</dt>
        <dd>
          {table.rule_set_id}@{table.version} · {table.sources[0]?.title}
        </dd>
        <dt className="text-ink-muted">Imported plan value</dt>
        <dd>
          $24,000.00 (illustrative) → <span className="font-semibold text-conflict">source conflict</span>: the plan used a $612,000.00 balance
        </dd>
        <dt className="text-ink-muted">Run hash</dt>
        <dd className="font-mono text-xs break-all">{r.receipt.run_hash}</dd>
        <dt className="text-ink-muted">Engine</dt>
        <dd>
          {r.receipt.engine_name} {r.receipt.engine_version} · Decimal arithmetic, ROUND_HALF_UP to cents
        </dd>
      </dl>
      <p className="mt-4 text-xs text-ink-faint">PASS is an arithmetic result for the stated inputs and rule set. Approval is a separate human act recorded with identity, role and rationale.</p>
    </div>
  );
}
