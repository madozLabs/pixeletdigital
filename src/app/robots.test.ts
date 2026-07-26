import { describe, expect, it } from "vitest";

import robots from "./robots";

describe("robots metadata", () => {
  it("keeps private application routes out of crawling", () => {
    const result = robots();
    expect(result.rules).toMatchObject({
      disallow: ["/workspace", "/login", "/api"],
    });
    expect(result.sitemap).toMatch(/\/sitemap\.xml$/);
  });
});
