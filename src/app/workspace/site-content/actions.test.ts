import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  context: vi.fn(),
  pageFind: vi.fn(),
  revisionFind: vi.fn(),
  sectionsFind: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("../get-workspace-context", () => ({
  getWorkspaceRequestContext: mocks.context,
}));
vi.mock("@/modules/audit/infrastructure/record-audit-event", () => ({
  recordAuditEvent: vi.fn(),
}));
vi.mock("./media-storage", () => ({
  deleteWorkspaceMediaFile: vi.fn(),
  storeWorkspaceMediaFile: vi.fn(),
}));
vi.mock("@/infrastructure/shared/prisma-client", () => ({
  prisma: {
    page: { findUniqueOrThrow: mocks.pageFind },
    pageRevision: { findFirst: mocks.revisionFind },
    pageRevisionSection: { findMany: mocks.sectionsFind },
    $transaction: mocks.transaction,
  },
}));

import { addPageBlockAction, reorderPageBlocksAction } from "./actions";
import { IDLE_ACTION_STATE } from "../_components/feedback";

describe("site-content server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.context.mockResolvedValue(editorContext());
    mocks.pageFind.mockResolvedValue({
      id: "page_1",
      worldKey: "pixel-digital",
    });
    mocks.revisionFind.mockResolvedValue({
      id: "revision_1",
      page: { draftRevisionId: "revision_1" },
    });
  });

  it("rejects an unknown block before touching persistence", async () => {
    const state = await addPageBlockAction(
      IDLE_ACTION_STATE,
      form({
        pageId: "page_1",
        revisionId: "revision_1",
        sectionType: "SCRIPT",
      }),
    );
    expect(state).toMatchObject({ status: "error" });
    expect(mocks.pageFind).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated mutations", async () => {
    mocks.context.mockResolvedValue(null);
    const state = await addPageBlockAction(
      IDLE_ACTION_STATE,
      form({ pageId: "page_1", revisionId: "revision_1", sectionType: "HERO" }),
    );
    expect(state).toMatchObject({ status: "error" });
    expect(state.message).toContain("connect");
  });

  it("rejects malformed and duplicate canvas orders", async () => {
    const malformed = await reorderPageBlocksAction(
      form({
        pageId: "page_1",
        revisionId: "revision_1",
        expectedVersion: "1",
        orderedIds: "not-json",
      }),
    );
    const duplicate = await reorderPageBlocksAction(
      form({
        pageId: "page_1",
        revisionId: "revision_1",
        expectedVersion: "1",
        orderedIds: '["a","a"]',
      }),
    );
    expect(malformed).toMatchObject({ status: "error" });
    expect(duplicate).toMatchObject({ status: "error" });
    expect(mocks.pageFind).not.toHaveBeenCalled();
  });

  it("reports a version/content conflict when the submitted order is stale", async () => {
    mocks.sectionsFind.mockResolvedValue([{ id: "a" }, { id: "b" }]);
    const state = await reorderPageBlocksAction(
      form({
        pageId: "page_1",
        revisionId: "revision_1",
        expectedVersion: "1",
        orderedIds: '["a"]',
      }),
    );
    expect(state).toMatchObject({ status: "error" });
    expect(state.message).toContain("modifi");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});

function form(values: Readonly<Record<string, string>>): FormData {
  const result = new FormData();
  for (const [key, value] of Object.entries(values)) result.set(key, value);
  return result;
}

function editorContext() {
  return {
    actor: {
      id: "editor_1",
      active: true,
      role: "EDITOR",
      scopes: [{ type: "WORLD", worldKey: "pixel-digital" }],
    },
    correlationId: "test",
    clock: { now: () => new Date("2026-07-28T00:00:00Z") },
    origin: { channel: "WORKSPACE" },
  };
}
