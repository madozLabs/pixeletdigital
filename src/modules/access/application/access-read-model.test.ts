import { describe, expect, it, vi } from "vitest";

import type { RequestContext } from "@/shared/request-context";
import { listAccessOverview } from "./access-read-model";

const reader = {
  listOverview: vi.fn(),
  listActiveUserOptions: vi.fn(),
};

describe("listAccessOverview", () => {
  it("keeps the administration read restricted to super admins", async () => {
    const context: RequestContext = {
      actor: {
        id: "user_1",
        active: true,
        role: "EDITOR",
        scopes: [{ type: "GLOBAL" }],
      },
      correlationId: "test",
      clock: { now: () => new Date("2026-07-25T00:00:00Z") },
      origin: { channel: "WORKSPACE" },
    };

    const result = await listAccessOverview(
      { accessReadModel: reader },
      context,
      { skip: 0, take: 20 },
    );

    expect(result).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    expect(reader.listOverview).not.toHaveBeenCalled();
  });
});
