import { describe, expect, it } from "vitest";

import {
  archiveCatalogueItem,
  createCatalogueItem,
  editCatalogueItem,
  restoreCatalogueItem,
} from "./catalogue-item";

const now = new Date("2026-07-23T00:00:00.000Z");

describe("createCatalogueItem", () => {
  it("creates an ACTIVE item with version 1", () => {
    const result = createCatalogueItem(validInput());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("ACTIVE");
    expect(result.value.version).toBe(1);
  });

  it("rejects a negative unit price", () => {
    const result = createCatalogueItem(validInput({ unitPriceCents: -100 }));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_UNIT_PRICE_CENTS");
  });

  it("rejects an invalid kind", () => {
    const result = createCatalogueItem({
      ...validInput(),
      kind: "SUBSCRIPTION",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_KIND");
  });
});

describe("editCatalogueItem", () => {
  it("updates label and price, bumps version", () => {
    const created = createCatalogueItem(validInput());
    if (!created.ok) throw new Error("expected a valid item");

    const result = editCatalogueItem(
      created.value,
      { label: "New label", unitPriceCents: 5000 },
      now,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.label).toBe("New label");
    expect(result.value.unitPriceCents).toBe(5000);
    expect(result.value.version).toBe(2);
  });
});

describe("archiveCatalogueItem", () => {
  it("transitions ACTIVE to ARCHIVED", () => {
    const created = createCatalogueItem(validInput());
    if (!created.ok) throw new Error("expected a valid item");

    const result = archiveCatalogueItem(created.value, now);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("ARCHIVED");
  });
});

describe("restoreCatalogueItem", () => {
  it("round-trips a persisted item", () => {
    const created = createCatalogueItem(validInput());
    if (!created.ok) throw new Error("expected a valid item");

    const result = restoreCatalogueItem(created.value);

    expect(result).toEqual({ ok: true, value: created.value });
  });
});

function validInput(
  overrides: Partial<{ kind: string; unitPriceCents: number }> = {},
) {
  return {
    id: "catalogue_test_01",
    worldKey: "pixel-digital",
    label: "Création de logo",
    kind: overrides.kind ?? "SERVICE",
    unitPriceCents: overrides.unitPriceCents ?? 45000,
    createdAt: now,
    updatedAt: now,
  };
}
