import { AI_REVIEW_SCHEMA_VERSION, AI_TOOLS, type AiAnalysisKind, type AiFinding, type AiModelMetadata, type AiModelOutput } from "@sagespan/contracts";
import { formatMoney } from "@sagespan/contracts";
import type { GroundingContext } from "./evidence-resolver";
import { PROMPT_VERSION, SYSTEM_PROMPT_REVIEW_V1 } from "./prompts/review-v1";

/**
 * Provider adapter boundary. The orchestrator calls `complete()`; the result is
 * UNTRUSTED model output that the validator checks before anything is shown or
 * stored. Three implementations:
 *
 *  - MockDeterministicProvider: derives a grounded draft from the context with
 *    fixed rules. Offline, deterministic, used by the demo and as the AI-000
 *    baseline. It is honest about what it is (mode MOCK_DETERMINISTIC).
 *  - ScriptedProvider: returns a prepared output; evaluation cases use it to
 *    simulate hallucinated ids, invented amounts, forbidden statuses, etc.
 *  - A live adapter is NOT implemented in this build. `resolveProvider()` falls
 *    back to the mock and records why (AI-E17), so a missing or unreviewed
 *    vendor is never silently "AI-powered".
 */
export interface ProviderInput {
  analysis_kind: AiAnalysisKind;
  system_prompt: string;
  prompt_version: string;
  context: GroundingContext;
}

export interface ProviderResult {
  output: AiModelOutput;
  estimated_tokens: number | null;
}

export interface AiProvider {
  readonly name: string;
  readonly model: string;
  readonly mode: AiModelMetadata["mode"];
  complete(input: ProviderInput): Promise<ProviderResult>;
}

export const MOCK_PROVIDER_NAME = "sagespan-mock";
export const MOCK_MODEL = "deterministic-rules-1";

function fid(prefix: string, key: string): string {
  return `f_${prefix}_${key.replace(/[^a-zA-Z0-9]+/g, "_").toLowerCase()}`.slice(0, 80);
}

function firmFindings(ctx: GroundingContext): { findings: AiFinding[]; questions: string[]; limitations: string[]; summary: string; memo: string } {
  const findings: AiFinding[] = [];
  const questions: string[] = [];
  const limitations: string[] = ["Draft prepared from the authorised household record only; nothing here is a verification or an approval."];
  const ty = ctx.tax_year ?? 2026;
  const yearEnd = `${ty - 1}-12-31`;
  const current = ctx.facts.filter((f) => !ctx.superseded_fact_ids.has(f.id));

  // Conflicts: both facts cited, no truth promotion.
  for (const c of ctx.conflicts.filter((x) => x.status === "OPEN")) {
    const facts = current.filter((f) => c.fact_ids.includes(f.id));
    findings.push({
      finding_id: fid("conflict", c.id),
      category: "CONFLICTING_FACTS",
      severity: c.materiality === "MATERIAL" ? "HIGH" : "LOW",
      title: `Two sources disagree on ${c.field_key}`,
      explanation: `${facts.map((f) => `${f.source_document_id ?? "an unsourced record"} reports ${f.field_key} as of ${f.as_of_date}`).join("; ")}. Neither value is treated as correct until a reviewer resolves the conflict with a rationale.`,
      fact_refs: facts.map((f) => f.id),
      document_refs: facts.filter((f) => f.source_document_id).map((f) => ({ id: f.source_document_id!, locator: f.source_location_id ?? "document" })),
      check_run_refs: [],
      cited_amounts: [],
      evidence_status: "UNVERIFIED",
      suggested_next_action: c.materiality === "MATERIAL" ? "Resolve in favour of primary evidence with a recorded rationale before freezing." : "Document an exception under firm policy or resolve.",
      question: `Which source governs ${c.field_key}, and why?`,
    });
    questions.push(`Which source governs ${c.field_key} for this household?`);
  }

  // Missing / stale year-end balances per account, and missing beneficiary evidence.
  for (const a of ctx.accounts) {
    const balances = current.filter((f) => f.subject_id === a.id && f.field_key === "account.year_end_balance");
    const atYearEnd = balances.filter((f) => f.as_of_date === yearEnd);
    if (balances.length === 0) {
      findings.push({ finding_id: fid("missing_bal", a.id), category: "MISSING_EVIDENCE", severity: "HIGH", title: `No ${yearEnd} balance for ${a.label}`, explanation: `The required prior-year-end balance has no fact at all for this account. Without it the RMD check cannot run.`, fact_refs: [], document_refs: [], check_run_refs: [], cited_amounts: [], evidence_status: "UNVERIFIED", suggested_next_action: `Request a dated custodian statement as of ${yearEnd}.`, question: `Is a ${yearEnd} statement available for ${a.label}?` });
      questions.push(`Is a ${yearEnd} statement available for ${a.label}?`);
    } else if (atYearEnd.length === 0) {
      const latest = [...balances].sort((x, y) => y.as_of_date.localeCompare(x.as_of_date))[0]!;
      findings.push({ finding_id: fid("stale_bal", a.id), category: "STALE_EVIDENCE", severity: "HIGH", title: `${a.label}: balance is dated ${latest.as_of_date}, not ${yearEnd}`, explanation: `The only balance on file is as of ${latest.as_of_date}. An RMD needs the ${yearEnd} value; a different date is a freshness problem, not a confirmed input.`, fact_refs: [latest.id], document_refs: latest.source_document_id ? [{ id: latest.source_document_id, locator: latest.source_location_id ?? "document" }] : [], check_run_refs: [], cited_amounts: [], evidence_status: "UNVERIFIED", suggested_next_action: `Obtain the ${yearEnd} custodian statement.`, question: null });
    } else if (atYearEnd.every((f) => f.verification_status === "NEEDS_CONFIRMATION")) {
      findings.push({ finding_id: fid("unconfirmed_bal", a.id), category: "MISSING_EVIDENCE", severity: "MEDIUM", title: `${a.label}: ${yearEnd} balance comes only from a planning export`, explanation: `A planning-tool value is a claim, not evidence. No custodian statement corroborates it.`, fact_refs: atYearEnd.map((f) => f.id), document_refs: atYearEnd.filter((f) => f.source_document_id).map((f) => ({ id: f.source_document_id!, locator: f.source_location_id ?? "document" })), check_run_refs: [], cited_amounts: [], evidence_status: "UNVERIFIED", suggested_next_action: "Request the custodian statement to corroborate.", question: null });
    }
    if (!a.has_beneficiary_evidence) {
      findings.push({ finding_id: fid("missing_benef", a.id), category: "MISSING_EVIDENCE", severity: "MEDIUM", title: `No beneficiary designation on file for ${a.label}`, explanation: "Whether the Uniform Lifetime Table applies depends on the beneficiary situation; it is not assumed.", fact_refs: [], document_refs: [], check_run_refs: [], cited_amounts: [], evidence_status: "UNVERIFIED", suggested_next_action: "Request the beneficiary designation form.", question: `Who is the primary beneficiary of ${a.label}, and since when?` });
      questions.push(`Who is the primary beneficiary of ${a.label}?`);
    }
  }

  // Check runs: latest per account only; history is history.
  const latest = ctx.check_runs.filter((r) => r.is_latest_for_account);
  for (const r of latest) {
    const acct = ctx.accounts.find((a) => a.id === r.account_id);
    const label = acct?.label ?? r.account_id ?? "account";
    const older = ctx.check_runs.filter((x) => x.account_id === r.account_id && x.id !== r.id);
    if (r.run_status === "PASS" && r.discrepancy && r.discrepancy.computed_amount && r.discrepancy.imported_amount && r.discrepancy.delta_amount) {
      findings.push({
        finding_id: fid("discrepancy", r.id),
        category: "CHECK_DISCREPANCY",
        severity: r.discrepancy.classification === "WITHIN_TOLERANCE" ? "INFO" : "HIGH",
        title: `${label}: independent RMD ${formatMoney(r.discrepancy.computed_amount)} vs imported ${formatMoney(r.discrepancy.imported_amount)}`,
        explanation: `The engine reproduced ${formatMoney(r.discrepancy.computed_amount)} from the frozen inputs; the plan reported ${formatMoney(r.discrepancy.imported_amount)}, a difference of ${formatMoney(r.discrepancy.delta_amount)} classified as ${r.discrepancy.classification.replace(/_/g, " ").toLowerCase()}.${older.length ? ` ${older.length} earlier run(s) are retained as history.` : ""}`,
        fact_refs: [],
        document_refs: [],
        check_run_refs: [r.id],
        cited_amounts: [
          { amount: r.discrepancy.computed_amount, currency: "USD", check_run_ref: r.id, field: "discrepancy.computed_amount" },
          { amount: r.discrepancy.imported_amount, currency: "USD", check_run_ref: r.id, field: "discrepancy.imported_amount" },
          { amount: r.discrepancy.delta_amount, currency: "USD", check_run_ref: r.id, field: "discrepancy.difference" },
        ],
        evidence_status: "TOOL_BACKED",
        suggested_next_action: "Record a disposition explaining the attributed cause.",
        question: null,
      });
    } else if (r.run_status === "UNSUPPORTED" || r.run_status === "INDETERMINATE") {
      findings.push({ finding_id: fid("unsupported", r.id), category: "UNSUPPORTED_CHECK", severity: "MEDIUM", title: `${label}: check returned ${r.run_status}`, explanation: `Reasons: ${r.unsupported_reasons.join(", ") || "not stated"}. Neither the engine figure nor the plan figure can be relied on for this account; a qualified human must follow up.`, fact_refs: [], document_refs: [], check_run_refs: [r.id], cited_amounts: [], evidence_status: "UNVERIFIED", suggested_next_action: "Route to a reviewer; this account has no supported result to rely on.", question: null });
      limitations.push(`${label}: no supported calculation exists; nothing about this account is verified.`);
    } else if (r.run_status === "ERROR") {
      findings.push({ finding_id: fid("error", r.id), category: "UNSUPPORTED_CHECK", severity: "HIGH", title: `${label}: the current check failed`, explanation: `The latest run ended in ERROR (${r.unsupported_reasons.join(", ") || "service error"}). ${older.some((o) => o.run_status === "PASS") ? "An earlier successful run exists but is superseded by this failure and must not be reused." : ""}`.trim(), fact_refs: [], document_refs: [], check_run_refs: [r.id], cited_amounts: [], evidence_status: "UNVERIFIED", suggested_next_action: "Re-run the check after the service issue is resolved.", question: null });
    } else if (r.run_status === "NOT_REQUIRED") {
      findings.push({ finding_id: fid("not_required", r.id), category: "PATTERN_OBSERVATION", severity: "INFO", title: `${label}: no lifetime RMD required under the supported scope`, explanation: `The engine returned NOT_REQUIRED (${r.unsupported_reasons.join(", ") || "per rule set"}).`, fact_refs: [], document_refs: [], check_run_refs: [r.id], cited_amounts: [], evidence_status: "UNVERIFIED", suggested_next_action: null, question: null });
    }
  }
  if (ctx.check_runs.length === 0) limitations.push("No independent check has been run yet; there is no calculation to review.");
  if (latest.length && latest.every((r) => r.run_status !== "PASS")) limitations.push("No account has a supported PASS; this household has no verified check.");

  // Assumptions.
  for (const f of current.filter((x) => x.verification_status === "FACT_ASSUMED")) {
    findings.push({ finding_id: fid("assumed", f.id), category: "ASSUMPTION_RISK", severity: "LOW", title: `${f.field_key} is an assumption`, explanation: `${f.field_key} = ${f.value} is recorded as assumed (as of ${f.as_of_date}), not evidenced.`, fact_refs: [f.id], document_refs: [], check_run_refs: [], cited_amounts: [], evidence_status: "UNVERIFIED", suggested_next_action: "Confirm with a dated source if material.", question: null });
  }

  const summary = `${findings.length} draft finding(s): ${findings.filter((f) => f.category === "CONFLICTING_FACTS").length} conflict(s), ${findings.filter((f) => f.category === "MISSING_EVIDENCE" || f.category === "STALE_EVIDENCE").length} evidence gap(s), ${findings.filter((f) => f.category === "CHECK_DISCREPANCY").length} check discrepancy(ies), ${findings.filter((f) => f.category === "UNSUPPORTED_CHECK").length} unsupported/failed check(s).`;
  const memo = `DRAFT reviewer memo (not approved).\n\n${findings.map((f) => `- [${f.category}] ${f.title}: ${f.suggested_next_action ?? "no action proposed"}`).join("\n")}\n\nLimitations: ${limitations.join(" ")}`;
  return { findings, questions: [...new Set(questions)], limitations, summary, memo };
}

function personalFindings(ctx: GroundingContext): { findings: AiFinding[]; questions: string[]; limitations: string[]; summary: string; memo: string } {
  const p = ctx.personal!;
  const findings: AiFinding[] = [];
  const questions: string[] = [];
  const limitations: string[] = ["Explanations of your own receipted baseline; not financial, tax, investment or legal advice.", "Nothing here changes a fact, a calculation or a decision; you decide."];
  const run = p.clarity_run_id;
  if (!run || p.headline["result_status"] === "NO_BASELINE") {
    findings.push({ finding_id: "f_personal_no_baseline", category: "FOLLOWUP_QUESTION", severity: "INFO", title: "No baseline yet", explanation: "Refresh your baseline so there are receipted numbers to explain.", fact_refs: [], document_refs: [], check_run_refs: [], cited_amounts: [], evidence_status: "UNVERIFIED", suggested_next_action: "Run the baseline from the Overview.", question: null });
    return { findings, questions, limitations, summary: "No baseline to explain.", memo: "" };
  }
  const amt = (field: string, value: string | null | undefined) => (value ? [{ amount: value, currency: "USD", check_run_ref: run, field }] : []);
  const h = p.headline;
  if (h["result_status"] === "INSUFFICIENT_DATA") {
    findings.push({ finding_id: "f_personal_insufficient", category: "FOLLOWUP_QUESTION", severity: "HIGH", title: "The picture is incomplete", explanation: "Income, expenses or balances are missing, so no margin or buffer is stated. SageSpan does not fill gaps with guesses.", fact_refs: [], document_refs: [], check_run_refs: [run], cited_amounts: [], evidence_status: "UNVERIFIED", suggested_next_action: "Add the missing items.", question: "Which of income, bills or balances can you add now?" });
  } else {
    findings.push({
      finding_id: "f_personal_where_i_stand",
      category: "PATTERN_OBSERVATION",
      severity: "INFO",
      title: "Where you stand this month",
      explanation: `Your liquid cash is ${formatMoney(h["liquid_total"])} against the ${formatMoney(h["cash_floor"])} floor you chose, covering about ${h["buffer_months"] ?? "—"} months of essentials. In a typical month ${formatMoney(h["typical_margin"])} is left after commitments and usual spending; in a low month it is ${formatMoney(h["low_margin"])}.`,
      fact_refs: [],
      document_refs: [],
      check_run_refs: [run],
      cited_amounts: [...amt("cash.liquid_total", h["liquid_total"]!), ...amt("cash.cash_floor", h["cash_floor"]!), ...amt("margin.typical", h["typical_margin"]), ...amt("margin.low", h["low_margin"])],
      evidence_status: "TOOL_BACKED",
      suggested_next_action: null,
      question: null,
    });
    if (h["income_classification"] === "IRREGULAR") {
      findings.push({ finding_id: "f_personal_irregular", category: "PATTERN_OBSERVATION", severity: "MEDIUM", title: "Your income is irregular, so the low month is the one to plan around", explanation: `Across ${h["observed_months"]} observed months your income varied enough to count as irregular. The outlook already uses the lowest month for your irregular stream; budgets built on the average will feel tight in slow months.`, fact_refs: p.flags.filter((f) => f.code === "IRREGULAR_INCOME").flatMap((f) => f.refs), document_refs: [], check_run_refs: [run], cited_amounts: [], evidence_status: "UNVERIFIED", suggested_next_action: "Treat the low month as your planning income.", question: null });
    }
    if (h["buffer_gap"] && h["buffer_gap"] !== "0.00") {
      findings.push({ finding_id: "f_personal_buffer_gap", category: "PATTERN_OBSERVATION", severity: "MEDIUM", title: "Your reserve is below the target you set", explanation: `You are ${formatMoney(h["buffer_gap"])} short of your own buffer target. This is your target, not a rule; it matters because a buffer is what keeps a slow month from becoming card debt.`, fact_refs: [], document_refs: [], check_run_refs: [run], cited_amounts: amt("cash.buffer_gap_amount", h["buffer_gap"]), evidence_status: "TOOL_BACKED", suggested_next_action: "Decide a monthly pace for the reserve in Next steps.", question: null });
    }
    if (h["highest_apr_ref"] && p.debt_run_id && h["avalanche_interest_saved"]) {
      findings.push({ finding_id: "f_personal_debt_tradeoff", category: "PATTERN_OBSERVATION", severity: "MEDIUM", title: `Paying extra on ${p.labels[h["highest_apr_ref"]] ?? "your highest-rate debt"} would avoid ${formatMoney(h["avalanche_interest_saved"])} in interest`, explanation: `Compared with minimums only, the highest-rate-first path on your stated extra payment avoids ${formatMoney(h["avalanche_interest_saved"])} of interest and finishes ${h["avalanche_months_saved"] ?? "—"} months sooner. The trade-off is less cash each month, which is why the buffer question comes first.`, fact_refs: [h["highest_apr_ref"]], document_refs: [], check_run_refs: [p.debt_run_id], cited_amounts: [{ amount: h["avalanche_interest_saved"], currency: "USD", check_run_ref: p.debt_run_id, field: "results.AVALANCHE.interest_saved_vs_minimums" }], evidence_status: "TOOL_BACKED", suggested_next_action: "Compare the paths in Scenarios before choosing a pace.", question: null });
    }
    for (const c of p.collisions.slice(0, 1)) {
      findings.push({ finding_id: "f_personal_collision", category: "PATTERN_OBSERVATION", severity: "LOW", title: "Several essential payments land in the same week", explanation: `${c.refs.length} essential payments totalling ${formatMoney(c.total_due)} fall between ${c.window_start} and ${c.window_end}. Timing causes most short-term squeezes; knowing the week lets you set the money aside from the previous income.`, fact_refs: c.refs, document_refs: [], check_run_refs: [run], cited_amounts: amt("outlook.collisions[0].total_due", c.total_due), evidence_status: "TOOL_BACKED", suggested_next_action: "Check which income arrives before that week.", question: null });
    }
  }
  for (const d of p.data_quality.filter((x) => x.state === "STALE" || x.state === "MISSING" || x.state === "CONFLICTING")) {
    findings.push({ finding_id: fid("personal_dq", d.ref), category: "FOLLOWUP_QUESTION", severity: "MEDIUM", title: `${p.labels[d.ref] ?? d.ref} needs a fresh value`, explanation: `This item is ${d.state.toLowerCase()}; figures that depend on it are less reliable until it is updated.`, fact_refs: [d.ref], document_refs: [], check_run_refs: [run], cited_amounts: [], evidence_status: "UNVERIFIED", suggested_next_action: "Update it in Savings & debt.", question: `What is the current value of ${p.labels[d.ref] ?? d.ref}?` });
    questions.push(`What is the current value of ${p.labels[d.ref] ?? d.ref}?`);
  }
  findings.push({ finding_id: "f_personal_learn", category: "EDUCATION", severity: "INFO", title: "Why the buffer question comes before the debt question", explanation: "A reserve covers a slow month without new borrowing; interest savings from extra payments only help if the payment never has to be reversed with a card. The Learn section walks through this trade-off with your own numbers.", fact_refs: [], document_refs: [], check_run_refs: [], cited_amounts: [], evidence_status: "UNVERIFIED", suggested_next_action: null, question: null });
  const summary = `${findings.length} draft note(s) explaining your receipted baseline. ${questions.length ? `${questions.length} question(s) would sharpen it.` : ""}`.trim();
  return { findings, questions, limitations, summary, memo: "" };
}

export class MockDeterministicProvider implements AiProvider {
  readonly name = MOCK_PROVIDER_NAME;
  readonly model = MOCK_MODEL;
  readonly mode = "MOCK_DETERMINISTIC" as const;
  async complete(input: ProviderInput): Promise<ProviderResult> {
    const built = input.context.scope.kind === "FIRM_HOUSEHOLD" ? firmFindings(input.context) : personalFindings(input.context);
    // The mock reads untrusted snippets as DATA only: it never changes behaviour because of them, and it never requests tools.
    const output: AiModelOutput = {
      schema_version: AI_REVIEW_SCHEMA_VERSION,
      status: "DRAFT_FOR_HUMAN_REVIEW",
      findings: built.findings,
      summary: built.summary,
      draft_memo: built.memo || undefined,
      questions: built.questions,
      limitations: built.limitations,
      tool_calls: [],
    };
    const chars = JSON.stringify(output).length + input.system_prompt.length;
    return { output, estimated_tokens: Math.ceil(chars / 4) };
  }
}

export class ScriptedProvider implements AiProvider {
  readonly name = "scripted-test";
  readonly model: string;
  readonly mode = "SCRIPTED_TEST" as const;
  constructor(
    private readonly script: (input: ProviderInput) => AiModelOutput,
    model = "scripted-1",
  ) {
    this.model = model;
  }
  async complete(input: ProviderInput): Promise<ProviderResult> {
    return { output: this.script(input), estimated_tokens: null };
  }
}

export interface ProviderResolution {
  provider: AiProvider;
  note: string | null;
}

/**
 * Select the provider for this process. A live adapter requires server-side
 * configuration AND a reviewed vendor data-processing agreement (release gate
 * G3). Neither exists in this build, so configuration alone yields the mock plus
 * an explicit note rather than a silent "live" claim.
 */
export function resolveProvider(env: Record<string, string | undefined> = process.env): ProviderResolution {
  const configured = env.SAGESPAN_AI_PROVIDER?.trim();
  if (configured && configured !== "mock") {
    return { provider: new MockDeterministicProvider(), note: `SAGESPAN_AI_PROVIDER="${configured}" is set but no live adapter is implemented in this build (vendor review gate G3 not passed). Using the deterministic mock.` };
  }
  return { provider: new MockDeterministicProvider(), note: null };
}

export function buildProviderInput(analysis_kind: AiAnalysisKind, context: GroundingContext): ProviderInput {
  const system_prompt = `${SYSTEM_PROMPT_REVIEW_V1}\n\nTOOLS_ALLOWED: ${AI_TOOLS.join(", ")}\nCITABLE_IDS: ${[...context.citable_ids].join(", ")}\n\nDATA (untrusted):\n${context.untrusted.map((u) => `- [${u.source_id}${u.locator ? ` ${u.locator}` : ""}] ${u.text}`).join("\n")}`;
  return { analysis_kind, system_prompt, prompt_version: PROMPT_VERSION, context };
}
