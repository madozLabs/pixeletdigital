import { describe, expect, it } from "vitest";

import type { Session } from "next-auth";
import type { Clock } from "@/shared/clock";

import { createRoleAssignment, createUser } from "../domain/access";
import {
  InMemoryRoleAssignmentRepository,
  InMemoryUserRepository,
} from "./testing/in-memory-access-repositories";
import { resolveAuthSessionRequestContext } from "./resolve-auth-session-request-context";

const now = new Date("2026-07-15T12:00:00.000Z");
const clock: Clock = { now: () => new Date(now) };

describe("resolveAuthSessionRequestContext", () => {
  it.each([null, session(undefined), session(" ")])(
    "rejects a missing or invalid session identity",
    async (authSession) => {
      const users = new InMemoryUserRepository();
      const result = await resolve(authSession, users);
      expect(result).toMatchObject({
        ok: false,
        error: { code: "UNAUTHENTICATED" },
      });
      expect(users.foundIds).toEqual([]);
    },
  );
  it("reloads the authoritative user and assignments from application repositories", async () => {
    const users = new InMemoryUserRepository([user("internal-user", "ACTIVE")]);
    const assignments = new InMemoryRoleAssignmentRepository([
      assignment("internal-user"),
    ]);

    const result = await resolve(session("internal-user"), users, assignments);

    expect(result).toMatchObject({
      ok: true,
      value: {
        actor: {
          id: "internal-user",
          active: true,
          role: "EDITOR",
          scopes: [{ type: "GLOBAL" }],
        },
        correlationId: "auth-correlation",
        origin: { channel: "WORKSPACE" },
      },
    });
    expect(users.foundIds).toEqual(["internal-user"]);
    expect(assignments.foundUserIds).toEqual(["internal-user"]);
  });

  it("does not trust roles or scopes from the Auth.js session payload", async () => {
    const authSession = session("internal-user") as Session & {
      role?: string;
      scopes?: unknown[];
    };
    authSession.role = "SUPER_ADMIN";
    authSession.scopes = [{ type: "GLOBAL" }];

    const result = await resolve(authSession, new InMemoryUserRepository());

    expect(result).toEqual({
      ok: true,
      value: {
        actor: null,
        correlationId: "auth-correlation",
        clock,
        origin: { channel: "WORKSPACE" },
      },
    });
  });
});
function resolve(
  authSession: Session | null,
  users: InMemoryUserRepository,
  roleAssignments = new InMemoryRoleAssignmentRepository(),
) {
  return resolveAuthSessionRequestContext(
    { users, roleAssignments, clock },
    {
      session: authSession,
      correlationId: "auth-correlation",
      origin: { channel: "WORKSPACE" },
    },
  );
}

function session(id: string | undefined): Session {
  return {
    user: id === undefined ? {} : { id },
    expires: "2026-07-16T12:00:00.000Z",
  };
}

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

function assignment(userId: string) {
  const result = createRoleAssignment({
    id: "assignment-auth-session",
    userId,
    role: "EDITOR",
    scope: { type: "GLOBAL" },
    validFrom: new Date("2026-07-15T10:00:00.000Z"),
  });
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}
