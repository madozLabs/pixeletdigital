import type { PrismaClient } from "@/generated/prisma/client";
import type { WorkspaceContentReader } from "../application/workspace-content-query";

export class PrismaWorkspaceContentReader implements WorkspaceContentReader {
  constructor(private readonly database: PrismaClient) {}

  async read(input: {
    worldKey: string;
    tab: string;
    selectedPageId?: string;
    skip: number;
    take: number;
  }) {
    const needsFullMedia =
      Boolean(input.selectedPageId) && input.tab !== "media";
    const [
      recentPages,
      homePage,
      totalPages,
      publishedCount,
      draftCount,
      totalMedia,
      pagesForTab,
      mediaForTab,
      fullMediaForEditor,
      publishedServices,
      selectedPage,
    ] = await Promise.all([
      this.database.page.findMany({
        where: { worldKey: input.worldKey },
        orderBy: { updatedAt: "desc" },
        take: 6,
      }),
      this.database.page.findFirst({
        where: { worldKey: input.worldKey, slug: "accueil" },
      }),
      this.database.page.count({ where: { worldKey: input.worldKey } }),
      this.database.page.count({
        where: { worldKey: input.worldKey, lifecycle: "PUBLISHED" },
      }),
      this.database.page.count({
        where: { worldKey: input.worldKey, lifecycle: "DRAFT" },
      }),
      this.database.mediaAsset.count({ where: { worldKey: input.worldKey } }),
      input.tab === "pages"
        ? this.database.page.findMany({
            where: { worldKey: input.worldKey },
            orderBy: { updatedAt: "desc" },
            skip: input.skip,
            take: input.take,
          })
        : Promise.resolve([]),
      input.tab === "media"
        ? this.database.mediaAsset.findMany({
            where: { worldKey: input.worldKey },
            orderBy: { createdAt: "desc" },
            skip: input.skip,
            take: input.take,
          })
        : Promise.resolve([]),
      needsFullMedia
        ? this.database.mediaAsset.findMany({
            where: { worldKey: input.worldKey },
            orderBy: { createdAt: "desc" },
          })
        : Promise.resolve([]),
      this.database.service.count({
        where: { worldKey: input.worldKey, lifecycle: "PUBLISHED" },
      }),
      input.selectedPageId
        ? this.database.page.findFirst({
            where: { id: input.selectedPageId, worldKey: input.worldKey },
            include: { sections: { orderBy: { order: "asc" } } },
          })
        : Promise.resolve(null),
    ]);

    return {
      recentPages,
      homePage,
      totalPages,
      publishedCount,
      draftCount,
      totalMedia,
      pagesForTab,
      mediaForTab,
      fullMediaForEditor,
      publishedServices,
      selectedPage,
    };
  }
}
