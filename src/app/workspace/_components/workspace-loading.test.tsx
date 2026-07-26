import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { WorkspaceLoading } from "./workspace-loading";

describe("WorkspaceLoading", () => {
  it("announces the route being loaded and exposes a busy state", () => {
    render(<WorkspaceLoading label="les projets" />);
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-busy", "true");
    expect(status).toHaveTextContent("Chargement : les projets…");
  });
});
