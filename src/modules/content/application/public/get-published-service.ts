import { parseWorldKey } from "@/modules/worlds/domain/world";
import type { WorldRepository } from "@/modules/worlds/application/world-repository";

import type { ServiceRepository } from "../service-repository";

export type PublishedServiceProjection = Readonly<{
  worldKey: string;
  familyId: string | null;
  name: string;
  slug: string;
  description: string;
  publishedAt: Date;
}>;

export async function getPublishedService(
  dependencies: Readonly<{
    services: ServiceRepository;
    worlds: WorldRepository;
  }>,
  input: Readonly<{ worldKey: string; slug: string }>,
): Promise<PublishedServiceProjection | null> {
  const worldKeyResult = parseWorldKey(input.worldKey);
  if (!worldKeyResult.ok) return null;

  const world = await dependencies.worlds.findByKey(worldKeyResult.value);
  if (!world || world.mode !== "ACTIVE") return null;

  const service = await dependencies.services.findPublishedByWorldAndSlug(
    world.key,
    input.slug,
  );
  if (!service || !service.publishedAt) return null;

  return {
    worldKey: service.worldKey,
    familyId: service.familyId,
    name: service.name,
    slug: service.slug,
    description: service.description,
    publishedAt: service.publishedAt,
  };
}
