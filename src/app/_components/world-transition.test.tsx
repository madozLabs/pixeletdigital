import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  WorldTransitionLink,
  WorldTransitionProvider,
} from "./world-transition";

const push = vi.fn();
const reducedMotion = vi.hoisted(() => ({ value: false }));
vi.mock("framer-motion", async (importOriginal) => ({
  ...(await importOriginal<typeof import("framer-motion")>()),
  useReducedMotion: () => reducedMotion.value,
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push }),
}));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  push.mockReset();
  reducedMotion.value = false;
});

describe("WorldTransitionLink", () => {
  it("covers the screen before navigating on an explicit world change", () => {
    vi.useFakeTimers();
    render(
      <WorldTransitionProvider>
        <WorldTransitionLink href="/kwaliti-print" label="Kwaliti Print">
          Kwaliti Print
        </WorldTransitionLink>
      </WorldTransitionProvider>,
    );
    fireEvent.click(screen.getByRole("link", { name: "Kwaliti Print" }));
    expect(screen.getByRole("status")).toHaveTextContent("Kwaliti Print");
    expect(push).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(360));
    expect(push).toHaveBeenCalledWith("/kwaliti-print");
  });

  it("preserves modified clicks for standard browser navigation", () => {
    vi.useFakeTimers();
    render(
      <WorldTransitionProvider>
        <WorldTransitionLink href="/kwaliti-print" label="Kwaliti Print">
          Kwaliti Print
        </WorldTransitionLink>
      </WorldTransitionProvider>,
    );
    const link = screen.getByRole("link");
    link.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(link, { ctrlKey: true });
    act(() => vi.advanceTimersByTime(500));
    expect(push).not.toHaveBeenCalled();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("navigates instantly when reduced motion is requested", () => {
    reducedMotion.value = true;
    render(
      <WorldTransitionProvider>
        <WorldTransitionLink href="/kwaliti-print" label="Kwaliti Print">
          Kwaliti Print
        </WorldTransitionLink>
      </WorldTransitionProvider>,
    );
    fireEvent.click(screen.getByRole("link"));
    expect(push).toHaveBeenCalledWith("/kwaliti-print");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
