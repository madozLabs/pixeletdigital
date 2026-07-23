import type { EditorialItem } from "../../domain/editorial-item";
import type { EditorialItemRepository } from "../editorial-item-repository";

export class InMemoryEditorialItemRepository implements EditorialItemRepository {
  readonly savedItems: EditorialItem[] = [];
  private readonly itemsById = new Map<string, EditorialItem>();

  constructor(items: readonly EditorialItem[] = []) {
    for (const item of items) this.itemsById.set(item.id, item);
  }

  async findById(id: string): Promise<EditorialItem | null> {
    return this.itemsById.get(id) ?? null;
  }

  async listByWorld(worldKey: string): Promise<readonly EditorialItem[]> {
    return [...this.itemsById.values()]
      .filter((item) => item.worldKey === worldKey)
      .sort((a, b) => a.scheduledFor.getTime() - b.scheduledFor.getTime());
  }

  async save(item: EditorialItem): Promise<void> {
    this.savedItems.push(item);
    this.itemsById.set(item.id, item);
  }
}
