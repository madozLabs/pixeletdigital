import type { Client } from "../domain/client";

export interface ClientRepository {
  findById(id: string): Promise<Client | null>;
  listByWorld(worldKey: string): Promise<readonly Client[]>;
  // Returns false when a concurrent write already moved the row past the
  // version this client was read at (optimistic-lock conflict), true
  // otherwise -- mirrors InvoiceRepository.save.
  save(client: Client): Promise<boolean>;
}
