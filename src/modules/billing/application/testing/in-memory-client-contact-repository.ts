import type { ClientContact } from "../../domain/client-contact";
import type { ClientContactRepository } from "../client-contact-repository";

export class InMemoryClientContactRepository implements ClientContactRepository {
  readonly savedContacts: ClientContact[] = [];
  private readonly contactsById = new Map<string, ClientContact>();

  constructor(contacts: readonly ClientContact[] = []) {
    for (const contact of contacts) this.contactsById.set(contact.id, contact);
  }

  async listByClient(clientId: string): Promise<readonly ClientContact[]> {
    return [...this.contactsById.values()]
      .filter((contact) => contact.clientId === clientId)
      .sort(
        (a, b) =>
          Number(b.isPrimary) - Number(a.isPrimary) ||
          a.name.localeCompare(b.name),
      );
  }

  async save(contact: ClientContact): Promise<void> {
    this.savedContacts.push(contact);
    this.contactsById.set(contact.id, contact);
  }

  async unsetPrimaryForClient(clientId: string): Promise<void> {
    for (const [id, contact] of this.contactsById.entries()) {
      if (contact.clientId === clientId && contact.isPrimary) {
        this.contactsById.set(id, { ...contact, isPrimary: false });
      }
    }
  }
}
