import type { PageSection } from "../domain/page-section";

export interface PageSectionRepository {
  findById(id: string): Promise<PageSection | null>;
  listByPage(pageId: string): Promise<readonly PageSection[]>;
  save(section: PageSection): Promise<void>;
  deleteById(id: string): Promise<void>;
}
