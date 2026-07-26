import { describe, expect, it, vi } from "vitest";

import type { RequestContext } from "@/shared/request-context";
import { getWorkspaceContent } from "./workspace-content-query";

const context: RequestContext = {
  actor: {
    id: "user_1",
    active: true,
    role: "EDITOR",
    scopes: [{ type: "WORLD", worldKey: "pixel-digital" }],
  },
  correlationId: "test",
  clock: { now: () => new Date("2026-07-25T00:00:00Z") },
  origin: { channel: "WORKSPACE" },
};

describe("getWorkspaceContent", () => {
  it("does not call the reader for an unauthorized world", async () => {
    const read = vi.fn();
    const result = await getWorkspaceContent(
      { workspaceContentReader: { read } },
      context,
      {
        worldKey: "kwaliti-print",
        tab: "pages",
        selectedPageId: "page_other_world",
        skip: 0,
        take: 20,
      },
    );

    expect(result).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    expect(read).not.toHaveBeenCalled();
  });
});
