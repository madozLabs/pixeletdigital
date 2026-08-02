import { redirect } from "next/navigation";

import { prisma } from "@/infrastructure/shared/prisma-client";
import { buildFinanceReport } from "@/modules/finance/application/finance-report-query";
import { PrismaFinanceReportReader } from "@/modules/finance/infrastructure/prisma-finance-report-query";
import { isReportGranularity } from "@/modules/finance/application/period-buckets";
import { formatDate } from "@/shared/format";
import { getWorkspaceRequestContext } from "../../../get-workspace-context";
import { PrintButton } from "../../../billing/_components/print-button";
import { formatXof } from "../../../billing/_lib/money";
import { FinanceCategoryChart, FinanceTrendChart } from "../../finance-charts";

const SCOPE_LABEL: Readonly<Record<string, string>> = {
  "pixel-digital": "Pixel&Digital",
  "kwaliti-print": "Kwaliti Print",
  all: "Pixel&Digital + Kwaliti Print (global)",
};

export default async function FinanceReportPrintPage({
  searchParams,
}: {
  searchParams: Promise<{
    scope?: string;
    from?: string;
    to?: string;
    granularity?: string;
  }>;
}) {
  const context = await getWorkspaceRequestContext();
  if (!context) redirect("/login");

  const { scope: scopeParam, from: fromParam, to: toParam, granularity: granularityParam } =
    await searchParams;
  const scope =
    scopeParam === "pixel-digital" || scopeParam === "kwaliti-print"
      ? scopeParam
      : "all";
  const granularity =
    granularityParam && isReportGranularity(granularityParam)
      ? granularityParam
      : "month";
  const to = toParam ? new Date(`${toParam}T23:59:59.999Z`) : new Date();
  const from = fromParam
    ? new Date(fromParam)
    : new Date(Date.UTC(to.getUTCFullYear(), 0, 1));

  const reportResult = await buildFinanceReport(
    { reportReader: new PrismaFinanceReportReader(prisma) },
    context,
    { scope, from, to, granularity },
  );
  if (!reportResult.ok) {
    return <p role="alert">Accès refusé.</p>;
  }
  const report = reportResult.value;

  return (
    <div className="invoice-print">
      <PrintButton />

      <header className="invoice-print__header">
        <div>
          <p className="invoice-print__brand">Rapport financier</p>
          <p className="invoice-print__meta">{SCOPE_LABEL[scope]}</p>
          <p className="invoice-print__meta">
            Du {formatDate(from)} au {formatDate(to)}
          </p>
        </div>
      </header>

      <table className="invoice-print__table">
        <thead>
          <tr>
            <th>Indicateur</th>
            <th>Montant</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Revenu total</td>
            <td>{formatXof(report.totalRevenueCents)}</td>
          </tr>
          <tr>
            <td>Dont factures encaissées</td>
            <td>{formatXof(report.totalPaidInvoicesCents)}</td>
          </tr>
          <tr>
            <td>Dont recettes hors facture</td>
            <td>{formatXof(report.totalRevenueEntriesCents)}</td>
          </tr>
          <tr>
            <td>Dépenses totales</td>
            <td>{formatXof(report.totalExpenseCents)}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr className="invoice-print__balance-row">
            <td>Net</td>
            <td>{formatXof(report.netCents)}</td>
          </tr>
        </tfoot>
      </table>

      <h2 className="admin-content__subtitle">Revenu et dépenses par période</h2>
      <FinanceTrendChart
        buckets={report.buckets.map((bucket) => ({
          label: bucket.label,
          revenueCents: bucket.revenueCents,
          expenseCents: bucket.expenseCents,
        }))}
      />

      <h2 className="admin-content__subtitle">Dépenses par catégorie</h2>
      <FinanceCategoryChart categories={report.categoryBreakdown} />
    </div>
  );
}
