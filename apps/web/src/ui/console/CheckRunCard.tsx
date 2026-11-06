import { formatMoney, type CheckRun, type Discrepancy } from "@sagespan/contracts";
import type { HouseholdBundle } from "@/domain/queries";
import { accountLabel, personLabel } from "@/domain/queries";
import { ReceiptButton } from "@/ui/ReceiptDialog";
import { Alert, Chip, ClassificationChip, KeyValue, Mono, ResultChip, Td, Th } from "@/ui/primitives";

export function CheckRunCard({ run, discrepancy, b }: { run: CheckRun; discrepancy: Discrepancy | null; b: HouseholdBundle }) {
  const r = run.response;
  const acct = accountLabel(b, run.request_payload.account.account_ref);
  const owner = personLabel(b, run.request_payload.owner.person_ref);
  const receipt = r?.receipt;
  const annual = r?.events.find((e) => e.event_type === "ANNUAL_RMD");
  const ipv = discrepancy?.imported_plan_value_id ? b.importedValues.find((v) => v.id === discrepancy.imported_plan_value_id) : null;
  return (
    <div className="rounded-card border border-line bg-surface shadow-card">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <h3 className="font-semibold">
            {acct} <span className="text-ink-muted">· owner {owner}</span>
          </h3>
          <p className="text-xs text-ink-muted">
            Run <code className="font-mono">{run.id}</code> · {run.executed_at.replace("T", " ").slice(0, 19)} UTC · engine {run.engine_name ?? "—"} {run.engine_version ?? ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ResultChip status={run.run_status} />
          {run.coverage_status && <Chip tone={run.coverage_status === "SUPPORTED_VERIFIED" ? "teal" : "amber"}>{run.coverage_status.toLowerCase().replace(/_/g, " ")}</Chip>}
          {run.request_hash_verified !== null && <Chip tone={run.request_hash_verified ? "teal" : "conflict"}>{run.request_hash_verified ? "request hash verified" : "request hash MISMATCH"}</Chip>}
        </div>
      </header>
      <div className="grid gap-5 px-5 py-4 lg:grid-cols-2">
        {run.error && (
          <div className="lg:col-span-2">
            <Alert tone="conflict" title={`No result: ${run.error.code}`}>
              {run.error.message} The web tier does not compute retirement math; nothing was estimated locally. Start the calculation service and run the check again.
            </Alert>
          </div>
        )}
        {r && (
          <>
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">Independent result</h4>
              {r.annual_rmd ? (
                <p className="text-3xl font-bold tabular">
                  <ReceiptButton
                    title="Run receipt — annual RMD"
                    subtitle={`${acct}, tax year ${r.tax_year}`}
                    rows={[
                      { label: "Computed amount", value: formatMoney(r.annual_rmd) },
                      { label: "Formula", value: receipt?.formula ?? "—" },
                      { label: "Input balance", value: `${formatMoney(String(receipt?.inputs_used.prior_year_end_balance ?? ""))} as of ${String(receipt?.inputs_used.prior_year_end_balance_as_of ?? "")}` },
                      { label: "Owner age in year", value: String(receipt?.inputs_used.owner_age_in_tax_year ?? "") },
                      { label: "Table / factor", value: `${String(receipt?.inputs_used.table_id ?? "")} → ${String(receipt?.inputs_used.factor ?? "")}` },
                      { label: "Rounding", value: "ROUND_HALF_UP to cents, applied once" },
                      { label: "Snapshot", value: `${receipt?.snapshot_ref?.snapshot_id} rev ${receipt?.snapshot_ref?.revision}` },
                      { label: "Snapshot hash", value: receipt?.snapshot_ref?.input_hash ?? "", mono: true },
                      { label: "Request hash", value: receipt?.request_hash ?? "", mono: true },
                      { label: "Run hash", value: receipt?.run_hash ?? "", mono: true },
                      { label: "Engine", value: `${receipt?.engine_name} ${receipt?.engine_version}` },
                    ]}
                    sections={[{ heading: "Rule sets cited", rows: (receipt?.rule_sets ?? []).map((rs) => ({ label: `${rs.rule_set_id}@${rs.version}`, value: `${rs.status} · checksum ${rs.checksum.slice(0, 16)}… · ${rs.sources.map((s) => s.title).join("; ") || "no external source (firm tolerance policy)"}` })) }]}
                  >
                    {formatMoney(r.annual_rmd)}
                  </ReceiptButton>
                </p>
              ) : (
                <p className="text-sm text-ink-muted">No amount produced (status {r.result_status}). See reasons.</p>
              )}
              <KeyValue
                className="mt-3"
                rows={[
                  { k: "Eligibility", v: r.eligibility.status },
                  { k: "Applicable age", v: r.eligibility.applicable_age ?? "—" },
                  { k: "Age in tax year", v: r.eligibility.owner_age_in_tax_year ?? "—" },
                  { k: "First distribution year", v: r.eligibility.first_distribution_year ?? "—" },
                  { k: "Required beginning date", v: r.eligibility.required_beginning_date ?? "—" },
                  { k: "Table", v: r.eligibility.table_id ?? "—" },
                ]}
              />
              {r.unsupported_reasons.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {r.unsupported_reasons.map((x) => (
                    <li key={x.code} className="rounded-lg border border-amber-700/20 bg-amber-100/60 p-2.5 text-sm">
                      <div className="font-semibold text-amber-700">{x.code}</div>
                      <div>{x.message}</div>
                      {x.rule_ref && <div className="text-xs text-ink-muted">rule: {x.rule_ref}</div>}
                    </li>
                  ))}
                </ul>
              )}
              {r.events.length > 0 && (
                <div className="mt-4">
                  <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">Obligation events (kept separate)</h4>
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        <Th>Event</Th>
                        <Th>Year</Th>
                        <Th>Deadline</Th>
                        <Th>Status</Th>
                        <Th align="right">Amount</Th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {r.events.map((e, i) => (
                        <tr key={i}>
                          <Td>{e.event_type.toLowerCase().replace(/_/g, " ")}</Td>
                          <Td>{e.distribution_year}</Td>
                          <Td>{e.deadline}</Td>
                          <Td>
                            <Chip tone={e.status === "COMPUTED" ? "teal" : e.status === "INDETERMINATE" ? "amber" : "slate"}>{e.status.toLowerCase().replace(/_/g, " ")}</Chip>
                          </Td>
                          <Td align="right">
                            {e.amount ? (
                              <ReceiptButton title={`${e.event_type} receipt`} rows={[{ label: "Amount", value: formatMoney(e.amount) }, { label: "Formula", value: e.formula ?? "—" }, { label: "Basis balance", value: `${formatMoney(e.basis_balance)} as of ${e.basis_as_of}` }, { label: "Owner age", value: String(e.owner_age) }, { label: "Factor", value: `${e.factor} (${e.table_id})` }, { label: "Deadline", value: e.deadline }]}>
                                {formatMoney(e.amount)}
                              </ReceiptButton>
                            ) : (
                              "—"
                            )}
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {r.events.flatMap((e) => e.reasons).map((x, i) => (
                    <p key={i} className="mt-1 text-xs text-ink-muted">
                      • {x.message}
                    </p>
                  ))}
                </div>
              )}
            </div>
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">Comparison with imported plan value</h4>
              {discrepancy ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <ClassificationChip classification={discrepancy.classification} />
                    <Chip tone={discrepancy.comparable ? "neutral" : "slate"}>{discrepancy.comparable ? "comparable" : "not comparable"}</Chip>
                    <Chip tone={discrepancy.status === "DISPOSITIONED" ? "teal" : "amber"}>{discrepancy.status.toLowerCase()}</Chip>
                  </div>
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-line">
                      <tr>
                        <Td>Independent (engine)</Td>
                        <Td align="right" className="font-semibold">
                          {formatMoney(discrepancy.computed_amount)}
                        </Td>
                      </tr>
                      <tr>
                        <Td>
                          Imported <span className="text-ink-muted">({b.household.source_tool_label ?? "plan"}, illustrative)</span>
                        </Td>
                        <Td align="right" className="font-semibold">
                          {ipv ? (
                            <ReceiptButton title="Imported value receipt" subtitle="Declared by the planning tool; a claim, not evidence" rows={[{ label: "Amount", value: formatMoney(ipv.value_decimal, ipv.currency) }, { label: "Metric", value: ipv.metric_key }, { label: "Tax year", value: String(ipv.tax_year) }, { label: "Scope", value: ipv.calculation_scope }, { label: "Balance basis", value: ipv.balance_basis }, { label: "Declared balance", value: ipv.declared_inputs?.balance ? `${formatMoney(ipv.declared_inputs.balance)} as of ${ipv.declared_inputs.balance_as_of ?? "?"}` : "not declared" }, { label: "Declared factor / table", value: `${ipv.declared_inputs?.factor ?? "?"} / ${ipv.declared_inputs?.table ?? "?"}` }, { label: "Method", value: ipv.declared_inputs?.method ?? "not declared" }, { label: "Methodology label", value: ipv.methodology_label ?? "—" }]}>
                              {formatMoney(discrepancy.imported_amount)}
                            </ReceiptButton>
                          ) : (
                            formatMoney(discrepancy.imported_amount)
                          )}
                        </Td>
                      </tr>
                      <tr>
                        <Td>Difference (computed − imported)</Td>
                        <Td align="right" className="font-semibold">
                          {formatMoney(discrepancy.delta_amount)}
                        </Td>
                      </tr>
                      <tr>
                        <Td>Tolerance applied</Td>
                        <Td align="right">{formatMoney(discrepancy.tolerance_applied)}</Td>
                      </tr>
                    </tbody>
                  </table>
                  <p className="text-sm">{discrepancy.explanation}</p>
                  <p className="text-sm text-ink-muted">
                    <span className="font-medium text-ink">Next step:</span> {discrepancy.next_step}
                  </p>
                  {discrepancy.disposition && (
                    <p className="rounded-lg bg-surface-muted p-2 text-xs">
                      Disposition by {personLabel(b, discrepancy.disposition.by) === discrepancy.disposition.by ? discrepancy.disposition.by : personLabel(b, discrepancy.disposition.by)} ({discrepancy.disposition.role}) on {discrepancy.disposition.at.slice(0, 10)}: {discrepancy.disposition.note}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-ink-muted">No imported value to compare for this account and tax year.</p>
              )}
              <details className="mt-4 text-sm">
                <summary className="cursor-pointer font-medium text-navy">Limitations stated by the engine</summary>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-ink-muted">{receipt?.limitations.map((l, i) => <li key={i}>{l}</li>)}</ul>
              </details>
              <details className="mt-2 text-sm">
                <summary className="cursor-pointer font-medium text-navy">Request sent (from the frozen snapshot only)</summary>
                <Mono className="mt-1 block max-h-64 overflow-auto whitespace-pre p-2 text-[11px]">{JSON.stringify(run.request_payload, null, 2)}</Mono>
                <p className="mt-1 text-xs text-ink-muted">
                  Request SHA-256 {run.request_sha256.slice(0, 16)}… · Response SHA-256 {run.response_sha256?.slice(0, 16)}…
                </p>
              </details>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
