import { describe, expect, it } from "vitest";

import type { Clock } from "@/shared/clock";

import { createWorld, type World } from "../domain/world";
import { getWorldByKey } from "./get-world-by-key";
import { InMemoryWorldRepository } from "./testing/in-memory-world-repository";
import { updateWorldSettings } from "./update-world-settings";

const createdAt = new Date("2026-07-15T08:00:00.000Z");
const initialUpdatedAt = new Date("2026-07-15T09:00:00.000Z");
const clockTime = new Date("2026-07-15T10:30:00.000Z");

describe("getWorldByKey", () => {
  it("returns the matching World for a valid raw key", async () => {
    const world = validWorld();
    const repository = new InMemoryWorldRepository([world]);

    const result = await getWorldByKey(repository, " pixel-digital ");

    expect(result).toEqual({ ok: true, value: world });
  });

  it("returns VALIDATION_ERROR for an invalid raw key", async () => {
    const repository = new InMemoryWorldRepository();

    const result = await getWorldByKey(repository, "Pixel Digital");

    expect(result).toMatchObject({
      ok: false,
      error: { code: "VALIDATION_ERROR", validationCode: "INVALID_KEY" },
    });
  });

  it("returns NOT_FOUND when the World is absent", async () => {
    const repository = new InMemoryWorldRepository();

    const result = await getWorldByKey(repository, "missing-world");

    expect(result).toMatchObject({
      ok: false,
      error: { code: "NOT_FOUND" },
    });
  });
});

describe("updateWorldSettings", () => {
  it("updates only displayName and mode and returns the saved World", async () => {
    const world = validWorld();
    const repository = new InMemoryWorldRepository([world]);

    const result = await updateWorldSettings(repository, fixedClock(), {
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

    const result = await updateWorldSettings(repository, fixedClock(), {
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

    const result = await updateWorldSettings(repository, fixedClock(), {
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

    const result = await updateWorldSettings(repository, fixedClock(), {
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

    const result = await updateWorldSettings(repository, fixedClock(), {
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

    const result = await updateWorldSettings(repository, fixedClock(), {
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

    const result = await updateWorldSettings(repository, clock, {
      key: world.key,
      displayName: world.displayName,
      mode: world.mode,
    });

    expect(calls).toBe(1);
    expect(result).toMatchObject({ ok: true, value: { updatedAt: clockTime } });
  });
});

function fixedClock(): Clock {
  return { now: () => clockTime };
}

function validWorld(): World {
  const result = createWorld({
    id: "world_01",
    key: "pixel-digital",
    displayName: "Pixel&Digital",
    mode: "ACTIVE",
    createdAt,
    updatedAt: initialUpdatedAt,
  });
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}
