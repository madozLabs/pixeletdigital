import type {
  PrismaClient,
  Page as PrismaPage,
} from "@/generated/prisma/client";

import type { PageRepository } from "../application/page-repository";
import { restorePage, type Page } from "../domain/page";

export class PrismaPageRepository implements PageRepository {
  constructor(private readonly client: PrismaClient) {}

  async findById(id: string): Promise<Page | null> {
    const record = await this.client.page.findUnique({ where: { id } });
    return record ? toDomain(record) : null;
  }

  async findPublishedByWorldAndSlug(
    worldKey: string,
    slug: string,
  ): Promise<Page | null> {
    const record = await this.client.page.findFirst({
      where: { worldKey, slug, lifecycle: "PUBLISHED" },
    });
    return record ? toDomain(record) : null;
  }

  async save(page: Page): Promise<void> {
    await this.client.page.upsert({
      where: { id: page.id },
      create: {
        id: page.id,
        worldKey: page.worldKey,
        pageType: page.pageType,
        title: page.title,
        slug: page.slug,
        lifecycle: page.lifecycle,
        version: page.version,
        publishedAt: page.publishedAt,
        createdAt: page.createdAt,
        updatedAt: page.updatedAt,
      },
      update: {
        title: page.title,
        slug: page.slug,
        lifecycle: page.lifecycle,
        version: page.version,
        publishedAt: page.publishedAt,
        updatedAt: page.updatedAt,
      },
    });
  }
}

function toDomain(record: PrismaPage): Page {
  const result = restorePage(record);
  if (!result.ok) {
    throw new Error(`Persisted Page is invalid: ${result.error.code}`);
  }

  return result.value;
}
