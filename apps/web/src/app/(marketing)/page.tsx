import Link from "next/link";
import { ArrowRight, Bot, Calculator, ClipboardCheck, Compass, FileSearch, GitCompareArrows, HeartHandshake, Scale, ShieldCheck, Sparkles, Wallet } from "lucide-react";
import { brand } from "@/config/brand";
import { PilotInterestForm } from "@/ui/marketing/PilotInterestForm";
import { SampleReceipt } from "@/ui/marketing/SampleReceipt";
import { ButtonLink, Card, Chip, SectionHeading } from "@/ui/primitives";

const personalJobs = [
  { icon: Wallet, title: "Know where you stand", text: "Liquid cash against the floor you choose, months of essentials covered, and your margin in a typical and a low month. Every number is computed by a receipted engine from what you entered." },
  { icon: Compass, title: "Get three next steps, not thirty", text: "A testable policy ranks feasible actions: constraints first (your cash floor, required payments), then urgency, benefit, input reliability and reversibility. You can ask why, snooze, or disagree." },
  { icon: Sparkles, title: "Understand, then decide", text: "An assistant that explains your own baseline, asks the questions that would sharpen it, and never invents a number. Short explainers tie each idea to your figures." },
];

const firmJobs = [
  { icon: FileSearch, title: "Check a plan", text: "Import a permitted plan export plus the source statements. Every fact gets a type, an as-of date, a source location and an evidence state." },
  { icon: GitCompareArrows, title: "Find and classify a discrepancy", text: "Reproduce a supported calculation independently and classify any difference: source conflict, stale input, rule disagreement, methodology, missing evidence, or not comparable." },
  { icon: ClipboardCheck, title: "Review with an AI draft, approve as a human", text: "Grounded AI findings cite facts, documents and receipted runs; reviewers accept, edit, dismiss or request evidence. Approval stays a recorded professional act." },
];

const principles = [
  { icon: Bot, t: "AI proposes and explains", d: "It drafts findings, questions and plain-language summaries from authorised data only." },
  { icon: Calculator, t: "Deterministic engines calculate", d: "Versioned, receipted Python engines own every dollar figure; the web app never does arithmetic." },
  { icon: Scale, t: "Policy and authorisation constrain", d: "Hard constraints reject unsafe actions; tenant and workspace boundaries are enforced on the server." },
  { icon: HeartHandshake, t: "People decide", d: "Individuals accept or dismiss; authorised professionals review and approve. Nothing executes on its own." },
];

const faq = [
  { q: "Is SageSpan a financial advisor?", a: "No. SageSpan Personal gives educational explanations and decision support on your own inputs; it does not recommend securities or manage money. Personalised investment advice stays disabled until the legal and model-validation gates described on Security & Trust are met." },
  { q: "Does the AI do the math?", a: "Never. Every amount comes from a deterministic engine with a receipt (inputs, method version, hash). The AI can only cite those amounts; anything it cannot cite is removed before you see it." },
  { q: "Can my advisor see my personal workspace?", a: "Not because you are their client. Firm and personal workspaces are separate; an advisor sees only what you explicitly grant, for a stated purpose, with an expiry and the right to revoke." },
  { q: "Does an arithmetic PASS mean the plan is right?", a: "No. PASS means the independent engine reproduced the amount from frozen inputs under the cited rule set. Professional approval is a separate, recorded act by an authorised person." },
  { q: "What is real in this build?", a: "Synthetic data only: a fictional individual (Maya Castillo) and fictional firm households (Patel, Okafor, Reyes-Lindqvist, Bauer). The engines, receipts, policy and review workflow are real code; there is no production login, bank connection or live AI vendor." },
];

export default function HomePage() {
  return (
    <main>
      <section className="mx-auto grid max-w-6xl gap-10 px-4 pb-16 pt-14 md:grid-cols-[1.1fr_1fr] md:px-6 md:pt-20">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal">For individuals and households · for advisors and firms</p>
          <h1 className="mt-4 text-4xl font-bold leading-[1.1] text-ink md:text-5xl">{brand.tagline}.</h1>
          <p className="mt-5 max-w-xl text-lg text-ink-muted">
            {brand.name} takes the pressure out of money and retirement decisions: it shows where you stand, proposes a few realistic next steps with their trade-offs, and lets you decide. For advisory firms, the same trusted foundation independently checks, reviews and documents the plans they rely on.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/demo/personal" size="lg">
              {brand.personalCta} <ArrowRight size={16} aria-hidden />
            </ButtonLink>
            <ButtonLink href="/firms" variant="secondary" size="lg">
              {brand.firmCta}
            </ButtonLink>
          </div>
          <p className="mt-4 text-xs text-ink-faint">No sign-up. Synthetic demonstration: fictional people, real engines, receipted numbers. Not financial advice.</p>
        </div>
        <SampleReceipt />
      </section>

      <section className="border-y border-line bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-16 md:px-6">
          <SectionHeading eyebrow="SageSpan Personal" title="Where do I stand, what matters most, and what can I realistically do next?">
            Manual entry first; no bank connection needed. Calm by design: at most three actions, a quiet mode, and no spending scores.
          </SectionHeading>
          <div className="grid gap-5 md:grid-cols-3">
            {personalJobs.map((j) => (
              <Card key={j.title}>
                <j.icon size={22} className="text-teal" aria-hidden />
                <h3 className="mt-3 text-lg font-semibold">{j.title}</h3>
                <p className="mt-2 text-sm text-ink-muted">{j.text}</p>
              </Card>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <ButtonLink href="/personal" variant="secondary">
              About Personal
            </ButtonLink>
            <Link href="/demo/personal" className="inline-flex items-center gap-1 text-sm font-semibold text-navy hover:underline">
              Open Maya&apos;s synthetic workspace <ArrowRight size={14} aria-hidden />
            </Link>
            <Chip tone="amber">Synthetic data</Chip>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 md:px-6">
        <SectionHeading eyebrow="SageSpan Advisor & Assurance" title="Build the plan, and independently challenge it">
          Planning Intelligence drafts and explains; Assurance Intelligence checks calculations, sources, completeness and evidence. The combination is the point: the same foundation, and AI proposals can never certify themselves.
        </SectionHeading>
        <div className="grid gap-5 md:grid-cols-3">
          {firmJobs.map((j) => (
            <Card key={j.title}>
              <j.icon size={22} className="text-navy" aria-hidden />
              <h3 className="mt-3 text-lg font-semibold">{j.title}</h3>
              <p className="mt-2 text-sm text-ink-muted">{j.text}</p>
            </Card>
          ))}
        </div>
        <div className="mt-8 rounded-card border border-conflict/20 bg-conflict-100/40 p-5">
          <p className="font-semibold text-conflict-700">The moment that matters in the firm demo</p>
          <p className="mt-1 text-sm text-ink">
            The Patel household&apos;s custodian statement says $640,000.00 as of 2025-12-31; the planning export says $612,000.00 for the same date. &quot;Freeze snapshot&quot; stays disabled and the gate explains exactly which two source facts disagree. After an authorised resolution: freeze, run the RMD, inspect the $1,098.04 difference, read the AI draft, review and export.
          </p>
          <Link href="/demo/app/households/hh_patel" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-navy underline-offset-2 hover:underline">
            Open the Patel household <ArrowRight size={14} aria-hidden />
          </Link>
        </div>
      </section>

      <section className="border-y border-line bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-16 md:px-6">
          <SectionHeading eyebrow="One operating principle" title="AI proposes. Engines calculate. Policy constrains. People decide.">
            The same four layers serve a household and a compliance team; only the interface and the authority differ.
          </SectionHeading>
          <div className="grid gap-4 md:grid-cols-4">
            {principles.map((p) => (
              <div key={p.t} className="rounded-card border border-line bg-canvas p-4">
                <p.icon size={18} className="text-teal" aria-hidden />
                <h3 className="mt-2 font-semibold">{p.t}</h3>
                <p className="mt-1 text-sm text-ink-muted">{p.d}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 text-sm text-ink-muted">
            <ShieldCheck size={14} className="mr-1 inline text-navy" aria-hidden />
            Read the design on <Link href="/security" className="font-semibold text-navy hover:underline">Security &amp; Trust</Link> and the five-stage lifecycle on <Link href="/how-it-works" className="font-semibold text-navy hover:underline">How It Works</Link>.
          </p>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-10 px-4 py-16 md:grid-cols-2 md:px-6">
        <div>
          <SectionHeading eyebrow="Frequently asked" title="Straight answers" />
          <div className="space-y-3">
            {faq.map((f) => (
              <details key={f.q} className="rounded-lg border border-line bg-surface p-4">
                <summary className="cursor-pointer font-semibold">{f.q}</summary>
                <p className="mt-2 text-sm text-ink-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
        <div id="pilot">
          <SectionHeading eyebrow="Design-partner pilots" title="Help us test the firm hypothesis">
            We are looking for U.S. independent RIAs of roughly 5–50 advisors with an established planning stack. Pilots are limited, separately agreed and subject to legal and security readiness. Consumer research interviews are run separately.
          </SectionHeading>
          <p className="mb-3 text-sm text-ink-muted">This form stores your note locally in this demo build. It does not send email, create an account or subscribe you to anything.</p>
          <PilotInterestForm />
        </div>
      </section>
    </main>
  );
}
