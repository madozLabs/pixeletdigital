import type { EditorialItem } from "../domain/editorial-item";

export interface EditorialItemRepository {
  findById(id: string): Promise<EditorialItem | null>;
  listByWorld(worldKey: string): Promise<readonly EditorialItem[]>;
  save(item: EditorialItem): Promise<void>;
}
