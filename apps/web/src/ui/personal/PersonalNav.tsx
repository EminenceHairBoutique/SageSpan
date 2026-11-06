"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/ui/primitives";

export function PersonalNav({ items, mobile }: { items: ReadonlyArray<{ href: string; label: string }>; mobile?: boolean }) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/demo/personal" ? pathname === href : pathname.startsWith(href));
  if (mobile) {
    return (
      <nav className="flex gap-1 overflow-x-auto border-t border-line px-2 py-1.5" aria-label="Personal workspace">
        {items.map((n) => (
          <Link key={n.href} href={n.href} aria-current={isActive(n.href) ? "page" : undefined} className={cx("whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium", isActive(n.href) ? "bg-teal-100 text-teal-700" : "text-ink-muted")}>
            {n.label}
          </Link>
        ))}
      </nav>
    );
  }
  return (
    <nav className="mt-8 space-y-0.5" aria-label="Personal workspace">
      {items.map((n) => (
        <Link key={n.href} href={n.href} aria-current={isActive(n.href) ? "page" : undefined} className={cx("flex items-center rounded-lg px-3 py-2 text-sm font-medium", isActive(n.href) ? "bg-teal-100 text-teal-700" : "text-ink-muted hover:bg-surface-muted hover:text-ink")}>
          {n.label}
        </Link>
      ))}
    </nav>
  );
}
