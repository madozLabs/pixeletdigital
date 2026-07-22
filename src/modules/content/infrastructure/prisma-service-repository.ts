import type {
  PrismaClient,
  Service as PrismaService,
} from "@/generated/prisma/client";

import type { ServiceRepository } from "../application/service-repository";
import { restoreService, type Service } from "../domain/service";

export class PrismaServiceRepository implements ServiceRepository {
  constructor(private readonly client: PrismaClient) {}

  async findById(id: string): Promise<Service | null> {
    const record = await this.client.service.findUnique({ where: { id } });
    return record ? toDomain(record) : null;
  }

  async listByWorld(worldKey: string): Promise<readonly Service[]> {
    const records = await this.client.service.findMany({
      where: { worldKey },
      orderBy: { name: "asc" },
    });
    return records.map(toDomain);
  }

  async listApprovedCurrentByWorld(
    worldKey: string,
  ): Promise<readonly Service[]> {
    const records = await this.client.service.findMany({
      where: {
        worldKey,
        lifecycle: "PUBLISHED",
        availabilityStatus: "APPROVED_CURRENT",
      },
    });
    return records.map(toDomain);
  }

  async findPublishedByWorldAndSlug(
    worldKey: string,
    slug: string,
  ): Promise<Service | null> {
    const record = await this.client.service.findFirst({
      where: {
        worldKey,
        slug,
        lifecycle: "PUBLISHED",
        availabilityStatus: "APPROVED_CURRENT",
      },
    });
    return record ? toDomain(record) : null;
  }

  async save(service: Service): Promise<void> {
    await this.client.service.upsert({
      where: { id: service.id },
      create: {
        id: service.id,
        worldKey: service.worldKey,
        familyId: service.familyId,
        name: service.name,
        slug: service.slug,
        description: service.description,
        availabilityStatus: service.availabilityStatus,
        lifecycle: service.lifecycle,
        version: service.version,
        publishedAt: service.publishedAt,
        createdAt: service.createdAt,
        updatedAt: service.updatedAt,
      },
      update: {
        familyId: service.familyId,
        name: service.name,
        slug: service.slug,
        description: service.description,
        availabilityStatus: service.availabilityStatus,
        lifecycle: service.lifecycle,
        version: service.version,
        publishedAt: service.publishedAt,
        updatedAt: service.updatedAt,
      },
    });
  }
}

function toDomain(record: PrismaService): Service {
  const result = restoreService(record);
  if (!result.ok) {
    throw new Error(`Persisted Service is invalid: ${result.error.code}`);
  }

  return result.value;
}
