import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

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

  return (
    <div>
      <nav>
        <a href="/workspace/services">Services</a>
        <a href="/workspace/enquiries">Demandes de contact</a>
      </nav>
      {children}
    </div>
  );
}
