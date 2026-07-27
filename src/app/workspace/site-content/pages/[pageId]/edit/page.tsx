import { redirect } from "next/navigation";

import { prisma } from "@/infrastructure/shared/prisma-client";
import { getWorkspaceContent } from "@/modules/content/application/workspace-content-query";
import { PrismaWorkspaceContentReader } from "@/modules/content/infrastructure/prisma-workspace-content-query";
import { getWorkspaceRequestContext } from "@/app/workspace/get-workspace-context";

import { PageEditor } from "../../../page";

export default async function VisualPageEditorRoute({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ pageId: string }>;
  searchParams: Promise<{ world?: string }>;
}>) {
  const context = await getWorkspaceRequestContext();
  if (!context) redirect("/login");
  const [{ pageId }, { world = "pixel-digital" }] = await Promise.all([
    params,
    searchParams,
  ]);
  const decodedPageId = decodeURIComponent(pageId);
  const content = await getWorkspaceContent(
    { workspaceContentReader: new PrismaWorkspaceContentReader(prisma) },
    context,
    {
      worldKey: world,
      tab: "pages",
      selectedPageId: decodedPageId,
      skip: 0,
      take: 1,
    },
  );
  if (!content.ok) redirect(`/workspace/site-content/pages?world=${world}`);
  if (!content.value.selectedPage) {
    redirect(
      `/workspace/site-content/pages?world=${encodeURIComponent(world)}&notice=page-unavailable`,
    );
  }

  return (
    <PageEditor
      worldKey={world}
      page={content.value.selectedPage}
      media={content.value.fullMediaForEditor}
    />
  );
}
