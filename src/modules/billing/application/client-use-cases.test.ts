import { describe, expect, it } from "vitest";

import { createWorld } from "@/modules/worlds/domain/world";
import { InMemoryWorldRepository } from "@/modules/worlds/application/testing/in-memory-world-repository";
import type { Clock } from "@/shared/clock";
import type {
  ApprovedRole,
  AuthorizationScope,
  RequestContext,
} from "@/shared/request-context";

import { createClient as createClientDomain } from "../domain/client";
import {
  archiveClient,
  createClient,
  editClient,
  listClientsByWorld,
} from "./client-use-cases";
import { InMemoryClientRepository } from "./testing/in-memory-client-repository";

const createdAt = new Date("2026-07-15T08:00:00.000Z");
const clockTime = new Date("2026-07-23T10:30:00.000Z");

describe("createClient", () => {
  it.each<ApprovedRole>(["SUPER_ADMIN", "ADMIN", "WORLD_MANAGER"])(
    "allows %s with a matching world scope",
    async (role) => {
      const dependencies = dependenciesWithWorld();

      const result = await createClient(
        dependencies,
        context(role, [{ type: "WORLD", worldKey: "pixel-digital" }]),
        validCreateInput(),
      );

      expect(result).toMatchObject({ ok: true, value: { status: "ACTIVE" } });
      expect(dependencies.clients.savedClients).toHaveLength(1);
    },
  );

  it.each<ApprovedRole>(["EDITOR", "SALES", "CONTRIBUTOR", "READER"])(
    "denies %s even with world scope",
    async (role) => {
      const dependencies = dependenciesWithWorld();

      const result = await createClient(
        dependencies,
        context(role, [{ type: "GLOBAL" }]),
        validCreateInput(),
      );

      expect(result).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
      expect(dependencies.clients.savedClients).toHaveLength(0);
    },
  );
});

describe("listClientsByWorld", () => {
  it("denies a role outside the billing set even with world scope", async () => {
    const dependencies = dependenciesWithWorld();

    const result = await listClientsByWorld(
      dependencies,
      context("EDITOR", [{ type: "WORLD", worldKey: "pixel-digital" }]),
      { worldKey: "pixel-digital" },
    );

    expect(result).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
  });
});

describe("editClient / archiveClient", () => {
  it("edits a client and bumps version", async () => {
    const dependencies = dependenciesWithWorld();
    const client = savedClient();
    await dependencies.clients.save(client);

    const result = await editClient(
      dependencies,
      context("ADMIN", [{ type: "GLOBAL" }]),
      { id: client.id, expectedVersion: client.version, name: "New Name" },
    );

    expect(result).toMatchObject({ ok: true, value: { name: "New Name" } });
  });

  it("archives a client", async () => {
    const dependencies = dependenciesWithWorld();
    const client = savedClient();
    await dependencies.clients.save(client);

    const result = await archiveClient(
      dependencies,
      context("SUPER_ADMIN", [{ type: "GLOBAL" }]),
      { id: client.id, expectedVersion: client.version },
    );

    expect(result).toMatchObject({ ok: true, value: { status: "ARCHIVED" } });
  });

  it("returns CONFLICT on a stale version", async () => {
    const dependencies = dependenciesWithWorld();
    const client = savedClient();
    await dependencies.clients.save(client);

    const result = await archiveClient(
      dependencies,
      context("SUPER_ADMIN", [{ type: "GLOBAL" }]),
      { id: client.id, expectedVersion: client.version + 1 },
    );

    expect(result).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
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
    clients: new InMemoryClientRepository(),
    worlds: new InMemoryWorldRepository([world.value]),
  };
}

function validCreateInput() {
  return {
    id: "client_use_case_01",
    worldKey: "pixel-digital",
    name: "Client A",
    email: "client@example.com",
  };
}

function savedClient() {
  const result = createClientDomain({
    id: "client_use_case_saved",
    worldKey: "pixel-digital",
    name: "Client A",
    createdAt,
    updatedAt: createdAt,
  });
  if (!result.ok) throw new Error("expected a valid client");
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
