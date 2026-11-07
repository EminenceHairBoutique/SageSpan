import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { brand } from "@/config/brand";
import { Alert, ButtonLink, Card, Chip, SectionHeading } from "@/ui/primitives";

export const metadata: Metadata = { title: "SageSpan Personal" };

const sections = [
  { title: "Overview & next steps", status: "Working (synthetic)", text: "Liquid cash vs your floor, essentials covered, typical and low-month margin, the lowest point in the next 90 days, and at most three ranked actions with trade-offs and an 'Ask why'." },
  { title: "Cash flow", status: "Working (synthetic)", text: "Income streams with observed months and reliability, recurring commitments, and a dated day-by-day outlook that flags weeks where essential bills cluster." },
  { title: "Spending", status: "Working (synthetic)", text: "Observed category totals, essential vs discretionary, with no score and no shame. Automatic recurring-charge detection from transactions is a later milestone." },
  { title: "Savings & debt", status: "Working (synthetic)", text: "Balances as dated revisions you update yourself; liabilities with APR, minimums and rate type; your own cash floor and buffer target as hard guardrails." },
  { title: "Scenarios", status: "Working (synthetic)", text: "Debt payoff paths on identical inputs (minimums only, highest rate first, smallest balance first, hybrid) under an extra amount you choose; every figure receipted." },
  { title: "AI assistant", status: "Working (offline mock)", text: "'Understand my finances': grounded explanations of your baseline with every number cited to the calculation that produced it. A live model vendor is gated on consent and contract review." },
  { title: "Learn", status: "Working", text: "Short explainers on capacity, buffers, APR and minimums, irregular income, discretionary spending, investing vocabulary and retirement basics, tied to your own figures where a baseline exists." },
  { title: "Retirement", status: "Readiness gate only", text: "Known / assumed / missing inputs. The projection engine (PLAN-001) is not built, so no outcome is estimated." },
  { title: "Privacy", status: "Model shown; controls proposed", text: "Separate workspaces, member domains and revocable grants are in the data model; real authentication, export and deletion arrive with PR-003." },
];

export default function PersonalPage() {
  return (
    <main id="main" className="mx-auto max-w-6xl px-4 py-14 md:px-6">
      <SectionHeading eyebrow="SageSpan Personal" title="Take the pressure out of everyday money decisions">
        Built for individuals and households who want a clear picture, a short list of realistic actions, and the reasons behind them. Manual entry first: no bank login needed to be useful.
      </SectionHeading>
      <Alert tone="amber" title="Synthetic demonstration, not advice" className="mb-8">
        Maya Castillo is fictional. The engines, receipts, ranking policy and assistant are real code running on fictional inputs. {brand.name} Personal does not recommend securities, manage money or guarantee outcomes.
      </Alert>
      <div className="grid gap-4 md:grid-cols-3">
        {sections.map((s) => (
          <Card key={s.title} title={s.title} actions={<Chip tone={s.status.startsWith("Working") ? "teal" : "amber"}>{s.status}</Chip>}>
            <p className="text-sm text-ink-muted">{s.text}</p>
          </Card>
        ))}
      </div>
      <section className="mt-12 grid gap-8 md:grid-cols-2">
        <div>
          <SectionHeading eyebrow="How decisions are made" title="Evidence → patterns → constraints → options → your choice → monitor" />
          <ol className="list-decimal space-y-2 pl-5 text-sm text-ink-muted">
            <li>You report balances, income months, bills, debts and goals; each carries a date and a state (reported, assumed, missing, stale).</li>
            <li>The calculation service computes the baseline and the outlook and returns a receipt.</li>
            <li>A versioned policy generates candidate actions and rejects any that breach your cash floor or skip a required payment; it ranks the rest by urgency, benefit, input reliability and reversibility.</li>
            <li>You see at most three, with trade-offs, uncertainty and alternatives. You act, snooze, dismiss or disagree; your choice is recorded as its own event.</li>
            <li>Change an input and everything recomputes from a new snapshot; history is kept.</li>
          </ol>
        </div>
        <div>
          <SectionHeading eyebrow="Decision authority" title="What the software may and may not do" />
          <ul className="space-y-2 text-sm text-ink-muted">
            <li><strong className="text-ink">Tier 0 — explain:</strong> education and plain-language explanations.</li>
            <li><strong className="text-ink">Tier 1 — low-risk guidance:</strong> confirm a balance, review a subscription, plan around a low month. Your confirmation; reversible.</li>
            <li><strong className="text-ink">Tier 2 — material choices:</strong> buffer vs extra debt payments, goal pacing. Supported scenario with caveats; your decision.</li>
            <li><strong className="text-ink">Tier 3 — regulated advice:</strong> personalised securities, complex tax or insurance advice. <em>Disabled</em> pending counsel, licensing and model validation.</li>
            <li><strong className="text-ink">Tier 4 — money movement:</strong> transfers, payments, trades. <em>Out of scope.</em></li>
          </ul>
        </div>
      </section>
      <div className="mt-12 flex flex-wrap items-center gap-3">
        <ButtonLink href="/demo/personal" size="lg">
          {brand.personalCta} <ArrowRight size={16} aria-hidden />
        </ButtonLink>
        <Link href="/retirement" className="text-sm font-semibold text-navy hover:underline">
          Retirement Studio →
        </Link>
      </div>
    </main>
  );
}
