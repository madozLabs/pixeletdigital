import { describe, expect, it } from "vitest";

import { buildCmsWorldSwitchHref } from "./cms-navigation";

describe("buildCmsWorldSwitchHref", () => {
  it("leaves a world-bound page editor before switching sites", () => {
    expect(
      buildCmsWorldSwitchHref(
        "/workspace/site-content/pages/home-page%3Akwaliti-print/edit",
        "pixel-digital",
      ),
    ).toBe("/workspace/site-content/pages?world=pixel-digital");
  });

  it("keeps a world-neutral CMS section when switching sites", () => {
    expect(
      buildCmsWorldSwitchHref("/workspace/site-content/media", "kwaliti-print"),
    ).toBe("/workspace/site-content/media?world=kwaliti-print");
  });

  it("keeps the CMS dashboard when switching sites", () => {
    expect(
      buildCmsWorldSwitchHref("/workspace/site-content", "kwaliti-print"),
    ).toBe("/workspace/site-content?world=kwaliti-print");
  });
});
