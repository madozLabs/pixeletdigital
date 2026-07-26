import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { getStatusLabel, StatusBadge } from "./status-badge";

describe("StatusBadge", () => {
  afterEach(cleanup);

  it("centralizes labels for the governed workspace statuses", () => {
    expect(getStatusLabel("invoice", "PARTIALLY_PAID")).toBe(
      "Partiellement payée",
    );
    expect(getStatusLabel("editorial", "CLIENT_REVIEW")).toBe(
      "Validation client",
    );
    expect(getStatusLabel("service", "PUBLISHED")).toBe("Publié");
  });

  it("renders a stable semantic badge with the centralized tone", () => {
    render(<StatusBadge kind="lead" status="QUALIFIED" />);
    expect(screen.getByText("Qualifié")).toHaveClass("status-badge--positive");
  });
});
