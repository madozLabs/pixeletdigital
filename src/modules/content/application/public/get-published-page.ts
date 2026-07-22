import { parseWorldKey } from "@/modules/worlds/domain/world";
import type { WorldRepository } from "@/modules/worlds/application/world-repository";

import type { PageSectionPayload } from "../../domain/page-section";
import type { PageRepository } from "../page-repository";
import type { PageSectionRepository } from "../page-section-repository";

export type PublishedPageSectionProjection = Readonly<{
  sectionType: string;
  order: number;
  payload: PageSectionPayload;
  payloadSchemaVersion: number;
}>;

export type PublishedPageProjection = Readonly<{
  worldKey: string;
  pageType: string;
  title: string;
  slug: string;
  publishedAt: Date;
  sections: readonly PublishedPageSectionProjection[];
}>;

export async function getPublishedPage(
  dependencies: Readonly<{
    pages: PageRepository;
    sections: PageSectionRepository;
    worlds: WorldRepository;
  }>,
  input: Readonly<{ worldKey: string; slug: string }>,
): Promise<PublishedPageProjection | null> {
  const worldKeyResult = parseWorldKey(input.worldKey);
  if (!worldKeyResult.ok) return null;

  const world = await dependencies.worlds.findByKey(worldKeyResult.value);
  if (!world || world.mode !== "ACTIVE") return null;

  const page = await dependencies.pages.findPublishedByWorldAndSlug(
    world.key,
    input.slug,
  );
  if (!page || !page.publishedAt) return null;

  const sections = await dependencies.sections.listByPage(page.id);

  return {
    worldKey: page.worldKey,
    pageType: page.pageType,
    title: page.title,
    slug: page.slug,
    publishedAt: page.publishedAt,
    sections: sections
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((section) => ({
        sectionType: section.sectionType,
        order: section.order,
        payload: section.payload,
        payloadSchemaVersion: section.payloadSchemaVersion,
      })),
  };
}
