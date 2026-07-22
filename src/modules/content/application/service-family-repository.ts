import type { ServiceFamily } from "../domain/service-family";

export interface ServiceFamilyRepository {
  findById(id: string): Promise<ServiceFamily | null>;
  listByWorld(worldKey: string): Promise<readonly ServiceFamily[]>;
  save(family: ServiceFamily): Promise<void>;
}
