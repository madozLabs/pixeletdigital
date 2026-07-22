import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { getWorkspaceRequestContext } from "./get-workspace-context";

export default async function WorkspaceLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const context = await getWorkspaceRequestContext();
  if (!context) redirect("/login");

  return (
    <div>
      <nav>
        <a href="/workspace/services">Services</a>
      </nav>
      {children}
    </div>
  );
}
