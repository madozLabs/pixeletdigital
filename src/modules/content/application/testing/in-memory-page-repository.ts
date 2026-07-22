import type { Page } from "../../domain/page";
import type { PageRepository } from "../page-repository";

export class InMemoryPageRepository implements PageRepository {
  readonly savedPages: Page[] = [];
  readonly foundIds: string[] = [];
  private readonly pagesById = new Map<string, Page>();

  constructor(pages: readonly Page[] = []) {
    for (const page of pages) this.pagesById.set(page.id, page);
  }

  async findById(id: string): Promise<Page | null> {
    this.foundIds.push(id);
    return this.pagesById.get(id) ?? null;
  }

  async findPublishedByWorldAndSlug(
    worldKey: string,
    slug: string,
  ): Promise<Page | null> {
    for (const page of this.pagesById.values()) {
      if (
        page.worldKey === worldKey &&
        page.slug === slug &&
        page.lifecycle === "PUBLISHED"
      ) {
        return page;
      }
    }
    return null;
  }

  async save(page: Page): Promise<void> {
    this.savedPages.push(page);
    this.pagesById.set(page.id, page);
  }
}
