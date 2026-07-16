import { describe, expect, it } from "vitest";

import type { Clock } from "@/shared/clock";

import {
  createAuthAccount,
  createRoleAssignment,
  createUser,
} from "../domain/access";
import { resolveIdentityRequestContext } from "./resolve-identity-request-context";
import {
  InMemoryAuthAccountRepository,
  InMemoryRoleAssignmentRepository,
  InMemoryUserRepository,
} from "./testing/in-memory-access-repositories";

const identity = {
  provider: "configured-provider",
  providerAccountId: "external-subject-01",
} as const;
const origin = { channel: "WORKSPACE" } as const;
const now = new Date("2026-07-15T12:00:00.000Z");
const clock: Clock = { now: () => new Date(now) };

describe("resolveIdentityRequestContext", () => {
  it("fails closed when the identity is not linked", async () => {
    const authAccounts = new InMemoryAuthAccountRepository();
    const users = new InMemoryUserRepository();
    const roleAssignments = new InMemoryRoleAssignmentRepository();

    await expect(
      resolveIdentityRequestContext(
        { authAccounts, users, roleAssignments, clock },
        { identity, correlationId: "correlation_01", origin },
      ),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "UNAUTHENTICATED" },
    });
    expect(authAccounts.foundIdentities).toEqual([identity]);
    expect(users.foundIds).toEqual([]);
    expect(roleAssignments.foundUserIds).toEqual([]);
  });

  it("resolves a linked identity through internal user and role records", async () => {
    const accountResult = createAuthAccount({
      id: "auth_account_01",
      userId: "user_01",
      ...identity,
    });
    const userResult = createUser({
      id: "user_01",
      displayName: "Employee One",
      normalizedEmail: "employee@example.test",
      status: "ACTIVE",
    });
    const assignmentResult = createRoleAssignment({
      id: "assignment_01",
      userId: "user_01",
      role: "EDITOR",
      scope: { type: "WORLD", worldKey: "pixel-digital" },
      validFrom: new Date("2026-07-15T11:00:00.000Z"),
    });
    if (!accountResult.ok || !userResult.ok || !assignmentResult.ok) {
      throw new Error("Invalid test fixture");
    }

    await expect(
      resolveIdentityRequestContext(
        {
          authAccounts: new InMemoryAuthAccountRepository([
            accountResult.value,
          ]),
          users: new InMemoryUserRepository([userResult.value]),
          roleAssignments: new InMemoryRoleAssignmentRepository([
            assignmentResult.value,
          ]),
          clock,
        },
        { identity, correlationId: "correlation_02", origin },
      ),
    ).resolves.toMatchObject({
      ok: true,
      value: {
        actor: {
          id: "user_01",
          active: true,
          role: "EDITOR",
          scopes: [{ type: "WORLD", worldKey: "pixel-digital" }],
        },
      },
    });
  });

  it("does not resolve a different provider with the same account id", async () => {
    const account = createAuthAccount({
      id: "auth_account_01",
      userId: "user_01",
      ...identity,
    });
    if (!account.ok) throw new Error("Invalid test fixture");

    await expect(
      resolveIdentityRequestContext(
        {
          authAccounts: new InMemoryAuthAccountRepository([account.value]),
          users: new InMemoryUserRepository(),
          roleAssignments: new InMemoryRoleAssignmentRepository(),
          clock,
        },
        {
          identity: { ...identity, provider: "another-provider" },
          correlationId: "correlation_03",
          origin,
        },
      ),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "UNAUTHENTICATED" },
    });
  });
});
