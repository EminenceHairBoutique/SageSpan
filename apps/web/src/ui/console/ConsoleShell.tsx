import Link from "next/link";
import type { ReactNode } from "react";
import { ClipboardList, FlaskConical, Settings, ShieldCheck } from "lucide-react";
import type { Persona } from "@/auth/persona";
import type { Actor } from "@/auth/actor";
import { brand, SYNTHETIC_BANNER } from "@/config/brand";
import { PersonaSwitcher } from "./PersonaSwitcher";

export function ConsoleShell({ actor, personas, orgName, children, basePath = "/demo/app" }: { actor: Actor; personas: Persona[]; orgName: string; children: ReactNode; basePath?: string }) {
  const nav = [
    { href: `${basePath}/reviews`, label: "Review queue", icon: ClipboardList },
    { href: `${basePath}/settings`, label: "Settings", icon: Settings },
  ];
  return (
    <div className="min-h-screen bg-canvas">
      <div role="status" className="flex items-center justify-center gap-2 bg-amber-100 px-4 py-2 text-center text-xs font-semibold text-amber-700">
        <FlaskConical size={14} aria-hidden />
        <span>{SYNTHETIC_BANNER}</span>
      </div>
      <div className="mx-auto flex max-w-[1440px]">
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-line bg-surface px-4 py-5 md:flex">
          <Link href="/" className="flex items-center gap-2 px-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-navy text-white">
              <ShieldCheck size={18} aria-hidden />
            </span>
            <span>
              <span className="block font-heading text-base font-bold leading-tight text-ink">{brand.name}</span>
              <span className="block text-[11px] text-ink-faint">Assurance console · demo</span>
            </span>
          </Link>
          <nav className="mt-8 space-y-1" aria-label="Console">
            {nav.map((n) => (
              <Link key={n.href} href={n.href} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-ink-muted hover:bg-navy-100 hover:text-navy">
                <n.icon size={16} aria-hidden />
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="mt-auto rounded-lg border border-line bg-surface-muted p-3 text-xs text-ink-muted">
            <p className="font-semibold text-ink">{orgName}</p>
            <p className="mt-1">
              Acting as <span className="font-semibold text-ink">{actor.display_name}</span> ({actor.role})
            </p>
            <p className="mt-1">Simulated reviewer. Not an authenticated identity.</p>
          </div>
        </aside>
        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface/90 px-4 py-3 backdrop-blur md:px-8">
            <div className="flex items-center gap-3 md:hidden">
              <Link href={`${basePath}/reviews`} className="text-sm font-semibold text-navy">
                Review queue
              </Link>
              <Link href={`${basePath}/settings`} className="text-sm font-semibold text-navy">
                Settings
              </Link>
            </div>
            <div className="ml-auto flex items-center gap-3">
              <span className="hidden text-xs text-ink-muted sm:inline">Simulated reviewer:</span>
              <PersonaSwitcher personas={personas} current={actor.user_id} />
            </div>
          </header>
          <main className="px-4 py-6 md:px-8 md:py-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
