import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { OrganizationJsonLd } from "./organization-json-ld";

describe("OrganizationJsonLd", () => {
  it("emits an Organization without inventing local business facts", () => {
    const { container } = render(
      <OrganizationJsonLd
        name="Pixel&Digital"
        path="/"
        description="Description vérifiée"
      />,
    );
    const data = JSON.parse(
      container.querySelector("script")?.textContent ?? "{}",
    );
    expect(data).toMatchObject({
      "@type": "Organization",
      name: "Pixel&Digital",
      description: "Description vérifiée",
    });
    expect(data).not.toHaveProperty("address");
    expect(data).not.toHaveProperty("telephone");
  });

  it("escapes markup-significant characters in JSON", () => {
    const { container } = render(
      <OrganizationJsonLd name="Test" path="/" description="</script>" />,
    );
    expect(container.innerHTML).not.toContain("</script></script>");
  });
});
