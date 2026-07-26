import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaClient } from "@/generated/prisma/client";
import { createWorld } from "@/modules/worlds/domain/world";
import { PrismaWorldRepository } from "@/modules/worlds/infrastructure/prisma-world-repository";

import { recordAuditEvent } from "./record-audit-event";

let client: PrismaClient;

const worldKey = "audit-test-world";

beforeAll(async () => {
  const connectionString = process.env.TEST_DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "TEST_DATABASE_URL is required for database integration tests.",
    );
  }
  client = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

  const worlds = new PrismaWorldRepository(client);
  const worldResult = createWorld({
    id: "world_audit_test",
    key: worldKey,
    displayName: "Audit Test World",
    mode: "ACTIVE",
    createdAt: new Date("2026-07-15T00:00:00.000Z"),
    updatedAt: new Date("2026-07-15T00:00:00.000Z"),
  });
  if (!worldResult.ok) throw new Error(worldResult.error.message);
  await worlds.save(worldResult.value);
});

afterAll(async () => {
  await client.auditEvent.deleteMany({
    where: { targetId: { startsWith: "audit_target_test_" } },
  });
  await client.$disconnect();
});

describe("recordAuditEvent", () => {
  it("persists an audit event resolved to the correct world", async () => {
    await recordAuditEvent(client, {
      action: "CONTENT_PAGE_PUBLISHED",
      targetType: "PAGE",
      targetId: "audit_target_test_page_01",
      actorId: "user_audit_test",
      correlationId: "corr_audit_test_01",
      originChannel: "WORKSPACE",
      worldKey,
      occurredAt: new Date("2026-07-26T10:00:00.000Z"),
    });

    const events = await client.auditEvent.findMany({
      where: { targetId: "audit_target_test_page_01" },
      include: { world: { select: { key: true } } },
    });

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      action: "CONTENT_PAGE_PUBLISHED",
      targetType: "PAGE",
      result: "SUCCEEDED",
      originChannel: "WORKSPACE",
    });
    expect(events[0]?.world?.key).toBe(worldKey);
  });

  it("stores worldId null without throwing when worldKey is unknown", async () => {
    await expect(
      recordAuditEvent(client, {
        action: "BILLING_INVOICE_ISSUED",
        targetType: "INVOICE",
        targetId: "audit_target_test_invoice_01",
        actorId: "user_audit_test",
        correlationId: "corr_audit_test_02",
        originChannel: "WORKSPACE",
        worldKey: "unknown-world-key",
        occurredAt: new Date("2026-07-26T10:00:00.000Z"),
      }),
    ).resolves.toBeUndefined();

    const event = await client.auditEvent.findFirst({
      where: { targetId: "audit_target_test_invoice_01" },
    });
    expect(event).toMatchObject({
      action: "BILLING_INVOICE_ISSUED",
      worldId: null,
    });
  });

  it("never throws even when the write itself is impossible", async () => {
    const brokenClient = {
      world: { findUnique: () => Promise.resolve(null) },
      auditEvent: {
        create: () => Promise.reject(new Error("connection lost")),
      },
    } as unknown as PrismaClient;

    await expect(
      recordAuditEvent(brokenClient, {
        action: "CONTENT_SERVICE_ARCHIVED",
        targetType: "SERVICE",
        targetId: "audit_target_test_service_01",
        actorId: "user_audit_test",
        correlationId: "corr_audit_test_03",
        originChannel: "SYSTEM",
        occurredAt: new Date("2026-07-26T10:00:00.000Z"),
      }),
    ).resolves.toBeUndefined();
  });
});
