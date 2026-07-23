import type {
  PrismaClient,
  ServiceFamily as PrismaServiceFamily,
} from "@/generated/prisma/client";

import type { ServiceFamilyRepository } from "../application/service-family-repository";
import {
  restoreServiceFamily,
  type ServiceFamily,
} from "../domain/service-family";

export class PrismaServiceFamilyRepository implements ServiceFamilyRepository {
  constructor(private readonly client: PrismaClient) {}

  async findById(id: string): Promise<ServiceFamily | null> {
    const record = await this.client.serviceFamily.findUnique({
      where: { id },
    });
    return record ? toDomain(record) : null;
  }

  async listByWorld(worldKey: string): Promise<readonly ServiceFamily[]> {
    const records = await this.client.serviceFamily.findMany({
      where: { worldKey },
      orderBy: { order: "asc" },
    });
    return records.map(toDomain);
  }

  async listPublishedByWorld(
    worldKey: string,
  ): Promise<readonly ServiceFamily[]> {
    const records = await this.client.serviceFamily.findMany({
      where: { worldKey, lifecycle: "PUBLISHED" },
      orderBy: { order: "asc" },
    });
    return records.map(toDomain);
  }

  async save(family: ServiceFamily): Promise<void> {
    await this.client.serviceFamily.upsert({
      where: { id: family.id },
      create: {
        id: family.id,
        worldKey: family.worldKey,
        label: family.label,
        order: family.order,
        lifecycle: family.lifecycle,
        version: family.version,
        publishedAt: family.publishedAt,
        createdAt: family.createdAt,
        updatedAt: family.updatedAt,
      },
      update: {
        label: family.label,
        order: family.order,
        lifecycle: family.lifecycle,
        version: family.version,
        publishedAt: family.publishedAt,
        updatedAt: family.updatedAt,
      },
    });
  }
}

function toDomain(record: PrismaServiceFamily): ServiceFamily {
  const result = restoreServiceFamily(record);
  if (!result.ok) {
    throw new Error(`Persisted ServiceFamily is invalid: ${result.error.code}`);
  }

  return result.value;
}
