import type { BillingAttachment } from "../../domain/billing-attachment";
import type { BillingAttachmentRepository } from "../billing-attachment-repository";

export class InMemoryBillingAttachmentRepository
  implements BillingAttachmentRepository
{
  private readonly attachmentsById = new Map<string, BillingAttachment>();

  constructor(attachments: readonly BillingAttachment[] = []) {
    for (const attachment of attachments) {
      this.attachmentsById.set(attachment.id, attachment);
    }
  }

  async findById(id: string): Promise<BillingAttachment | null> {
    return this.attachmentsById.get(id) ?? null;
  }

  async listByTarget(
    targetType: string,
    targetId: string,
  ): Promise<readonly BillingAttachment[]> {
    return [...this.attachmentsById.values()]
      .filter(
        (attachment) =>
          attachment.targetType === targetType &&
          attachment.targetId === targetId,
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async save(attachment: BillingAttachment): Promise<void> {
    this.attachmentsById.set(attachment.id, attachment);
  }

  async delete(id: string): Promise<void> {
    this.attachmentsById.delete(id);
  }
}
