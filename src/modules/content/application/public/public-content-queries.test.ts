import { describe, expect, it } from "vitest";

import { createWorld } from "@/modules/worlds/domain/world";
import { InMemoryWorldRepository } from "@/modules/worlds/application/testing/in-memory-world-repository";

import {
  createDraftPage,
  publishPage,
  submitPageForReview,
} from "../../domain/page";
import { createPageSection, type PageSection } from "../../domain/page-section";
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
import { InMemoryPageRepository } from "../testing/in-memory-page-repository";
import { InMemoryPageSectionRepository } from "../testing/in-memory-page-section-repository";
import { InMemoryServiceFamilyRepository } from "../testing/in-memory-service-family-repository";
import { InMemoryServiceRepository } from "../testing/in-memory-service-repository";
import { getPublishedPage } from "./get-published-page";
import { listPublishedServiceFamilies } from "./list-published-service-families";
import { listPublishedServices } from "./list-published-services";

const now = new Date("2026-07-15T00:00:00.000Z");

describe("getPublishedPage", () => {
  it("returns the projection for a published page in an ACTIVE world", async () => {
    const dependencies = dependenciesWithWorld();
    const page = publishedPage();
    await dependencies.pages.save(page);

    const result = await getPublishedPage(dependencies, {
      worldKey: "pixel-digital",
      slug: "agence",
    });

    expect(result).toEqual({
      worldKey: "pixel-digital",
      pageType: "STANDARD",
      title: "Agence",
      slug: "agence",
      publishedAt: page.publishedAt,
      sections: [],
    });
  });

  it("includes ordered sections for a published page", async () => {
    const dependencies = dependenciesWithWorld();
    const page = publishedPage();
    await dependencies.pages.save(page);
    await dependencies.sections.save(
      section(page.id, { id: "section_02", order: 1, sectionType: "CTA" }),
    );
    await dependencies.sections.save(
      section(page.id, { id: "section_01", order: 0, sectionType: "HERO" }),
    );

    const result = await getPublishedPage(dependencies, {
      worldKey: "pixel-digital",
      slug: "agence",
    });

    expect(result?.sections).toEqual([
      {
        sectionType: "HERO",
        order: 0,
        payload: { headline: "Bienvenue" },
        payloadSchemaVersion: 1,
      },
      {
        sectionType: "CTA",
        order: 1,
        payload: { headline: "Bienvenue" },
        payloadSchemaVersion: 1,
      },
    ]);
  });

  it("returns null for an invalid worldKey", async () => {
    const dependencies = dependenciesWithWorld();

    const result = await getPublishedPage(dependencies, {
      worldKey: "Invalid Key",
      slug: "agence",
    });

    expect(result).toBeNull();
  });

  it("returns null when the world does not exist", async () => {
    const dependencies = {
      pages: new InMemoryPageRepository(),
      sections: new InMemoryPageSectionRepository(),
      worlds: new InMemoryWorldRepository(),
    };

    const result = await getPublishedPage(dependencies, {
      worldKey: "pixel-digital",
      slug: "agence",
    });

    expect(result).toBeNull();
  });

  it.each(["TEASER", "INACTIVE"] as const)(
    "returns null when the world mode is %s",
    async (mode) => {
      const dependencies = dependenciesWithWorld({ mode });
      await dependencies.pages.save(publishedPage());

      const result = await getPublishedPage(dependencies, {
        worldKey: "pixel-digital",
        slug: "agence",
      });

      expect(result).toBeNull();
    },
  );

  it("returns null for a page that is not published", async () => {
    const dependencies = dependenciesWithWorld();
    const draft = createDraftPage({
      id: "page_01",
      worldKey: "pixel-digital",
      pageType: "STANDARD",
      title: "Agence",
      slug: "agence",
      createdAt: now,
      updatedAt: now,
    });
    if (!draft.ok) throw new Error("expected a valid draft page");
    await dependencies.pages.save(draft.value);

    const result = await getPublishedPage(dependencies, {
      worldKey: "pixel-digital",
      slug: "agence",
    });

    expect(result).toBeNull();
  });
});

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
    pages: new InMemoryPageRepository(),
    sections: new InMemoryPageSectionRepository(),
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

function publishedPage() {
  const draft = createDraftPage({
    id: "page_01",
    worldKey: "pixel-digital",
    pageType: "STANDARD",
    title: "Agence",
    slug: "agence",
    createdAt: now,
    updatedAt: now,
  });
  if (!draft.ok) throw new Error("expected a valid draft page");
  const inReview = submitPageForReview(draft.value, now);
  if (!inReview.ok) throw new Error("expected submission to succeed");
  const published = publishPage(inReview.value, now);
  if (!published.ok) throw new Error("expected publication to succeed");
  return published.value;
}

function section(
  pageId: string,
  overrides: Partial<{ id: string; order: number; sectionType: string }> = {},
): PageSection {
  const result = createPageSection({
    id: overrides.id ?? "section_default",
    pageId,
    sectionType: overrides.sectionType ?? "HERO",
    order: overrides.order ?? 0,
    payload: { headline: "Bienvenue" },
    payloadSchemaVersion: 1,
    createdAt: now,
    updatedAt: now,
  });
  if (!result.ok) throw new Error("expected a valid section");
  return result.value;
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
