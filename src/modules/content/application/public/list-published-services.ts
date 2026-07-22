import { parseWorldKey } from "@/modules/worlds/domain/world";
import type { WorldRepository } from "@/modules/worlds/application/world-repository";

import type { ServiceRepository } from "../service-repository";

export type PublishedServiceProjection = Readonly<{
  worldKey: string;
  familyId: string | null;
  name: string;
  description: string;
  publishedAt: Date;
}>;

export async function listPublishedServices(
  dependencies: Readonly<{
    services: ServiceRepository;
    worlds: WorldRepository;
  }>,
  input: Readonly<{ worldKey: string }>,
): Promise<readonly PublishedServiceProjection[]> {
  const worldKeyResult = parseWorldKey(input.worldKey);
  if (!worldKeyResult.ok) return [];

  const world = await dependencies.worlds.findByKey(worldKeyResult.value);
  if (!world || world.mode !== "ACTIVE") return [];

  const services = await dependencies.services.listApprovedCurrentByWorld(
    world.key,
  );

  return services
    .filter((service) => service.publishedAt !== null)
    .map((service) => ({
      worldKey: service.worldKey,
      familyId: service.familyId,
      name: service.name,
      description: service.description,
      publishedAt: service.publishedAt as Date,
    }));
}
