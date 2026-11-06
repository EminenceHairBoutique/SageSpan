import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { brand } from "@/config/brand";
import { ButtonLink } from "@/ui/primitives";

const links = [
  { href: "/product", label: "Product" },
  { href: "/security", label: "Security" },
  { href: "/pricing", label: "Pricing" },
  { href: "/demo", label: "Demo" },
];

export function SiteNav() {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-canvas/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 md:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-navy text-white">
            <ShieldCheck size={18} aria-hidden />
          </span>
          <span className="font-heading text-lg font-bold text-ink">{brand.name}</span>
          <span className="hidden rounded-full border border-line px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-faint sm:inline">provisional name</span>
        </Link>
        <nav className="hidden items-center gap-6 md:flex" aria-label="Primary">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="text-sm font-medium text-ink-muted hover:text-ink">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <ButtonLink href="/#pilot" variant="secondary" size="sm" className="hidden sm:inline-flex">
            Pilot interest
          </ButtonLink>
          <ButtonLink href="/demo/app/reviews" size="sm">
            Open synthetic demo
          </ButtonLink>
        </div>
      </div>
      <nav className="flex gap-4 overflow-x-auto border-t border-line px-4 py-2 md:hidden" aria-label="Primary mobile">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="whitespace-nowrap text-sm font-medium text-ink-muted">
            {l.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
