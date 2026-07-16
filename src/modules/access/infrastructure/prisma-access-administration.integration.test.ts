import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { PrismaClient } from "@/generated/prisma/client";
import type { AuditEvent } from "@/modules/audit/application/audit-event";
import type { RequestContext } from "@/shared/request-context";

import { createRoleAssignment, createUser } from "../domain/access";
import { createEmployee } from "../application/access-administration";
import { PrismaAccessAdministrationStore } from "./prisma-access-administration";

const now = new Date("2026-07-15T12:00:00.000Z");
let connectionString: string;
let client: PrismaClient;
let store: PrismaAccessAdministrationStore;

beforeAll(() => {
  connectionString = process.env.TEST_DATABASE_URL ?? "";
  if (!connectionString) throw new Error("TEST_DATABASE_URL is required.");
  client = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  store = new PrismaAccessAdministrationStore(client);
});

beforeEach(async () => {
  await client.auditEvent.deleteMany();
  await client.authAccount.deleteMany();
  await client.roleAssignment.deleteMany();
  await client.user.deleteMany();
});

afterAll(async () => {
  await client.$disconnect();
});

describe("Prisma Access administration transaction", () => {
  it("provisions all employee records with a normalized unique email", async () => {
    const result = await createEmployee(
      {
        reader: store,
        transaction: store,
        employeePolicy: { allowedDomain: "company.test" },
      },
      superAdminContext(),
      employeeInput(),
    );
    expect(result).toMatchObject({ ok: true });
    await expect(
      client.user.findUnique({ where: { id: "employee" } }),
    ).resolves.toMatchObject({
      displayName: "Employee Name",
      normalizedEmail: "employee@company.test",
      status: "ACTIVE",
    });
    expect(await client.authAccount.count()).toBe(1);
    expect(await client.roleAssignment.count()).toBe(1);
    await expect(
      client.auditEvent.findUnique({ where: { id: "employee_audit" } }),
    ).resolves.toMatchObject({
      action: "ACCESS_USER_CREATED",
      targetType: "USER",
    });
  });

  it("enforces normalized email uniqueness case-insensitively", async () => {
    await client.user.create({
      data: {
        id: "existing",
        displayName: "Existing",
        normalizedEmail: "employee@company.test",
        status: "ACTIVE",
      },
    });
    const result = await createEmployee(
      {
        reader: store,
        transaction: store,
        employeePolicy: { allowedDomain: "company.test" },
      },
      superAdminContext(),
      employeeInput({ email: " EMPLOYEE@COMPANY.TEST " }),
    );
    expect(result).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(await client.user.count()).toBe(1);
    expect(await client.auditEvent.count()).toBe(0);
  });

  it("returns CONFLICT for an existing provider identity", async () => {
    await client.user.create({ data: userData("existing", "ACTIVE") });
    await client.authAccount.create({
      data: {
        id: "existing_auth",
        userId: "existing",
        provider: "provider",
        providerAccountId: "subject",
      },
    });
    const result = await createEmployee(
      {
        reader: store,
        transaction: store,
        employeePolicy: { allowedDomain: "company.test" },
      },
      superAdminContext(),
      employeeInput(),
    );
    expect(result).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(await client.user.count()).toBe(1);
    expect(await client.roleAssignment.count()).toBe(0);
  });

  it("rolls back user, identity and assignment when employee audit insertion fails", async () => {
    await client.auditEvent.create({
      data: {
        id: "employee_audit",
        occurredAt: now,
        actorId: "actor",
        action: "ACCESS_USER_CREATED",
        targetType: "USER",
        targetId: "existing",
        result: "SUCCEEDED",
        correlationId: "existing",
        originChannel: "SYSTEM",
      },
    });
    const result = await createEmployee(
      {
        reader: store,
        transaction: store,
        employeePolicy: { allowedDomain: "company.test" },
      },
      superAdminContext(),
      employeeInput(),
    );
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
      expect(await verifier.user.count()).toBe(0);
      expect(await verifier.authAccount.count()).toBe(0);
      expect(await verifier.roleAssignment.count()).toBe(0);
      expect(await verifier.auditEvent.count()).toBe(1);
    } finally {
      await verifier.$disconnect();
    }
  });

  it("commits a user status mutation and audit together", async () => {
    await client.user.create({ data: userData("target", "ACTIVE") });
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
    await client.user.create({ data: userData("target", "INACTIVE") });
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
    await client.user.create({ data: userData("target", "ACTIVE") });
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
    await client.user.create({ data: userData("target", "ACTIVE") });
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
    await client.user.create({ data: userData("target", "ACTIVE") });
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
  const result = createUser({
    id,
    displayName: `Employee ${id}`,
    normalizedEmail: `${id}@example.test`,
    status,
  });
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

function userData(id: string, status: "ACTIVE" | "INACTIVE") {
  return {
    id,
    displayName: `Employee ${id}`,
    normalizedEmail: `${id}@example.test`,
    status,
  } as const;
}

function superAdminContext(): RequestContext {
  return {
    actor: {
      id: "actor",
      active: true,
      role: "SUPER_ADMIN",
      scopes: [{ type: "GLOBAL" }],
    },
    correlationId: "integration-correlation",
    clock: { now: () => new Date(now) },
    origin: { channel: "WORKSPACE" },
  };
}

function employeeInput(overrides: Partial<{ email: string }> = {}) {
  return {
    userId: "employee",
    displayName: " Employee Name ",
    email: overrides.email ?? " Employee@Company.Test ",
    allowedDomain: "company.test",
    authAccountId: "employee_auth",
    provider: "provider",
    providerAccountId: "subject",
    assignmentId: "employee_assignment",
    role: "EDITOR",
    scope: { type: "GLOBAL" },
    validFrom: now,
    auditEventId: "employee_audit",
    confirmed: true,
  };
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
