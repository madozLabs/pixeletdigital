import type { ReactNode } from "react";

import { CmsShell } from "./cms-shell";

export default function SiteContentLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return <CmsShell>{children}</CmsShell>;
}
