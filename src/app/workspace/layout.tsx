import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AdminShell } from "./_components/admin-shell";
import { getWorkspaceRequestContext } from "./get-workspace-context";

export const metadata: Metadata = {
  title: "Workspace",
  robots: { index: false, follow: false },
};

export default async function WorkspaceLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const context = await getWorkspaceRequestContext();
  if (!context) redirect("/login");

  return <AdminShell role={context.actor?.role ?? null}>{children}</AdminShell>;
}
