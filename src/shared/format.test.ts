import { describe, expect, it } from "vitest";

import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatShortDate,
} from "./format";

describe("shared presentation formats", () => {
  const date = new Date("2026-07-25T14:35:00.000Z");

  it("formats dates deterministically in UTC", () => {
    expect(formatDate(date)).toBe("25/07/2026");
    expect(formatShortDate(date)).toBe("25/07");
    expect(formatDateTime(date)).toMatch(/^25\/07\/2026[, à ]+14:35$/);
  });

  it("formats XOF values stored in minor units", () => {
    expect(formatCurrency(125_000)).toContain("1 250");
    expect(formatCurrency(125_000)).toContain("F CFA");
  });
});
