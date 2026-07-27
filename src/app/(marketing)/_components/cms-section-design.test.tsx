import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  CmsPrimaryImageOverlay,
  CmsSectionBackground,
  cmsSectionDesignProps,
} from "./cms-section-design";

describe("CMS section design", () => {
  it("only applies whitelisted typography values", () => {
    const valid = cmsSectionDesignProps(
      {
        headingFont: "MANROPE",
        headingWeight: "800",
        headingStyle: "italic",
      },
      "section",
    );
    expect(valid.className).toContain("cms-section--custom-heading-font");
    expect(valid.style).toMatchObject({
      "--cms-heading-font": "var(--font-manrope), system-ui, sans-serif",
      "--cms-heading-weight": "800",
      "--cms-heading-style": "italic",
    });
    expect(
      cmsSectionDesignProps(
        { headingFont: "url(javascript:alert(1))", headingWeight: "1000" },
        "section",
      ).style,
    ).toEqual({});
  });

  it("renders the configured background as a decorative optimized image", () => {
    const { container } = render(
      <CmsSectionBackground
        payload={{
          backgroundMediaId: "media-1",
          backgroundOverlay: "STRONG",
          backgroundPosition: "TOP",
        }}
        mediaById={
          new Map([
            [
              "media-1",
              {
                id: "media-1",
                publicUrl: "/image.png",
                altText: "Description métier",
                mimeType: "image/png",
              },
            ],
          ])
        }
      />,
    );
    expect(container.querySelector("img")).toHaveAttribute("alt", "");
    expect(container.firstChild).toHaveAttribute(
      "data-cms-media-slot",
      "background",
    );
    expect(
      container.querySelector(".cms-section-background__overlay--strong"),
    ).toBeInTheDocument();
  });

  it("defaults to light text when a background image is selected", () => {
    expect(
      cmsSectionDesignProps(
        { backgroundMediaId: "media-1", textTone: "AUTO" },
        "section",
      ).className,
    ).toContain("cms-section--text-light");
  });

  it("exposes only normalized image controls as CSS variables", () => {
    const result = cmsSectionDesignProps(
      {
        imageOpacity: "45",
        imageFit: "CONTAIN",
        imagePositionX: "25",
        imagePositionY: "80",
        imageZoom: "130",
        imageWidth: "75",
        imageHeight: "420",
        imageOverlayColor: "WHITE",
        imageOverlayOpacity: "20",
        backgroundImageOpacity: "60",
        backgroundOverlayColor: "ACCENT",
        backgroundOverlayOpacity: "35",
      },
      "section",
    );
    expect(result.style).toMatchObject({
      "--cms-image-opacity": "0.45",
      "--cms-image-fit": "contain",
      "--cms-image-position-x": "25%",
      "--cms-image-position-y": "80%",
      "--cms-image-zoom": "1.3",
      "--cms-image-width": "75%",
      "--cms-image-height": "420px",
      "--cms-image-overlay-color": "rgb(255 255 255)",
      "--cms-image-overlay-opacity": "0.2",
      "--cms-background-image-opacity": "0.6",
      "--cms-background-overlay-color": "var(--accent)",
      "--cms-background-overlay-opacity": "0.35",
    });
    expect(
      cmsSectionDesignProps(
        { imageWidth: "calc(100% + 1px)", backgroundZoom: "999" },
        "section",
      ).style,
    ).toEqual({});
  });

  it("renders a decorative primary-image overlay layer", () => {
    const { container } = render(<CmsPrimaryImageOverlay />);
    expect(container.firstChild).toHaveClass("cms-primary-image-overlay");
    expect(container.firstChild).toHaveAttribute("aria-hidden", "true");
  });
});
