import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./edit-presence-actions", () => ({
  heartbeatEditPresence: vi.fn(async () => [
    { id: "user-2", name: "Awa Ouédraogo" },
  ]),
  leaveEditPresence: vi.fn(async () => undefined),
}));

import { leaveEditPresence } from "./edit-presence-actions";
import { EditPresence } from "./edit-presence";

afterEach(() => cleanup());

describe("EditPresence", () => {
  it("annonce les autres personnes présentes et nettoie sa présence", async () => {
    const view = render(<EditPresence entityType="PAGE" entityId="page-1" />);
    expect(
      await screen.findByText("Aussi consulté par Awa Ouédraogo"),
    ).toHaveAttribute("role", "status");

    view.unmount();
    await waitFor(() =>
      expect(leaveEditPresence).toHaveBeenCalledWith("PAGE", "page-1"),
    );
  });
});
