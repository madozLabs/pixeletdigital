import type { World, WorldKey } from "../domain/world";

export interface WorldRepository {
  findByKey(key: WorldKey): Promise<World | null>;
  save(world: World): Promise<void>;
}
