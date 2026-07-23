import { parseWorldKey } from "@/modules/worlds/domain/world";
import type { WorldRepository } from "@/modules/worlds/application/world-repository";

import type { ServiceFamilyRepository } from "../service-family-repository";

export type PublishedServiceFamilyProjection = Readonly<{
  id: string;
  worldKey: string;
  label: string;
  order: number;
}>;

export async function listPublishedServiceFamilies(
  dependencies: Readonly<{
    families: ServiceFamilyRepository;
    worlds: WorldRepository;
  }>,
  input: Readonly<{ worldKey: string }>,
): Promise<readonly PublishedServiceFamilyProjection[]> {
  const worldKeyResult = parseWorldKey(input.worldKey);
  if (!worldKeyResult.ok) return [];

  const world = await dependencies.worlds.findByKey(worldKeyResult.value);
  if (!world || world.mode !== "ACTIVE") return [];

  const families = await dependencies.families.listPublishedByWorld(world.key);

  return families.map((family) => ({
    id: family.id,
    worldKey: family.worldKey,
    label: family.label,
    order: family.order,
  }));
}
