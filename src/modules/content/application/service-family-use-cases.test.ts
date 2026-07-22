import { describe, expect, it } from "vitest";

import { createWorld } from "@/modules/worlds/domain/world";
import { InMemoryWorldRepository } from "@/modules/worlds/application/testing/in-memory-world-repository";
import type { Clock } from "@/shared/clock";
import type {
  ApprovedRole,
  AuthorizationScope,
  RequestContext,
} from "@/shared/request-context";

import {
  createDraftServiceFamily as createDraftServiceFamilyDomain,
  type ServiceFamily,
} from "../domain/service-family";
import {
  archiveServiceFamily,
  createDraftServiceFamily,
  editDraftServiceFamily,
  listServiceFamilies,
  publishServiceFamily,
} from "./service-family-use-cases";
import { InMemoryServiceFamilyRepository } from "./testing/in-memory-service-family-repository";

const createdAt = new Date("2026-07-22T08:00:00.000Z");
const clockTime = new Date("2026-07-22T10:30:00.000Z");

describe("createDraftServiceFamily", () => {
  it.each<ApprovedRole>(["SUPER_ADMIN", "ADMIN", "WORLD_MANAGER", "EDITOR"])(
    "allows %s with a matching world scope to create a draft",
    async (role) => {
      const dependencies = dependenciesWithWorld();

      const result = await createDraftServiceFamily(
        dependencies,
        context(role, [{ type: "WORLD", worldKey: "pixel-digital" }]),
        {
          id: "family_01",
          worldKey: "pixel-digital",
          label: "Communication & Branding",
          order: 0,
        },
      );

      expect(result).toMatchObject({
        ok: true,
        value: { lifecycle: "DRAFT", version: 1 },
      });
      expect(dependencies.families.savedFamilies).toHaveLength(1);
    },
  );

  it.each<ApprovedRole>(["SALES", "CONTRIBUTOR", "READER"])(
    "denies %s",
    async (role) => {
      const dependencies = dependenciesWithWorld();

      const result = await createDraftServiceFamily(
        dependencies,
        context(role, [{ type: "GLOBAL" }]),
        {
          id: "family_01",
          worldKey: "pixel-digital",
          label: "Communication & Branding",
          order: 0,
        },
      );

      expect(result).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    },
  );
});

describe("listServiceFamilies", () => {
  it("returns families ordered for an authorized reader", async () => {
    const dependencies = dependenciesWithWorld();
    const second = family({ id: "family_02", order: 1 });
    const first = family({ id: "family_01", order: 0 });
    await dependencies.families.save(second);
    await dependencies.families.save(first);

    const result = await listServiceFamilies(
      dependencies,
      context("READER", [{ type: "GLOBAL" }]),
      { worldKey: "pixel-digital" },
    );

    expect(result).toMatchObject({
      ok: true,
      value: [{ id: "family_01" }, { id: "family_02" }],
    });
  });
});

describe("editDraftServiceFamily and publishServiceFamily", () => {
  it("edits a draft family", async () => {
    const existing = family();
    const dependencies = dependenciesWithFamily(existing);

    const result = await editDraftServiceFamily(
      dependencies,
      context("EDITOR", [{ type: "GLOBAL" }]),
      {
        id: existing.id,
        expectedVersion: existing.version,
        label: "Branding",
        order: 1,
      },
    );

    expect(result).toMatchObject({
      ok: true,
      value: { label: "Branding", version: 2 },
    });
  });

  it("denies an EDITOR from publishing", async () => {
    const existing = family();
    const dependencies = dependenciesWithFamily(existing);

    const result = await publishServiceFamily(
      dependencies,
      context("EDITOR", [{ type: "GLOBAL" }]),
      { id: existing.id, expectedVersion: existing.version },
    );

    expect(result).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
  });

  it("allows a WORLD_MANAGER to archive a draft family", async () => {
    const existing = family();
    const dependencies = dependenciesWithFamily(existing);

    const result = await archiveServiceFamily(
      dependencies,
      context("WORLD_MANAGER", [
        { type: "WORLD", worldKey: existing.worldKey },
      ]),
      { id: existing.id, expectedVersion: existing.version },
    );

    expect(result).toMatchObject({
      ok: true,
      value: { lifecycle: "ARCHIVED" },
    });
  });
});

function fixedClock(): Clock {
  return { now: () => clockTime };
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

function family(
  overrides: Partial<{ id: string; order: number }> = {},
): ServiceFamily {
  const result = createDraftServiceFamilyDomain({
    id: overrides.id ?? "family_01",
    worldKey: "pixel-digital",
    label: "Communication & Branding",
    order: overrides.order ?? 0,
    createdAt,
    updatedAt: createdAt,
  });
  if (!result.ok) throw new Error("expected a valid family");
  return result.value;
}

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
    families: new InMemoryServiceFamilyRepository(),
    worlds: new InMemoryWorldRepository([world.value]),
  };
}

function dependenciesWithFamily(existing: ServiceFamily) {
  return {
    families: new InMemoryServiceFamilyRepository([existing]),
    worlds: new InMemoryWorldRepository(),
  };
}
