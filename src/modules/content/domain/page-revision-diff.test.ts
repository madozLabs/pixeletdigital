import { describe, expect, it } from "vitest";
import { comparePageRevisionSections, diffWords } from "./page-revision-diff";

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

  it("produces a word-level field diff for a modified text section", () => {
    const result = comparePageRevisionSections(
      [
        {
          sectionKey: "hero",
          sectionType: "HERO",
          order: 0,
          payload: { title: "Bonjour le monde", eyebrow: "Salut" },
        },
      ],
      [
        {
          sectionKey: "hero",
          sectionType: "HERO",
          order: 0,
          payload: { title: "Bonjour le vaste monde", eyebrow: "Salut" },
        },
      ],
    );
    expect(result.fieldDiffs).toHaveLength(1);
    expect(result.fieldDiffs[0]!.fields).toEqual([
      {
        key: "title",
        segments: [
          { type: "same", text: "Bonjour le " },
          { type: "added", text: "vaste " },
          { type: "same", text: "monde" },
        ],
      },
    ]);
  });
});

describe("diffWords", () => {
  it("returns a single same segment for identical text", () => {
    expect(diffWords("hello world", "hello world")).toEqual([
      { type: "same", text: "hello world" },
    ]);
  });

  it("marks pure additions and removals", () => {
    expect(diffWords("", "new text")).toEqual([
      { type: "added", text: "new text" },
    ]);
    expect(diffWords("old text", "")).toEqual([
      { type: "removed", text: "old text" },
    ]);
  });

  it("falls back to whole-value segments past the word cap", () => {
    const before = Array.from({ length: 401 }, (_, i) => `w${i}`).join(" ");
    const after = `${before} extra`;
    const segments = diffWords(before, after);
    expect(segments).toEqual([
      { type: "removed", text: before },
      { type: "added", text: after },
    ]);
  });
});
