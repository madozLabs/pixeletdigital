import type { RequestContext } from "@/shared/request-context";
import { hasWorldScope, requireActiveActor } from "./content-authorization";

export type WorkspacePageDto = Readonly<{
  id: string;
  worldKey: string;
  pageType: string;
  title: string;
  slug: string;
  lifecycle: string;
  version: number;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}>;

export type WorkspaceSectionDto = Readonly<{
  id: string;
  pageId: string;
  sectionType: string;
  order: number;
  payload: unknown;
  payloadSchemaVersion: number;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}>;

export type WorkspaceEditablePageDto = WorkspacePageDto &
  Readonly<{ sections: readonly WorkspaceSectionDto[] }>;

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
  mediaForTab: readonly WorkspaceMediaDto[];
  fullMediaForEditor: readonly WorkspaceMediaDto[];
  publishedServices: number;
  selectedPage: WorkspaceEditablePageDto | null;
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
