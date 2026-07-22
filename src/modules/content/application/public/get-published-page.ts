import { parseWorldKey } from "@/modules/worlds/domain/world";
import type { WorldRepository } from "@/modules/worlds/application/world-repository";

import type { PageRepository } from "../page-repository";

export type PublishedPageProjection = Readonly<{
  worldKey: string;
  pageType: string;
  title: string;
  slug: string;
  publishedAt: Date;
}>;

export async function getPublishedPage(
  dependencies: Readonly<{ pages: PageRepository; worlds: WorldRepository }>,
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

  return {
    worldKey: page.worldKey,
    pageType: page.pageType,
    title: page.title,
    slug: page.slug,
    publishedAt: page.publishedAt,
  };
}
