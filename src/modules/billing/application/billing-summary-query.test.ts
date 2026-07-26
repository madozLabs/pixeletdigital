import { describe, expect, it, vi } from "vitest";

import type { RequestContext } from "@/shared/request-context";
import { listBillingSummary } from "./billing-summary-query";

function context(worldKey: string): RequestContext {
  return {
    actor: {
      id: "user_1",
      active: true,
      role: "ADMIN",
      scopes: [{ type: "WORLD", worldKey }],
    },
    correlationId: "test",
    clock: { now: () => new Date("2026-07-25T00:00:00Z") },
    origin: { channel: "WORKSPACE" },
  };
}

describe("listBillingSummary", () => {
  it("rejects a read outside the actor world scope", async () => {
    const list = vi.fn();
    const result = await listBillingSummary(
      { billingSummaryReader: { list } },
      context("pixel-digital"),
      { worldKey: "kwaliti-print", skip: 0, take: 20 },
    );

    expect(result).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    expect(list).not.toHaveBeenCalled();
  });
});
