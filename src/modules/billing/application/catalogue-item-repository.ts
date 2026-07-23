import type { CatalogueItem } from "../domain/catalogue-item";

export interface CatalogueItemRepository {
  findById(id: string): Promise<CatalogueItem | null>;
  listByWorld(worldKey: string): Promise<readonly CatalogueItem[]>;
  save(item: CatalogueItem): Promise<void>;
}
