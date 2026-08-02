import { describe, expect, it } from "vitest";

import { xofToCents } from "./money";

describe("xofToCents", () => {
  it("parses a plain integer", () => {
    expect(xofToCents("62000")).toBe(6200000);
  });

  it("parses a value with a space thousands separator", () => {
    expect(xofToCents("62 000")).toBe(6200000);
  });

  it("parses a value with a non-breaking space thousands separator", () => {
    expect(xofToCents("62 000")).toBe(6200000);
  });

  it("parses a value with a comma decimal separator", () => {
    expect(xofToCents("620,50")).toBe(62050);
  });

  it("parses a value with both a space thousands separator and a comma decimal", () => {
    expect(xofToCents("62 000,50")).toBe(6200050);
  });

  it("returns 0 for an empty value", () => {
    expect(xofToCents("")).toBe(0);
    expect(xofToCents(null)).toBe(0);
  });

  it("returns 0 for a zero or negative amount", () => {
    expect(xofToCents("0")).toBe(0);
    expect(xofToCents("-100")).toBe(0);
  });
});
