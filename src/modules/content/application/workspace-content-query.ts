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
  version: number;
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
