import { afterEach, describe, expect, it } from "vitest";

import { getSiteUrl } from "./site-url";

const original = process.env.NEXT_PUBLIC_SITE_URL;

afterEach(() => {
  if (original === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
  else process.env.NEXT_PUBLIC_SITE_URL = original;
});

describe("getSiteUrl", () => {
  it("uses the configured canonical origin", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://example.test/path";
    expect(getSiteUrl().origin).toBe("https://example.test");
  });

  it("falls back safely when configuration is invalid", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "not a url";
    expect(getSiteUrl().origin).toBe("http://localhost:3000");
  });
});
