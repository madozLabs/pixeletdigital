import type { ClientContact } from "../domain/client-contact";

export interface ClientContactRepository {
  listByClient(clientId: string): Promise<readonly ClientContact[]>;
  save(contact: ClientContact): Promise<void>;
  unsetPrimaryForClient(clientId: string): Promise<void>;
}
