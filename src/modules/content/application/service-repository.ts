import type { Service } from "../domain/service";

export interface ServiceRepository {
  findById(id: string): Promise<Service | null>;
  listApprovedCurrentByWorld(worldKey: string): Promise<readonly Service[]>;
  save(service: Service): Promise<void>;
}
