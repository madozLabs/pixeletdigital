import { describe, expect, it } from "vitest";
import { comparePageRevisionSections } from "./page-revision-diff";

describe("comparePageRevisionSections", () => {
  it("classifies additions, removals, content changes and moves", () => {
    const result = comparePageRevisionSections(
      [
        {
          sectionKey: "hero",
          sectionType: "HERO",
          order: 0,
          payload: { title: "Avant" },
        },
        { sectionKey: "old", sectionType: "CTA", order: 1, payload: {} },
      ],
      [
        {
          sectionKey: "hero",
          sectionType: "HERO",
          order: 1,
          payload: { title: "Après" },
        },
        { sectionKey: "new", sectionType: "FAQ", order: 0, payload: {} },
      ],
    );
    expect(result.added).toEqual(["FAQ"]);
    expect(result.removed).toEqual(["CTA"]);
    expect(result.modified).toEqual(["HERO — Après"]);
    expect(result.moved).toEqual(["HERO — Après"]);
    expect(result.totalChanges).toBe(4);
  });

  it("ignores object key ordering", () => {
    const before = [
      {
        sectionKey: "hero",
        sectionType: "HERO",
        order: 0,
        payload: { a: 1, b: 2 },
      },
    ];
    const after = [
      {
        sectionKey: "hero",
        sectionType: "HERO",
        order: 0,
        payload: { b: 2, a: 1 },
      },
    ];
    expect(comparePageRevisionSections(before, after).totalChanges).toBe(0);
  });
});
