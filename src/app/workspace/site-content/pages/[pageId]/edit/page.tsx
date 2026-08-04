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
  const [content, users, activeShares] = await Promise.all([
    getWorkspaceContent(
      { workspaceContentReader: new PrismaWorkspaceContentReader(prisma) },
      context,
      {
        worldKey: world,
        tab: "pages",
        selectedPageId: decodedPageId,
        skip: 0,
        take: 1,
      },
    ),
    prisma.user.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, displayName: true, normalizedEmail: true },
      orderBy: { displayName: "asc" },
    }),
    prisma.pagePreviewShare.findMany({
      where: {
        pageId: decodedPageId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);
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
      pages={content.value.allPagesForNavigation}
      revisionAuthors={content.value.revisionAuthors}
      currentUserId={context.actor?.id ?? ""}
      currentActorRole={context.actor?.role ?? null}
      users={users.map((user) => ({
        id: user.id,
        name: user.displayName ?? user.normalizedEmail ?? "Collaborateur",
      }))}
      activeShares={activeShares.map((share) => ({
        id: share.id,
        token: share.token,
        label: share.label,
        revisionId: share.revisionId,
        expiresAt: share.expiresAt,
      }))}
    />
  );
}
