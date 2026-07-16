import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { PrismaClient } from "@/generated/prisma/client";
import {
  PrismaAuthenticationActivityWriter,
  recordAuthenticationActivity,
} from "../application/authentication-activity";

let client: PrismaClient;
let writer: PrismaAuthenticationActivityWriter;

beforeAll(() => {
  const connectionString = process.env.TEST_DATABASE_URL;
  if (!connectionString) throw new Error("TEST_DATABASE_URL is required.");
  client = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  writer = new PrismaAuthenticationActivityWriter(client);
});

beforeEach(async () => {
  await client.authenticationEvent.deleteMany();
  await client.authAccount.deleteMany();
  await client.roleAssignment.deleteMany();
  await client.user.deleteMany();
});

afterAll(async () => {
  await client.$disconnect();
});

describe("Prisma authentication activity", () => {
  it("persists a successful employee sign-in event", async () => {
    await client.user.create({
      data: {
        id: "user_01",
        displayName: "Employee One",
        normalizedEmail: "employee@example.test",
        status: "ACTIVE",
      },
    });
    const result = await recordAuthenticationActivity(writer, {
      id: "event_01",
      occurredAt: new Date("2026-07-16T00:00:00.000Z"),
      type: "SIGN_IN_SUCCEEDED",
      userId: "user_01",
      provider: "configured-provider",
      correlationId: "correlation_01",
      origin: { channel: "WORKSPACE" },
    });

    expect(result).toEqual({ ok: true, value: undefined });
    await expect(
      client.authenticationEvent.findUnique({ where: { id: "event_01" } }),
    ).resolves.toMatchObject({
      type: "SIGN_IN_SUCCEEDED",
      userId: "user_01",
      provider: "configured-provider",
    });
  });

  it("records an unlinked identity rejection without creating access records", async () => {
    const result = await recordAuthenticationActivity(writer, {
      id: "event_02",
      occurredAt: new Date("2026-07-16T00:01:00.000Z"),
      type: "SIGN_IN_REJECTED",
      provider: "configured-provider",
      reason: "UNLINKED_IDENTITY",
      correlationId: "correlation_02",
      origin: { channel: "WORKSPACE" },
    });

    expect(result).toEqual({ ok: true, value: undefined });
    expect(await client.authenticationEvent.count()).toBe(1);
    expect(await client.user.count()).toBe(0);
    expect(await client.authAccount.count()).toBe(0);
  });
});
