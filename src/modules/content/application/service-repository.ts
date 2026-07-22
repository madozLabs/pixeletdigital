import type { Service } from "../domain/service";

export interface ServiceRepository {
  findById(id: string): Promise<Service | null>;
  listByWorld(worldKey: string): Promise<readonly Service[]>;
  listApprovedCurrentByWorld(worldKey: string): Promise<readonly Service[]>;
  findPublishedByWorldAndSlug(
    worldKey: string,
    slug: string,
  ): Promise<Service | null>;
  save(service: Service): Promise<void>;
}
