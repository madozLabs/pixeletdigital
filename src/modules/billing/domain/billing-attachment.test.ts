import { describe, expect, it } from "vitest";

import {
  createBillingAttachment,
  restoreBillingAttachment,
} from "./billing-attachment";

const now = new Date("2026-07-23T00:00:00.000Z");

describe("createBillingAttachment", () => {
  it("creates a valid attachment", () => {
    const result = createBillingAttachment(validInput());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.targetType).toBe("QUOTE");
    expect(result.value.fileName).toBe("bon-de-commande.pdf");
  });

  it("rejects an unknown target type", () => {
    const result = createBillingAttachment({
      ...validInput(),
      targetType: "CLIENT",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_TARGET_TYPE");
  });

  it("rejects an empty file name", () => {
    const result = createBillingAttachment({ ...validInput(), fileName: "  " });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_FILE_NAME");
  });

  it("rejects a zero size", () => {
    const result = createBillingAttachment({ ...validInput(), sizeBytes: 0 });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_SIZE_BYTES");
  });

  it("defaults uploadedById to null when absent", () => {
    const input = validInput();
    const result = createBillingAttachment({
      id: input.id,
      worldKey: input.worldKey,
      targetType: input.targetType,
      targetId: input.targetId,
      fileName: input.fileName,
      bucket: input.bucket,
      objectPath: input.objectPath,
      publicUrl: input.publicUrl,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      createdAt: input.createdAt,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.uploadedById).toBeNull();
  });
});

describe("restoreBillingAttachment", () => {
  it("round-trips a persisted attachment", () => {
    const created = createBillingAttachment(validInput());
    if (!created.ok) throw new Error("expected a valid attachment");

    const result = restoreBillingAttachment(created.value);

    expect(result).toEqual({ ok: true, value: created.value });
  });
});

function validInput() {
  return {
    id: "billing_attachment_test_01",
    worldKey: "pixel-digital",
    targetType: "QUOTE",
    targetId: "quote_test_01",
    fileName: "bon-de-commande.pdf",
    bucket: "site-media",
    objectPath: "pixel-digital/attachments/bon-de-commande.pdf",
    publicUrl: "https://example.com/bon-de-commande.pdf",
    mimeType: "application/pdf",
    sizeBytes: 45000,
    uploadedById: "user_test_01",
    createdAt: now,
  };
}
