import type { ReactNode } from "react";
import { SiteFooter } from "@/ui/marketing/SiteFooter";
import { SiteNav } from "@/ui/marketing/SiteNav";

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteNav />
      {children}
      <SiteFooter />
    </>
  );
}
