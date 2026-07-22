import type { Page } from "../domain/page";

export interface PageRepository {
  findById(id: string): Promise<Page | null>;
  save(page: Page): Promise<void>;
}
