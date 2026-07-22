import { describe, expect, it } from "vitest";

import type { Clock } from "@/shared/clock";

import { createAuthAccount, createUser } from "../domain/access";
import type {
  AuthenticationActivityWriter,
  AuthenticationEvent,
} from "./authentication-activity";
import { ScryptPasswordHasher } from "../infrastructure/scrypt-password-hasher";
import {
  InMemoryAuthAccountRepository,
  InMemoryUserRepository,
} from "./testing/in-memory-access-repositories";
import { verifyCredentials } from "./verify-credentials";

const now = new Date("2026-07-22T00:00:00.000Z");

class MemoryWriter implements AuthenticationActivityWriter {
  readonly events: AuthenticationEvent[] = [];

  async append(event: AuthenticationEvent): Promise<void> {
    this.events.push(event);
  }
}

function fixedClock(): Clock {
  return { now: () => now };
}

async function setup(password = "correct horse battery staple") {
  const hasher = new ScryptPasswordHasher();
  const passwordHash = await hasher.hash(password);

  const user = createUser({
    id: "user_01",
    displayName: "Ada",
    normalizedEmail: "ada@example.com",
    status: "ACTIVE",
  });
  if (!user.ok) throw new Error("expected a valid user");

  const account = createAuthAccount({
    id: "account_01",
    userId: user.value.id,
    provider: "credentials",
    providerAccountId: "ada@example.com",
    passwordHash,
  });
  if (!account.ok) throw new Error("expected a valid auth account");

  const writer = new MemoryWriter();
  return {
    dependencies: {
      authAccounts: new InMemoryAuthAccountRepository([account.value]),
      users: new InMemoryUserRepository([user.value]),
      passwordHasher: hasher,
      authenticationActivity: writer,
      clock: fixedClock(),
    },
    writer,
    user: user.value,
  };
}

function input(overrides: Partial<{ email: string; password: string }> = {}) {
  return {
    email: overrides.email ?? "ada@example.com",
    password: overrides.password ?? "correct horse battery staple",
    eventId: "auth_event_01",
    correlationId: "correlation_01",
    origin: { channel: "WORKSPACE" as const },
  };
}

describe("verifyCredentials", () => {
  it("returns the user for a correct email and password", async () => {
    const { dependencies, writer, user } = await setup();

    const result = await verifyCredentials(dependencies, input());

    expect(result).toEqual({ ok: true, value: user });
    expect(writer.events).toMatchObject([
      { type: "SIGN_IN_SUCCEEDED", userId: user.id },
    ]);
  });

  it("rejects an incorrect password and records SIGN_IN_FAILED", async () => {
    const { dependencies, writer } = await setup();

    const result = await verifyCredentials(
      dependencies,
      input({ password: "wrong" }),
    );

    expect(result).toMatchObject({
      ok: false,
      error: { code: "INVALID_CREDENTIALS" },
    });
    expect(writer.events).toMatchObject([
      { type: "SIGN_IN_FAILED", reason: "INVALID_CREDENTIALS" },
    ]);
  });

  it("rejects an email with no linked credentials account", async () => {
    const { dependencies, writer } = await setup();

    const result = await verifyCredentials(
      dependencies,
      input({ email: "someone-else@example.com" }),
    );

    expect(result).toMatchObject({
      ok: false,
      error: { code: "INVALID_CREDENTIALS" },
    });
    expect(writer.events).toMatchObject([
      { type: "SIGN_IN_FAILED", reason: "UNLINKED_IDENTITY" },
    ]);
  });

  it("rejects an invalid email format without querying the repository", async () => {
    const { dependencies } = await setup();

    const result = await verifyCredentials(
      dependencies,
      input({ email: "not-an-email" }),
    );

    expect(result).toMatchObject({
      ok: false,
      error: { code: "INVALID_CREDENTIALS" },
    });
    expect(dependencies.authAccounts.foundIdentities).toHaveLength(0);
  });

  it("rejects a correct password for an inactive user", async () => {
    const { dependencies, writer, user } = await setup();
    const inactive = createUser({ ...user, status: "INACTIVE" });
    if (!inactive.ok) throw new Error("expected a valid user");
    dependencies.users = new InMemoryUserRepository([inactive.value]);

    const result = await verifyCredentials(dependencies, input());

    expect(result).toMatchObject({
      ok: false,
      error: { code: "INVALID_CREDENTIALS" },
    });
    expect(writer.events).toMatchObject([
      { type: "SIGN_IN_FAILED", reason: "INACTIVE_USER" },
    ]);
  });
});
