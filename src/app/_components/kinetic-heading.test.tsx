import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { KineticHeading } from "./kinetic-heading";

describe("KineticHeading", () => {
  it("keeps a single semantic heading and preserves CMS lines", () => {
    render(
      <KineticHeading
        text={["Avec nous,", "vous allez", "prendre terrain."]}
        accentLastLine
      />,
    );
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent("Avec nous,vous allezprendre terrain.");
    expect(
      heading.querySelector(".kinetic-heading__line--accent"),
    ).toHaveTextContent("prendre terrain.");
  });
});
