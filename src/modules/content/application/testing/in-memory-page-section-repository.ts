import type { PageSection } from "../../domain/page-section";
import type { PageSectionRepository } from "../page-section-repository";

export class InMemoryPageSectionRepository implements PageSectionRepository {
  readonly savedSections: PageSection[] = [];
  readonly deletedIds: string[] = [];
  private readonly sectionsById = new Map<string, PageSection>();

  constructor(sections: readonly PageSection[] = []) {
    for (const section of sections) this.sectionsById.set(section.id, section);
  }

  async findById(id: string): Promise<PageSection | null> {
    return this.sectionsById.get(id) ?? null;
  }

  async listByPage(pageId: string): Promise<readonly PageSection[]> {
    return [...this.sectionsById.values()]
      .filter((section) => section.pageId === pageId)
      .sort((a, b) => a.order - b.order);
  }

  async save(section: PageSection): Promise<void> {
    this.savedSections.push(section);
    this.sectionsById.set(section.id, section);
  }

  async deleteById(id: string): Promise<void> {
    this.deletedIds.push(id);
    this.sectionsById.delete(id);
  }
}
