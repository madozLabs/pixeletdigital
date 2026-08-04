"use client";

import Image from "next/image";
import {
  Children,
  startTransition,
  useActionState,
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import {
  DragDropContext,
  Draggable,
  Droppable,
  type DropResult,
} from "@hello-pangea/dnd";
import {
  AlertTriangle,
  Copy,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  GripVertical,
  Layers,
  Lock,
  Monitor,
  MoreVertical,
  Redo2,
  Search,
  SlidersHorizontal,
  Smartphone,
  Tablet,
  Trash2,
  Undo2,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RefreshCw,
  Settings2,
  X,
} from "lucide-react";

import {
  getPageBlockDefinition,
  isPageBlockType,
  PAGE_BLOCK_REGISTRY,
} from "@/modules/content/domain/page-block-registry";
import {
  isSectionImageSettingKey,
  normalizeSectionImageSetting,
  type SectionImageSettingKey,
} from "@/modules/content/domain/section-image-settings";
import { CMS_PREVIEW_READY } from "@/app/_components/cms-preview-bridge";
import type { PresenceViewer } from "../_components/edit-presence-actions";
import {
  Feedback,
  IDLE_ACTION_STATE,
  SubmitButton,
} from "../_components/feedback";
import {
  addPageBlockAction,
  copyPageBlockToPageAction,
  deleteSectionAction,
  detachGlobalComponentInstanceAction,
  duplicatePageBlockAction,
  insertGlobalComponentInstanceAction,
  redoPageEditAction,
  reorderPageBlocksAction,
  restoreLastDeletedBlockAction,
  setPageBlockMediaAction,
  setSectionRestrictionAction,
  undoPageEditAction,
} from "./actions";

// Mirrors ROLE_RANK in actions.ts -- lower number = more privileged. Kept
// client-side only to decide what to render (show the lock, disable the
// form); the actual enforcement lives server-side in
// assertSectionEditAllowed, which this must stay consistent with but never
// substitutes for.
const ROLE_RANK: Readonly<Record<string, number>> = {
  SUPER_ADMIN: 0,
  ADMIN: 1,
  WORLD_MANAGER: 2,
  EDITOR: 3,
  SALES: 4,
  CONTRIBUTOR: 5,
  READER: 6,
};
const RESTRICTABLE_ROLES = ["SUPER_ADMIN", "ADMIN", "WORLD_MANAGER", "EDITOR"] as const;
const PUBLISH_ROLE_RANKS = new Set([
  ROLE_RANK.SUPER_ADMIN,
  ROLE_RANK.ADMIN,
  ROLE_RANK.WORLD_MANAGER,
]);

function actorMeetsRole(
  actorRole: string | null,
  requiredRole: string | null,
): boolean {
  if (!requiredRole) return true;
  const actorRank = ROLE_RANK[actorRole ?? ""] ?? Number.MAX_SAFE_INTEGER;
  const requiredRank = ROLE_RANK[requiredRole] ?? 0;
  return actorRank <= requiredRank;
}

const SIDEBAR_STORAGE_KEY = "cms-page-builder-sidebar-collapsed";

const IMAGE_PREVIEW_VARIABLES: Readonly<
  Record<SectionImageSettingKey, string>
> = {
  imageOpacity: "--cms-image-opacity",
  imageFit: "--cms-image-fit",
  imagePositionX: "--cms-image-position-x",
  imagePositionY: "--cms-image-position-y",
  imageZoom: "--cms-image-zoom",
  imageWidth: "--cms-image-width",
  imageHeight: "--cms-image-height",
  imageOverlayColor: "--cms-image-overlay-color",
  imageOverlayOpacity: "--cms-image-overlay-opacity",
  backgroundImageOpacity: "--cms-background-image-opacity",
  backgroundPositionX: "--cms-background-position-x",
  backgroundPositionY: "--cms-background-position-y",
  backgroundZoom: "--cms-background-zoom",
  backgroundOverlayColor: "--cms-background-overlay-color",
  backgroundOverlayOpacity: "--cms-background-overlay-opacity",
};

const IMAGE_PREVIEW_OVERLAY_COLORS: Readonly<Record<string, string>> = {
  BLACK: "rgb(0 0 0)",
  WHITE: "rgb(255 255 255)",
  ACCENT: "var(--accent)",
};

function readStoredSidebarCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "1";
}

export function PageBuilder({
  pageId,
  worldKey,
  revisionId,
  revisionVersion,
  sectionIds,
  sectionTypes,
  sectionVersions,
  sectionMediaIds,
  sectionGalleryMediaIds,
  mediaAssets,
  editable,
  previewUrl,
  publishedPreviewUrl,
  targetPages,
  sectionLabels,
  sectionErrors,
  sectionGlobalComponentNames,
  sectionRestrictedRoles,
  currentActorRole,
  globalComponents,
  componentLibraryPageId,
  settings,
  children,
}: Readonly<{
  pageId: string;
  worldKey: string;
  revisionId: string | null;
  revisionVersion: number | null;
  sectionIds: readonly string[];
  sectionTypes: readonly string[];
  sectionVersions: readonly number[];
  sectionMediaIds: readonly string[];
  sectionGalleryMediaIds: readonly (readonly string[])[];
  mediaAssets: readonly Readonly<{
    id: string;
    publicUrl: string;
    altText: string;
    title: string;
    mimeType: string;
  }>[];
  editable: boolean;
  previewUrl: string | null;
  publishedPreviewUrl: string | null;
  targetPages: readonly Readonly<{
    id: string;
    title: string;
    draftRevisionId: string | null;
  }>[];
  sectionLabels: readonly string[];
  sectionErrors: readonly (readonly string[])[];
  sectionGlobalComponentNames: readonly (string | null)[];
  sectionRestrictedRoles: readonly (string | null)[];
  currentActorRole: string | null;
  globalComponents: readonly Readonly<{
    id: string;
    name: string;
    sectionType: string;
  }>[];
  componentLibraryPageId: string | null;
  settings: React.ReactNode;
  children: React.ReactNode;
}>) {
  const router = useRouter();
  const originalChildren = Children.toArray(children);
  const childById = new Map(
    sectionIds.map((id, index) => [id, originalChildren[index]]),
  );
  const typeById = new Map(
    sectionIds.map((id, index) => [id, sectionTypes[index]]),
  );
  const versionById = new Map(
    sectionIds.map((id, index) => [id, sectionVersions[index]]),
  );
  const mediaBySectionId = new Map(
    sectionIds.map((id, index) => [id, sectionMediaIds[index]]),
  );
  const galleryBySectionId = new Map(
    sectionIds.map((id, index) => [id, sectionGalleryMediaIds[index] ?? []]),
  );
  const componentNameBySectionId = new Map(
    sectionIds.map((id, index) => [
      id,
      sectionGlobalComponentNames[index] ?? null,
    ]),
  );
  const restrictedRoleBySectionId = new Map(
    sectionIds.map((id, index) => [id, sectionRestrictedRoles[index] ?? null]),
  );
  const canManageRestrictions = PUBLISH_ROLE_RANKS.has(
    ROLE_RANK[currentActorRole ?? ""] ?? Number.MAX_SAFE_INTEGER,
  );
  // Populated from EditPresence's heartbeat (a sibling client component
  // mounted once per page, outside this tree) via a window event -- lets
  // the builder warn "someone else is on this exact block right now"
  // without a shared prop/state path between the two.
  const [activeViewers, setActiveViewers] = useState<
    readonly PresenceViewer[]
  >([]);
  useEffect(() => {
    function handlePresenceUpdated(event: Event) {
      const detail = (event as CustomEvent<{ viewers?: PresenceViewer[] }>)
        .detail;
      setActiveViewers(detail?.viewers ?? []);
    }
    window.addEventListener("cms:presence-updated", handlePresenceUpdated);
    return () =>
      window.removeEventListener(
        "cms:presence-updated",
        handlePresenceUpdated,
      );
  }, []);
  const [orderedIds, setOrderedIds] = useState(sectionIds);
  const [selectedId, setSelectedId] = useState<string | null>(
    sectionIds[0] ?? null,
  );
  // Multi-select is layered on top of the existing single `selectedId`
  // (which still drives the Properties panel, canvas highlight, inline
  // editing, and the media picker unchanged). It only exists to power bulk
  // delete/duplicate from the Calques list -- `selectedId` is always the
  // last-clicked block within the set.
  const [multiSelectedIds, setMultiSelectedIds] = useState<readonly string[]>(
    sectionIds[0] ? [sectionIds[0]] : [],
  );
  const multiSelectAnchorRef = useRef<string | null>(sectionIds[0] ?? null);
  // connectPreview() only reruns when the canvas iframe reloads (a saved
  // mutation), not on every render -- so its element handlers (attached
  // once per reload) would otherwise see whatever multiSelectedIds was at
  // that reload instead of the live value. Mirrored into a ref so the
  // canvas's right-click handler can read the current selection anyway.
  const multiSelectedIdsRef = useRef(multiSelectedIds);
  useEffect(() => {
    multiSelectedIdsRef.current = multiSelectedIds;
  }, [multiSelectedIds]);
  const [bulkMutationState, setBulkMutationState] = useState(IDLE_ACTION_STATE);
  const [isBulkPending, startBulkTransition] = useTransition();
  // Right-click in the canvas -- positioned in the parent document (not the
  // iframe) so it isn't clipped by the frame's own overflow:hidden wrapper.
  const [contextMenu, setContextMenu] = useState<{
    sectionId: string;
    x: number;
    y: number;
  } | null>(null);
  const [panel, setPanel] = useState<"layers" | "properties" | "settings">(
    "layers",
  );
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() =>
    readStoredSidebarCollapsed(),
  );
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const inspectorRef = useRef<HTMLDivElement>(null);
  const [reorderState, setReorderState] = useState(IDLE_ACTION_STATE);
  const [blockMutationState, setBlockMutationState] =
    useState(IDLE_ACTION_STATE);
  const [hasInlineChanges, setHasInlineChanges] = useState(false);
  const [mediaPickerId, setMediaPickerId] = useState<string | null>(null);
  const [mediaPickerSlot, setMediaPickerSlot] = useState<"primary" | "gallery">(
    "primary",
  );
  const [gallerySelection, setGallerySelection] = useState<string[]>([]);
  const [mediaState, setMediaState] = useState(IDLE_ACTION_STATE);
  const [isMediaSaving, startMediaTransition] = useTransition();
  const [viewport, setViewport] = useState<
    "desktop" | "tablet" | "mobile" | "custom"
  >("desktop");
  const [customWidth, setCustomWidth] = useState(1100);
  const [showPublished, setShowPublished] = useState(false);
  const [overflowCount, setOverflowCount] = useState(0);
  const [outlineSearch, setOutlineSearch] = useState("");
  const labelById = new Map(
    sectionIds.map((id, index) => [
      id,
      sectionLabels[index] ?? sectionTypes[index] ?? id,
    ]),
  );
  const errorsById = new Map(
    sectionIds.map((id, index) => [id, sectionErrors[index] ?? []]),
  );

  // The section list itself (add/remove/reorder) only changes when
  // sectionIds' content changes -- a field-only autosave leaves it
  // identical, so this doesn't clobber in-flight local reordering.
  const sectionIdsKey = sectionIds.join("|");
  const [syncedSectionIdsKey, setSyncedSectionIdsKey] =
    useState(sectionIdsKey);
  if (sectionIdsKey !== syncedSectionIdsKey) {
    setSyncedSectionIdsKey(sectionIdsKey);
    setOrderedIds(sectionIds);
    // Drop any multi-selected ids that no longer exist (bulk delete,
    // undo/redo, another editor's change, ...).
    setMultiSelectedIds((current) =>
      current.filter((id) => sectionIds.includes(id)),
    );
    setContextMenu((current) =>
      current && !sectionIds.includes(current.sectionId) ? null : current,
    );
  }

  // Autosave no longer remounts the whole builder (that used to be how the
  // preview iframe picked up saved changes) -- so reload it explicitly
  // whenever a section or the revision itself was saved.
  const savedVersionsKey = `${revisionVersion ?? 0}:${sectionVersions.join(",")}`;
  const isFirstSavedVersionRender = useRef(true);
  useEffect(() => {
    if (isFirstSavedVersionRender.current) {
      isFirstSavedVersionRender.current = false;
      return;
    }
    iframeRef.current?.contentWindow?.location.reload();
  }, [savedVersionsKey]);

  const [undoState, setUndoState] = useState(IDLE_ACTION_STATE);
  const [redoState, setRedoState] = useState(IDLE_ACTION_STATE);
  const undoFormRef = useRef<HTMLFormElement>(null);
  const redoFormRef = useRef<HTMLFormElement>(null);
  function undoAction(formData: FormData) {
    startTransition(async () => {
      const state = await undoPageEditAction(formData);
      setUndoState(state);
      if (state.status === "success") router.refresh();
    });
  }
  function redoAction(formData: FormData) {
    startTransition(async () => {
      const state = await redoPageEditAction(formData);
      setRedoState(state);
      if (state.status === "success") router.refresh();
    });
  }

  const bulkDeleteSelected = useCallback(() => {
    if (!editable || !revisionId || multiSelectedIds.length === 0) return;
    const ids = [...multiSelectedIds];
    startBulkTransition(async () => {
      for (const id of ids) {
        const data = new FormData();
        data.set("pageId", pageId);
        data.set("revisionId", revisionId);
        data.set("id", id);
        const state = await deleteSectionAction(IDLE_ACTION_STATE, data);
        if (state.status === "error") {
          setBulkMutationState(state);
          router.refresh();
          return;
        }
      }
      setMultiSelectedIds([]);
      setBulkMutationState({
        status: "success",
        message: `${ids.length} bloc(s) supprimé(s).`,
      });
      router.refresh();
    });
  }, [editable, revisionId, multiSelectedIds, pageId, router]);

  const bulkDuplicateSelected = useCallback(() => {
    if (!editable || !revisionId || multiSelectedIds.length === 0) return;
    const ids = [...multiSelectedIds];
    startBulkTransition(async () => {
      for (const id of ids) {
        const data = new FormData();
        data.set("pageId", pageId);
        data.set("revisionId", revisionId);
        data.set("sectionId", id);
        const state = await duplicatePageBlockAction(IDLE_ACTION_STATE, data);
        if (state.status === "error") {
          setBulkMutationState(state);
          router.refresh();
          return;
        }
      }
      setBulkMutationState({
        status: "success",
        message: `${ids.length} bloc(s) dupliqué(s).`,
      });
      router.refresh();
    });
  }, [editable, revisionId, multiSelectedIds, pageId, router]);

  // Ctrl/Cmd+Z (undo), Ctrl/Cmd+Shift+Z or +Y (redo), Delete/Backspace
  // (delete selection), Ctrl/Cmd+D (duplicate selection), Escape (clear
  // multi-select) -- all skipped while focus is inside a text field
  // (sidebar or preview iframe) so native browser/field behavior wins
  // there instead.
  useEffect(() => {
    if (!editable) return;
    function isTextEditingTarget(target: Element | null): boolean {
      if (!target) return false;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return true;
      }
      if (target instanceof HTMLIFrameElement) {
        return isTextEditingTarget(target.contentDocument?.activeElement ?? null);
      }
      return false;
    }
    function handleKeydown(event: KeyboardEvent) {
      const key = event.key.toLowerCase();
      const withModifier = event.ctrlKey || event.metaKey;
      if (withModifier && (key === "z" || key === "y")) {
        if (isTextEditingTarget(document.activeElement)) return;
        const isRedo = key === "y" || (key === "z" && event.shiftKey);
        event.preventDefault();
        if (isRedo) redoFormRef.current?.requestSubmit();
        else undoFormRef.current?.requestSubmit();
        return;
      }
      if (withModifier && key === "d") {
        if (isTextEditingTarget(document.activeElement)) return;
        if (multiSelectedIds.length === 0) return;
        event.preventDefault();
        bulkDuplicateSelected();
        return;
      }
      if (key === "delete" || key === "backspace") {
        if (isTextEditingTarget(document.activeElement)) return;
        if (multiSelectedIds.length === 0) return;
        event.preventDefault();
        bulkDeleteSelected();
        return;
      }
      if (key === "escape") {
        if (multiSelectedIds.length <= 1) return;
        setMultiSelectedIds(selectedId ? [selectedId] : []);
      }
    }
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [
    editable,
    multiSelectedIds,
    selectedId,
    bulkDeleteSelected,
    bulkDuplicateSelected,
  ]);

  function toggleSidebar() {
    setIsSidebarCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  }

  function persistOrder(next: string[]) {
    if (!editable || !revisionId || revisionVersion === null) return;
    setOrderedIds(next);
    const data = new FormData();
    data.set("pageId", pageId);
    data.set("revisionId", revisionId);
    data.set("expectedVersion", String(revisionVersion));
    data.set("orderedIds", JSON.stringify(next));
    startTransition(async () => {
      const state = await reorderPageBlocksAction(data);
      setReorderState(state);
      if (state.status === "error") setOrderedIds(sectionIds);
      else router.refresh();
    });
  }

  function detectOverflow() {
    const document = iframeRef.current?.contentDocument;
    if (!document) return;
    const viewportWidth = document.documentElement.clientWidth;
    const overflowing = Array.from(
      document.body.querySelectorAll<HTMLElement>("*"),
    ).filter(
      (element) =>
        element.scrollWidth > Math.max(element.clientWidth, viewportWidth) + 2,
    );
    setOverflowCount(overflowing.length);
  }

  function insertBlock(
    sectionType: (typeof PAGE_BLOCK_REGISTRY)[number]["type"],
    beforeSectionId?: string,
  ) {
    if (!revisionId) return;
    const data = new FormData();
    data.set("pageId", pageId);
    data.set("revisionId", revisionId);
    data.set("sectionType", sectionType);
    if (beforeSectionId) data.set("beforeSectionId", beforeSectionId);
    startTransition(async () => {
      const state = await addPageBlockAction(IDLE_ACTION_STATE, data);
      setBlockMutationState(state);
      if (state.status === "success") router.refresh();
    });
  }

  function syncInspectorField(sectionId: string, field: string, value: string) {
    setSelectedId(sectionId);
    setPanel("properties");
    setHasInlineChanges(true);
    requestAnimationFrame(() => {
      const input = sidebarRef.current?.querySelector<
        HTMLInputElement | HTMLTextAreaElement
      >(`[name="${field}"]`);
      if (input) input.value = value;
    });
  }

  function syncInspectorItemField(
    sectionId: string,
    index: number,
    field: "title" | "text",
    value: string,
  ) {
    setSelectedId(sectionId);
    setPanel("properties");
    setHasInlineChanges(true);
    requestAnimationFrame(() => {
      const input = sidebarRef.current?.querySelector<
        HTMLInputElement | HTMLTextAreaElement
      >(`[data-cms-item-index="${index}"][data-cms-item-field="${field}"]`);
      if (input) input.value = value;
    });
  }

  function previewImageSetting(event: React.FormEvent<HTMLElement>) {
    const target = event.target;
    if (
      !(target instanceof HTMLInputElement) &&
      !(target instanceof HTMLSelectElement)
    ) {
      return;
    }
    if (!isSectionImageSettingKey(target.name) || !selectedId) return;
    const previewValue = imageSettingPreviewValue(target.name, target.value);
    if (!previewValue) return;
    const section =
      iframeRef.current?.contentDocument?.querySelector<HTMLElement>(
        `[data-cms-section-id="${selectedId}"]`,
      );
    if (!section) return;
    const [property, value] = previewValue;
    if (value === null) section.style.removeProperty(property);
    else section.style.setProperty(property, value);
    setHasInlineChanges(true);
  }

  function submitInspectorSection(sectionId: string) {
    requestAnimationFrame(() => {
      sidebarRef.current
        ?.querySelector<HTMLFormElement>(
          `form[data-cms-section-form="${sectionId}"]`,
        )
        ?.requestSubmit();
    });
  }

  function connectPreview() {
    const frame = iframeRef.current;
    const document = frame?.contentDocument;
    if (!document) return;
    const annotated = Array.from(
      document.querySelectorAll<HTMLElement>("main > [data-cms-section-type]"),
    );
    const candidates = annotated.length
      ? annotated
      : Array.from(
          document.querySelectorAll<HTMLElement>(
            "main > section, main > article",
          ),
        );
    document
      .querySelectorAll<HTMLElement>("[data-cms-editor-toolbar]")
      .forEach((toolbar) => toolbar.remove());
    const unassignedIds = [...orderedIds];
    candidates.forEach((element) => {
      const sectionType = element.dataset.cmsSectionType;
      const explicitId = element.dataset.cmsSectionId;
      const explicitIndex = explicitId ? unassignedIds.indexOf(explicitId) : -1;
      const matchIndex =
        explicitIndex >= 0
          ? explicitIndex
          : sectionType
            ? unassignedIds.findIndex((id) =>
                sameSectionType(typeById.get(id), sectionType),
              )
            : 0;
      if (matchIndex < 0) return;
      const [sectionId] = unassignedIds.splice(matchIndex, 1);
      if (!sectionId) return;
      element.dataset.cmsSectionId = sectionId;
      element.style.cursor = "pointer";
      element.style.outlineOffset = "-3px";
      // The idle outline is transparent (see highlightSelectedSection) so a
      // selected block stands out -- without a hover state, nothing signals
      // that a block is clickable until after you've already clicked one.
      element.onmouseenter = () => {
        if (sectionId !== selectedId) {
          element.style.outline = "2px dashed var(--accent)";
        }
      };
      element.onmouseleave = () => {
        if (sectionId !== selectedId) {
          element.style.outline = "2px dashed transparent";
        }
      };
      if (editable) {
        const toolbar = document.createElement("div");
        toolbar.dataset.cmsEditorToolbar = "true";
        toolbar.draggable = true;
        toolbar.textContent = "⋮⋮ Glisser ce bloc";
        toolbar.setAttribute("aria-label", "Déplacer ce bloc dans la page");
        Object.assign(toolbar.style, {
          position: "absolute",
          zIndex: "1000",
          inset: "0.4rem auto auto 0.4rem",
          padding: "0.35rem 0.55rem",
          color: "white",
          background: "var(--accent)",
          borderRadius: "999px",
          fontFamily: "system-ui, sans-serif",
          fontSize: "0.7rem",
          fontWeight: "700",
          cursor: "grab",
          boxShadow: "0 2px 8px rgb(0 0 0 / 22%)",
        });
        if (getComputedStyle(element).position === "static") {
          element.style.position = "relative";
        }
        toolbar.ondragstart = (event) => {
          event.stopPropagation();
          event.dataTransfer?.setData("text/x-cms-section", sectionId);
          if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
        };
        element.ondragover = (event) => {
          if (
            !event.dataTransfer?.types.includes("text/x-cms-section") &&
            !event.dataTransfer?.types.includes("application/x-cms-block")
          )
            return;
          event.preventDefault();
          event.dataTransfer.dropEffect = event.dataTransfer.types.includes(
            "application/x-cms-block",
          )
            ? "copy"
            : "move";
        };
        element.ondrop = (event) => {
          const blockType = event.dataTransfer?.getData(
            "application/x-cms-block",
          );
          if (blockType && isPageBlockType(blockType)) {
            event.preventDefault();
            event.stopPropagation();
            insertBlock(blockType, sectionId);
            return;
          }
          const movedId = event.dataTransfer?.getData("text/x-cms-section");
          if (!movedId || movedId === sectionId) return;
          event.preventDefault();
          event.stopPropagation();
          const next = [...orderedIds];
          const sourceIndex = next.indexOf(movedId);
          const targetIndex = next.indexOf(sectionId);
          if (sourceIndex < 0 || targetIndex < 0) return;
          next.splice(sourceIndex, 1);
          next.splice(targetIndex, 0, movedId);
          persistOrder(next);
        };
        element.prepend(toolbar);
      }
      element.onclick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        selectSection(sectionId);
      };
      if (editable) {
        element.oncontextmenu = (event) => {
          event.preventDefault();
          event.stopPropagation();
          // Right-clicking inside an active multi-selection keeps it intact
          // (so the menu can offer bulk actions); otherwise it behaves like
          // a normal click and selects just this block first.
          const currentMultiSelection = multiSelectedIdsRef.current;
          const isPartOfMultiSelection =
            currentMultiSelection.includes(sectionId) &&
            currentMultiSelection.length > 1;
          if (!isPartOfMultiSelection) selectSection(sectionId);
          const frameRect = iframeRef.current?.getBoundingClientRect();
          if (!frameRect) return;
          const menuWidth = 220;
          const menuHeight = 260;
          const x = Math.min(
            Math.max(8, frameRect.left + event.clientX),
            window.innerWidth - menuWidth - 8,
          );
          const y = Math.min(
            Math.max(8, frameRect.top + event.clientY),
            window.innerHeight - menuHeight - 8,
          );
          setContextMenu({ sectionId, x, y });
        };
      }
      element
        .querySelectorAll<HTMLElement>("[data-cms-field]")
        .forEach((editableField) => {
          const field = editableField.dataset.cmsField;
          if (!field) return;
          editableField.contentEditable = editable ? "true" : "false";
          editableField.spellcheck = true;
          editableField.dataset.cmsInlineEditable = "true";
          editableField.title = editable
            ? "Cliquez puis saisissez votre texte"
            : "";
          editableField.onfocus = () => {
            selectSection(sectionId);
          };
          editableField.oninput = () => {
            syncInspectorField(
              sectionId,
              field,
              readEditableText(editableField, field),
            );
          };
          editableField.onblur = () => submitInspectorSection(sectionId);
          editableField.onkeydown = (event) => {
            if (event.key === "Escape") editableField.blur();
          };
        });
      element
        .querySelectorAll<HTMLElement>("[data-cms-item-field]")
        .forEach((editableItem) => {
          editableItem.contentEditable = editable ? "true" : "false";
          editableItem.spellcheck = true;
          editableItem.dataset.cmsInlineEditable = "true";
          editableItem.title = editable
            ? "Cliquez puis modifiez cet élément"
            : "";
          editableItem.onfocus = () => {
            selectSection(sectionId);
          };
          editableItem.oninput = () => {
            const index = Number(editableItem.dataset.cmsItemIndex);
            const field = editableItem.dataset.cmsItemField;
            if (!Number.isInteger(index) || (field !== "title" && field !== "text")) {
              return;
            }
            syncInspectorItemField(
              sectionId,
              index,
              field,
              editableItem.textContent?.replaceAll("\u00a0", " ").trim() ?? "",
            );
          };
          editableItem.onblur = () => submitInspectorSection(sectionId);
          editableItem.onkeydown = (event) => {
            if (event.key === "Escape") editableItem.blur();
          };
        });
      element
        .querySelectorAll<HTMLElement>("[data-cms-media-slot]")
        .forEach((mediaSlot) => {
          mediaSlot.style.cursor = editable ? "pointer" : "default";
          mediaSlot.title = editable
            ? "Cliquer pour sélectionner ce bloc (recadrage, position, remplacement dans le panneau de gauche)"
            : "";
          // Clicking only selects the block -- it used to jump straight into
          // "replace this image", which assumed that's what you wanted to do
          // with it (as opposed to just repositioning/cropping it via the
          // sidebar's existing sliders). Replacing is now a deliberate
          // secondary action via the pill button below, same pattern as the
          // block's own "glisser ce bloc" handle.
          mediaSlot.onclick = (event) => {
            event.preventDefault();
            event.stopPropagation();
            selectSection(sectionId);
          };
          if (
            editable &&
            !mediaSlot.querySelector("[data-cms-media-replace]")
          ) {
            if (getComputedStyle(mediaSlot).position === "static") {
              mediaSlot.style.position = "relative";
            }
            const replaceButton = document.createElement("button");
            replaceButton.type = "button";
            replaceButton.dataset.cmsMediaReplace = "true";
            replaceButton.textContent = "Remplacer l'image";
            Object.assign(replaceButton.style, {
              position: "absolute",
              zIndex: "1000",
              inset: "auto 0.4rem 0.4rem auto",
              padding: "0.35rem 0.55rem",
              color: "white",
              background: "var(--accent)",
              borderRadius: "999px",
              border: "0",
              fontFamily: "system-ui, sans-serif",
              fontSize: "0.7rem",
              fontWeight: "700",
              cursor: "pointer",
              boxShadow: "0 2px 8px rgb(0 0 0 / 22%)",
            });
            replaceButton.onclick = (event) => {
              event.preventDefault();
              event.stopPropagation();
              selectSection(sectionId);
              const slot =
                mediaSlot.dataset.cmsMediaSlot === "gallery"
                  ? "gallery"
                  : "primary";
              setMediaPickerSlot(slot);
              setGallerySelection([
                ...(galleryBySectionId.get(sectionId) ?? []),
              ]);
              setMediaPickerId(sectionId);
            };
            mediaSlot.appendChild(replaceButton);
          }
        });
    });
    const main = document.querySelector<HTMLElement>("main");
    if (main && editable) {
      main.ondragover = (event) => {
        if (!event.dataTransfer?.types.includes("application/x-cms-block"))
          return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
      };
      main.ondrop = (event) => {
        if (event.target !== main) return;
        const blockType = event.dataTransfer?.getData(
          "application/x-cms-block",
        );
        if (!blockType || !isPageBlockType(blockType)) return;
        event.preventDefault();
        insertBlock(blockType);
      };
    }
    highlightSelectedSection(document, selectedId);
    detectOverflow();
  }

  const previewConnectorRef = useRef(connectPreview);
  useEffect(() => {
    previewConnectorRef.current = connectPreview;
  });
  useEffect(() => {
    function handlePreviewReady(event: MessageEvent) {
      if (
        event.origin !== window.location.origin ||
        event.source !== iframeRef.current?.contentWindow ||
        event.data?.type !== CMS_PREVIEW_READY
      ) {
        return;
      }
      previewConnectorRef.current();
    }
    window.addEventListener("message", handlePreviewReady);
    return () => window.removeEventListener("message", handlePreviewReady);
  }, []);

  function selectSection(id: string) {
    setSelectedId(id);
    setMultiSelectedIds([id]);
    multiSelectAnchorRef.current = id;
    setContextMenu(null);
    setPanel("properties");
    window.dispatchEvent(
      new CustomEvent("cms:section-selected", {
        detail: { sectionId: id, label: labelById.get(id) },
      }),
    );
    const document = iframeRef.current?.contentDocument;
    if (document) {
      highlightSelectedSection(document, id);
      document
        .querySelector<HTMLElement>(`[data-cms-section-id="${id}"]`)
        ?.scrollIntoView?.({ behavior: "smooth", block: "center" });
    }
    // The fields form is appended after the (potentially long) block
    // library and outline list -- without this, clicking a block feels
    // like nothing happened unless you already know to scroll down.
    requestAnimationFrame(() => {
      inspectorRef.current?.scrollIntoView?.({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  // Shift-click extends a contiguous range from the last anchor; Ctrl/Cmd-
  // click toggles one block in or out. A plain click falls back to normal
  // single-select, which also drives the Properties panel/canvas highlight.
  function handleOutlineItemClick(
    id: string,
    event: React.MouseEvent<HTMLButtonElement>,
  ) {
    setContextMenu(null);
    if (event.shiftKey && multiSelectAnchorRef.current) {
      const anchorIndex = orderedIds.indexOf(multiSelectAnchorRef.current);
      const targetIndex = orderedIds.indexOf(id);
      if (anchorIndex >= 0 && targetIndex >= 0) {
        const [start, end] =
          anchorIndex <= targetIndex
            ? [anchorIndex, targetIndex]
            : [targetIndex, anchorIndex];
        setMultiSelectedIds(orderedIds.slice(start, end + 1));
        setSelectedId(id);
        return;
      }
    }
    if (event.ctrlKey || event.metaKey) {
      setMultiSelectedIds((current) => {
        const next = new Set(current);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return orderedIds.filter((oid) => next.has(oid));
      });
      setSelectedId(id);
      multiSelectAnchorRef.current = id;
      return;
    }
    selectSection(id);
  }

  function onDragEnd(result: DropResult) {
    if (
      !editable ||
      !revisionId ||
      revisionVersion === null ||
      !result.destination
    )
      return;
    const next = [...orderedIds];
    const [moved] = next.splice(result.source.index, 1);
    if (!moved) return;
    next.splice(result.destination.index, 0, moved);
    persistOrder(next);
  }

  function saveMedia(mediaId = "", galleryMediaIds?: readonly string[]) {
    if (!mediaPickerId || !revisionId) return;
    const expectedVersion = versionById.get(mediaPickerId);
    if (expectedVersion === undefined) return;
    const data = new FormData();
    data.set("pageId", pageId);
    data.set("revisionId", revisionId);
    data.set("sectionId", mediaPickerId);
    data.set("expectedVersion", String(expectedVersion));
    data.set("slot", mediaPickerSlot);
    data.set("mediaId", mediaId);
    if (mediaPickerSlot === "gallery") {
      data.set("mediaIds", JSON.stringify(galleryMediaIds ?? gallerySelection));
    }
    startMediaTransition(async () => {
      const state = await setPageBlockMediaAction(data);
      setMediaState(state);
      if (state.status === "success") {
        setMediaPickerId(null);
        router.refresh();
      }
    });
  }

  return (
    <div
      className={`cms-visual-builder${
        isSidebarCollapsed ? " cms-visual-builder--sidebar-collapsed" : ""
      }`}
    >
      <aside
        id="cms-page-builder-sidebar"
        ref={sidebarRef}
        className="cms-visual-builder__sidebar"
        onInput={previewImageSetting}
      >
        <div className="cms-visual-builder__tabs">
          <button
            type="button"
            className={panel === "layers" ? "is-active" : ""}
            onClick={() => setPanel("layers")}
          >
            <Layers size={16} /> Calques
          </button>
          <button
            type="button"
            className={panel === "properties" ? "is-active" : ""}
            onClick={() => setPanel("properties")}
          >
            <SlidersHorizontal size={16} /> Propriétés
          </button>
          <button
            type="button"
            className={panel === "settings" ? "is-active" : ""}
            onClick={() => setPanel("settings")}
          >
            <Settings2 size={16} /> Page &amp; SEO
          </button>
        </div>

        {panel === "settings" ? (
          <div className="cms-visual-builder__settings">{settings}</div>
        ) : panel === "layers" ? (
          <>
            {!editable ? (
              <div className="cms-visual-builder__activate">{settings}</div>
            ) : null}
            <div className="cms-visual-builder__library">
              {editable && revisionId ? (
                <BlockLibrary pageId={pageId} revisionId={revisionId} />
              ) : null}
              {editable && revisionId && globalComponents.length > 0 ? (
                <ComponentLibraryPanel
                  pageId={pageId}
                  revisionId={revisionId}
                  components={globalComponents}
                />
              ) : null}
            </div>
            <Feedback state={blockMutationState} />
            <Feedback state={reorderState} />
            <label className="cms-outline-search">
              <Search size={15} />
              <span className="sr-only">Rechercher un bloc</span>
              <input
                type="search"
                placeholder="Rechercher dans les blocs"
                value={outlineSearch}
                onChange={(event) => setOutlineSearch(event.target.value)}
              />
            </label>
            {editable ? (
              <p className="cms-outline-hint">
                Maj+clic pour une plage, Ctrl/Cmd+clic pour ajouter un bloc à
                la sélection.
              </p>
            ) : null}
            <DragDropContext onDragEnd={onDragEnd}>
              <Droppable droppableId="page-blocks" isDropDisabled={!editable}>
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="cms-visual-builder__outline"
                  >
                    {orderedIds
                      .filter((id) =>
                        `${labelById.get(id)} ${typeById.get(id)}`
                          .toLowerCase()
                          .includes(outlineSearch.toLowerCase()),
                      )
                      .map((id) => {
                        const index = orderedIds.indexOf(id);
                        return (
                          <Draggable
                            key={id}
                            draggableId={id}
                            index={index}
                            isDragDisabled={!editable}
                          >
                            {(dragProvided) => (
                              <div
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                className={
                                  multiSelectedIds.includes(id)
                                    ? "cms-outline-item is-selected"
                                    : "cms-outline-item"
                                }
                              >
                                <button
                                  type="button"
                                  className="cms-outline-item__select"
                                  onClick={(event) =>
                                    handleOutlineItemClick(id, event)
                                  }
                                >
                                  <span
                                    {...dragProvided.dragHandleProps}
                                    className="cms-outline-item__handle"
                                  >
                                    <GripVertical size={15} />
                                  </span>
                                  <span>
                                    <small>Bloc {index + 1}</small>
                                    <strong>
                                      {labelById.get(id) ??
                                        `Section ${index + 1}`}
                                    </strong>
                                    {(errorsById.get(id)?.length ?? 0) > 0 ? (
                                      <em className="cms-outline-item__error">
                                        {errorsById.get(id)?.length} erreur(s)
                                      </em>
                                    ) : null}
                                    {activeViewers.some(
                                      (viewer) => viewer.sectionId === id,
                                    ) ? (
                                      <em
                                        className="cms-outline-item__concurrent"
                                        title="Un autre éditeur modifie ce bloc en ce moment"
                                      >
                                        <AlertTriangle size={12} /> en cours
                                      </em>
                                    ) : null}
                                    {restrictedRoleBySectionId.get(id) ? (
                                      <em
                                        className="cms-outline-item__restricted"
                                        title={`Réservé au rôle ${restrictedRoleBySectionId.get(id)} ou plus`}
                                      >
                                        <Lock size={12} /> restreint
                                      </em>
                                    ) : null}
                                  </span>
                                </button>
                                {editable && revisionId ? (
                                  <BlockContextMenu
                                    pageId={pageId}
                                    revisionId={revisionId}
                                    sectionId={id}
                                    index={index}
                                    orderedIds={orderedIds}
                                    targetPages={targetPages}
                                    onMove={persistOrder}
                                  />
                                ) : null}
                              </div>
                            )}
                          </Draggable>
                        );
                      })}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
            {editable && multiSelectedIds.length > 1 ? (
              <div className="cms-bulk-actions">
                <span>{multiSelectedIds.length} blocs sélectionnés</span>
                <div className="cms-bulk-actions__buttons">
                  <button
                    type="button"
                    onClick={bulkDuplicateSelected}
                    disabled={isBulkPending}
                  >
                    <Copy size={14} /> Dupliquer
                  </button>
                  <button
                    type="button"
                    className="is-danger"
                    onClick={bulkDeleteSelected}
                    disabled={isBulkPending}
                  >
                    <Trash2 size={14} /> Supprimer
                  </button>
                </div>
                <Feedback state={bulkMutationState} />
              </div>
            ) : null}
          </>
        ) : (
          <div ref={inspectorRef} className="cms-visual-builder__inspector">
            {!editable ? (
              <div className="cms-visual-builder__activate">{settings}</div>
            ) : null}
            {multiSelectedIds.length > 1 ? (
              <p className="admin-empty">
                {multiSelectedIds.length} blocs sélectionnés. Utilisez
                Dupliquer/Supprimer dans l’onglet Calques, ou cliquez un seul
                bloc pour modifier ses propriétés.
              </p>
            ) : editable &&
              selectedId &&
              revisionId &&
              componentNameBySectionId.get(selectedId) ? (
              <GlobalComponentInstancePanel
                pageId={pageId}
                worldKey={worldKey}
                revisionId={revisionId}
                sectionId={selectedId}
                componentName={componentNameBySectionId.get(selectedId) ?? ""}
                componentLibraryPageId={componentLibraryPageId}
              />
            ) : selectedId && childById.has(selectedId) ? (
              <>
                <div className="cms-visual-builder__inspector-header">
                  <strong>
                    Bloc {orderedIds.indexOf(selectedId) + 1} ·{" "}
                    {labelById.get(selectedId) ?? typeById.get(selectedId)}
                  </strong>
                </div>
                {(() => {
                  const concurrentEditors = activeViewers.filter(
                    (viewer) => viewer.sectionId === selectedId,
                  );
                  if (concurrentEditors.length === 0) return null;
                  const names = concurrentEditors
                    .map((viewer) => viewer.name)
                    .join(", ");
                  return (
                    <p
                      className="cms-concurrent-edit-warning"
                      role="status"
                    >
                      <AlertTriangle size={14} /> {names}{" "}
                      {concurrentEditors.length > 1
                        ? "modifient"
                        : "modifie"}{" "}
                      aussi ce bloc en ce moment. Vos modifications risquent
                      d’écraser les siennes.
                    </p>
                  );
                })()}
                {editable && revisionId && canManageRestrictions ? (
                  <SectionRestrictionForm
                    pageId={pageId}
                    revisionId={revisionId}
                    sectionId={selectedId}
                    currentRestriction={
                      restrictedRoleBySectionId.get(selectedId) ?? null
                    }
                  />
                ) : null}
                {actorMeetsRole(
                  currentActorRole,
                  restrictedRoleBySectionId.get(selectedId) ?? null,
                ) ? (
                  childById.get(selectedId)
                ) : (
                  <p className="cms-section-locked">
                    <Lock size={14} /> Ce bloc est réservé au rôle{" "}
                    {restrictedRoleBySectionId.get(selectedId)} ou plus. Vous
                    ne pouvez pas le modifier.
                  </p>
                )}
              </>
            ) : (
              <p className="admin-empty">
                Cliquez un bloc dans la page ou dans les calques pour
                l’éditer.
              </p>
            )}
          </div>
        )}
      </aside>

      <section className="cms-visual-builder__stage">
        <header className="cms-visual-builder__stage-bar">
          <div className="cms-visual-builder__stage-leading">
            <button
              type="button"
              className="cms-visual-builder__sidebar-toggle"
              aria-controls="cms-page-builder-sidebar"
              aria-expanded={!isSidebarCollapsed}
              title={
                isSidebarCollapsed
                  ? "Afficher le panneau d’édition"
                  : "Masquer le panneau d’édition"
              }
              onClick={toggleSidebar}
            >
              {isSidebarCollapsed ? (
                <PanelLeftOpen size={17} />
              ) : (
                <PanelLeftClose size={17} />
              )}
              <span>
                {isSidebarCollapsed
                  ? "Afficher le panneau"
                  : "Masquer le panneau"}
              </span>
            </button>
            <span className="cms-visual-builder__viewport-label">
              <Monitor size={16} /> Aperçu ordinateur
            </span>
          </div>
          <div
            className="cms-viewport-controls"
            aria-label="Largeur de l’aperçu"
          >
            <button
              type="button"
              aria-label="Ordinateur"
              className={viewport === "desktop" ? "is-active" : ""}
              onClick={() => setViewport("desktop")}
            >
              <Monitor size={16} />
            </button>
            <button
              type="button"
              aria-label="Tablette"
              className={viewport === "tablet" ? "is-active" : ""}
              onClick={() => setViewport("tablet")}
            >
              <Tablet size={16} />
            </button>
            <button
              type="button"
              aria-label="Mobile"
              className={viewport === "mobile" ? "is-active" : ""}
              onClick={() => setViewport("mobile")}
            >
              <Smartphone size={16} />
            </button>
            <input
              aria-label="Largeur personnalisée du canvas"
              type="range"
              min="320"
              max="1440"
              step="10"
              value={customWidth}
              onChange={(event) => {
                setCustomWidth(Number(event.target.value));
                setViewport("custom");
              }}
            />
            <output>
              {viewport === "custom" ? `${customWidth}px` : viewport}
            </output>
          </div>
          <span className="cms-visual-builder__stage-help">
            {!editable
              ? "Créez une version de travail dans Page & SEO pour modifier"
              : hasInlineChanges
                ? "Texte modifi\u00e9 : enregistrez dans le panneau de gauche"
                : "Cliquez un texte pour le modifier directement"}
          </span>
          {previewUrl ? (
            <div>
              {editable && revisionId ? (
                <form ref={undoFormRef} action={undoAction}>
                  <input type="hidden" name="pageId" value={pageId} />
                  <input type="hidden" name="revisionId" value={revisionId} />
                  <button
                    type="submit"
                    aria-label="Annuler (Ctrl+Z)"
                    title="Annuler (Ctrl+Z)"
                  >
                    <Undo2 size={16} />
                  </button>
                  <Feedback state={undoState} />
                </form>
              ) : null}
              {editable && revisionId ? (
                <form ref={redoFormRef} action={redoAction}>
                  <input type="hidden" name="pageId" value={pageId} />
                  <input type="hidden" name="revisionId" value={revisionId} />
                  <button
                    type="submit"
                    aria-label="Rétablir (Ctrl+Maj+Z)"
                    title="Rétablir (Ctrl+Maj+Z)"
                  >
                    <Redo2 size={16} />
                  </button>
                  <Feedback state={redoState} />
                </form>
              ) : null}
              {editable && revisionId ? (
                <RestoreDeletedBlockButton
                  pageId={pageId}
                  revisionId={revisionId}
                />
              ) : null}
              {publishedPreviewUrl ? (
                <button
                  type="button"
                  onClick={() => setShowPublished((value) => !value)}
                >
                  {showPublished ? "Voir brouillon" : "Comparer publié"}
                </button>
              ) : null}
              <button
                type="button"
                aria-label="Actualiser l’aperçu"
                onClick={() =>
                  iframeRef.current?.contentWindow?.location.reload()
                }
              >
                <RefreshCw size={16} />
              </button>
              <a href={previewUrl} target="_blank" rel="noreferrer">
                <ExternalLink size={16} />
                <span className="sr-only">Ouvrir dans un nouvel onglet</span>
              </a>
            </div>
          ) : null}
        </header>
        {mediaPickerId ? (
          <div
            className="cms-canvas-media-picker"
            role="dialog"
            aria-modal="true"
            aria-label="Choisir un média"
          >
            <header>
              <div>
                <strong>
                  {mediaPickerSlot === "gallery"
                    ? "Choisir les images du bloc"
                    : "Choisir l’image du bloc"}
                </strong>
                <span>
                  {mediaPickerSlot === "gallery"
                    ? "Sélectionnez plusieurs images puis appliquez votre choix."
                    : "Le changement apparaîtra aussitôt dans la page."}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setMediaPickerId(null)}
                aria-label="Fermer la médiathèque"
              >
                <X size={18} />
              </button>
            </header>
            <div className="cms-canvas-media-picker__grid">
              <button
                type="button"
                className={
                  mediaPickerSlot === "gallery"
                    ? gallerySelection.length === 0
                      ? "is-selected"
                      : ""
                    : !mediaBySectionId.get(mediaPickerId)
                      ? "is-selected"
                      : ""
                }
                onClick={() =>
                  mediaPickerSlot === "gallery"
                    ? setGallerySelection([])
                    : saveMedia("")
                }
                disabled={isMediaSaving}
              >
                <span className="cms-canvas-media-picker__empty">
                  Aucune image
                </span>
              </button>
              {mediaAssets
                .filter((asset) => asset.mimeType.startsWith("image/"))
                .map((asset) => (
                  <button
                    type="button"
                    key={asset.id}
                    className={
                      mediaPickerSlot === "gallery"
                        ? gallerySelection.includes(asset.id)
                          ? "is-selected"
                          : ""
                        : mediaBySectionId.get(mediaPickerId) === asset.id
                          ? "is-selected"
                          : ""
                    }
                    onClick={() => {
                      if (mediaPickerSlot === "primary") {
                        saveMedia(asset.id);
                        return;
                      }
                      setGallerySelection((current) =>
                        current.includes(asset.id)
                          ? current.filter((id) => id !== asset.id)
                          : [...current, asset.id],
                      );
                    }}
                    disabled={isMediaSaving}
                  >
                    <Image
                      src={asset.publicUrl}
                      alt={asset.altText}
                      width={180}
                      height={120}
                    />
                    <span>{asset.title}</span>
                  </button>
                ))}
            </div>
            {mediaAssets.length === 0 ? (
              <p className="admin-empty">
                La médiathèque ne contient encore aucune image.
              </p>
            ) : null}
            {mediaPickerSlot === "gallery" ? (
              <button
                type="button"
                className="button button--primary cms-canvas-media-picker__apply"
                onClick={() => saveMedia("", gallerySelection)}
                disabled={isMediaSaving}
              >
                Appliquer {gallerySelection.length} image
                {gallerySelection.length > 1 ? "s" : ""}
              </button>
            ) : null}
            <Feedback state={mediaState} />
          </div>
        ) : null}
        {previewUrl ? (
          <div
            className="cms-visual-builder__frame-wrap"
            style={
              {
                "--cms-canvas-width": `${viewport === "desktop" ? 1280 : viewport === "tablet" ? 768 : viewport === "mobile" ? 390 : customWidth}px`,
              } as React.CSSProperties
            }
          >
            <iframe
              ref={iframeRef}
              src={
                showPublished && publishedPreviewUrl
                  ? publishedPreviewUrl
                  : previewUrl
              }
              title="Aperçu fidèle de la page"
              className="cms-visual-builder__frame"
              onLoad={() => {
                connectPreview();
                detectOverflow();
              }}
            />
            {overflowCount > 0 ? (
              <p className="cms-responsive-warning" role="status">
                Attention : {overflowCount} élément(s) semblent déborder à cette
                largeur.
              </p>
            ) : null}
          </div>
        ) : (
          <div className="cms-visual-builder__empty-preview">
            Créez une version de travail pour afficher l’aperçu.
          </div>
        )}
      </section>
      {contextMenu && editable && revisionId
        ? createPortal(
            <CanvasContextMenu
              x={contextMenu.x}
              y={contextMenu.y}
              onClose={() => setContextMenu(null)}
            >
              {multiSelectedIds.includes(contextMenu.sectionId) &&
              multiSelectedIds.length > 1 ? (
                <div className="cms-canvas-context-menu__bulk">
                  <p>{multiSelectedIds.length} blocs sélectionnés</p>
                  <button
                    type="button"
                    disabled={isBulkPending}
                    onClick={() => {
                      bulkDuplicateSelected();
                      setContextMenu(null);
                    }}
                  >
                    <Copy size={14} /> Dupliquer la sélection
                  </button>
                  <button
                    type="button"
                    className="is-danger"
                    disabled={isBulkPending}
                    onClick={() => {
                      bulkDeleteSelected();
                      setContextMenu(null);
                    }}
                  >
                    <Trash2 size={14} /> Supprimer la sélection
                  </button>
                </div>
              ) : (
                <BlockContextMenuActions
                  pageId={pageId}
                  revisionId={revisionId}
                  sectionId={contextMenu.sectionId}
                  index={orderedIds.indexOf(contextMenu.sectionId)}
                  orderedIds={orderedIds}
                  targetPages={targetPages}
                  onMove={persistOrder}
                  onAfterAction={() => setContextMenu(null)}
                />
              )}
            </CanvasContextMenu>,
            document.body,
          )
        : null}
    </div>
  );
}

function RestoreDeletedBlockButton({
  pageId,
  revisionId,
}: Readonly<{ pageId: string; revisionId: string }>) {
  const router = useRouter();
  const [state, setState] = useState(IDLE_ACTION_STATE);
  return (
    <form
      action={(data) =>
        startTransition(async () => {
          const result = await restoreLastDeletedBlockAction(data);
          setState(result);
          if (result.status === "success") router.refresh();
        })
      }
    >
      <input type="hidden" name="pageId" value={pageId} />
      <input type="hidden" name="revisionId" value={revisionId} />
      <button type="submit" aria-label="Restaurer le dernier bloc supprimé">
        <Undo2 size={16} />
      </button>
      <Feedback state={state} />
    </form>
  );
}

function imageSettingPreviewValue(
  key: SectionImageSettingKey,
  rawValue: string,
): readonly [string, string | null] | null {
  const value = normalizeSectionImageSetting(key, rawValue);
  if (value === null) return null;
  if (key === "imageFit") {
    return [IMAGE_PREVIEW_VARIABLES[key], value.toLowerCase()];
  }
  if (key === "backgroundOverlayColor" || key === "imageOverlayColor") {
    const color = IMAGE_PREVIEW_OVERLAY_COLORS[value];
    return color ? [IMAGE_PREVIEW_VARIABLES[key], color] : null;
  }
  if (key === "imageHeight") {
    return [IMAGE_PREVIEW_VARIABLES[key], value === "0" ? null : `${value}px`];
  }
  if (
    key === "imagePositionX" ||
    key === "imagePositionY" ||
    key === "imageWidth" ||
    key === "backgroundPositionX" ||
    key === "backgroundPositionY"
  ) {
    return [IMAGE_PREVIEW_VARIABLES[key], `${value}%`];
  }
  return [IMAGE_PREVIEW_VARIABLES[key], String(Number(value) / 100)];
}

function highlightSelectedSection(
  document: Document,
  selectedId: string | null,
) {
  document
    .querySelectorAll<HTMLElement>("[data-cms-section-id]")
    .forEach((element) => {
      element.style.outline =
        element.dataset.cmsSectionId === selectedId
          ? "3px solid var(--accent)"
          : "2px dashed transparent";
    });
}

function sameSectionType(left: string | undefined, right: string): boolean {
  const normalize = (value: string | undefined) =>
    value === "TEXT" ? "RICH_TEXT" : value;
  return normalize(left) === normalize(right);
}

function readEditableText(element: HTMLElement, field: string): string {
  const directLines = Array.from(element.children).filter(
    (child): child is HTMLElement => child instanceof HTMLElement,
  );
  if (field === "title" && directLines.length > 1) {
    return directLines
      .map((line) => line.textContent?.replaceAll("\u00a0", " ").trim() ?? "")
      .filter(Boolean)
      .join("\n");
  }
  return element.textContent?.replaceAll("\u00a0", " ").trim() ?? "";
}

function BlockLibrary({
  pageId,
  revisionId,
}: Readonly<{ pageId: string; revisionId: string }>) {
  return (
    <details className="cms-block-library" open>
      <summary className="button button--primary">
        <Plus size={16} /> Bibliothèque de blocs
      </summary>
      <div className="cms-block-library__panel">
        <div className="cms-block-library__heading">
          <strong>Bibliothèque de blocs</strong>
          <span>
            Glissez un bloc à l’endroit voulu dans la page, ou cliquez sur
            Ajouter.
          </span>
        </div>
        <div className="cms-block-library__grid">
          {PAGE_BLOCK_REGISTRY.map((block) => (
            <AddBlockButton
              key={block.type}
              pageId={pageId}
              revisionId={revisionId}
              block={block}
            />
          ))}
        </div>
      </div>
    </details>
  );
}

function SectionRestrictionForm({
  pageId,
  revisionId,
  sectionId,
  currentRestriction,
}: Readonly<{
  pageId: string;
  revisionId: string;
  sectionId: string;
  currentRestriction: string | null;
}>) {
  const router = useRouter();
  const [state, action] = useActionState(
    setSectionRestrictionAction,
    IDLE_ACTION_STATE,
  );
  useEffect(() => {
    if (state.status === "success") router.refresh();
  }, [router, state.status]);
  return (
    <form action={action} className="cms-section-restriction">
      <input type="hidden" name="pageId" value={pageId} />
      <input type="hidden" name="revisionId" value={revisionId} />
      <input type="hidden" name="sectionId" value={sectionId} />
      <label>
        <Lock size={13} /> Restreindre ce bloc
        <select name="restrictedRole" defaultValue={currentRestriction ?? ""}>
          <option value="">Aucune restriction</option>
          {RESTRICTABLE_ROLES.map((role) => (
            <option key={role} value={role}>
              {role} ou plus
            </option>
          ))}
        </select>
      </label>
      <SubmitButton>Appliquer</SubmitButton>
      <Feedback state={state} />
    </form>
  );
}

function GlobalComponentInstancePanel({
  pageId,
  worldKey,
  revisionId,
  sectionId,
  componentName,
  componentLibraryPageId,
}: Readonly<{
  pageId: string;
  worldKey: string;
  revisionId: string;
  sectionId: string;
  componentName: string;
  componentLibraryPageId: string | null;
}>) {
  const router = useRouter();
  const [state, action] = useActionState(
    detachGlobalComponentInstanceAction,
    IDLE_ACTION_STATE,
  );
  useEffect(() => {
    if (state.status === "success") router.refresh();
  }, [router, state.status]);
  return (
    <div className="cms-component-instance-panel">
      <p>
        Ce bloc est le composant global <strong>{componentName}</strong>. Le
        modifier changera son affichage sur toutes les pages qui
        l’utilisent.
      </p>
      {componentLibraryPageId ? (
        <a
          className="button button--primary"
          href={`/workspace/site-content/pages/${componentLibraryPageId}/edit?world=${worldKey}`}
        >
          Modifier le composant
        </a>
      ) : null}
      <form action={action}>
        <input type="hidden" name="pageId" value={pageId} />
        <input type="hidden" name="revisionId" value={revisionId} />
        <input type="hidden" name="sectionId" value={sectionId} />
        <SubmitButton>Détacher (rendre indépendant)</SubmitButton>
        <Feedback state={state} />
      </form>
    </div>
  );
}

function ComponentLibraryPanel({
  pageId,
  revisionId,
  components,
}: Readonly<{
  pageId: string;
  revisionId: string;
  components: readonly Readonly<{
    id: string;
    name: string;
    sectionType: string;
  }>[];
}>) {
  return (
    <details className="cms-block-library cms-component-library">
      <summary className="button">
        <Plus size={16} /> Composants globaux
      </summary>
      <div className="cms-block-library__panel">
        <div className="cms-block-library__heading">
          <strong>Composants globaux</strong>
          <span>
            Un composant modifié une fois change instantanément sur toutes
            les pages qui l’utilisent.
          </span>
        </div>
        <div className="cms-block-library__grid">
          {components.map((component) => (
            <AddComponentInstanceButton
              key={component.id}
              pageId={pageId}
              revisionId={revisionId}
              component={component}
            />
          ))}
        </div>
      </div>
    </details>
  );
}

function AddComponentInstanceButton({
  pageId,
  revisionId,
  component,
}: Readonly<{
  pageId: string;
  revisionId: string;
  component: Readonly<{ id: string; name: string; sectionType: string }>;
}>) {
  const router = useRouter();
  const [state, action] = useActionState(
    insertGlobalComponentInstanceAction,
    IDLE_ACTION_STATE,
  );
  useEffect(() => {
    if (state.status === "success") router.refresh();
  }, [router, state.status]);
  return (
    <form action={action} className="cms-block-library__item">
      <input type="hidden" name="pageId" value={pageId} />
      <input type="hidden" name="revisionId" value={revisionId} />
      <input type="hidden" name="componentId" value={component.id} />
      <span className="cms-block-library__category">COMPOSANT</span>
      <strong>{component.name}</strong>
      <p>
        {getPageBlockDefinition(component.sectionType)?.label ??
          component.sectionType}
      </p>
      <SubmitButton>Ajouter</SubmitButton>
      <Feedback state={state} />
    </form>
  );
}

function AddBlockButton({
  pageId,
  revisionId,
  block,
}: Readonly<{
  pageId: string;
  revisionId: string;
  block: (typeof PAGE_BLOCK_REGISTRY)[number];
}>) {
  const router = useRouter();
  const [state, action] = useActionState(addPageBlockAction, IDLE_ACTION_STATE);
  useEffect(() => {
    if (state.status === "success") router.refresh();
  }, [router, state.status]);
  return (
    <form
      action={action}
      className="cms-block-library__item"
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData("application/x-cms-block", block.type);
        event.dataTransfer.effectAllowed = "copy";
      }}
    >
      <input type="hidden" name="pageId" value={pageId} />
      <input type="hidden" name="revisionId" value={revisionId} />
      <input type="hidden" name="sectionType" value={block.type} />
      <span className="cms-block-library__category">{block.category}</span>
      <strong>{block.label}</strong>
      <p>{block.description}</p>
      <SubmitButton>Ajouter</SubmitButton>
      <Feedback state={state} />
    </form>
  );
}

function DuplicateBlockButton({
  pageId,
  revisionId,
  sectionId,
  onAfterAction,
}: Readonly<{
  pageId: string;
  revisionId: string;
  sectionId: string;
  onAfterAction?: () => void;
}>) {
  const router = useRouter();
  const [state, action] = useActionState(
    duplicatePageBlockAction,
    IDLE_ACTION_STATE,
  );
  useEffect(() => {
    if (state.status === "success") {
      router.refresh();
      onAfterAction?.();
    }
  }, [router, state.status, onAfterAction]);
  return (
    <form action={action} className="cms-builder__duplicate">
      <input type="hidden" name="pageId" value={pageId} />
      <input type="hidden" name="revisionId" value={revisionId} />
      <input type="hidden" name="sectionId" value={sectionId} />
      <button type="submit" className="admin-table__action">
        <Copy size={15} /> Dupliquer
      </button>
      <Feedback state={state} />
    </form>
  );
}

function BlockContextMenu({
  pageId,
  revisionId,
  sectionId,
  index,
  orderedIds,
  targetPages,
  onMove,
}: Readonly<{
  pageId: string;
  revisionId: string;
  sectionId: string;
  index: number;
  orderedIds: readonly string[];
  targetPages: readonly Readonly<{ id: string; title: string }>[];
  onMove: (ids: string[]) => void;
}>) {
  return (
    <details className="cms-block-context-menu">
      <summary aria-label="Actions du bloc">
        <MoreVertical size={16} />
      </summary>
      <BlockContextMenuActions
        pageId={pageId}
        revisionId={revisionId}
        sectionId={sectionId}
        index={index}
        orderedIds={orderedIds}
        targetPages={targetPages}
        onMove={onMove}
      />
    </details>
  );
}

// Shared by the outline's "Actions du bloc" disclosure (above) and the
// canvas's right-click floating menu (CanvasContextMenu, below) so both
// surfaces stay behind the same move/duplicate/copy/delete logic.
function BlockContextMenuActions({
  pageId,
  revisionId,
  sectionId,
  index,
  orderedIds,
  targetPages,
  onMove,
  onAfterAction,
}: Readonly<{
  pageId: string;
  revisionId: string;
  sectionId: string;
  index: number;
  orderedIds: readonly string[];
  targetPages: readonly Readonly<{ id: string; title: string }>[];
  onMove: (ids: string[]) => void;
  onAfterAction?: () => void;
}>) {
  const router = useRouter();
  const [deleteState, deleteAction] = useActionState(
    deleteSectionAction,
    IDLE_ACTION_STATE,
  );
  const [copyState, copyAction] = useActionState(
    copyPageBlockToPageAction,
    IDLE_ACTION_STATE,
  );
  useEffect(() => {
    if (deleteState.status === "success" || copyState.status === "success") {
      router.refresh();
      onAfterAction?.();
    }
  }, [copyState.status, deleteState.status, router, onAfterAction]);
  function move(offset: number) {
    const target = index + offset;
    if (target < 0 || target >= orderedIds.length) return;
    const next = [...orderedIds];
    const [item] = next.splice(index, 1);
    if (!item) return;
    next.splice(target, 0, item);
    onMove(next);
    onAfterAction?.();
  }
  return (
    <div className="cms-block-context-menu__actions">
      <button type="button" onClick={() => move(-1)} disabled={index === 0}>
        <ChevronUp size={14} /> Monter
      </button>
      <button
        type="button"
        onClick={() => move(1)}
        disabled={index === orderedIds.length - 1}
      >
        <ChevronDown size={14} /> Descendre
      </button>
      <DuplicateBlockButton
        pageId={pageId}
        revisionId={revisionId}
        sectionId={sectionId}
        onAfterAction={onAfterAction}
      />
      {targetPages.length ? (
        <form action={copyAction}>
          <input type="hidden" name="pageId" value={pageId} />
          <input type="hidden" name="revisionId" value={revisionId} />
          <input type="hidden" name="sectionId" value={sectionId} />
          <select
            name="targetPageId"
            aria-label="Page de destination"
            required
            defaultValue=""
          >
            <option value="" disabled>
              Copier vers…
            </option>
            {targetPages.map((page) => (
              <option key={page.id} value={page.id}>
                {page.title}
              </option>
            ))}
          </select>
          <button type="submit">
            <Copy size={14} /> Copier
          </button>
          <Feedback state={copyState} />
        </form>
      ) : null}
      <form action={deleteAction}>
        <input type="hidden" name="pageId" value={pageId} />
        <input type="hidden" name="revisionId" value={revisionId} />
        <input type="hidden" name="id" value={sectionId} />
        <button type="submit" className="is-danger">
          <Trash2 size={14} /> Supprimer
        </button>
        <Feedback state={deleteState} />
      </form>
    </div>
  );
}

// Floating menu portaled to document.body so it isn't clipped by the
// canvas frame's overflow:hidden wrapper. Closes on outside click, Escape,
// or after any action inside it completes.
function CanvasContextMenu({
  x,
  y,
  onClose,
  children,
}: Readonly<{
  x: number;
  y: number;
  onClose: () => void;
  children: React.ReactNode;
}>) {
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) onClose();
    }
    function handleKeydown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeydown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeydown);
    };
  }, [onClose]);
  return (
    <div
      ref={menuRef}
      role="menu"
      className="cms-canvas-context-menu"
      style={{ left: x, top: y }}
    >
      {children}
    </div>
  );
}
