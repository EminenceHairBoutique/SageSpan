import Link from "next/link";
import { brand } from "@/config/brand";

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 md:grid-cols-4 md:px-6">
        <div className="md:col-span-2">
          <p className="font-heading text-lg font-bold">{brand.name}</p>
          <p className="mt-2 max-w-md text-sm text-ink-muted">{brand.tagline}. One platform for individuals and households who want calm, realistic money decisions, and for advisory firms who need their plans independently checked and documented.</p>
          <p className="mt-4 text-xs text-ink-faint">{brand.legalNotice}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Product</p>
          <ul className="mt-2 space-y-1.5 text-sm">
            <li><Link href="/personal" className="hover:text-navy">SageSpan Personal</Link></li>
            <li><Link href="/retirement" className="hover:text-navy">Retirement Studio</Link></li>
            <li><Link href="/firms" className="hover:text-navy">Advisor &amp; Assurance</Link></li>
            <li><Link href="/how-it-works" className="hover:text-navy">How it works</Link></li>
            <li><Link href="/security" className="hover:text-navy">Security &amp; trust</Link></li>
            <li><Link href="/pricing" className="hover:text-navy">Pricing hypotheses</Link></li>
            <li><Link href="/demo" className="hover:text-navy">Synthetic demo tour</Link></li>
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Boundaries</p>
          <ul className="mt-2 space-y-1.5 text-sm text-ink-muted">
            <li>No trading, custody or money movement</li>
            <li>No personalised securities recommendations (disabled pending counsel)</li>
            <li>No automated fiduciary approval; AI drafts, people decide</li>
            <li>No SOC 2, SEC or audit certification claimed</li>
            <li>Not tax, legal or investment advice</li>
            <li>No bank, card or brokerage connections in this build</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line px-4 py-4 text-center text-xs text-ink-faint">Synthetic demonstration build. No real client data is processed. Pricing shown is a hypothesis, not an offer.</div>
    </footer>
  );
}
