import type { RequestContext } from "@/shared/request-context";

import {
  forbidden,
  mayAccessFinance,
  requireActiveActor,
} from "./finance-authorization";
import type { ReportGranularity } from "./period-buckets";

export type FinanceReportScope = "pixel-digital" | "kwaliti-print" | "all";

export type FinanceReportFilters = Readonly<{
  scope: FinanceReportScope;
  from: Date;
  to: Date;
  granularity: ReportGranularity;
}>;

export type FinanceReportBucketDto = Readonly<{
  label: string;
  start: Date;
  revenueCents: number;
  expenseCents: number;
}>;

export type FinanceReportCategoryDto = Readonly<{
  categoryId: string;
  categoryLabel: string;
  amountCents: number;
}>;

export type FinanceReportDto = Readonly<{
  totalPaidInvoicesCents: number;
  totalRevenueEntriesCents: number;
  totalRevenueCents: number;
  totalExpenseCents: number;
  netCents: number;
  buckets: readonly FinanceReportBucketDto[];
  categoryBreakdown: readonly FinanceReportCategoryDto[];
}>;

export interface FinanceReportReader {
  build(filters: FinanceReportFilters): Promise<FinanceReportDto>;
}

export async function buildFinanceReport(
  dependencies: Readonly<{ reportReader: FinanceReportReader }>,
  context: RequestContext,
  input: FinanceReportFilters,
) {
  const actor = requireActiveActor(context);
  if (!actor.ok) return actor;
  if (!mayAccessFinance(actor.value)) return forbidden();

  return {
    ok: true as const,
    value: await dependencies.reportReader.build(input),
  };
}
