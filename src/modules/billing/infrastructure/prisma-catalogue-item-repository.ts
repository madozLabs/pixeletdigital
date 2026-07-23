import type {
  CatalogueItem as PrismaCatalogueItem,
  PrismaClient,
} from "@/generated/prisma/client";

import type { CatalogueItemRepository } from "../application/catalogue-item-repository";
import {
  restoreCatalogueItem,
  type CatalogueItem,
} from "../domain/catalogue-item";

export class PrismaCatalogueItemRepository implements CatalogueItemRepository {
  constructor(private readonly client: PrismaClient) {}

  async findById(id: string): Promise<CatalogueItem | null> {
    const record = await this.client.catalogueItem.findUnique({
      where: { id },
    });
    return record ? toDomain(record) : null;
  }

  async listByWorld(worldKey: string): Promise<readonly CatalogueItem[]> {
    const records = await this.client.catalogueItem.findMany({
      where: { worldKey },
      orderBy: { label: "asc" },
    });
    return records.map(toDomain);
  }

  async save(item: CatalogueItem): Promise<void> {
    await this.client.catalogueItem.upsert({
      where: { id: item.id },
      create: {
        id: item.id,
        worldKey: item.worldKey,
        label: item.label,
        kind: item.kind,
        unitPriceCents: item.unitPriceCents,
        status: item.status,
        version: item.version,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      },
      update: {
        label: item.label,
        unitPriceCents: item.unitPriceCents,
        status: item.status,
        version: item.version,
        updatedAt: item.updatedAt,
      },
    });
  }
}

function toDomain(record: PrismaCatalogueItem): CatalogueItem {
  const result = restoreCatalogueItem(record);
  if (!result.ok) {
    throw new Error(`Persisted CatalogueItem is invalid: ${result.error.code}`);
  }
  return result.value;
}
