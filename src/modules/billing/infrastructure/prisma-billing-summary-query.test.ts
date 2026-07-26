import { describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import { PrismaBillingSummaryReader } from "./prisma-billing-summary-query";

describe("listBillingSummary", () => {
  it("scopes every billing read and paginated list to the selected world", async () => {
    const invoiceFindMany = vi.fn().mockResolvedValue([]);
    const database = {
      client: { findMany: vi.fn().mockResolvedValue([]) },
      quote: {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
      },
      invoice: {
        findMany: invoiceFindMany,
        count: vi.fn().mockResolvedValue(0),
      },
      catalogueItem: { findMany: vi.fn().mockResolvedValue([]) },
    } as unknown as PrismaClient;

    await new PrismaBillingSummaryReader(database).list({
      worldKey: "kwaliti-print",
      skip: 20,
      take: 10,
    });

    expect(database.quote.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { worldKey: "kwaliti-print" },
        skip: 20,
        take: 10,
      }),
    );
    expect(database.invoice.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { worldKey: "kwaliti-print" },
        skip: 20,
        take: 10,
      }),
    );
    expect(invoiceFindMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ where: { worldKey: "kwaliti-print" } }),
    );
  });
});
