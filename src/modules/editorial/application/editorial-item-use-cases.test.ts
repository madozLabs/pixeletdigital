import { describe, expect, it } from "vitest";

import { createWorld } from "@/modules/worlds/domain/world";
import { InMemoryWorldRepository } from "@/modules/worlds/application/testing/in-memory-world-repository";
import type { Clock } from "@/shared/clock";
import type {
  ApprovedRole,
  AuthorizationScope,
  RequestContext,
} from "@/shared/request-context";

import { createDraftEditorialItem as createDraftEditorialItemDomain } from "../domain/editorial-item";
import {
  cancelEditorialItem,
  createDraftEditorialItem,
  editPlannedEditorialItem,
  listEditorialItemsByWorld,
  markEditorialItemDone,
} from "./editorial-item-use-cases";
import { InMemoryEditorialItemRepository } from "./testing/in-memory-editorial-item-repository";

const createdAt = new Date("2026-07-15T08:00:00.000Z");
const clockTime = new Date("2026-07-23T10:30:00.000Z");

describe("createDraftEditorialItem", () => {
  it.each<ApprovedRole>(["SUPER_ADMIN", "ADMIN", "WORLD_MANAGER", "EDITOR"])(
    "allows %s with a matching world scope to create a draft",
    async (role) => {
      const dependencies = dependenciesWithWorld();

      const result = await createDraftEditorialItem(
        dependencies,
        context(role, [{ type: "WORLD", worldKey: "pixel-digital" }]),
        validCreateInput(),
      );

      expect(result).toMatchObject({
        ok: true,
        value: { status: "PLANNED", version: 1 },
      });
      expect(dependencies.editorialItems.savedItems).toHaveLength(1);
    },
  );

  it.each<ApprovedRole>(["SALES", "CONTRIBUTOR", "READER"])(
    "denies %s without saving",
    async (role) => {
      const dependencies = dependenciesWithWorld();

      const result = await createDraftEditorialItem(
        dependencies,
        context(role, [{ type: "GLOBAL" }]),
        validCreateInput(),
      );

      expect(result).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
      expect(dependencies.editorialItems.savedItems).toHaveLength(0);
    },
  );

  it("returns NOT_FOUND when the world does not exist", async () => {
    const dependencies = {
      editorialItems: new InMemoryEditorialItemRepository(),
      worlds: new InMemoryWorldRepository(),
    };

    const result = await createDraftEditorialItem(
      dependencies,
      context("EDITOR", [{ type: "GLOBAL" }]),
      validCreateInput(),
    );

    expect(result).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
  });
});

describe("listEditorialItemsByWorld", () => {
  it("denies an actor without world scope", async () => {
    const dependencies = dependenciesWithWorld();
    await dependencies.editorialItems.save(plannedItem());

    const result = await listEditorialItemsByWorld(
      dependencies,
      context("READER", [{ type: "WORLD", worldKey: "kwaliti-print" }]),
      { worldKey: "pixel-digital" },
    );

    expect(result).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
  });

  it("allows READER with world scope to list", async () => {
    const dependencies = dependenciesWithWorld();
    await dependencies.editorialItems.save(plannedItem());

    const result = await listEditorialItemsByWorld(
      dependencies,
      context("READER", [{ type: "WORLD", worldKey: "pixel-digital" }]),
      { worldKey: "pixel-digital" },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(1);
  });
});

describe("markEditorialItemDone", () => {
  it("transitions a planned item to done with a proof link", async () => {
    const dependencies = dependenciesWithWorld();
    const item = plannedItem();
    await dependencies.editorialItems.save(item);

    const result = await markEditorialItemDone(
      dependencies,
      context("EDITOR", [{ type: "GLOBAL" }]),
      {
        id: item.id,
        expectedVersion: item.version,
        proofUrl: "https://instagram.com/p/abc",
      },
    );

    expect(result).toMatchObject({
      ok: true,
      value: { status: "DONE", proofUrl: "https://instagram.com/p/abc" },
    });
  });

  it("returns CONFLICT on a stale version", async () => {
    const dependencies = dependenciesWithWorld();
    const item = plannedItem();
    await dependencies.editorialItems.save(item);

    const result = await markEditorialItemDone(
      dependencies,
      context("EDITOR", [{ type: "GLOBAL" }]),
      {
        id: item.id,
        expectedVersion: item.version + 1,
        proofUrl: "https://instagram.com/p/abc",
      },
    );

    expect(result).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
  });

  it("denies a READER", async () => {
    const dependencies = dependenciesWithWorld();
    const item = plannedItem();
    await dependencies.editorialItems.save(item);

    const result = await markEditorialItemDone(
      dependencies,
      context("READER", [{ type: "GLOBAL" }]),
      {
        id: item.id,
        expectedVersion: item.version,
        proofUrl: "https://instagram.com/p/abc",
      },
    );

    expect(result).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
  });
});

describe("cancelEditorialItem", () => {
  it("transitions a planned item to cancelled", async () => {
    const dependencies = dependenciesWithWorld();
    const item = plannedItem();
    await dependencies.editorialItems.save(item);

    const result = await cancelEditorialItem(
      dependencies,
      context("ADMIN", [{ type: "GLOBAL" }]),
      { id: item.id, expectedVersion: item.version },
    );

    expect(result).toMatchObject({ ok: true, value: { status: "CANCELLED" } });
  });
});

describe("editPlannedEditorialItem", () => {
  it("updates a planned item's fields", async () => {
    const dependencies = dependenciesWithWorld();
    const item = plannedItem();
    await dependencies.editorialItems.save(item);

    const result = await editPlannedEditorialItem(
      dependencies,
      context("EDITOR", [{ type: "GLOBAL" }]),
      {
        id: item.id,
        expectedVersion: item.version,
        clientLabel: "Client B",
        channel: "TikTok",
        title: "New title",
        scheduledFor: new Date("2026-08-01T00:00:00.000Z"),
      },
    );

    expect(result).toMatchObject({
      ok: true,
      value: { clientLabel: "Client B" },
    });
  });
});

function dependenciesWithWorld() {
  const world = createWorld({
    id: "world_01",
    key: "pixel-digital",
    displayName: "Pixel&Digital",
    mode: "ACTIVE",
    createdAt,
    updatedAt: createdAt,
  });
  if (!world.ok) throw new Error("expected a valid world");

  return {
    editorialItems: new InMemoryEditorialItemRepository(),
    worlds: new InMemoryWorldRepository([world.value]),
  };
}

function validCreateInput() {
  return {
    id: "editorial_use_case_01",
    worldKey: "pixel-digital",
    clientLabel: "Client A",
    channel: "Instagram",
    title: "Post produit",
    scheduledFor: new Date("2026-08-01T00:00:00.000Z"),
  };
}

function plannedItem() {
  const result = createDraftEditorialItemDomain({
    id: "editorial_use_case_planned",
    worldKey: "pixel-digital",
    clientLabel: "Client A",
    channel: "Instagram",
    title: "Post produit",
    scheduledFor: new Date("2026-08-01T00:00:00.000Z"),
    createdAt,
    updatedAt: createdAt,
  });
  if (!result.ok) throw new Error("expected a valid draft editorial item");
  return result.value;
}

function context(
  role: ApprovedRole,
  scopes: readonly AuthorizationScope[],
): RequestContext {
  const clock: Clock = { now: () => clockTime };
  return {
    actor: { id: "actor_01", active: true, role, scopes },
    correlationId: "test-correlation-id",
    clock,
    origin: { channel: "WORKSPACE" },
  };
}
