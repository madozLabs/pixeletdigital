import type {
  PrismaClient,
  World as PrismaWorld,
} from "@/generated/prisma/client";

import type { WorldRepository } from "../application/world-repository";
import { createWorld, type World, type WorldKey } from "../domain/world";

export class PrismaWorldRepository implements WorldRepository {
  constructor(private readonly client: PrismaClient) {}

  async findByKey(key: WorldKey): Promise<World | null> {
    const record = await this.client.world.findUnique({ where: { key } });
    return record ? toDomain(record) : null;
  }

  async save(world: World): Promise<void> {
    await this.client.world.upsert({
      where: { id: world.id },
      create: world,
      update: {
        displayName: world.displayName,
        mode: world.mode,
      },
    });
  }
}

function toDomain(record: PrismaWorld): World {
  const result = createWorld(record);
  if (!result.ok) {
    throw new Error(`Persisted World is invalid: ${result.error.code}`);
  }

  return result.value;
}
