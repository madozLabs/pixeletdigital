import type { RequestContext } from "@/shared/request-context";
import { hasWorldScope, requireActiveActor } from "./content-authorization";

export type WorkspacePageDto = Readonly<{
  id: string;
  worldKey: string;
  pageType: string;
  pageKind: string;
  templateKey: string;
  routePath: string | null;
  serviceId: string | null;
  draftRevisionId: string | null;
  publishedRevisionId: string | null;
  title: string;
  slug: string;
  lifecycle: string;
  version: number;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}>;

export type WorkspaceEditablePageDto = WorkspacePageDto &
  Readonly<{
    draftRevision: WorkspaceRevisionDto | null;
    publishedRevision: WorkspaceRevisionDto | null;
    revisionHistory: readonly WorkspaceRevisionDto[];
  }>;

export type WorkspaceRevisionDto = Readonly<{
  id: string;
  revisionNumber: number;
  status: string;
  title: string;
  seoTitle: string | null;
  seoDescription: string | null;
  ogImageMediaId: string | null;
  scheduledPublishAt: Date | null;
  version: number;
  createdById: string | null;
  reviewedById: string | null;
  publishedById: string | null;
  reviewedAt: Date | null;
  publishedAt: Date | null;
  updatedAt: Date;
  sections: readonly WorkspaceRevisionSectionDto[];
}>;

export type WorkspaceRevisionSectionDto = Readonly<{
  id: string;
  revisionId: string;
  sectionKey: string;
  sectionType: string;
  order: number;
  payload: unknown;
  payloadSchemaVersion: number;
  version: number;
  globalComponentId: string | null;
  createdAt: Date;
  updatedAt: Date;
}>;

export type WorkspaceMediaDto = Readonly<{
  id: string;
  worldKey: string;
  publicUrl: string;
  title: string;
  altText: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
  tags: readonly string[];
  caption: string | null;
  credit: string | null;
  rightsStatement: string | null;
  rightsExpiresAt: Date | null;
}>;

export type WorkspaceContentDto = Readonly<{
  recentPages: readonly WorkspacePageDto[];
  homePage: WorkspacePageDto | null;
  totalPages: number;
  publishedCount: number;
  draftCount: number;
  totalMedia: number;
  pagesForTab: readonly WorkspacePageDto[];
  allPagesForNavigation: readonly WorkspacePageDto[];
  mediaForTab: readonly WorkspaceMediaDto[];
  fullMediaForEditor: readonly WorkspaceMediaDto[];
  publishedServices: number;
  selectedPage: WorkspaceEditablePageDto | null;
  siteIdentity: WorkspaceSiteIdentityDto | null;
  revisionAuthors: Readonly<Record<string, string>>;
  topViewedPages: readonly Readonly<{
    id: string;
    title: string;
    slug: string;
    viewCount: number;
  }>[];
}>;

export type WorkspaceSiteIdentityRevisionDto = Readonly<{
  id: string;
  revisionNumber: number;
  status: string;
  config: unknown;
  version: number;
  updatedAt: Date;
}>;

export type WorkspaceSiteIdentityDto = Readonly<{
  id: string;
  worldKey: string;
  draftRevision: WorkspaceSiteIdentityRevisionDto | null;
  publishedRevision: WorkspaceSiteIdentityRevisionDto | null;
}>;

export interface WorkspaceContentReader {
  read(input: {
    worldKey: string;
    tab: string;
    selectedPageId?: string;
    skip: number;
    take: number;
    pageSearch?: string;
    pageStatus?: string;
    mediaSearch?: string;
    mediaType?: string;
  }): Promise<WorkspaceContentDto>;
}

export async function getWorkspaceContent(
  dependencies: Readonly<{ workspaceContentReader: WorkspaceContentReader }>,
  context: RequestContext,
  input: Readonly<{
    worldKey: string;
    tab: string;
    selectedPageId?: string;
    skip: number;
    take: number;
    pageSearch?: string;
    pageStatus?: string;
    mediaSearch?: string;
    mediaType?: string;
  }>,
) {
  const actor = requireActiveActor(context);
  if (!actor.ok || !hasWorldScope(actor.value, input.worldKey)) {
    return { ok: false as const, error: { code: "FORBIDDEN" as const } };
  }
  return {
    ok: true as const,
    value: await dependencies.workspaceContentReader.read(input),
  };
}
