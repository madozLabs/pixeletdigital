import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EvidenceSection } from "./evidence-section";

const approved = {
  title: "Une preuve réelle",
  claimOwner: "Owner",
  sourceLocation: "Source privée",
  sourceOwner: "Source owner",
  verificationDate: "2026-07-26",
  attributionPermission: "Approuvée",
  mediaRights: "Approuvés",
  accessibleAlternative: "Alternative",
  relatedService: "Conseil",
  label: "Nous contacter",
  href: "/contact",
  evidenceStatus: "Approved",
  evidenceClass: "Testimonial",
  quote: "Déclaration approuvée",
  attribution: "Client anonymisé avec accord",
};

describe("EvidenceSection", () => {
  it("renders approved proof without exposing governance source data", () => {
    render(<EvidenceSection type="TESTIMONIAL" payload={approved} />);
    expect(screen.getByText(/Déclaration approuvée/)).toBeInTheDocument();
    expect(screen.queryByText("Source privée")).not.toBeInTheDocument();
  });

  it("does not render unapproved proof", () => {
    const { container } = render(
      <EvidenceSection
        type="TESTIMONIAL"
        payload={{ ...approved, evidenceStatus: "In review" }}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
