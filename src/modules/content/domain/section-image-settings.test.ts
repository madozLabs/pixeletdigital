import { describe, expect, it } from "vitest";

import {
  normalizeSectionImageSetting,
  sectionImageFormValue,
  storedSectionImageSetting,
} from "./section-image-settings";

describe("section image settings", () => {
  it("accepts only bounded numeric and allow-listed enum values", () => {
    expect(normalizeSectionImageSetting("imageOpacity", "45")).toBe("45");
    expect(normalizeSectionImageSetting("imageOpacity", "101")).toBeNull();
    expect(normalizeSectionImageSetting("imageZoom", "99")).toBeNull();
    expect(normalizeSectionImageSetting("imageFit", "CONTAIN")).toBe("CONTAIN");
    expect(normalizeSectionImageSetting("imageOverlayColor", "ACCENT")).toBe(
      "ACCENT",
    );
    expect(
      normalizeSectionImageSetting("imageFit", "url(javascript:alert(1))"),
    ).toBeNull();
  });

  it("keeps legacy overlay and position presets compatible with the new UI", () => {
    const payload = {
      backgroundOverlay: "STRONG",
      backgroundPosition: "BOTTOM",
    };
    expect(sectionImageFormValue(payload, "backgroundOverlayOpacity")).toBe(
      "58",
    );
    expect(sectionImageFormValue(payload, "backgroundPositionY")).toBe("100");
  });

  it("does not expose invalid stored values to CSS", () => {
    expect(
      storedSectionImageSetting(
        { imageWidth: "calc(100% + 9999px)" },
        "imageWidth",
      ),
    ).toBeNull();
  });
});
