import type {
  Client as PrismaClientRecord,
  PrismaClient,
} from "@/generated/prisma/client";

import type { ClientRepository } from "../application/client-repository";
import { restoreClient, type Client } from "../domain/client";

export class PrismaClientRepository implements ClientRepository {
  constructor(private readonly client: PrismaClient) {}

  async findById(id: string): Promise<Client | null> {
    const record = await this.client.client.findUnique({ where: { id } });
    return record ? toDomain(record) : null;
  }

  async listByWorld(worldKey: string): Promise<readonly Client[]> {
    const records = await this.client.client.findMany({
      where: { worldKey },
      orderBy: { name: "asc" },
    });
    return records.map(toDomain);
  }

  async save(client: Client): Promise<void> {
    await this.client.client.upsert({
      where: { id: client.id },
      create: {
        id: client.id,
        worldKey: client.worldKey,
        name: client.name,
        email: client.email,
        phone: client.phone,
        address: client.address,
        status: client.status,
        version: client.version,
        createdAt: client.createdAt,
        updatedAt: client.updatedAt,
      },
      update: {
        name: client.name,
        email: client.email,
        phone: client.phone,
        address: client.address,
        status: client.status,
        version: client.version,
        updatedAt: client.updatedAt,
      },
    });
  }
}

function toDomain(record: PrismaClientRecord): Client {
  const result = restoreClient(record);
  if (!result.ok) {
    throw new Error(`Persisted Client is invalid: ${result.error.code}`);
  }
  return result.value;
}
