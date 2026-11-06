import Link from "next/link";
import type { ReactNode } from "react";
import { FlaskConical, Leaf } from "lucide-react";
import type { PersonalActor } from "@/auth/personal-actor";
import { brand } from "@/config/brand";
import { PersonalNav } from "./PersonalNav";

export const PERSONAL_SYNTHETIC_BANNER = "Synthetic demonstration. Maya Castillo is a fictional person with fictional finances; no bank, card or account is connected. Nothing here is financial advice.";

export const PERSONAL_NAV = [
  { href: "/demo/personal", label: "Overview" },
  { href: "/demo/personal/next-steps", label: "Next steps" },
  { href: "/demo/personal/cash-flow", label: "Cash flow" },
  { href: "/demo/personal/spending", label: "Spending" },
  { href: "/demo/personal/savings-debt", label: "Savings & debt" },
  { href: "/demo/personal/goals", label: "Goals" },
  { href: "/demo/personal/retirement", label: "Retirement" },
  { href: "/demo/personal/scenarios", label: "Scenarios" },
  { href: "/demo/personal/assistant", label: "AI assistant" },
  { href: "/demo/personal/learn", label: "Learn" },
  { href: "/demo/personal/privacy", label: "Privacy" },
] as const;

export function PersonalShell({ actor, workspaceLabel, quiet, children }: { actor: PersonalActor; workspaceLabel: string; quiet: boolean; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas">
      <div role="status" className="flex items-center justify-center gap-2 bg-amber-100 px-4 py-2 text-center text-xs font-semibold text-amber-700">
        <FlaskConical size={14} aria-hidden />
        <span>{PERSONAL_SYNTHETIC_BANNER}</span>
      </div>
      <div className="mx-auto flex max-w-[1280px]">
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-line bg-surface px-4 py-5 md:flex">
          <Link href="/" className="flex items-center gap-2 px-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-teal text-white">
              <Leaf size={18} aria-hidden />
            </span>
            <span>
              <span className="block font-heading text-base font-bold leading-tight text-ink">{brand.name}</span>
              <span className="block text-[11px] text-ink-faint">Personal · demo</span>
            </span>
          </Link>
          <PersonalNav items={PERSONAL_NAV} />
          <div className="mt-auto rounded-lg border border-line bg-surface-muted p-3 text-xs text-ink-muted">
            <p className="font-semibold text-ink">{workspaceLabel}</p>
            <p className="mt-1">
              Signed in as <span className="font-semibold text-ink">{actor.display_name}</span> ({actor.workspace_role.toLowerCase()})
            </p>
            <p className="mt-1">Simulated individual, not an authenticated identity.{quiet ? " Quiet mode on." : ""}</p>
          </div>
        </aside>
        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-10 border-b border-line bg-surface/90 backdrop-blur md:hidden">
            <div className="flex items-center justify-between px-4 py-3">
              <Link href="/" className="flex items-center gap-2 font-heading font-bold text-ink">
                <Leaf size={16} className="text-teal" aria-hidden /> {brand.name} Personal
              </Link>
              <span className="text-xs text-ink-muted">{actor.display_name}</span>
            </div>
            <PersonalNav items={PERSONAL_NAV} mobile />
          </header>
          <main className="px-4 py-6 md:px-8 md:py-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
