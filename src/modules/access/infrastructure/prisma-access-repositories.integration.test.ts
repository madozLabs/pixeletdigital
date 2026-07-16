import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { PrismaClient } from "@/generated/prisma/client";
import type { Clock } from "@/shared/clock";

import { buildRequestContext } from "../application/build-request-context";
import { resolveIdentityRequestContext } from "../application/resolve-identity-request-context";
import {
  PrismaAuthAccountRepository,
  PrismaRoleAssignmentRepository,
  PrismaUserRepository,
} from "./prisma-access-repositories";

const now = new Date("2026-07-15T12:00:00.000Z");
const clock: Clock = { now: () => new Date(now) };
let client: PrismaClient;
let authAccounts: PrismaAuthAccountRepository;
let users: PrismaUserRepository;
let assignments: PrismaRoleAssignmentRepository;

beforeAll(() => {
  const connectionString = process.env.TEST_DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "TEST_DATABASE_URL is required for database integration tests.",
    );
  }
  client = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  authAccounts = new PrismaAuthAccountRepository(client);
  users = new PrismaUserRepository(client);
  assignments = new PrismaRoleAssignmentRepository(client);
});
beforeEach(async () => {
  await client.authAccount.deleteMany();
  await client.roleAssignment.deleteMany();
  await client.user.deleteMany();
});

afterAll(async () => {
  await client.$disconnect();
});

describe("Prisma Access repositories", () => {
  it("resolves a persisted provider identity to its governed actor", async () => {
    await client.user.create({
      data: {
        id: "user_identity_01",
        displayName: "Employee user_identity_01",
        normalizedEmail: "user_identity_01@example.test",
        status: "ACTIVE",
        authAccounts: {
          create: {
            id: "auth_account_01",
            provider: "configured-provider",
            providerAccountId: "external-subject-01",
          },
        },
      },
    });
    await client.roleAssignment.create({
      data: globalAssignment(
        "assignment_identity_01",
        "user_identity_01",
        "ADMIN",
      ),
    });

    await expect(
      resolveIdentityRequestContext(
        { authAccounts, users, roleAssignments: assignments, clock },
        {
          identity: {
            provider: "configured-provider",
            providerAccountId: "external-subject-01",
          },
          correlationId: "identity-correlation",
          origin: { channel: "WORKSPACE" },
        },
      ),
    ).resolves.toMatchObject({
      ok: true,
      value: {
        actor: { id: "user_identity_01", active: true, role: "ADMIN" },
      },
    });
  });

  it("keeps identities isolated by provider and fails closed when unlinked", async () => {
    await expect(
      resolveIdentityRequestContext(
        { authAccounts, users, roleAssignments: assignments, clock },
        {
          identity: {
            provider: "unconfigured-provider",
            providerAccountId: "external-subject-01",
          },
          correlationId: "identity-correlation",
          origin: { channel: "WORKSPACE" },
        },
      ),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "UNAUTHENTICATED" },
    });
  });

  it("enforces provider and provider-account uniqueness in persistence", async () => {
    await client.user.createMany({
      data: [
        userData("user_identity_unique_01"),
        userData("user_identity_unique_02"),
      ],
    });
    const identity = {
      provider: "configured-provider",
      providerAccountId: "unique-external-subject",
    };
    await client.authAccount.create({
      data: {
        id: "auth_account_unique_01",
        userId: "user_identity_unique_01",
        ...identity,
      },
    });

    await expect(
      client.authAccount.create({
        data: {
          id: "auth_account_unique_02",
          userId: "user_identity_unique_02",
          ...identity,
        },
      }),
    ).rejects.toThrow();
  });

  it("builds a scoped actor from persisted records", async () => {
    const world = await client.world.create({
      data: {
        id: "world_access_01",
        key: "pixel-digital",
        displayName: "Pixel&Digital",
        mode: "ACTIVE",
      },
    });
    await client.user.create({
      data: userData("user_access_01"),
    });
    await client.roleAssignment.createMany({
      data: [
        globalAssignment("assignment_global_01", "user_access_01", "EDITOR"),
        worldAssignment(
          "assignment_world_01",
          "user_access_01",
          "EDITOR",
          world.id,
        ),
      ],
    });
    const result = await build("user_access_01");

    expect(result).toEqual({
      ok: true,
      value: {
        actor: {
          id: "user_access_01",
          active: true,
          role: "EDITOR",
          scopes: [
            { type: "GLOBAL" },
            { type: "WORLD", worldKey: "pixel-digital" },
          ],
        },
        correlationId: "integration-correlation",
        clock,
        origin: { channel: "WORKSPACE" },
      },
    });
  });

  it("ignores expired assignments and fails closed", async () => {
    await client.user.create({
      data: userData("user_access_02"),
    });
    await client.roleAssignment.create({
      data: {
        ...globalAssignment("assignment_expired", "user_access_02", "READER"),
        validUntil: new Date("2026-07-15T11:00:00.000Z"),
      },
    });
    await expect(build("user_access_02")).resolves.toMatchObject({
      ok: false,
      error: { code: "FORBIDDEN" },
    });
  });

  it("returns CONFLICT for persisted assignments with different roles", async () => {
    await client.user.create({
      data: userData("user_access_03"),
    });
    await client.roleAssignment.createMany({
      data: [
        globalAssignment("assignment_admin", "user_access_03", "ADMIN"),
        globalAssignment("assignment_reader", "user_access_03", "READER"),
      ],
    });

    await expect(build("user_access_03")).resolves.toMatchObject({
      ok: false,
      error: { code: "CONFLICT" },
    });
  });

  it("preserves an inactive persisted user without loading scopes", async () => {
    await client.user.create({
      data: userData("user_access_04", "INACTIVE"),
    });

    await expect(build("user_access_04")).resolves.toMatchObject({
      ok: true,
      value: { actor: { active: false, role: null, scopes: [] } },
    });
  });
});
function build(userId: string) {
  return buildRequestContext(
    { users, roleAssignments: assignments, clock },
    {
      userId,
      correlationId: "integration-correlation",
      origin: { channel: "WORKSPACE" },
    },
  );
}

function userData(id: string, status: "ACTIVE" | "INACTIVE" = "ACTIVE") {
  return {
    id,
    displayName: `Employee ${id}`,
    normalizedEmail: `${id}@example.test`,
    status,
  } as const;
}

function globalAssignment(
  id: string,
  userId: string,
  role: "ADMIN" | "EDITOR" | "READER",
) {
  return {
    id,
    userId,
    role,
    scopeType: "GLOBAL" as const,
    worldId: null,
    validFrom: new Date("2026-07-15T10:00:00.000Z"),
  };
}

function worldAssignment(
  id: string,
  userId: string,
  role: "EDITOR",
  worldId: string,
) {
  return {
    id,
    userId,
    role,
    scopeType: "WORLD" as const,
    worldId,
    validFrom: new Date("2026-07-15T10:00:00.000Z"),
  };
}
