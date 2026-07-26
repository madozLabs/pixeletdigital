import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CommandPalette,
  type CommandPaletteHandle,
  type CommandPaletteItem,
} from "./command-palette";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

const items: readonly CommandPaletteItem[] = [
  {
    id: "tasks",
    label: "Tâches",
    href: "/workspace/tasks?world=pixel-digital",
    group: "Aller à",
  },
  {
    id: "billing",
    label: "Facturation",
    href: "/workspace/billing?world=pixel-digital",
    group: "Aller à",
  },
];

describe("CommandPalette", () => {
  beforeEach(() => {
    push.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("opens globally, filters without requiring accents, and navigates by keyboard", async () => {
    render(<CommandPalette items={items} />);

    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    const search = screen.getByRole("combobox", {
      name: "Rechercher une page ou une action",
    });
    await waitFor(() => expect(search).toHaveFocus());

    fireEvent.change(search, { target: { value: "taches" } });
    expect(screen.getByRole("option", { name: "Tâches" })).toBeVisible();
    expect(screen.queryByRole("option", { name: "Facturation" })).toBeNull();

    fireEvent.keyDown(search, { key: "Enter" });
    expect(push).toHaveBeenCalledWith("/workspace/tasks?world=pixel-digital");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("supports arrows and Escape, then restores focus to the opener", async () => {
    const ref = createRef<CommandPaletteHandle>();
    render(
      <>
        <button type="button" onClick={() => ref.current?.open()}>
          Ouvrir
        </button>
        <CommandPalette ref={ref} items={items} />
      </>,
    );

    const opener = screen.getByRole("button", { name: "Ouvrir" });
    opener.focus();
    fireEvent.click(opener);
    const search = screen.getByRole("combobox");
    fireEvent.keyDown(search, { key: "ArrowDown" });
    expect(screen.getByRole("option", { name: "Facturation" })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    fireEvent.keyDown(search, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() => expect(opener).toHaveFocus());
  });

  it("closes when the backdrop is clicked", () => {
    render(<CommandPalette items={items} />);
    fireEvent.keyDown(window, { key: "k", metaKey: true });

    fireEvent.click(screen.getByRole("presentation"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
