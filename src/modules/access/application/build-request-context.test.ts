import { describe, expect, it } from "vitest";

import type { Clock } from "@/shared/clock";
import type {
  ApprovedRole,
  AuthorizationScope,
} from "@/shared/request-context";
import {
  createRoleAssignment,
  createUser,
  type RoleAssignment,
  type User,
} from "../domain/access";
import { buildRequestContext } from "./build-request-context";
import {
  InMemoryRoleAssignmentRepository,
  InMemoryUserRepository,
} from "./testing/in-memory-access-repositories";

const now = new Date("2026-07-15T12:00:00.000Z");
const origin = { channel: "WORKSPACE" } as const;

describe("buildRequestContext", () => {
  it("returns actor null for a missing user without loading assignments or clock", async () => {
    const fixture = setup([], []);
    expect(await fixture.build("missing")).toEqual({
      ok: true,
      value: {
        actor: null,
        correlationId: "correlation_01",
        clock: fixture.clock,
        origin,
      },
    });
    expect(fixture.assignments.foundUserIds).toEqual([]);
    expect(fixture.clockCalls()).toBe(0);
  });

  it("returns inactive actor with null role and no scopes", async () => {
    const user = validUser("INACTIVE");
    const fixture = setup([user], [assignment("ADMIN", { type: "GLOBAL" })]);
    expect(await fixture.build(user.id)).toMatchObject({
      ok: true,
      value: { actor: { id: user.id, active: false, role: null, scopes: [] } },
    });
    expect(fixture.assignments.foundUserIds).toEqual([]);
    expect(fixture.clockCalls()).toBe(0);
  });

  it("builds an actor from one effective role and explicit scopes", async () => {
    const user = validUser("ACTIVE");
    const fixture = setup(
      [user],
      [
        assignment("EDITOR", { type: "WORLD", worldKey: "pixel-digital" }),
        assignment(
          "EDITOR",
          { type: "WORLD", worldKey: "kwaliti-print" },
          { id: "assignment_02" },
        ),
      ],
    );
    const result = await fixture.build(user.id);
    expect(result).toMatchObject({
      ok: true,
      value: {
        actor: {
          id: user.id,
          active: true,
          role: "EDITOR",
          scopes: [
            { type: "WORLD", worldKey: "pixel-digital" },
            { type: "WORLD", worldKey: "kwaliti-print" },
          ],
        },
      },
    });
    expect(result.ok && result.value.clock).toBe(fixture.clock);
    expect(fixture.clockCalls()).toBe(1);
  });

  it("ignores future and expired assignments", async () => {
    const user = validUser("ACTIVE");
    const fixture = setup(
      [user],
      [
        assignment("READER", { type: "WORLD", worldKey: "pixel-digital" }),
        assignment(
          "ADMIN",
          { type: "GLOBAL" },
          { id: "future", validFrom: new Date(now.getTime() + 1) },
        ),
        assignment(
          "SALES",
          { type: "GLOBAL" },
          { id: "expired", validUntil: now },
        ),
      ],
    );
    expect(await fixture.build(user.id)).toMatchObject({
      ok: true,
      value: { actor: { role: "READER" } },
    });
  });

  it("deduplicates GLOBAL and WORLD scopes", async () => {
    const user = validUser("ACTIVE");
    const fixture = setup(
      [user],
      [
        assignment("ADMIN", { type: "GLOBAL" }),
        assignment("ADMIN", { type: "GLOBAL" }, { id: "assignment_02" }),
        assignment(
          "ADMIN",
          { type: "WORLD", worldKey: "pixel-digital" },
          { id: "assignment_03" },
        ),
        assignment(
          "ADMIN",
          { type: "WORLD", worldKey: "pixel-digital" },
          { id: "assignment_04" },
        ),
      ],
    );
    expect(await fixture.build(user.id)).toMatchObject({
      ok: true,
      value: {
        actor: {
          scopes: [
            { type: "GLOBAL" },
            { type: "WORLD", worldKey: "pixel-digital" },
          ],
        },
      },
    });
  });

  it("returns typed CONFLICT for multiple effective roles", async () => {
    const user = validUser("ACTIVE");
    const fixture = setup(
      [user],
      [
        assignment("EDITOR", { type: "GLOBAL" }),
        assignment(
          "READER",
          { type: "WORLD", worldKey: "pixel-digital" },
          { id: "assignment_02" },
        ),
      ],
    );
    expect(await fixture.build(user.id)).toMatchObject({
      ok: false,
      error: { code: "CONFLICT" },
    });
  });

  it("fails closed with typed FORBIDDEN when no assignment is active", async () => {
    const user = validUser("ACTIVE");
    const fixture = setup(
      [user],
      [
        assignment(
          "READER",
          { type: "GLOBAL" },
          { validFrom: new Date(now.getTime() + 1) },
        ),
      ],
    );
    expect(await fixture.build(user.id)).toMatchObject({
      ok: false,
      error: { code: "FORBIDDEN" },
    });
  });
});

function validUser(status: "ACTIVE" | "INACTIVE"): User {
  const result = createUser({
    id: "user_01",
    displayName: "Employee One",
    normalizedEmail: "employee@example.test",
    status,
  });
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

function assignment(
  role: ApprovedRole,
  scope: AuthorizationScope,
  overrides: Partial<{ id: string; validFrom: Date; validUntil: Date }> = {},
): RoleAssignment {
  const result = createRoleAssignment({
    id: overrides.id ?? "assignment_01",
    userId: "user_01",
    role,
    scope,
    validFrom: overrides.validFrom ?? new Date(now.getTime() - 60_000),
    ...(overrides.validUntil === undefined
      ? {}
      : { validUntil: overrides.validUntil }),
  });
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

function setup(
  users: readonly User[],
  roleAssignments: readonly RoleAssignment[],
) {
  const userRepository = new InMemoryUserRepository(users);
  const assignmentRepository = new InMemoryRoleAssignmentRepository(
    roleAssignments,
  );
  let calls = 0;
  const clock: Clock = { now: () => ((calls += 1), new Date(now)) };
  return {
    assignments: assignmentRepository,
    clock,
    clockCalls: () => calls,
    build: (userId: string) =>
      buildRequestContext(
        { users: userRepository, roleAssignments: assignmentRepository, clock },
        { userId, correlationId: "correlation_01", origin },
      ),
  };
}
