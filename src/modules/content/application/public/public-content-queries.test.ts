import { describe, expect, it } from "vitest";

import { createWorld } from "@/modules/worlds/domain/world";
import { InMemoryWorldRepository } from "@/modules/worlds/application/testing/in-memory-world-repository";

import {
  approveServiceAsCurrent,
  createDraftService,
  publishService,
  submitServiceForReview,
} from "../../domain/service";
import {
  createDraftServiceFamily,
  publishServiceFamily,
  submitServiceFamilyForReview,
} from "../../domain/service-family";
import { InMemoryServiceFamilyRepository } from "../testing/in-memory-service-family-repository";
import { InMemoryServiceRepository } from "../testing/in-memory-service-repository";
import { listPublishedServiceFamilies } from "./list-published-service-families";
import { listPublishedServices } from "./list-published-services";

const now = new Date("2026-07-15T00:00:00.000Z");

describe("listPublishedServices", () => {
  it("returns only APPROVED_CURRENT and PUBLISHED services", async () => {
    const dependencies = dependenciesWithWorld();
    await dependencies.services.save(approvedPublishedService());
    await dependencies.services.save(candidatePublishedService());

    const result = await listPublishedServices(dependencies, {
      worldKey: "pixel-digital",
    });

    expect(result).toEqual([
      {
        worldKey: "pixel-digital",
        familyId: null,
        name: "Personalized Gadgets",
        slug: "personalized-gadgets",
        description: "Custom-printed promotional gadgets.",
        publishedAt: expect.any(Date),
      },
    ]);
  });

  it("returns an empty list for an invalid worldKey", async () => {
    const dependencies = dependenciesWithWorld();

    const result = await listPublishedServices(dependencies, {
      worldKey: "Invalid Key",
    });

    expect(result).toEqual([]);
  });

  it.each(["TEASER", "INACTIVE"] as const)(
    "returns an empty list when the world mode is %s",
    async (mode) => {
      const dependencies = dependenciesWithWorld({ mode });
      await dependencies.services.save(approvedPublishedService());

      const result = await listPublishedServices(dependencies, {
        worldKey: "pixel-digital",
      });

      expect(result).toEqual([]);
    },
  );
});

describe("listPublishedServiceFamilies", () => {
  it("returns only published families, ordered", async () => {
    const dependencies = dependenciesWithWorld();
    await dependencies.families.save(
      publishedFamily({ id: "family_02", order: 1 }),
    );
    await dependencies.families.save(
      publishedFamily({ id: "family_01", order: 0 }),
    );

    const result = await listPublishedServiceFamilies(dependencies, {
      worldKey: "pixel-digital",
    });

    expect(result.map((f) => f.id)).toEqual(["family_01", "family_02"]);
  });

  it("returns an empty list for an invalid worldKey", async () => {
    const dependencies = dependenciesWithWorld();

    const result = await listPublishedServiceFamilies(dependencies, {
      worldKey: "Invalid Key",
    });

    expect(result).toEqual([]);
  });
});

function dependenciesWithWorld(
  overrides: Partial<{ mode: "ACTIVE" | "TEASER" | "INACTIVE" }> = {},
) {
  const world = createWorld({
    id: "world_01",
    key: "pixel-digital",
    displayName: "Pixel&Digital",
    mode: overrides.mode ?? "ACTIVE",
    createdAt: now,
    updatedAt: now,
  });
  if (!world.ok) throw new Error("expected a valid world");

  return {
    services: new InMemoryServiceRepository(),
    families: new InMemoryServiceFamilyRepository(),
    worlds: new InMemoryWorldRepository([world.value]),
  };
}

function publishedFamily(
  overrides: Partial<{ id: string; order: number }> = {},
) {
  const draft = createDraftServiceFamily({
    id: overrides.id ?? "family_01",
    worldKey: "pixel-digital",
    label: "Communication & Branding",
    order: overrides.order ?? 0,
    createdAt: now,
    updatedAt: now,
  });
  if (!draft.ok) throw new Error("expected a valid draft family");
  const inReview = submitServiceFamilyForReview(draft.value, now);
  if (!inReview.ok) throw new Error("expected submission to succeed");
  const published = publishServiceFamily(inReview.value, now);
  if (!published.ok) throw new Error("expected publication to succeed");
  return published.value;
}

function approvedPublishedService() {
  const draft = createDraftService({
    id: "service_01",
    worldKey: "pixel-digital",
    name: "Personalized Gadgets",
    slug: "personalized-gadgets",
    description: "Custom-printed promotional gadgets.",
    availabilityStatus: "CURRENT_STATED",
    createdAt: now,
    updatedAt: now,
  });
  if (!draft.ok) throw new Error("expected a valid draft service");
  const approved = approveServiceAsCurrent(draft.value, now);
  if (!approved.ok) throw new Error("expected approval to succeed");
  const inReview = submitServiceForReview(approved.value, now);
  if (!inReview.ok) throw new Error("expected submission to succeed");
  const published = publishService(inReview.value, now);
  if (!published.ok) throw new Error("expected publication to succeed");
  return published.value;
}

function candidatePublishedService() {
  const draft = createDraftService({
    id: "service_02",
    worldKey: "pixel-digital",
    name: "Future Capability",
    slug: "future-capability",
    description: "Not yet approved.",
    availabilityStatus: "CANDIDATE",
    createdAt: now,
    updatedAt: now,
  });
  if (!draft.ok) throw new Error("expected a valid draft service");
  const inReview = submitServiceForReview(draft.value, now);
  if (!inReview.ok) throw new Error("expected submission to succeed");
  const published = publishService(inReview.value, now);
  if (!published.ok) throw new Error("expected publication to succeed");
  return published.value;
}
