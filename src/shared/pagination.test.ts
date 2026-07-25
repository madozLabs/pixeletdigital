import { describe, expect, it } from "vitest";

import {
  buildPaginatedResult,
  DEFAULT_PAGE_SIZE,
  parsePage,
  toSkipTake,
} from "./pagination";

describe("parsePage", () => {
  it("defaults to page 1 when no value is given", () => {
    expect(parsePage(undefined)).toEqual({
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
    });
  });

  it("parses a valid page number", () => {
    expect(parsePage("3")).toEqual({ page: 3, pageSize: DEFAULT_PAGE_SIZE });
  });

  it("falls back to page 1 for zero, negative or non-numeric input", () => {
    expect(parsePage("0").page).toBe(1);
    expect(parsePage("-4").page).toBe(1);
    expect(parsePage("not-a-number").page).toBe(1);
  });

  it("accepts a custom page size", () => {
    expect(parsePage("2", 10)).toEqual({ page: 2, pageSize: 10 });
  });
});

describe("toSkipTake", () => {
  it("computes skip/take for the first page", () => {
    expect(toSkipTake({ page: 1, pageSize: 20 })).toEqual({
      skip: 0,
      take: 20,
    });
  });

  it("computes skip/take for a later page", () => {
    expect(toSkipTake({ page: 3, pageSize: 20 })).toEqual({
      skip: 40,
      take: 20,
    });
  });
});

describe("buildPaginatedResult", () => {
  it("computes total pages, rounding up", () => {
    const result = buildPaginatedResult([1, 2], 41, {
      page: 1,
      pageSize: 20,
    });
    expect(result.totalPages).toBe(3);
  });

  it("never reports fewer than 1 total page, even when empty", () => {
    const result = buildPaginatedResult([], 0, { page: 1, pageSize: 20 });
    expect(result.totalPages).toBe(1);
    expect(result.total).toBe(0);
  });

  it("carries through the requested page and items", () => {
    const items = ["a", "b"];
    const result = buildPaginatedResult(items, 2, { page: 1, pageSize: 20 });
    expect(result.items).toBe(items);
    expect(result.page).toBe(1);
  });
});
