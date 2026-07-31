import type {
  RevenueEntry as PrismaRevenueEntry,
  PrismaClient,
} from "@/generated/prisma/client";

import type {
  ListRevenueEntriesFilter,
  RevenueEntryRepository,
} from "../application/revenue-entry-repository";
import { restoreRevenueEntry, type RevenueEntry } from "../domain/revenue-entry";

export class PrismaRevenueEntryRepository implements RevenueEntryRepository {
  constructor(private readonly client: PrismaClient) {}

  async findById(id: string): Promise<RevenueEntry | null> {
    const record = await this.client.revenueEntry.findUnique({
      where: { id },
    });
    return record ? toDomain(record) : null;
  }

  async listByWorld(
    filter: ListRevenueEntriesFilter,
  ): Promise<readonly RevenueEntry[]> {
    const records = await this.client.revenueEntry.findMany({
      where: whereFor(filter),
      orderBy: { revenueDate: "desc" },
      skip: filter.skip,
      take: filter.take,
    });
    return records.map(toDomain);
  }

  async countByWorld(
    filter: Omit<ListRevenueEntriesFilter, "skip" | "take">,
  ): Promise<number> {
    return this.client.revenueEntry.count({ where: whereFor(filter) });
  }

  async save(entry: RevenueEntry): Promise<void> {
    await this.client.revenueEntry.create({
      data: {
        id: entry.id,
        worldKey: entry.worldKey,
        label: entry.label,
        amountCents: entry.amountCents,
        revenueDate: entry.revenueDate,
        notes: entry.notes,
        createdById: entry.createdById,
        createdAt: entry.createdAt,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.client.revenueEntry.delete({ where: { id } });
  }
}

function whereFor(
  filter: Readonly<{ worldKey: string; from?: Date | null; to?: Date | null }>,
) {
  return {
    worldKey: filter.worldKey,
    ...(filter.from || filter.to
      ? {
          revenueDate: {
            ...(filter.from ? { gte: filter.from } : {}),
            ...(filter.to ? { lte: filter.to } : {}),
          },
        }
      : {}),
  };
}

function toDomain(record: PrismaRevenueEntry): RevenueEntry {
  const result = restoreRevenueEntry(record);
  if (!result.ok) {
    throw new Error(`Persisted RevenueEntry is invalid: ${result.error.code}`);
  }
  return result.value;
}
