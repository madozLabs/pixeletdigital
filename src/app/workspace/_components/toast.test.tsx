import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Feedback } from "./feedback";
import { ToastProvider } from "./toast";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("ToastProvider with Feedback", () => {
  it("adds a transient toast while preserving successful inline feedback", () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <Feedback state={{ status: "success", message: "Client créé." }} />
      </ToastProvider>,
    );
    expect(screen.getAllByText("Client créé.")).toHaveLength(2);
    expect(screen.getByRole("status")).toHaveTextContent("Client créé.");
    act(() => vi.advanceTimersByTime(4000));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByText("Client créé.")).toHaveClass(
      "admin-feedback--success",
    );
  });

  it("keeps errors inline instead of showing a success toast", () => {
    render(
      <ToastProvider>
        <Feedback state={{ status: "error", message: "Action impossible." }} />
      </ToastProvider>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Action impossible.");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("lets the user dismiss a toast", () => {
    render(
      <ToastProvider>
        <Feedback state={{ status: "success", message: "Enregistré." }} />
      </ToastProvider>,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Fermer la notification" }),
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
