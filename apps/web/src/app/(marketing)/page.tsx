import Link from "next/link";
import { ArrowRight, FileSearch, GitCompareArrows, ClipboardCheck, Upload, Scale, Lock, Calculator, Stamp } from "lucide-react";
import { brand } from "@/config/brand";
import { PilotInterestForm } from "@/ui/marketing/PilotInterestForm";
import { SampleReceipt } from "@/ui/marketing/SampleReceipt";
import { ButtonLink, Card, SectionHeading } from "@/ui/primitives";

const jobs = [
  { icon: FileSearch, title: "Check a plan", text: "Import a permitted plan export plus the source statements. Every fact gets a type, an as-of date, a source location and one of four evidence states." },
  { icon: GitCompareArrows, title: "Find a discrepancy", text: "Reproduce a supported calculation independently and classify any difference: source conflict, stale input, rule disagreement, methodology, missing evidence, or not comparable." },
  { icon: ClipboardCheck, title: "Document a review", text: "Freeze an immutable snapshot, record the authorised reviewer's disposition and approval, and export a review evidence packet with hashes, rule versions and limitations." },
];

const steps = [
  { icon: Upload, title: "Import", text: "Supported CSV/JSON export and source documents; SHA-256 recorded before parsing." },
  { icon: Scale, title: "Reconcile", text: "Typed facts with owners, units and as-of dates. Conflicts and stale dates must be acknowledged." },
  { icon: Lock, title: "Freeze", text: "Material conflicts block the snapshot. Resolution creates a new revision, never a silent edit." },
  { icon: Calculator, title: "Check", text: "A separate deterministic engine computes the supported rule and returns a receipt with rule versions." },
  { icon: Stamp, title: "Review & export", text: "Human disposition and approval with identity, role, rationale and attestation. Packet export." },
];

const notDo = [
  "Replace your planning software or rebuild the client's plan",
  "Trade, move money, connect to custodians or execute anything",
  "Approve anything automatically, or let an AI model do the arithmetic",
  "Claim an 'exam-proof' or SEC-certified packet",
  "Run Monte Carlo, multi-state tax, Social Security or estate analysis in this release",
  "Promise compatibility with any named vendor until an export format is actually mapped",
];

const faq = [
  { q: "Is this a planning tool?", a: "No. It reviews plans produced elsewhere. The first supported check is the owner-held traditional IRA required minimum distribution; additional checks are added one at a time with golden tests." },
  { q: "What happens when the numbers differ?", a: "A difference is classified before anyone calls it an error. If the plan used a different balance, that is a source conflict; if the dates differ, that is freshness; if the methodology differs, it may be not comparable. Only when inputs and method are normalised is a difference a rule disagreement." },
  { q: "Does an arithmetic PASS mean the plan is right?", a: "No. PASS means the independent engine reproduced the amount from the frozen inputs under the cited rule set. Professional approval is a separate recorded act by an authorised person." },
  { q: "Where does client data go?", a: "This build processes synthetic data only. The design is server-authoritative with tenant isolation in the database. Real-document use requires the legal, privacy and security gates listed on the Security page." },
  { q: "Is independent cross-tool checking a unique capability?", a: "We treat it as a market hypothesis to validate with firms, not a claimed monopoly. Several vendors market verifiable or headless planning math; the question we are testing is whether firms value an independent record across tools." },
];

export default function HomePage() {
  return (
    <main>
      <section className="mx-auto grid max-w-6xl gap-10 px-4 pb-16 pt-14 md:grid-cols-[1.1fr_1fr] md:px-6 md:pt-20">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal">For U.S. RIA compliance and planning teams · hypothesis under validation</p>
          <h1 className="mt-4 text-4xl font-bold leading-[1.1] text-ink md:text-5xl">{brand.tagline}.</h1>
          <p className="mt-5 max-w-xl text-lg text-ink-muted">
            {brand.name} independently re-checks retirement plans produced in your existing planning software: it reconciles source facts, reproduces supported calculations, classifies what differs, and preserves who reviewed what, against which sources and rules.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/demo/app/reviews" size="lg">
              Open the synthetic demo <ArrowRight size={16} aria-hidden />
            </ButtonLink>
            <ButtonLink href="/product" variant="secondary" size="lg">
              How it works
            </ButtonLink>
          </div>
          <p className="mt-4 text-xs text-ink-faint">No sign-up. Fictional households, simulated reviewers, real calculation engine.</p>
        </div>
        <SampleReceipt />
      </section>

      <section className="border-y border-line bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-16 md:px-6">
          <SectionHeading eyebrow="Three jobs" title="What a firm actually needs done">
            The promise is traceable checking within a disclosed scope: what was checked, against which sources and rules, what could not be checked, what differed, and who reviewed it.
          </SectionHeading>
          <div className="grid gap-5 md:grid-cols-3">
            {jobs.map((j) => (
              <Card key={j.title}>
                <j.icon size={22} className="text-teal" aria-hidden />
                <h3 className="mt-3 text-lg font-semibold">{j.title}</h3>
                <p className="mt-2 text-sm text-ink-muted">{j.text}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 md:px-6">
        <SectionHeading eyebrow="Five steps" title="Import → reconcile → freeze → check → review">
          Each step is server-authoritative and audited. Nothing in the workflow is just UI styling.
        </SectionHeading>
        <ol className="grid gap-4 md:grid-cols-5">
          {steps.map((s, i) => (
            <li key={s.title} className="rounded-card border border-line bg-surface p-4 shadow-card">
              <div className="flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-navy text-xs font-bold text-white">{i + 1}</span>
                <s.icon size={18} className="text-navy" aria-hidden />
              </div>
              <h3 className="mt-3 font-semibold">{s.title}</h3>
              <p className="mt-1 text-sm text-ink-muted">{s.text}</p>
            </li>
          ))}
        </ol>
        <div className="mt-8 rounded-card border border-conflict/20 bg-conflict-100/40 p-5">
          <p className="font-semibold text-conflict-700">The moment that matters in the demo</p>
          <p className="mt-1 text-sm text-ink">
            The Patel household&apos;s custodian statement says $640,000.00 as of 2025-12-31; the planning export says $612,000.00 for the same date. &quot;Freeze snapshot&quot; stays disabled and the gate explains exactly which two source facts disagree, their dates, and how to resolve or document the exception. After an authorised resolution: freeze, run the RMD, inspect the $1,098.04 difference, review and export.
          </p>
          <Link href="/demo/app/households/hh_patel" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-navy underline-offset-2 hover:underline">
            Open the Patel household <ArrowRight size={14} aria-hidden />
          </Link>
        </div>
      </section>

      <section className="border-y border-line bg-surface">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 md:grid-cols-2 md:px-6">
          <div>
            <SectionHeading eyebrow="What we do not do" title="Boundaries, stated up front" />
            <ul className="space-y-2">
              {notDo.map((n) => (
                <li key={n} className="flex gap-2 text-sm">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-conflict" aria-hidden />
                  {n}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <SectionHeading eyebrow="Frequently asked" title="Straight answers" />
            <div className="space-y-3">
              {faq.map((f) => (
                <details key={f.q} className="rounded-lg border border-line bg-canvas p-4">
                  <summary className="cursor-pointer font-semibold">{f.q}</summary>
                  <p className="mt-2 text-sm text-ink-muted">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="pilot" className="mx-auto max-w-6xl px-4 py-16 md:px-6">
        <div className="grid gap-8 md:grid-cols-[1fr_1.2fr]">
          <div>
            <SectionHeading eyebrow="Design-partner pilots" title="Help us test the hypothesis">
              We are looking for U.S. independent RIAs of roughly 5–50 advisors with an established planning stack. Pilots are limited, separately agreed and subject to legal and security readiness; see the proposed pricing.
            </SectionHeading>
            <p className="text-sm text-ink-muted">This form stores your note locally in this demo build. It does not send email, create an account or subscribe you to anything.</p>
          </div>
          <PilotInterestForm />
        </div>
      </section>
    </main>
  );
}
