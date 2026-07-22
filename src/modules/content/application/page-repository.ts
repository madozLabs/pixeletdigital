import type { Page } from "../domain/page";

export interface PageRepository {
  findById(id: string): Promise<Page | null>;
  findPublishedByWorldAndSlug(
    worldKey: string,
    slug: string,
  ): Promise<Page | null>;
  save(page: Page): Promise<void>;
}
