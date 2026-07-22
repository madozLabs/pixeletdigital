import type { Service } from "../domain/service";

export interface ServiceRepository {
  findById(id: string): Promise<Service | null>;
  save(service: Service): Promise<void>;
}
