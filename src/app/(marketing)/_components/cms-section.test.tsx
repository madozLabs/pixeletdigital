import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CmsSection } from "./cms-section";

const noServices = [] as const;

describe("CmsSection", () => {
  it("renders the media selected for a MEDIA block", () => {
    const media = new Map([
      [
        "image-1",
        {
          id: "image-1",
          publicUrl: "/media/selected.jpg",
          altText: "Visuel sélectionné",
          mimeType: "image/jpeg",
        },
      ],
    ]);
    render(
      <CmsSection
        sectionId="section-media"
        type="MEDIA"
        payload={{ title: "Production", mediaId: "image-1" }}
        mediaById={media}
        services={noServices}
        worldKey="pixel-digital"
      />,
    );
    expect(screen.getByAltText("Visuel sélectionné")).toBeInTheDocument();
    expect(
      screen.getByText("Production").closest("[data-cms-section-id]"),
    ).toHaveAttribute("data-cms-section-id", "section-media");
  });

  it("keeps a newly added empty portfolio visible in the visual editor", () => {
    render(
      <CmsSection
        sectionId="portfolio-new"
        type="PORTFOLIO"
        payload={{ mediaIds: [] }}
        mediaById={new Map()}
        services={noServices}
        worldKey="pixel-digital"
        editing
      />,
    );
    expect(screen.getByText("Choisir des images")).toBeInTheDocument();
    expect(
      document.querySelector('[data-cms-section-id="portfolio-new"]'),
    ).toBeInTheDocument();
  });
});
