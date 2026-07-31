import Link from "next/link";
import { redirect } from "next/navigation";

import { prisma } from "@/infrastructure/shared/prisma-client";
import { buildFinanceReport } from "@/modules/finance/application/finance-report-query";
import {
  listActiveExpenseCategories,
  listAllExpenseCategories,
} from "@/modules/finance/application/expense-category-use-cases";
import { listExpensesByWorld } from "@/modules/finance/application/expense-use-cases";
import { listRevenueEntriesByWorld } from "@/modules/finance/application/revenue-entry-use-cases";
import { PrismaExpenseCategoryRepository } from "@/modules/finance/infrastructure/prisma-expense-category-repository";
import { PrismaExpenseRepository } from "@/modules/finance/infrastructure/prisma-expense-repository";
import { PrismaFinanceReportReader } from "@/modules/finance/infrastructure/prisma-finance-report-query";
import { PrismaRevenueEntryRepository } from "@/modules/finance/infrastructure/prisma-revenue-entry-repository";
import { PrismaWorldRepository } from "@/modules/worlds/infrastructure/prisma-world-repository";
import { isReportGranularity } from "@/modules/finance/application/period-buckets";
import { parsePage, toSkipTake } from "@/shared/pagination";
import { formatDate } from "@/shared/format";
import { Pagination } from "../_components/pagination";
import { getWorkspaceRequestContext } from "../get-workspace-context";
import { formatXof } from "../billing/_lib/money";
import {
  ArchiveExpenseCategoryForm,
  CreateExpenseCategoryForm,
  DeleteExpenseForm,
  DeleteRevenueEntryForm,
  RecordExpenseForm,
  RecordRevenueEntryForm,
} from "./finance-forms";
import { FinanceCategoryChart, FinanceTrendChart } from "./finance-charts";

const FINANCE_ROLES = ["SUPER_ADMIN", "ADMIN", "WORLD_MANAGER"] as const;
const TABS = [
  { id: "report", label: "Rapport" },
  { id: "expenses", label: "Dépenses" },
  { id: "revenue", label: "Recettes hors facture" },
  { id: "categories", label: "Catégories" },
] as const;

function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export default async function WorkspaceFinancesPage({
  searchParams,
}: {
  searchParams: Promise<{
    world?: string;
    tab?: string;
    scope?: string;
    from?: string;
    to?: string;
    granularity?: string;
    page?: string;
  }>;
}) {
  const context = await getWorkspaceRequestContext();
  if (!context) redirect("/login");
  if (
    !context.actor?.role ||
    !FINANCE_ROLES.includes(context.actor.role as (typeof FINANCE_ROLES)[number])
  ) {
    return (
      <p role="alert">Vous n&apos;êtes pas autorisé à consulter les finances.</p>
    );
  }

  const {
    world,
    tab,
    scope: scopeParam,
    from: fromParam,
    to: toParam,
    granularity: granularityParam,
    page: pageParam,
  } = await searchParams;
  const worldKey = world ?? "pixel-digital";
  const activeTab = TABS.find((item) => item.id === tab)?.id ?? "report";
  const scope =
    scopeParam === "pixel-digital" || scopeParam === "kwaliti-print" || scopeParam === "all"
      ? scopeParam
      : "all";
  const granularity = granularityParam && isReportGranularity(granularityParam)
    ? granularityParam
    : "month";

  const todayEnd = new Date();
  const defaultFrom = new Date(Date.UTC(todayEnd.getUTCFullYear(), 0, 1));
  const from = fromParam ? new Date(fromParam) : defaultFrom;
  const to = toParam ? new Date(`${toParam}T23:59:59.999Z`) : todayEnd;

  const categoriesResult = await listActiveExpenseCategories(
    { categories: new PrismaExpenseCategoryRepository(prisma) },
    context,
  );
  const categories = categoriesResult.ok ? categoriesResult.value : [];

  if (activeTab === "report") {
    const reportResult = await buildFinanceReport(
      { reportReader: new PrismaFinanceReportReader(prisma) },
      context,
      { scope, from, to, granularity },
    );
    if (!reportResult.ok) return <p role="alert">Accès refusé.</p>;
    const report = reportResult.value;

    return (
      <>
        <FinancesHeader worldKey={worldKey} activeTab={activeTab} />
        <ReportFilters
          worldKey={worldKey}
          scope={scope}
          from={from}
          to={to}
          granularity={granularity}
        />
        <div className="dashboard-grid">
          <StatTile
            label="Revenu"
            value={formatXof(report.totalRevenueCents)}
            tone="good"
          />
          <StatTile
            label="Dépenses"
            value={formatXof(report.totalExpenseCents)}
            tone="critical"
          />
          <StatTile
            label="Net"
            value={formatXof(report.netCents)}
            tone={report.netCents >= 0 ? "good" : "critical"}
          />
        </div>
        <p className="admin-table__note">
          Dont {formatXof(report.totalPaidInvoicesCents)} de factures encaissées
          et {formatXof(report.totalRevenueEntriesCents)} de recettes hors
          facture.
        </p>

        <section className="admin-form-card">
          <h2 className="admin-content__subtitle">
            Revenu et dépenses par période
          </h2>
          <FinanceTrendChart
            buckets={report.buckets.map((bucket) => ({
              label: bucket.label,
              revenueCents: bucket.revenueCents,
              expenseCents: bucket.expenseCents,
            }))}
          />
        </section>

        <section className="admin-form-card">
          <h2 className="admin-content__subtitle">Dépenses par catégorie</h2>
          <FinanceCategoryChart categories={report.categoryBreakdown} />
        </section>

        <div className="admin-table__actions">
          <Link
            className="admin-table__action"
            href={`/workspace/finances/report/print?scope=${scope}&from=${toDateInputValue(from)}&to=${toDateInputValue(to)}&granularity=${granularity}`}
          >
            Imprimer ce rapport
          </Link>
        </div>
      </>
    );
  }

  if (activeTab === "expenses") {
    const pageParams = parsePage(pageParam);
    const { skip, take } = toSkipTake(pageParams);
    const expensesResult = await listExpensesByWorld(
      {
        expenses: new PrismaExpenseRepository(prisma),
        categories: new PrismaExpenseCategoryRepository(prisma),
        worlds: new PrismaWorldRepository(prisma),
      },
      context,
      { worldKey, skip, take },
    );
    if (!expensesResult.ok) return <p role="alert">Accès refusé.</p>;
    const allCategoriesForLabels = await listAllExpenseCategories(
      { categories: new PrismaExpenseCategoryRepository(prisma) },
      context,
    );
    const categoryLabelById = new Map(
      (allCategoriesForLabels.ok ? allCategoriesForLabels.value : categories).map(
        (c) => [c.id, c.label],
      ),
    );
    const { items: expenses, total } = expensesResult.value;
    const totalPages = Math.max(1, Math.ceil(total / pageParams.pageSize));

    return (
      <>
        <FinancesHeader worldKey={worldKey} activeTab={activeTab} />
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Libellé</th>
                <th>Catégorie</th>
                <th>Montant</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {expenses.length === 0 ? (
                <tr>
                  <td colSpan={5} className="admin-empty">
                    Aucune dépense.
                  </td>
                </tr>
              ) : null}
              {expenses.map((expense) => (
                <tr key={expense.id}>
                  <td>{formatDate(expense.expenseDate)}</td>
                  <td>{expense.label}</td>
                  <td>{categoryLabelById.get(expense.categoryId) ?? "—"}</td>
                  <td>{formatXof(expense.amountCents)}</td>
                  <td>
                    <DeleteExpenseForm expenseId={expense.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination
          basePath="/workspace/finances"
          searchParams={{ world: worldKey, tab: "expenses" }}
          page={pageParams.page}
          totalPages={totalPages}
          total={total}
        />
        <h2 className="admin-content__subtitle">Nouvelle dépense</h2>
        {categories.length === 0 ? (
          <p className="admin-empty">
            Créez d&apos;abord une catégorie dans l&apos;onglet Catégories.
          </p>
        ) : (
          <RecordExpenseForm worldKey={worldKey} categories={categories} />
        )}
      </>
    );
  }

  if (activeTab === "revenue") {
    const pageParams = parsePage(pageParam);
    const { skip, take } = toSkipTake(pageParams);
    const revenueResult = await listRevenueEntriesByWorld(
      {
        revenueEntries: new PrismaRevenueEntryRepository(prisma),
        worlds: new PrismaWorldRepository(prisma),
      },
      context,
      { worldKey, skip, take },
    );
    if (!revenueResult.ok) return <p role="alert">Accès refusé.</p>;
    const { items: entries, total } = revenueResult.value;
    const totalPages = Math.max(1, Math.ceil(total / pageParams.pageSize));

    return (
      <>
        <FinancesHeader worldKey={worldKey} activeTab={activeTab} />
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Libellé</th>
                <th>Montant</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={4} className="admin-empty">
                    Aucune recette hors facture.
                  </td>
                </tr>
              ) : null}
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td>{formatDate(entry.revenueDate)}</td>
                  <td>{entry.label}</td>
                  <td>{formatXof(entry.amountCents)}</td>
                  <td>
                    <DeleteRevenueEntryForm entryId={entry.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination
          basePath="/workspace/finances"
          searchParams={{ world: worldKey, tab: "revenue" }}
          page={pageParams.page}
          totalPages={totalPages}
          total={total}
        />
        <h2 className="admin-content__subtitle">Nouvelle recette</h2>
        <RecordRevenueEntryForm worldKey={worldKey} />
      </>
    );
  }

  // categories
  const allCategoriesResult = await listAllExpenseCategories(
    { categories: new PrismaExpenseCategoryRepository(prisma) },
    context,
  );
  const allCategories = allCategoriesResult.ok ? allCategoriesResult.value : [];

  return (
    <>
      <FinancesHeader worldKey={worldKey} activeTab={activeTab} />
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Libellé</th>
              <th>Statut</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {allCategories.length === 0 ? (
              <tr>
                <td colSpan={3} className="admin-empty">
                  Aucune catégorie.
                </td>
              </tr>
            ) : null}
            {allCategories.map((category) => (
              <tr key={category.id}>
                <td>{category.label}</td>
                <td>{category.status === "ACTIVE" ? "Active" : "Archivée"}</td>
                <td>
                  {category.status === "ACTIVE" ? (
                    <ArchiveExpenseCategoryForm
                      categoryId={category.id}
                      version={category.version}
                    />
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <CreateExpenseCategoryForm />
    </>
  );
}

function FinancesHeader({
  worldKey,
  activeTab,
}: Readonly<{ worldKey: string; activeTab: string }>) {
  return (
    <>
      <div className="admin-page-heading">
        <div>
          <h1 className="admin-content__title">Finances</h1>
          <p className="admin-content__lede">
            Dépenses, recettes hors facture et rapport financier.
          </p>
        </div>
      </div>
      <div className="admin-tabs" role="tablist">
        {TABS.map((item) => (
          <Link
            key={item.id}
            href={`/workspace/finances?world=${worldKey}&tab=${item.id}`}
            role="tab"
            aria-selected={item.id === activeTab}
            className={
              item.id === activeTab
                ? "admin-tabs__item admin-tabs__item--active"
                : "admin-tabs__item"
            }
          >
            {item.label}
          </Link>
        ))}
      </div>
    </>
  );
}

function ReportFilters({
  worldKey,
  scope,
  from,
  to,
  granularity,
}: Readonly<{
  worldKey: string;
  scope: string;
  from: Date;
  to: Date;
  granularity: string;
}>) {
  return (
    <form className="billing-filters" method="get">
      <input type="hidden" name="world" value={worldKey} />
      <input type="hidden" name="tab" value="report" />
      <label>
        Univers
        <select name="scope" defaultValue={scope}>
          <option value="all">Global (les deux)</option>
          <option value="pixel-digital">Pixel&amp;Digital</option>
          <option value="kwaliti-print">Kwaliti Print</option>
        </select>
      </label>
      <label>
        Du
        <input type="date" name="from" defaultValue={toDateInputValue(from)} />
      </label>
      <label>
        Au
        <input type="date" name="to" defaultValue={toDateInputValue(to)} />
      </label>
      <label>
        Regroupement
        <select name="granularity" defaultValue={granularity}>
          <option value="day">Jour</option>
          <option value="week">Semaine</option>
          <option value="month">Mois</option>
          <option value="year">Année</option>
        </select>
      </label>
      <button type="submit" className="admin-table__action">
        Filtrer
      </button>
    </form>
  );
}

function StatTile({
  label,
  value,
  tone,
}: Readonly<{ label: string; value: string; tone: "good" | "critical" }>) {
  return (
    <section className="dashboard-panel">
      <h2>{label}</h2>
      <strong
        style={{
          fontSize: "1.75rem",
          color: tone === "good" ? "var(--good-text, #0ca30c)" : "var(--critical-text, #d03b3b)",
        }}
      >
        {value}
      </strong>
    </section>
  );
}
