import type { CatalogueItem } from "../../domain/catalogue-item";
import type { CatalogueItemRepository } from "../catalogue-item-repository";

export class InMemoryCatalogueItemRepository implements CatalogueItemRepository {
  readonly savedItems: CatalogueItem[] = [];
  private readonly itemsById = new Map<string, CatalogueItem>();

  constructor(items: readonly CatalogueItem[] = []) {
    for (const item of items) this.itemsById.set(item.id, item);
  }

  async findById(id: string): Promise<CatalogueItem | null> {
    return this.itemsById.get(id) ?? null;
  }

  async listByWorld(worldKey: string): Promise<readonly CatalogueItem[]> {
    return [...this.itemsById.values()]
      .filter((item) => item.worldKey === worldKey)
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  async save(item: CatalogueItem): Promise<void> {
    this.savedItems.push(item);
    this.itemsById.set(item.id, item);
  }
}
