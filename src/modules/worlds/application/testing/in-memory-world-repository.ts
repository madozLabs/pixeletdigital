import type { WorldRepository } from "../world-repository";
import type { World, WorldKey } from "../../domain/world";

export class InMemoryWorldRepository implements WorldRepository {
  readonly savedWorlds: World[] = [];
  readonly foundKeys: WorldKey[] = [];
  private readonly worldsByKey = new Map<WorldKey, World>();

  constructor(worlds: readonly World[] = []) {
    for (const world of worlds) this.worldsByKey.set(world.key, world);
  }

  async findByKey(key: WorldKey): Promise<World | null> {
    this.foundKeys.push(key);
    return this.worldsByKey.get(key) ?? null;
  }

  async save(world: World): Promise<void> {
    this.savedWorlds.push(world);
    this.worldsByKey.set(world.key, world);
  }
}
