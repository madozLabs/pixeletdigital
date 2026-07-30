import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaClient } from "@/generated/prisma/client";
import { createWorld } from "@/modules/worlds/domain/world";
import { PrismaWorldRepository } from "@/modules/worlds/infrastructure/prisma-world-repository";

import { createBillingAttachment } from "../domain/billing-attachment";
import { PrismaBillingAttachmentRepository } from "./prisma-billing-attachment-repository";

let client: PrismaClient;
let repository: PrismaBillingAttachmentRepository;
let worlds: PrismaWorldRepository;

beforeAll(async () => {
  const connectionString = process.env.TEST_DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "TEST_DATABASE_URL is required for database integration tests.",
    );
  }
  client = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  repository = new PrismaBillingAttachmentRepository(client);
  worlds = new PrismaWorldRepository(client);

  await worlds.save(validWorld());
});

afterAll(async () => {
  await client.$disconnect();
});

describe("PrismaBillingAttachmentRepository", () => {
  it("persists and reloads an attachment", async () => {
    const attachment = validAttachment({ id: "billing_attachment_test_01" });

    await repository.save(attachment);
    const persisted = await repository.findById(attachment.id);

    expect(persisted).toEqual(attachment);
  });

  it("lists attachments for a target ordered by most recent", async () => {
    await repository.save(
      validAttachment({
        id: "billing_attachment_test_02",
        targetId: "quote_attachment_target_01",
        createdAt: new Date("2026-07-23T00:00:00.000Z"),
      }),
    );
    await repository.save(
      validAttachment({
        id: "billing_attachment_test_03",
        targetId: "quote_attachment_target_01",
        createdAt: new Date("2026-07-23T01:00:00.000Z"),
      }),
    );

    const found = await repository.listByTarget(
      "QUOTE",
      "quote_attachment_target_01",
    );

    expect(found.map((item) => item.id)).toEqual([
      "billing_attachment_test_03",
      "billing_attachment_test_02",
    ]);
  });

  it("returns null for a missing attachment", async () => {
    expect(await repository.findById("missing-attachment")).toBeNull();
  });

  it("deletes an attachment", async () => {
    const attachment = validAttachment({ id: "billing_attachment_test_04" });
    await repository.save(attachment);

    await repository.delete(attachment.id);

    expect(await repository.findById(attachment.id)).toBeNull();
  });
});

function validWorld() {
  const now = new Date("2026-07-23T00:00:00.000Z");
  const result = createWorld({
    id: "world_billing_attachment_test",
    key: "billing-attachment-test-world",
    displayName: "Billing Attachment Test World",
    mode: "ACTIVE",
    createdAt: now,
    updatedAt: now,
  });
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

function validAttachment(
  overrides: Partial<{ id: string; targetId: string; createdAt: Date }> = {},
) {
  const now = new Date("2026-07-23T00:00:00.000Z");
  const result = createBillingAttachment({
    id: overrides.id ?? "billing_attachment_test_default",
    worldKey: "billing-attachment-test-world",
    targetType: "QUOTE",
    targetId: overrides.targetId ?? "quote_attachment_target_default",
    fileName: "bon-de-commande.pdf",
    bucket: "site-media",
    objectPath: "billing-attachment-test-world/attachments/bon-de-commande.pdf",
    publicUrl: "https://example.com/bon-de-commande.pdf",
    mimeType: "application/pdf",
    sizeBytes: 45000,
    uploadedById: null,
    createdAt: overrides.createdAt ?? now,
  });
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}
