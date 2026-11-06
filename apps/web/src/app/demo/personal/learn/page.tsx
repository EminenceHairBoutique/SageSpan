import Link from "next/link";
import { BookOpen } from "lucide-react";
import { formatMoney } from "@sagespan/contracts";
import { Alert, Card, Chip } from "@/ui/primitives";
import { loadPersonal } from "../load";

export const dynamic = "force-dynamic";

/**
 * Education module (Tier 0). Curated, versioned explainers; where a receipted
 * baseline exists, each module shows "in your numbers" using engine figures
 * only. No recommendations, no products, no projections.
 */
export const LEARN_CONTENT_VERSION = "learn-v1";

export default async function LearnPage() {
  const { insights, labels } = await loadPersonal({ ensureBaseline: true });
  const c = insights.clarity;
  const d = insights.debt;
  const av = d?.results.find((r) => r.strategy === "AVALANCHE");
  const mins = d?.results.find((r) => r.strategy === "MINIMUMS_ONLY");
  const yours = (text: string) => (
    <p className="mt-3 rounded-lg border border-teal/30 bg-teal-100/40 px-3 py-2 text-sm text-teal-700">
      <span className="font-semibold">In your numbers: </span>
      {text}
    </p>
  );
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal">Learn</p>
        <h1 className="mt-1 text-2xl font-bold">Short explainers, tied to your own figures</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-muted">Education only (decision tier 0). Each module explains one idea and, where a receipted baseline exists, shows what it means for you. Nothing here recommends a product, a security or a specific action.</p>
      </div>
      <Alert tone="slate" title={`Content ${LEARN_CONTENT_VERSION}`}>
        General information, not financial, tax, investment or legal advice. Figures labelled &quot;in your numbers&quot; are copied from your receipted baseline; the explanations themselves are the same for everyone.
      </Alert>
      <div className="grid gap-5 md:grid-cols-2">
        <Card id="capacity" title="Financial capacity" subtitle="What you can carry each month" actions={<Chip tone="neutral" icon={<BookOpen size={13} aria-hidden />}>5 min</Chip>}>
          <p className="text-sm text-ink-muted">Capacity is the gap between the income you can count on and the commitments you have already made. Two numbers matter more than the average: the <strong>low month</strong> and the <strong>essential commitments</strong>. If the low month covers essentials with room to spare, everything else is a choice; if it does not, the first job is closing that gap, not optimising anything.</p>
          {c && yours(`Your low month is ${formatMoney(c.income.low_monthly)} against ${formatMoney(c.commitments.monthly_essential)} of essentials, leaving ${formatMoney(c.margin.essential_only_low)} before any discretionary spending. Typical margin after usual spending: ${formatMoney(c.margin.typical)}.`)}
        </Card>
        <Card id="buffer" title="The cash floor and the buffer" subtitle="Two different safety ideas">
          <p className="text-sm text-ink-muted">A <strong>floor</strong> is the balance you never want to drop below in the next few weeks; it protects you from overdrafts and late fees. A <strong>buffer</strong> is measured in months of essentials and protects you from a slow month or a surprise bill without borrowing. There is no universal right size: it depends on how regular your income is and how many people depend on it. You choose both; SageSpan treats them as hard constraints.</p>
          {c && yours(`Floor ${formatMoney(c.cash.cash_floor)}, liquid cash ${formatMoney(c.cash.liquid_total)}, covering ${c.cash.essential_buffer_months ?? "—"} months of essentials${c.cash.buffer_target_months ? ` against your ${c.cash.buffer_target_months}-month target (gap ${formatMoney(c.cash.buffer_gap_amount)})` : ""}.`)}
        </Card>
        <Card id="debt" title="APR, minimums and payoff order" subtitle="Why a minimum payment can stand still">
          <p className="text-sm text-ink-muted">Interest on a card accrues roughly at APR ÷ 12 of the balance each month. When the minimum payment is close to that interest, the balance barely moves. Paying more than the minimum shortens the path; <em>which</em> balance gets the extra is the only real choice: highest rate first saves the most interest, smallest balance first clears an account sooner. Both pay every minimum, always.</p>
          {av && mins && yours(`Minimums only would cost ${formatMoney(mins.total_interest)} in interest over ${mins.months_to_payoff ?? "—"} months. Highest-rate-first with your stated extra payment: ${formatMoney(av.total_interest)} over ${av.months_to_payoff ?? "—"} months, ${formatMoney(av.interest_saved_vs_minimums)} less interest.`)}
          {c && !av && c.debt.liability_count > 0 && yours(`Your highest rate is ${c.debt.highest_apr_percent}% on ${labels[c.debt.highest_apr_ref ?? ""] ?? "a liability"}; run Scenarios to compare paths.`)}
        </Card>
        <Card id="buffer-vs-debt" title="Buffer first, or debt first?" subtitle="The trade-off behind your top actions">
          <p className="text-sm text-ink-muted">Extra debt payments save interest only if they never have to be reversed. If a slow month then forces a new charge on the card, the saving evaporates and a fee may be added. That is why a thin buffer usually comes before extra payments, and a solid buffer usually lets extra payments go ahead. The policy in Next steps applies exactly this order and shows its reasoning when you press &quot;Ask why&quot;.</p>
        </Card>
        <Card id="irregular" title="Irregular income habits" subtitle="Planning around the low month">
          <p className="text-sm text-ink-muted">When income varies, budgeting to the average means being short in the slow months and flush in the good ones. The habit that works is the reverse: treat the low month as the budget, and when a good month arrives, move the difference into the reserve first, then to goals. Over a year the result is the same money with far fewer squeezes.</p>
          {c && c.income.classification === "IRREGULAR" && yours(`Across ${c.income.observed_months} months your income ranged from ${formatMoney(c.income.low_monthly)} to ${formatMoney(c.income.high_monthly)}; the outlook already plans on the low figure for your irregular stream.`)}
        </Card>
        <Card id="lifestyle" title="Subscriptions and discretionary spending" subtitle="Information, not a verdict">
          <p className="text-sm text-ink-muted">SageSpan separates essential from discretionary only so that the buffer can be measured against essentials. Discretionary spending is not a problem to fix; it is the part of the month you control. Knowing its typical size tells you how much flexibility you have in a tight week, which is more useful than a score.</p>
          {c && yours(`Usual discretionary spending is ${formatMoney(c.commitments.monthly_discretionary_typical)} a month across ${c.commitments.discretionary_items} categories and subscriptions.`)}
        </Card>
        <Card id="investing" title="Investing basics (education only)" subtitle="Vocabulary before decisions">
          <p className="text-sm text-ink-muted">Account types (taxable, traditional IRA, Roth IRA, workplace plans) differ in when tax is paid, not in what they can hold. Diversification spreads risk across many holdings; concentration does the opposite. Fees compound against you the way returns compound for you. Time horizon changes how much short-term volatility you can tolerate. These are concepts, not instructions: SageSpan does not recommend securities or allocations, and personalised investment advice stays disabled until the legal and model-validation gates in Privacy &amp; trust are met.</p>
        </Card>
        <Card id="retirement" title="Retirement basics" subtitle="Why readiness comes before projections">
          <p className="text-sm text-ink-muted">A retirement plan rests on a handful of inputs: when you stop earning, what you will spend, what you have saved, what you will add, and what Social Security or a pension will pay. If any of those is missing, a projection is a guess dressed as a result, which is why the Studio keeps a readiness gate. Later in life, <strong>required minimum distributions</strong> (RMDs) oblige withdrawals from most pre-tax retirement accounts after an applicable age set by law; the amount depends on the prior-year-end balance and a life-expectancy factor from an IRS table. SageSpan&apos;s assurance engine checks exactly that calculation for advisors, from source statements, with a receipt.</p>
          <p className="mt-2 text-xs text-ink-faint">
            See your readiness gate under <Link href="/demo/personal/retirement" className="font-semibold text-navy hover:underline">Retirement</Link>.
          </p>
        </Card>
      </div>
    </div>
  );
}
