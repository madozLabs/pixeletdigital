import type { PrismaClient } from "@/generated/prisma/client";

import type {
  FinanceReportDto,
  FinanceReportFilters,
  FinanceReportReader,
} from "../application/finance-report-query";
import { buildPeriodBuckets, findBucketIndex } from "../application/period-buckets";

// Cash-basis simplification, documented rather than hidden: "revenue" is
// money actually received (Payment rows) plus manual off-invoice entries,
// not invoice totals billed-but-unpaid. Credit notes are not subtracted --
// doing that correctly needs a real refund/cash-out record this schema
// doesn't have yet (see AUDIT_BILLING_MODULE.md on the open fiscal-regime
// question); a documented simplification beats a falsely precise one.
const CATEGORY_DISPLAY_CAP = 7;

export class PrismaFinanceReportReader implements FinanceReportReader {
  constructor(private readonly client: PrismaClient) {}

  async build(filters: FinanceReportFilters): Promise<FinanceReportDto> {
    const worldWhere =
      filters.scope === "all" ? {} : { worldKey: filters.scope };

    const [payments, revenueEntries, expenses] = await Promise.all([
      this.client.payment.findMany({
        where: {
          paidAt: { gte: filters.from, lte: filters.to },
          invoice: worldWhere,
        },
        select: { amountCents: true, paidAt: true },
      }),
      this.client.revenueEntry.findMany({
        where: { revenueDate: { gte: filters.from, lte: filters.to }, ...worldWhere },
        select: { amountCents: true, revenueDate: true },
      }),
      this.client.expense.findMany({
        where: { expenseDate: { gte: filters.from, lte: filters.to }, ...worldWhere },
        include: { category: true },
      }),
    ]);

    // `boundaries` keeps the real [start, end) needed by findBucketIndex;
    // `buckets` is the display-shaped accumulator (label/start + running
    // totals) returned to the caller, built in the same order.
    const boundaries = buildPeriodBuckets(
      filters.from,
      filters.to,
      filters.granularity,
    );
    const buckets = boundaries.map((bucket) => ({
      label: bucket.label,
      start: bucket.start,
      revenueCents: 0,
      expenseCents: 0,
    }));

    for (const payment of payments) {
      const index = findBucketIndex(boundaries, payment.paidAt);
      if (index >= 0) buckets[index].revenueCents += payment.amountCents;
    }
    for (const entry of revenueEntries) {
      const index = findBucketIndex(boundaries, entry.revenueDate);
      if (index >= 0) buckets[index].revenueCents += entry.amountCents;
    }
    for (const expense of expenses) {
      const index = findBucketIndex(boundaries, expense.expenseDate);
      if (index >= 0) buckets[index].expenseCents += expense.amountCents;
    }

    const totalPaidInvoicesCents = payments.reduce(
      (sum, payment) => sum + payment.amountCents,
      0,
    );
    const totalRevenueEntriesCents = revenueEntries.reduce(
      (sum, entry) => sum + entry.amountCents,
      0,
    );
    const totalExpenseCents = expenses.reduce(
      (sum, expense) => sum + expense.amountCents,
      0,
    );
    const totalRevenueCents = totalPaidInvoicesCents + totalRevenueEntriesCents;

    const byCategory = new Map<
      string,
      { categoryId: string; categoryLabel: string; amountCents: number }
    >();
    for (const expense of expenses) {
      const existing = byCategory.get(expense.categoryId);
      if (existing) {
        existing.amountCents += expense.amountCents;
      } else {
        byCategory.set(expense.categoryId, {
          categoryId: expense.categoryId,
          categoryLabel: expense.category.label,
          amountCents: expense.amountCents,
        });
      }
    }
    const rankedCategories = Array.from(byCategory.values()).sort(
      (a, b) => b.amountCents - a.amountCents,
    );
    const categoryBreakdown =
      rankedCategories.length > CATEGORY_DISPLAY_CAP + 1
        ? [
            ...rankedCategories.slice(0, CATEGORY_DISPLAY_CAP),
            {
              categoryId: "__other__",
              categoryLabel: "Autres",
              amountCents: rankedCategories
                .slice(CATEGORY_DISPLAY_CAP)
                .reduce((sum, category) => sum + category.amountCents, 0),
            },
          ]
        : rankedCategories;

    return {
      totalPaidInvoicesCents,
      totalRevenueEntriesCents,
      totalRevenueCents,
      totalExpenseCents,
      netCents: totalRevenueCents - totalExpenseCents,
      buckets,
      categoryBreakdown,
    };
  }
}
