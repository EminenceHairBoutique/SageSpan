import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Alert, ButtonLink, Card, SectionHeading } from "@/ui/primitives";

export const metadata: Metadata = { title: "Synthetic demo tour" };

const tour = [
  { step: "1", persona: "Priya Raman · ANALYST", title: "See the queue and the blocked Patel household", text: "Open the review queue, filter to Blocked, and open Patel. The freeze gate lists a material balance conflict and a nonmaterial custodian-label conflict.", href: "/demo/app/reviews?status=blocked" },
  { step: "2", persona: "Priya Raman · ANALYST", title: "Resolve the material conflict in favour of the custodian statement", text: "On the Review tab choose the $640,000.00 statement value with a rationale. A new fact revision is created; the $612,000.00 plan value stays in history. Freeze is still blocked by the nonmaterial conflict.", href: "/demo/app/households/hh_patel/review" },
  { step: "3", persona: "Dana Whitfield · COMPLIANCE", title: "Document the nonmaterial exception", text: "Switch persona. As the CCO, document an exception for the custodian label under firm policy. The gate clears: READY_TO_FREEZE.", href: "/demo/app/households/hh_patel/review" },
  { step: "4", persona: "Priya Raman · ANALYST", title: "Freeze and run the independent RMD check", text: "Freeze the snapshot (content hash recorded), then run the check. The Python engine returns $25,098.04 with a receipt; the imported $24,000.00 is classified as a source conflict with a $1,098.04 difference.", href: "/demo/app/households/hh_patel/checks" },
  { step: "4b", persona: "Any reviewer", title: "Analyze plan: an AI draft that cites its sources", text: "The assistant drafts findings on missing evidence, conflicts, the discrepancy (amounts copied from the receipted run) and assumptions, plus questions and a draft memo. Accept, edit, dismiss or request evidence; nothing is approved.", href: "/demo/app/households/hh_patel/ai-review" },
  { step: "5", persona: "Marcus Lee · ADVISOR", title: "Disposition the discrepancy and record the review", text: "Send to review, record a disposition for the discrepancy and a review rationale.", href: "/demo/app/households/hh_patel/review" },
  { step: "6", persona: "Dana Whitfield · COMPLIANCE", title: "Approve with attestation, then export the packet", text: "Approval requires the approver role, a rationale and a conflict attestation; separation of duties is enforced if policy says so. Then generate and download the review evidence packet (JSON/HTML).", href: "/demo/app/households/hh_patel/evidence" },
];

const extras = [
  { title: "Okafor: a date-of-birth conflict, then UNSUPPORTED", text: "Resolve the DOB conflict; the check then returns UNSUPPORTED because the spouse is the sole beneficiary and more than 10 years younger (joint table not implemented). The engine refuses to use 25.5 automatically.", href: "/demo/app/households/hh_okafor" },
  { title: "Reyes-Lindqvist: missing evidence and the import wizard", text: "Only a plan export exists, with a 2025-09-30 balance. Import the synthetic custodian statement (JSON) from the Imports tab, map entities, record a living-status assumption, and watch the gate clear.", href: "/demo/app/households/hh_reyes/imports" },
  { title: "Forged approval and cross-tenant reads", text: "Switch to the restricted reviewer or an analyst and try to approve: the server refuses. Switch to the Northline personas: Harbor Point households are not found.", href: "/demo/app/settings" },
];

const personalTour = [
  { title: "Overview: where Maya stands", text: "Liquid cash vs the floor Maya chose, months of essentials covered, typical and low-month margin, the lowest point in the next 90 days, and three ranked next steps. Tap any number for its receipt.", href: "/demo/personal" },
  { title: "Scenarios: debt paths on identical inputs", text: "Minimums only vs highest-rate-first vs smallest-balance-first vs hybrid under the extra amount Maya chose; interest and months from the calculation service.", href: "/demo/personal/scenarios" },
  { title: "Assistant: understand my finances", text: "A grounded draft that explains the baseline and cites every number to the run that produced it; accept, edit, dismiss or request evidence.", href: "/demo/personal/assistant" },
  { title: "Savings & debt: update a balance", text: "Enter a lower savings balance and watch the snapshot, baseline and next steps recompute; history is kept as revisions.", href: "/demo/personal/savings-debt" },
];

export default function DemoPage() {
  return (
    <main id="main" className="mx-auto max-w-6xl px-4 py-14 md:px-6">
      <SectionHeading eyebrow="Interactive synthetic tour · Personal" title="A fictional individual, a receipted baseline, three next steps">
        Maya Castillo: irregular contract income plus a part-time job, two debts, recurring bills and two goals. Manual entry only; no account is connected.
      </SectionHeading>
      <ol className="mb-14 grid gap-4 md:grid-cols-2">
        {personalTour.map((t, i) => (
          <li key={t.href}>
            <Card>
              <div className="flex items-center gap-3">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-teal text-sm font-bold text-white">{i + 1}</span>
                <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Maya Castillo · individual</span>
              </div>
              <h3 className="mt-3 font-semibold">{t.title}</h3>
              <p className="mt-1 text-sm text-ink-muted">{t.text}</p>
              <Link href={t.href} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-navy underline-offset-2 hover:underline">
                Go <ArrowRight size={14} aria-hidden />
              </Link>
            </Card>
          </li>
        ))}
      </ol>
      <SectionHeading eyebrow="Interactive synthetic tour · Firm" title="Conflict → resolution → freeze → check → AI draft → review → packet">
        Fictional households, simulated reviewer personas, and the real calculation service. The persona switcher in the console header changes who you act as; the server enforces every permission.
      </SectionHeading>
      <Alert tone="amber" className="mb-8" title="Synthetic data only">
        Nothing here is a real client, custodian or planning vendor. Demo approvals are recorded as simulated reviewers, not professional sign-off. You can reset the data from Settings at any time.
      </Alert>
      <ol className="grid gap-4 md:grid-cols-2">
        {tour.map((t) => (
          <li key={t.step}>
            <Card>
              <div className="flex items-center gap-3">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-navy text-sm font-bold text-white">{t.step}</span>
                <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{t.persona}</span>
              </div>
              <h3 className="mt-3 font-semibold">{t.title}</h3>
              <p className="mt-1 text-sm text-ink-muted">{t.text}</p>
              <Link href={t.href} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-navy underline-offset-2 hover:underline">
                Go <ArrowRight size={14} aria-hidden />
              </Link>
            </Card>
          </li>
        ))}
      </ol>
      <section className="mt-12">
        <SectionHeading eyebrow="More to try" title="Unsupported cases, missing evidence, forged requests" />
        <div className="grid gap-4 md:grid-cols-3">
          {extras.map((e) => (
            <Card key={e.title}>
              <h3 className="font-semibold">{e.title}</h3>
              <p className="mt-1 text-sm text-ink-muted">{e.text}</p>
              <Link href={e.href} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-navy underline-offset-2 hover:underline">
                Open <ArrowRight size={14} aria-hidden />
              </Link>
            </Card>
          ))}
        </div>
      </section>
      <div className="mt-10">
        <ButtonLink href="/demo/app/reviews" size="lg">
          Start the tour <ArrowRight size={16} aria-hidden />
        </ButtonLink>
      </div>
    </main>
  );
}
