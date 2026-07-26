import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ConfirmAction } from "./confirm-action";

describe("ConfirmAction", () => {
  afterEach(cleanup);

  it("requires a second explicit click before submitting", () => {
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <ConfirmAction consequence="Le rôle sera retiré immédiatement.">
          Révoquer
        </ConfirmAction>
      </form>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Révoquer" }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Le rôle sera retiré immédiatement.",
    );
    expect(screen.getByDisplayValue("on")).toHaveAttribute("name", "confirmed");

    fireEvent.click(screen.getByRole("button", { name: "Confirmer" }));
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it("allows the user to cancel the confirmation", () => {
    render(
      <form>
        <ConfirmAction consequence="Le compte sera suspendu.">
          Suspendre
        </ConfirmAction>
      </form>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Suspendre" }));
    fireEvent.click(screen.getByRole("button", { name: "Conserver" }));

    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByRole("button", { name: "Suspendre" })).toBeVisible();
  });
});
