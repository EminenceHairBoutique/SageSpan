import { authorityForTier, type DecisionTier, type Recommendation, type RecommendationPriority, type RecommendationScope } from "./decisions";
import type { DebtPathsResponse, PersonalClarityResponse, Severity } from "./personal-calc";
import { formatMoney } from "./money";

/**
 * Deterministic decision policy for the Personal workspace (V5 §5.2 Layer C,
 * §20.1, Engineering Prompt Annex C).
 *
 * Constraints before scores: a candidate that would breach the user's cash
 * floor, skip a required payment, or rest on missing/stale inputs is rejected
 * or demoted with a stated reason; it is never merely "ranked lower". Scores are
 * explicit, versioned weights; there is no model-generated confidence and no
 * revenue input. Dollar figures come only from engine results (cited by run id).
 *
 * This module performs NO financial arithmetic. It reads engine outputs and
 * compares them; every number it surfaces is copied from a receipted run.
 */
export const DECISION_POLICY_VERSION = "decision-policy.v1";
export const MAX_PRIMARY_ACTIONS = 3;

export interface PolicyInput {
  workspace_id: string;
  clarity: PersonalClarityResponse;
  clarity_run_id: string;
  debt?: DebtPathsResponse | null;
  debt_run_id?: string | null;
  /** Labels for refs so cards read in plain language (id -> label). */
  labels?: Record<string, string>;
  now?: Date;
}

export interface RejectedCandidate {
  code: string;
  title: string;
  reason: string;
}

export interface PolicyOutput {
  policy_version: string;
  primary: Recommendation[];
  more: Recommendation[];
  rejected: RejectedCandidate[];
  /** Human-readable account of the evaluation for the "Ask why" control. */
  rationale: string[];
}

interface Candidate {
  code: string;
  scope: RecommendationScope;
  classification: Recommendation["classification"];
  tier: DecisionTier;
  title: string;
  observed: string;
  why_it_matters: string;
  action: string;
  evidence_refs: string[];
  calculation_refs: string[];
  prerequisites: string[];
  alternatives: string[];
  impact: Recommendation["impact"];
  tradeoffs: string[];
  uncertainty: string[];
  what_would_change_this: string[];
  reversible: boolean;
  recheck_trigger: string | null;
  /** Explicit weights. */
  urgency: number; // 0-40
  benefit: number; // 0-30
  input_reliability: number; // 0-20 (penalised by stale/missing inputs)
  reversibility: number; // 0-10
}

const SEVERITY_URGENCY: Record<Severity, number> = { HIGH: 40, MEDIUM: 25, LOW: 12, INFO: 5 };

function label(input: PolicyInput, ref: string): string {
  return input.labels?.[ref] ?? ref;
}

function money(v: string | null | undefined): string {
  return v == null ? "—" : formatMoney(v);
}

function hasFlag(c: PersonalClarityResponse, code: string): boolean {
  return c.flags.some((f) => f.code === code);
}

function flagsOf(c: PersonalClarityResponse, code: string) {
  return c.flags.filter((f) => f.code === code);
}

function reliabilityScore(c: PersonalClarityResponse, refs: string[]): { score: number; notes: string[] } {
  const notes: string[] = [];
  let score = 20;
  for (const ref of refs) {
    const dq = c.data_quality.find((d) => d.ref === ref);
    if (!dq) continue;
    if (dq.state === "STALE") {
      score -= 8;
      notes.push(`${ref} needs a fresh value`);
    } else if (dq.state === "MISSING" || dq.state === "CONFLICTING") {
      score -= 15;
      notes.push(`${ref} is ${dq.state.toLowerCase()}`);
    } else if (dq.state === "ASSUMED") {
      score -= 4;
      notes.push(`${ref} is assumed`);
    }
  }
  if (c.income.observed_months < 3) {
    score -= 5;
    notes.push(`only ${c.income.observed_months} observed month(s) of income`);
  }
  return { score: Math.max(0, score), notes };
}

function toRecommendation(input: PolicyInput, cand: Candidate, priority: RecommendationPriority, rank: number, total: number): Recommendation {
  const rel = reliabilityScore(input.clarity, cand.evidence_refs);
  const score = cand.urgency + cand.benefit + rel.score + cand.reversibility;
  return {
    recommendation_id: `rec_${input.clarity_run_id}_${cand.code.toLowerCase()}`,
    workspace_id: input.workspace_id,
    policy_version: DECISION_POLICY_VERSION,
    scope: cand.scope,
    classification: cand.classification,
    tier: cand.tier,
    status: "DRAFT_FOR_USER",
    priority,
    title: cand.title,
    observed: cand.observed,
    why_it_matters: cand.why_it_matters,
    action: cand.action,
    evidence_refs: cand.evidence_refs,
    calculation_refs: cand.calculation_refs,
    prerequisites: cand.prerequisites,
    alternatives: cand.alternatives,
    impact: cand.impact,
    tradeoffs: cand.tradeoffs,
    uncertainty: [...cand.uncertainty, ...rel.notes],
    what_would_change_this: cand.what_would_change_this,
    reversible: cand.reversible,
    action_authority: authorityForTier(cand.tier),
    created_by: "POLICY_ENGINE",
    ranking_rationale: `Ranked ${rank} of ${total}: urgency ${cand.urgency}/40, benefit ${cand.benefit}/30, input reliability ${rel.score}/20, reversibility ${cand.reversibility}/10 (total ${score}, ${DECISION_POLICY_VERSION}).`,
    recheck_trigger: cand.recheck_trigger,
    expires_at: null,
  };
}

function scoreOf(input: PolicyInput, cand: Candidate): number {
  return cand.urgency + cand.benefit + reliabilityScore(input.clarity, cand.evidence_refs).score + cand.reversibility;
}

/** Build the candidate set from engine flags and results. Pure; no arithmetic on amounts. */
export function generateCandidates(input: PolicyInput): { candidates: Candidate[]; rejected: RejectedCandidate[]; rationale: string[] } {
  const c = input.clarity;
  const rationale: string[] = [];
  const rejected: RejectedCandidate[] = [];
  const candidates: Candidate[] = [];
  const window = c.income.observed_months ? `${c.income.observed_months} observed months` : "no observed income history";
  const cashBelowFloor = hasFlag(c, "CASH_BELOW_FLOOR");
  const breach = hasFlag(c, "FLOOR_BREACH_PROJECTED");
  const bufferUnderMonth = hasFlag(c, "BUFFER_BELOW_ONE_MONTH");
  const liquidityPressure = cashBelowFloor || breach || bufferUnderMonth;
  // The user's own buffer target ranks ahead of interest savings until it is met (reversible, low-regret ordering).
  const bufferBelowTarget = hasFlag(c, "BUFFER_BELOW_TARGET");

  // --- data quality requests (always eligible; they unblock everything else)
  for (const f of flagsOf(c, "STALE_BALANCE")) {
    candidates.push({
      code: `CONFIRM_${f.refs[0] ?? "BALANCE"}`,
      scope: "DATA_QUALITY",
      classification: "DATA_REQUEST",
      tier: 1,
      title: `Confirm the balance of ${label(input, f.refs[0] ?? "")}`,
      observed: f.message,
      why_it_matters: "Your buffer and outlook start from this balance; an old figure can hide a shortfall or overstate one.",
      action: "Check the account and enter today's balance with its date.",
      evidence_refs: f.refs,
      calculation_refs: [input.clarity_run_id],
      prerequisites: [],
      alternatives: ["Mark the account as no longer in use"],
      impact: { source: "NOT_QUANTIFIED", description: "Updates every figure that depends on liquid cash." },
      tradeoffs: [],
      uncertainty: [],
      what_would_change_this: ["A fresh balance"],
      reversible: true,
      recheck_trigger: "When the balance date is more than 45 days old",
      urgency: 25,
      benefit: 15,
      input_reliability: 20,
      reversibility: 10,
    });
  }
  if (c.result_status === "INSUFFICIENT_DATA") {
    candidates.push({
      code: "ADD_MISSING_BASICS",
      scope: "DATA_QUALITY",
      classification: "DATA_REQUEST",
      tier: 1,
      title: "Add the basics so the picture is complete",
      observed: c.flags.filter((f) => f.code.startsWith("MISSING_")).map((f) => f.message).join(" ") || "Income, expenses or cash balances are missing.",
      why_it_matters: "SageSpan does not guess. Without income, essential bills and cash balances there is no honest baseline to act on.",
      action: "Enter your income months, essential bills and current balances.",
      evidence_refs: [],
      calculation_refs: [input.clarity_run_id],
      prerequisites: [],
      alternatives: [],
      impact: { source: "NOT_QUANTIFIED", description: "Enables the baseline, outlook and next steps." },
      tradeoffs: [],
      uncertainty: ["No conclusion is drawn until these exist."],
      what_would_change_this: ["Completing the inputs"],
      reversible: true,
      recheck_trigger: null,
      urgency: 40,
      benefit: 30,
      input_reliability: 20,
      reversibility: 10,
    });
    rationale.push("Baseline is INSUFFICIENT_DATA: only data requests are proposed.");
    return { candidates, rejected, rationale };
  }

  // --- liquidity first
  if (cashBelowFloor || breach) {
    const o = c.outlook;
    const refs = o.collisions.flatMap((x) => x.refs).slice(0, 6);
    candidates.push({
      code: "PROTECT_CASH_FLOOR",
      scope: "CASH_FLOW",
      classification: "DECISION_SUPPORT",
      tier: 1,
      title: cashBelowFloor ? "Your cash is below the floor you set" : `Projected to dip below your cash floor on ${o.first_floor_breach_date ?? o.lowest_projected_date}`,
      observed: cashBelowFloor ? `Liquid cash ${money(c.cash.liquid_total)} is below your floor of ${money(c.cash.cash_floor)}.` : `Over the next ${o.horizon_days} days the dated outlook reaches a low of ${money(o.lowest_projected_cash)} on ${o.lowest_projected_date}, under your ${money(c.cash.cash_floor)} floor.`,
      why_it_matters: "Dropping under your own floor is the point where a normal bill becomes an overdraft or a missed payment.",
      action: "Before the low point, hold discretionary spending and extra debt payments, and confirm which bills can be timed after income arrives. Do not skip a required payment.",
      evidence_refs: refs,
      calculation_refs: [input.clarity_run_id],
      prerequisites: ["Current balances confirmed"],
      alternatives: ["Move a non-essential payment after the next income date (confirm with the provider first)", "Use savings only if you decide the floor can be lower"],
      impact: { source: "DETERMINISTIC_TOOL", unit: "USD", amount: o.lowest_projected_cash, description: "Lowest projected cash in the window, from the receipted outlook.", calculation_run_ref: input.clarity_run_id },
      tradeoffs: ["Pausing extra debt payments costs some interest for a month"],
      uncertainty: ["The outlook spreads typical discretionary spending evenly; actual timing differs."],
      what_would_change_this: ["Income arriving earlier", "A bill moving", "A fresh balance"],
      reversible: true,
      recheck_trigger: "Daily until the low point passes",
      urgency: 40,
      benefit: 25,
      input_reliability: 20,
      reversibility: 10,
    });
  }

  // --- buffer
  if (bufferUnderMonth || hasFlag(c, "BUFFER_BELOW_TARGET")) {
    const gap = c.cash.buffer_gap_amount;
    candidates.push({
      code: "BUILD_ESSENTIAL_BUFFER",
      scope: "SAVINGS_GOALS",
      classification: "DECISION_SUPPORT",
      tier: 2,
      title: bufferUnderMonth ? "Rebuild at least one month of essentials" : `Build toward your ${c.cash.buffer_target_months}-month essential buffer`,
      observed: `Liquid cash ${money(c.cash.liquid_total)} covers ${c.cash.essential_buffer_months ?? "—"} months of essential commitments (${money(c.commitments.monthly_essential)}/month).`,
      why_it_matters: "A buffer is what lets an irregular month or a surprise bill stay boring instead of becoming debt.",
      action: gap ? `Direct part of your typical margin (${money(c.margin.typical)}) to the reserve until it is ${money(gap)} higher. You choose the pace.` : "Direct part of your typical margin to the reserve.",
      evidence_refs: ["cash", ...c.data_quality.filter((d) => d.ref.startsWith("cash_")).map((d) => d.ref)],
      calculation_refs: [input.clarity_run_id],
      prerequisites: ["Margin stays positive in a low month"],
      alternatives: ["Extra debt payments instead (compare below)", "A smaller buffer target you choose"],
      impact: gap ? { source: "DETERMINISTIC_TOOL", unit: "USD", amount: gap, description: "Gap to your chosen target buffer, from the receipted baseline.", calculation_run_ref: input.clarity_run_id } : { source: "NOT_QUANTIFIED", description: "Buffer gap not quantified." },
      tradeoffs: ["Slower progress on other goals and on interest savings"],
      uncertainty: c.income.classification === "IRREGULAR" ? ["Income is irregular; use the low-month margin when deciding the pace."] : [],
      what_would_change_this: ["A change in essential bills", "Reaching your target"],
      reversible: true,
      recheck_trigger: "Monthly",
      urgency: bufferUnderMonth ? 38 : 22,
      benefit: 25,
      input_reliability: 20,
      reversibility: 8,
    });
  }

  // --- negative margin
  if (hasFlag(c, "NEGATIVE_MARGIN_LOW_MONTH") || hasFlag(c, "NEGATIVE_MARGIN_TYPICAL")) {
    const typical = hasFlag(c, "NEGATIVE_MARGIN_TYPICAL");
    candidates.push({
      code: "CLOSE_MONTHLY_GAP",
      scope: "SPENDING",
      classification: "DECISION_SUPPORT",
      tier: 2,
      title: typical ? "Commitments exceed typical income" : "A low-income month does not cover commitments",
      observed: typical ? `Typical margin ${money(c.margin.typical)}.` : `Margin in a low month ${money(c.margin.low)}; with discretionary spending paused it is ${money(c.margin.essential_only_low)}.`,
      why_it_matters: "A recurring gap is funded by savings or debt until it is closed.",
      action: "Review the discretionary categories and non-essential subscriptions first; then look at the largest essential items.",
      evidence_refs: [],
      calculation_refs: [input.clarity_run_id],
      prerequisites: [],
      alternatives: ["Increase income", "Renegotiate a fixed commitment"],
      impact: { source: "DETERMINISTIC_TOOL", unit: "USD", amount: typical ? c.margin.typical ?? null : c.margin.low ?? null, description: "Monthly margin from the receipted baseline.", calculation_run_ref: input.clarity_run_id },
      tradeoffs: ["Spending changes take effort to keep up"],
      uncertainty: [],
      what_would_change_this: ["A new income stream", "A bill ending"],
      reversible: true,
      recheck_trigger: "Monthly",
      urgency: typical ? 40 : 30,
      benefit: 28,
      input_reliability: 20,
      reversibility: 7,
    });
  }

  // --- high APR debt vs liquidity (uses the debt engine when available)
  const high = flagsOf(c, "HIGH_APR_DEBT");
  if (high.length) {
    const refs = high.flatMap((f) => f.refs);
    const av = input.debt?.results.find((r) => r.strategy === "AVALANCHE" && r.feasible);
    const mins = input.debt?.results.find((r) => r.strategy === "MINIMUMS_ONLY");
    const lowMargin = c.margin.low;
    const marginNegative = lowMargin != null && lowMargin.startsWith("-");
    if (cashBelowFloor) {
      rejected.push({ code: "EXTRA_DEBT_PAYMENT", title: "Pay extra on high-rate debt", reason: "Liquid cash is below your cash floor; extra payments from savings would breach it. Protect the floor first." });
    } else if (marginNegative) {
      rejected.push({ code: "EXTRA_DEBT_PAYMENT", title: "Pay extra on high-rate debt", reason: "In a low-income month there is no margin to fund an extra payment without using the buffer." });
    } else {
      const quantified = av?.interest_saved_vs_minimums != null && input.debt_run_id;
      candidates.push({
        code: "COMPARE_EXTRA_DEBT_PAYMENT",
        scope: "DEBT",
        classification: "DECISION_SUPPORT",
        tier: 2,
        title: `Compare paying extra on ${label(input, refs[0] ?? "")} against keeping cash`,
        observed: `${high.map((f) => f.message).join(" ")} Minimums total ${money(c.debt.total_minimums)}/month.`,
        why_it_matters: "High-rate balances cost more each month than a buffer earns; but paying them down with cash you need next month creates new debt.",
        action: quantified ? `From your margin, the highest-rate-first path uses ${money(input.debt?.liquidity_guard.extra_per_month)} extra per month and finishes ${av?.months_saved_vs_minimums ?? 0} months sooner than minimums only. Choose a pace that keeps your floor.` : "Run the payoff comparison with an extra amount you can keep up in a low month.",
        evidence_refs: refs,
        calculation_refs: quantified ? [input.clarity_run_id, input.debt_run_id!] : [input.clarity_run_id],
        prerequisites: ["Cash stays above your floor", "All minimum payments continue"],
        alternatives: ["Smallest balance first for momentum", "Build the buffer first, then pay extra", "Minimums only while income is uncertain"],
        impact: quantified
          ? { source: "DETERMINISTIC_TOOL", unit: "USD", amount: av!.interest_saved_vs_minimums!, description: "Interest avoided versus minimums only, highest-rate-first path, from the receipted comparison.", calculation_run_ref: input.debt_run_id! }
          : { source: "NOT_QUANTIFIED", description: "Run the payoff comparison to quantify." },
        tradeoffs: ["Less liquidity each month", mins && av ? `Minimums-only interest ${money(mins.total_interest)} vs ${money(av.total_interest)} on this path` : "Interest difference depends on the extra amount"],
        uncertainty: ["Variable rates are held constant in the comparison.", "No new charges are assumed."],
        what_would_change_this: ["Income drops", "The rate changes", "A cheaper balance transfer you choose"],
        reversible: true,
        recheck_trigger: "Monthly, or when a rate changes",
        urgency: liquidityPressure || bufferBelowTarget ? 15 : 28,
        benefit: 26,
        input_reliability: 20,
        reversibility: 6,
      });
      if (liquidityPressure) rationale.push("Extra debt payment demoted: liquidity pressure takes precedence over interest savings.");
      else if (bufferBelowTarget) rationale.push("Extra debt payment demoted: your own buffer target is not met yet, so the reserve ranks first.");
    }
  }

  // --- bill collisions
  for (const col of c.outlook.collisions.slice(0, 1)) {
    candidates.push({
      code: "REVIEW_BILL_COLLISION",
      scope: "CASH_FLOW",
      classification: "DECISION_SUPPORT",
      tier: 1,
      title: `${col.refs.length} essential payments land in the same week`,
      observed: `${money(col.total_due)} due between ${col.window_start} and ${col.window_end}.`,
      why_it_matters: "Timing, not totals, causes most short-term shortfalls.",
      action: "Confirm the due dates and which income arrives before them. If a provider allows a different date, that is their decision to confirm, not an assumption.",
      evidence_refs: col.refs,
      calculation_refs: [input.clarity_run_id],
      prerequisites: [],
      alternatives: ["Set aside the week's total from the previous income"],
      impact: { source: "DETERMINISTIC_TOOL", unit: "USD", amount: col.total_due, description: "Total due in the window, from the receipted outlook.", calculation_run_ref: input.clarity_run_id },
      tradeoffs: [],
      uncertainty: [],
      what_would_change_this: ["A due date changing"],
      reversible: true,
      recheck_trigger: "Before each window",
      urgency: 22,
      benefit: 14,
      input_reliability: 20,
      reversibility: 10,
    });
  }

  // --- irregular income
  if (c.income.classification === "IRREGULAR") {
    candidates.push({
      code: "PLAN_AROUND_LOW_MONTH",
      scope: "CASH_FLOW",
      classification: "DECISION_SUPPORT",
      tier: 1,
      title: "Plan around your low month, not your average",
      observed: `Over ${window}, monthly income ranged from ${money(c.income.low_monthly)} to ${money(c.income.high_monthly)} (typical ${money(c.income.typical_monthly)}).`,
      why_it_matters: "With irregular income the safe budget is the low month; high months are where the buffer and goals get funded.",
      action: `Treat ${money(c.income.low_monthly)} as the planning income. In higher months, move the difference to the reserve first.`,
      evidence_refs: c.flags.filter((f) => f.code === "IRREGULAR_INCOME").flatMap((f) => f.refs),
      calculation_refs: [input.clarity_run_id],
      prerequisites: [],
      alternatives: ["Smooth income through a holding account you top up in high months"],
      impact: { source: "DETERMINISTIC_TOOL", unit: "USD", amount: c.margin.low ?? null, description: "Margin in a low-income month, from the receipted baseline.", calculation_run_ref: input.clarity_run_id },
      tradeoffs: ["Feels conservative in good months"],
      uncertainty: [`Based on ${window}; a longer history sharpens the picture.`],
      what_would_change_this: ["A stable income source", "Six more observed months"],
      reversible: true,
      recheck_trigger: "Each new observed month",
      urgency: 18,
      benefit: 18,
      input_reliability: 20,
      reversibility: 10,
    });
  }

  // --- promo expiry
  for (const f of flagsOf(c, "PROMO_APR_EXPIRING")) {
    candidates.push({
      code: `PROMO_EXPIRY_${f.refs[0] ?? ""}`,
      scope: "DEBT",
      classification: "DECISION_SUPPORT",
      tier: 1,
      title: `A promotional rate ends soon on ${label(input, f.refs[0] ?? "")}`,
      observed: f.message,
      why_it_matters: "Interest on the remaining balance jumps to the standard rate on that date.",
      action: "Decide before the expiry whether to clear the balance, pay it down, or accept the new rate.",
      evidence_refs: f.refs,
      calculation_refs: [input.clarity_run_id],
      prerequisites: [],
      alternatives: [],
      impact: { source: "NOT_QUANTIFIED", description: "Run the payoff comparison with the post-promotional rate to quantify." },
      tradeoffs: [],
      uncertainty: [],
      what_would_change_this: ["The balance reaching zero before expiry"],
      reversible: true,
      recheck_trigger: "Weekly until expiry",
      urgency: 26,
      benefit: 18,
      input_reliability: 20,
      reversibility: 9,
    });
  }

  // --- goals behind schedule
  for (const g of c.goals.filter((x) => x.on_track_for_target_date === false)) {
    candidates.push({
      code: `GOAL_BEHIND_${g.goal_ref}`,
      scope: "SAVINGS_GOALS",
      classification: "DECISION_SUPPORT",
      tier: 1,
      title: `"${g.label}" is behind its target date`,
      observed: `${money(g.saved_amount)} saved of ${money(g.target_amount)}; at the current contribution it takes ${g.months_to_target_at_contribution ?? "—"} more months.`,
      why_it_matters: "Knowing early lets you adjust the date or the pace instead of borrowing at the deadline.",
      action: "Choose: a later date, a higher monthly amount, or a smaller target.",
      evidence_refs: [g.goal_ref],
      calculation_refs: [input.clarity_run_id],
      prerequisites: [],
      alternatives: ["Pause the goal while the buffer is rebuilt"],
      impact: { source: "DETERMINISTIC_TOOL", unit: "USD", amount: g.remaining_amount, description: "Remaining amount to the target, from the receipted baseline.", calculation_run_ref: input.clarity_run_id },
      tradeoffs: ["A higher contribution competes with the buffer and debt"],
      uncertainty: [],
      what_would_change_this: ["A changed target or date"],
      reversible: true,
      recheck_trigger: "Monthly",
      urgency: 12,
      benefit: 12,
      input_reliability: 20,
      reversibility: 10,
    });
  }

  // --- education (tier 0) is always available as a fallback
  candidates.push({
    code: "LEARN_BUFFER_VS_DEBT",
    scope: "EDUCATION",
    classification: "EDUCATION",
    tier: 0,
    title: "Understand how a cash buffer and high-rate debt trade off",
    observed: "A common decision in your situation.",
    why_it_matters: "The order you fund a buffer and pay down debt changes both your interest cost and your resilience.",
    action: "Read the short explainer in Learn; no action is required.",
    evidence_refs: [],
    calculation_refs: [],
    prerequisites: [],
    alternatives: [],
    impact: { source: "NOT_QUANTIFIED", description: "Educational." },
    tradeoffs: [],
    uncertainty: [],
    what_would_change_this: [],
    reversible: true,
    recheck_trigger: null,
    urgency: 2,
    benefit: 8,
    input_reliability: 20,
    reversibility: 10,
  });

  return { candidates, rejected, rationale };
}

/** Evaluate the policy: constraints, ranking, and the three-action limit. Deterministic for identical inputs. */
export function evaluateDecisionPolicy(input: PolicyInput): PolicyOutput {
  const { candidates, rejected, rationale } = generateCandidates(input);
  const ordered = [...candidates].sort((a, b) => scoreOf(input, b) - scoreOf(input, a) || a.code.localeCompare(b.code));
  const total = ordered.length;
  const priorities: RecommendationPriority[] = ["DO_THIS_NOW", "CONSIDER_NEXT", "REVISIT_LATER"];
  const primary = ordered.slice(0, MAX_PRIMARY_ACTIONS).map((c, i) => toRecommendation(input, c, priorities[i] ?? "REVISIT_LATER", i + 1, total));
  const more = ordered.slice(MAX_PRIMARY_ACTIONS).map((c, i) => toRecommendation(input, c, "REVISIT_LATER", MAX_PRIMARY_ACTIONS + i + 1, total));
  rationale.unshift(`${total} candidate(s) evaluated, ${rejected.length} rejected by hard constraints, ${primary.length} shown as primary actions (limit ${MAX_PRIMARY_ACTIONS}).`);
  return { policy_version: DECISION_POLICY_VERSION, primary, more, rejected, rationale };
}
