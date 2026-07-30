import Link from "next/link";
import { redirect } from "next/navigation";

import { prisma } from "@/infrastructure/shared/prisma-client";
import { listBillingSummary } from "@/modules/billing/application/billing-summary-query";
import { PrismaBillingSummaryReader } from "@/modules/billing/infrastructure/prisma-billing-summary-query";
import { parsePage, toSkipTake } from "@/shared/pagination";
import { formatDate } from "@/shared/format";
import { Pagination } from "../_components/pagination";
import { StatusBadge } from "../_components/status-badge";
import { getWorkspaceRequestContext } from "../get-workspace-context";
import { formatXof } from "./_lib/money";
import {
  ArchiveCatalogueItemForm,
  CreateCatalogueItemForm,
  CreateInvoiceForm,
  CreateQuoteForm,
  InvoiceActionsForm,
  QuoteActionsForm,
} from "./billing-forms";

const BILLING_ROLES = ["SUPER_ADMIN", "ADMIN", "WORLD_MANAGER"] as const;
const TABS = [
  { id: "quotes", label: "Devis" },
  { id: "invoices", label: "Factures" },
  { id: "balances", label: "Soldes clients" },
  { id: "catalogue", label: "Catalogue" },
] as const;
export default async function WorkspaceBillingPage({
  searchParams,
}: {
  searchParams: Promise<{ world?: string; tab?: string; page?: string }>;
}) {
  const context = await getWorkspaceRequestContext();
  if (!context) redirect("/login");
  if (
    !context.actor?.role ||
    !BILLING_ROLES.includes(
      context.actor.role as (typeof BILLING_ROLES)[number],
    )
  ) {
    return (
      <p role="alert">
        Vous n&apos;êtes pas autorisé à consulter la facturation.
      </p>
    );
  }

  const { world, tab, page: pageParam } = await searchParams;
  const worldKey = world ?? "pixel-digital";
  const activeTab = TABS.find((item) => item.id === tab)?.id ?? "quotes";
  const pageParams = parsePage(pageParam);
  const { skip, take } = toSkipTake(pageParams);
  const summary = await listBillingSummary(
    { billingSummaryReader: new PrismaBillingSummaryReader(prisma) },
    context,
    { worldKey, skip, take },
  );
  if (!summary.ok) return <p role="alert">Accès refusé.</p>;
  const {
    clients,
    quotes,
    totalQuotes,
    invoices,
    totalInvoices,
    balances: clientBalances,
    catalogue,
  } = summary.value;
  const totalQuotePages = Math.max(
    1,
    Math.ceil(totalQuotes / pageParams.pageSize),
  );
  const totalInvoicePages = Math.max(
    1,
    Math.ceil(totalInvoices / pageParams.pageSize),
  );

  return (
    <>
      <div className="admin-page-heading">
        <div>
          <h1 className="admin-content__title">Facturation XOF</h1>
          <p className="admin-content__lede">
            Devis, factures, paiements et soldes clients.
          </p>
        </div>
        <span className="admin-metric">
          {formatXof(
            clientBalances.reduce((sum, item) => sum + item.balanceCents, 0),
          )}{" "}
          à encaisser
        </span>
      </div>

      <div className="admin-tabs" role="tablist">
        {TABS.map((item) => (
          <Link
            key={item.id}
            href={`/workspace/billing?world=${worldKey}&tab=${item.id}`}
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

      {activeTab === "quotes" ? (
        <>
          <section className="billing-card-grid">
            {quotes.length === 0 ? (
              <p className="admin-empty">Aucun devis.</p>
            ) : null}
            {quotes.map((quote) => {
              return (
                <article className="billing-card" key={quote.id}>
                  <header>
                    <div>
                      <p className="billing-card__eyebrow">{quote.number}</p>
                      <h2>{quote.clientName}</h2>
                    </div>
                    <StatusBadge kind="quote" status={quote.status} />
                  </header>
                  <p>
                    {quote.lineCount} ligne(s) · {formatXof(quote.totalCents)}
                  </p>
                  <p className="admin-table__note">
                    Valide jusqu’au{" "}
                    {quote.validUntil ? formatDate(quote.validUntil) : "—"}
                  </p>
                  <details className="billing-card__actions">
                    <summary>Actions</summary>
                    <QuoteActionsForm
                      quoteId={quote.id}
                      version={quote.version}
                      status={quote.status}
                      canConvert={quote.canConvert}
                    />
                  </details>
                </article>
              );
            })}
          </section>
          <Pagination
            basePath="/workspace/billing"
            searchParams={{ world: worldKey, tab: "quotes" }}
            page={pageParams.page}
            totalPages={totalQuotePages}
            total={totalQuotes}
          />
          <h2 className="admin-content__subtitle">Nouveau devis</h2>
          <CreateQuoteForm
            worldKey={worldKey}
            clients={clients.map((client) => ({
              id: client.id,
              label: client.name,
            }))}
            catalogueDatalistId="billing-catalogue-labels"
          />
          <datalist id="billing-catalogue-labels">
            {catalogue.map((item) => (
              <option key={item.id} value={item.label} />
            ))}
          </datalist>
        </>
      ) : null}

      {activeTab === "invoices" ? (
        <section className="billing-card-grid">
          {invoices.length === 0 ? (
            <p className="admin-empty">Aucune facture.</p>
          ) : null}
          {invoices.map((invoice) => {
            return (
              <article className="billing-card" key={invoice.id}>
                <header>
                  <div>
                    <p className="billing-card__eyebrow">{invoice.number}</p>
                    <h2>{invoice.clientName}</h2>
                  </div>
                  <StatusBadge kind="invoice" status={invoice.status} />
                </header>
                <p>
                  Total {formatXof(invoice.totalCents)} · Payé{" "}
                  {formatXof(invoice.paidCents)} · Solde{" "}
                  {formatXof(invoice.balanceCents)}
                </p>
                <p className="admin-table__note">
                  Échéance : {invoice.dueAt ? formatDate(invoice.dueAt) : "—"}
                </p>
                <div className="admin-table__actions">
                  <Link
                    className="admin-table__action"
                    href={`/workspace/billing/invoices/${invoice.id}/print`}
                  >
                    Imprimer
                  </Link>
                </div>
                {invoice.status !== "PAID" && invoice.status !== "CANCELLED" ? (
                  <details className="billing-card__actions">
                    <summary>Actions</summary>
                    <InvoiceActionsForm
                      invoiceId={invoice.id}
                      version={invoice.version}
                      status={invoice.status}
                    />
                  </details>
                ) : null}
              </article>
            );
          })}
        </section>
      ) : null}
      {activeTab === "invoices" ? (
        <>
          <Pagination
            basePath="/workspace/billing"
            searchParams={{ world: worldKey, tab: "invoices" }}
            page={pageParams.page}
            totalPages={totalInvoicePages}
            total={totalInvoices}
          />
          <h2 className="admin-content__subtitle">Nouvelle facture</h2>
          <CreateInvoiceForm
            worldKey={worldKey}
            clients={clients.map((client) => ({
              id: client.id,
              label: client.name,
            }))}
            catalogueDatalistId="billing-catalogue-labels-invoices"
          />
          <datalist id="billing-catalogue-labels-invoices">
            {catalogue.map((item) => (
              <option key={item.id} value={item.label} />
            ))}
          </datalist>
        </>
      ) : null}
      {activeTab === "balances" ? (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Facturé</th>
                <th>Payé</th>
                <th>Solde</th>
              </tr>
            </thead>
            <tbody>
              {clientBalances.map((item) => (
                <tr key={item.clientId}>
                  <td>{item.clientName}</td>
                  <td>{formatXof(item.billedCents)}</td>
                  <td>{formatXof(item.paidCents)}</td>
                  <td>{formatXof(item.balanceCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {activeTab === "catalogue" ? (
        <>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Libellé</th>
                  <th>Type</th>
                  <th>Prix XOF</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {catalogue.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="admin-empty">
                      Aucun service ou produit.
                    </td>
                  </tr>
                ) : (
                  catalogue.map((item) => (
                    <tr key={item.id}>
                      <td>{item.label}</td>
                      <td>{item.kind === "SERVICE" ? "Service" : "Produit"}</td>
                      <td>{formatXof(item.unitPriceCents)}</td>
                      <td>
                        <ArchiveCatalogueItemForm
                          itemId={item.id}
                          version={item.version}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <h2 className="admin-content__subtitle">
            Ajouter un service ou produit
          </h2>
          <CreateCatalogueItemForm worldKey={worldKey} />
        </>
      ) : null}
    </>
  );
}
