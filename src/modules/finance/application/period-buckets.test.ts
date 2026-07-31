import { describe, expect, it } from "vitest";

import { buildPeriodBuckets, findBucketIndex } from "./period-buckets";

describe("buildPeriodBuckets", () => {
  it("builds one bucket per day across a short range", () => {
    const buckets = buildPeriodBuckets(
      new Date("2026-07-01T00:00:00.000Z"),
      new Date("2026-07-03T23:59:59.000Z"),
      "day",
    );

    expect(buckets).toHaveLength(3);
    expect(buckets[0].label).toBe("01/07");
    expect(buckets[2].label).toBe("03/07");
  });

  it("builds Monday-anchored week buckets", () => {
    // 2026-07-01 is a Wednesday.
    const buckets = buildPeriodBuckets(
      new Date("2026-07-01T00:00:00.000Z"),
      new Date("2026-07-01T00:00:00.000Z"),
      "week",
    );

    expect(buckets).toHaveLength(1);
    // Monday of that week is 2026-06-29.
    expect(buckets[0].start.toISOString()).toBe("2026-06-29T00:00:00.000Z");
  });

  it("builds one bucket per calendar month", () => {
    const buckets = buildPeriodBuckets(
      new Date("2026-01-15T00:00:00.000Z"),
      new Date("2026-03-01T00:00:00.000Z"),
      "month",
    );

    expect(buckets.map((bucket) => bucket.label)).toEqual([
      "Janv. 2026",
      "Févr. 2026",
      "Mars 2026",
    ]);
  });

  it("builds one bucket per year", () => {
    const buckets = buildPeriodBuckets(
      new Date("2024-06-01T00:00:00.000Z"),
      new Date("2026-01-01T00:00:00.000Z"),
      "year",
    );

    expect(buckets.map((bucket) => bucket.label)).toEqual([
      "2024",
      "2025",
      "2026",
    ]);
  });

  it("returns no buckets when the range is inverted", () => {
    const buckets = buildPeriodBuckets(
      new Date("2026-07-10T00:00:00.000Z"),
      new Date("2026-07-01T00:00:00.000Z"),
      "day",
    );

    expect(buckets).toHaveLength(0);
  });
});

describe("findBucketIndex", () => {
  it("finds the bucket a date falls into", () => {
    const buckets = buildPeriodBuckets(
      new Date("2026-07-01T00:00:00.000Z"),
      new Date("2026-07-05T00:00:00.000Z"),
      "day",
    );

    const index = findBucketIndex(
      buckets,
      new Date("2026-07-03T14:30:00.000Z"),
    );

    expect(index).toBe(2);
  });

  it("returns -1 when the date falls outside every bucket", () => {
    const buckets = buildPeriodBuckets(
      new Date("2026-07-01T00:00:00.000Z"),
      new Date("2026-07-05T00:00:00.000Z"),
      "day",
    );

    const index = findBucketIndex(
      buckets,
      new Date("2026-08-01T00:00:00.000Z"),
    );

    expect(index).toBe(-1);
  });
});
