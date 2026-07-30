import type { RequestContext } from "@/shared/request-context";

import {
  createBillingAttachment,
  type BillingAttachment,
  type BillingAttachmentTargetType,
  type Result,
} from "../domain/billing-attachment";
import type { BillingApplicationError } from "./application-error";
import type { BillingAttachmentRepository } from "./billing-attachment-repository";
import {
  forbidden,
  hasWorldScope,
  mayAccessBilling,
  requireActiveActor,
} from "./billing-authorization";
import type { InvoiceRepository } from "./invoice-repository";
import type { QuoteRepository } from "./quote-repository";

export type BillingAttachmentDependencies = Readonly<{
  attachments: BillingAttachmentRepository;
  quotes: QuoteRepository;
  invoices: InvoiceRepository;
}>;

async function resolveTargetWorldKey(
  dependencies: BillingAttachmentDependencies,
  targetType: BillingAttachmentTargetType,
  targetId: string,
): Promise<string | null> {
  if (targetType === "QUOTE") {
    const quote = await dependencies.quotes.findById(targetId);
    return quote?.worldKey ?? null;
  }
  const invoice = await dependencies.invoices.findById(targetId);
  return invoice?.worldKey ?? null;
}

export type UploadBillingAttachmentInput = Readonly<{
  id: string;
  targetType: string;
  targetId: string;
  fileName: string;
  bucket: string;
  objectPath: string;
  publicUrl: string;
  mimeType: string;
  sizeBytes: number;
}>;

export async function uploadBillingAttachment(
  dependencies: BillingAttachmentDependencies,
  context: RequestContext,
  input: UploadBillingAttachmentInput,
): Promise<Result<BillingAttachment, BillingApplicationError>> {
  const actorResult = requireActiveActor(context);
  if (!actorResult.ok) return actorResult;
  const actor = actorResult.value;

  if (input.targetType !== "QUOTE" && input.targetType !== "INVOICE") {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        validationCode: "INVALID_TARGET_TYPE",
        message: "Attachment targetType is not part of the controlled vocabulary.",
      },
    };
  }

  const worldKey = await resolveTargetWorldKey(
    dependencies,
    input.targetType,
    input.targetId,
  );
  if (!worldKey) {
    return {
      ok: false,
      error: { code: "NOT_FOUND", message: "The quote or invoice was not found." },
    };
  }
  if (!mayAccessBilling(actor) || !hasWorldScope(actor, worldKey)) {
    return forbidden();
  }

  const attachmentResult = createBillingAttachment({
    id: input.id,
    worldKey,
    targetType: input.targetType,
    targetId: input.targetId,
    fileName: input.fileName,
    bucket: input.bucket,
    objectPath: input.objectPath,
    publicUrl: input.publicUrl,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
    uploadedById: actor.id,
    createdAt: context.clock.now(),
  });
  if (!attachmentResult.ok) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        validationCode: attachmentResult.error.code,
        message: attachmentResult.error.message,
      },
    };
  }

  await dependencies.attachments.save(attachmentResult.value);
  return { ok: true, value: attachmentResult.value };
}

export type DeleteBillingAttachmentInput = Readonly<{ id: string }>;

export async function deleteBillingAttachment(
  dependencies: BillingAttachmentDependencies,
  context: RequestContext,
  input: DeleteBillingAttachmentInput,
): Promise<Result<BillingAttachment, BillingApplicationError>> {
  const actorResult = requireActiveActor(context);
  if (!actorResult.ok) return actorResult;
  const actor = actorResult.value;

  const attachment = await dependencies.attachments.findById(input.id);
  if (!attachment) {
    return {
      ok: false,
      error: { code: "NOT_FOUND", message: "The attachment was not found." },
    };
  }
  if (!mayAccessBilling(actor) || !hasWorldScope(actor, attachment.worldKey)) {
    return forbidden();
  }

  await dependencies.attachments.delete(attachment.id);
  return { ok: true, value: attachment };
}

export type ListBillingAttachmentsInput = Readonly<{
  targetType: string;
  targetId: string;
  worldKey: string;
}>;

export async function listBillingAttachments(
  dependencies: BillingAttachmentDependencies,
  context: RequestContext,
  input: ListBillingAttachmentsInput,
): Promise<Result<readonly BillingAttachment[], BillingApplicationError>> {
  const actorResult = requireActiveActor(context);
  if (!actorResult.ok) return actorResult;
  const actor = actorResult.value;

  if (input.targetType !== "QUOTE" && input.targetType !== "INVOICE") {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        validationCode: "INVALID_TARGET_TYPE",
        message: "Attachment targetType is not part of the controlled vocabulary.",
      },
    };
  }
  if (!mayAccessBilling(actor) || !hasWorldScope(actor, input.worldKey)) {
    return forbidden();
  }

  const attachments = await dependencies.attachments.listByTarget(
    input.targetType,
    input.targetId,
  );
  return { ok: true, value: attachments };
}
