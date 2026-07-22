import type {
  Prisma,
  PrismaClient,
  PageSection as PrismaPageSection,
} from "@/generated/prisma/client";

import type { PageSectionRepository } from "../application/page-section-repository";
import {
  restorePageSection,
  type PageSection,
  type PageSectionPayload,
} from "../domain/page-section";

export class PrismaPageSectionRepository implements PageSectionRepository {
  constructor(private readonly client: PrismaClient) {}

  async findById(id: string): Promise<PageSection | null> {
    const record = await this.client.pageSection.findUnique({ where: { id } });
    return record ? toDomain(record) : null;
  }

  async listByPage(pageId: string): Promise<readonly PageSection[]> {
    const records = await this.client.pageSection.findMany({
      where: { pageId },
      orderBy: { order: "asc" },
    });
    return records.map(toDomain);
  }

  async save(section: PageSection): Promise<void> {
    const payload = section.payload as Prisma.InputJsonValue;
    await this.client.pageSection.upsert({
      where: { id: section.id },
      create: {
        id: section.id,
        pageId: section.pageId,
        sectionType: section.sectionType,
        order: section.order,
        payload,
        payloadSchemaVersion: section.payloadSchemaVersion,
        version: section.version,
        createdAt: section.createdAt,
        updatedAt: section.updatedAt,
      },
      update: {
        sectionType: section.sectionType,
        order: section.order,
        payload,
        payloadSchemaVersion: section.payloadSchemaVersion,
        version: section.version,
        updatedAt: section.updatedAt,
      },
    });
  }

  async deleteById(id: string): Promise<void> {
    await this.client.pageSection.delete({ where: { id } });
  }
}

function toDomain(record: PrismaPageSection): PageSection {
  const result = restorePageSection({
    ...record,
    payload: record.payload as PageSectionPayload,
  });
  if (!result.ok) {
    throw new Error(`Persisted PageSection is invalid: ${result.error.code}`);
  }

  return result.value;
}
