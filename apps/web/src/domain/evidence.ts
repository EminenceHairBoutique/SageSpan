import { DISCREPANCY_LABELS, FACT_FIELDS, REVIEW_OUTCOME_DESCRIPTIONS, REVIEW_OUTCOME_LABELS, assertCan, assertTransition, canonicalJson, coverageSummary, formatMoney, latestCheckRuns, packetTitle, type DataState, type EvidencePacket } from "@sagespan/contracts";
import type { Actor } from "@/auth/types";
import { brand } from "@/config/brand";
import { toCsv } from "@/import/csv-export";
import { appendAudit, sha256, verifyAuditChain } from "./audit";
import { DomainError } from "./errors";
import { newId, nowIso } from "./ids";
import { householdBundle, profileName, requireHousehold, subjectLabel, type HouseholdBundle } from "./queries";

export const PACKET_LIMITATIONS = [
  "This is a review evidence packet with source references, recorded assumptions, rule-set versions and reviewer actions. It is not an SEC examination certification, an audit opinion or a guarantee that the plan is correct or suitable.",
  "Only the checks listed under 'scope' were performed. Everything under 'not_checked' was outside scope and no conclusion is expressed about it.",
  "An arithmetic PASS means the independent engine reproduced the amount from the frozen inputs under the cited rule set. Professional approval is a separate human act recorded under 'reviews'.",
  "Differences classified as NOT_COMPARABLE, MISSING_EVIDENCE or UNSUPPORTED_CHECK are not findings of error.",
  "Only the latest check attempt per account was evaluated for approval; earlier attempts are listed with latest_attempt=false as history.",
  "An account marked UNSUPPORTED or INDETERMINATE under 'coverage' received no verified result; 'reviewed with limitations' means exactly that and is not a verified check of those accounts.",
  "Source documents are referenced by SHA-256 hash; the packet does not reproduce their content.",
];

export const NOT_CHECKED = [
  "Federal or state income tax (the draft 2026 ordinary-income module is unpublished)",
  "Social Security benefits, Medicare/IRMAA, estate or longevity analysis",
  "Investment suitability, portfolio construction or performance",
  "Inherited-account, employer-plan, Roth, QCD or multi-IRA aggregation rules",
  "Whether required distributions were actually taken, withheld or reported",
];

export function buildPacket(b: HouseholdBundle, actor: Actor, state: DataState) {
  const snap = b.currentSnapshot;
  if (!snap) throw new DomainError("INVALID_STATE", "No frozen snapshot.");
  const runs = b.checkRuns.filter((r) => r.snapshot_id === snap.id);
  const runIds = new Set(runs.map((r) => r.id));
  const reviews = b.reviews.filter((r) => r.snapshot_id === snap.id);
  const chain = verifyAuditChain(state, b.org.id);
  // S-06 / N-02: scope and title come from per-account coverage of the LATEST attempts, not from the existence of a run.
  const summary = coverageSummary(snap, b.checkRuns, b.discrepancies);
  const { latest } = latestCheckRuns(b.checkRuns, snap.id);
  const latestIds = new Set(latest.map((r) => r.id));
  const approval = reviews.find((r) => r.decision === "APPROVED") ?? null;
  const outcome = approval?.coverage_outcome ?? null;
  const engineRun = latest.find((r) => r.response) ?? null;
  return {
    packet_version: "sagespan.evidence-packet.v2",
    title: packetTitle(summary, outcome),
    coverage: {
      outcome,
      outcome_label: outcome ? REVIEW_OUTCOME_LABELS[outcome] : "Not approved",
      outcome_description: outcome ? REVIEW_OUTCOME_DESCRIPTIONS[outcome] : "No professional approval has been recorded for this snapshot.",
      summary,
      per_account: summary.rows.map((r) => ({ ...r, account_label: b.accounts.find((a) => a.id === r.account_ref)?.label ?? r.account_ref, account_type: snap.canonical_payload.accounts.find((a) => a.id === r.account_ref)?.account_type ?? null })),
    },
    brand: { name: brand.name, status: brand.status },
    synthetic_notice: "All data in this packet is synthetic demonstration data; reviewer identities are simulated.",
    generated_at: nowIso(),
    generated_by: { user_id: actor.user_id, display_name: actor.display_name, role: actor.role, actor_type: actor.actor_type },
    organization: { id: b.org.id, name: b.org.name, policies: b.org.policies },
    household: { id: b.household.id, label: b.household.label, tax_year: b.household.tax_year, revision: snap.revision, source_tool_label: b.household.source_tool_label },
    scope: {
      check_types: summary.check_types,
      accounts: snap.canonical_payload.accounts.map((a) => ({ id: a.id, label: b.accounts.find((x) => x.id === a.id)?.label ?? a.id, account_type: a.account_type, coverage: summary.rows.find((r) => r.account_ref === a.id)?.coverage ?? "NOT_RUN" })),
      accounts_verified: summary.verified + summary.not_required,
      accounts_outside_supported_scope: summary.unsupported + summary.indeterminate,
      policy_at_freeze: snap.canonical_payload.policy,
    },
    not_checked: NOT_CHECKED,
    sources: snap.canonical_payload.source_documents.map((d) => ({ ...d, byte_length: b.documents.find((x) => x.id === d.id)?.byte_length ?? null, vendor_label: b.documents.find((x) => x.id === d.id)?.source_vendor_label ?? null })),
    facts: snap.canonical_payload.facts.map((f) => {
      const full = b.facts.find((x) => x.id === f.id);
      const loc = full?.source_location_id ? b.locations.find((l) => l.id === full.source_location_id) : null;
      return { ...f, label: FACT_FIELDS[f.field_key]?.label ?? f.field_key, subject_label: subjectLabel(b, f.subject_type, f.subject_id), source_location: loc ? { page: loc.page_number, row: loc.row_number, pointer: loc.json_pointer, text: loc.text_span } : null, note: full?.note ?? null };
    }),
    ownership: snap.canonical_payload.ownership,
    beneficiaries: snap.canonical_payload.beneficiaries,
    assumptions: snap.canonical_payload.assumptions,
    exceptions: snap.canonical_payload.exceptions,
    conflicts_resolved: b.conflicts.filter((c) => c.status !== "OPEN").map((c) => ({ id: c.id, field_key: c.field_key, materiality: c.materiality, status: c.status, reason: c.reason, resolution_note: c.resolution_note, resolved_by: profileName(state, c.resolved_by), resolved_at: c.resolved_at, chosen_fact_id: c.chosen_fact_id })),
    snapshot: { id: snap.id, revision: snap.revision, content_sha256: snap.content_sha256, created_at: snap.created_at, created_by: profileName(state, snap.created_by), created_by_role: snap.created_by_role },
    engine: engineRun?.response ? { name: engineRun.response.receipt.engine_name, version: engineRun.response.receipt.engine_version } : null,
    rule_sets: engineRun?.response?.receipt.rule_sets ?? [],
    check_runs: runs.map((r) => ({
      id: r.id,
      account_id: r.request_payload.account.account_ref,
      /** false = an earlier attempt kept as history; it was not evaluated for approval. */
      latest_attempt: latestIds.has(r.id),
      executed_at: r.executed_at,
      executed_by: profileName(state, r.executed_by),
      run_status: r.run_status,
      coverage_status: r.coverage_status,
      request_sha256: r.request_sha256,
      response_sha256: r.response_sha256,
      request_hash_verified: r.request_hash_verified,
      error: r.error,
      result: r.response ? { annual_rmd: r.response.annual_rmd ?? null, eligibility: r.response.eligibility, events: r.response.events, unsupported_reasons: r.response.unsupported_reasons } : null,
      receipt: r.response?.receipt ?? null,
      request: r.request_payload,
    })),
    discrepancies: b.discrepancies.filter((d) => runIds.has(d.check_run_id)).map((d) => ({ ...d, classification_label: DISCREPANCY_LABELS[d.classification], disposition: d.disposition ? { ...d.disposition, by: profileName(state, d.disposition.by) } : null })),
    reviews: reviews.map((r) => ({ id: r.id, decision: r.decision, reviewer: profileName(state, r.reviewer_user_id), reviewer_role: r.reviewer_role, actor_type: r.actor_type, rationale: r.rationale, conflict_attestation: r.conflict_attestation, reviewed_at: r.reviewed_at, coverage_outcome: r.coverage_outcome })),
    comments: b.comments.filter((c) => c.snapshot_id === snap.id).map((c) => ({ author: profileName(state, c.author_user_id), role: c.author_role, body: c.body, created_at: c.created_at })),
    audit_trail: { chain_intact: chain.intact, events: b.audit.map((e) => ({ id: e.id, event_type: e.event_type, entity_type: e.entity_type, entity_id: e.entity_id, actor: profileName(state, e.actor_user_id), actor_role: e.actor_role, actor_type: e.actor_type, created_at: e.created_at, event_hash: e.event_hash, previous_event_hash: e.previous_event_hash }) ) },
    limitations: [...PACKET_LIMITATIONS, ...(runs[0]?.response?.receipt.limitations ?? [])],
  };
}

export type Packet = ReturnType<typeof buildPacket>;

export function generatePacket(state: DataState, actor: Actor, householdId: string): EvidencePacket {
  assertCan(actor.role, "packet.export");
  const hh = requireHousehold(state, actor.org_id, householdId);
  if (!["APPROVED", "EXPORTED"].includes(hh.workflow_status)) throw new DomainError("INVALID_STATE", `Household is ${hh.workflow_status}; a packet can be generated only after APPROVED.`);
  const b = householdBundle(state, actor.org_id, householdId);
  const snap = b.currentSnapshot!;
  const approval = b.reviews.filter((r) => r.snapshot_id === snap.id && r.decision === "APPROVED").at(-1);
  if (!approval) throw new DomainError("INVALID_STATE", "No approval recorded for the current snapshot.");
  const existing = b.packets.find((p) => p.snapshot_id === snap.id && p.review_id === approval.id);
  if (existing) {
    existing.export_count += 1;
    existing.packet_status = "EXPORTED";
    appendAudit(state, { org_id: actor.org_id, actor_user_id: actor.user_id, actor_role: actor.role, actor_type: actor.actor_type, event_type: "PACKET_EXPORTED", entity_type: "evidence_packet", entity_id: existing.id, summary: `Packet ${existing.id} re-exported (export #${existing.export_count}); sha256 ${existing.sha256.slice(0, 12)}…` });
    return existing;
  }
  const packet = buildPacket(b, actor, state);
  const packetHash = sha256(canonicalJson(packet));
  const record: EvidencePacket = { id: newId("pkt"), org_id: actor.org_id, snapshot_id: snap.id, household_id: householdId, review_id: approval.id, generated_by: actor.user_id, generated_at: packet.generated_at, sha256: packetHash, packet_status: "EXPORTED", export_count: 1, packet };
  state.evidence_packets.push(record);
  assertTransition(hh.workflow_status, "EXPORTED");
  hh.workflow_status = "EXPORTED";
  hh.updated_at = nowIso();
  appendAudit(state, { org_id: actor.org_id, actor_user_id: actor.user_id, actor_role: actor.role, actor_type: actor.actor_type, event_type: "PACKET_GENERATED", entity_type: "evidence_packet", entity_id: record.id, summary: `Evidence packet ${record.id} generated for snapshot ${snap.id} (review ${approval.id}); sha256 ${packetHash.slice(0, 12)}…`, payload: { packet_id: record.id, sha256: packetHash } });
  return record;
}

function esc(v: unknown): string {
  return String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export function renderPacketHtml(record: EvidencePacket): string {
  const p = record.packet as Packet;
  const row = (k: string, v: unknown) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`;
  const section = (title: string, body: string) => `<section><h2>${esc(title)}</h2>${body}</section>`;
  const list = (items: string[]) => `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`;
  const factsTable = `<table><thead><tr><th>Subject</th><th>Fact</th><th>Value</th><th>As of</th><th>Status</th><th>Source</th></tr></thead><tbody>${p.facts
    .map((f) => `<tr><td>${esc(f.subject_label)}</td><td>${esc(f.label)}</td><td class="num">${esc(f.value_kind === "NUMBER" ? formatMoney(f.value_number) : f.value_kind === "BOOL" ? (f.value_bool ? "Yes" : "No") : f.value_date ?? f.value_text ?? "")}</td><td>${esc(f.as_of_date)}</td><td>${esc(f.verification_status)}</td><td>${esc(p.sources.find((s) => s.id === f.source_document_id)?.filename ?? "assumption")}${f.source_location ? ` (${esc(f.source_location.row ? `row ${f.source_location.row}` : f.source_location.pointer ?? f.source_location.text ?? "")})` : ""}</td></tr>`)
    .join("")}</tbody></table>`;
  const runs = p.check_runs
    .map((r) => {
      const res = r.result;
      return `<div class="card"><h3>Check run ${esc(r.id)} — ${esc(r.run_status)} (${esc(r.coverage_status ?? "n/a")})${r.latest_attempt ? "" : " — earlier attempt, kept as history"}</h3><table>${row("Account", r.account_id)}${row("Executed", `${r.executed_at} by ${r.executed_by}`)}${row("Request SHA-256", r.request_sha256)}${row("Response SHA-256", r.response_sha256 ?? "")}${row("Request hash verified", r.request_hash_verified === null ? "n/a" : r.request_hash_verified ? "yes" : "NO")}${res?.annual_rmd ? row("Annual RMD (computed)", formatMoney(res.annual_rmd)) : ""}${r.receipt?.formula ? row("Formula", r.receipt.formula) : ""}${r.receipt ? row("Run hash", r.receipt.run_hash) : ""}${r.error ? row("Error", `${r.error.code}: ${r.error.message}`) : ""}</table>${res ? `<h4>Obligation events</h4><table><thead><tr><th>Event</th><th>Year</th><th>Deadline</th><th>Status</th><th>Amount</th></tr></thead><tbody>${res.events.map((e) => `<tr><td>${esc(e.event_type)}</td><td>${esc(e.distribution_year)}</td><td>${esc(e.deadline)}</td><td>${esc(e.status)}</td><td class="num">${esc(e.amount ? formatMoney(e.amount) : "—")}</td></tr>`).join("")}</tbody></table>` : ""}${res?.unsupported_reasons.length ? `<h4>Reasons</h4>${list(res.unsupported_reasons.map((x) => `${x.code}: ${x.message}`))}` : ""}</div>`;
    })
    .join("");
  const disc = p.discrepancies.length
    ? `<table><thead><tr><th>Classification</th><th>Computed</th><th>Imported</th><th>Difference</th><th>Explanation</th><th>Disposition</th></tr></thead><tbody>${p.discrepancies.map((d) => `<tr><td>${esc(d.classification_label)}</td><td class="num">${esc(formatMoney(d.computed_amount))}</td><td class="num">${esc(formatMoney(d.imported_amount))}</td><td class="num">${esc(formatMoney(d.delta_amount))}</td><td>${esc(d.explanation)}</td><td>${esc(d.disposition ? `${d.disposition.by} (${d.disposition.role}) ${d.disposition.at}: ${d.disposition.note}` : "open")}</td></tr>`).join("")}</tbody></table>`
    : "<p>No imported comparison values.</p>";
  const reviews = `<table><thead><tr><th>Decision</th><th>Reviewer</th><th>Role</th><th>Actor type</th><th>Attestation</th><th>At</th><th>Rationale</th></tr></thead><tbody>${p.reviews.map((r) => `<tr><td>${esc(r.decision)}</td><td>${esc(r.reviewer)}</td><td>${esc(r.reviewer_role)}</td><td>${esc(r.actor_type)}</td><td>${r.conflict_attestation ? "yes" : "no"}</td><td>${esc(r.reviewed_at)}</td><td>${esc(r.rationale)}</td></tr>`).join("")}</tbody></table>`;
  const rules = `<table><thead><tr><th>Rule set</th><th>Version</th><th>Status</th><th>Checksum</th><th>Sources</th></tr></thead><tbody>${p.rule_sets.map((r) => `<tr><td>${esc(r.rule_set_id)}</td><td>${esc(r.version)}</td><td>${esc(r.status)}</td><td class="mono">${esc(r.checksum)}</td><td>${esc(r.sources.map((s) => `${s.title} — ${s.citation}`).join("; "))}</td></tr>`).join("")}</tbody></table>`;
  const audit = `<table><thead><tr><th>At</th><th>Event</th><th>Entity</th><th>Actor</th><th>Hash</th></tr></thead><tbody>${p.audit_trail.events.map((e) => `<tr><td>${esc(e.created_at)}</td><td>${esc(e.event_type)}</td><td>${esc(e.entity_type)} ${esc(e.entity_id)}</td><td>${esc(e.actor)} (${esc(e.actor_role ?? e.actor_type)})</td><td class="mono">${esc(e.event_hash.slice(0, 16))}…</td></tr>`).join("")}</tbody></table><p>Audit hash chain intact: <strong>${p.audit_trail.chain_intact ? "yes" : "NO"}</strong></p>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(p.title)} — ${esc(p.household.label)}</title><style>
  body{font-family:"Public Sans","Segoe UI",system-ui,sans-serif;color:#0b1f3a;background:#fff;margin:0;padding:32px;max-width:1100px;margin:auto;font-size:14px;line-height:1.5}
  h1,h2,h3{font-family:"Schibsted Grotesk","Segoe UI",system-ui,sans-serif}h1{font-size:28px;margin:0 0 4px}h2{font-size:18px;margin:28px 0 8px;border-bottom:1px solid #d9e0e8;padding-bottom:4px}h3{font-size:15px;margin:16px 0 6px}
  .banner{background:#fdebd3;color:#92400e;border:1px solid #f3c891;border-radius:8px;padding:10px 14px;margin:16px 0;font-weight:600}
  table{border-collapse:collapse;width:100%;margin:8px 0}th,td{border:1px solid #d9e0e8;padding:6px 8px;text-align:left;vertical-align:top}th{background:#eef2f6;font-weight:600;width:auto}tr>th:first-child{width:220px}.num{text-align:right;font-variant-numeric:tabular-nums}.mono{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;word-break:break-all}
  .card{border:1px solid #d9e0e8;border-radius:10px;padding:12px 14px;margin:10px 0}.meta{color:#4a5b73}ul{margin:4px 0 4px 18px}
  </style></head><body>
  <h1>${esc(p.title)}</h1><div class="meta">${esc(p.brand.name)} (${esc(p.brand.status)} brand) · ${esc(p.household.label)} · tax year ${esc(p.household.tax_year)} · revision ${esc(p.household.revision)} · generated ${esc(p.generated_at)} by ${esc(p.generated_by.display_name)} (${esc(p.generated_by.role)}, ${esc(p.generated_by.actor_type)})</div>
  <div class="banner">${esc(p.synthetic_notice)}</div>
  ${section("Coverage outcome", `<p><strong>${esc(p.coverage.outcome_label)}.</strong> ${esc(p.coverage.outcome_description)}</p><table><thead><tr><th>Account</th><th>Classification at freeze</th><th>Coverage (latest attempt)</th><th>Latest run</th><th>Earlier attempts kept</th></tr></thead><tbody>${p.coverage.per_account.map((r) => `<tr><td>${esc(r.account_label)}</td><td>${esc(r.account_type ?? "")}</td><td>${esc(r.coverage)}${r.coverage_status ? ` (${esc(r.coverage_status)})` : ""}</td><td class="mono">${esc(r.latest_run_id ?? "—")}</td><td class="num">${esc(r.superseded_run_ids.length)}</td></tr>`).join("")}</tbody></table><p>${esc(p.scope.accounts_verified)} of ${esc(p.coverage.summary.accounts_in_scope)} account(s) verified; ${esc(p.scope.accounts_outside_supported_scope)} outside supported scope; ${esc(p.coverage.summary.documented_exceptions)} documented exception(s); ${esc(p.coverage.summary.dispositioned_material_differences)} dispositioned material difference(s). Policy at freeze: tolerance ±${esc(p.scope.policy_at_freeze.tolerance.absolute)} / ${esc(p.scope.policy_at_freeze.tolerance.relative)}, version ${esc(p.scope.policy_at_freeze.policy_sha256)}.</p>`)}
  ${section("Scope and limitations", `<p><strong>Checks performed:</strong> ${esc(p.scope.check_types.join(", "))} on ${esc(p.scope.accounts.map((a) => `${a.label} (${a.account_type}, ${a.coverage})`).join("; "))}.</p><h3>Not checked</h3>${list(p.not_checked)}<h3>Limitations</h3>${list(p.limitations)}`)}
  ${section("Packet integrity", `<table>${row("Packet SHA-256", record.sha256)}${row("Snapshot id", p.snapshot.id)}${row("Snapshot content SHA-256", p.snapshot.content_sha256)}${row("Snapshot frozen", `${p.snapshot.created_at} by ${p.snapshot.created_by} (${p.snapshot.created_by_role})`)}${row("Engine", p.engine ? `${p.engine.name} ${p.engine.version}` : "n/a")}${row("Organisation", p.organization.name)}${row("Firm policy", `separation of duties: ${p.organization.policies.separation_of_duties}; nonmaterial exceptions: ${p.organization.policies.allow_nonmaterial_exceptions}; approvers: ${p.organization.policies.approver_roles.join("/")}`)}</table>`)}
  ${section("Source documents", `<table><thead><tr><th>Id</th><th>Kind</th><th>File</th><th>As of</th><th>SHA-256</th></tr></thead><tbody>${p.sources.map((s) => `<tr><td>${esc(s.id)}</td><td>${esc(s.source_kind)}</td><td>${esc(s.filename)}</td><td>${esc(s.source_as_of ?? "")}</td><td class="mono">${esc(s.sha256)}</td></tr>`).join("")}</tbody></table>`)}
  ${section("Frozen facts", factsTable)}
  ${section("Assumptions and exceptions", `${p.assumptions.length ? `<table><thead><tr><th>Key</th><th>Value</th><th>Basis</th></tr></thead><tbody>${p.assumptions.map((a) => `<tr><td>${esc(a.key)}</td><td>${esc(a.value_text ?? a.value_decimal ?? "")}</td><td>${esc(a.basis)}</td></tr>`).join("")}</tbody></table>` : "<p>No assumptions.</p>"}${p.conflicts_resolved.length ? `<h3>Conflicts resolved / exceptions</h3><table><thead><tr><th>Conflict</th><th>Field</th><th>Materiality</th><th>Status</th><th>Resolution</th><th>By</th></tr></thead><tbody>${p.conflicts_resolved.map((c) => `<tr><td>${esc(c.id)}</td><td>${esc(c.field_key)}</td><td>${esc(c.materiality)}</td><td>${esc(c.status)}</td><td>${esc(c.resolution_note ?? "")}</td><td>${esc(c.resolved_by)} ${esc(c.resolved_at ?? "")}</td></tr>`).join("")}</tbody></table>` : ""}`)}
  ${section("Rule sets", rules)}
  ${section("Independent check runs", runs || "<p>No check runs.</p>")}
  ${section("Comparison with imported plan values", disc)}
  ${section("Reviews and approvals", reviews)}
  ${section("Audit trail", audit)}
  </body></html>`;
}

export function factsCsv(record: EvidencePacket): string {
  const p = record.packet as Packet;
  return toCsv(
    ["subject", "fact", "value", "as_of", "status", "source_file", "source_location"],
    p.facts.map((f) => [f.subject_label, f.label, f.value_kind === "NUMBER" ? f.value_number : f.value_kind === "BOOL" ? String(f.value_bool) : f.value_date ?? f.value_text ?? "", f.as_of_date, f.verification_status, p.sources.find((s) => s.id === f.source_document_id)?.filename ?? "assumption", f.source_location ? (f.source_location.row ? `row ${f.source_location.row}` : f.source_location.pointer ?? f.source_location.text ?? "") : ""]),
  );
}
