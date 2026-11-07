import { DebtPathsResponseSchema, PersonalClarityResponseSchema, assertCan, latestCheckRuns, type AiReviewRequest, type CheckRun, type DataState, type Discrepancy, type Fact, type FactConflict, type Role, type SourceDocument } from "@sagespan/contracts";
import type { PersonalActor } from "@/auth/personal-actor";
import type { Actor } from "@/auth/types";
import { householdBundle, type HouseholdBundle } from "@/domain/queries";
import { currentRun, personalBundle, type PersonalBundle } from "@/domain/personal/queries";

/**
 * The evidence resolver is the ONLY path by which AI code sees data. It takes a
 * server-resolved actor, authorises the scope with the same checks the rest of
 * the app uses (org membership + permission for firms, workspace membership for
 * individuals), and returns a minimal GroundingContext:
 *
 *  - the set of ids a model is allowed to cite (current facts, documents with
 *    their known locators, check runs, personal records and engine runs);
 *  - the set of superseded ids (known, never citable as current);
 *  - an amount index per calculation run so a cited dollar figure can be
 *    checked against the receipted run that produced it;
 *  - untrusted text (document snippets, labels) flagged for injection patterns
 *    and passed to the model strictly as data.
 *
 * Nothing outside the authorised household/workspace is ever loaded, so a
 * cross-tenant id simply does not resolve (and the failure message carries the
 * id only, never the foreign record).
 */
export interface GroundingFact {
  id: string;
  subject_type: string;
  subject_id: string;
  field_key: string;
  value: string;
  as_of_date: string;
  verification_status: Fact["verification_status"];
  source_document_id: string | null;
  source_location_id: string | null;
}

export interface GroundingCheckRun {
  id: string;
  account_id: string | null;
  run_status: CheckRun["run_status"];
  coverage_status: string | null;
  executed_at: string;
  is_latest_for_account: boolean;
  unsupported_reasons: string[];
  discrepancy: Pick<Discrepancy, "classification" | "computed_amount" | "imported_amount" | "delta_amount"> | null;
}

export interface UntrustedSnippet {
  source_id: string;
  locator: string | null;
  text: string;
  injection_suspected: boolean;
}

export interface GroundingContext {
  scope: AiReviewRequest["scope"];
  snapshot_id: string | null;
  snapshot_sha256: string | null;
  /** Firm scope only. */
  facts: GroundingFact[];
  superseded_fact_ids: Set<string>;
  conflicts: Array<Pick<FactConflict, "id" | "field_key" | "materiality" | "status" | "fact_ids">>;
  documents: Array<Pick<SourceDocument, "id" | "source_kind" | "filename" | "source_as_of"> & { locators: string[] }>;
  check_runs: GroundingCheckRun[];
  accounts: Array<{ id: string; label: string; account_type: string; has_beneficiary_evidence: boolean }>;
  tax_year: number | null;
  /** Personal scope only (summaries, never raw history dumps). */
  personal: {
    labels: Record<string, string>;
    record_ids: Set<string>;
    clarity_run_id: string | null;
    debt_run_id: string | null;
    flags: Array<{ code: string; severity: string; message: string; refs: string[] }>;
    data_quality: Array<{ ref: string; state: string }>;
    collisions: Array<{ window_start: string; window_end: string; total_due: string; refs: string[] }>;
    headline: Record<string, string | null>;
  } | null;
  /** Every id a finding may reference as current evidence. */
  citable_ids: Set<string>;
  /** document id -> allowed locator strings. */
  locators: Map<string, Set<string>>;
  /** run id -> decimal strings present anywhere in that run's receipted response. */
  amounts_by_run: Map<string, Set<string>>;
  untrusted: UntrustedSnippet[];
}

const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+|any\s+)?(the\s+)?(previous|prior|above|earlier)?\s*(instructions|rules|directions)/i,
  /disregard\s+(your|all|the|any)\s+(previous\s+)?(instructions|rules|policy)/i,
  /system prompt/i,
  /you are now/i,
  /\bPOST\b.*https?:\/\//i,
  /https?:\/\/[^\s]+\/(exfil|collect|hook|webhook)/i,
  /approve\s+(this|the)\s+(plan|review)/i,
  /transfer\s+\$?\d/i,
  /mark\s+(this|the|it|as)[^.]{0,40}?(approved|verified)/i,
];

export function looksLikeInjection(text: string): boolean {
  return INJECTION_PATTERNS.some((re) => re.test(text));
}

function collectDecimals(value: unknown, out: Set<string>): void {
  if (typeof value === "string") {
    if (/^-?\d+\.\d{2}$/.test(value)) out.add(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const v of value) collectDecimals(v, out);
    return;
  }
  if (value && typeof value === "object") for (const v of Object.values(value as Record<string, unknown>)) collectDecimals(v, out);
}

function factValue(f: Fact): string {
  return f.value_number ?? f.value_text ?? f.value_date ?? (f.value_bool == null ? "" : String(f.value_bool));
}

function locatorStrings(b: HouseholdBundle, documentId: string): string[] {
  const out = new Set<string>(["document"]);
  for (const l of b.locations.filter((x) => x.document_id === documentId)) {
    if (l.page_number != null && l.row_number != null) out.add(`page ${l.page_number} row ${l.row_number}`);
    if (l.page_number != null) out.add(`page ${l.page_number}`);
    if (l.row_number != null) out.add(`row ${l.row_number}`);
    if (l.json_pointer) out.add(l.json_pointer);
    out.add(l.id);
  }
  return [...out];
}

/** Firm scope: the actor must belong to the org and hold household.read; the household must be in the actor's org. */
export function resolveFirmContext(state: DataState, actor: Actor, householdId: string): GroundingContext {
  assertCan(actor.role as Role, "household.read");
  const b = householdBundle(state, actor.org_id, householdId); // throws NotFound for a foreign household
  const snapshot = b.currentSnapshot;
  const facts = b.facts.map<GroundingFact>((f) => ({ id: f.id, subject_type: f.subject_type, subject_id: f.subject_id, field_key: f.field_key, value: factValue(f), as_of_date: f.as_of_date, verification_status: f.verification_status, source_document_id: f.source_document_id, source_location_id: f.source_location_id }));
  const superseded = new Set(b.facts.filter((f) => f.superseded).map((f) => f.id));
  // PR-002 (N-02): "latest" is the same rule the approval and the evidence packet use — the latest attempt per
  // (check type, account) on the CURRENT snapshot. Runs on superseded snapshots are never "latest".
  const latestIds = new Set(snapshot ? latestCheckRuns(b.checkRuns, snapshot.id).latest.map((r) => r.id) : []);
  const check_runs = b.checkRuns.map<GroundingCheckRun>((r) => {
    const acct = r.request_payload.account.account_ref;
    const d = b.discrepancies.find((x) => x.check_run_id === r.id);
    return {
      id: r.id,
      account_id: acct,
      run_status: r.run_status,
      coverage_status: r.coverage_status,
      executed_at: r.executed_at,
      is_latest_for_account: latestIds.has(r.id),
      unsupported_reasons: r.response?.unsupported_reasons.map((x) => x.code) ?? (r.error ? [r.error.code] : []),
      discrepancy: d ? { classification: d.classification, computed_amount: d.computed_amount, imported_amount: d.imported_amount, delta_amount: d.delta_amount } : null,
    };
  });
  const amounts = new Map<string, Set<string>>();
  for (const r of b.checkRuns) {
    const s = new Set<string>();
    collectDecimals(r.response, s);
    amounts.set(r.id, s);
  }
  const locators = new Map<string, Set<string>>();
  const documents = b.documents.map((d) => {
    const locs = locatorStrings(b, d.id);
    locators.set(d.id, new Set(locs));
    return { id: d.id, source_kind: d.source_kind, filename: d.filename, source_as_of: d.source_as_of, locators: locs };
  });
  const untrusted: UntrustedSnippet[] = b.locations.filter((l) => l.text_span).map((l) => ({ source_id: l.document_id, locator: l.id, text: l.text_span!, injection_suspected: looksLikeInjection(l.text_span!) }));
  for (const d of b.documents) untrusted.push({ source_id: d.id, locator: null, text: d.filename, injection_suspected: looksLikeInjection(d.filename) });
  const citable = new Set<string>([...facts.filter((f) => !superseded.has(f.id)).map((f) => f.id), ...documents.map((d) => d.id), ...check_runs.map((c) => c.id), ...b.conflicts.map((c) => c.id)]);
  return {
    scope: { kind: "FIRM_HOUSEHOLD", org_id: actor.org_id, household_id: householdId, snapshot_id: snapshot?.id ?? null },
    snapshot_id: snapshot?.id ?? null,
    snapshot_sha256: snapshot?.content_sha256 ?? null,
    facts,
    superseded_fact_ids: superseded,
    conflicts: b.conflicts.map((c) => ({ id: c.id, field_key: c.field_key, materiality: c.materiality, status: c.status, fact_ids: c.fact_ids })),
    documents,
    check_runs,
    accounts: b.accounts.map((a) => ({ id: a.id, label: a.label, account_type: a.account_type, has_beneficiary_evidence: b.beneficiaries.some((x) => x.account_id === a.id) })),
    tax_year: b.household.tax_year,
    personal: null,
    citable_ids: citable,
    locators,
    amounts_by_run: amounts,
    untrusted,
  };
}

/** Personal scope: the actor must be an ACTIVE member of the workspace; firm actors never reach here. */
export function resolvePersonalContext(state: DataState, actor: PersonalActor): GroundingContext {
  const b: PersonalBundle = personalBundle(state, actor); // throws NotFound when the membership is missing/revoked
  return personalContextFromBundle(b);
}

/**
 * AI-CORE-002b — an authorised context is re-resolved from CURRENT state before every tool
 * execution and before RECORD. In the demo that is a synchronous read of the file store; in
 * production it is an RLS-scoped read through the Data track's `PersonalRepository.bundle()`
 * (DATA-001/002), which is async and decided by the database. Both are expressed as this
 * interface so the runtime does not care which backs it. A resolver MUST throw (the
 * resolver's own non-disclosing error) when the actor no longer has access, and MUST return
 * the current snapshot so the runtime can detect drift (`CONTEXT_CHANGED`).
 */
export interface GroundingResolver {
  readonly kind: "FIRM_HOUSEHOLD" | "PERSONAL_WORKSPACE";
  readonly backend: "DEMO_STORE" | "RLS_REPOSITORY" | "TEST";
  resolve(): Promise<GroundingContext>;
}

/** Minimal seam the AI layer needs from the Data track's repository: the authorised bundle, nothing else. */
export interface PersonalBundleSource {
  readonly mode: "DEMO" | "PRODUCTION";
  bundle(): Promise<PersonalBundle>;
}

/** Production-shaped personal resolver: every call is a fresh RLS-scoped read; the database decides what exists. */
export function personalRepositoryResolver(repo: PersonalBundleSource): GroundingResolver {
  return {
    kind: "PERSONAL_WORKSPACE",
    backend: repo.mode === "PRODUCTION" ? "RLS_REPOSITORY" : "DEMO_STORE",
    async resolve() {
      return personalContextFromBundle(await repo.bundle()); // repo.bundle() throws NotFound when access is gone
    },
  };
}

/** Build the personal grounding context from an already-authorised bundle (demo store or RLS repository). */
export function personalContextFromBundle(b: PersonalBundle): GroundingContext {
  const clarityRun = currentRun(b, "PERSONAL_CLARITY");
  const debtRun = currentRun(b, "DEBT_PATHS");
  const clarity = clarityRun?.response ? PersonalClarityResponseSchema.parse(clarityRun.response) : null;
  const debt = debtRun?.response ? DebtPathsResponseSchema.parse(debtRun.response) : null;
  const labels: Record<string, string> = {};
  const recordIds = new Set<string>();
  const untrusted: UntrustedSnippet[] = [];
  const add = (id: string, label: string) => {
    labels[id] = label;
    recordIds.add(id);
    untrusted.push({ source_id: id, locator: null, text: label, injection_suspected: looksLikeInjection(label) });
  };
  for (const a of b.cashAccounts) add(a.account_ref, a.label);
  for (const s of b.incomeStreams) add(s.id, s.label);
  for (const o of b.obligations) add(o.id, o.label);
  for (const v of b.variableSpending) add(v.id, v.category);
  for (const l of b.liabilities) add(l.id, l.label);
  for (const g of b.goals) add(g.id, g.label);
  const amounts = new Map<string, Set<string>>();
  if (clarityRun && clarity) {
    const s = new Set<string>();
    collectDecimals(clarity, s);
    amounts.set(clarityRun.id, s);
  }
  if (debtRun && debt) {
    const s = new Set<string>();
    collectDecimals(debt, s);
    amounts.set(debtRun.id, s);
  }
  const citable = new Set<string>([...recordIds, ...(clarityRun ? [clarityRun.id] : []), ...(debtRun ? [debtRun.id] : [])]);
  return {
    scope: { kind: "PERSONAL_WORKSPACE", workspace_id: b.workspace.id, snapshot_id: b.currentSnapshot?.id ?? null },
    snapshot_id: b.currentSnapshot?.id ?? null,
    snapshot_sha256: b.currentSnapshot?.content_sha256 ?? null,
    facts: [],
    superseded_fact_ids: new Set(),
    conflicts: [],
    documents: [],
    check_runs: [],
    accounts: [],
    tax_year: null,
    personal: {
      labels,
      record_ids: recordIds,
      clarity_run_id: clarityRun?.id ?? null,
      debt_run_id: debtRun?.id ?? null,
      flags: clarity?.flags ?? [],
      data_quality: clarity?.data_quality.map((d) => ({ ref: d.ref, state: d.state })) ?? [],
      collisions: clarity?.outlook.collisions ?? [],
      headline: clarity
        ? {
            result_status: clarity.result_status,
            typical_margin: clarity.margin.typical ?? null,
            low_margin: clarity.margin.low ?? null,
            liquid_total: clarity.cash.liquid_total,
            cash_floor: clarity.cash.cash_floor,
            buffer_months: clarity.cash.essential_buffer_months ?? null,
            buffer_gap: clarity.cash.buffer_gap_amount ?? null,
            income_classification: clarity.income.classification,
            observed_months: String(clarity.income.observed_months),
            lowest_projected_cash: clarity.outlook.lowest_projected_cash,
            lowest_projected_date: clarity.outlook.lowest_projected_date,
            highest_apr_ref: clarity.debt.highest_apr_ref ?? null,
            avalanche_interest_saved: debt?.results.find((r) => r.strategy === "AVALANCHE")?.interest_saved_vs_minimums ?? null,
            avalanche_months_saved: debt?.results.find((r) => r.strategy === "AVALANCHE")?.months_saved_vs_minimums?.toString() ?? null,
          }
        : { result_status: "NO_BASELINE" },
    },
    citable_ids: citable,
    locators: new Map(),
    amounts_by_run: amounts,
    untrusted,
  };
}
