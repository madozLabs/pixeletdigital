import { describe, expect, it } from "vitest";

import type {
  ApprovedRole,
  AuthorizationScope,
  RequestContext,
} from "@/shared/request-context";
import {
  createRoleAssignment,
  createUser,
  type RoleAssignment,
  type User,
} from "../domain/access";
import {
  activateUser,
  assignRoleScope,
  deactivateUser,
  revokeRoleScope,
} from "./access-administration";
import { InMemoryAccessAdministrationStore } from "./testing/in-memory-access-administration";

const now = new Date("2026-07-15T12:00:00.000Z");

describe("Access administration authorization", () => {
  it.each([activateUser, deactivateUser])(
    "requires confirmation before reads or transaction",
    async (command) => {
      const store = fixture();
      const result = await command(
        dependencies(store),
        context("ADMIN"),
        userInput(false),
      );
      expect(result).toMatchObject({
        ok: false,
        error: { code: "VALIDATION_ERROR" },
      });
      expect(store.reads).toEqual([]);
      expect(store.commitAttempts).toBe(0);
    },
  );

  it("requires confirmation before assign reads or transaction", async () => {
    const store = fixture();
    const result = await assignRoleScope(
      dependencies(store),
      context("ADMIN"),
      {
        ...assignInput(),
        confirmed: false,
      },
    );
    expect(result).toMatchObject({
      ok: false,
      error: { code: "VALIDATION_ERROR" },
    });
    expect(store.reads).toEqual([]);
    expect(store.commitAttempts).toBe(0);
  });

  it("requires confirmation before revoke reads or transaction", async () => {
    const store = fixture();
    const result = await revokeRoleScope(
      dependencies(store),
      context("ADMIN"),
      {
        ...revokeInput("assignment"),
        confirmed: false,
      },
    );
    expect(result).toMatchObject({
      ok: false,
      error: { code: "VALIDATION_ERROR" },
    });
    expect(store.reads).toEqual([]);
    expect(store.commitAttempts).toBe(0);
  });

  it.each([null, inactiveActor()])(
    "returns UNAUTHENTICATED for missing/inactive actor",
    async (actor) => {
      const store = fixture();
      expect(
        await activateUser(
          dependencies(store),
          baseContext(actor),
          userInput(),
        ),
      ).toMatchObject({ ok: false, error: { code: "UNAUTHENTICATED" } });
      expect(store.reads).toEqual([]);
    },
  );

  it.each([
    ["ADMIN", []],
    ["ADMIN", [{ type: "WORLD", worldKey: "pixel-digital" }]],
    ["EDITOR", [{ type: "GLOBAL" }]],
  ] as const)(
    "denies %s without its required GLOBAL administration authority",
    async (role, scopes) => {
      const store = fixture();
      expect(
        await activateUser(
          dependencies(store),
          context(role, scopes),
          userInput(),
        ),
      ).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
      expect(store.reads).toEqual([]);
    },
  );

  it("forbids self-deactivation before reads", async () => {
    const store = fixture();
    expect(
      await deactivateUser(
        dependencies(store),
        context("ADMIN"),
        userInput(true, "actor"),
      ),
    ).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    expect(store.reads).toEqual([]);
  });

  it("requires target users to exist", async () => {
    const store = fixture([]);
    expect(
      await activateUser(dependencies(store), context("ADMIN"), userInput()),
    ).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
    expect(store.commitAttempts).toBe(0);
  });

  it.each(["activate", "deactivate"] as const)(
    "lets GLOBAL ADMIN %s a non-SUPER_ADMIN and writes sanitized audit",
    async (action) => {
      const store = fixture([
        user("target", action === "activate" ? "INACTIVE" : "ACTIVE"),
      ]);
      const command = action === "activate" ? activateUser : deactivateUser;
      expect(
        await command(dependencies(store), context("ADMIN"), userInput()),
      ).toMatchObject({ ok: true });
      expect(store.auditEvents).toEqual([
        expect.objectContaining({
          actorId: "actor",
          targetType: "USER",
          targetId: "target",
          correlationId: "correlation",
          origin: { channel: "WORKSPACE" },
          result: "SUCCEEDED",
        }),
      ]);
    },
  );

  it("only lets GLOBAL SUPER_ADMIN change status for an effective SUPER_ADMIN", async () => {
    const adminStore = fixture(undefined, [
      assignment({ role: "SUPER_ADMIN" }),
    ]);
    expect(
      await deactivateUser(
        dependencies(adminStore),
        context("ADMIN"),
        userInput(),
      ),
    ).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    expect(adminStore.commitAttempts).toBe(0);
    const superStore = fixture(undefined, [
      assignment({ role: "SUPER_ADMIN" }),
    ]);
    expect(
      await deactivateUser(
        dependencies(superStore),
        context("SUPER_ADMIN"),
        userInput(),
      ),
    ).toMatchObject({ ok: true });
  });
});

describe("Access role/scope administration", () => {
  it("validates role, scope and interval", async () => {
    for (const input of [
      assignInput({ role: "OWNER" }),
      assignInput({ scope: { type: "WORLD", worldKey: "Invalid Key" } }),
      assignInput({ validFrom: now, validUntil: now }),
    ]) {
      const store = fixture();
      expect(
        await assignRoleScope(
          dependencies(store),
          context("SUPER_ADMIN"),
          input,
        ),
      ).toMatchObject({ ok: false, error: { code: "VALIDATION_ERROR" } });
      expect(store.commitAttempts).toBe(0);
    }
  });

  it("lets only GLOBAL SUPER_ADMIN assign and revoke roles", async () => {
    const store = fixture();
    expect(
      await assignRoleScope(
        dependencies(store),
        context("SUPER_ADMIN"),
        assignInput(),
      ),
    ).toMatchObject({ ok: true });
    expect(store.assignments.has("new_assignment")).toBe(true);
    expect(
      await revokeRoleScope(dependencies(store), context("SUPER_ADMIN"), {
        assignmentId: "new_assignment",
        auditEventId: "audit_revoke",
        confirmed: true,
      }),
    ).toMatchObject({ ok: true });
    expect(store.assignments.get("new_assignment")?.validUntil).toEqual(now);
  });

  it.each(["assign", "revoke"] as const)(
    "forbids GLOBAL ADMIN from %s role scopes",
    async (operation) => {
      const existing = assignment();
      const store = fixture(undefined, [existing]);
      const result =
        operation === "assign"
          ? await assignRoleScope(
              dependencies(store),
              context("ADMIN"),
              assignInput(),
            )
          : await revokeRoleScope(
              dependencies(store),
              context("ADMIN"),
              revokeInput(existing.id),
            );
      expect(result).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
      expect(store.reads).toEqual([]);
      expect(store.commitAttempts).toBe(0);
    },
  );

  it("only lets GLOBAL SUPER_ADMIN manage SUPER_ADMIN assignments", async () => {
    const existing = assignment({ role: "SUPER_ADMIN" });
    for (const operation of ["assign", "revoke"] as const) {
      const store = fixture(undefined, [existing]);
      const result =
        operation === "assign"
          ? await assignRoleScope(
              dependencies(store),
              context("ADMIN"),
              assignInput({
                assignmentId: "new_super",
                role: "SUPER_ADMIN",
                validFrom: new Date(now.getTime() + 1),
              }),
            )
          : await revokeRoleScope(dependencies(store), context("ADMIN"), {
              assignmentId: existing.id,
              auditEventId: "audit",
              confirmed: true,
            });
      expect(result).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
      expect(store.commitAttempts).toBe(0);
    }
    const store = fixture();
    expect(
      await assignRoleScope(
        dependencies(store),
        context("SUPER_ADMIN"),
        assignInput({ role: "SUPER_ADMIN" }),
      ),
    ).toMatchObject({ ok: true });
  });

  it("returns CONFLICT for an overlapping effective duplicate", async () => {
    const store = fixture(undefined, [
      assignment({ role: "EDITOR", scope: { type: "GLOBAL" } }),
    ]);
    expect(
      await assignRoleScope(
        dependencies(store),
        context("SUPER_ADMIN"),
        assignInput(),
      ),
    ).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(store.commitAttempts).toBe(0);
  });

  it("rechecks assignment overlap atomically at commit", async () => {
    const store = fixture();
    store.beforeCommit = () => {
      const concurrent = assignment({ id: "concurrent_assignment" });
      store.assignments.set(concurrent.id, concurrent);
    };

    expect(
      await assignRoleScope(
        dependencies(store),
        context("SUPER_ADMIN"),
        assignInput(),
      ),
    ).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(store.assignments.has("new_assignment")).toBe(false);
    expect(store.assignments.has("concurrent_assignment")).toBe(true);
    expect(store.auditEvents).toEqual([]);
  });

  it("requires an existing assignment and its target user for revocation", async () => {
    const missing = fixture();
    expect(
      await revokeRoleScope(
        dependencies(missing),
        context("SUPER_ADMIN"),
        revokeInput("missing"),
      ),
    ).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
    const orphan = assignment({ userId: "orphan" });
    const orphanStore = fixture(undefined, [orphan]);
    expect(
      await revokeRoleScope(
        dependencies(orphanStore),
        context("SUPER_ADMIN"),
        revokeInput(orphan.id),
      ),
    ).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
  });

  it.each([
    [
      "not yet active",
      assignment({
        id: "future",
        validFrom: new Date(now.getTime() + 1_000),
      }),
    ],
    [
      "already revoked",
      assignment({
        id: "revoked",
        validFrom: new Date(now.getTime() - 2_000),
        validUntil: new Date(now.getTime() - 1_000),
      }),
    ],
  ] as const)("rejects a %s assignment revocation", async (_, existing) => {
    const store = fixture(undefined, [existing]);
    expect(
      await revokeRoleScope(
        dependencies(store),
        context("SUPER_ADMIN"),
        revokeInput(existing.id),
      ),
    ).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(store.commitAttempts).toBe(0);
    expect(store.auditEvents).toEqual([]);
  });
});

describe("Access/audit atomicity", () => {
  it("rechecks user status atomically at commit", async () => {
    const store = fixture();
    store.beforeCommit = () => {
      store.users.set("target", user("target", "INACTIVE"));
    };

    expect(
      await deactivateUser(dependencies(store), context("ADMIN"), userInput()),
    ).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(store.users.get("target")?.status).toBe("INACTIVE");
    expect(store.auditEvents).toEqual([]);
  });

  it("rechecks assignment activity atomically at commit", async () => {
    const existing = assignment();
    const concurrentRevocation = new Date(now.getTime() - 1);
    const store = fixture(undefined, [existing]);
    store.beforeCommit = () => {
      store.assignments.set(
        existing.id,
        assignment({ id: existing.id, validUntil: concurrentRevocation }),
      );
    };

    expect(
      await revokeRoleScope(
        dependencies(store),
        context("SUPER_ADMIN"),
        revokeInput(existing.id),
      ),
    ).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(store.assignments.get(existing.id)?.validUntil).toEqual(
      concurrentRevocation,
    );
    expect(store.auditEvents).toEqual([]);
  });

  it.each(["failAuditAppend", "failTransaction"] as const)(
    "does not assign or audit when %s",
    async (failure) => {
      const store = fixture();
      store[failure] = true;
      expect(
        await assignRoleScope(
          dependencies(store),
          context("SUPER_ADMIN"),
          assignInput(),
        ),
      ).toMatchObject({ ok: false, error: { code: "DEPENDENCY_UNAVAILABLE" } });
      expect(store.assignments.size).toBe(0);
      expect(store.auditEvents).toEqual([]);
    },
  );

  it.each(["failAuditAppend", "failTransaction"] as const)(
    "does not change status or audit when %s",
    async (failure) => {
      const store = fixture();
      store[failure] = true;
      expect(
        await deactivateUser(
          dependencies(store),
          context("ADMIN"),
          userInput(),
        ),
      ).toMatchObject({ ok: false, error: { code: "DEPENDENCY_UNAVAILABLE" } });
      expect(store.users.get("target")?.status).toBe("ACTIVE");
      expect(store.auditEvents).toEqual([]);
    },
  );

  it.each(["failAuditAppend", "failTransaction"] as const)(
    "does not revoke or audit when %s",
    async (failure) => {
      const existing = assignment();
      const store = fixture(undefined, [existing]);
      store[failure] = true;
      expect(
        await revokeRoleScope(
          dependencies(store),
          context("SUPER_ADMIN"),
          revokeInput(existing.id),
        ),
      ).toMatchObject({ ok: false, error: { code: "DEPENDENCY_UNAVAILABLE" } });
      expect(store.assignments.get(existing.id)?.validUntil).toBeUndefined();
      expect(store.auditEvents).toEqual([]);
    },
  );
});

function dependencies(store: InMemoryAccessAdministrationStore) {
  return { reader: store, transaction: store };
}
function fixture(
  users: readonly User[] = [user("target")],
  assignments: readonly RoleAssignment[] = [],
) {
  return new InMemoryAccessAdministrationStore(users, assignments);
}
function user(id: string, status: "ACTIVE" | "INACTIVE" = "ACTIVE"): User {
  const result = createUser({ id, status });
  if (!result.ok) throw new Error();
  return result.value;
}
function assignment(
  overrides: Partial<{
    id: string;
    userId: string;
    role: ApprovedRole;
    scope: AuthorizationScope;
    validFrom: Date;
    validUntil: Date;
  }> = {},
): RoleAssignment {
  const result = createRoleAssignment({
    id: overrides.id ?? "existing",
    userId: overrides.userId ?? "target",
    role: overrides.role ?? "EDITOR",
    scope: overrides.scope ?? { type: "GLOBAL" },
    validFrom: overrides.validFrom ?? new Date(now.getTime() - 1000),
    ...(overrides.validUntil ? { validUntil: overrides.validUntil } : {}),
  });
  if (!result.ok) throw new Error();
  return result.value;
}
function userInput(confirmed = true, targetUserId = "target") {
  return { targetUserId, auditEventId: "audit_user", confirmed };
}
function assignInput(
  overrides: Partial<{
    assignmentId: string;
    role: string;
    scope: unknown;
    validFrom: Date;
    validUntil: Date;
  }> = {},
) {
  return {
    assignmentId: overrides.assignmentId ?? "new_assignment",
    targetUserId: "target",
    role: overrides.role ?? "EDITOR",
    scope: overrides.scope ?? { type: "GLOBAL" },
    validFrom: overrides.validFrom ?? new Date(now.getTime() - 1_000),
    ...(overrides.validUntil ? { validUntil: overrides.validUntil } : {}),
    auditEventId: "audit_assign",
    confirmed: true,
  };
}
function revokeInput(assignmentId: string) {
  return { assignmentId, auditEventId: "audit_revoke", confirmed: true };
}
function context(
  role: ApprovedRole,
  scopes: readonly AuthorizationScope[] = [{ type: "GLOBAL" }],
): RequestContext {
  return baseContext({ id: "actor", active: true, role, scopes });
}
function inactiveActor(): RequestContext["actor"] {
  return {
    id: "actor",
    active: false,
    role: "ADMIN",
    scopes: [{ type: "GLOBAL" }],
  };
}
function baseContext(actor: RequestContext["actor"]): RequestContext {
  return {
    actor,
    correlationId: "correlation",
    clock: { now: () => new Date(now) },
    origin: { channel: "WORKSPACE" },
  };
}
