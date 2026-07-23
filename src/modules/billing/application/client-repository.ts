import type { Client } from "../domain/client";

export interface ClientRepository {
  findById(id: string): Promise<Client | null>;
  listByWorld(worldKey: string): Promise<readonly Client[]>;
  save(client: Client): Promise<void>;
}
