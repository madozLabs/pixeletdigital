import type {
  BillingAttachment as PrismaBillingAttachment,
  PrismaClient,
} from "@/generated/prisma/client";

import type { BillingAttachmentRepository } from "../application/billing-attachment-repository";
import {
  restoreBillingAttachment,
  type BillingAttachment,
  type BillingAttachmentTargetType,
} from "../domain/billing-attachment";

export class PrismaBillingAttachmentRepository
  implements BillingAttachmentRepository
{
  constructor(private readonly client: PrismaClient) {}

  async findById(id: string): Promise<BillingAttachment | null> {
    const record = await this.client.billingAttachment.findUnique({
      where: { id },
    });
    return record ? toDomain(record) : null;
  }

  async listByTarget(
    targetType: BillingAttachmentTargetType,
    targetId: string,
  ): Promise<readonly BillingAttachment[]> {
    const records = await this.client.billingAttachment.findMany({
      where: { targetType, targetId },
      orderBy: { createdAt: "desc" },
    });
    return records.map(toDomain);
  }

  async save(attachment: BillingAttachment): Promise<void> {
    await this.client.billingAttachment.create({
      data: {
        id: attachment.id,
        worldKey: attachment.worldKey,
        targetType: attachment.targetType,
        targetId: attachment.targetId,
        fileName: attachment.fileName,
        bucket: attachment.bucket,
        objectPath: attachment.objectPath,
        publicUrl: attachment.publicUrl,
        mimeType: attachment.mimeType,
        sizeBytes: attachment.sizeBytes,
        uploadedById: attachment.uploadedById,
        createdAt: attachment.createdAt,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.client.billingAttachment.delete({ where: { id } });
  }
}

function toDomain(record: PrismaBillingAttachment): BillingAttachment {
  const result = restoreBillingAttachment(record);
  if (!result.ok) {
    throw new Error(`Persisted BillingAttachment is invalid: ${result.error.code}`);
  }
  return result.value;
}
