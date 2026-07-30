export type Result<T, E> =
  Readonly<{ ok: true; value: T }> | Readonly<{ ok: false; error: E }>;

export const BILLING_ATTACHMENT_TARGET_TYPES = ["QUOTE", "INVOICE"] as const;
export type BillingAttachmentTargetType =
  (typeof BILLING_ATTACHMENT_TARGET_TYPES)[number];

export type BillingAttachmentDomainErrorCode =
  | "INVALID_ID"
  | "INVALID_WORLD_KEY"
  | "INVALID_TARGET_TYPE"
  | "INVALID_TARGET_ID"
  | "INVALID_FILE_NAME"
  | "INVALID_BUCKET"
  | "INVALID_OBJECT_PATH"
  | "INVALID_PUBLIC_URL"
  | "INVALID_MIME_TYPE"
  | "INVALID_SIZE_BYTES";

export type BillingAttachmentDomainError = Readonly<{
  code: BillingAttachmentDomainErrorCode;
  message: string;
}>;

export type BillingAttachment = Readonly<{
  id: string;
  worldKey: string;
  targetType: BillingAttachmentTargetType;
  targetId: string;
  fileName: string;
  bucket: string;
  objectPath: string;
  publicUrl: string;
  mimeType: string;
  sizeBytes: number;
  uploadedById: string | null;
  createdAt: Date;
}>;

export function isBillingAttachmentTargetType(
  value: string,
): value is BillingAttachmentTargetType {
  return (BILLING_ATTACHMENT_TARGET_TYPES as readonly string[]).includes(
    value,
  );
}

export function createBillingAttachment(
  input: Readonly<{
    id: string;
    worldKey: string;
    targetType: string;
    targetId: string;
    fileName: string;
    bucket: string;
    objectPath: string;
    publicUrl: string;
    mimeType: string;
    sizeBytes: number;
    uploadedById?: string | null;
    createdAt: Date;
  }>,
): Result<BillingAttachment, BillingAttachmentDomainError> {
  const id = input.id.trim();
  if (!id) {
    return failure(
      "INVALID_ID",
      "Attachment id must be a non-empty opaque identifier.",
    );
  }

  const worldKey = input.worldKey.trim();
  if (!worldKey) {
    return failure(
      "INVALID_WORLD_KEY",
      "Attachment worldKey must be a non-empty identifier.",
    );
  }

  if (!isBillingAttachmentTargetType(input.targetType)) {
    return failure(
      "INVALID_TARGET_TYPE",
      "Attachment targetType is not part of the controlled vocabulary.",
    );
  }

  const targetId = input.targetId.trim();
  if (!targetId) {
    return failure(
      "INVALID_TARGET_ID",
      "Attachment targetId must be a non-empty identifier.",
    );
  }

  const fileName = input.fileName.trim();
  if (!fileName || fileName.length > 255) {
    return failure(
      "INVALID_FILE_NAME",
      "Attachment fileName must be between 1 and 255 characters.",
    );
  }

  const bucket = input.bucket.trim();
  if (!bucket) {
    return failure("INVALID_BUCKET", "Attachment bucket must be a non-empty string.");
  }

  const objectPath = input.objectPath.trim();
  if (!objectPath) {
    return failure(
      "INVALID_OBJECT_PATH",
      "Attachment objectPath must be a non-empty path.",
    );
  }

  const publicUrl = input.publicUrl.trim();
  if (!publicUrl) {
    return failure(
      "INVALID_PUBLIC_URL",
      "Attachment publicUrl must be a non-empty URL.",
    );
  }

  const mimeType = input.mimeType.trim();
  if (!mimeType) {
    return failure(
      "INVALID_MIME_TYPE",
      "Attachment mimeType must be a non-empty string.",
    );
  }

  if (!Number.isInteger(input.sizeBytes) || input.sizeBytes <= 0) {
    return failure(
      "INVALID_SIZE_BYTES",
      "Attachment sizeBytes must be a positive integer.",
    );
  }

  return {
    ok: true,
    value: Object.freeze({
      id,
      worldKey,
      targetType: input.targetType,
      targetId,
      fileName,
      bucket,
      objectPath,
      publicUrl,
      mimeType,
      sizeBytes: input.sizeBytes,
      uploadedById: input.uploadedById?.trim() || null,
      createdAt: new Date(input.createdAt),
    }),
  };
}

export function restoreBillingAttachment(
  input: Readonly<{
    id: string;
    worldKey: string;
    targetType: string;
    targetId: string;
    fileName: string;
    bucket: string;
    objectPath: string;
    publicUrl: string;
    mimeType: string;
    sizeBytes: number;
    uploadedById: string | null;
    createdAt: Date;
  }>,
): Result<BillingAttachment, BillingAttachmentDomainError> {
  return createBillingAttachment(input);
}

function failure(
  code: BillingAttachmentDomainErrorCode,
  message: string,
): Result<never, BillingAttachmentDomainError> {
  return { ok: false, error: { code, message } };
}
