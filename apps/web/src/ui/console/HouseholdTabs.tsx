"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/ui/primitives";

export function HouseholdTabs({ id }: { id: string }) {
  const pathname = usePathname();
  const base = `/demo/app/households/${id}`;
  const tabs = [
    { href: base, label: "Overview" },
    { href: `${base}/imports`, label: "Imports" },
    { href: `${base}/checks`, label: "Checks" },
    { href: `${base}/review`, label: "Review" },
    { href: `${base}/evidence`, label: "Evidence" },
  ];
  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-line" aria-label="Household sections">
      {tabs.map((t) => {
        const active = t.href === base ? pathname === base : pathname.startsWith(t.href);
        return (
          <Link key={t.href} href={t.href} aria-current={active ? "page" : undefined} className={cx("-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium", active ? "border-navy text-navy" : "border-transparent text-ink-muted hover:text-ink")}>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
