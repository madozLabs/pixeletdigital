import type { Client } from "../../domain/client";
import type { ClientRepository } from "../client-repository";

export class InMemoryClientRepository implements ClientRepository {
  readonly savedClients: Client[] = [];
  private readonly clientsById = new Map<string, Client>();

  constructor(clients: readonly Client[] = []) {
    for (const client of clients) this.clientsById.set(client.id, client);
  }

  async findById(id: string): Promise<Client | null> {
    return this.clientsById.get(id) ?? null;
  }

  async listByWorld(worldKey: string): Promise<readonly Client[]> {
    return [...this.clientsById.values()]
      .filter((client) => client.worldKey === worldKey)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async save(client: Client): Promise<void> {
    this.savedClients.push(client);
    this.clientsById.set(client.id, client);
  }
}
