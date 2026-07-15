import { describe, expect, it } from "vitest";

import type { Clock } from "@/shared/clock";
import type {
  ApprovedRole,
  AuthorizationScope,
  RequestContext,
} from "@/shared/request-context";

import { createWorld, type World } from "../domain/world";
import { getWorldByKey } from "./get-world-by-key";
import { InMemoryWorldRepository } from "./testing/in-memory-world-repository";
import { updateWorldSettings } from "./update-world-settings";

const createdAt = new Date("2026-07-15T08:00:00.000Z");
const initialUpdatedAt = new Date("2026-07-15T09:00:00.000Z");
const clockTime = new Date("2026-07-15T10:30:00.000Z");

describe("getWorldByKey", () => {
  it.each<ApprovedRole>([
    "SUPER_ADMIN",
    "ADMIN",
    "WORLD_MANAGER",
    "EDITOR",
    "SALES",
    "CONTRIBUTOR",
    "READER",
  ])("allows %s to read with a matching world scope", async (role) => {
    const world = validWorld();
    const repository = new InMemoryWorldRepository([world]);

    const result = await getWorldByKey(
      repository,
      context(role, [{ type: "WORLD", worldKey: world.key }]),
      world.key,
    );

    expect(result).toEqual({ ok: true, value: world });
  });

  it.each<ApprovedRole>([
    "SUPER_ADMIN",
    "ADMIN",
    "WORLD_MANAGER",
    "EDITOR",
    "SALES",
    "CONTRIBUTOR",
    "READER",
  ])("allows %s to read with explicit global scope", async (role) => {
    const world = validWorld();
    const repository = new InMemoryWorldRepository([world]);

    const result = await getWorldByKey(
      repository,
      context(role, [{ type: "GLOBAL" }]),
      world.key,
    );

    expect(result).toEqual({ ok: true, value: world });
  });

  it.each([
    ["missing actor", anonymousContext()],
    ["inactive actor", context("ADMIN", [{ type: "GLOBAL" }], false)],
  ])(
    "returns UNAUTHENTICATED for a %s without reading",
    async (_, requestContext) => {
      const repository = new InMemoryWorldRepository([validWorld()]);

      const result = await getWorldByKey(
        repository,
        requestContext as RequestContext,
        "INVALID KEY",
      );

      expect(result).toMatchObject({
        ok: false,
        error: { code: "UNAUTHENTICATED" },
      });
      expect(repository.foundKeys).toHaveLength(0);
    },
  );

  it.each([[[]], [[{ type: "WORLD", worldKey: "other-world" }]]] as const)(
    "returns FORBIDDEN without reading when scopes do not cover the world",
    async (scopes) => {
      const repository = new InMemoryWorldRepository([validWorld()]);

      const result = await getWorldByKey(
        repository,
        context("READER", scopes),
        "pixel-digital",
      );

      expect(result).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
      expect(repository.foundKeys).toHaveLength(0);
    },
  );

  it("returns the matching World for a valid raw key", async () => {
    const world = validWorld();
    const repository = new InMemoryWorldRepository([world]);

    const result = await getWorldByKey(
      repository,
      context("READER", [{ type: "WORLD", worldKey: world.key }]),
      " pixel-digital ",
    );

    expect(result).toEqual({ ok: true, value: world });
  });

  it("returns VALIDATION_ERROR for an invalid raw key", async () => {
    const repository = new InMemoryWorldRepository();

    const result = await getWorldByKey(
      repository,
      context("READER", []),
      "Pixel Digital",
    );

    expect(result).toMatchObject({
      ok: false,
      error: { code: "VALIDATION_ERROR", validationCode: "INVALID_KEY" },
    });
  });

  it("returns NOT_FOUND when the World is absent", async () => {
    const repository = new InMemoryWorldRepository();

    const result = await getWorldByKey(
      repository,
      context("READER", [{ type: "GLOBAL" }]),
      "missing-world",
    );

    expect(result).toMatchObject({
      ok: false,
      error: { code: "NOT_FOUND" },
    });
  });
});

describe("updateWorldSettings", () => {
  it.each([
    ["SUPER_ADMIN", [{ type: "GLOBAL" }]],
    ["SUPER_ADMIN", [{ type: "WORLD", worldKey: "pixel-digital" }]],
    ["ADMIN", [{ type: "GLOBAL" }]],
    ["ADMIN", [{ type: "WORLD", worldKey: "pixel-digital" }]],
    ["WORLD_MANAGER", [{ type: "WORLD", worldKey: "pixel-digital" }]],
  ] as const)("allows %s with the required scope", async (role, scopes) => {
    const world = validWorld();
    const repository = new InMemoryWorldRepository([world]);

    const result = await updateWorldSettings(
      repository,
      context(role, scopes),
      { key: world.key, displayName: "Authorized", mode: "TEASER" },
    );

    expect(result).toMatchObject({
      ok: true,
      value: { displayName: "Authorized" },
    });
    expect(repository.savedWorlds).toHaveLength(1);
  });

  it.each<ApprovedRole>(["EDITOR", "SALES", "CONTRIBUTOR", "READER"])(
    "denies %s even with global scope without reading or saving",
    async (role) => {
      const repository = new InMemoryWorldRepository([validWorld()]);
      let clockCalls = 0;

      const result = await updateWorldSettings(
        repository,
        context(role, [{ type: "GLOBAL" }], true, {
          now: () => ((clockCalls += 1), clockTime),
        }),
        { key: "pixel-digital", displayName: "Denied", mode: "ACTIVE" },
      );

      expect(result).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
      expect(repository.foundKeys).toHaveLength(0);
      expect(repository.savedWorlds).toHaveLength(0);
      expect(clockCalls).toBe(0);
    },
  );

  it.each([
    ["missing actor", anonymousContext()],
    ["inactive actor", context("ADMIN", [{ type: "GLOBAL" }], false)],
  ])(
    "returns UNAUTHENTICATED for a %s without side effects",
    async (_, requestContext) => {
      const repository = new InMemoryWorldRepository([validWorld()]);
      let clockCalls = 0;

      const result = await updateWorldSettings(
        repository,
        {
          ...(requestContext as RequestContext),
          clock: { now: () => ((clockCalls += 1), clockTime) },
        },
        { key: "INVALID KEY", displayName: "Denied", mode: "ACTIVE" },
      );

      expect(result).toMatchObject({
        ok: false,
        error: { code: "UNAUTHENTICATED" },
      });
      expect(repository.foundKeys).toHaveLength(0);
      expect(repository.savedWorlds).toHaveLength(0);
      expect(clockCalls).toBe(0);
    },
  );

  it.each([
    ["ADMIN", []],
    ["ADMIN", [{ type: "WORLD", worldKey: "other-world" }]],
    ["WORLD_MANAGER", [{ type: "GLOBAL" }]],
    ["WORLD_MANAGER", [{ type: "WORLD", worldKey: "other-world" }]],
  ] as const)(
    "denies %s without its required matching scope",
    async (role, scopes) => {
      const repository = new InMemoryWorldRepository([validWorld()]);

      const result = await updateWorldSettings(
        repository,
        context(role, scopes),
        { key: "pixel-digital", displayName: "Denied", mode: "ACTIVE" },
      );

      expect(result).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
      expect(repository.foundKeys).toHaveLength(0);
      expect(repository.savedWorlds).toHaveLength(0);
    },
  );

  it.each(["TEASER", "INACTIVE"] as const)(
    "denies WORLD_MANAGER when the existing world mode is %s",
    async (mode) => {
      const world = validWorld({ mode });
      const repository = new InMemoryWorldRepository([world]);
      let clockCalls = 0;

      const result = await updateWorldSettings(
        repository,
        context(
          "WORLD_MANAGER",
          [{ type: "WORLD", worldKey: "pixel-digital" }],
          true,
          { now: () => ((clockCalls += 1), clockTime) },
        ),
        { key: world.key, displayName: "Denied", mode: "ACTIVE" },
      );

      expect(result).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
      expect(repository.foundKeys).toEqual([world.key]);
      expect(repository.savedWorlds).toHaveLength(0);
      expect(clockCalls).toBe(0);
    },
  );

  it("updates only displayName and mode and returns the saved World", async () => {
    const world = validWorld();
    const repository = new InMemoryWorldRepository([world]);

    const result = await updateWorldSettings(repository, admin(), {
      key: world.key,
      displayName: " Pixel and Digital ",
      mode: "TEASER",
    });

    expect(result).toEqual({
      ok: true,
      value: {
        ...world,
        displayName: "Pixel and Digital",
        mode: "TEASER",
        updatedAt: clockTime,
      },
    });
    expect(repository.savedWorlds).toEqual([
      result.ok ? result.value : undefined,
    ]);
  });

  it("rejects an invalid raw key without saving", async () => {
    const repository = new InMemoryWorldRepository([validWorld()]);

    const result = await updateWorldSettings(repository, admin(), {
      key: "INVALID",
      displayName: "Valid name",
      mode: "ACTIVE",
    });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "VALIDATION_ERROR", validationCode: "INVALID_KEY" },
    });
    expect(repository.savedWorlds).toHaveLength(0);
  });

  it("returns NOT_FOUND without saving when the World is absent", async () => {
    const repository = new InMemoryWorldRepository();

    const result = await updateWorldSettings(repository, admin(), {
      key: "missing-world",
      displayName: "Valid name",
      mode: "ACTIVE",
    });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "NOT_FOUND" },
    });
    expect(repository.savedWorlds).toHaveLength(0);
  });

  it("rejects an invalid displayName without saving", async () => {
    const world = validWorld();
    const repository = new InMemoryWorldRepository([world]);

    const result = await updateWorldSettings(repository, admin(), {
      key: world.key,
      displayName: "   ",
      mode: "ACTIVE",
    });

    expect(result).toMatchObject({
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        validationCode: "INVALID_DISPLAY_NAME",
      },
    });
    expect(repository.savedWorlds).toHaveLength(0);
  });

  it("rejects an invalid mode without saving", async () => {
    const world = validWorld();
    const repository = new InMemoryWorldRepository([world]);

    const result = await updateWorldSettings(repository, admin(), {
      key: world.key,
      displayName: "Valid name",
      mode: "PUBLISHED",
    });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "VALIDATION_ERROR", validationCode: "INVALID_MODE" },
    });
    expect(repository.savedWorlds).toHaveLength(0);
  });

  it("preserves id, key, and createdAt", async () => {
    const world = validWorld();
    const repository = new InMemoryWorldRepository([world]);

    const result = await updateWorldSettings(repository, admin(), {
      key: world.key,
      displayName: "Changed",
      mode: "INACTIVE",
    });

    expect(result).toMatchObject({
      ok: true,
      value: { id: world.id, key: world.key, createdAt: world.createdAt },
    });
  });

  it("uses the injected Clock exactly once for updatedAt", async () => {
    const world = validWorld();
    const repository = new InMemoryWorldRepository([world]);
    let calls = 0;
    const clock: Clock = {
      now: () => {
        calls += 1;
        return clockTime;
      },
    };

    const result = await updateWorldSettings(
      repository,
      context("ADMIN", [{ type: "GLOBAL" }], true, clock),
      {
        key: world.key,
        displayName: world.displayName,
        mode: world.mode,
      },
    );

    expect(calls).toBe(1);
    expect(result).toMatchObject({ ok: true, value: { updatedAt: clockTime } });
  });
});

function fixedClock(): Clock {
  return { now: () => clockTime };
}

function admin(): RequestContext {
  return context("ADMIN", [{ type: "GLOBAL" }]);
}

function context(
  role: ApprovedRole,
  scopes: readonly AuthorizationScope[],
  active = true,
  clock: Clock = fixedClock(),
): RequestContext {
  return {
    actor: { id: "user_01", active, role, scopes },
    correlationId: "correlation_01",
    clock,
    origin: { channel: "WORKSPACE" },
  };
}

function anonymousContext(clock: Clock = fixedClock()): RequestContext {
  return {
    actor: null,
    correlationId: "correlation_01",
    clock,
    origin: { channel: "WORKSPACE" },
  };
}

function validWorld(
  overrides: Partial<{ mode: "ACTIVE" | "TEASER" | "INACTIVE" }> = {},
): World {
  const result = createWorld({
    id: "world_01",
    key: "pixel-digital",
    displayName: "Pixel&Digital",
    mode: overrides.mode ?? "ACTIVE",
    createdAt,
    updatedAt: initialUpdatedAt,
  });
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}
