import { describe, expect, it } from "vitest";

import {
  createDefaultBlockPayload,
  PAGE_BLOCK_REGISTRY,
  validatePageBlock,
} from "./page-block-registry";

describe("page block registry", () => {
  it("keeps every block type unique and provides independent defaults", () => {
    expect(new Set(PAGE_BLOCK_REGISTRY.map((block) => block.type)).size).toBe(
      PAGE_BLOCK_REGISTRY.length,
    );
    const first = createDefaultBlockPayload("HERO") as Record<string, unknown>;
    first.title = "Changed";
    expect(createDefaultBlockPayload("HERO").title).toBe("");
  });

  it("validates required fields and unsafe links", () => {
    expect(
      validatePageBlock("CTA", {
        title: "Contact",
        label: "Go",
        href: "javascript:alert(1)",
      }),
    ).toEqual([
      "Lien du bouton doit être un lien interne, HTTPS, mailto ou tel.",
    ]);
    expect(validatePageBlock("CTA", {})).toEqual([
      "Titre est requis.",
      "Texte du bouton est requis.",
      "Lien du bouton est requis.",
    ]);
  });
});
