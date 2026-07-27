import { describe, expect, it, vi } from "vitest";

import type { Clock } from "@/shared/clock";
import type { RequestContext } from "@/shared/request-context";

import {
  countWorkspaceEnquiries,
  type WorkspaceEnquiryReader,
} from "./workspace-enquiry-query";

const clock: Clock = {
  now: () => new Date("2026-07-27T00:00:00.000Z"),
};

function context(role: "SUPER_ADMIN" | "EDITOR" = "SUPER_ADMIN") {
  return {
    actor: {
      id: "user_01",
      active: true,
      role,
      scopes: [{ type: "GLOBAL" as const }],
    },
    correlationId: "correlation_01",
    clock,
    origin: { channel: "WORKSPACE" as const },
  } satisfies RequestContext;
}

describe("countWorkspaceEnquiries", () => {
  it("returns the scoped enquiry count for an authorized actor", async () => {
    const reader: WorkspaceEnquiryReader = {
      countByWorld: vi.fn().mockResolvedValue(7),
    };

    const result = await countWorkspaceEnquiries(
      { workspaceEnquiryReader: reader },
      context(),
      { worldKey: "pixel-digital" },
    );

    expect(result).toEqual({ ok: true, value: 7 });
    expect(reader.countByWorld).toHaveBeenCalledWith("pixel-digital");
  });

  it("does not query the dependency when the actor is forbidden", async () => {
    const reader: WorkspaceEnquiryReader = {
      countByWorld: vi.fn().mockResolvedValue(7),
    };

    const result = await countWorkspaceEnquiries(
      { workspaceEnquiryReader: reader },
      context("EDITOR"),
      { worldKey: "pixel-digital" },
    );

    expect(result).toMatchObject({
      ok: false,
      error: { code: "FORBIDDEN" },
    });
    expect(reader.countByWorld).not.toHaveBeenCalled();
  });

  it("returns a dependency error instead of crashing the workspace", async () => {
    const connectionError = new Error("Connection terminated unexpectedly");
    const reader: WorkspaceEnquiryReader = {
      countByWorld: vi.fn().mockRejectedValue(connectionError),
    };
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const result = await countWorkspaceEnquiries(
      { workspaceEnquiryReader: reader },
      context(),
      { worldKey: "kwaliti-print" },
    );

    expect(result).toMatchObject({
      ok: false,
      error: { code: "DEPENDENCY_UNAVAILABLE" },
    });
    expect(consoleError).toHaveBeenCalledWith(
      "Failed to count workspace enquiries",
      expect.objectContaining({
        correlationId: "correlation_01",
        worldKey: "kwaliti-print",
        error: {
          name: "Error",
          message: "Connection terminated unexpectedly",
        },
      }),
    );
    consoleError.mockRestore();
  });
});
