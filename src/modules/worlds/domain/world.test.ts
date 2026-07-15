import { describe, expect, it } from "vitest";

import { createWorld, WORLD_MODES } from "./world";

const now = new Date("2026-07-15T00:00:00.000Z");

function validInput() {
  return {
    id: "world_01",
    key: "pixel-digital",
    displayName: "Pixel&Digital",
    mode: "ACTIVE",
    createdAt: now,
    updatedAt: now,
  };
}

describe("World", () => {
  it.each(WORLD_MODES)("accepts the controlled mode %s", (mode) => {
    const result = createWorld({ ...validInput(), mode });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.mode).toBe(mode);
  });

  it("normalizes surrounding whitespace without changing the stable key", () => {
    const result = createWorld({
      ...validInput(),
      id: " world_01 ",
      key: " pixel-digital ",
      displayName: " Pixel&Digital ",
    });

    expect(result).toMatchObject({
      ok: true,
      value: {
        id: "world_01",
        key: "pixel-digital",
        displayName: "Pixel&Digital",
      },
    });
  });

  it.each([
    "Pixel-Digital",
    "-pixel",
    "pixel-",
    "pixel--digital",
    "p",
    "pixel digital",
    "pixel_digital",
  ])("rejects invalid stable key %s", (key) => {
    const result = createWorld({ ...validInput(), key });

    expect(result).toMatchObject({ ok: false, error: { code: "INVALID_KEY" } });
  });

  it("rejects an empty governed display name", () => {
    const result = createWorld({ ...validInput(), displayName: "   " });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "INVALID_DISPLAY_NAME" },
    });
  });

  it("rejects a mode outside the controlled vocabulary", () => {
    const result = createWorld({ ...validInput(), mode: "PUBLISHED" });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "INVALID_MODE" },
    });
  });
});
