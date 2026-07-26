import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./actions", () => ({
  submitContactAction: vi.fn(),
}));

import { ContactForm } from "./contact-form";

afterEach(cleanup);

describe("ContactForm variants", () => {
  it("shows optional structured fields for Kwaliti Print quotes", () => {
    render(
      <ContactForm
        worldKey="kwaliti-print"
        serviceSlug={null}
        sourcePage="/kwaliti-print/devis"
      />,
    );
    expect(
      screen.getByRole("group", { name: "Précisions du devis (optionnelles)" }),
    ).toBeInTheDocument();
    for (const label of [
      "Quantité",
      "Format",
      "Matière",
      "Délai souhaité",
      "Finition",
    ]) {
      expect(screen.getByLabelText(label)).not.toBeRequired();
    }
    expect(screen.getByLabelText("Votre message")).toHaveAttribute(
      "maxlength",
      "3200",
    );
  });

  it("keeps the Pixel&Digital contact form unchanged", () => {
    render(
      <ContactForm
        worldKey="pixel-digital"
        serviceSlug={null}
        sourcePage="/contact"
      />,
    );
    expect(
      screen.queryByRole("group", { name: /Précisions du devis/ }),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Quantité")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Votre message")).toHaveAttribute(
      "maxlength",
      "4000",
    );
  });
});
