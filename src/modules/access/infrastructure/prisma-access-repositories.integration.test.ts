import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { PrismaClient } from "@/generated/prisma/client";
import type { Clock } from "@/shared/clock";

import { buildRequestContext } from "../application/build-request-context";
import {
  PrismaRoleAssignmentRepository,
  PrismaUserRepository,
} from "./prisma-access-repositories";

const now = new Date("2026-07-15T12:00:00.000Z");
const clock: Clock = { now: () => new Date(now) };
let client: PrismaClient;
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
  users = new PrismaUserRepository(client);
  assignments = new PrismaRoleAssignmentRepository(client);
});
beforeEach(async () => {
  await client.roleAssignment.deleteMany();
  await client.user.deleteMany();
});

afterAll(async () => {
  await client.$disconnect();
});

describe("Prisma Access repositories", () => {
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
      data: { id: "user_access_01", status: "ACTIVE" },
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
      data: { id: "user_access_02", status: "ACTIVE" },
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
      data: { id: "user_access_03", status: "ACTIVE" },
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
      data: { id: "user_access_04", status: "INACTIVE" },
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
