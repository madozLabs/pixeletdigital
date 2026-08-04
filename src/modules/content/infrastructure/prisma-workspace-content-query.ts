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
    pageSearch?: string;
    pageStatus?: string;
    mediaSearch?: string;
    mediaType?: string;
  }) {
    const needsFullMedia =
      (Boolean(input.selectedPageId) || input.tab === "identity") &&
      input.tab !== "media";
    const pageSearch = input.pageSearch?.trim();
    const pagesWhere = {
      worldKey: input.worldKey,
      pageKind: { not: "COMPONENT_LIBRARY" },
      ...(pageSearch
        ? {
            OR: [
              { title: { contains: pageSearch, mode: "insensitive" as const } },
              { slug: { contains: pageSearch, mode: "insensitive" as const } },
              {
                routePath: {
                  contains: pageSearch,
                  mode: "insensitive" as const,
                },
              },
            ],
          }
        : {}),
      ...(input.pageStatus ? { lifecycle: input.pageStatus as never } : {}),
    };
    const mediaSearch = input.mediaSearch?.trim();
    const mediaWhere = {
      worldKey: input.worldKey,
      ...(mediaSearch
        ? {
            OR: [
              { title: { contains: mediaSearch, mode: "insensitive" as const } },
              {
                altText: {
                  contains: mediaSearch,
                  mode: "insensitive" as const,
                },
              },
              { tags: { has: mediaSearch } },
            ],
          }
        : {}),
      ...(input.mediaType === "image"
        ? { mimeType: { startsWith: "image/" } }
        : input.mediaType === "video"
          ? { mimeType: { startsWith: "video/" } }
          : input.mediaType === "other"
            ? {
                AND: [
                  { mimeType: { not: { startsWith: "image/" } } },
                  { mimeType: { not: { startsWith: "video/" } } },
                ],
              }
            : {}),
    };
    const [
      recentPages,
      homePage,
      totalPages,
      publishedCount,
      draftCount,
      totalMedia,
      pagesForTab,
      allPagesForNavigation,
      mediaForTab,
      fullMediaForEditor,
      publishedServices,
      selectedPage,
      siteIdentity,
      topViewsRaw,
    ] = await Promise.all([
      this.database.page.findMany({
        where: {
          worldKey: input.worldKey,
          pageKind: { not: "COMPONENT_LIBRARY" },
        },
        orderBy: { updatedAt: "desc" },
        take: 6,
      }),
      this.database.page.findFirst({
        where: { worldKey: input.worldKey, slug: "accueil" },
      }),
      input.tab === "pages"
        ? this.database.page.count({ where: pagesWhere })
        : this.database.page.count({ where: { worldKey: input.worldKey } }),
      this.database.page.count({
        where: { worldKey: input.worldKey, lifecycle: "PUBLISHED" },
      }),
      this.database.page.count({
        where: { worldKey: input.worldKey, draftRevisionId: { not: null } },
      }),
      input.tab === "media"
        ? this.database.mediaAsset.count({ where: mediaWhere })
        : this.database.mediaAsset.count({
            where: { worldKey: input.worldKey },
          }),
      input.tab === "pages"
        ? this.database.page.findMany({
            where: pagesWhere,
            orderBy: { updatedAt: "desc" },
            skip: input.skip,
            take: input.take,
          })
        : Promise.resolve([]),
      input.tab === "identity" || input.selectedPageId
        ? this.database.page.findMany({
            where: {
              worldKey: input.worldKey,
              pageKind: { not: "COMPONENT_LIBRARY" },
            },
            orderBy: [{ title: "asc" }, { createdAt: "asc" }],
          })
        : Promise.resolve([]),
      input.tab === "media"
        ? this.database.mediaAsset.findMany({
            where: mediaWhere,
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
            include: {
              draftRevision: {
                include: { sections: { orderBy: { order: "asc" } } },
              },
              publishedRevision: {
                include: { sections: { orderBy: { order: "asc" } } },
              },
              revisions: {
                orderBy: { revisionNumber: "desc" },
                take: 20,
                include: { sections: { orderBy: { order: "asc" } } },
              },
            },
          })
        : Promise.resolve(null),
      input.tab === "identity"
        ? this.database.siteSettings.findUnique({
            where: { worldKey: input.worldKey },
            include: { draftRevision: true, publishedRevision: true },
          })
        : Promise.resolve(null),
      input.tab === "overview"
        ? this.database.pageView.groupBy({
            by: ["pageId"],
            where: {
              page: { worldKey: input.worldKey },
              createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
            },
            _count: { id: true },
            orderBy: { _count: { id: "desc" } },
            take: 5,
          })
        : Promise.resolve([]),
    ]);

    const revisionAuthors: Record<string, string> = {};
    if (input.selectedPageId && selectedPage) {
      const authorIds = new Set<string>();
      for (const revision of selectedPage.revisions) {
        if (revision.createdById) authorIds.add(revision.createdById);
        if (revision.reviewedById) authorIds.add(revision.reviewedById);
        if (revision.publishedById) authorIds.add(revision.publishedById);
      }
      if (authorIds.size > 0) {
        const users = await this.database.user.findMany({
          where: { id: { in: [...authorIds] } },
          select: { id: true, displayName: true, normalizedEmail: true },
        });
        for (const user of users) {
          revisionAuthors[user.id] =
            user.displayName ?? user.normalizedEmail ?? user.id;
        }
      }
    }

    let topViewedPages: Readonly<{
      id: string;
      title: string;
      slug: string;
      viewCount: number;
    }>[] = [];
    if (topViewsRaw.length > 0) {
      const pages = await this.database.page.findMany({
        where: { id: { in: topViewsRaw.map((row) => row.pageId) } },
        select: { id: true, title: true, slug: true },
      });
      const pageById = new Map(pages.map((page) => [page.id, page]));
      topViewedPages = topViewsRaw
        .map((row) => {
          const page = pageById.get(row.pageId);
          return page
            ? { ...page, viewCount: row._count.id }
            : null;
        })
        .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
    }

    return {
      recentPages,
      homePage,
      totalPages,
      publishedCount,
      draftCount,
      totalMedia,
      pagesForTab,
      allPagesForNavigation,
      mediaForTab,
      fullMediaForEditor,
      publishedServices,
      selectedPage: selectedPage
        ? { ...selectedPage, revisionHistory: selectedPage.revisions }
        : null,
      siteIdentity,
      revisionAuthors,
      topViewedPages,
    };
  }
}
