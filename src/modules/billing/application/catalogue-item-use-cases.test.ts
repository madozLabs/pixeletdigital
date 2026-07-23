import { describe, expect, it } from "vitest";

import { createWorld } from "@/modules/worlds/domain/world";
import { InMemoryWorldRepository } from "@/modules/worlds/application/testing/in-memory-world-repository";
import type { Clock } from "@/shared/clock";
import type {
  ApprovedRole,
  AuthorizationScope,
  RequestContext,
} from "@/shared/request-context";

import { createCatalogueItem as createCatalogueItemDomain } from "../domain/catalogue-item";
import {
  archiveCatalogueItem,
  createCatalogueItem,
  editCatalogueItem,
  listCatalogueItemsByWorld,
} from "./catalogue-item-use-cases";
import { InMemoryCatalogueItemRepository } from "./testing/in-memory-catalogue-item-repository";

const createdAt = new Date("2026-07-15T08:00:00.000Z");
const clockTime = new Date("2026-07-23T10:30:00.000Z");

describe("createCatalogueItem", () => {
  it.each<ApprovedRole>(["SUPER_ADMIN", "ADMIN", "WORLD_MANAGER"])(
    "allows %s with a matching world scope",
    async (role) => {
      const dependencies = dependenciesWithWorld();

      const result = await createCatalogueItem(
        dependencies,
        context(role, [{ type: "WORLD", worldKey: "pixel-digital" }]),
        validCreateInput(),
      );

      expect(result).toMatchObject({ ok: true, value: { status: "ACTIVE" } });
      expect(dependencies.catalogueItems.savedItems).toHaveLength(1);
    },
  );

  it.each<ApprovedRole>(["EDITOR", "SALES", "CONTRIBUTOR", "READER"])(
    "denies %s even with world scope",
    async (role) => {
      const dependencies = dependenciesWithWorld();

      const result = await createCatalogueItem(
        dependencies,
        context(role, [{ type: "GLOBAL" }]),
        validCreateInput(),
      );

      expect(result).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
      expect(dependencies.catalogueItems.savedItems).toHaveLength(0);
    },
  );
});

describe("listCatalogueItemsByWorld", () => {
  it("denies a role outside the billing set", async () => {
    const dependencies = dependenciesWithWorld();

    const result = await listCatalogueItemsByWorld(
      dependencies,
      context("EDITOR", [{ type: "WORLD", worldKey: "pixel-digital" }]),
      { worldKey: "pixel-digital" },
    );

    expect(result).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
  });
});

describe("editCatalogueItem / archiveCatalogueItem", () => {
  it("edits an item and bumps version", async () => {
    const dependencies = dependenciesWithWorld();
    const item = savedItem();
    await dependencies.catalogueItems.save(item);

    const result = await editCatalogueItem(
      dependencies,
      context("ADMIN", [{ type: "GLOBAL" }]),
      {
        id: item.id,
        expectedVersion: item.version,
        label: "New label",
        unitPriceCents: 9900,
      },
    );

    expect(result).toMatchObject({
      ok: true,
      value: { label: "New label", unitPriceCents: 9900 },
    });
  });

  it("archives an item", async () => {
    const dependencies = dependenciesWithWorld();
    const item = savedItem();
    await dependencies.catalogueItems.save(item);

    const result = await archiveCatalogueItem(
      dependencies,
      context("SUPER_ADMIN", [{ type: "GLOBAL" }]),
      { id: item.id, expectedVersion: item.version },
    );

    expect(result).toMatchObject({ ok: true, value: { status: "ARCHIVED" } });
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
    catalogueItems: new InMemoryCatalogueItemRepository(),
    worlds: new InMemoryWorldRepository([world.value]),
  };
}

function validCreateInput() {
  return {
    id: "catalogue_use_case_01",
    worldKey: "pixel-digital",
    label: "Création de logo",
    kind: "SERVICE",
    unitPriceCents: 45000,
  };
}

function savedItem() {
  const result = createCatalogueItemDomain({
    id: "catalogue_use_case_saved",
    worldKey: "pixel-digital",
    label: "Création de logo",
    kind: "SERVICE",
    unitPriceCents: 45000,
    createdAt,
    updatedAt: createdAt,
  });
  if (!result.ok) throw new Error("expected a valid catalogue item");
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
