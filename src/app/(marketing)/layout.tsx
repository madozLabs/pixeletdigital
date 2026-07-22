import type { ReactNode } from "react";

import { SiteFooter } from "./_components/site-footer";
import { SiteHeader } from "./_components/site-header";

export default function MarketingLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <>
      <SiteHeader />
      {children}
      <SiteFooter />
    </>
  );
}
