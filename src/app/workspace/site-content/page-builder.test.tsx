import React from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  add: vi.fn(),
  duplicate: vi.fn(),
  reorder: vi.fn(),
  media: vi.fn(),
  restore: vi.fn(),
  copy: vi.fn(),
  remove: vi.fn(),
  undo: vi.fn(),
  redo: vi.fn(),
  refresh: vi.fn(),
  onDragEnd: null as null | ((result: unknown) => void),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));
vi.mock("next/image", () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img {...props} alt={props.alt ?? ""} />
  ),
}));
vi.mock("@hello-pangea/dnd", () => ({
  DragDropContext: ({
    children,
    onDragEnd,
  }: React.PropsWithChildren<{ onDragEnd: (result: unknown) => void }>) => {
    mocks.onDragEnd = onDragEnd;
    return <>{children}</>;
  },
  Droppable: ({
    children,
  }: {
    children: (provided: {
      innerRef: () => void;
      droppableProps: object;
      placeholder: null;
    }) => React.ReactNode;
  }) =>
    children({
      innerRef: () => undefined,
      droppableProps: {},
      placeholder: null,
    }),
  Draggable: ({
    children,
  }: {
    children: (provided: {
      innerRef: () => void;
      draggableProps: object;
      dragHandleProps: object;
    }) => React.ReactNode;
  }) =>
    children({
      innerRef: () => undefined,
      draggableProps: {},
      dragHandleProps: {},
    }),
}));
vi.mock("./actions", () => ({
  addPageBlockAction: mocks.add,
  duplicatePageBlockAction: mocks.duplicate,
  reorderPageBlocksAction: mocks.reorder,
  setPageBlockMediaAction: mocks.media,
  restoreLastDeletedBlockAction: mocks.restore,
  copyPageBlockToPageAction: mocks.copy,
  deleteSectionAction: mocks.remove,
  undoPageEditAction: mocks.undo,
  redoPageEditAction: mocks.redo,
}));

import { PageBuilder } from "./page-builder";

afterEach(() => cleanup());

describe("PageBuilder canvas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.onDragEnd = null;
    for (const mutation of [
      mocks.add,
      mocks.duplicate,
      mocks.reorder,
      mocks.media,
      mocks.restore,
      mocks.copy,
      mocks.remove,
      mocks.undo,
      mocks.redo,
    ]) {
      mutation.mockResolvedValue({ status: "success", message: "OK" });
    }
  });

  it("searches the real outline labels and changes canvas viewport", () => {
    renderBuilder();
    fireEvent.change(screen.getByPlaceholderText("Rechercher dans les blocs"), {
      target: { value: "contact" },
    });
    expect(screen.getByText("Contact final")).toBeInTheDocument();
    expect(screen.queryByText("Titre principal")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mobile" }));
    expect(screen.getByText("mobile")).toBeInTheDocument();
    fireEvent.change(
      screen.getByRole("slider", { name: "Largeur personnalisée du canvas" }),
      { target: { value: "620" } },
    );
    expect(screen.getByText("620px")).toBeInTheDocument();
  });

  it("persists a block move and exposes undo/redo", async () => {
    renderBuilder();
    mocks.onDragEnd?.({ source: { index: 0 }, destination: { index: 1 } });
    await waitFor(() => expect(mocks.reorder).toHaveBeenCalledOnce());
    const data = mocks.reorder.mock.calls[0]?.[0] as FormData;
    expect(JSON.parse(String(data.get("orderedIds")))).toEqual([
      "section_2",
      "section_1",
    ]);
    fireEvent.click(screen.getByRole("button", { name: "Annuler (Ctrl+Z)" }));
    await waitFor(() => expect(mocks.undo).toHaveBeenCalledOnce());
    fireEvent.click(
      screen.getByRole("button", { name: "Rétablir (Ctrl+Maj+Z)" }),
    );
    await waitFor(() => expect(mocks.redo).toHaveBeenCalledOnce());
  });

  it("adds, edits, duplicates and deletes blocks from the canvas controls", async () => {
    renderBuilder();
    fireEvent.click(screen.getByText("Contact final"));
    expect(
      screen.getByRole("button", { name: /Propriétés/ }),
    ).toHaveClass("is-active");
    expect(screen.getByText("Édition du CTA")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Calques/ }));
    fireEvent.click(screen.getAllByRole("button", { name: "Ajouter" })[0]!);
    await waitFor(() => expect(mocks.add).toHaveBeenCalled());

    fireEvent.click(screen.getAllByRole("button", { name: /Dupliquer/ })[0]!);
    await waitFor(() => expect(mocks.duplicate).toHaveBeenCalled());
    fireEvent.click(screen.getAllByRole("button", { name: /Supprimer/ })[0]!);
    await waitFor(() => expect(mocks.remove).toHaveBeenCalled());
  });

  it("selecting a media slot only selects the block, not the replace dialog", async () => {
    const { container } = renderBuilder();
    const frame = container.querySelector("iframe") as HTMLIFrameElement;
    const previewDocument =
      document.implementation.createHTMLDocument("preview");
    Object.defineProperty(frame, "contentDocument", { value: previewDocument });
    previewDocument.body.innerHTML =
      '<main><section data-cms-section-type="HERO"><button data-cms-media-slot="primary">Image</button></section><section data-cms-section-type="CTA"></section></main>';
    fireEvent.load(frame);
    const mediaSlot = previewDocument.querySelector<HTMLElement>(
      "[data-cms-media-slot]",
    )!;
    mediaSlot.onclick?.({
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as PointerEvent);
    expect(
      screen.queryByRole("dialog", { name: "Choisir un média" }),
    ).not.toBeInTheDocument();
  });

  it("replacing a media slot from the preview canvas opens the picker", async () => {
    const { container } = renderBuilder();
    const frame = container.querySelector("iframe") as HTMLIFrameElement;
    const previewDocument =
      document.implementation.createHTMLDocument("preview");
    Object.defineProperty(frame, "contentDocument", { value: previewDocument });
    previewDocument.body.innerHTML =
      '<main><section data-cms-section-type="HERO"><button data-cms-media-slot="primary">Image</button></section><section data-cms-section-type="CTA"></section></main>';
    fireEvent.load(frame);
    const replaceButton = previewDocument.querySelector<HTMLElement>(
      "[data-cms-media-replace]",
    )!;
    replaceButton.onclick?.({
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as PointerEvent);
    expect(
      await screen.findByRole("dialog", { name: "Choisir un média" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Visuel principal")).toBeInTheDocument();
  });
});

function renderBuilder() {
  return render(
    <PageBuilder
      pageId="page_1"
      revisionId="revision_1"
      revisionVersion={3}
      sectionIds={["section_1", "section_2"]}
      sectionTypes={["HERO", "CTA"]}
      sectionLabels={["Titre principal", "Contact final"]}
      sectionErrors={[[], ["Lien requis."]]}
      sectionVersions={[1, 1]}
      sectionMediaIds={["", ""]}
      sectionGalleryMediaIds={[[], []]}
      mediaAssets={[
        {
          id: "media_1",
          publicUrl: "/image.jpg",
          altText: "Visuel",
          title: "Visuel principal",
          mimeType: "image/jpeg",
        },
      ]}
      editable
      previewUrl="/preview?visualEditor=1"
      publishedPreviewUrl="/published?visualEditor=1"
      targetPages={[]}
      settings={<div>Réglages</div>}
    >
      <div>Édition du hero</div>
      <div>Édition du CTA</div>
    </PageBuilder>,
  );
}
