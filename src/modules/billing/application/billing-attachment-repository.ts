import type {
  BillingAttachment,
  BillingAttachmentTargetType,
} from "../domain/billing-attachment";

export interface BillingAttachmentRepository {
  findById(id: string): Promise<BillingAttachment | null>;
  listByTarget(
    targetType: BillingAttachmentTargetType,
    targetId: string,
  ): Promise<readonly BillingAttachment[]>;
  save(attachment: BillingAttachment): Promise<void>;
  delete(id: string): Promise<void>;
}
