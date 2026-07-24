import type {
  ClientContact as PrismaClientContact,
  PrismaClient,
} from "@/generated/prisma/client";

import type { ClientContactRepository } from "../application/client-contact-repository";
import {
  restoreClientContact,
  type ClientContact,
} from "../domain/client-contact";

export class PrismaClientContactRepository implements ClientContactRepository {
  constructor(private readonly client: PrismaClient) {}

  async listByClient(clientId: string): Promise<readonly ClientContact[]> {
    const records = await this.client.clientContact.findMany({
      where: { clientId },
      orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
    });
    return records.map(toDomain);
  }

  async save(contact: ClientContact): Promise<void> {
    await this.client.clientContact.upsert({
      where: { id: contact.id },
      create: {
        id: contact.id,
        clientId: contact.clientId,
        name: contact.name,
        role: contact.role,
        email: contact.email,
        phone: contact.phone,
        isPrimary: contact.isPrimary,
        createdAt: contact.createdAt,
        updatedAt: contact.updatedAt,
      },
      update: {
        name: contact.name,
        role: contact.role,
        email: contact.email,
        phone: contact.phone,
        isPrimary: contact.isPrimary,
        updatedAt: contact.updatedAt,
      },
    });
  }

  async unsetPrimaryForClient(clientId: string): Promise<void> {
    await this.client.clientContact.updateMany({
      where: { clientId, isPrimary: true },
      data: { isPrimary: false },
    });
  }
}

function toDomain(record: PrismaClientContact): ClientContact {
  const result = restoreClientContact(record);
  if (!result.ok) {
    throw new Error(`Persisted ClientContact is invalid: ${result.error.code}`);
  }
  return result.value;
}
