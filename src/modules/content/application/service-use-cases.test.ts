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
  createDraftService as createDraftServiceDomain,
  type Service,
} from "../domain/service";
import {
  approveServiceAsCurrent,
  archiveService,
  createDraftService,
  editDraftService,
  getServiceById,
  listServicesByWorld,
  publishService,
  revokeServiceApproval,
  setServiceAvailability,
} from "./service-use-cases";
import { InMemoryServiceRepository } from "./testing/in-memory-service-repository";

const createdAt = new Date("2026-07-15T08:00:00.000Z");
const clockTime = new Date("2026-07-15T10:30:00.000Z");

describe("createDraftService", () => {
  it.each<ApprovedRole>(["SUPER_ADMIN", "ADMIN", "WORLD_MANAGER", "EDITOR"])(
    "allows %s with a matching world scope to create a draft",
    async (role) => {
      const dependencies = dependenciesWithWorld();

      const result = await createDraftService(
        dependencies,
        context(role, [{ type: "WORLD", worldKey: "kwaliti-print" }]),
        validCreateInput(),
      );

      expect(result).toMatchObject({
        ok: true,
        value: {
          lifecycle: "DRAFT",
          version: 1,
          availabilityStatus: "CURRENT_STATED",
        },
      });
      expect(dependencies.services.savedServices).toHaveLength(1);
    },
  );

  it.each<ApprovedRole>(["SALES", "CONTRIBUTOR", "READER"])(
    "denies %s without saving",
    async (role) => {
      const dependencies = dependenciesWithWorld();

      const result = await createDraftService(
        dependencies,
        context(role, [{ type: "GLOBAL" }]),
        validCreateInput(),
      );

      expect(result).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
      expect(dependencies.services.savedServices).toHaveLength(0);
    },
  );

  it("rejects creating a service directly as APPROVED_CURRENT", async () => {
    const dependencies = dependenciesWithWorld();

    const result = await createDraftService(
      dependencies,
      context("SUPER_ADMIN", [{ type: "GLOBAL" }]),
      { ...validCreateInput(), availabilityStatus: "APPROVED_CURRENT" },
    );

    expect(result).toMatchObject({
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        validationCode: "INVALID_AVAILABILITY_STATUS",
      },
    });
    expect(dependencies.services.savedServices).toHaveLength(0);
  });

  it("returns NOT_FOUND when the world does not exist", async () => {
    const dependencies = {
      services: new InMemoryServiceRepository(),
      worlds: new InMemoryWorldRepository(),
    };

    const result = await createDraftService(
      dependencies,
      context("EDITOR", [{ type: "GLOBAL" }]),
      validCreateInput(),
    );

    expect(result).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
  });
});

describe("getServiceById", () => {
  it("allows a reader with a matching world scope", async () => {
    const service = draftService();
    const dependencies = dependenciesWithService(service);

    const result = await getServiceById(
      dependencies,
      context("READER", [{ type: "WORLD", worldKey: service.worldKey }]),
      { id: service.id },
    );

    expect(result).toEqual({ ok: true, value: service });
  });

  it("returns FORBIDDEN when scopes do not cover the service's world", async () => {
    const service = draftService();
    const dependencies = dependenciesWithService(service);

    const result = await getServiceById(
      dependencies,
      context("READER", [{ type: "WORLD", worldKey: "other-world" }]),
      { id: service.id },
    );

    expect(result).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
  });
});

describe("listServicesByWorld", () => {
  it("returns every service in the world regardless of lifecycle or status", async () => {
    const service = draftService();
    const dependencies = dependenciesWithService(service);

    const result = await listServicesByWorld(
      dependencies,
      context("READER", [{ type: "WORLD", worldKey: service.worldKey }]),
      { worldKey: service.worldKey },
    );

    expect(result).toMatchObject({ ok: true, value: [{ id: service.id }] });
  });

  it("returns FORBIDDEN when scopes do not cover the requested world", async () => {
    const dependencies = dependenciesWithService(draftService());

    const result = await listServicesByWorld(
      dependencies,
      context("READER", [{ type: "WORLD", worldKey: "other-world" }]),
      { worldKey: "kwaliti-print" },
    );

    expect(result).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
  });
});

describe("editDraftService", () => {
  it("edits a draft service and bumps the version", async () => {
    const service = draftService();
    const dependencies = dependenciesWithService(service);

    const result = await editDraftService(
      dependencies,
      context("EDITOR", [{ type: "WORLD", worldKey: service.worldKey }]),
      {
        id: service.id,
        expectedVersion: service.version,
        name: "Gadgets personnalisés",
        slug: "gadgets-personnalises",
        description: "Nouvelle description.",
      },
    );

    expect(result).toMatchObject({
      ok: true,
      value: { name: "Gadgets personnalisés" },
    });
  });

  it("returns CONFLICT on a stale version", async () => {
    const service = draftService();
    const dependencies = dependenciesWithService(service);

    const result = await editDraftService(
      dependencies,
      context("EDITOR", [{ type: "GLOBAL" }]),
      {
        id: service.id,
        expectedVersion: service.version + 1,
        name: "X",
        slug: "x",
        description: "Y",
      },
    );

    expect(result).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(dependencies.services.savedServices).toHaveLength(0);
  });
});

describe("setServiceAvailability", () => {
  it("allows an editor to move availability among editable statuses", async () => {
    const service = draftService();
    const dependencies = dependenciesWithService(service);

    const result = await setServiceAvailability(
      dependencies,
      context("EDITOR", [{ type: "WORLD", worldKey: service.worldKey }]),
      {
        id: service.id,
        expectedVersion: service.version,
        availabilityStatus: "FUTURE_ONLY",
      },
    );

    expect(result).toMatchObject({
      ok: true,
      value: { availabilityStatus: "FUTURE_ONLY" },
    });
  });

  it("denies an editor from setting APPROVED_CURRENT", async () => {
    const service = draftService();
    const dependencies = dependenciesWithService(service);

    const result = await setServiceAvailability(
      dependencies,
      context("EDITOR", [{ type: "GLOBAL" }]),
      {
        id: service.id,
        expectedVersion: service.version,
        availabilityStatus: "APPROVED_CURRENT",
      },
    );

    expect(result).toMatchObject({
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        validationCode: "INVALID_AVAILABILITY_STATUS",
      },
    });
  });
});

describe("approveServiceAsCurrent and revokeServiceApproval", () => {
  it("denies an ADMIN from approving -- only SUPER_ADMIN may", async () => {
    const service = draftService();
    const dependencies = dependenciesWithService(service);

    const result = await approveServiceAsCurrent(
      dependencies,
      context("ADMIN", [{ type: "GLOBAL" }]),
      { id: service.id, expectedVersion: service.version },
    );

    expect(result).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    expect(dependencies.services.savedServices).toHaveLength(0);
  });

  it("allows SUPER_ADMIN to approve a CURRENT_STATED service", async () => {
    const service = draftService();
    const dependencies = dependenciesWithService(service);

    const result = await approveServiceAsCurrent(
      dependencies,
      context("SUPER_ADMIN", [{ type: "GLOBAL" }]),
      { id: service.id, expectedVersion: service.version },
    );

    expect(result).toMatchObject({
      ok: true,
      value: { availabilityStatus: "APPROVED_CURRENT" },
    });
  });

  it("allows SUPER_ADMIN to revoke an APPROVED_CURRENT service", async () => {
    const service = draftService();
    const dependencies = dependenciesWithService(service);
    const approved = await approveServiceAsCurrent(
      dependencies,
      context("SUPER_ADMIN", [{ type: "GLOBAL" }]),
      { id: service.id, expectedVersion: service.version },
    );
    if (!approved.ok) throw new Error("expected approval to succeed");

    const result = await revokeServiceApproval(
      dependencies,
      context("SUPER_ADMIN", [{ type: "GLOBAL" }]),
      { id: service.id, expectedVersion: approved.value.version },
    );

    expect(result).toMatchObject({
      ok: true,
      value: { availabilityStatus: "CURRENT_STATED" },
    });
  });
});

describe("publishService and archiveService", () => {
  it("denies an EDITOR from publishing", async () => {
    const service = draftService();
    const dependencies = dependenciesWithService(service);

    const result = await publishService(
      dependencies,
      context("EDITOR", [{ type: "GLOBAL" }]),
      { id: service.id, expectedVersion: service.version },
    );

    expect(result).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
  });

  it("allows a WORLD_MANAGER to archive a draft service", async () => {
    const service = draftService();
    const dependencies = dependenciesWithService(service);

    const result = await archiveService(
      dependencies,
      context("WORLD_MANAGER", [{ type: "WORLD", worldKey: service.worldKey }]),
      { id: service.id, expectedVersion: service.version },
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

function validCreateInput() {
  return {
    id: "service_01",
    worldKey: "kwaliti-print",
    name: "Personalized Gadgets",
    slug: "personalized-gadgets",
    description: "Custom-printed promotional gadgets.",
    availabilityStatus: "CURRENT_STATED",
  };
}

function draftService(): Service {
  const result = createDraftServiceDomain({
    id: "service_01",
    worldKey: "kwaliti-print",
    name: "Personalized Gadgets",
    slug: "personalized-gadgets",
    description: "Custom-printed promotional gadgets.",
    availabilityStatus: "CURRENT_STATED",
    createdAt,
    updatedAt: createdAt,
  });
  if (!result.ok) throw new Error("expected a valid draft service");
  return result.value;
}

function dependenciesWithWorld() {
  const world = createWorld({
    id: "world_01",
    key: "kwaliti-print",
    displayName: "Kwaliti Print",
    mode: "ACTIVE",
    createdAt,
    updatedAt: createdAt,
  });
  if (!world.ok) throw new Error("expected a valid world");

  return {
    services: new InMemoryServiceRepository(),
    worlds: new InMemoryWorldRepository([world.value]),
  };
}

function dependenciesWithService(service: Service) {
  return {
    services: new InMemoryServiceRepository([service]),
    worlds: new InMemoryWorldRepository(),
  };
}
