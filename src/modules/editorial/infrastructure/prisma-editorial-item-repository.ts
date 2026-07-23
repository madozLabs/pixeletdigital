import type {
  EditorialItem as PrismaEditorialItem,
  PrismaClient,
} from "@/generated/prisma/client";

import type { EditorialItemRepository } from "../application/editorial-item-repository";
import {
  restoreEditorialItem,
  type EditorialItem,
} from "../domain/editorial-item";

export class PrismaEditorialItemRepository implements EditorialItemRepository {
  constructor(private readonly client: PrismaClient) {}

  async findById(id: string): Promise<EditorialItem | null> {
    const record = await this.client.editorialItem.findUnique({
      where: { id },
    });
    return record ? toDomain(record) : null;
  }

  async listByWorld(worldKey: string): Promise<readonly EditorialItem[]> {
    const records = await this.client.editorialItem.findMany({
      where: { worldKey },
      orderBy: { scheduledFor: "asc" },
    });
    return records.map(toDomain);
  }

  async save(item: EditorialItem): Promise<void> {
    await this.client.editorialItem.upsert({
      where: { id: item.id },
      create: {
        id: item.id,
        worldKey: item.worldKey,
        clientLabel: item.clientLabel,
        channel: item.channel,
        title: item.title,
        scheduledFor: item.scheduledFor,
        status: item.status,
        proofUrl: item.proofUrl,
        notes: item.notes,
        realizedAt: item.realizedAt,
        version: item.version,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      },
      update: {
        clientLabel: item.clientLabel,
        channel: item.channel,
        title: item.title,
        scheduledFor: item.scheduledFor,
        status: item.status,
        proofUrl: item.proofUrl,
        notes: item.notes,
        realizedAt: item.realizedAt,
        version: item.version,
        updatedAt: item.updatedAt,
      },
    });
  }
}

function toDomain(record: PrismaEditorialItem): EditorialItem {
  const result = restoreEditorialItem(record);
  if (!result.ok) {
    throw new Error(`Persisted EditorialItem is invalid: ${result.error.code}`);
  }
  return result.value;
}
