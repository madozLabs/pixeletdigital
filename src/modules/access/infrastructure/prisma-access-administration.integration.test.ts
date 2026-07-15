import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { PrismaClient } from "@/generated/prisma/client";
import type { AuditEvent } from "@/modules/audit/application/audit-event";

import { createRoleAssignment, createUser } from "../domain/access";
import { PrismaAccessAdministrationStore } from "./prisma-access-administration";

const now = new Date("2026-07-15T12:00:00.000Z");
let client: PrismaClient;
let store: PrismaAccessAdministrationStore;

beforeAll(() => {
  const connectionString = process.env.TEST_DATABASE_URL;
  if (!connectionString) throw new Error("TEST_DATABASE_URL is required.");
  client = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  store = new PrismaAccessAdministrationStore(client);
});

beforeEach(async () => {
  await client.auditEvent.deleteMany();
  await client.roleAssignment.deleteMany();
  await client.user.deleteMany();
});

afterAll(async () => {
  await client.$disconnect();
});

describe("Prisma Access administration transaction", () => {
  it("commits a user status mutation and audit together", async () => {
    await client.user.create({ data: { id: "target", status: "ACTIVE" } });
    const updated = user("target", "INACTIVE");
    const result = await store.commit({
      preconditions: [
        { type: "USER_STATUS_IS", userId: "target", status: "ACTIVE" },
      ],
      mutation: { type: "SET_USER_STATUS", user: updated },
      auditEvent: audit(
        "audit_status",
        "ACCESS_USER_DEACTIVATED",
        "USER",
        "target",
      ),
    });

    expect(result).toEqual({ ok: true, value: undefined });
    await expect(
      client.user.findUnique({ where: { id: "target" } }),
    ).resolves.toMatchObject({ status: "INACTIVE" });
    await expect(
      client.auditEvent.findUnique({ where: { id: "audit_status" } }),
    ).resolves.toMatchObject({ actorId: "actor", originChannel: "WORKSPACE" });
  });

  it("returns CONFLICT when the expected user status changed", async () => {
    await client.user.create({ data: { id: "target", status: "INACTIVE" } });
    const result = await store.commit({
      preconditions: [
        { type: "USER_STATUS_IS", userId: "target", status: "ACTIVE" },
      ],
      mutation: { type: "SET_USER_STATUS", user: user("target", "INACTIVE") },
      auditEvent: audit(
        "audit_stale",
        "ACCESS_USER_DEACTIVATED",
        "USER",
        "target",
      ),
    });

    expect(result).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(await client.auditEvent.count()).toBe(0);
  });

  it("rejects an overlapping assignment inside the transaction", async () => {
    await client.user.create({ data: { id: "target", status: "ACTIVE" } });
    await client.roleAssignment.create({
      data: {
        id: "existing",
        userId: "target",
        role: "EDITOR",
        scopeType: "GLOBAL",
        worldId: null,
        validFrom: new Date("2026-07-15T10:00:00.000Z"),
      },
    });
    const candidate = assignment("candidate");
    const result = await store.commit({
      preconditions: [
        { type: "NO_OVERLAPPING_ASSIGNMENT", assignment: candidate },
      ],
      mutation: { type: "SAVE_ASSIGNMENT", assignment: candidate },
      auditEvent: audit(
        "audit_overlap",
        "ACCESS_ROLE_ASSIGNED",
        "ROLE_ASSIGNMENT",
        candidate.id,
      ),
    });

    expect(result).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(await client.roleAssignment.count()).toBe(1);
    expect(await client.auditEvent.count()).toBe(0);
  });

  it("rolls back the Access mutation when Audit insertion fails", async () => {
    await client.user.create({ data: { id: "target", status: "ACTIVE" } });
    await client.auditEvent.create({
      data: {
        id: "duplicate_audit",
        occurredAt: now,
        actorId: "actor",
        action: "ACCESS_USER_DEACTIVATED",
        targetType: "USER",
        targetId: "other",
        result: "SUCCEEDED",
        correlationId: "existing",
        originChannel: "SYSTEM",
      },
    });
    const result = await store.commit({
      preconditions: [
        { type: "USER_STATUS_IS", userId: "target", status: "ACTIVE" },
      ],
      mutation: { type: "SET_USER_STATUS", user: user("target", "INACTIVE") },
      auditEvent: audit(
        "duplicate_audit",
        "ACCESS_USER_DEACTIVATED",
        "USER",
        "target",
      ),
    });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "DEPENDENCY_UNAVAILABLE" },
    });
    const connectionString = process.env.TEST_DATABASE_URL;
    if (!connectionString) throw new Error("TEST_DATABASE_URL is required.");
    const verifier = new PrismaClient({
      adapter: new PrismaPg({ connectionString }),
    });
    try {
      await expect(
        verifier.user.findUnique({ where: { id: "target" } }),
      ).resolves.toMatchObject({ status: "ACTIVE" });
      expect(await verifier.auditEvent.count()).toBe(1);
    } finally {
      await verifier.$disconnect();
    }
  });

  it("classifies an unresolved Audit world as dependency unavailable", async () => {
    await client.user.create({ data: { id: "target", status: "ACTIVE" } });
    const result = await store.commit({
      preconditions: [
        { type: "USER_STATUS_IS", userId: "target", status: "ACTIVE" },
      ],
      mutation: { type: "SET_USER_STATUS", user: user("target", "INACTIVE") },
      auditEvent: audit(
        "audit_missing_world",
        "ACCESS_USER_DEACTIVATED",
        "USER",
        "target",
        "missing-world",
      ),
    });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "DEPENDENCY_UNAVAILABLE" },
    });
    await expect(
      client.user.findUnique({ where: { id: "target" } }),
    ).resolves.toMatchObject({ status: "ACTIVE" });
    expect(await client.auditEvent.count()).toBe(0);
  });
});

function user(id: string, status: "ACTIVE" | "INACTIVE") {
  const result = createUser({ id, status });
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

function assignment(id: string) {
  const result = createRoleAssignment({
    id,
    userId: "target",
    role: "EDITOR",
    scope: { type: "GLOBAL" },
    validFrom: new Date("2026-07-15T11:00:00.000Z"),
  });
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

function audit(
  id: string,
  action: AuditEvent["action"],
  targetType: AuditEvent["targetType"],
  targetId: string,
  worldKey?: string,
): AuditEvent {
  return {
    id,
    occurredAt: now,
    actorId: "actor",
    action,
    targetType,
    targetId,
    result: "SUCCEEDED",
    correlationId: "integration-correlation",
    origin: { channel: "WORKSPACE" },
    ...(worldKey ? { worldKey } : {}),
  };
}
