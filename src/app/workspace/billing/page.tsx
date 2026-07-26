import Link from "next/link";
import { redirect } from "next/navigation";

import { prisma } from "@/infrastructure/shared/prisma-client";
import { parsePage, toSkipTake } from "@/shared/pagination";
import { Pagination } from "../_components/pagination";
import { getWorkspaceRequestContext } from "../get-workspace-context";
import { formatXof } from "./_lib/money";
import {
  ArchiveCatalogueItemForm,
  CreateCatalogueItemForm,
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
  const [
    clients,
    quotes,
    totalQuotes,
    invoices,
    totalInvoices,
    invoicesForBalances,
    catalogue,
  ] = await Promise.all([
    prisma.client.findMany({
      where: { worldKey, status: "ACTIVE" },
      orderBy: { name: "asc" },
    }),
    prisma.quote.findMany({
      where: { worldKey },
      include: { client: true, lines: true, invoice: true },
      orderBy: { issuedAt: "desc" },
      skip,
      take,
    }),
    prisma.quote.count({ where: { worldKey } }),
    prisma.invoice.findMany({
      where: { worldKey },
      include: { client: true, lines: true, payments: true },
      orderBy: { issuedAt: "desc" },
      skip,
      take,
    }),
    prisma.invoice.count({ where: { worldKey } }),
    // Full scan needed to compute accurate per-client balances (an aggregate,
    // not a browsable list) — kept lean (no client include) to limit overfetch.
    prisma.invoice.findMany({
      where: { worldKey },
      select: {
        clientId: true,
        status: true,
        discountCents: true,
        taxRateBps: true,
        lines: { select: { quantity: true, unitPriceCents: true } },
        payments: { select: { amountCents: true } },
      },
    }),
    prisma.catalogueItem.findMany({
      where: { worldKey, status: "ACTIVE" },
      orderBy: { label: "asc" },
    }),
  ]);
  const totalQuotePages = Math.max(
    1,
    Math.ceil(totalQuotes / pageParams.pageSize),
  );
  const totalInvoicePages = Math.max(
    1,
    Math.ceil(totalInvoices / pageParams.pageSize),
  );

  const clientBalances = clients.map((client) => {
    const clientInvoices = invoicesForBalances.filter(
      (invoice) =>
        invoice.clientId === client.id && invoice.status !== "CANCELLED",
    );
    const billed = clientInvoices.reduce(
      (sum, invoice) => sum + invoiceTotal(invoice),
      0,
    );
    const paid = clientInvoices.reduce(
      (sum, invoice) =>
        sum +
        invoice.payments.reduce(
          (inner, payment) => inner + payment.amountCents,
          0,
        ),
      0,
    );
    return { client, billed, paid, balance: Math.max(0, billed - paid) };
  });
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
            clientBalances.reduce((sum, item) => sum + item.balance, 0),
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
              const total = documentTotal(quote);
              return (
                <article className="billing-card" key={quote.id}>
                  <header>
                    <div>
                      <p className="billing-card__eyebrow">{quote.number}</p>
                      <h2>{quote.client.name}</h2>
                    </div>
                    <span
                      className={`status-badge status-badge--${quote.status.toLowerCase()}`}
                    >
                      {QUOTE_STATUS_LABEL[quote.status]}
                    </span>
                  </header>
                  <p>
                    {quote.lines.length} ligne(s) · {formatXof(total)}
                  </p>
                  <p className="admin-table__note">
                    Valide jusqu’au{" "}
                    {quote.validUntil?.toLocaleDateString("fr-FR") ?? "—"}
                  </p>
                  <details className="billing-card__actions">
                    <summary>Actions</summary>
                    <QuoteActionsForm
                      quoteId={quote.id}
                      version={quote.version}
                      status={quote.status}
                      canConvert={quote.status === "ACCEPTED" && !quote.invoice}
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
            const total = invoiceTotal(invoice);
            const paid = invoice.payments.reduce(
              (sum, payment) => sum + payment.amountCents,
              0,
            );
            const balance = Math.max(0, total - paid);
            return (
              <article className="billing-card" key={invoice.id}>
                <header>
                  <div>
                    <p className="billing-card__eyebrow">{invoice.number}</p>
                    <h2>{invoice.client.name}</h2>
                  </div>
                  <span
                    className={`status-badge status-badge--${invoice.status.toLowerCase()}`}
                  >
                    {INVOICE_STATUS_LABEL[invoice.status]}
                  </span>
                </header>
                <p>
                  Total {formatXof(total)} · Payé {formatXof(paid)} · Solde{" "}
                  {formatXof(balance)}
                </p>
                <p className="admin-table__note">
                  Échéance : {invoice.dueAt?.toLocaleDateString("fr-FR") ?? "—"}
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
        <Pagination
          basePath="/workspace/billing"
          searchParams={{ world: worldKey, tab: "invoices" }}
          page={pageParams.page}
          totalPages={totalInvoicePages}
          total={totalInvoices}
        />
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
                <tr key={item.client.id}>
                  <td>{item.client.name}</td>
                  <td>{formatXof(item.billed)}</td>
                  <td>{formatXof(item.paid)}</td>
                  <td>{formatXof(item.balance)}</td>
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

function documentTotal(document: {
  lines: { quantity: number; unitPriceCents: number }[];
  discountCents: number;
  taxRateBps: number;
}): number {
  const subtotal = document.lines.reduce(
    (sum, line) => sum + line.quantity * line.unitPriceCents,
    0,
  );
  const taxable = Math.max(0, subtotal - document.discountCents);
  return taxable + Math.round((taxable * document.taxRateBps) / 10000);
}

function invoiceTotal(invoice: {
  lines: { quantity: number; unitPriceCents: number }[];
  discountCents: number;
  taxRateBps: number;
}): number {
  return documentTotal(invoice);
}

const QUOTE_STATUS_LABEL: Readonly<Record<string, string>> = {
  DRAFT: "Brouillon",
  SENT: "Envoyé",
  ACCEPTED: "Accepté",
  DECLINED: "Refusé",
  EXPIRED: "Expiré",
  CONVERTED: "Converti",
  CANCELLED: "Annulé",
};
const INVOICE_STATUS_LABEL: Readonly<Record<string, string>> = {
  DRAFT: "Brouillon",
  SENT: "Envoyée",
  PARTIALLY_PAID: "Partiellement payée",
  PAID: "Payée",
  OVERDUE: "En retard",
  CANCELLED: "Annulée",
};
